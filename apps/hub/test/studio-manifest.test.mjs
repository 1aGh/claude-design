// E3 — every studio route surviving `pruneForWorkspace()` maps to a capability.
//
// THE POINT IS THE RED BUILD. The cell serves the real studio (DDR-209), whose
// route table grows every phase. A proxy is only default-deny if somebody
// notices the deny; without this test a new route is simply unreachable in the
// cloud, and the bug report is "the Layers panel is empty for my colleague"
// three weeks later. With it, the person adding the route is the person who
// classifies it, in the same change, while they still know the answer.
//
// It reads the studio's route table out of SOURCE rather than importing it,
// because `http.ts` is TypeScript that only Bun runs and this suite is
// `node --test`. That is the same trade `scripts/check-containment.sh` makes,
// and it is sound for the same reason: the shape being matched
// (`    '/route': ` at one indent level inside the routes literal) is the one
// the file has had since it was written, and a change that breaks the match
// makes the test fail loudly rather than pass vacuously — the count assertion
// below exists exactly to catch a regex that silently stops matching.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CAPABILITIES } from '../src/role-matrix.mjs';
import { capabilitiesUsed, classify, decide, STUDIO_ROUTES } from '../src/studio-manifest.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HTTP_TS = join(REPO, 'apps', 'studio', 'http.ts');
const WORKSPACE_TS = join(REPO, 'apps', 'studio', 'workspace-mode.ts');

/** Route keys declared in the studio's `routes` object literal. */
function studioRouteKeys() {
  const src = readFileSync(HTTP_TS, 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^ {4}'(\/[^']*)':/gm)) keys.add(m[1]);
  return [...keys].sort();
}

/** The forbidden prefixes, read from the vocabulary rather than re-typed. */
function forbiddenPrefixes() {
  const src = readFileSync(WORKSPACE_TS, 'utf8');
  const start = src.indexOf('FORBIDDEN_ROUTE_PREFIXES');
  const end = src.indexOf('SANDBOXED_ROUTE_PREFIXES');
  assert.ok(start !== -1 && end > start, 'both containment lists must exist (DDR-209 A′1)');
  return [...src.slice(start, end).matchAll(/prefix:\s*'([^']+)'/g)].map((m) => m[1]);
}

test('the route-key scrape still finds the studio table', () => {
  const keys = studioRouteKeys();
  // Not an exact number — that would fail on every unrelated feature. A floor
  // catches the only failure this guard has: a regex that matches nothing and
  // therefore approves everything.
  assert.ok(keys.length > 80, `expected the studio route table, scraped ${keys.length} keys`);
  assert.ok(keys.includes('/_config'), 'the scrape must see /_config');
  assert.ok(keys.includes('/_health'), 'the scrape must see /_health');
});

test('every route a cell serves is classified', () => {
  const forbidden = forbiddenPrefixes();
  const survives = (route) => !forbidden.some((p) => route === p || route.startsWith(p));
  const unclassified = studioRouteKeys()
    .filter(survives)
    .filter((route) => !Object.hasOwn(STUDIO_ROUTES, route));
  assert.deepEqual(
    unclassified,
    [],
    `these studio routes survive pruneForWorkspace() but no one has said what they mean:\n` +
      unclassified.map((r) => `  ${r}`).join('\n') +
      `\n\nAdd each to STUDIO_ROUTES in apps/hub/src/studio-manifest.mjs with the ` +
      `capability it needs (or REFUSED, with the reason). Cloud Phase 27 E3.`
  );
});

test('a write-classified route is never a GET-only handler (the edit-scope inversion)', () => {
  // The class that shipped: `/_api/edit-scope` was filed `{safe:null,
  // unsafe:'edit'}` — write-only — but its handler is `if (req.method !== 'GET')
  // 405`, a pure read. The hub then refused the shell's GET with 405 for every
  // role, owner included, and the Local/Shared badge (plus, by the same shape,
  // any other inverted route) was dead in the cloud. The manifest's `safe` side
  // must not be null when the handler answers ONLY GET.
  //
  // Source-scrape, same trade the rest of this file makes: `http.ts` is Bun-only
  // TS and this suite is node --test. The shape matched — a handler whose FIRST
  // guard is `req.method !== 'GET') ... 'Method not allowed'` — is GET-only.
  const src = readFileSync(HTTP_TS, 'utf8');
  const starts = [...src.matchAll(/^ {4}'(\/[^']*)': (?:async )?\(req/gm)].map((m) => ({
    path: m[1],
    at: m.index,
  }));
  const bodyOf = (path) => {
    const i = starts.findIndex((s) => s.path === path);
    if (i === -1) return null;
    return src.slice(starts[i].at, starts[i + 1]?.at ?? src.length);
  };
  const getOnly = (b) =>
    /req\.method !== 'GET'\)?\s*return new Response\('Method not allowed'/.test(b);

  const inverted = [];
  for (const [path, cls] of Object.entries(STUDIO_ROUTES)) {
    if (cls === null || cls === undefined) continue;
    const body = bodyOf(path);
    if (!body) continue; // dynamic / fetch-served — not an exact route literal
    if (cls.unsafe && cls.safe === null && getOnly(body)) inverted.push(path);
  }
  assert.deepEqual(
    inverted,
    [],
    `these routes are classified write-only but their handler answers only GET ` +
      `(the edit-scope inversion — the shell's GET gets 405 for every role):\n` +
      inverted.map((r) => `  ${r} → should be { safe: 'read', unsafe: null }`).join('\n')
  );
});

test('the manifest names no capability the matrix does not have', () => {
  for (const capability of capabilitiesUsed()) {
    assert.ok(
      CAPABILITIES.includes(capability),
      `'${capability}' is not in role-matrix.mjs — one table, one authority`
    );
  }
});

test('an unknown path is denied, not defaulted', () => {
  assert.deepEqual(decide('GET', '/_api/whatever-lands-next-phase', 'owner'), {
    allow: false,
    reason: 'unclassified',
    capability: null,
  });
  // Even for an owner. Deny-by-default that an owner can walk through is an
  // allowlist with extra steps.
  assert.equal(decide('POST', '/_api/nope', 'owner').allow, false);
});

test('a viewer may read, comment and keep their own place — and nothing else', () => {
  assert.equal(decide('GET', '/_config', 'viewer').allow, true);
  assert.equal(decide('POST', '/_comments', 'viewer').allow, true);
  assert.equal(decide('PUT', '/_canvas-state', 'viewer').allow, true);
  assert.equal(decide('POST', '/_api/edit-text', 'viewer').allow, false);
  assert.equal(decide('PUT', '/_api/annotations', 'viewer').allow, false);
  assert.equal(decide('POST', '/_api/git/commit', 'viewer').allow, false);
});

test('a viewer may not switch the branch everyone else is looking at', () => {
  // Cloud Phase 27 D2. Both of these were `read`, on the reasoning that
  // "looking at another branch is not changing one" — true for ONE user at ONE
  // checkout, and false in a cell, where the tree is shared: a viewer switching
  // branches replaces the files under an owner who is mid-edit, and a viewer
  // pulling merges into them. It is the most destructive write in the product,
  // performed by the role that is supposed to hold none.
  assert.equal(decide('POST', '/_api/git/checkout', 'viewer').allow, false);
  assert.equal(decide('POST', '/_api/git/pull', 'viewer').allow, false);
  assert.equal(decide('POST', '/_api/git/checkout', 'member').allow, true);
  assert.equal(decide('POST', '/_api/git/pull', 'member').allow, true);
  // Fetching moves remote-tracking refs and nothing else — still a read.
  assert.equal(decide('POST', '/_api/git/fetch', 'viewer').allow, true);
});

test('a member may edit but may not push this project somewhere else', () => {
  assert.equal(decide('POST', '/_api/edit-text', 'member').allow, true);
  assert.equal(decide('PUT', '/_api/annotations', 'member').allow, true);
  assert.equal(decide('POST', '/_api/git/push', 'member').allow, false);
  assert.equal(decide('POST', '/_api/git/push', 'owner').allow, true);
});

test('an unknown role gets nothing at all', () => {
  for (const path of ['/_config', '/_comments', '/_canvas-state']) {
    assert.equal(decide('GET', path, 'admin').allow, false, `${path} leaked to a bogus role`);
  }
  assert.equal(decide('GET', '/_config', undefined).allow, false);
  assert.equal(decide('GET', '/_config', '').allow, false);
});

test('the refused lane is refused for the owner too', () => {
  for (const path of ['/_api/export', '/_api/acp/status', '/_api/github/repos', '/_api/hub/link']) {
    const verdict = decide('POST', path, 'owner');
    assert.equal(verdict.allow, false, `${path} must never be served by a cell`);
    assert.equal(verdict.reason, 'refused');
  }
});

test('a GET on a POST-only editing route is a method refusal, not a role refusal', () => {
  const verdict = decide('GET', '/_api/edit-text', 'owner');
  assert.equal(verdict.allow, false);
  assert.equal(verdict.reason, 'method');
});

test('prefix rules resolve longest-match and cover the dynamic comment lane', () => {
  assert.equal(classify('POST', '/_api/comments/abc123/reply').capability, 'comment');
  assert.equal(decide('POST', '/_api/comments/abc123/reply', 'viewer').allow, true);
  assert.equal(decide('GET', '/_client/client.bundle.js', 'viewer').allow, true);
  assert.equal(decide('POST', '/_client/client.bundle.js', 'owner').allow, false);
});

// ── The design-system asset read lane ────────────────────────────────────────
//
// Reported 2026-08-13: in the cloud file browser every DS logo, font and photo
// showed a broken-image icon, while the SAME files rendered inside canvases.
// The canvas origin has always allowed `<designRoot>/…` (studio `isCanvasSafe`);
// the main origin never did, so the default-closed manifest refused the preview
// as `unclassified` and answered 404 without ever asking the studio child.
//
// What these pin is the boundary, not the feature: the lane must open exactly
// the paths the desktop is allowed to PUSH (`checkoutAssetRel`, the one home
// for that question) and nothing else — above all not the studio's repo-wide
// fall-through, which on a cell would be the whole tenant repository.

test('a design-system asset is readable — the file browser preview lane', () => {
  assert.deepEqual(
    decide('GET', '/.design/system/alligators/assets/logos/horizontal-green.svg', 'viewer'),
    {
      allow: true,
      capability: 'read',
    }
  );
  // Fonts and photographs travel the same lane.
  assert.equal(decide('GET', '/.design/system/ds/assets/fonts/Body.woff2', 'viewer').allow, true);
  assert.equal(decide('GET', '/.design/assets/acko-group-real.png', 'viewer').allow, true);
});

test('runtime state stays invisible, whatever it contains', () => {
  // DDR-115: `_history/`, `_chat/`, `_comments/`, `_untrusted/` are per-user
  // runtime state. A segment must start alphanumeric, so they never match.
  for (const p of [
    '/.design/_history/ui-home/assets/shot.png',
    '/.design/_comments/assets/pasted.png',
    '/.design/_untrusted/assets/hub-supplied.png',
    '/.design/_chat/assets/attachment.png',
  ]) {
    assert.equal(decide('GET', p, 'owner').reason, 'unclassified', p);
  }
});

test('the lane is assets-only — it is not a repository browser', () => {
  for (const p of [
    '/.design/ui/Home.tsx', // canvas SOURCE
    '/.design/config.json', // project config
    '/.design/system/ds/assets/logos/notes.txt', // wrong extension
    '/.design/system/ds/preview/logo.tsx', // no assets segment
    '/../../etc/passwd',
    '/.design/system/ds/assets/../../../escape.svg',
  ]) {
    assert.equal(decide('GET', p, 'owner').allow, false, p);
  }
});

test('it is READ-ONLY — an owner cannot write through it', () => {
  const v = decide('PUT', '/.design/system/ds/assets/logos/mark.svg', 'owner');
  assert.equal(v.allow, false);
  assert.equal(v.reason, 'method');
});

test('a percent-encoded traversal is decoded before it is judged', () => {
  assert.equal(
    decide('GET', '/.design/system/ds/assets/%2e%2e/%2e%2e/config.json', 'owner').allow,
    false
  );
});
