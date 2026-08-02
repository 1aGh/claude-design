// Comments, from the browser — Cloud Phase 25 B5, and the DDR-200 reversal.
//
// ONE STORE, BOTH SURFACES. The desktop writes `<designRoot>/_comments/<slug>.json`
// (per-canvas, an array of records) and the cell's sync runtime already carries
// that directory between machines. So the browser door does not get a comment
// system — it gets a reader and a writer for the one that exists. A second
// store would be a second source of truth for the one thing whose whole value
// is that everybody sees the same notes.
//
// THE SHAPE IS NOT OURS TO INVENT. `apps/studio/api.ts` defines the record;
// this writes exactly that shape, including the fields a browser cannot fill
// (`bounds`, `dom_path`) — absent rather than guessed, because the desktop's
// resolver treats a wrong anchor worse than a missing one.
//
// COMMENT IS THE ONE WRITE A VIEWER HOLDS (the role matrix says so, and so
// does the People page's promise). That makes this the exact place a scope bug
// would turn "may leave a note" into "may edit the project" — so the writer
// touches nothing but the comments file, and the route is named explicitly in
// the cell's read-only allowlist rather than falling through a pattern.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const MAX_TEXT = 4000;
const MAX_COMMENTS_PER_CANVAS = 2000;

/**
 * `ui/Cloud Self Service.tsx` → `ui-cloud_self_service`.
 *
 * A CHARACTER-FOR-CHARACTER port of `apps/studio/canvas-slug.ts`
 * (`canvasSlugFromRel`), and it has to be: the slug IS the filename in
 * `_comments/`, so a rule that differs by one character does not produce a
 * bug you can see — it produces two files, and two halves of a conversation
 * that never meet. Spaces become underscores, slashes become hyphens, and
 * nothing else is normalised. Pinned by a test against the studio's own rule.
 */
export function commentSlug(rel, designRel = '.design') {
  let p = String(rel).replace(/^\/+|\/+$/g, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* a malformed escape stays as written */
  }
  const prefix = `${designRel.replace(/^\/+|\/+$/g, '')}/`;
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

function commentsFile(designRoot, rel) {
  return join(designRoot, '_comments', `${commentSlug(rel)}.json`);
}

export function readComments(designRoot, rel) {
  try {
    const raw = readFileSync(commentsFile(designRoot, rel), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Every canvas's comments, for the studio page's counts. */
export function commentCounts(designRoot) {
  const dir = join(designRoot, '_comments');
  const out = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const arr = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (Array.isArray(arr)) {
        out[name.replace(/\.json$/, '')] = arr.filter((c) => c?.status !== 'resolved').length;
      }
    } catch {
      /* an unreadable file is not a count */
    }
  }
  return out;
}

function writeComments(designRoot, rel, list) {
  const file = commentsFile(designRoot, rel);
  mkdirSync(join(designRoot, '_comments'), { recursive: true });
  // Same atomic-rename discipline the canvas writers use: a reader must never
  // see half a file, and the sync runtime watches this directory.
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(list, null, 2)}\n`);
  renameSync(tmp, file);
}

function id() {
  return `c_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-6)}`;
}

/**
 * Add one comment. Returns `{ok, comment}` or `{ok:false, error}`.
 *
 * `author` is the SESSION's email — never a client-supplied name. A comment
 * that can claim to be from someone else is worse than no comment.
 */
export function addComment(designRoot, rel, { text, selector, index, tag, author }) {
  const body = String(text ?? '').trim();
  if (!body) return { ok: false, error: 'a comment needs some text' };
  if (body.length > MAX_TEXT) return { ok: false, error: 'that comment is too long' };
  const list = readComments(designRoot, rel);
  if (list.length >= MAX_COMMENTS_PER_CANVAS) {
    return { ok: false, error: 'this canvas has too many comments' };
  }
  const comment = {
    id: id(),
    file: rel,
    selector: typeof selector === 'string' ? selector.slice(0, 400) : '',
    ...(Number.isInteger(index) ? { index } : {}),
    // A browser selection carries no measured box and no DOM path. Absent is
    // honest; invented would make the desktop's resolver anchor a pin to the
    // wrong element, which is worse than showing it unanchored.
    dom_path: [],
    tag: typeof tag === 'string' ? tag.slice(0, 40) : '',
    classes: '',
    bounds: null,
    html_excerpt: '',
    text: body,
    status: 'open',
    created: new Date().toISOString(),
    resolved_at: null,
    author: String(author ?? 'someone'),
    thread: [],
    mentions: [],
  };
  writeComments(designRoot, rel, [...list, comment]);
  return { ok: true, comment };
}

/** Reply to a comment. Same store, same author rule. */
export function replyToComment(designRoot, rel, commentId, { body, author }) {
  const text = String(body ?? '').trim();
  if (!text) return { ok: false, error: 'a reply needs some text' };
  if (text.length > MAX_TEXT) return { ok: false, error: 'that reply is too long' };
  const list = readComments(designRoot, rel);
  const hit = list.find((c) => c?.id === commentId);
  if (!hit) return { ok: false, error: 'that comment is gone' };
  hit.thread = Array.isArray(hit.thread) ? hit.thread : [];
  hit.thread.push({
    id: id(),
    body: text,
    author: String(author ?? 'someone'),
    created: new Date().toISOString(),
  });
  writeComments(designRoot, rel, list);
  return { ok: true };
}

/**
 * Resolve or reopen.
 *
 * A VIEWER MAY DO THIS, and that is deliberate: resolving is part of the
 * conversation, not a change to the design. Deleting is not — a viewer cannot
 * remove somebody else's note, and no route here offers it.
 */
export function setCommentStatus(designRoot, rel, commentId, status) {
  if (status !== 'open' && status !== 'resolved') return { ok: false, error: 'unknown status' };
  const list = readComments(designRoot, rel);
  const hit = list.find((c) => c?.id === commentId);
  if (!hit) return { ok: false, error: 'that comment is gone' };
  hit.status = status;
  hit.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
  writeComments(designRoot, rel, list);
  return { ok: true };
}
