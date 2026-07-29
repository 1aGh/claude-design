// Who may open which project — Cloud Phase 22 Task 2 (DDR-204).
//
// The control plane is the identity provider, so this is where "may this
// person open this project" is answered. A cell never decides it; a cell
// verifies a token that says the question was already answered here.
//
// PURE, and that is load-bearing rather than tidy. This is the check that
// separates one customer's work from another's, and it has to be reviewable
// over every combination without a database, a session, or a running cell
// (DDR-196 §1).
//
// The token shape is IMPORTED from the hub side rather than re-declared, so
// the two ends agree by construction. Two carefully-written copies of a claim
// format is how a signature check starts passing on the wrong thing.

/** Roles, weakest first. A role's powers are a superset of the ones before it. */
export const ROLES = ['viewer', 'member', 'owner'];

/**
 * Decide access from facts, not from a query.
 *
 * @param {object} args
 * @param {string|null} args.accountId       who is asking (null = signed out)
 * @param {object|null} args.project         the project row, or null if absent
 * @param {{account_id: string, role: string}[]} [args.members]
 * @returns {{ok: true, role: string} | {ok: false, reason: string}}
 */
export function decideAccess({ accountId, project, members = [] }) {
  // Identical answer for "no such project" and "not yours". Distinguishing
  // them turns this into an oracle for which project ids exist, and project
  // ids are guessable — they are named after the work.
  if (!accountId) return { ok: false, reason: 'not-signed-in' };
  if (!project) return { ok: false, reason: 'no-access' };

  // A purged project is gone. Saying "no access" would suggest asking someone
  // for access, which is the one thing that cannot help.
  if (project.state === 'purged') return { ok: false, reason: 'purged' };

  if (project.account_id === accountId) return { ok: true, role: 'owner' };

  const member = members.find((m) => m.account_id === accountId);
  if (!member) return { ok: false, reason: 'no-access' };
  if (!ROLES.includes(member.role)) return { ok: false, reason: 'no-access' };

  // A suspended project is readable by its owner (who has to be able to
  // export and pay) but not by everyone else — a lapsed subscription should
  // not quietly keep a whole team working.
  if (project.state === 'suspended') return { ok: false, reason: 'suspended' };

  return { ok: true, role: member.role };
}

/** What the person is told. One sentence, and never our vocabulary. */
export const ACCESS_MESSAGES = {
  'not-signed-in': 'Sign in to open this project.',
  'no-access': 'This project is not available to your account.',
  purged: 'This project was deleted. If you exported it, that copy is still yours.',
  suspended: 'This project is paused. Its owner can restart it from the dashboard.',
};

/**
 * Whether a role may do a thing.
 *
 * A table rather than scattered `role === 'owner'` checks: the interesting
 * question is "what can a viewer NOT do", and that is only answerable at a
 * glance if the answers are in one place.
 */
export const CAPABILITIES = {
  view: ['viewer', 'member', 'owner'],
  edit: ['member', 'owner'],
  comment: ['viewer', 'member', 'owner'],
  invite: ['owner'],
  billing: ['owner'],
  mirror: ['owner'],
  share: ['owner'],
  delete: ['owner'],
};

export function can(role, capability) {
  return (CAPABILITIES[capability] ?? []).includes(role);
}
