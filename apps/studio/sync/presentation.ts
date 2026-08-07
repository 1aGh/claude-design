// One rule for "what is the hub link doing", shared by every surface.
//
// There were two answers to that question and they disagreed. The status bar
// keyed off `state` alone — it referenced `docs` zero times, so a link whose
// every document the hub had refused still showed a green dot and the word
// "synced". The connect note in the cloud rail keyed off the ATTACH RESPONSE,
// a value that means "the runtime started", and never updated again. A user
// who distrusted one was sent to the other, which was wrong in a different way.
//
// So the rule lives here, once, as a pure function over the payload both
// surfaces already receive. Agreement between them is then structural rather
// than a thing two files have to remember.
//
// DDR-054 — document names and project names originate at the hub. Counts come
// first in every sentence so a hostile name cannot dominate it, names are
// capped, and nothing here produces markup.

import type { SyncStatusSnapshot } from './connection-state.ts';

/** Where a link is, in the terms a person cares about. */
export type SyncPhase =
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'refused'
  | 'offline'
  | 'nothing-syncable';

export interface SyncPresentation {
  phase: SyncPhase;
  /** Green dot — reserved for a link that is genuinely carrying edits. */
  online: boolean;
  /** Status-bar slot text. Terse; never contains a hub-supplied name. */
  label: string;
  /** Full sentence — the rail note and the status-bar hover. */
  title: string;
  /**
   * What the person should do now, or null when the honest answer is "nothing,
   * it is working". Every non-null phase names one — being told a state without
   * being told the move is the complaint this whole change exists for.
   */
  next: string | null;
  /** Up to 3 hub-supplied names relevant to the phase (refused / pulled). */
  names: string[];
}

/**
 * The `/_sync-status` payload, in its three historical shapes:
 *   - `{ linked: false }`                      — solo project, no link
 *   - `{ notSyncable, tsxCount, reason }`      — DDR-060, linked but 0 syncable
 *   - the connection-state snapshot + url/canvases (the common case)
 *
 * Every field is optional on purpose: pre-DDR-102 payloads have no `docs`, and
 * the browser and the CLI read the same JSON.
 */
export interface SyncStatusLike extends Partial<SyncStatusSnapshot> {
  linked?: boolean;
  notSyncable?: boolean;
  tsxCount?: number;
  reason?: string;
  canvases?: number;
}

/** Hub-supplied text that reaches a UI. Bounded, never markup. */
const MAX_NAME_LEN = 60;
const SHOWN_NAMES = 3;

export function safeName(raw: unknown, fallback: string): string {
  // Length alone was not enough. A name is hub-supplied (cell mode sets it from
  // `MAUDE_PROJECT_NAME`; `.design/config.json` is a committed file anyone with
  // repo access can author), and it lands in trusted app chrome — including a
  // `title=` tooltip, where a newline RENDERS and can push the true clause out
  // of view. `All 75 canvases synced.\n\n\n` fits inside 60 characters and
  // reads as a reassuring sentence of ours.
  //
  // So: strip control and format characters (which covers the bidi overrides
  // U+202A–U+202E / U+2066–U+2069 — a name that reverses the rest of the line
  // is the same attack by a different mechanism), then collapse whitespace to
  // single spaces so no name can ever contain a line break.
  const s = String(raw ?? '')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return fallback;
  return s.length > MAX_NAME_LEN ? `${s.slice(0, MAX_NAME_LEN)}…` : s;
}

function shownNames(list: readonly string[] | undefined): string[] {
  return (list ?? []).slice(0, SHOWN_NAMES).map((n) => safeName(n, '(unnamed)'));
}

/**
 * The per-document counts, or null if they cannot be trusted.
 *
 * FAIL CLOSED. `/_sync-status` returns `JSON.parse` of `_sync.json` with no
 * schema, so this function's input is whatever is on disk — a partial write, an
 * older producer, a newer one. `synced` was the FALL-THROUGH branch, which made
 * the reassuring answer the only reachable one for any shape not recognised:
 * `docs: {}` gave `total === NaN`, failed both `> 0` and `=== 0`, and rendered
 * "Synced — all NaN canvases", green. For a module whose entire premise is that
 * it does not overstate, the unreadable case must land in `connecting`, never
 * in `synced`.
 */
function readCounts(
  docs: SyncStatusLike['docs']
): { synced: number; pending: number; rejected: number } | null {
  if (!docs) return null;
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
  if (!ok(docs.synced) || !ok(docs.pending) || !ok(docs.rejected)) return null;
  return { synced: docs.synced, pending: docs.pending, rejected: docs.rejected };
}

/**
 * Read a sync payload the way a person would.
 *
 * Returns null when there is nothing to say — an unlinked project has no hub
 * status, and inventing one would put a slot on screen that can only ever be
 * empty.
 */
export function syncPresentation(
  status: SyncStatusLike | null | undefined,
  opts: { project?: string | null } = {}
): SyncPresentation | null {
  if (!status || status.linked === false) return null;
  const project = safeName(opts.project, 'the workspace');

  if (status.notSyncable) {
    const tsx = status.tsxCount ?? 0;
    return {
      phase: 'nothing-syncable',
      online: false,
      label: `0 syncable${tsx > 0 ? ` · ${tsx} tsx` : ''}`,
      title: status.reason
        ? safeName(status.reason, 'No canvases in this project are syncable yet.')
        : `Connected to ${project} — no canvases here are syncable yet.`,
      next: 'Create a canvas — it will start syncing on its own.',
      names: [],
    };
  }

  const queued = status.queuedOps ?? 0;
  const queueNote = queued > 0 ? ` ${queued} local edit${queued === 1 ? '' : 's'} are queued.` : '';
  const unreachable = status.state === 'offline' || status.state === 'offline-long';
  // Validated, not taken on trust — see `readCounts`. `null` means "unreadable",
  // which is deliberately NOT the same as "absent" (an old payload, handled
  // below) and must never reach the synced branch.
  const docs = readCounts(status.docs);
  const unreadable = status.docs !== undefined && docs === null;

  // A REFUSAL OUTRANKS EVERYTHING, including an unreachable hub.
  //
  // The offline branch used to sit above this one, and that was the bug from
  // one branch up: a hub can refuse auth on the documents it wants silenced and
  // then drop the sockets, and the user would be told "your edits are safe and
  // queued — nothing to do". For an auth-rejected document that is false and
  // never self-heals. Rejections are deliberately sticky (a dropped socket does
  // not launder them), so if one is on record it is still true while offline —
  // and it is the only part of the picture that needs a person.
  if (docs && docs.rejected > 0) {
    const total = docs.synced + docs.pending + docs.rejected;
    return {
      phase: 'refused',
      online: false,
      label: `${docs.rejected} refused`,
      title:
        `${docs.rejected} of ${total} canvas${total === 1 ? '' : 'es'} were refused by ${project} — their edits are not syncing.` +
        (unreachable ? ' The hub is also unreachable right now.' : ''),
      next: 'Reconnect the workspace — the credential may have been rotated.',
      names: shownNames(status.rejectedSlugs),
    };
  }

  // Otherwise an unreachable hub outranks every count. Whatever the documents
  // last said, nothing is moving — and "72 synced" over a dead socket is the
  // exact shape of lie this module exists to stop.
  //
  // Count first, name second: `project` is hub-supplied, and a leading name is
  // a name that gets to set the tone of our own sentence.
  if (unreachable) {
    return {
      phase: 'offline',
      online: false,
      label: queued > 0 ? `offline · ${queued} ↑` : 'offline',
      title: `Not reachable: ${project}. Your edits are safe on this machine and queued.${queueNote}`,
      next: 'Nothing to do — syncing resumes by itself when the hub is back.',
      names: [],
    };
  }

  if (unreadable) {
    // A payload we cannot read is not a payload that says everything is fine.
    return {
      phase: 'connecting',
      online: false,
      label: 'status unreadable',
      title: `Cannot read the sync status for ${project} — the counts on disk are malformed.`,
      next: 'Reconnect the workspace; if it persists, restart Maude.',
      names: [],
    };
  }

  if (!docs) {
    // Pre-DDR-102 payload: `state` is all there is. Report it as the weaker
    // evidence it is, rather than promoting it to a document-level claim.
    const online = status.state === 'online' || status.flash === 'synced';
    return {
      phase: online ? 'synced' : 'connecting',
      online,
      label: online ? (queued > 0 ? `${queued} ↑` : 'synced') : 'connecting…',
      title: online ? `Syncing with ${project}.${queueNote}` : `Connecting to ${project}…`,
      next: online ? null : 'Nothing to do — this usually takes a moment.',
      names: [],
    };
  }

  // Refusals were already handled above — they outrank an unreachable hub, so
  // that branch has to come first. Everything from here on has `rejected === 0`.
  const total = docs.synced + docs.pending + docs.rejected;

  if (total === 0) {
    return {
      phase: 'connecting',
      online: false,
      label: 'connecting…',
      title: `Connecting to ${project}…`,
      next: 'Nothing to do — this usually takes a moment.',
      names: [],
    };
  }

  if (docs.pending > 0) {
    // Zero settled yet is a different fact from some settled: one is a
    // handshake in flight, the other is visible progress.
    const started = docs.synced > 0;
    return {
      phase: started ? 'syncing' : 'connecting',
      online: false,
      label: started ? `${docs.synced}/${total}` : 'connecting…',
      title: started
        ? `Syncing with ${project} — ${docs.synced} of ${total} canvas${total === 1 ? '' : 'es'} so far.`
        : `Connecting to ${project}…`,
      next: 'Nothing to do — this usually takes a moment.',
      names: [],
    };
  }

  // Clamped and validated for the same reason as the doc counts: `count` is
  // read off disk, and "1000000000 came down from the project" is not a
  // sentence this module should be capable of producing. The ceiling is `total`
  // — a pulled document becomes one of the canvases being counted, so more
  // pulled than exist is not a big number, it is a broken payload.
  const rawPulled = status.pulled?.count;
  const pulledCount =
    typeof rawPulled === 'number' && Number.isInteger(rawPulled) && rawPulled >= 0
      ? Math.min(rawPulled, total)
      : 0;
  return {
    phase: 'synced',
    online: true,
    label: queued > 0 ? `${queued} ↑` : 'synced',
    title:
      `Synced with ${project} — all ${total} canvas${total === 1 ? '' : 'es'}.` +
      (pulledCount > 0 ? ` ${pulledCount} came down from the project on this connect.` : '') +
      queueNote,
    // Deliberately NOT "open one of the canvases that just arrived". A pulled
    // canvas is hub-authored TSX (DDR-054, and the DDR-079 residual it carries),
    // and an imperative in our own green success sentence is the strongest
    // possible endorsement of content we do not vouch for. State the fact; the
    // decision to open stays the person's.
    next: pulledCount > 0 ? 'They are new to this machine — look them over before editing.' : null,
    names: pulledCount > 0 ? shownNames(status.pulled?.names) : [],
  };
}
