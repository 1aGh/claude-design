// The browser door — Cloud Phase 25 A1/A3/A4 + B3/B4 + C3.
//
// The rules that must hold whatever the UI looks like: the canvas origin is
// capability-authenticated and read-only, the shell origin is session-
// authenticated, a viewer's session cannot mutate, the kill switch stops
// rendering without stopping the project, and the import allowlist is stated
// in words a person can act on.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { checkEditOp, EDIT_KINDS } from '../src/canvas/edits.mjs';
import { designSystemFor, listCanvases, stylesheetsFor } from '../src/canvas/project.mjs';
import { mintRenderToken, verifyRenderToken } from '../src/canvas/render-token.mjs';
import { canvasOriginFor, renderDisabled } from '../src/canvas/routes.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cell-door-'));
  const designRoot = join(root, '.design');
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  mkdirSync(join(designRoot, 'system', 'maude', 'preview'), { recursive: true });
  writeFileSync(
    join(designRoot, 'config.json'),
    JSON.stringify({
      designSystems: [
        { name: 'maude', path: 'system/maude', tokensCssRel: 'system/maude/colors_and_type.css' },
      ],
    })
  );
  writeFileSync(join(designRoot, 'system', 'maude', 'colors_and_type.css'), ':root{}');
  writeFileSync(join(designRoot, 'system', 'maude', 'preview', '_components.css'), '.x{}');
  writeFileSync(join(designRoot, 'system', 'maude', 'preview', '_layout.css'), '.y{}');
  writeFileSync(
    join(designRoot, 'system', 'maude', 'preview', 'buttons.tsx'),
    'export default () => null;'
  );
  writeFileSync(join(designRoot, 'ui', 'Home.tsx'), 'export default () => null;');
  writeFileSync(
    join(designRoot, 'ui', 'Home.meta.json'),
    JSON.stringify({ designSystem: 'maude' })
  );
  // Runtime state must never be listed or served (DDR-115).
  mkdirSync(join(designRoot, '_history'), { recursive: true });
  writeFileSync(join(designRoot, '_history', 'Old.tsx'), 'export default () => null;');
  return { root, designRoot, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('the canvas list is the project, and never its runtime state', () => {
  const f = fixture();
  try {
    const rels = listCanvases(f.designRoot).map((c) => c.rel);
    assert.ok(rels.includes('ui/Home.tsx'));
    assert.ok(rels.includes('system/maude/preview/buttons.tsx'));
    assert.ok(!rels.some((r) => r.startsWith('_history/')));
  } finally {
    f.cleanup();
  }
});

test('a specimen renders under ITS design system; a UI canvas under its declared one', () => {
  const f = fixture();
  try {
    assert.equal(designSystemFor(f.designRoot, 'system/maude/preview/buttons.tsx'), 'maude');
    assert.equal(designSystemFor(f.designRoot, 'ui/Home.tsx'), 'maude');
    const css = stylesheetsFor(f.designRoot, 'system/maude/preview/buttons.tsx');
    assert.equal(css.tokens, 'system/maude/colors_and_type.css');
    assert.equal(css.layout, 'system/maude/preview/_layout.css');
    // A UI canvas gets no preview layout — that is a specimen's chrome.
    assert.equal(stylesheetsFor(f.designRoot, 'ui/Home.tsx').layout, null);
  } finally {
    f.cleanup();
  }
});

test('a render capability is bound to its project and expires', () => {
  const secret = 'cell-secret';
  const token = mintRenderToken({ secret, project: 'alligators', subject: 'a@b.c' });
  assert.equal(verifyRenderToken({ secret, token, project: 'alligators' }).ok, true);
  // Another tenant's cell cannot accept it…
  assert.equal(verifyRenderToken({ secret, token, project: 'other' }).ok, false);
  // …nor can a forged signature…
  assert.equal(verifyRenderToken({ secret: 'different', token, project: 'alligators' }).ok, false);
  // …nor can it outlive its window.
  const stale = mintRenderToken({ secret, project: 'alligators', subject: 'a@b.c', ttlMs: 1 });
  assert.equal(
    verifyRenderToken({ secret, token: stale, project: 'alligators', now: Date.now() + 10 }).ok,
    false
  );
});

test('the canvas origin is a DIFFERENT origin on the platform, the same one self-hosted', () => {
  const platform = canvasOriginFor(
    { headers: { host: 'alligators.cloud.maude.sh' } },
    { CELL_ZONE: 'cloud.maude.sh', MAUDE_TENANT_ID: 'alligators' }
  );
  assert.equal(platform.separate, true);
  assert.equal(platform.origin, 'https://canvas.cloud.maude.sh');
  assert.equal(platform.prefix, '/alligators');

  const selfHosted = canvasOriginFor({ headers: { host: 'design.acme.internal' } }, {});
  assert.equal(selfHosted.separate, false);
  assert.equal(selfHosted.origin, '');
});

test('the kill switch is per-tenant and reachable without a restart', () => {
  const f = fixture();
  try {
    assert.equal(renderDisabled({ MAUDE_REPO_DIR: f.root }), null);
    assert.equal(renderDisabled({ MAUDE_RENDER_DISABLED: '1' }), 'operator');
    writeFileSync(join(f.root, '.render-off'), '');
    assert.equal(renderDisabled({ MAUDE_REPO_DIR: f.root }), 'on-call');
  } finally {
    f.cleanup();
  }
});

test('a mutation must name a known operation and stay inside the project', () => {
  const f = fixture();
  try {
    const root = f.designRoot;
    assert.equal(
      checkEditOp({ kind: 'nope', canvas: 'ui/Home.tsx' }, { designRoot: root }).ok,
      false
    );
    // Traversal out of the design root is refused, exactly like an import.
    const escaped = checkEditOp(
      { kind: 'set-text', canvas: '../../etc/passwd.tsx', id: 'a', text: 'x' },
      { designRoot: root }
    );
    assert.equal(escaped.ok, false);
    assert.match(escaped.error, /outside this project/);
    // Only canvases.
    assert.equal(
      checkEditOp(
        { kind: 'set-text', canvas: 'config.json', id: 'a', text: 'x' },
        { designRoot: root }
      ).ok,
      false
    );
    // A good one resolves to an absolute path inside the root.
    const ok = checkEditOp(
      {
        kind: 'set-style',
        canvas: 'ui/Home.tsx',
        id: 'abc123',
        property: 'background',
        value: '#111',
      },
      { designRoot: root }
    );
    assert.equal(ok.ok, true);
    assert.ok(ok.op.canvasAbs.startsWith(root));
    // Shape checks are real, not decorative.
    assert.equal(
      checkEditOp(
        { kind: 'set-style', canvas: 'ui/Home.tsx', id: 'a b', property: 'background', value: 'x' },
        { designRoot: root }
      ).ok,
      false
    );
    assert.equal(
      checkEditOp(
        { kind: 'resize-artboard', canvas: 'ui/Home.tsx', artboardId: 'a', width: 999999 },
        { designRoot: root }
      ).ok,
      false
    );
    assert.equal(
      checkEditOp(
        { kind: 'set-text', canvas: 'ui/Home.tsx', id: 'a', text: 'x'.repeat(20000) },
        { designRoot: root }
      ).ok,
      false
    );
  } finally {
    f.cleanup();
  }
});

test('the mutation vocabulary is CLOSED — adding to it is a deliberate edit', () => {
  assert.deepEqual(
    [...EDIT_KINDS],
    ['set-style', 'reposition', 'set-text', 'delete-element', 'resize-artboard']
  );
});

// ── comments (B5) — one store, both surfaces ───────────────────────────────

test('the comment slug is the DESKTOP slug, character for character', async () => {
  const { commentSlug } = await import('../src/canvas/comments.mjs');
  // The rule is `apps/studio/canvas-slug.ts` — spaces become underscores,
  // slashes become hyphens, extension goes, lowercase. If these ever diverge,
  // the browser and the desktop write two files and the conversation splits.
  assert.equal(commentSlug('ui/Cloud Self Service.tsx'), 'ui-cloud_self_service');
  assert.equal(commentSlug('.design/ui/Home.tsx'), 'ui-home');
  assert.equal(commentSlug('system/maude/preview/buttons.tsx'), 'system-maude-preview-buttons');
  assert.equal(commentSlug('ui/Legacy.html'), 'ui-legacy');
});

test('a comment carries the SESSION as its author and no invented anchor', async () => {
  const { addComment, readComments, replyToComment, setCommentStatus } = await import(
    '../src/canvas/comments.mjs'
  );
  const f = fixture();
  try {
    const added = addComment(f.designRoot, 'ui/Home.tsx', {
      text: 'the hero is too tight',
      selector: '[data-cd-id="abc"]',
      index: 0,
      tag: 'h1',
      // Even if a client sends one, the route passes the session's address —
      // this asserts the record shape the route relies on.
      author: 'viewer@example.com',
    });
    assert.equal(added.ok, true);
    assert.equal(added.comment.author, 'viewer@example.com');
    assert.equal(added.comment.status, 'open');
    // Absent rather than guessed: a browser has no measured box or DOM path,
    // and a wrong anchor is worse than none.
    assert.equal(added.comment.bounds, null);
    assert.deepEqual(added.comment.dom_path, []);

    const list = readComments(f.designRoot, 'ui/Home.tsx');
    assert.equal(list.length, 1);

    assert.equal(
      replyToComment(f.designRoot, 'ui/Home.tsx', added.comment.id, {
        body: 'agreed',
        author: 'o@e.com',
      }).ok,
      true
    );
    assert.equal(readComments(f.designRoot, 'ui/Home.tsx')[0].thread.length, 1);

    assert.equal(
      setCommentStatus(f.designRoot, 'ui/Home.tsx', added.comment.id, 'resolved').ok,
      true
    );
    assert.equal(readComments(f.designRoot, 'ui/Home.tsx')[0].status, 'resolved');
    // An unknown status is refused rather than written.
    assert.equal(
      setCommentStatus(f.designRoot, 'ui/Home.tsx', added.comment.id, 'deleted').ok,
      false
    );
  } finally {
    f.cleanup();
  }
});

test('empty and oversized comments are refused', async () => {
  const { addComment } = await import('../src/canvas/comments.mjs');
  const f = fixture();
  try {
    assert.equal(addComment(f.designRoot, 'ui/Home.tsx', { text: '   ' }).ok, false);
    assert.equal(addComment(f.designRoot, 'ui/Home.tsx', { text: 'x'.repeat(5000) }).ok, false);
  } finally {
    f.cleanup();
  }
});
