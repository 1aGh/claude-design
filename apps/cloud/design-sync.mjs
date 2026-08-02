// Design-sync — Cloud Phase 25 D1/D2/D3.
//
// THE MODE PEOPLE EXPECTED. Today's mirror pushes the CELL'S OWN REPOSITORY —
// whole history, onto a disjoint branch of a repo the customer owns. That is a
// BACKUP: it works, it is what makes "you can leave" true, and it stays. But
// it is not what a developer means when they say "sync my designs into my
// repo". They mean: the `.design` tree, in a folder of THEIR working repo, on
// top of THEIR history, as a normal diff they can review.
//
// So the mirror grows a second mode, and the difference is not a flag on a
// push — the two modes have different SHAPES:
//
//   backup       git push mirror HEAD:refs/heads/<branch>
//                a disjoint branch; their history is untouched because it is
//                never involved.
//   design-sync  clone their branch, write the design tree into <folder>,
//                commit on top, push a WORK BRANCH, open a pull request.
//                Their history IS involved, so nothing lands without review.
//
// WHY A PULL REQUEST AND NOT A DIRECT PUSH (D1's write contract). A design
// tree committed straight onto `main` of the repo a customer's website builds
// from is a deploy they did not ask for. A PR is the one shape where "we wrote
// into your repo" and "you decided what happens next" are both true. It also
// gives the conflict answer for free: if they edited the same paths, the PR
// shows it and git refuses nothing.
//
// Pure decision module (DDR-196 §1): argv and shapes in, data out. The cell
// performs it (`apps/hub/src/design-sync.mjs`).

/** The folder a design-sync writes into unless the customer names another. */
export const DEFAULT_DESIGN_FOLDER = 'design';
/** The branch the PR comes FROM. Stable, so repeated syncs update one PR. */
export const DEFAULT_WORK_BRANCH = 'maude/design-sync';

export const MIRROR_MODES = Object.freeze(['backup', 'design-sync']);

/**
 * Validate a design-sync target.
 *
 * The folder is where this is most dangerous: a customer pointing this at the
 * repo their website lives in must not be able to (accidentally) name `.` or
 * `../..` and have us commit over their source. A single, plain, relative
 * folder — nothing else.
 */
export function validateDesignSync(raw) {
  const errors = [];
  const folder = String(raw?.folder ?? DEFAULT_DESIGN_FOLDER)
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!folder) {
    errors.push('folder is required');
  } else if (folder === '.' || folder === '..') {
    errors.push('folder must be a folder inside the repository, not its root');
  } else if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(folder)) {
    errors.push('folder may contain letters, numbers, dots, dashes and slashes');
  } else if (folder.split('/').some((seg) => seg === '..' || seg === '.git')) {
    errors.push('folder may not climb out of the repository or touch .git');
  }

  const base = String(raw?.baseBranch ?? 'main').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(base) || base.includes('..')) {
    errors.push('base branch name is not valid');
  }

  const work = String(raw?.workBranch ?? DEFAULT_WORK_BRANCH).trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(work) || work.includes('..')) {
    errors.push('work branch name is not valid');
  }
  if (work === base) errors.push('the work branch must differ from the base branch');

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, target: { folder, baseBranch: base, workBranch: work } };
}

/**
 * The git argv for each step of a design-sync, in order.
 *
 * Returned as data so the sequence is reviewable and testable without a repo —
 * and so the ABSENCE of a force flag is assertable here, the same discipline
 * `mirrorPushArgs` established. The work branch is force-updatable in ONE
 * sense only: we reset it to the base each run (`checkout -B`), which rewrites
 * OUR branch and never theirs.
 */
export function designSyncSteps({ folder, baseBranch, workBranch, message }) {
  return [
    { name: 'fetch', args: ['fetch', '--depth', '1', 'origin', baseBranch] },
    { name: 'checkout-base', args: ['checkout', '-B', workBranch, `origin/${baseBranch}`] },
    // The design tree is REPLACED wholesale: a rename or a deletion in the
    // design must show up as one in the diff, and a merge-by-copy would leave
    // deleted canvases behind forever.
    { name: 'stage', args: ['add', '--all', '--', folder] },
    { name: 'commit', args: ['commit', '--no-verify', '-m', message] },
    // Pushing OUR work branch. Their base branch is never a push target.
    {
      name: 'push',
      args: ['push', 'origin', `${workBranch}:refs/heads/${workBranch}`, '--force-with-lease'],
    },
  ];
}

/**
 * The commit message. Says what changed and where it came from, because it
 * lands in someone else's history and will be read by someone who was not
 * there.
 */
export function designSyncMessage({ projectName, canvases, when = new Date() }) {
  const stamp = when.toISOString().slice(0, 10);
  return (
    `design: sync ${projectName} (${canvases} canvas${canvases === 1 ? '' : 'es'})\n\n` +
    `Synced from Maude on ${stamp}. This folder is written by Maude's\n` +
    `design-sync; edit the design in Maude and the next sync updates the PR.`
  );
}

/** The pull request's title + body. */
export function designSyncPullRequest({ projectName, folder, canvases }) {
  return {
    title: `Design update — ${projectName}`,
    body:
      `Maude synced the design workspace for **${projectName}** into \`${folder}/\`.\n\n` +
      `- ${canvases} canvas${canvases === 1 ? '' : 'es'}\n` +
      `- The whole folder is replaced each sync, so deletions and renames show up as ` +
      `deletions and renames.\n` +
      `- Nothing outside \`${folder}/\` is touched.\n\n` +
      `Merge it, close it, or keep it open — Maude updates this same pull request ` +
      `on the next sync either way.`,
  };
}

/**
 * What the CUSTOMER is told each mode does, before they press Save (D2).
 *
 * Two sentences each: what lands, and what it touches. A person pointing this
 * at the repository their website deploys from has to be able to predict the
 * consequence, and "mirror" alone does not tell them.
 */
export function modeConsequence(
  mode,
  { repo = 'your repository', folder = DEFAULT_DESIGN_FOLDER } = {}
) {
  if (mode === 'design-sync') {
    return {
      label: 'Sync designs into a folder',
      what: `Maude opens a pull request on ${repo} that puts your design workspace in ${folder}/.`,
      touches:
        'It only ever writes inside that folder, on its own branch, and nothing merges until you merge it.',
    };
  }
  return {
    label: 'Back up the whole workspace',
    what: `Maude pushes this workspace's full history to a separate branch of ${repo}.`,
    touches:
      'It never touches your own branches, and it is what makes leaving Maude a copy rather than an export.',
  };
}

/**
 * What the BACKUP mode actually contains (D3).
 *
 * The honest answer depends on how the project started, and saying "everything"
 * for a wizard-created project would be a promise the bytes do not keep.
 */
export function backupContents({ seededFrom }) {
  return seededFrom
    ? {
        summary: `Everything in ${seededFrom}, plus the design workspace and its history.`,
        detail:
          'This project started from that repository, so the backup carries whatever it contained ' +
          'alongside the designs made since.',
      }
    : {
        summary: 'The design workspace and its full history.',
        detail:
          'This project was created in Maude rather than seeded from a repository, so there is no ' +
          'application code in it to back up — the designs and every version of them are the whole thing.',
      };
}
