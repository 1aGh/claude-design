// Publishing a shared view — the DECISION half. Cloud Phase 18 Task 1.
//
// WHO RENDERS. Snapshots are produced on a MEMBER's own machine and uploaded
// as finished pictures. The vendor never renders a canvas — that is the whole
// containment claim (DDR-193 §2 / DDR-197), and it is why publishing is a
// local command rather than a server feature. A "publish" button that made the
// server render would quietly delete the invariant.
//
// Pure: no filesystem, no network, no clock. What gets uploaded and under
// which key is the part that can leak one project's work into another's view,
// and that must be reviewable without credentials.

/** Formats the share view will serve. Must match apps/cells/share.mjs. */
const SHAREABLE = /\.(png|jpe?g|webp|avif)$/i;

/**
 * SVG is excluded here for the same reason it is excluded there: an SVG is a
 * document that can carry script, and the share origin must never serve one.
 * Two lists that could disagree would be a hole, so this test names the reason
 * rather than just the extensions.
 */
export function isShareable(name) {
  return SHAREABLE.test(String(name ?? ''));
}

/** Same charset the cell entrypoint enforces — the id becomes a storage prefix. */
export function validProjectId(raw) {
  const id = String(raw ?? '').trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 63 ? id : null;
}

/**
 * What to upload, and where.
 *
 * @param {string[]} files  paths relative to the source directory
 * @param {string} project
 * @returns {{ uploads: {from: string, key: string}[], skipped: string[] }}
 */
export function publishPlan(files, project) {
  const id = validProjectId(project);
  if (!id) throw new Error(`invalid project id: ${project}`);
  const uploads = [];
  const skipped = [];
  for (const raw of files) {
    const rel = String(raw).replace(/\\/g, '/').replace(/^\.\//, '');
    // A path that could climb out of the source directory would upload
    // something nobody chose to share.
    if (rel.startsWith('/') || rel.split('/').includes('..')) {
      skipped.push(rel);
      continue;
    }
    if (!isShareable(rel)) {
      skipped.push(rel);
      continue;
    }
    uploads.push({ from: rel, key: `tenants/${id}/snapshots/${rel}` });
  }
  uploads.sort((a, b) => a.key.localeCompare(b.key));
  return { uploads, skipped };
}

/** The marker whose ABSENCE means "not shared". Default-closed by construction. */
export function shareMarker(project, { enabled, name }) {
  const id = validProjectId(project);
  if (!id) throw new Error(`invalid project id: ${project}`);
  return {
    key: `tenants/${id}/share.json`,
    body: JSON.stringify({ enabled: Boolean(enabled), name: String(name ?? id).slice(0, 80) }, null, 2),
  };
}

/**
 * What the operator is told after a publish.
 *
 * Says the URL and says what it is NOT, because the single most likely
 * misunderstanding is that a shared view is live.
 */
export function publishSummary({ project, uploaded, skipped, zone = 'cloud.maude.sh' }) {
  const lines = [
    `Published ${uploaded} view${uploaded === 1 ? '' : 's'} of ${project}.`,
    ``,
    `  https://view-${project}.${zone}`,
    ``,
    `These are pictures taken on this machine just now. They do not update`,
    `themselves — publish again after the design changes.`,
  ];
  if (skipped > 0) {
    lines.push(
      ``,
      `${skipped} file${skipped === 1 ? ' was' : 's were'} not published: the shared view`,
      `serves only PNG, JPEG, WebP and AVIF. SVG is excluded on purpose — it can`,
      `carry script, and nothing the view serves is ever allowed to execute.`
    );
  }
  return lines.join('\n');
}
