// Doc → files: the DECISION half of the server-side workspace agent.
// Cloud Phase 16 Task 1. Pure — no fs, no git, no network, no clock.
//
// The split is DDR-196 §1, and here it earns itself twice over:
//
//   1. "which bytes belong in which file" is the part that can silently
//      corrupt a tenant's work, and it is exactly the part that is cheap to
//      test exhaustively when nothing around it touches a disk;
//   2. the effects half (workspace-agent.mjs) then has almost no branches
//      left, so reviewing it for "does this ever overwrite something it
//      shouldn't" is a short read rather than a careful one.
//
// WHAT IS AND IS NOT WRITTEN. Only DDR-115 VERSIONED paths:
//
//     <designRoot>/<name>.tsx              the canvas body
//     <designRoot>/<name>.meta.json        shared meta, local keys preserved
//     <designRoot>/<name>.css              the sibling stylesheet, when present
//     <designRoot>/<name>.annotations.svg  the draw layer
//
// Comments are deliberately absent. They live in `_comments/`, which is
// runtime state and gitignored — writing them here would put a per-machine
// artifact into a tenant's permanent history.

import { mergeSharedMetaIntoLocal } from './meta-merge.mjs';

/**
 * Y.Doc shared-type names. Mirrors `Y_SYNC_TYPES` / `Y_TYPES` in
 * apps/studio/sync/codec.ts + apps/studio/collab/persistence.ts.
 *
 * Duplicated rather than imported because this module must load under the
 * hub's plain-Node runtime with no studio source tree present. The drift that
 * duplication invites is closed by a test that fails the moment the studio's
 * constants and these disagree — see test/workspace-files.test.mjs.
 */
export const DOC_TYPES = {
  html: 'html',
  css: 'css',
  meta: 'meta',
  annotations: 'annotations',
};

/** Extension of a canvas body. `.tsx` since Phase 3.6 made it the only format. */
const BODY_EXT = '.tsx';

/**
 * Slug for a canvas path, relative to the design root.
 *
 * Mirrors `slugFor()` in apps/studio/sync/index.ts and `api.fileSlug()`. The
 * transform is LOSSY on purpose (`ui/Foo.tsx` and `ui-foo.tsx` collapse to the
 * same slug) — it predates this module and the doc namespace is built from it,
 * so reproducing it exactly is the requirement, not improving it.
 */
export function canvasSlug(relPath) {
  return String(relPath)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

/**
 * Build slug → body-path index from the paths already in the checkout.
 *
 * THIS IS WHY THE CELL KEEPS A CHECKOUT. A document name carries only the
 * lossy slug, so the doc alone cannot say whether `ui-foo` belongs at
 * `ui/Foo.tsx` or `ui-foo.tsx`. The working tree is the authority on that, and
 * consulting it is what stops the agent from silently relocating a tenant's
 * file to a flattened path on the first server-side commit.
 *
 * @param {string[]} relPaths paths relative to the design root
 * @returns {Map<string, string>} slug → body path relative to the design root
 */
export function indexCanvasPaths(relPaths) {
  const index = new Map();
  for (const raw of relPaths) {
    const rel = String(raw).replace(/\\/g, '/');
    if (!/\.(tsx|html)$/i.test(rel)) continue;
    // `_history/`, `_trash/`, `_canvas-state/` … are runtime state (DDR-115).
    if (rel.split('/').some((seg) => seg.startsWith('_'))) continue;
    const slug = canvasSlug(rel);
    const existing = index.get(slug);
    // Deterministic on collision: shortest path, then lexicographic. An
    // arbitrary winner would make the agent's output depend on readdir order,
    // and a history that differs between two identical cells is worse than a
    // history that picked the "wrong" one consistently.
    if (
      !existing ||
      rel.length < existing.length ||
      (rel.length === existing.length && rel < existing)
    ) {
      index.set(slug, rel);
    }
  }
  return index;
}

/**
 * Where a canvas's body goes when the checkout has never seen it.
 *
 * Flat, directly under the design root. A nested slug (`ui-foo`) cannot be
 * un-flattened without guessing, and guessing wrong scatters a tenant's files
 * into directories they never made. A desktop peer — which knows the real path
 * — will move it on its next sync; a flat file is trivially moved, an
 * invented directory tree is not.
 */
export function defaultBodyPath(slug) {
  return `${slug}${BODY_EXT}`;
}

/** Sibling paths derived from a body path. */
export function siblingPaths(bodyRel) {
  const stem = bodyRel.replace(/\.(tsx|html)$/i, '');
  return {
    meta: `${stem}.meta.json`,
    css: `${stem}.css`,
    annotations: `${stem}.annotations.svg`,
  };
}

/**
 * Read the four synced lanes out of a Y.Doc.
 *
 * Takes the doc rather than fetching it so this stays testable with a plain
 * object stand-in, and so the caller owns the yjs dependency.
 */
export function readDocContent(doc) {
  const text = (name) => {
    const t = doc.getText(name).toString();
    return t.length > 0 ? t : null;
  };
  const svg = doc.getMap(DOC_TYPES.annotations).get('svg');
  return {
    body: text(DOC_TYPES.html),
    css: text(DOC_TYPES.css),
    meta: text(DOC_TYPES.meta),
    annotations: typeof svg === 'string' && svg.length > 0 ? svg : null,
  };
}

/**
 * Decide the write set for one canvas.
 *
 * @param {object} args
 * @param {string} args.bodyRel      body path relative to the design root
 * @param {object} args.content      from readDocContent()
 * @param {object} args.onDisk       current bytes, keyed like siblingPaths() + `body`; null when absent
 * @returns {{ relPath: string, text: string }[]} paths relative to the design root
 *
 * Rules, each of which exists because its absence loses or corrupts work:
 *
 *   - A null lane is NOT a deletion. An unset Y.Text means "this doc never
 *     carried one", which is the normal state for a canvas with no `.css` and
 *     no annotations. Treating it as a delete would have the cell erase files
 *     the moment a peer connected with a partially-populated doc.
 *   - An unchanged lane is skipped, so a store event that changed only the
 *     body does not restamp the meta's mtime and drag it into the commit.
 *   - Meta is MERGED, never replaced: the doc carries the shared subset only,
 *     and the local keys (viewport, last_modified, syncable) are per-machine.
 *     Overwriting would reset the tenant's camera on every server commit and —
 *     far worse — drop `syncable: false`, which is a security opt-out.
 */
export function filesForCanvas({ bodyRel, content, onDisk = {} }) {
  const sib = siblingPaths(bodyRel);
  const out = [];

  const put = (relPath, text, current) => {
    if (text === null || text === undefined) return;
    if (current === text) return;
    out.push({ relPath, text });
  };

  put(bodyRel, content.body, onDisk.body ?? null);
  put(sib.css, content.css, onDisk.css ?? null);
  put(sib.annotations, content.annotations, onDisk.annotations ?? null);

  if (content.meta !== null && content.meta !== undefined) {
    const merged = mergeSharedMetaIntoLocal(onDisk.meta ?? null, content.meta);
    // null means the doc's shared meta did not parse. Skipping is the only
    // safe answer: writing a partial or empty `.meta.json` over a good one
    // would drop the canvas's layout.
    if (merged !== null) put(sib.meta, merged, onDisk.meta ?? null);
  }

  return out;
}

/**
 * Author identity for a commit.
 *
 * The editing human, never the machine — `git blame` on a design should answer
 * "who designed this", which is the entire reason the cell keeps history at
 * all (autocommit.ts rule 2). An unidentified edit gets a stable placeholder
 * rather than being silently attributed to the bot.
 */
/**
 * A hub session label (`mintLabel()` in auth-routes.mjs: `u-<12 hex>`). It
 * identifies a SESSION, not a person, and it is regenerated on every login —
 * so a history attributed to it says "u-1e166564e89d designed this", which is
 * both unreadable and different tomorrow for the same human.
 */
const SESSION_LABEL = /^u-[0-9a-f]{8,}$/;

export function attributionFor(user) {
  let name = typeof user?.name === 'string' ? user.name.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  if (email && SESSION_LABEL.test(name)) name = '';
  if (!name && !email) return null;
  const safeName = name || email.split('@')[0];
  // A synthesized address is marked as such. Inventing a plausible-looking
  // real address would make history claim more than it knows.
  const safeEmail = email || `${canvasSlug(safeName) || 'peer'}@workspace.invalid`;
  return { name: safeName, email: safeEmail };
}
