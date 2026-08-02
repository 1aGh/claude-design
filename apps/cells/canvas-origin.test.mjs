// The data plane's hostname routing.
//
// Cloud Phase 25 A4 added a SECOND kind of hostname to this Worker, and the
// two are not distinguishable by shape: `canvas.<zone>` is a syntactically
// valid tenant label, so without an explicit branch a canvas-origin request
// routes to a cell called "canvas" and serves the generic landing page. That
// is the failure this file exists to prevent, because it is silent — a
// working-looking page at exactly the address the origin should be at, which
// is how it reached production before these tests did.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { canvasOriginTenant, tenantFromHostname } from './cell-config.mjs';

test('canvas.<zone>/<project>/… resolves to the project, tenant stripped from the path', () => {
  const out = canvasOriginTenant(
    new URL('https://canvas.cloud.maude.sh/alligators/_canvas/module?c=ui/Home.tsx'),
    'cloud.maude.sh'
  );
  // The cell must see the path WITHOUT the tenant segment, so that a cell
  // serving a self-hoster and a cell serving a Cloud tenant handle
  // byte-identical requests.
  assert.deepEqual(out, { tenant: 'alligators', rest: '/_canvas/module' });
});

test('deeper canvas paths keep their remainder intact', () => {
  const out = canvasOriginTenant(
    new URL('https://canvas.cloud.maude.sh/alligators/_canvas/runtime/react.js'),
    'cloud.maude.sh'
  );
  assert.deepEqual(out, { tenant: 'alligators', rest: '/_canvas/runtime/react.js' });
});

test('the canvas origin with no project is a refusal, never a fall-through', () => {
  const out = canvasOriginTenant(new URL('https://canvas.cloud.maude.sh/'), 'cloud.maude.sh');
  assert.equal(out.tenant, null);
});

test('an ordinary project hostname is NOT the canvas origin', () => {
  assert.equal(
    canvasOriginTenant(new URL('https://alligators.cloud.maude.sh/studio'), 'cloud.maude.sh'),
    null
  );
});

test('a hostname that merely starts with canvas is not the origin either', () => {
  assert.equal(
    canvasOriginTenant(new URL('https://canvas-club.cloud.maude.sh/studio'), 'cloud.maude.sh'),
    null
  );
});

test('no zone configured means no canvas origin — never a guess', () => {
  assert.equal(canvasOriginTenant(new URL('https://canvas.cloud.maude.sh/x'), ''), null);
});

// ── the gallery's namespace stays dead (Cloud Phase 25 C5) ──────────────────

test('a leftover view-<project> hostname resolves to no tenant at all', () => {
  // Deleting the routes did not delete the addresses: `view-alligators` was
  // still live in production after C5. Left unguarded it is not a 404 — it is
  // a NEW empty cell at an old URL, with autosave ready to commit over it.
  assert.equal(tenantFromHostname('view-alligators.cloud.maude.sh', 'cloud.maude.sh'), null);
  assert.equal(tenantFromHostname('view-anything.cloud.maude.sh', 'cloud.maude.sh'), null);
  // A project whose own name merely contains the word is untouched.
  assert.equal(tenantFromHostname('viewfinder.cloud.maude.sh', 'cloud.maude.sh'), 'viewfinder');
});
