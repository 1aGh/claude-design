// Cloud Phase 5 Task 2 — cell naming, isolation, teardown and lifecycle.
//
// A multi-tenant provisioner fails at NAMING and SCOPE: an id that escapes its
// R2 prefix, a hostname handed to the wrong party, a destroy that leaves an
// orphan billing forever. Those are decisions, and decisions test exhaustively
// without a paid Cloudflare account — which is the point of this file existing
// before the account does.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertTransition,
  canTransition,
  cellConfig,
  cellNames,
  cellResources,
  destroySweep,
  keyBelongsToTenant,
  lifecycleStates,
  validateTenantId,
} from './cell-plan.mjs';

// ------------------------------------------------------------------ naming

test('a well-formed id is accepted and lowercased', () => {
  assert.deepEqual(validateTenantId('  Alligators '), { ok: true, id: 'alligators' });
  assert.deepEqual(validateTenantId('acme-design-2'), { ok: true, id: 'acme-design-2' });
});

test('ids that would break a hostname, an R2 key or a DO name are refused', () => {
  for (const bad of [
    '',
    ' ',
    '-leading',
    'trailing-',
    'has_underscore',
    'has.dot',
    'has space',
    'UPPER-ONLY-OK-BUT/slash',
    '../escape',
    'tenants/other',
    'a'.repeat(64),
    'emoji-🙂',
  ]) {
    assert.equal(validateTenantId(bad).ok, false, `${JSON.stringify(bad)} must be refused`);
  }
});

test('platform names are reserved', () => {
  // `api.cloud.maude.sh` belonging to whoever signs up first is a phishing
  // surface given away for free.
  for (const reserved of ['api', 'www', 'admin', 'billing', 'login', 'assets', 'maude']) {
    const res = validateTenantId(reserved);
    assert.equal(res.ok, false);
    assert.match(res.error, /reserved/);
  }
});

test('punycode-style ids are refused (homograph risk)', () => {
  assert.equal(validateTenantId('xn--80ak6aa92e').ok, false);
});

test('every name a cell occupies derives from ONE id', () => {
  // Drift between these is how a destroy misses a resource.
  const n = cellNames('alligators');
  assert.deepEqual(n, {
    tenant: 'alligators',
    hostname: 'alligators.cloud.maude.sh',
    r2Prefix: 'tenants/alligators/',
    durableObject: 'cell-alligators',
    container: 'maude-cell-alligators',
    r2TokenName: 'maude-cell-alligators-r2',
  });
  assert.throws(() => cellNames('../evil'), /invalid project id/);
});

// --------------------------------------------------------------- isolation

test('the trailing slash IS the isolation boundary between two customers', () => {
  // Without it, `tenants/acme` matches `tenants/acme-evil/secret.png`. One
  // character, and it is the entire boundary.
  assert.equal(keyBelongsToTenant('tenants/acme/assets/deadbeef.png', 'acme'), true);
  assert.equal(keyBelongsToTenant('tenants/acme/', 'acme'), true);
  assert.equal(keyBelongsToTenant('tenants/acme-evil/assets/x.png', 'acme'), false);
  assert.equal(keyBelongsToTenant('tenants/acmex/x.png', 'acme'), false);
  assert.equal(keyBelongsToTenant('tenants/other/x.png', 'acme'), false);
  assert.equal(keyBelongsToTenant('backups/hub.db.gz', 'acme'), false);
  assert.equal(keyBelongsToTenant('', 'acme'), false);
  assert.equal(keyBelongsToTenant(null, 'acme'), false);
});

test('two tenants can never share a prefix, hostname or DO name', () => {
  const a = cellNames('acme');
  const b = cellNames('acme-evil');
  assert.notEqual(a.r2Prefix, b.r2Prefix);
  assert.notEqual(a.hostname, b.hostname);
  assert.notEqual(a.durableObject, b.durableObject);
  assert.ok(!b.r2Prefix.startsWith(a.r2Prefix));
});

// ---------------------------------------------------------------- teardown

test('destroy removes routing first and data last', () => {
  // Deleting data while the hostname resolves leaves a live endpoint serving a
  // half-deleted project; revoking the credential before stopping the container
  // leaves a cell erroring in a loop.
  const order = cellResources('acme').map((r) => r.kind);
  assert.deepEqual(order, [
    'dns',
    'worker-route',
    'container',
    'durable-object',
    'r2-token',
    'r2-prefix',
  ]);
  assert.ok(order.indexOf('dns') < order.indexOf('container'));
  assert.ok(order.indexOf('container') < order.indexOf('r2-token'));
  assert.ok(order.indexOf('r2-token') < order.indexOf('r2-prefix'));
});

test('every resource explains why it is in the list', () => {
  for (const r of cellResources('acme')) {
    assert.ok(r.why && r.why.length > 15, `${r.kind} needs a reason`);
    assert.ok(r.name, `${r.kind} needs a name`);
  }
});

test('a suspend keeps the DATA and drops everything else', () => {
  // Suspension stops a cell; it does not delete state (DDR-193 §3).
  const suspend = destroySweep('acme').map((r) => r.kind);
  assert.ok(!suspend.includes('r2-prefix'), 'suspension must never delete the tenant’s data');
  assert.ok(suspend.includes('container'));

  const purge = destroySweep('acme', { purgeData: true }).map((r) => r.kind);
  assert.ok(purge.includes('r2-prefix'), 'a full purge does remove it');
  assert.equal(purge.length, cellResources('acme').length);
});

// --------------------------------------------------------------- lifecycle

test('the state machine matches DDR-193 §3', () => {
  assert.deepEqual(lifecycleStates(), [
    'pending',
    'active',
    'past_due',
    'suspended',
    'exported',
    'purged',
  ]);
  assert.equal(canTransition('pending', 'active'), true);
  assert.equal(canTransition('active', 'past_due'), true);
  assert.equal(canTransition('past_due', 'active'), true, 'paying again must resurrect');
  assert.equal(canTransition('past_due', 'suspended'), true);
  assert.equal(canTransition('suspended', 'active'), true, 'suspension must be reversible');
  assert.equal(canTransition('suspended', 'exported'), true);
  assert.equal(canTransition('exported', 'purged'), true);
});

test('NOTHING reaches purged without passing through exported', () => {
  // The one transition that must never exist: there is no path from "stopped
  // paying" to "your designs are gone" that skips "you were handed your files".
  for (const from of ['active', 'past_due', 'suspended']) {
    assert.equal(canTransition(from, 'purged'), false, `${from} → purged must be illegal`);
    assert.throws(() => assertTransition(from, 'purged'), /must be EXPORTED before purge/);
  }
  // `pending → purged` is allowed: a cell that never became active has no
  // customer data to hand back.
  assert.equal(canTransition('pending', 'purged'), true);
});

test('purged is terminal, and unknown states are refused', () => {
  for (const to of lifecycleStates()) {
    assert.equal(canTransition('purged', to), false);
  }
  assert.throws(() => assertTransition('nonsense', 'active'), /unknown state/);
  assert.throws(() => assertTransition('active', 'deleted'), /unknown state/);
});

// ------------------------------------------------------------------ config

test('the rendered cell config carries the containment flags', () => {
  const cfg = cellConfig('alligators');
  assert.equal(cfg.env.MAUDE_WORKSPACE_MODE, '1');
  assert.equal(cfg.env.HUB_WORKSPACE_MODE, '1');
  assert.equal(cfg.env.MAUDE_TENANT_ID, 'alligators');
  assert.equal(cfg.env.HUB_PUBLIC_URL, 'https://alligators.cloud.maude.sh');
  assert.equal(cfg.route, 'alligators.cloud.maude.sh/*');
  assert.equal(cfg.r2.prefix, 'tenants/alligators/');
});

test('secrets are NAMED, never valued', () => {
  // This object is logged, diffed and stored by the control plane.
  const cfg = cellConfig('acme');
  assert.deepEqual(cfg.secrets, [
    'HUB_SECRET',
    'MAUDE_S3_ACCESS_KEY_ID',
    'MAUDE_S3_SECRET_ACCESS_KEY',
  ]);
  for (const value of Object.values(cfg.env)) {
    assert.ok(!/secret|password|key/i.test(String(value)), 'no secret may appear in env values');
  }
});

test('an idle cell scales to zero and wakes on connect', () => {
  // The economic premise: an idle cell costs approximately nothing under
  // Active-CPU pricing (DDR-193 §1).
  const cfg = cellConfig('acme');
  assert.equal(cfg.lifecycle.scaleToZero, true);
  assert.deepEqual(cfg.lifecycle.wakeOn, ['http', 'websocket']);
  assert.ok(cfg.lifecycle.idleTimeoutSeconds > 0);
});

test('memory outside the platform bounds is REFUSED, not clamped', () => {
  // Silently giving someone less memory than they asked for is a support
  // ticket nobody can diagnose.
  assert.equal(cellConfig('acme', { memoryMib: 4096 }).instanceType.memoryMib, 4096);
  for (const bad of [0, 256, 8192, 1024.5, '2048']) {
    assert.throws(() => cellConfig('acme', { memoryMib: bad }), /between 512 and 4096/);
  }
});

test('the image tag is pinnable', () => {
  assert.match(cellConfig('acme', { imageTag: 'v0.48.0' }).image, /maude-cell:v0\.48\.0$/);
});
