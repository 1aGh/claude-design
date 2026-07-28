// DDR-192 §5 — the `ws/<workspace-id>/<branch>/<slug>` document namespace.
//
// The bug this closes: with flat slugs, two projects (or two branches of one
// project) that each contain `ui-screen.tsx` share ONE Y.Doc on the hub. Under
// autosave that is silent cross-project data loss.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildDocName,
  DOC_NAMESPACE_PREFIX,
  groupCanvases,
  isNamespaced,
  parseDocName,
  sanitizeComponent,
} from '../src/doc-namespace.mjs';
import { matchesScope } from '../src/tokens.mjs';

// The hub's own live guard (server.mjs) — duplicated here rather than exported,
// so a change to the charset breaks this test loudly.
const DOCUMENT_NAME_REGEX = /^[A-Za-z0-9._/-]{1,256}$/;

test('sanitizeComponent collapses everything outside the namespace charset', () => {
  assert.equal(sanitizeComponent('feature/foo'), 'feature-foo');
  assert.equal(sanitizeComponent('Feature/Foo Bar'), 'feature-foo-bar');
  assert.equal(sanitizeComponent('release/2026.07'), 'release-2026.07');
  assert.equal(sanitizeComponent('  --weird--  '), 'weird');
  assert.equal(sanitizeComponent('...'), '');
  assert.equal(sanitizeComponent(''), '');
  assert.equal(sanitizeComponent(undefined), '');
  // No component may smuggle in a separator.
  assert.ok(!sanitizeComponent('a/b/c').includes('/'));
  // Length is bounded and the result never ends on a separator-ish char.
  const long = sanitizeComponent('x'.repeat(200));
  assert.equal(long.length, 64);
  assert.ok(!/[-.]$/.test(sanitizeComponent(`${'x'.repeat(63)}-tail`)));
});

test('buildDocName produces a name the hub will actually accept', () => {
  const name = buildDocName({ workspaceId: '1aGh-maude', branch: 'main', slug: 'ui-screen' });
  assert.equal(name, 'ws/1agh-maude/main/ui-screen');
  assert.match(name, DOCUMENT_NAME_REGEX);
  assert.equal(name.split('/')[0], DOC_NAMESPACE_PREFIX);
});

test('buildDocName REFUSES an empty component rather than merging documents', () => {
  assert.throws(() => buildDocName({ workspaceId: '', branch: 'main', slug: 'x' }), /workspaceId/);
  assert.throws(() => buildDocName({ workspaceId: 'w', branch: '...', slug: 'x' }), /branch/);
  assert.throws(() => buildDocName({ workspaceId: 'w', branch: 'main', slug: '' }), /slug/);
});

test('the collision the namespace exists to close', () => {
  const a = buildDocName({ workspaceId: 'acme-site', branch: 'main', slug: 'ui-screen' });
  const b = buildDocName({ workspaceId: 'other-app', branch: 'main', slug: 'ui-screen' });
  const c = buildDocName({ workspaceId: 'acme-site', branch: 'redesign', slug: 'ui-screen' });
  assert.notEqual(a, b, 'two projects must not share a document');
  assert.notEqual(a, c, 'two branches must not share a document');
  assert.equal(new Set([a, b, c]).size, 3);
});

test('parseDocName round-trips, and legacy flat slugs parse as null (not an error)', () => {
  const name = buildDocName({ workspaceId: 'acme', branch: 'main', slug: 'ui-screen' });
  assert.deepEqual(parseDocName(name), {
    workspaceId: 'acme',
    branch: 'main',
    slug: 'ui-screen',
  });
  assert.equal(isNamespaced(name), true);

  for (const legacy of ['ui-screen', '', 'ws/acme/main', 'ws/acme/main/a/b', 'x/acme/main/ui']) {
    assert.equal(parseDocName(legacy), null, `expected legacy/flat for ${JSON.stringify(legacy)}`);
    assert.equal(isNamespaced(legacy), false);
  }
  // An empty segment is never guessed at.
  assert.equal(parseDocName('ws//main/ui'), null);
  assert.equal(parseDocName('ws/acme//ui'), null);
  assert.equal(parseDocName(null), null);
});

test('a token scope prefix becomes a workspace scope for free (DDR-053 §3)', () => {
  const mine = buildDocName({ workspaceId: 'acme', branch: 'main', slug: 'ui' });
  const theirs = buildDocName({ workspaceId: 'acme-evil', branch: 'main', slug: 'ui' });
  // Scoping a token to the workspace prefix admits that workspace...
  assert.equal(matchesScope('ws/acme', mine), true);
  // ...and — the case that matters — does NOT admit a workspace whose id merely
  // starts with the same characters.
  assert.equal(matchesScope('ws/acme', theirs), false);
  // Branch-level scoping works the same way.
  assert.equal(matchesScope('ws/acme/main', mine), true);
  assert.equal(matchesScope('ws/acme/other', mine), false);
  assert.equal(matchesScope('*', mine), true);
});

test('groupCanvases groups by workspace + branch and keeps legacy visible, last', () => {
  const groups = groupCanvases([
    { name: 'ws/acme/main/ui-screen', bytes: 10, peers: 1 },
    { name: 'ws/acme/main/settings', bytes: 5, peers: 0 },
    { name: 'ws/acme/redesign/ui-screen', bytes: 7, peers: 2 },
    { name: 'ws/zeta/main/ui-screen', bytes: 1, peers: 0 },
    { name: 'old-flat-canvas', bytes: 3, peers: 1 },
  ]);

  assert.equal(groups.length, 4);
  assert.deepEqual(
    groups.map((g) => [g.workspaceId, g.branch, g.legacy]),
    [
      ['acme', 'main', false],
      ['acme', 'redesign', false],
      ['zeta', 'main', false],
      [null, null, true],
    ]
  );

  const acmeMain = groups[0];
  // Slugs are sorted and reported UNqualified — the group carries the context.
  assert.deepEqual(
    acmeMain.canvases.map((c) => c.slug),
    ['settings', 'ui-screen']
  );
  assert.equal(acmeMain.bytes, 15);
  assert.equal(acmeMain.peers, 1);
  // The full wire name stays available for anything that has to address the doc.
  assert.equal(acmeMain.canvases[1].name, 'ws/acme/main/ui-screen');

  // Legacy entries keep their whole name as the slug — never truncated or guessed.
  assert.equal(groups[3].canvases[0].slug, 'old-flat-canvas');
});

test('groupCanvases tolerates an empty/absent listing', () => {
  assert.deepEqual(groupCanvases([]), []);
  assert.deepEqual(groupCanvases(undefined), []);
  const g = groupCanvases([{ name: 'ws/a/b/c' }]);
  assert.equal(g[0].bytes, 0);
  assert.equal(g[0].peers, 0);
});
