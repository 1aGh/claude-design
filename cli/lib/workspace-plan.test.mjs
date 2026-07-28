// Cloud Phase 4 Task 1 — the workspace-up planning layer.
//
// A provisioner's real failure modes are decisions, not I/O: a bad domain
// rendering a broken Caddyfile, a missing no-expiry rule quietly scheduling
// someone's media for deletion, an "it worked!" printed before anything
// round-tripped. All testable without a VPS, which is why they live here.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  envEntries,
  operatorDuties,
  renderCaddyfile,
  renderCompose,
  renderEnv,
  validateWorkspaceConfig,
  verificationPlan,
} from './workspace-plan.mjs';

const BASE = {
  domain: 'design.acme.com',
  acmeEmail: 'ops@acme.com',
  adminEmail: 'alice@acme.com',
};
const S3 = {
  endpoint: 'https://acct.r2.cloudflarestorage.com',
  bucket: 'acme-design-assets',
  accessKeyId: 'AKIA',
  secretAccessKey: 'secret',
};
const ok = (raw) => {
  const r = validateWorkspaceConfig(raw);
  assert.deepEqual(r.errors, [], `expected valid: ${r.errors.join('; ')}`);
  return r.config;
};

// ------------------------------------------------------------- validation

test('a valid config normalizes rather than nitpicking', () => {
  const cfg = ok({ ...BASE, domain: 'HTTPS://Design.Acme.com/', adminEmail: 'Alice@Acme.com' });
  assert.equal(cfg.domain, 'design.acme.com');
  assert.equal(cfg.adminEmail, 'alice@acme.com');
  assert.equal(cfg.imageTag, 'latest');
  assert.equal(cfg.seedRepo, null);
});

test('EVERY problem is reported at once, not the first one', () => {
  // Someone filling this in wants to fix everything in one pass, not play
  // whack-a-mole with a wizard.
  const res = validateWorkspaceConfig({ domain: 'not a domain', acmeEmail: 'nope' });
  assert.equal(res.ok, false);
  assert.ok(res.errors.length >= 3, `expected several errors, got ${res.errors.length}`);
  assert.ok(res.errors.some((e) => e.includes('domain')));
  assert.ok(res.errors.some((e) => e.includes('acmeEmail')));
  assert.ok(res.errors.some((e) => e.includes('adminEmail')));
});

test('a bare hostname without a dot is refused', () => {
  // "localhost" or "hub" would render a Caddyfile that can never get a cert.
  const res = validateWorkspaceConfig({ ...BASE, domain: 'localhost' });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /domain/.test(e)));
});

test('a short admin password is refused before anything is written', () => {
  const res = validateWorkspaceConfig({ ...BASE, adminPassword: 'short' });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /at least 12/.test(e)));
});

test('partial S3 config is an error, never a half-configured lane', () => {
  const res = validateWorkspaceConfig({ ...BASE, s3: { bucket: 'b' } });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('s3.endpoint')));
  assert.ok(res.errors.some((e) => e.includes('s3.accessKeyId')));
});

test('an invalid bucket name is caught here, not by the provider later', () => {
  assert.equal(
    validateWorkspaceConfig({ ...BASE, s3: { ...S3, bucket: 'A_Bad_Bucket' } }).ok,
    false
  );
});

test('a seed repo must look like a git URL', () => {
  assert.equal(validateWorkspaceConfig({ ...BASE, seedRepo: 'my-folder' }).ok, false);
  assert.equal(
    ok({ ...BASE, seedRepo: 'git@github.com:acme/design.git' }).seedRepo,
    'git@github.com:acme/design.git'
  );
  assert.equal(ok({ ...BASE, seedRepo: '  ' }).seedRepo, null, 'blank means start fresh');
});

test('devMinio supplies its own credentials and marks them as dev', () => {
  const cfg = ok({ ...BASE, devMinio: true });
  assert.equal(cfg.s3.dev, true);
  assert.equal(cfg.s3.endpoint, 'http://minio:9000');
});

// ------------------------------------------------------------------- env

test('.env carries the trusted-proxy setting UNCONDITIONALLY', () => {
  // Caddy fronts the hub. Without this every client shares one rate-limit
  // bucket and one attacker's login flood limits everybody (DDR-194 §4).
  const entries = envEntries(ok(BASE), { hubSecret: 'deadbeef' });
  const byKey = Object.fromEntries(entries.map((e) => [e.key, e.value]));
  assert.ok(byKey.HUB_TRUSTED_PROXIES.includes('172.16.0.0/12'));
  assert.equal(byKey.HUB_WORKSPACE_MODE, '1');
  assert.equal(byKey.MAUDE_WORKSPACE_MODE, '1', 'the containment invariant must be on');
});

test('.env includes S3 only when configured', () => {
  const without = envEntries(ok(BASE), { hubSecret: 'x' }).map((e) => e.key);
  assert.ok(!without.includes('MAUDE_S3_BUCKET'));
  const with3 = envEntries(ok({ ...BASE, s3: S3 }), { hubSecret: 'x' }).map((e) => e.key);
  assert.ok(with3.includes('MAUDE_S3_BUCKET'));
  assert.ok(with3.includes('MAUDE_S3_SECRET_ACCESS_KEY'));
});

test('renderEnv announces that it holds secrets', () => {
  const text = renderEnv(
    envEntries(ok(BASE), { hubSecret: 'sekrit', adminPassword: 'a-good-one-12' })
  );
  assert.match(text, /Contains SECRETS/);
  assert.match(text, /Mode 0600, never committed/);
  assert.match(text, /^HUB_SECRET=sekrit$/m);
  // The bootstrap password is flagged as temporary rather than left to linger.
  assert.match(text, /change it after, then remove this line/);
});

// --------------------------------------------------------------- compose

test('MinIO is behind a PROFILE, not a comment', () => {
  // A commented-out service is one somebody uncomments in production.
  const yaml = renderCompose(ok({ ...BASE, devMinio: true }));
  assert.match(yaml, /profiles: \["dev"\]/);
  assert.match(yaml, /DEV ONLY/);
  assert.ok(!renderCompose(ok(BASE)).includes('minio'), 'no MinIO without devMinio');
});

test('the hub is exposed, never published — Caddy is the only way in', () => {
  const yaml = renderCompose(ok({ ...BASE, s3: S3 }));
  const hubBlock = yaml.slice(yaml.indexOf('  hub:'), yaml.indexOf('  caddy:'));
  assert.match(hubBlock, /expose:/);
  assert.ok(!/^\s+ports:/m.test(hubBlock), 'the hub must not publish a port to the host');
});

test('compose passes every configured secret by reference, never inline', () => {
  const yaml = renderCompose(ok({ ...BASE, s3: S3 }));
  assert.match(yaml, /MAUDE_S3_SECRET_ACCESS_KEY: \$\{MAUDE_S3_SECRET_ACCESS_KEY\}/);
  assert.ok(!yaml.includes('secret'), 'no literal secret value may appear in compose');
});

test('Caddy forwards the client address, or per-client rate limiting cannot work', () => {
  const caddy = renderCaddyfile(ok(BASE));
  assert.match(caddy, /header_up X-Forwarded-For \{remote_host\}/);
  assert.match(caddy, /reverse_proxy hub:1234/);
  assert.match(caddy, /\{\$PUBLIC_DOMAIN\}/);
});

// ---------------------------------------------------------- verification

test('the plan verifies a ROUND TRIP, not just liveness', () => {
  // A provisioner that prints a URL without proving a round-trip has told the
  // operator something it does not know.
  const ids = verificationPlan(ok(BASE)).map((s) => s.id);
  assert.ok(ids.includes('canvas-roundtrip'));
  assert.ok(ids.includes('git-commit'));
  assert.ok(ids.includes('user-signin'));
  assert.ok(ids.includes('restore-drill'));
});

test('with object storage it also checks that nothing will EXPIRE the media', () => {
  // The quiet catastrophe: a lifecycle rule on assets/ deletes objects that
  // canvases in git history still point at, with no recovery path.
  const ids = verificationPlan(ok({ ...BASE, s3: S3 })).map((s) => s.id);
  assert.ok(ids.includes('s3-object'));
  assert.ok(ids.includes('s3-no-expiry'));
  assert.ok(!verificationPlan(ok(BASE)).some((s) => s.id === 's3-no-expiry'));
});

test('every step states what it checks, in words an operator can act on', () => {
  for (const step of verificationPlan(ok({ ...BASE, s3: S3 }))) {
    assert.ok(step.title.length > 5, `step ${step.id} needs a title`);
    assert.ok(step.detail.length > 10, `step ${step.id} needs a detail`);
  }
});

// -------------------------------------------------------- operator duties

test('the run never claims to own the deployment forever', () => {
  // The breaker trap: "done" implies ownership. This scaffolded and verified it
  // once; rotation, backups, upgrades and the bill stay with the operator.
  const duties = operatorDuties(ok(BASE));
  const text = duties
    .map((d) => `${d.title} ${d.detail}`)
    .join(' ')
    .toLowerCase();
  assert.ok(duties.length >= 5);
  assert.match(text, /rotate/);
  assert.match(text, /restore drill/);
  assert.match(text, /upgrade/);
  assert.match(text, /bill/);
});

test('the duties card warns about `latest` by name', () => {
  const pinned = operatorDuties(ok({ ...BASE, imageTag: 'v0.48.0' }));
  assert.match(pinned.find((d) => /pin/i.test(d.title)).detail, /v0\.48\.0/);
  const floating = operatorDuties(ok(BASE));
  assert.match(floating.find((d) => /pin/i.test(d.title)).detail, /unplanned upgrade/);
});

test('object storage adds the never-expire duty; dev MinIO adds its own warning', () => {
  const withS3 = operatorDuties(ok({ ...BASE, s3: S3 }))
    .map((d) => d.title)
    .join(' ');
  assert.match(withS3, /Never expire the assets\/ prefix/);
  const dev = operatorDuties(ok({ ...BASE, devMinio: true }))
    .map((d) => d.title)
    .join(' ');
  assert.match(dev, /MinIO credentials are in this directory/);
});
