// What the hub says it holds — indexed the way the rest of the runtime asks.
//
// THE BUG THIS MODULE EXISTS TO PREVENT. The listing was indexed by
// `slugFromDocName`, which strips the `ws/<workspace>/<branch>/` namespace by
// design, while the very next consumer of the same listing (`diffRemoteDocs`)
// compares full document names. One input, two key spaces — so a `hero` on
// `main` answered for a DIFFERENT peer's `hero` on `feat/x`, and that peer's
// cold-start seed deferred forever while logging that the hub's state was on its
// way. Nothing was coming, and the canvas simply never synced. A peer token is
// commonly `scope: '*'`, so one listing spans every namespace on the hub: no
// hostile hub is needed, one teammate naming a canvas the same thing on another
// branch is enough.
//
// Keeping the index and its question in one place, with one key space, is the
// whole point of the module.

/** One row of `GET /api/documents` — names and byte counts, never content. */
export interface HubDocRow {
  name: string;
  bytes?: number;
}

/**
 * Index one listing by FULL document name.
 *
 * Rows without a usable name are dropped rather than coerced: this map answers
 * a question about identity, and a blank key would answer it for everyone.
 */
export function indexHubDocs(docs: readonly HubDocRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of docs) {
    if (typeof d?.name === 'string' && d.name) out.set(d.name, Number(d.bytes ?? 0));
  }
  return out;
}

/**
 * Does the hub hold STATE for this exact document?
 *
 * A row with zero bytes is a document that exists but carries nothing — not
 * state, and deferring to it would leave a canvas that never syncs in either
 * direction. An absent row is the same answer as a listing we never got.
 */
export function hubHolds(index: ReadonlyMap<string, number>, docName: string): boolean {
  return (index.get(docName) ?? 0) > 0;
}
