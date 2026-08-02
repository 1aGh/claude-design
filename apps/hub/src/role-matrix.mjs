// The role matrix — Cloud Phase 25 C4.
//
// ONE TABLE, ONE AUTHORITY. What a role means is stated here, at the CELL,
// and both surfaces are clients of it: the desktop asks the cell (and mirrors
// the answer in its UI), the browser asks the cell (and mirrors the answer in
// its page). Two enforcement points would drift, and the weaker one would
// become the way in — which is the whole reason Track C exists.
//
// The one that catches people out is COMMENT. "Look, comment and download" is
// what viewer means, so comment is the single write a viewer holds — and it is
// therefore exactly where a scope bug turns "may leave a note" into "may edit
// the project". It gets its own row, its own test, and its own narrow path
// through the read-only gate.

/** Every role the control plane can vouch for. */
export const ROLES = Object.freeze(['owner', 'member', 'viewer']);

/** Every capability the product actually distinguishes. */
export const CAPABILITIES = Object.freeze([
  'read',
  'edit',
  'comment',
  'annotate',
  'export',
  'invite',
  'delete',
  'mirror',
]);

/**
 * THE MATRIX.
 *
 * `annotate` sits with `edit`, not with `comment`, and that is a decision
 * rather than an oversight: an annotation is drawn ON the design and is
 * versioned with it (`*.annotations.svg` is a committed file, DDR-115), while
 * a comment is a note ABOUT it in a separate store. A viewer who could
 * annotate would be committing to the project's history.
 *
 * `invite`, `delete` and `mirror` are OWNER-only on the cell. In platform mode
 * the dashboard owns invites anyway (`POST /invites` 409s under strict
 * identity) — this table says what the CELL would allow, so the two cannot
 * quietly disagree.
 */
const MATRIX = Object.freeze({
  owner: Object.freeze({
    read: true,
    edit: true,
    comment: true,
    annotate: true,
    export: true,
    invite: true,
    delete: true,
    mirror: true,
  }),
  member: Object.freeze({
    read: true,
    edit: true,
    comment: true,
    annotate: true,
    export: true,
    invite: false,
    delete: false,
    mirror: false,
  }),
  viewer: Object.freeze({
    read: true,
    edit: false,
    comment: true,
    annotate: false,
    export: true,
    invite: false,
    delete: false,
    mirror: false,
  }),
});

/** Unknown roles get NOTHING. A typo must not be an escalation. */
const NONE = Object.freeze(Object.fromEntries(CAPABILITIES.map((c) => [c, false])));

export function capabilitiesFor(role) {
  return MATRIX[role] ?? NONE;
}

export function can(role, capability) {
  return capabilitiesFor(role)[capability] === true;
}

/**
 * The read-only capability, derived from the role in ONE place.
 *
 * Every session-minting path (the desktop's `/auth/login`, the browser door's
 * cookie, a self-hosted sign-in) calls this rather than testing
 * `role === 'viewer'` itself — because the day a fourth role appears, the
 * places that tested for the string are the places that get it wrong.
 */
export function isReadOnlyRole(role) {
  return !can(role, 'edit');
}

/** The matrix as rows, for a docs table or an operator surface. */
export function matrixRows() {
  return ROLES.map((role) => ({ role, ...capabilitiesFor(role) }));
}
