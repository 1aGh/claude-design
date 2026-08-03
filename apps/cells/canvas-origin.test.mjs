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
import { readFileSync } from 'node:fs';
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

// Cloud Phase 27 — the marker the cell trusts, and the one it must never see.
//
// The cell cannot tell the canvas origin from the project hostname by looking:
// after a Durable Object and a container proxy, `Host` is not what the browser
// typed. So the Worker says which it is. That is only safe while the Worker
// also STRIPS the claim from every request on the project hostname.

test('the canvas branch marks the request', async () => {
  const src = readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8');
  const branch = src.slice(
    src.indexOf('if (canvasTenant) {'),
    src.indexOf('const tenant = tenantFromHostname')
  );
  assert.match(branch, /headers\.delete\(CANVAS_ORIGIN_HEADER\)/);
  assert.match(branch, /headers\.set\(CANVAS_ORIGIN_HEADER, '1'\)/);
  // Deleted BEFORE it is set — an inbound copy must not survive by ordering.
  assert.ok(
    branch.indexOf('headers.delete(CANVAS_ORIGIN_HEADER)') <
      branch.indexOf("headers.set(CANVAS_ORIGIN_HEADER, '1')"),
    'strip must precede set'
  );
});

test('the project hostname strips any claim before the cell sees it', () => {
  const src = readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8');
  const branch = src.slice(src.indexOf('const tenant = tenantFromHostname'));
  assert.match(branch, /stripped\.delete\(CANVAS_ORIGIN_HEADER\)/);
  assert.ok(
    !/stripped\.set\(CANVAS_ORIGIN_HEADER/.test(branch),
    'the project hostname must never assert the canvas origin'
  );
});
