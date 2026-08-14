// The file plane's downward half — manifest-driven replication of every
// project file the canvas lanes do not own (feature-sync-file-plane, binding
// decision maude/sync-two-plane-manifest-architecture).
//
// WHAT THIS REPLACES, AND WHY THE HEADER OF `asset-pull.ts` STILL MATTERS.
// The asset pull derives its wants LOCALLY (it fetches only names its own
// files reference), so a hostile hub can never place a file nobody asked for.
// That invariant is exactly what made the 103-file gap unfixable: a fresh
// link REFERENCES nothing, so it can want nothing, so the design system that
// makes the canvases render never arrives (RCA
// issue-fresh-link-gets-canvases-but-not-the-design-system). The manifest
// DELIBERATELY replaces reference-derivation for the gated classes — and what
// stands in for it is the receiver-side discipline below, which is stronger
// than a reference scan, not weaker:
//
//   1. EVERY entry is RE-CLASSIFIED against this peer's OWN tree and config
//      (`classifyProjectFile` — the positive, default-closed classifier). The
//      hub's `class` field is a HINT for reporting; a disagreement drops the
//      entry with one warn (ATTACKER's invariant from the binding debate: the
//      receiver re-validates every path; naming authority is never handed to
//      the hub).
//   2. Per-class admission: `inert-media` and `companion-text` flow;
//      `code-module` lands ONLY when this peer's STORED record for the hub
//      says `role === 'owner'`, or the hub is this machine's own loopback
//      cell pairing — decided from local state, never from the wire.
//   3. Deletion does NOT propagate. A vanished manifest entry means "no
//      longer offered", never "delete yours" (scope cut: the branch-switch-
//      as-mass-delete hazard is dodged structurally).
//   4. Conflicts never lose work silently: on a hash mismatch the newer
//      `mtimeMs` wins, and a losing LOCAL copy parks in
//      `_trash/<rel>-conflict-<ts>` (`quarantineFile` — the tombstone lane's
//      quarantine-never-delete posture). If parking fails, the overwrite is
//      refused.
//
// CODE MODULES AND THE BUILD. A pulled `code-module` lands in the live tree,
// so this lane's admission is paired with the canvas build's import
// allowlist being unconditional (`restrictImportsTo: designRoot` at every
// build site — Task 9 of the same feature, landed with it): what a module
// can reach is bounded by the design root on every runtime, so a pulled file
// cannot turn the build into a read of the wider filesystem.
//
// MISSING-ONLY IS THE STEADY STATE: equal hash → skip (echo-guard by
// construction), so a converged project costs one manifest fetch per poll.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  type CanvasGroupLike,
  classifyProjectFile,
  type FileClass,
  isFilePlaneClass,
} from './file-membership.ts';
import { quarantineFile } from './tombstone-apply.ts';

/** How long to wait for the manifest. Same figure as the doc listing. */
const MANIFEST_TIMEOUT_MS = 6000;

/** How long to wait for one file. Generous — these run to videos. */
const GET_TIMEOUT_MS = 120_000;

/** Refuse an implausible body outright rather than streaming it to disk. */
const MAX_PULL_BYTES = 512 * 1024 * 1024;

/** How many files one pass will fetch — the loud cap, same reasoning as
 *  every other lane: one answer must not land thousands, and the remainder
 *  is picked up by the next pass. */
const MAX_FILES_PER_PASS = 200;

/** One entry as the hub offers it. Everything here is UNTRUSTED input. */
export interface RemoteFileEntry {
  path: string;
  sha256: string;
  size: number;
  mtimeMs: number;
  /** The hub's claimed class — a reporting hint, never authority. */
  class: string;
}

export interface FilePullConflict {
  rel: string;
  winner: 'local' | 'hub';
  /** Set when the hub won and the local copy was parked. */
  trashedTo?: string;
}

export interface FilePullResult {
  pulled: string[];
  /** Present with an equal hash — the converged steady state. */
  skipped: number;
  conflicts: FilePullConflict[];
  /** Refused by re-classification or per-class admission. */
  dropped: { rel: string; reason: string }[];
  failed: { rel: string; reason: string }[];
}

/**
 * Fetch the manifest, never fatally: null means unreachable, refused, or a
 * hub without the route — sync continues either way, we ask again later
 * (the `fetchRemoteListing` posture). Entries are filtered to the expected
 * SHAPE here; the classifier judges the paths themselves at pull time.
 */
export async function fetchFileManifest(
  hubUrl: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<RemoteFileEntry[] | null> {
  try {
    const base = hubUrl.replace(/\/+$/, '');
    const res = await fetchImpl(`${base}/api/files`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MANIFEST_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { files?: unknown };
    if (!Array.isArray(body?.files)) return null;
    return body.files
      .filter(
        (f): f is RemoteFileEntry =>
          !!f &&
          typeof (f as RemoteFileEntry).path === 'string' &&
          (f as RemoteFileEntry).path.length > 0 &&
          typeof (f as RemoteFileEntry).sha256 === 'string' &&
          /^[0-9a-f]{64}$/.test((f as RemoteFileEntry).sha256)
      )
      .map((f) => ({
        path: f.path,
        sha256: f.sha256,
        size: Number(f.size) || 0,
        mtimeMs: Number(f.mtimeMs) || 0,
        class: String(f.class ?? ''),
      }));
  } catch {
    return null;
  }
}

export interface PullFilesOptions {
  designRoot: string;
  hubUrl: string;
  /** Read at call time — silent renewal swaps the credential in place. */
  token: () => string;
  /** Declared canvas groups — the same config the canvas receiver honours. */
  canvasGroups?: readonly CanvasGroupLike[];
  /**
   * Whether `code-module` entries may land: the STORED record for this hub
   * vouches `role === 'owner'`, or the hub is this machine's own loopback
   * cell pairing. Computed by the caller from LOCAL state (hubs.json /
   * cell-pairing) — never from anything the hub sent.
   */
  allowCodeModules: boolean;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn'>;
  now?: () => number;
}

/**
 * One downward pass: manifest → re-classify → admit → reconcile → fetch.
 * Sequential on purpose (the asset lanes' reasoning — don't starve the
 * handshakes); never throws — a failure is a line in `failed` and a free
 * retry on the next poll.
 */
export async function pullFiles(opts: PullFilesOptions): Promise<FilePullResult> {
  const { designRoot, hubUrl } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console;
  const now = opts.now ?? Date.now;
  const base = hubUrl.replace(/\/+$/, '');
  const out: FilePullResult = { pulled: [], skipped: 0, conflicts: [], dropped: [], failed: [] };

  const manifest = await fetchFileManifest(hubUrl, opts.token(), fetchImpl);
  if (manifest === null) return out;

  // Decide the whole pass from the manifest first, then move bytes: a local
  // win costs no fetch at all, and the loud cap counts only real transfers.
  const classifyOpts = {
    canvasGroups: opts.canvasGroups,
    hasFile: (r: string) => existsSync(path.join(designRoot, r)),
  };
  const wanted: { entry: RemoteFileEntry; abs: string; conflict: FilePullConflict | null }[] = [];

  for (const entry of manifest) {
    const rel = entry.path;
    // 1. THIS peer's own verdict on the path — shape and class in one call.
    const localClass: FileClass = classifyProjectFile(rel, classifyOpts);
    if (!isFilePlaneClass(localClass)) {
      drop(out, log, rel, `classifies '${localClass}' here`);
      continue;
    }
    // The hub's class is a hint; a disagreement is a drop, not a negotiation.
    if (entry.class !== localClass) {
      drop(out, log, rel, `hub says '${entry.class}', this peer says '${localClass}'`);
      continue;
    }
    // 2. Per-class admission — the owner-hub gate, from LOCAL state only.
    if (localClass === 'code-module' && !opts.allowCodeModules) {
      drop(out, log, rel, 'code modules replicate only from an owner-vouched or loopback hub');
      continue;
    }
    if (entry.size > MAX_PULL_BYTES) {
      drop(out, log, rel, `implausible size (${entry.size} B)`);
      continue;
    }

    // 3. Reconcile against the local copy.
    const abs = path.join(designRoot, rel);
    const resolved = path.resolve(abs);
    const root = path.resolve(designRoot);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      // Unreachable while the classifier holds (no `..`, no absolutes) —
      // belt and braces for the one lane where a hub NAME becomes a path.
      drop(out, log, rel, 'escapes the design root');
      continue;
    }
    let st: ReturnType<typeof statSync> | null = null;
    try {
      st = statSync(abs);
    } catch {
      st = null;
    }
    if (st !== null) {
      if (!st.isFile()) {
        drop(out, log, rel, 'a non-file sits at this path locally');
        continue;
      }
      let localSha: string;
      try {
        localSha = createHash('sha256').update(readFileSync(abs)).digest('hex');
      } catch (err) {
        out.failed.push({ rel, reason: `unreadable local copy: ${(err as Error).message}` });
        continue;
      }
      if (localSha === entry.sha256) {
        out.skipped += 1;
        continue;
      }
      // LWW by mtime. The local file wins ties: overwriting a person's disk
      // needs the remote to be STRICTLY newer.
      if (!(entry.mtimeMs > st.mtimeMs)) {
        out.conflicts.push({ rel, winner: 'local' });
        continue;
      }
      wanted.push({ entry, abs, conflict: { rel, winner: 'hub' } });
      continue;
    }
    wanted.push({ entry, abs, conflict: null });
  }

  const batch = wanted.slice(0, MAX_FILES_PER_PASS);
  if (batch.length < wanted.length) {
    // Named loudly — a silent cap reads as "sync is broken" with no cause.
    log.warn(
      `[sync/files] the project offers ${wanted.length} files this peer is missing; taking ${batch.length} this pass.`
    );
  }

  for (const { entry, abs, conflict } of batch) {
    const rel = entry.path;
    try {
      const res = await fetchImpl(
        `${base}/_project-file/${rel.split('/').map(encodeURIComponent).join('/')}`,
        {
          headers: { authorization: `Bearer ${opts.token()}` },
          signal: AbortSignal.timeout(GET_TIMEOUT_MS),
        }
      );
      if (!res.ok) {
        out.failed.push({ rel, reason: `HTTP ${res.status}` });
        continue;
      }
      const body = new Uint8Array(await res.arrayBuffer());
      if (body.byteLength > MAX_PULL_BYTES) {
        out.failed.push({ rel, reason: `implausible size (${body.byteLength} B)` });
        continue;
      }
      // The manifest named a hash; the bytes must BE that hash. A mismatch is
      // usually a write racing the poll — a free retry, never a landing.
      const gotSha = createHash('sha256').update(body).digest('hex');
      if (gotSha !== entry.sha256) {
        out.failed.push({ rel, reason: 'content hash mismatch (racing a write?)' });
        continue;
      }
      if (conflict) {
        const trashedTo = quarantineFile({
          designRoot,
          rel,
          now: now(),
          log: (line) => log.log(line),
        });
        if (trashedTo === null) {
          // Could not park the loser ⇒ the overwrite is refused. Never
          // silent loss — the local copy stays, the conflict is reported.
          out.conflicts.push({ rel, winner: 'local' });
          continue;
        }
        conflict.trashedTo = trashedTo;
        out.conflicts.push(conflict);
      }
      mkdirSync(path.dirname(abs), { recursive: true });
      // Write beside the target and rename, so a reader never sees a
      // half-written file.
      const tmpAbs = `${abs}.part`;
      writeFileSync(tmpAbs, body);
      renameSync(tmpAbs, abs);
      out.pulled.push(rel);
    } catch (err) {
      out.failed.push({ rel, reason: (err as Error).message });
    }
  }

  if (out.pulled.length > 0 || out.conflicts.length > 0) {
    log.log(
      `[sync/files] pulled ${out.pulled.length} project file(s) down (${out.skipped} already here, ${out.conflicts.length} conflict(s), ${out.failed.length} failed).`
    );
  }
  return out;
}

/** One warn per (reason-class) flood is the caller's job; here every drop is
 *  one line — drops are refusals of UNTRUSTED input and deserve a trace. */
function drop(
  out: FilePullResult,
  log: Pick<Console, 'log' | 'warn'>,
  rel: string,
  reason: string
): void {
  out.dropped.push({ rel, reason });
  log.warn(`[sync/files] dropped '${rel}': ${reason}`);
}
