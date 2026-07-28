// GitHub mirror — Cloud Phase 10.
//
// An optional, customer-toggled one-way copy of a workspace's history into a
// repository they own. It exists so "we host it" never means "we hold it
// hostage": the export bundle proves the data is portable, and the mirror
// proves it continuously, in a place the customer already trusts.
//
// THREE RULES, all of them about not damaging something we do not own:
//
//   1. ONE WAY. We push; we never pull, never merge, never resolve. The
//      workspace is the source of truth; the mirror is a copy. A two-way
//      mirror is a sync product, and a sync product that nobody asked for is
//      how you overwrite a customer's own commits.
//   2. NEVER FORCE. Not `--force`, not `--force-with-lease`, not a `+refspec`.
//      A rejected push means something exists on the remote that we did not
//      put there, and the only correct response is to stop and say so.
//   3. A DEDICATED BRANCH BY DEFAULT. Mirroring onto `main` of a repo that has
//      other content is the single easiest way to make this destructive. The
//      default target is a branch that exists for us.
//
// Failure is REPORTED, never retried into a corner: a mirror that is behind is
// a warning on a settings page, not an incident. The workspace has the data.

/** The branch a mirror writes to unless the customer names another. */
export const DEFAULT_MIRROR_BRANCH = 'maude-workspace';

/**
 * Validate a mirror target before anything is pushed.
 *
 * `owner/repo` only — a full URL would let a misconfiguration point at
 * someone else's host entirely, and the installation token we hold is
 * GitHub-scoped.
 */
export function validateTarget(raw) {
  const errors = [];
  const target = String(raw?.repo ?? '').trim();
  const m = target.match(/^([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})$/);
  if (!m) {
    errors.push('repository must be "owner/name" (not a URL)');
  } else if (m[2] === '.' || m[2] === '..') {
    errors.push('repository name is not valid');
  }

  const branch = String(raw?.branch ?? DEFAULT_MIRROR_BRANCH).trim();
  // Refuse anything git would interpret, and anything that could be read as a
  // flag by a command that takes refspecs.
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(branch) || branch.includes('..')) {
    errors.push('branch name is not valid');
  }
  if (branch.startsWith('-')) errors.push('branch name may not start with "-"');

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, target: { owner: m[1], repo: m[2], branch, full: `${m[1]}/${m[2]}` } };
}

/**
 * The git arguments for one mirror push.
 *
 * Returned as argv (never a shell string) and asserted by a test for the
 * ABSENCE of any force flag — absence is exactly what a later edit could add
 * with nothing noticing.
 */
export function mirrorPushArgs({ branch, remote = 'mirror', localRef = 'HEAD' }) {
  return ['push', remote, `${localRef}:refs/heads/${branch}`];
}

/**
 * Classify the outcome of a push so the UI can say something true.
 *
 * The distinctions matter because they need different sentences: a rejection is
 * "someone else wrote there", auth is "reconnect", and not-found is "the repo
 * is gone or the app was uninstalled" — and only the last two are the
 * customer's to fix by reconnecting.
 */
export function classifyPushResult({ code, stderr = '', stdout = '' }) {
  if (code === 0) {
    const upToDate = /Everything up-to-date/i.test(stderr + stdout);
    return { ok: true, state: upToDate ? 'up-to-date' : 'pushed' };
  }
  const text = `${stderr}\n${stdout}`;
  if (/\brejected\b|non-fast-forward|fetch first/i.test(text)) {
    return {
      ok: false,
      state: 'diverged',
      // We do NOT offer to force. Something exists there that we did not put
      // there, and destroying it is not ours to decide.
      message:
        'The mirror has commits Maude did not create, so it was not updated. ' +
        'Nothing was overwritten. Point the mirror at an empty branch, or clear that branch yourself.',
    };
  }
  if (/Authentication failed|could not read Username|Permission denied|403/i.test(text)) {
    return {
      ok: false,
      state: 'unauthorized',
      message: 'Maude no longer has access to that repository. Reconnect it in settings.',
    };
  }
  if (/not found|does not appear to be a git repository|404/i.test(text)) {
    return {
      ok: false,
      state: 'missing',
      message: 'That repository no longer exists, or Maude was removed from it.',
    };
  }
  return {
    ok: false,
    state: 'failed',
    message: 'The mirror could not be updated. The workspace itself is unaffected.',
  };
}

/**
 * Whether a mirror is due, and whether its last failure should be surfaced.
 *
 * A mirror that is behind is a WARNING, not an incident — the workspace has the
 * data. Escalating a copy's staleness to an error trains people to ignore
 * errors.
 */
export function mirrorStatus(mirror, { now = Date.now(), staleAfterMinutes = 60 } = {}) {
  if (!mirror?.enabled) return { state: 'off', due: false, severity: 'none' };
  const ageMinutes =
    mirror.lastSuccessAt === null || mirror.lastSuccessAt === undefined
      ? null
      : (now - mirror.lastSuccessAt) / 60_000;

  if (mirror.lastState === 'diverged') {
    // Needs a human decision, so it must not be retried silently forever.
    return {
      state: 'diverged',
      due: false,
      severity: 'warning',
      message: classifyPushResult({ code: 1, stderr: 'rejected non-fast-forward' }).message,
    };
  }
  if (mirror.lastState === 'unauthorized' || mirror.lastState === 'missing') {
    return { state: mirror.lastState, due: false, severity: 'warning' };
  }
  if (ageMinutes === null) return { state: 'never-run', due: true, severity: 'info' };
  if (ageMinutes > staleAfterMinutes) {
    return {
      state: 'behind',
      due: true,
      severity: 'warning',
      behindMinutes: Math.floor(ageMinutes),
    };
  }
  return { state: 'current', due: false, severity: 'none' };
}
