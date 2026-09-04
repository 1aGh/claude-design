// What a THROWN fetch error means, in words a person can act on.
//
// THE BUG THIS EXISTS TO FIX. Every `catch` in `file-plane.ts` stored
// `(err as Error).message` directly into the per-path delivery reason a person
// reads in the Sync panel. Those messages come from Bun's runtime, not from us:
//
//     $ bun -e "try{await fetch('http://127.0.0.1:1/x')}catch(e){console.log(e.message)}"
//     Unable to connect. Is the computer able to access the url?
//
// On 2026-09-03, 484 of 803 undelivered files in an 8.8 GB project carried
// exactly those two Bun strings — because the cell they were being pushed to
// was restarting in a loop. So a person looking for "why is my project not
// syncing" was told, 135 times, to check their URL for a typo. It also cost a
// debugging session: the strings appear nowhere in this repo, so grepping for
// them found nothing and the reason class looked like a mystery.
//
// `failureReason()` in `retry-after.ts` is the sibling for RESPONSE refusals —
// a request that arrived and was declined. This module is for the requests that
// never arrived at all.

/** What kind of transport failure this was. */
export type TransportErrorClass = 'unreachable' | 'timeout' | 'aborted' | 'other';

export interface ClassifiedTransportError {
  class: TransportErrorClass;
  /** What a person reads. Ours, never the runtime's. */
  text: string;
  /** The runtime's own words — for the console and `detail` fields ONLY. */
  raw: string;
}

/** How much of a raw message we keep. Bounded: it reaches logs, and a hostile
 *  peer can influence some of what a fetch throws. */
const MAX_RAW_CHARS = 200;

/**
 * Bun's connect-failure wording, as of Bun 1.x.
 *
 * MATCHED AS A FALLBACK, NOT AS THE PRIMARY SIGNAL. Error *names* are stable
 * API; these sentences are not, and a Bun upgrade that rewords them must
 * degrade this to `other` with a neutral sentence rather than start leaking the
 * new wording. That is why `other` has a real message of its own instead of
 * falling through to `raw`.
 */
const BUN_CONNECT_HINTS = [
  'unable to connect',
  'was there a typo in the url or port',
  'connectionrefused',
  'connection refused',
  'failed to connect',
  'econnrefused',
  'enotfound',
  'eai_again',
  'dns',
  'socket connection was closed unexpectedly',
];

const BUN_TIMEOUT_HINTS = ['timeout', 'timed out', 'etimedout'];

/**
 * Classify a caught `fetch` rejection.
 *
 * Total: every input produces a class and a sentence, including a non-Error
 * throw. A classifier that can return "nothing" would just reintroduce the
 * `err.message` fall-through it replaces.
 */
export function classifyTransportError(err: unknown): ClassifiedTransportError {
  const raw = rawTextOf(err).slice(0, MAX_RAW_CHARS);
  const name = typeof (err as { name?: unknown })?.name === 'string' ? (err as Error).name : '';
  const haystack = `${name} ${raw}`.toLowerCase();

  // Names first — they are the stable half of the contract.
  if (name === 'TimeoutError' || (name === 'AbortError' && haystack.includes('timeout'))) {
    return {
      class: 'timeout',
      text: 'The workspace took too long to answer',
      raw,
    };
  }
  if (name === 'AbortError') {
    return { class: 'aborted', text: 'Stopped before it finished', raw };
  }
  if (BUN_TIMEOUT_HINTS.some((h) => haystack.includes(h))) {
    return { class: 'timeout', text: 'The workspace took too long to answer', raw };
  }
  if (BUN_CONNECT_HINTS.some((h) => haystack.includes(h))) {
    return { class: 'unreachable', text: 'Could not reach the workspace', raw };
  }
  // NEUTRAL, never the raw string. An unrecognised failure is still a failure
  // we own the wording of.
  return { class: 'other', text: 'The transfer did not complete', raw };
}

/**
 * The user-facing sentence alone — the common call site, since almost every
 * `catch` wants exactly this and nothing else.
 */
export function transportErrorText(err: unknown): string {
  return classifyTransportError(err).text;
}

function rawTextOf(err: unknown): string {
  if (typeof err === 'string') return err;
  const message = (err as { message?: unknown })?.message;
  if (typeof message === 'string') return message;
  try {
    return String(err);
  } catch {
    return 'unknown error';
  }
}
