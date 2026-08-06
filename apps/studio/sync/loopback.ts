// The loopback host set — a leaf module for the same reason `limits.ts` is
// one: this predicate used to be re-typed in three places (`checkUrlScheme`
// and `isLoopbackHubUrl` in `sync/index.ts`, plus `cell-pairing.ts`'s own
// copy), and `cell-pairing.ts` even said out loud that "three places asking
// is this loopback and disagreeing is how a guard becomes decorative"
// without fixing it. Depends on nothing, so it belongs where nothing has to
// depend back — importable from both `index.ts` and `cell-pairing.ts` with
// neither reaching into the other.
//
// NOT shared with `apps/hub/src/studio-child.mjs`'s own copy of this exact
// set — that one is a different app (Node, not Bun; its own package), and the
// duplication there is the deliberate kind: the studio refuses a non-loopback
// URL on the receiving end, the hub refuses to emit one, and the point of
// having two independent checks is that editing one without the other still
// leaves the other standing (see that file's own comment).

/** True when `host` (already lower-cased or not) is a loopback address. */
export function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}
