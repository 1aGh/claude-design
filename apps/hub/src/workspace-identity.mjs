// Whose backup generation is this? — Phase 0 Task F1/F2.
//
// THE BUG THIS EXISTS TO CLOSE. `MAUDE_BACKUP_PREFIX` has exactly one setter in
// the repository — `infra/cell/entrypoint.sh`, where the cell DERIVES it from
// the tenant id. `cli/lib/workspace-plan.mjs` has never mentioned it, so a
// self-hosted workspace writes to the bucket ROOT by construction rather than
// by operator error. Add `snapshotPrefix()` being time-only and a manifest of
// `{version, createdAt, files, repo?}` carrying no owner, and two hubs sharing
// one bucket interleave their generations into a single time-sorted keyspace:
// `listBackups` returns both, and `pruneOldBackups` (count-only, keep=14, no
// owner filter) deletes ACROSS the merge. Hub A's history dies on hub B's
// backup ticks, on a healthy Tuesday, with nothing failing anywhere.
//
// A generation therefore has to be able to say whose it is.
//
// THE WRITE SIDE IS THE LOAD-BEARING HALF. Refusing to WRITE into a keyspace
// owned by somebody else stops the destruction, works at the bare root, and
// needs no prefix to exist. The read-side refusal only decides who performs a
// wrong restore — a human or the machine — days after the real generations
// have already been pruned away. Write first; that ordering is deliberate.
//
// WHERE THE IDENTITY LIVES, AND THE TRAP IN THE OBVIOUS ANSWER.
// It is minted once into `<dataDir>/workspace-id.json`. But `/data` is exactly
// what a volume loss takes with it, so a hub coming back from a total loss has
// NO local identity — and the naive rule ("mint a new one, then compare")
// makes it refuse to restore its OWN backups. That is the primary recovery
// path, broken by the mechanism meant to protect it.
//
// So ownership on a cold start is resolved by the KEYSPACE, not by a local
// value that the same event just deleted:
//
//   prefix SET   → the operator namespaced this hub's keyspace, so whatever is
//                  in it is this hub's by construction. Adopt the generation's
//                  identity and restore.
//   prefix UNSET → the bare root is shared by definition. A generation there
//                  may belong to any hub, and nothing local survives to say
//                  otherwise. Refuse, and name both identities.
//
// That asymmetry is why the prefix is REQUIRED for newly rendered configs and
// merely OPTIONAL for existing ones (Task F3): after the write-side refusal
// lands, the prefix stops being a safety mechanism and becomes the thing that
// makes automatic recovery decidable.
//
// This module is pure decisions plus two tiny file effects, so the table can be
// tested without a bucket.

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The on-disk home of this hub's identity. */
export function workspaceIdPath(dataDir) {
  return join(dataDir, 'workspace-id.json');
}

/**
 * Read this hub's identity, or null when it has never been minted (or the file
 * is unreadable — a corrupt identity is treated as absent, because inventing a
 * value here would silently fork ownership of a live keyspace).
 */
export function readWorkspaceId(dataDir) {
  const path = workspaceIdPath(dataDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    const id = typeof parsed?.id === 'string' ? parsed.id.trim() : '';
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Write an identity, refusing to overwrite an existing one.
 *
 * NEVER derived from HUB_SECRET, the hostname, the project name, or anything
 * else in `.env`. Those are precisely the values an operator copies when
 * cloning a deployment — six hubs stamped from a copied `.env` would share one
 * identity, and both refusals would then pass on exactly the collision they
 * exist to catch. 128 bits of CSPRNG, minted per hub, copied by nobody.
 */
export function writeWorkspaceId(dataDir, id) {
  const path = workspaceIdPath(dataDir);
  if (existsSync(path)) {
    const existing = readWorkspaceId(dataDir);
    if (existing && existing !== id) {
      throw new Error(`workspace identity already set to ${existing}; refusing to overwrite`);
    }
    return existing ?? id;
  }
  writeFileSync(path, `${JSON.stringify({ id, createdAt: new Date().toISOString() }, null, 2)}\n`);
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best effort — a read-only /data is a different failure, reported elsewhere */
  }
  return id;
}

/** Read the identity, minting one on first call. */
export function ensureWorkspaceId(dataDir) {
  return readWorkspaceId(dataDir) ?? writeWorkspaceId(dataDir, randomBytes(16).toString('hex'));
}

/**
 * Adopt an identity recovered from a restored generation.
 *
 * The restore path's counterpart to `ensureWorkspaceId`: after rehydrating from
 * a generation this hub has established ownership of, the hub IS that
 * workspace and must keep writing under the same identity — otherwise the very
 * next backup tick would look like a second hub arriving in its own keyspace
 * and the write-side refusal would fire against itself.
 */
export function adoptWorkspaceId(dataDir, id) {
  if (!id) throw new Error('adoptWorkspaceId: refusing to adopt an empty identity');
  return writeWorkspaceId(dataDir, id);
}

// ------------------------------------------------------------------ decisions

/**
 * May this hub write a generation into this keyspace?
 *
 * @param {{localId: string, newestManifest: object|null}} input
 *   `newestManifest` is the manifest of the newest generation already present,
 *   or null when the keyspace is empty.
 * @returns {{ok: true} | {ok: false, reason: string, conflictWith: string}}
 */
export function decideBackupWrite({ localId, newestManifest }) {
  if (!newestManifest) return { ok: true };
  const owner = manifestOwner(newestManifest);
  // A legacy (version 1) generation names no owner. It cannot be proven
  // foreign, and refusing on it would disable backups for every existing
  // deployment on upgrade — trading a latent bug for an immediate one. Write,
  // and stamp ours; from this tick on the keyspace is identified.
  if (!owner) return { ok: true };
  if (owner === localId) return { ok: true };
  return {
    ok: false,
    reason: 'this keyspace already holds generations owned by another workspace',
    conflictWith: owner,
  };
}

/**
 * May this hub restore this generation, and does it need to adopt its identity?
 *
 * @param {{localId: string|null, generationManifest: object|null, prefixSet: boolean}} input
 * @returns {{action: 'restore'|'adopt-and-restore'|'refuse', reason?: string, adopt?: string, conflictWith?: string}}
 */
export function decideRestoreOwnership({ localId, generationManifest, prefixSet }) {
  const owner = manifestOwner(generationManifest);

  if (localId && owner) {
    return owner === localId
      ? { action: 'restore' }
      : {
          action: 'refuse',
          reason: 'this generation belongs to another workspace',
          conflictWith: owner,
        };
  }

  // No local identity — the usual shape of a total volume loss, and also the
  // shape of a brand-new hub pointed at somebody else's bucket. The keyspace
  // is the only thing left that can tell them apart.
  if (!localId) {
    if (!prefixSet) {
      return {
        action: 'refuse',
        reason:
          'this hub has no identity of its own and the backup target is the bare bucket root, ' +
          'so ownership of these generations cannot be established',
        conflictWith: owner ?? '(unidentified generation)',
      };
    }
    return owner ? { action: 'adopt-and-restore', adopt: owner } : { action: 'restore' };
  }

  // We have an identity; the generation does not (legacy, version 1). Under a
  // dedicated prefix that is our own history from before the upgrade. At the
  // bare root it is exactly the state two colliding hubs are already in, and
  // every one of their generations looks like this — so this is the one place
  // the missing field has to be read as "possibly not yours".
  return prefixSet
    ? { action: 'restore' }
    : {
        action: 'refuse',
        reason:
          'this generation predates workspace identity and the backup target is the bare bucket ' +
          'root, where generations from another hub are indistinguishable from your own',
        conflictWith: '(unidentified generation)',
      };
}

/** The owner recorded in a manifest, or null for a legacy (version 1) one. */
export function manifestOwner(manifest) {
  const id = manifest && typeof manifest.workspace === 'string' ? manifest.workspace.trim() : '';
  return id || null;
}
