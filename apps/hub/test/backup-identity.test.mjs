// Backup ownership — Phase 0 Tasks F1/F2.
//
// The bug: `MAUDE_BACKUP_PREFIX` is set in exactly one place in the repo (the
// CELL entrypoint, which derives it from the tenant id) and nowhere in
// `cli/lib/workspace-plan.mjs`, so a self-hosted workspace backs up to the
// bucket ROOT. `snapshotPrefix` is time-only and the manifest named no owner,
// so two hubs on one bucket interleaved into one time-sorted keyspace and
// `pruneOldBackups` — count-only, keep=14, no owner filter — deleted across
// the merge. Destruction on the WRITE path, with nothing failing.
//
// These tests pin the ownership rules. The important ones are the refusals:
// they are what a later edit removes without anything else noticing.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

import {
  fileTarget,
  inspectKeyspace,
  listBackups,
  pruneOldBackups,
  restoreLatest,
  runBackup,
} from '../src/backup.mjs';
import {
  adoptWorkspaceId,
  decideBackupWrite,
  decideRestoreOwnership,
  ensureWorkspaceId,
  manifestOwner,
  readWorkspaceId,
  workspaceIdPath,
  writeWorkspaceId,
} from '../src/workspace-identity.mjs';

const Database = createRequire(import.meta.url)('better-sqlite3');

const dirs = [];
function freshDir() {
  const d = mkdtempSync(join(tmpdir(), 'maude-ws-identity-'));
  dirs.push(d);
  return d;
}
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const gen = (workspace) => (workspace ? { version: 2, workspace } : { version: 1 });

// ------------------------------------------------------------------- minting

test('an identity is minted once and is stable across reads', () => {
  const dir = freshDir();
  assert.equal(readWorkspaceId(dir), null, 'nothing minted yet');
  const first = ensureWorkspaceId(dir);
  assert.match(first, /^[0-9a-f]{32}$/, '128 bits of hex');
  assert.equal(ensureWorkspaceId(dir), first, 'second call reuses it');
  assert.equal(readWorkspaceId(dir), first);
});

test('two hubs mint different identities', () => {
  assert.notEqual(ensureWorkspaceId(freshDir()), ensureWorkspaceId(freshDir()));
});

test('an existing identity is never silently overwritten', () => {
  const dir = freshDir();
  const mine = ensureWorkspaceId(dir);
  assert.throws(() => writeWorkspaceId(dir, 'somebody-else'), /refusing to overwrite/);
  assert.equal(readWorkspaceId(dir), mine);
});

test('a corrupt identity file reads as absent rather than as a value', () => {
  // Inventing a value from unparseable bytes would silently fork ownership of
  // a live keyspace, which is the failure this whole module exists to prevent.
  const dir = freshDir();
  writeFileSync(workspaceIdPath(dir), '{not json');
  assert.equal(readWorkspaceId(dir), null);
});

test('adopting an identity is how a restored hub keeps writing as itself', () => {
  // Without this the next backup tick after a restore would look like a second
  // hub arriving in its own keyspace, and the write refusal would fire against
  // the very hub it is protecting.
  const dir = freshDir();
  const recovered = 'a'.repeat(32);
  adoptWorkspaceId(dir, recovered);
  assert.equal(readWorkspaceId(dir), recovered);
  assert.throws(() => adoptWorkspaceId(dir, ''), /empty identity/);
});

// ---------------------------------------------------------------- write side

test('writing into an empty keyspace is allowed', () => {
  assert.deepEqual(decideBackupWrite({ localId: 'me', owners: [] }), { ok: true });
});

test('writing into our own keyspace is allowed', () => {
  assert.deepEqual(decideBackupWrite({ localId: 'me', owners: ['me'] }), { ok: true });
});

test('REFUSES to write into a keyspace owned by another workspace', () => {
  // The load-bearing assertion. Without it, hub B's ticks prune hub A away.
  const verdict = decideBackupWrite({ localId: 'me', owners: ['them'] });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.conflictWith, 'them');
});

test('a legacy generation does not block writing — upgrades must not lose backups', () => {
  // Refusing on a version-1 manifest would disable backups for every existing
  // deployment the moment it upgrades: a latent bug traded for an immediate one.
  assert.deepEqual(decideBackupWrite({ localId: 'me', owners: [null] }), { ok: true });
});

test('a foreign owner is caught even when it is not the newest generation', () => {
  // F7: the decision used to read only the lexically-newest manifest, so one
  // future-dated own key would hide a real conflict beneath it. It must see
  // the whole keyspace.
  const verdict = decideBackupWrite({ localId: 'me', owners: ['them', 'me', null] });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.conflictWith, 'them');
});

// ----------------------------------------------------------------- read side

test('restores its own generation', () => {
  assert.deepEqual(
    decideRestoreOwnership({ localId: 'me', generationManifest: gen('me'), prefixSet: true }),
    { action: 'restore' }
  );
});

test("REFUSES another workspace's generation even under a prefix", () => {
  const v = decideRestoreOwnership({
    localId: 'me',
    generationManifest: gen('them'),
    prefixSet: true,
  });
  assert.equal(v.action, 'refuse');
  assert.equal(v.conflictWith, 'them');
});

test('total volume loss under a prefix adopts the identity and restores', () => {
  // The primary recovery path. `/data` is gone, so there is no local identity —
  // a rule that minted a fresh one and then compared would make the hub refuse
  // to restore its OWN backups.
  const v = decideRestoreOwnership({
    localId: null,
    generationManifest: gen('mine-from-before'),
    prefixSet: true,
  });
  assert.equal(v.action, 'adopt-and-restore');
  assert.equal(v.adopt, 'mine-from-before');
});

test('REFUSES to restore with no local identity at the bare bucket root', () => {
  // Indistinguishable from hub B's first boot pointed at hub A's bucket.
  const v = decideRestoreOwnership({
    localId: null,
    generationManifest: gen('someone'),
    prefixSet: false,
  });
  assert.equal(v.action, 'refuse');
  assert.match(v.reason, /bare bucket root/);
});

test('REFUSES a legacy generation at the bare root, restores it under a prefix', () => {
  // Two hubs already colliding have ONLY identity-less generations, so at the
  // bare root "absent" must read as "possibly not yours". Under a dedicated
  // prefix the same manifest is simply our own pre-upgrade history.
  assert.equal(
    decideRestoreOwnership({ localId: 'me', generationManifest: gen(null), prefixSet: false })
      .action,
    'refuse'
  );
  assert.equal(
    decideRestoreOwnership({ localId: 'me', generationManifest: gen(null), prefixSet: true })
      .action,
    'restore'
  );
});

// ------------------------------------------------- the bug, end to end

/** A minimal but real hub.db, so `VACUUM INTO` has something to snapshot. */
function seedDataDir(dir) {
  const db = new Database(join(dir, 'hub.db'));
  db.exec('CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, data BLOB)');
  db.prepare('INSERT OR REPLACE INTO documents VALUES (?, ?)').run('c', Buffer.from('x'));
  db.close();
  return dir;
}

test('TWO HUBS, ONE BARE-ROOT BUCKET: the second refuses to write', async () => {
  // This is the shipped bug. Before ownership existed both hubs wrote happily
  // into `backups/<timestamp>/`, interleaved into one time-sorted keyspace,
  // and pruning deleted across the merge — hub A's history destroyed by hub
  // B's ticks, on a healthy day, with nothing failing anywhere.
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  const hubA = seedDataDir(freshDir());
  const hubB = seedDataDir(freshDir());

  const a = await runBackup({ dataDir: hubA, target, now: new Date('2026-08-18T01:00:00Z') });
  assert.equal(a.manifest.version, 2);
  assert.equal(a.manifest.workspace, readWorkspaceId(hubA));

  await assert.rejects(
    () => runBackup({ dataDir: hubB, target, now: new Date('2026-08-18T02:00:00Z') }),
    (err) => {
      assert.equal(err.code, 'IDENTITY_CONFLICT');
      assert.equal(err.conflictWith, readWorkspaceId(hubA));
      return true;
    }
  );

  // And nothing of hub A's was written over or removed on the way to refusing.
  assert.deepEqual(await listBackups(target), [a.prefix]);
});

test("prune never deletes another workspace's generations", async () => {
  // The destructive half. Even with the write guard in place, an interleaved
  // keyspace from before the upgrade must not be pruned across.
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  const mine = seedDataDir(freshDir());
  const workspace = ensureWorkspaceId(mine);

  // The foreign generation must be OLD, so it lands inside the doomed window
  // `slice(0, length - keep)`. A newer one is never a prune candidate at all,
  // and a test that puts it there passes against the very bug it guards.
  const FOREIGN = 'backups/20260818T000000Z';
  for (const h of ['01', '02']) {
    await runBackup({ dataDir: mine, target, now: new Date(`2026-08-18T${h}:00:00Z`) });
  }
  // Injected AFTER ours and dated BEFORE them — the interleave an upgrading
  // deployment inherits. (It cannot be written first: the write guard would
  // correctly refuse our own backups into a keyspace that already looks
  // foreign, which is a different test.)
  await target.put(
    `${FOREIGN}/manifest.json`,
    Buffer.from(JSON.stringify({ version: 2, workspace: 'someone-else', files: [] }))
  );

  const pruned = await pruneOldBackups({ target, keep: 1, workspace });
  assert.ok(pruned.length > 0, 'the window must actually contain something to prune');
  assert.ok(
    !pruned.includes(FOREIGN),
    "pruned a foreign generation — this is the deletion that ate hub A's history"
  );
  assert.ok((await listBackups(target)).includes(FOREIGN), 'the foreign generation survives');
});

test('restoreLatest refuses a generation this workspace cannot claim', async () => {
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  const theirs = seedDataDir(freshDir());
  await runBackup({ dataDir: theirs, target, now: new Date('2026-08-18T01:00:00Z') });

  const mine = freshDir();
  await assert.rejects(
    () =>
      restoreLatest({
        target,
        destDir: join(mine, 'restored'),
        ownership: { localId: 'a-different-workspace', prefixSet: true },
      }),
    (err) => err.code === 'IDENTITY_CONFLICT'
  );
});

test('total volume loss under a prefix restores and reports the identity to adopt', async () => {
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  const before = seedDataDir(freshDir());
  const id = ensureWorkspaceId(before);
  await runBackup({ dataDir: before, target, now: new Date('2026-08-18T01:00:00Z') });

  // `/data` is gone: no local identity at all.
  const after = freshDir();
  const result = await restoreLatest({
    target,
    destDir: join(after, 'restored'),
    ownership: { localId: null, prefixSet: true },
  });
  assert.equal(result.adopt, id, 'the hub must keep writing as the workspace it restored');
});

test('manifestOwner reads version 2 and tolerates version 1', () => {
  assert.equal(manifestOwner(gen('x')), 'x');
  assert.equal(manifestOwner(gen(null)), null);
  assert.equal(manifestOwner(null), null);
  assert.equal(manifestOwner({ version: 2, workspace: '   ' }), null);
});

// ------------------------------------------- the advisory report (Phase 0 F6)

test('inspectKeyspace reports a single owner, and never gates anything', async () => {
  const target = fileTarget(`file://${freshDir()}`);
  const mine = seedDataDir(freshDir());
  await runBackup({ dataDir: mine, target, now: new Date('2026-08-18T01:00:00Z') });

  const r = await inspectKeyspace(target, { workspace: ensureWorkspaceId(mine) });
  assert.equal(r.shared, false);
  assert.equal(r.generations, 1);
  assert.deepEqual(r.owners, [ensureWorkspaceId(mine)]);
});

test('inspectKeyspace names a SHARED keyspace — the state identity cannot undo', async () => {
  // Identity is forward-only: it stops new destruction and says nothing about
  // generations already interleaved from before the upgrade. This is the only
  // thing that tells an operator they are in that state.
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  const mine = seedDataDir(freshDir());
  await runBackup({ dataDir: mine, target, now: new Date('2026-08-18T01:00:00Z') });
  await target.put(
    'backups/20260818T000000Z/manifest.json',
    Buffer.from(JSON.stringify({ version: 2, workspace: 'someone-else', files: [] }))
  );

  const r = await inspectKeyspace(target, { workspace: ensureWorkspaceId(mine) });
  assert.equal(r.shared, true);
  assert.deepEqual(r.foreign, ['someone-else']);
  assert.match(r.verdict, /SHARED/);
});

test('legacy generations are reported, not called foreign', async () => {
  // Version-1 generations name nobody. Treating "unidentified" as "someone
  // else's" would report every upgrading deployment as a collision.
  const target = fileTarget(`file://${freshDir()}`);
  await target.put(
    'backups/20260818T000000Z/manifest.json',
    Buffer.from(JSON.stringify({ version: 1, files: [] }))
  );
  const r = await inspectKeyspace(target, { workspace: 'me' });
  assert.equal(r.shared, false);
  assert.equal(r.unidentified, 1);
  assert.match(r.verdict, /unidentified/);
});

// -------------------------------------------------- containment (F1/B2)

test('restoreLatest refuses a manifest that names a path outside the database set', async () => {
  // The manifest is attacker-writable in a shared bucket. A name like
  // "../repo/.git/hooks/post-checkout" would otherwise be written and then run
  // by the next autosave.
  const bucket = freshDir();
  const target = fileTarget(`file://${bucket}`);
  await target.put('backups/20260818T010000Z/hub.db.gz', Buffer.from([0x1f, 0x8b]));
  await target.put(
    'backups/20260818T010000Z/manifest.json',
    Buffer.from(
      JSON.stringify({
        version: 2,
        workspace: 'me',
        files: [{ name: '../escape.sh' }],
      })
    )
  );
  await assert.rejects(
    () =>
      restoreLatest({
        target,
        destDir: join(freshDir(), 'out'),
        ownership: { localId: 'me', prefixSet: true },
      }),
    /not a known database/
  );
});
