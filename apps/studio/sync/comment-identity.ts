// Comment identity — the one definition of "these two entries are the same
// comment", shared by every layer that touches the comments lane (issue #112).
//
// A LEAF module, exactly like `limits.ts`: it imports NOTHING. That is
// load-bearing, not tidiness. `collab/persistence.ts` owns `Y_TYPES` and
// `sync/codec.ts` imports it from there, so persistence can never import the
// codec back (its own comment says so) — yet the room seed needs the same
// identity rule the codec's diff uses. A dependency-free leaf is the only
// place both sides can reach.
//
// WHY IDENTITY IS A SHARED CONCERN. Comments travel over the hub as a Y.Array,
// and the lane's whole failure mode is the same logical comment appearing as
// several distinct CRDT items (issue #112: 1 → 2 → 4 → 8). Every layer that
// writes the lane has to agree on which entries are "the same one", or one
// layer's repair is another layer's duplicate.

/**
 * Stable identity for one comment entry.
 *
 * `id` is the real key — it is minted once by `commentsAdd` and survives every
 * round-trip through disk, the Y.Array and the hub. Entries WITHOUT a string
 * `id` (hand-edited files, pre-Phase-6 rows, junk pushed by an untrusted peer)
 * fall back to JSON identity, which is deliberately conservative: it dedupes
 * only byte-identical entries and never merges two rows that might differ.
 *
 * The `id:` / `json:` prefixes keep the two spaces from colliding — a comment
 * whose id is literally the JSON of another entry can't shadow it.
 */
export function commentKey(c: unknown): string {
  if (c && typeof c === 'object' && typeof (c as { id?: unknown }).id === 'string') {
    return `id:${(c as { id: string }).id}`;
  }
  return `json:${JSON.stringify(c)}`;
}

/**
 * Collapse a comment list to one entry per identity, keeping the FIRST
 * occurrence.
 *
 * First-wins is the same rule `unionCommentsById` uses ("doc order first"), and
 * the two must agree: `commentsAddReply` mutates the first match, so the copy
 * the dedupe keeps has to be the copy the mutations edit.
 *
 * Returns the input array itself when there is nothing to drop, so callers can
 * cheaply test `deduped !== list` to know whether a write is worth making.
 */
export function dedupeCommentsById<T>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const c of list) {
    const k = commentKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** True when `list` carries the same comment identity more than once. */
export function hasDuplicateComments(list: readonly unknown[]): boolean {
  const seen = new Set<string>();
  for (const c of list) {
    const k = commentKey(c);
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}
