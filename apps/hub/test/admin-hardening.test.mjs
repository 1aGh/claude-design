// DDR-053 hardening coverage — CSP/XFO headers, ?secret rejection,
// Content-Type strict, proto-pollution guard, identity endpoint, rate limit,
// rotate kicks WS sessions, label/documentName/publicUrl validation,
// bootstrap concurrent-consume.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { issueBootstrap, verifyAndConsume } from '../src/bootstrap.mjs';
import { createHub } from '../src/server.mjs';

const BASE_PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14700', 10);
const SECRET = 'test-admin-secret';

let hub;
let dataDir;
let PORT;
let portCounter = 0;

beforeEach(async () => {
  PORT = BASE_PORT + portCounter++;
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-hardening-'));
  const built = createHub({
    port: PORT,
    dataDir,
    secret: SECRET,
    publicUrl: `https://hub.example.com:${PORT}`,
    verbose: false,
    rateLimit: false, // most tests bypass the limiter; rate-limit test re-enables
  });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

function api(path, init = {}) {
  return fetch(`http://127.0.0.1:${PORT}/admin/api${path}`, init);
}
function auth(extra = {}) {
  return { Authorization: `Bearer ${SECRET}`, ...extra };
}
function jsonHeaders() {
  return { ...auth(), 'Content-Type': 'application/json' };
}

// ----------------------------------------------------- CSP / XFO / Referrer

test('GET /admin sets CSP + X-Frame-Options + Referrer-Policy headers', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin`);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const csp = res.headers.get('content-security-policy') ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'self'/);
});

test('GET /admin/style.css + /admin/app.js carry the same admin-origin hardening headers', async () => {
  for (const path of ['/admin/style.css', '/admin/app.js']) {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
    assert.equal(res.headers.get('x-frame-options'), 'DENY', `${path}: X-Frame-Options`);
    assert.match(
      res.headers.get('content-security-policy') ?? '',
      /default-src 'self'/,
      `${path}: CSP`
    );
  }
});

// ----------------------------------------------------- ?secret= rejected

test('?secret=... query string is REJECTED on every /admin/api/* route (DDR-053 §1)', async () => {
  for (const path of ['/status', '/tokens', '/peers', '/canvases', '/activity', '/settings']) {
    const res = await api(`${path}?secret=${encodeURIComponent(SECRET)}`);
    assert.equal(res.status, 401, `${path}: query auth must not work`);
  }
});

// --------------------------------------- new operator surfaces (DDR-097)

test('the new canvases / activity / settings routes are Bearer-gated', async () => {
  for (const path of ['/canvases', '/activity', '/settings']) {
    assert.equal((await api(path)).status, 401, `${path}: GET must require Bearer`);
  }
});

test('POST /admin/api/settings requires auth + JSON Content-Type', async () => {
  // No auth → 401.
  assert.equal(
    (
      await api('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X' }),
      })
    ).status,
    401
  );
  // Authed but text/plain → 400 (closes the CSRF gadget, DDR-053 §5).
  assert.equal(
    (
      await api('/settings', {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'text/plain' },
        body: JSON.stringify({ name: 'X' }),
      })
    ).status,
    400
  );
});

test('POST /admin/api/admin-secret/rotate requires auth', async () => {
  const res = await api('/admin-secret/rotate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 401);
});

test('POST /admin/api/admin-secret/rotate enforces JSON Content-Type (defense-in-depth)', async () => {
  const res = await api('/admin-secret/rotate', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'text/plain' },
    body: '{}',
  });
  assert.equal(res.status, 400);
});

// -------------------------------------------------- Content-Type strict + body

test('POST with text/plain body is rejected (DDR-053 §5 — closes CSRF gadget)', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: { ...auth(), 'Content-Type': 'text/plain' },
    body: JSON.stringify({ label: 'alice' }),
  });
  assert.equal(res.status, 400);
});

test('POST with missing Content-Type is rejected', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ label: 'alice' }),
  });
  assert.equal(res.status, 400);
});

test('POST with __proto__ payload is rejected (proto-pollution guard)', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: '{"__proto__":{"isAdmin":true},"label":"alice"}',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /reserved property/);
});

test('POST with constructor payload is rejected', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: '{"constructor":{},"label":"alice"}',
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------- label validation

test('POST /token rejects label with newline (log forging defense)', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'alice\nFAKE LOG' }),
  });
  assert.equal(res.status, 400);
});

test('POST /token rejects label > 64 chars', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'x'.repeat(65) }),
  });
  assert.equal(res.status, 400);
});

test('POST /token rejects label with HTML metacharacters', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: '<script>alert(1)</script>' }),
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------- scope through API

test('POST /token defaults scope = label and surfaces it in response', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'alice' }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.label, 'alice');
  assert.equal(body.scope, 'alice');
});

test('POST /token rejects a scope with HTML metacharacters (stored-XSS defense at source)', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'evil', scope: '<img src=x onerror=alert(1)>' }),
  });
  assert.equal(res.status, 400);
});

test('POST /token rejects an over-long scope (memory bound)', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'big', scope: 'a'.repeat(200) }),
  });
  assert.equal(res.status, 400);
});

test('POST /token with explicit scope: "*" mints a wildcard token', async () => {
  const res = await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'ops', scope: '*' }),
  });
  const body = await res.json();
  assert.equal(body.scope, '*');
});

test('GET /tokens lists scope alongside label', async () => {
  await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'alice' }),
  });
  await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'ops', scope: '*' }),
  });
  const res = await api('/tokens', { headers: auth() });
  const body = await res.json();
  const alice = body.tokens.find((t) => t.label === 'alice');
  const ops = body.tokens.find((t) => t.label === 'ops');
  assert.equal(alice.scope, 'alice');
  assert.equal(ops.scope, '*');
});

// ---------------------------------------------------- rotate response

test('POST /token/rotate returns disconnected count (0 when no peers)', async () => {
  await api('/token', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'alice' }),
  });
  const res = await api('/token/rotate', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ label: 'alice' }),
  });
  const body = await res.json();
  assert.equal(body.disconnected, 0);
});

// ---------------------------------------------------- /identity (unauthed)

test('GET /admin/api/identity is unauthenticated and surfaces publicUrl + fingerprint', async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/identity`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.publicUrl, `https://hub.example.com:${PORT}`);
  assert.match(body.hostFingerprint, /^[0-9a-f]{16}$/);
  assert.equal(typeof body.version, 'string');
});

// ---------------------------------------------------- bootstrap atomic

test('verifyAndConsume — two simultaneous calls: exactly one wins', async () => {
  const rec = issueBootstrap(dataDir);
  // Fire both in the same tick. Whichever rename arrives second at the kernel
  // gets ENOENT — only one returns true.
  const [a, b] = await Promise.all([
    Promise.resolve(verifyAndConsume(dataDir, rec.key)),
    Promise.resolve(verifyAndConsume(dataDir, rec.key)),
  ]);
  assert.equal(a !== b, true, 'exactly one of the two consumes must succeed');
});

test('POST /admin/api/bootstrap consumes the key + returns admin secret', async () => {
  const rec = issueBootstrap(dataDir);
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: rec.key }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.secret, /^[0-9a-f]{64}$/);
});

test('POST /admin/api/bootstrap without JSON Content-Type is rejected', async () => {
  const rec = issueBootstrap(dataDir);
  const res = await fetch(`http://127.0.0.1:${PORT}/admin/api/bootstrap`, {
    method: 'POST',
    body: JSON.stringify({ key: rec.key }),
  });
  assert.equal(res.status, 400);
});

// ---------------------------------------------------- publicUrl validation

test('createHub refuses to boot with a malicious publicUrl (shell metacharacters)', async () => {
  assert.throws(
    () =>
      createHub({
        port: 14999,
        dataDir,
        secret: SECRET,
        publicUrl: 'https://evil.com; rm -rf /;#',
        verbose: false,
        rateLimit: false,
      }),
    /invalid publicUrl/
  );
});

test('createHub refuses non-http(s) publicUrl', async () => {
  assert.throws(
    () =>
      createHub({
        port: 14998,
        dataDir,
        secret: SECRET,
        publicUrl: 'javascript:alert(1)',
        verbose: false,
        rateLimit: false,
      }),
    /invalid publicUrl/
  );
});
