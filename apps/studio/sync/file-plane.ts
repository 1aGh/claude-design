// The file plane — Sync v2 Increment 3 (DDR-226 §§3–7).
//
// ONE lane, both directions, one decision function. This module is what
// replaces the sprawl: the asset sweep, the fast-lane push, the asset pull and
// the manifest file-pull all answered a slice of "what should happen to this
// file", each with its own trigger, its own idea of the answer, and its own
// echo suppression. Here there is a single question asked per path —
// `decideFile(local, remote, ancestor)` — and a single place that carries out
// whatever it says.
//
// ── The pass ────────────────────────────────────────────────────────────────
//
//   1. Read the hub's journal from our cursor (or from 0 when re-anchoring).
//      Its compaction IS the remote manifest; a delta read is the steady state.
//   2. Scan local disk through the classifier, hashing only files whose
//      (size, mtime) no longer match the ledger's stat cache.
//   3. For every path in the union, ask `decideFile`.
//   4. Do what it said, in an order that survives being killed: bytes land
//      before ancestors move, conflicts park before they adopt.
//
// ── Why the cursor is not just an optimization ──────────────────────────────
//
// A cursor means the hub can answer "what changed since 412" instead of
// "here is everything", which is what lets a poke be cheap enough to act on
// immediately. But it also carries the safety property: a cursor the hub
// cannot honour comes back as `reanchor`, and we then re-read from 0 rather
// than assuming nothing changed. "No cursor" must never render as "no news".
//
// ── What this deliberately does NOT do yet ──────────────────────────────────
//
// EMIT deletions. `decideFile` has the rows and they are tested, but
// `propagateDeletes` stays off until Increment 6 ships the tombstone door and
// the mass-delete breakers. Until then a local absence is HELD: we neither
// resurrect the file nor tell the hub to drop it.

import { createHash } from 'node:crypto';
import {
  type Dirent,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { conflictCopyName, decideFile, type FileState } from './decide-file.ts';
import type { DeliveryState, FileLedger } from './file-ledger.ts';
import {
  type CanvasGroupLike,
  classifyProjectFile,
  type FileClass,
  isFilePlaneClass,
} from './file-membership.ts';
import { fetchJournal, type JournalEntry } from './journal-client.ts';
import { createPullBudget } from './pull-budget.ts';

/** How long to wait for one file's bytes. Generous — these run to videos. */
const GET_TIMEOUT_MS = 120_000;
const PUT_TIMEOUT_MS = 120_000;

/** Refuse an implausible body rather than streaming it to disk. */
const MAX_FILE_BYTES = 512 * 1024 * 1024;

/** How many files one pass will move. The remainder is the next pass's work. */
const MAX_FILES_PER_PASS = 200;

/**
 * How many consecutive `reanchor` answers before we stop obeying them.
 *
 * A re-anchor is a full compaction read plus `pruneRemotes`, and it sets
 * `degraded`, under which every differing path parks a copy of the hub's
 * bytes. A hub that answers `reanchor` to everything is therefore a
 * disk-filling primitive rather than a peer with a rotated epoch.
 */
export const REANCHOR_STORM_LIMIT = 5;

/**
 * How many FIRST-ANCHOR conflicts one pass will resolve before it stops and asks.
 *
 * The flip-day shape, and it is structural rather than hypothetical: a project
 * that has been linked with the file plane off has a hub `system/**` that is
 * stale by construction, so the first pass with it on finds dozens of paths
 * where both sides have content and this machine has never reconciled either —
 * every one a `diverged` with no ancestor. Resolving them silently means a
 * person opens their editor to a tree of `*.maude-conflict-*` files they did
 * not ask for and cannot easily undo in bulk.
 *
 * Under the limit it is ordinary conflict handling. Over it, the pass holds
 * everything, reports the count, and waits for a bulk keep-local / keep-cloud
 * answer — with the Open-decision-2 fallback of proceeding conservatively
 * (park, propagate nothing) if nobody answers, so a headless desktop cannot
 * stall forever.
 */
export const FIRST_ANCHOR_STORM_LIMIT = 10;

/** Walk depth ceiling — matches the classifier's own shape cap. */
const MAX_WALK_DEPTH = 8;

/** Directories no plane path can live under. */
const SKIPPED_DIRS = new Set(['_trash', '_history', '_untrusted', '_smoke', 'node_modules']);

export interface FilePlaneResult {
  pulled: string[];
  pushed: string[];
  conflicts: { rel: string; copy: string | null }[];
  /** Refused by re-classification or per-class admission. */
  dropped: { rel: string; reason: string }[];
  failed: { rel: string; reason: string }[];
  /** Present and equal — the converged steady state. */
  synced: number;
  /** The hub asked us to start over. */
  reanchored: boolean;
  /** The pass stopped on the aggregate byte budget. */
  budgetExhausted?: true;
  /** Consecutive `reanchor` answers tripped the storm limit; the pass held. */
  reanchorHeld?: true;
  /**
   * More first-anchor conflicts than one pass will decide alone. The paths are
   * listed so the panel can offer one keep-local / keep-cloud for all of them.
   */
  firstAnchorHeld?: { count: number; paths: string[] };
}

export interface FilePlaneOptions {
  designRoot: string;
  hubUrl: string;
  /** Read at call time — silent renewal swaps the credential in place. */
  token: () => string;
  ledger: FileLedger;
  canvasGroups?: readonly CanvasGroupLike[];
  /**
   * Whether `code-module` entries may LAND here. Computed by the caller from
   * LOCAL state (hubs.json role / loopback pairing) — never from anything the
   * hub said. The hub gates the write side too now, but a gate on one side is
   * half a gate, so both ask.
   */
  allowCodeModules: boolean;
  /** Names conflict copies. Same exposure class as `syncMeta.by` (hostname). */
  label: string;
  /** Increment 6. Off means a local absence is HELD, never propagated. */
  propagateDeletes?: boolean;
  /**
   * The user's bulk answer to a first-anchor storm — `'keep-local'` pushes
   * ours over theirs, `'keep-cloud'` takes theirs and parks ours. Absent means
   * a storm holds and asks (see `FIRST_ANCHOR_STORM_LIMIT`).
   */
  resolveFirstAnchor?: 'keep-local' | 'keep-cloud';
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn'>;
  now?: () => number;
  maxPassBytes?: number;
}

interface LocalFile {
  rel: string;
  abs: string;
  hash: string;
  size: number;
  mtimeMs: number;
  cls: FileClass;
}

const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * Walk the design root and hash what the classifier admits.
 *
 * The stat cache is what makes this cheap: a converged project re-reads
 * nothing, because every file's `(size, mtimeMs)` still matches the ledger.
 */
export function scanLocalFiles(
  designRoot: string,
  ledger: FileLedger,
  canvasGroups?: readonly CanvasGroupLike[]
): Map<string, LocalFile> {
  const found: { rel: string; abs: string; size: number; mtimeMs: number }[] = [];

  const walk = (dir: string, rel: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('.') || SKIPPED_DIRS.has(name)) continue;
      if (name.startsWith('_') && entry.isDirectory()) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      const childAbs = path.join(dir, name);
      if (entry.isDirectory()) {
        walk(childAbs, childRel, depth + 1);
        continue;
      }
      // A symlink never enters the plane — on either side.
      if (!entry.isFile()) continue;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(childAbs);
      } catch {
        continue;
      }
      if (st.size > MAX_FILE_BYTES) continue;
      found.push({ rel: childRel, abs: childAbs, size: st.size, mtimeMs: st.mtimeMs });
    }
  };
  walk(designRoot, '', 1);

  // Classify against the walked SNAPSHOT, so the sibling-css split cannot race
  // a concurrent write (the same discipline the hub manifest uses).
  const names = new Set(found.map((f) => f.rel));
  const opts = { canvasGroups, hasFile: (r: string) => names.has(r) };

  const out = new Map<string, LocalFile>();
  for (const f of found) {
    const cls = classifyProjectFile(f.rel, opts);
    if (!isFilePlaneClass(cls)) continue;
    let hash = ledger.cachedHash(f.rel, f.size, f.mtimeMs);
    if (hash === null) {
      try {
        hash = sha256(readFileSync(f.abs));
      } catch {
        continue;
      }
      ledger.noteLocal(f.rel, hash, f.size, f.mtimeMs);
    }
    out.set(f.rel, { rel: f.rel, abs: f.abs, hash, size: f.size, mtimeMs: f.mtimeMs, cls });
  }
  return out;
}

/**
 * Fold journal entries into "what the hub currently holds", newest row wins.
 */
export function foldRemote(entries: JournalEntry[]): Map<string, JournalEntry> {
  const out = new Map<string, JournalEntry>();
  for (const e of entries) {
    const prev = out.get(e.path);
    if (!prev || e.seq > prev.seq) out.set(e.path, e);
  }
  return out;
}

export interface FilePlane {
  /** One full pass. Never throws. */
  reconcile(): Promise<FilePlaneResult>;
  /** Paths whose delivery state the panel should show. */
  doruceka(): Record<string, DeliveryState>;
}

export function createFilePlane(opts: FilePlaneOptions): FilePlane {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console;
  const now = opts.now ?? Date.now;
  const base = opts.hubUrl.replace(/\/+$/, '');
  const { ledger, designRoot } = opts;
  /**
   * The design root with its own symlinks resolved. Containment is judged
   * against THIS, not the configured string — otherwise a project reached
   * through a symlinked path (a Syncthing tree, a `/tmp` fixture on macOS)
   * fails its own containment check for every legitimate write.
   */
  const realRoot = (() => {
    try {
      return realpathSync(designRoot);
    } catch {
      return designRoot;
    }
  })();

  const auth = () => ({ authorization: `Bearer ${opts.token()}` });

  /** Consecutive passes the hub answered `reanchor` to. Reset by any that did not. */
  let reanchorsInARow = 0;

  /** Fetch one file's bytes and verify them against the hash we were promised. */
  async function fetchVerified(
    rel: string,
    expectHash: string,
    ceiling: number
  ): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string; overCap?: true }> {
    let res: Response;
    try {
      res = await fetchImpl(
        `${base}/_project-file/${rel.split('/').map(encodeURIComponent).join('/')}`,
        { headers: auth(), signal: AbortSignal.timeout(GET_TIMEOUT_MS) }
      );
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    // The cap is consulted BEFORE the body exists, and again as it arrives.
    // Buffering first and measuring after is not a cap at all: a hub answering
    // with a body that never ends fills this process's heap for the whole
    // timeout window and the check never gets to run. The hub's own
    // `streamAndHash` has always had this shape; the asymmetry was the bug.
    const cap = Math.max(0, Math.min(MAX_FILE_BYTES, ceiling));
    const declared = Number(res.headers?.get?.('content-length') ?? Number.NaN);
    if (Number.isFinite(declared) && declared > cap) {
      return {
        ok: false,
        reason: `over the cap before a byte was read (${declared} B > ${cap} B)`,
        overCap: true,
      };
    }

    const bytes = await readCapped(res, cap);
    if (!bytes.ok) return bytes;
    // The hub may REFUSE to serve; it must never be able to SUBSTITUTE.
    const got = sha256(bytes.bytes);
    if (got !== expectHash) {
      return { ok: false, reason: 'content hash mismatch (racing a write?)' };
    }
    return { ok: true, bytes: bytes.bytes };
  }

  /**
   * Read a response body, abandoning it the moment it exceeds `cap`.
   *
   * Falls back to `arrayBuffer()` only when the response has no readable
   * stream (a test double, or a runtime without one) — there the length check
   * is still after the fact, but a double is not the threat.
   */
  async function readCapped(
    res: Response,
    cap: number
  ): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string; overCap?: true }> {
    const body = res.body;
    if (!body?.getReader) {
      const all = new Uint8Array(await res.arrayBuffer());
      if (all.byteLength > cap) {
        return {
          ok: false,
          reason: `implausible size (${all.byteLength} B > ${cap} B)`,
          overCap: true,
        };
      }
      return { ok: true, bytes: all };
    }
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > cap) {
          await reader.cancel().catch(() => {});
          return {
            ok: false,
            reason: `over the cap mid-stream (${total} B > ${cap} B)`,
            overCap: true,
          };
        }
        chunks.push(value);
      }
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.byteLength;
    }
    return { ok: true, bytes };
  }

  /**
   * What the hub CLAIMS a row costs — a hint, never the fact.
   *
   * A missing or absurd `size` charges nothing, which is exactly the hole
   * `chargeOverrun` closes: a hub declaring `size: 0` for two hundred 512 MB
   * rows would otherwise land ~100 GB per pass against a budget that never
   * moved — literally the arithmetic `pull-budget.ts` exists to prevent.
   */
  function claimedSize(row?: { size?: number | null }): number {
    const n = row?.size;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Charge what actually arrived, over and above what was claimed.
   *
   * `file-pull.ts` — the lane this replaces — has always done this, with a
   * comment saying an understated size must not buy a bigger transfer. The
   * rule survives the rewrite.
   */
  function chargeOverrun(
    budget: ReturnType<typeof createPullBudget>,
    rel: string,
    actual: number,
    claimed: number,
    out: FilePlaneResult
  ): boolean {
    if (actual <= claimed) return true;
    if (budget.take(actual - claimed)) return true;
    out.failed.push({
      rel,
      reason: `pass byte budget reached (declared ${claimed} B, sent ${actual} B)`,
    });
    out.budgetExhausted = true;
    return false;
  }

  /**
   * `realpathSync` for a path that does not exist yet — resolve the deepest
   * ancestor that DOES exist and re-attach the tail. `path.join` is lexical
   * and never touches disk, which is exactly why it is not a containment check.
   */
  function realParent(abs: string): string {
    let cur = path.dirname(abs);
    for (;;) {
      try {
        return realpathSync(cur);
      } catch {
        const up = path.dirname(cur);
        if (up === cur) return cur;
        cur = up;
      }
    }
  }

  /**
   * Where `rel` may actually be written, or null.
   *
   * The lane this replaced carried a lexical containment assertion; this one
   * carried neither that nor the refusal to overwrite a non-file. Lexical
   * traversal is still blocked upstream (the classifier's shape gate refuses
   * `..`, absolutes, backslashes and control chars, and `journal-client.ts`
   * re-validates independently) — but a SYMLINKED INTERMEDIATE DIRECTORY is a
   * different question, and `writeFileSync` + `renameSync` follow those
   * happily. `<designRoot>/system/ds/assets -> ~/.ssh` would land
   * `system/ds/assets/config.css` outside the design root entirely.
   *
   * The hub defends this case explicitly on its own write surfaces; the
   * receiver did not, which is an asymmetry against DDR-226 §9's "receivers
   * re-shape-validate paths and re-classify locally". Same two-guard shape as
   * the hub's: resolve the real parent, assert it is under the real root, and
   * then do every filesystem op on `join(realParent, basename)`.
   */
  function safeTarget(rel: string): { abs: string; parent: string } | null {
    const lexical = path.join(designRoot, rel);
    const parent = realParent(lexical);
    if (parent !== realRoot && !parent.startsWith(realRoot + path.sep)) {
      log.warn?.(
        `[sync/files] refusing ${rel}: it resolves outside the design root (a symlinked directory on the path)`
      );
      return null;
    }
    const abs = path.join(parent, path.basename(lexical));
    // A directory, a symlink, a socket — anything that is not a regular file
    // sitting where a file belongs is refused rather than replaced.
    try {
      if (!statSync(abs).isFile()) {
        log.warn?.(`[sync/files] refusing ${rel}: the target exists and is not a regular file`);
        return null;
      }
    } catch {
      /* absent is the normal case for a create */
    }
    return { abs, parent };
  }

  /**
   * Would this peer ever accept `rel` at all? The cheap gate, run before a
   * hub-named path is allowed to become persistent state.
   *
   * Deliberately weaker than the admission check at decision time: it has no
   * scanned local map, so it asks the disk directly. Anything it lets through
   * is still fully re-classified there.
   */
  function admissible(rel: string): boolean {
    const cls = classifyProjectFile(rel, {
      canvasGroups: opts.canvasGroups,
      hasFile: (r) => existsSync(path.join(designRoot, r)),
    });
    return isFilePlaneClass(cls);
  }

  /** Land bytes at `rel`, atomically. Throws on failure — `adoptAfter` catches. */
  function materialize(rel: string, bytes: Uint8Array): void {
    const target = safeTarget(rel);
    if (!target) throw new Error(`refusing to write ${rel} — it does not resolve inside the root`);
    mkdirSync(target.parent, { recursive: true });
    const tmp = `${target.abs}.part`;
    writeFileSync(tmp, bytes);
    renameSync(tmp, target.abs);
  }

  /** Copy the local file aside under a name both ends can see. Returns the rel. */
  function parkLocal(rel: string): string | null {
    const abs = path.join(designRoot, rel);
    const copyRel = conflictCopyName(rel, now(), opts.label);
    const target = safeTarget(copyRel);
    if (!target) return null;
    try {
      const bytes = readFileSync(abs);
      mkdirSync(target.parent, { recursive: true });
      const tmp = `${target.abs}.part`;
      writeFileSync(tmp, bytes);
      renameSync(tmp, target.abs);
      return copyRel;
    } catch (err) {
      log.warn?.(`[sync/files] could not park ${rel}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Upload one file with a compare-and-swap against the state we decided from.
   */
  async function push(
    local: LocalFile,
    expect: string | null
  ): Promise<
    | { ok: true; seq: number | null }
    | { ok: false; conflict: true; current: string | null }
    | { ok: false; conflict?: false; reason: string }
  > {
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(local.abs);
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
    // In flight, so a journal row carrying this hash reads as our own echo
    // rather than as a remote change we must react to.
    ledger.outboxAdd(local.hash);
    try {
      const res = await fetchImpl(
        `${base}/api/file/${local.rel.split('/').map(encodeURIComponent).join('/')}`,
        {
          method: 'PUT',
          headers: {
            ...auth(),
            'content-type': 'application/octet-stream',
            'x-maude-content-sha256': local.hash,
            'x-maude-expect-hash': expect ?? 'none',
          },
          body: bytes as unknown as BodyInit,
          signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
        }
      );
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { current?: unknown };
        return {
          ok: false,
          conflict: true,
          current: typeof body?.current === 'string' ? body.current : null,
        };
      }
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
      const body = (await res.json().catch(() => ({}))) as { seq?: unknown };
      return { ok: true, seq: typeof body?.seq === 'number' ? body.seq : null };
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    } finally {
      ledger.outboxDone(local.hash);
    }
  }

  async function reconcile(): Promise<FilePlaneResult> {
    const out: FilePlaneResult = {
      pulled: [],
      pushed: [],
      conflicts: [],
      dropped: [],
      failed: [],
      synced: 0,
      reanchored: false,
    };

    // ── 1. The hub's side ────────────────────────────────────────────────
    const startedFrom = ledger.cursor();
    let fullRead = startedFrom === 0;
    let page = await fetchJournal({
      hubUrl: opts.hubUrl,
      token: opts.token(),
      since: startedFrom,
      epoch: ledger.epoch(),
      fetchImpl,
    });
    // Unreachable / refused / journal-less: this pass does nothing, and the
    // next one asks again. NEVER "nothing changed".
    if (page === null) return out;

    // Whether our ANCESTORS still describe the hub's log.
    //
    // Computed BEFORE re-anchoring, because re-anchoring adopts the hub's
    // epoch — ask afterwards and the answer is always "fine", and the degraded
    // rows in the decision table could never fire at all. The whole point of
    // those rows is the pass that discovers the log moved out from under us.
    let degraded = ledger.isDegraded(page.epoch);

    if (page.reanchor) {
      // A RE-ANCHOR STORM IS A DISK-FILLING PRIMITIVE, so obedience is capped.
      //
      // Re-anchoring is a full compaction read plus `pruneRemotes`, and it sets
      // `degraded`, under which every differing path parks a copy of the hub's
      // bytes. A hub that answers `reanchor` to every request therefore drives
      // unbounded work and (before the park memo) unbounded files. Past the
      // limit the pass holds and says so; the next pass tries again from a
      // clean counter, so a legitimate epoch rotation still converges.
      reanchorsInARow += 1;
      if (reanchorsInARow > REANCHOR_STORM_LIMIT) {
        log.warn?.(
          `[sync/files] the hub has asked to re-anchor ${reanchorsInARow} times in a row — holding this pass. Ancestors are untouched and nothing was overwritten.`
        );
        out.reanchorHeld = true;
        return out;
      }
      out.reanchored = true;
      log.warn?.(
        `[sync/files] re-anchoring against the hub (${page.reason ?? 'cursor not in this log'}).`
      );
      // A cursor we held that the hub cannot honour means our anchor is not in
      // their log — whether the epoch rotated or the log rewound underneath
      // it. Either way the ancestors stop being overwrite authority for this
      // pass; they are demoted, not discarded.
      if (startedFrom > 0) degraded = true;
      ledger.reanchor(page.epoch);
      fullRead = true;
      page = await fetchJournal({
        hubUrl: opts.hubUrl,
        token: opts.token(),
        since: 0,
        fetchImpl,
      });
      if (page === null || page.reanchor) return out;
    }

    if (!out.reanchored) reanchorsInARow = 0;

    // THE HUB'S SIDE IS THE LEDGER'S REPLICA, UPDATED BY THIS PAGE — not the
    // page itself. A delta says "these changed"; it says nothing at all about
    // the paths it omits. Reading that silence as "the hub does not have them"
    // would push every converged file back up on every pass, and would be
    // absence-as-authority (DDR-076) rebuilt one layer above the table that
    // forbids it. Only a FULL read may retract a remembered remote.
    const delta = foldRemote(page.entries);
    for (const [rel, row] of delta) {
      // CLASSIFY BEFORE REMEMBERING. Admission used to run at decision time
      // only, which meant every path the hub named — including a page of pure
      // junk — became a ledger row on disk and a key in `_sync.json` first,
      // and a second `stuck` row immediately after. One response could grow
      // this machine's persistent state without bound, and the rows were never
      // pruned by count, so the poisoning survived restarts. The full
      // admission below is unchanged; this is the cheaper gate in front of it.
      if (!admissible(rel)) {
        // Reported, so a refusal is never silent — but not REMEMBERED. `drop`
        // declines to mint a row for a path this machine does not already
        // track, so the pass says what it refused without the hub being able
        // to grow our ledger by naming things.
        drop(out, rel, 'the hub offered a path this peer does not admit', ledger);
        delta.delete(rel);
        continue;
      }
      ledger.noteRemote(rel, row.deleted ? null : row.sha256, row.seq);
    }
    if (fullRead) ledger.pruneRemotes(new Set(delta.keys()));

    // ── 2. Ours ──────────────────────────────────────────────────────────
    const local = scanLocalFiles(designRoot, ledger, opts.canvasGroups);

    // ── 3. Decide ────────────────────────────────────────────────────────
    let work: {
      rel: string;
      decision: ReturnType<typeof decideFile>;
      local: LocalFile | undefined;
      row: JournalEntry | undefined;
      remoteHash: string | null;
    }[] = [];

    // Every path either side knows about — including ones only the LEDGER
    // remembers, which is how a file that stopped changing still gets checked.
    const paths = new Set<string>([
      ...local.keys(),
      ...delta.keys(),
      ...Object.keys(ledger.rows()),
    ]);
    for (const rel of paths) {
      const row = delta.get(rel);
      const here = local.get(rel);
      // What the hub holds: this page when it spoke about the path, otherwise
      // what we last learned. `undefined` (never learned) reads as null only
      // after a full read has had the chance to say so.
      const remoteHash = row ? (row.deleted ? null : row.sha256) : (ledger.remoteOf(rel) ?? null);

      // ADMISSION RUNS FOR EVERY PATH THE HUB OFFERS — not only for the ones
      // this page happened to mention.
      //
      // Gating on "the delta carried a row" was a hole with teeth: a cursor
      // read is silent about unchanged paths, so a code module refused on the
      // pass that introduced it sailed straight through on the next tick,
      // sourced from the remembered remote with no gate in front of it. The
      // admission belongs to the OFFER, not to the notification.
      if (remoteHash !== null) {
        // THIS peer's verdict on the path, not the hub's. A disagreement is a
        // drop, not a negotiation (DDR-054: the hub's class is a hint).
        const cls = classifyProjectFile(rel, {
          canvasGroups: opts.canvasGroups,
          hasFile: (r) => local.has(r) || existsSync(path.join(designRoot, r)),
        });
        if (!isFilePlaneClass(cls)) {
          drop(out, rel, `classifies '${cls}' here`, ledger);
          continue;
        }
        if (cls === 'code-module' && !opts.allowCodeModules) {
          drop(
            out,
            rel,
            'code modules replicate only from an owner-vouched or loopback hub',
            ledger
          );
          continue;
        }
      }

      const state: FileState = {
        path: rel,
        local: here?.hash ?? null,
        remote: remoteHash,
        ancestor: ledger.ancestorOf(rel),
        ...(row?.deleted ? { remoteTombstone: true } : {}),
        ...(degraded ? { epochChanged: true } : {}),
        ...(remoteHash && ledger.outboxHas(remoteHash) ? { selfInFlight: true } : {}),
        ...(opts.propagateDeletes ? { propagateDeletes: true } : {}),
      };
      const decision = decideFile(state);
      if (decision.action === 'noop' && !decision.parkRemote) {
        if (decision.adoptAncestor && here) {
          // Record agreement so the next pass is a stat and nothing more.
          //
          // The state comes from the REMEMBERED remote, not from this page. A
          // converged file is precisely the one a delta never mentions, so
          // reading `row` here made every settled file report `local-only` —
          // a panel saying "not delivered" about files that had been on the
          // hub for hours. That is the status-lies failure DDR-214 exists to
          // end, and it is worse than no panel: it teaches people to distrust
          // the one surface meant to answer the question.
          void ledger.adoptAfter(rel, here.hash, () => {}, {
            ...(row ? { remoteSeq: row.seq } : {}),
            size: here.size,
            mtimeMs: here.mtimeMs,
            state: remoteHash !== null ? 'on-hub' : 'local-only',
          });
          out.synced += 1;
        }
        continue;
      }
      work.push({ rel, decision, local: here, row, remoteHash });
    }

    // FLIP-DAY BREAKER. Counted before anything is applied, because the point
    // is to not have parked forty files by the time anyone notices.
    const firstAnchor = work.filter(
      (w) =>
        w.decision.action === 'conflict-aside' &&
        ledger.ancestorOf(w.rel) === null &&
        w.local !== undefined
    );
    if (firstAnchor.length > 0 && opts.resolveFirstAnchor === 'keep-local') {
      // Ours wins the set: drop the pull half of each conflict and let the
      // push half send local up. Nothing is parked, because nothing is lost —
      // the hub's copy is still in its own journal and its own object storage.
      for (const w of firstAnchor) {
        w.decision = {
          action: 'push',
          reason: 'you chose to keep this machine’s copies for the whole set',
        };
      }
    }
    if (firstAnchor.length > FIRST_ANCHOR_STORM_LIMIT && !opts.resolveFirstAnchor) {
      const paths = firstAnchor.map((w) => w.rel).sort();
      log.warn?.(
        `[sync/files] ${paths.length} files differ on both sides and this machine has never reconciled any of them — holding, rather than parking ${paths.length} conflict copies. Choose keep-local or keep-cloud for the set.`
      );
      out.firstAnchorHeld = { count: paths.length, paths: paths.slice(0, 200) };
      for (const w of firstAnchor) {
        ledger.setState(w.rel, 'conflict', {
          reason: 'both sides have content and neither has been reconciled here yet',
        });
      }
      // Everything that is NOT a first-anchor conflict still flows: holding a
      // whole pass over one class would stall ordinary sync too.
      work = work.filter((w) => !firstAnchor.includes(w));
    }

    // ── 4. Apply ─────────────────────────────────────────────────────────
    //
    // Referenced assets first (DDR-223's strokes→bytes coupling): a picture a
    // just-arrived annotation points at is the one a person is staring at.
    const referenced = referencedAssetNames(designRoot);
    work.sort((a, b) => rank(a.rel, referenced) - rank(b.rel, referenced));

    const budget = createPullBudget({
      label: 'sync/files',
      log,
      ...(opts.maxPassBytes !== undefined ? { maxBytes: opts.maxPassBytes } : {}),
    });

    let moved = 0;
    for (const item of work) {
      if (moved >= MAX_FILES_PER_PASS) {
        log.warn?.(
          `[sync/files] ${work.length - moved} more path(s) to reconcile; taking them next pass.`
        );
        break;
      }
      if (budget.exhausted()) {
        out.budgetExhausted = true;
        break;
      }
      const handled = await applyOne(item, out, budget);
      if (handled) moved += 1;
    }

    // ── 5. Position ──────────────────────────────────────────────────────
    //
    // Only advance the cursor when the pass actually consumed the page. A
    // partial pass re-reads the same range next time, which is free (the
    // decisions for already-converged paths are `noop`).
    if (!page.truncated && out.failed.length === 0) {
      ledger.setPosition(page.epoch, page.head);
    } else {
      ledger.setPosition(page.epoch, ledger.cursor());
    }
    ledger.flush();

    if (out.pulled.length || out.pushed.length || out.conflicts.length) {
      log.log?.(
        `[sync/files] ${out.pulled.length} down, ${out.pushed.length} up, ${out.conflicts.length} conflict(s), ${out.synced} already in step${
          out.failed.length ? `, ${out.failed.length} failed` : ''
        }.`
      );
    }
    return out;
  }

  async function applyOne(
    item: {
      rel: string;
      decision: ReturnType<typeof decideFile>;
      local?: LocalFile;
      row?: JournalEntry;
      remoteHash: string | null;
    },
    out: FilePlaneResult,
    budget: ReturnType<typeof createPullBudget>
  ): Promise<boolean> {
    const { rel, decision, local: here, row, remoteHash } = item;

    switch (decision.action) {
      case 'noop': {
        // Only the epoch-degraded rows reach here: keep local, park THEIR
        // copy so it is recoverable, and let the push half send ours up.
        if (decision.parkRemote && remoteHash) {
          // ONCE per remote hash. The decision is `noop`, so the ancestor
          // deliberately does not move and the next pass sees the identical
          // state — without this memo a hub that re-anchors every request
          // (or merely rotates its epoch, which is a legitimate event) writes
          // a fresh timestamped copy of every diverged path on every pass,
          // and each copy is then scanned as `create-up` and pushed back up.
          if (ledger.row(rel)?.parkedRemote === remoteHash) return true;
          const claim = claimedSize(row);
          if (!budget.take(claim)) {
            out.budgetExhausted = true;
            return false;
          }
          const got = await fetchVerified(rel, remoteHash, budget.remaining() + claim);
          if (!got.ok) {
            if (got.overCap && budget.remaining() + claim < MAX_FILE_BYTES) {
              out.budgetExhausted = true;
            }
            return false;
          }
          if (!chargeOverrun(budget, rel, got.bytes.byteLength, claim, out)) return false;
          const copyRel = conflictCopyName(rel, now(), 'hub');
          try {
            materialize(copyRel, got.bytes);
            ledger.setState(rel, 'conflict', {
              reason: 'the hub’s log restarted; their copy is parked beside yours',
              conflictCopy: copyRel,
              parkedRemote: remoteHash,
            });
            out.conflicts.push({ rel, copy: copyRel });
          } catch (err) {
            out.failed.push({ rel, reason: (err as Error).message });
          }
        }
        return true;
      }

      case 'pull': {
        // From the REMEMBERED remote, not only from this page. A pull that
        // failed last pass leaves the hub's hash known and this page silent
        // about it; sourcing the fetch from the page alone would mean a
        // transient 500 permanently stranded the file.
        if (!remoteHash) return false;
        const claim = claimedSize(row);
        if (!budget.take(claim)) {
          out.budgetExhausted = true;
          return false;
        }
        const got = await fetchVerified(rel, remoteHash, budget.remaining() + claim);
        if (!got.ok) {
          out.failed.push({ rel, reason: got.reason });
          ledger.setState(rel, 'stuck', { reason: got.reason });
          // Refused because it would not fit in what is LEFT, not because it is
          // implausible on its own: that is the budget speaking, so the pass
          // says so and the next one picks the file up with a full budget.
          if (got.overCap && budget.remaining() + claim < MAX_FILE_BYTES) {
            out.budgetExhausted = true;
          }
          return false;
        }
        if (!chargeOverrun(budget, rel, got.bytes.byteLength, claim, out)) return false;
        const landed = await ledger.adoptAfter(rel, remoteHash, () => materialize(rel, got.bytes), {
          ...(row ? { remoteSeq: row.seq } : {}),
          state: 'on-hub',
        });
        if (landed) {
          // Re-stat so the cache matches what is now on disk, or the very next
          // pass re-hashes everything it just wrote.
          restat(rel);
          out.pulled.push(rel);
        } else {
          out.failed.push({ rel, reason: 'could not materialize' });
        }
        return landed;
      }

      case 'push':
      case 'revive': {
        if (!here) return false;
        ledger.setState(rel, 'pushing');
        const expect = decision.action === 'revive' ? null : remoteHash;
        const res = await push(here, expect);
        if (res.ok) {
          await ledger.adoptAfter(rel, here.hash, () => {}, {
            ...(res.seq !== null ? { remoteSeq: res.seq } : {}),
            size: here.size,
            mtimeMs: here.mtimeMs,
            state: 'on-hub',
          });
          out.pushed.push(rel);
          return true;
        }
        if (res.conflict) {
          // The hub moved under us. Do NOT retry blindly — re-decide next
          // pass against what it actually holds now, which is exactly what a
          // cursor read will hand us.
          ledger.setState(rel, 'conflict', {
            reason: 'the hub changed this file while the upload was in flight',
          });
          out.conflicts.push({ rel, copy: null });
          return true;
        }
        out.failed.push({ rel, reason: res.reason });
        ledger.setState(rel, 'stuck', { reason: res.reason });
        return false;
      }

      case 'conflict-aside': {
        if (!remoteHash || !here) return false;
        const claim = claimedSize(row);
        if (!budget.take(claim)) {
          out.budgetExhausted = true;
          return false;
        }
        // PARK FIRST. If the copy does not land, the overwrite is refused —
        // DDR-102's fail-closed rule, applied to files: a loser we cannot
        // recover is a loser we must not create.
        const copyRel = parkLocal(rel);
        if (copyRel === null) {
          out.failed.push({ rel, reason: 'could not park the local copy — refusing to overwrite' });
          ledger.setState(rel, 'stuck', {
            reason: 'both sides changed this file and the local copy could not be parked',
          });
          return false;
        }
        const got = await fetchVerified(rel, remoteHash, budget.remaining() + claim);
        if (!got.ok) {
          out.failed.push({ rel, reason: got.reason });
          if (got.overCap && budget.remaining() + claim < MAX_FILE_BYTES) {
            out.budgetExhausted = true;
          }
          return false;
        }
        if (!chargeOverrun(budget, rel, got.bytes.byteLength, claim, out)) return false;
        const landed = await ledger.adoptAfter(rel, remoteHash, () => materialize(rel, got.bytes), {
          ...(row ? { remoteSeq: row.seq } : {}),
          state: 'conflict',
        });
        if (!landed) {
          out.failed.push({ rel, reason: 'could not materialize the hub copy' });
          return false;
        }
        restat(rel);
        ledger.setState(rel, 'conflict', {
          reason: 'both sides changed this file; your version is beside it',
          conflictCopy: copyRel,
        });
        out.conflicts.push({ rel, copy: copyRel });
        // The copy travels too, so BOTH ends see the conflict rather than only
        // the machine that happened to lose.
        const copyLocal = statLocal(copyRel);
        if (copyLocal) {
          const res = await push(copyLocal, null);
          if (res.ok) out.pushed.push(copyRel);
        }
        return true;
      }

      case 'quarantine': {
        // Deletion is Increment 6; the row exists so the shape is settled, and
        // the applier refuses to act on it until the breakers ship.
        ledger.setState(rel, 'conflict', {
          reason: 'the hub deleted this file; deletion handling ships in a later release',
        });
        return true;
      }

      case 'propagate-delete': {
        // Same: the decision is reachable only with the flag on, and the door
        // it needs does not exist yet.
        return true;
      }

      default: {
        const never: never = decision.action;
        throw new Error(`file-plane: unhandled action ${String(never)}`);
      }
    }
  }

  function restat(rel: string): void {
    try {
      const st = statSync(path.join(designRoot, rel));
      const row = ledger.row(rel);
      if (row?.syncedHash) ledger.noteLocal(rel, row.syncedHash, st.size, st.mtimeMs);
    } catch {
      /* the next pass re-hashes it */
    }
  }

  function statLocal(rel: string): LocalFile | null {
    const abs = path.join(designRoot, rel);
    try {
      const st = statSync(abs);
      const hash = sha256(readFileSync(abs));
      return { rel, abs, hash, size: st.size, mtimeMs: st.mtimeMs, cls: 'inert-media' };
    } catch {
      return null;
    }
  }

  return {
    reconcile,
    doruceka() {
      const out: Record<string, DeliveryState> = {};
      for (const [rel, row] of Object.entries(ledger.rows())) {
        out[rel] = row.state ?? 'local-only';
      }
      return out;
    },
  };
}

function drop(out: FilePlaneResult, rel: string, reason: string, ledger?: FileLedger): void {
  out.dropped.push({ rel, reason });
  // Only for a path this machine actually tracks. A path we have never held
  // and will never accept is not "stuck" — it is not ours, and minting a row
  // to say so is how a hostile page turned one response into permanent state.
  if (ledger && !ledger.row(rel)) return;
  // A REFUSAL OUTRANKS EVERYTHING (DDR-214, applied to files). A path this
  // peer declines is not "local-only" — it is not here at all, and never will
  // be until something changes. Letting it fall through to the default state
  // would put a file in the panel's ordinary column that is in fact being
  // actively refused, which is the shape of "we didn't know it was stuck".
  ledger?.setState(rel, 'stuck', { reason });
}

/** `assets/<name>` referenced anywhere in the tree — the priority front-queue. */
function referencedAssetNames(designRoot: string): Set<string> {
  const out = new Set<string>();
  const RE = /assets\/([A-Za-z0-9._-]+\.[A-Za-z0-9]+)/g;
  const SCANNED = /\.(?:annotations\.svg|tsx|jsx|css|meta\.json)$/i;
  const walk = (dir: string, depth: number): void => {
    if (depth > MAX_WALK_DEPTH) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIPPED_DIRS.has(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'assets') continue;
        walk(abs, depth + 1);
        continue;
      }
      if (!SCANNED.test(entry.name)) continue;
      try {
        for (const m of readFileSync(abs, 'utf8').matchAll(RE)) {
          if (m[1]) out.add(m[1]);
        }
      } catch {
        /* unreadable is not referenced */
      }
    }
  };
  walk(designRoot, 1);
  return out;
}

/** 0 = a referenced asset (front of the queue), 1 = everything else. */
function rank(rel: string, referenced: Set<string>): number {
  const slash = rel.lastIndexOf('/');
  const base = slash === -1 ? rel : rel.slice(slash + 1);
  return referenced.has(base) ? 0 : 1;
}
