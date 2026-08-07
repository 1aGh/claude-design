// A one-line registry so the HTTP layer can ask "is a chat mid-turn right now?"
// without `createHttp` growing an `Acp` parameter (feature-acp-write-path-scope
// Addendum, Task 9).
//
// WHY A REGISTRY AND NOT A PARAMETER: `createHttp` is called with six
// collaborators already and is constructed in `server.ts` alongside — not
// after — the ACP manager. Threading the manager in would churn the signature
// and every test that builds an Http, to expose ONE boolean-ish query. The
// alternative that was rejected outright is asking the CLIENT (ChatPanel
// already tracks per-chat busy state): a bridge can now be running DETACHED,
// with no socket and therefore no client that knows about it — which is
// precisely the case the branch-switch warning exists for. Client state would
// answer "no chat is running" at the exact moment the answer matters most.
//
// One dev-server process serves one project and calls `createAcp` once, so the
// single-slot shape is correct here rather than merely convenient. It is
// deliberately a PULL (a getter the manager registers), not a pushed snapshot:
// a snapshot would be stale by the time anyone read it, and "was a turn running
// a moment ago" is the wrong question to gate a `git checkout` on.

type RunningChatsProbe = () => string[];

let probe: RunningChatsProbe | null = null;

/** Registered once by `createAcp`. A later call replaces the earlier one — the
 *  last manager constructed is the live one. */
export function registerRunningChatsProbe(fn: RunningChatsProbe): void {
  probe = fn;
}

/** Chat ids with a turn in flight. Empty when no ACP manager exists at all
 *  (web serve without the panel, tests) — never throws, because a failure to
 *  answer must not block a branch switch. */
export function runningChats(): string[] {
  try {
    return probe?.() ?? [];
  } catch {
    return [];
  }
}
