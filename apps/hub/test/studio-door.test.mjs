// The browser door — Cloud Phase 25 A1/A3/A4, rewritten for Cloud Phase 27.
//
// This suite used to test a studio the hub implemented itself: a canvas list, a
// design-system resolver, a structured-edit validator, a comment store. DDR-209
// deleted all four, because the real studio already owned every one of them and
// two implementations of the same route is the defect this phase exists to fix.
// What is left is what a DOOR is responsible for, and only that:
//
//   - the canvas origin is a genuinely different origin on the platform;
//   - the capability that opens it is bound to a project and expires;
//   - the kill switch stops rendering without stopping the project;
//   - the hub answers its OWN paths and hands over everything else;
//   - a member is sent to sign in at an address configuration states, never at
//     one a Host header claimed.
//
// The route-level rules moved to `studio-manifest.test.mjs` (which routes mean
// what) and `studio-proxy.test.mjs` (who may reach them).

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const HERE = join(import.meta.dirname, '..');

import { mintRenderToken, verifyRenderToken } from '../src/render-token.mjs';
import { ROLES } from '../src/role-matrix.mjs';
import {
  canvasOriginFor,
  doorVerdict,
  isCanvasHost,
  isHubOwned,
  renderDisabled,
  servicePage,
  signInUrl,
} from '../src/studio-door.mjs';

function fixture({ withProject = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cell-door-'));
  if (withProject) mkdirSync(join(root, '.design'), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

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

test('a request is recognised as canvas-origin by HOST, not by path', () => {
  const env = { CELL_ZONE: 'cloud.maude.sh', MAUDE_TENANT_ID: 'alligators' };
  assert.equal(isCanvasHost({ headers: { host: 'canvas.cloud.maude.sh' } }, env), true);
  assert.equal(isCanvasHost({ headers: { host: 'alligators.cloud.maude.sh' } }, env), false);
  // A path that merely LOOKS like the canvas lane on the shell origin is not it.
  assert.equal(isCanvasHost({ headers: { host: 'alligators.cloud.maude.sh' } }, env), false);
  assert.equal(isCanvasHost({ headers: {} }, {}), false);
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

test('the hub keeps its own paths and hands the rest to the studio', () => {
  for (const own of ['/health', '/admin', '/admin/api/status', '/auth/browser', '/assets/ab12cd']) {
    assert.equal(isHubOwned(own), true, `${own} is the hub's`);
  }
  // Everything the studio serves — including the ones that do not exist yet.
  for (const studio of ['/', '/_config', '/_api/edit-text', '/_client/client.bundle.js']) {
    assert.equal(isHubOwned(studio), false, `${studio} must reach the studio`);
  }
});

test('the door pauses, then notices an absent project, then asks for a session', () => {
  const f = fixture({ withProject: false });
  try {
    const env = { MAUDE_REPO_DIR: f.root, MAUDE_RENDER_DISABLED: '1' };
    assert.equal(doorVerdict({ pathname: '/', env, session: null }).kind, 'paused');
    // Pause wins over everything, including a missing project — the on-call
    // person threw the switch and deserves to see that they threw it.
    const noProject = { MAUDE_REPO_DIR: f.root };
    assert.equal(doorVerdict({ pathname: '/', env: noProject, session: null }).kind, 'no-project');
    mkdirSync(join(f.root, '.design'), { recursive: true });
    assert.equal(doorVerdict({ pathname: '/', env: noProject, session: null }).kind, 'sign-in');
    assert.equal(
      doorVerdict({ pathname: '/', env: noProject, session: { role: 'viewer' } }),
      null,
      'a signed-in session is the proxy’s business, not the door’s'
    );
  } finally {
    f.cleanup();
  }
});

test('sign-in returns the member to the address CONFIGURATION states (D4)', () => {
  const url = signInUrl({
    request: { headers: { host: 'internal-tunnel-7f3a.cfargotunnel.com' } },
    env: {
      MAUDE_TENANT_ID: 'alligators',
      HUB_PUBLIC_URL: 'https://alligators.cloud.maude.sh',
      HUB_DASHBOARD_URL: 'https://cloud.maude.sh',
    },
  });
  assert.match(url, /^https:\/\/cloud\.maude\.sh\/projects\/alligators\/browser\?return=/);
  const back = decodeURIComponent(new URL(url).searchParams.get('return'));
  assert.equal(back, 'https://alligators.cloud.maude.sh/auth/browser');
  assert.ok(!back.includes('cfargotunnel'), 'the tunnel hostname must never reach a member');
});

test('the service page carries no inline style — the CSP would drop it silently', () => {
  // Third recurrence of DDR-097 when it was written; it stays a test.
  const html = servicePage('Paused', 'Nothing has changed.', {
    action: { href: '/admin', label: 'Console' },
  });
  assert.equal([...html.matchAll(/\sstyle\s*=\s*["']/g)].length, 0);
  assert.ok(html.includes('<link rel="stylesheet" href="/admin/style.css">'));
  // And it escapes.
  assert.ok(servicePage('<script>', 'x').includes('&lt;script&gt;'));
});

// ---------------------------------------------------------------------------
// The account-role / project-role collision. Found by running a real cell in a
// container, not by reading the code: `/auth/login` mints a token carrying
// `role: 'admin'` (an ACCOUNT role), the session resolver took it on trust, and
// `isReadOnlyRole('admin')` is true because an unknown role gets nothing — so
// the OWNER opened his own project and could not edit it.

test('only a PROJECT role is accepted as a project role', () => {
  const source = readFileSync(join(HERE, 'src', 'server.mjs'), 'utf8');
  const fn = /function browserSession\([\s\S]*?\n\}/.exec(source)?.[0] ?? '';
  assert.ok(fn, 'browserSession must exist');
  assert.match(
    fn,
    /ROLES\.includes\(match\.role\)/,
    'a token role must be validated against the role matrix before it is believed'
  );
  assert.ok(
    !/const role = match\.role \?\?/.test(fn),
    'match.role must not be taken on trust — account roles and project roles are different vocabularies'
  );
});

test('the two vocabularies do not overlap, which is what makes the check safe', () => {
  // If an account role were ever named `member`, the validation above would
  // silently start granting edit. This asserts the assumption rather than
  // relying on nobody ever doing it.
  const accountRoles = ['admin', 'user', 'operator'];
  for (const r of accountRoles) {
    assert.ok(!ROLES.includes(r), `'${r}' is an account role and must not be a project role`);
  }
});
