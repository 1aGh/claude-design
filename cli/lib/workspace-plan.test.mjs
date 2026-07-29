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
  workspaceBaseUrl,
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

// ------------------------------------------------------- local testing mode
//
// Local mode exists because six of the eight verification steps had never run
// even once: exercising them required a public domain and a certificate, so
// nobody could test their own workspace before buying one. The risk it adds is
// obvious — a workspace served over plain HTTP puts sign-in passwords on the
// wire — so every test below is about keeping that mode unmistakable and
// impossible to reach by accident.

const LOCAL = { ...BASE, domain: 'localhost', local: true };

test('local mode drops the certificate, so it must NOT be reachable by default', () => {
  assert.equal(ok(BASE).local, false, 'absent flag is off');
  // A non-boolean must not switch it on — and then the config is a PRODUCTION
  // one, so it needs a production domain.
  assert.equal(ok({ ...BASE, local: 'yes' }).local, false, 'only a real boolean turns it on');
  assert.equal(ok(LOCAL).local, true);
});

test('local mode serves http, production serves https — one definition', () => {
  assert.equal(workspaceBaseUrl(ok(BASE)), 'https://design.acme.com');
  assert.equal(workspaceBaseUrl(ok(LOCAL)), 'http://localhost');
  // The verification plan must agree, or a local run fails every check for a
  // reason that has nothing to do with the workspace.
  const step = verificationPlan(ok(LOCAL)).find((s) => s.id === 'health');
  assert.match(step.detail, /http:\/\/localhost/);
  assert.ok(!step.detail.includes('https://'));
});

test('an ACME contact is required for a real deployment and pointless locally', () => {
  const real = validateWorkspaceConfig({ ...BASE, acmeEmail: undefined });
  assert.equal(real.ok, false);
  assert.ok(real.errors.some((e) => /acmeEmail is required/.test(e)));

  const local = validateWorkspaceConfig({ ...LOCAL, acmeEmail: undefined });
  assert.equal(local.ok, true, 'no certificate is fetched, so no contact is needed');
});

test('the local Caddyfile turns automatic HTTPS off explicitly', () => {
  // `tls internal` would mint a cert from a CA nothing trusts, so every check
  // would fail on certificate validation instead. An `http://` site address is
  // the only form that disables it outright.
  const local = renderCaddyfile(ok(LOCAL));
  assert.match(local, /^http:\/\/\{\$PUBLIC_DOMAIN\} \{/m);
  assert.ok(!local.includes('{$ACME_EMAIL}'), 'no ACME block in local mode');
  assert.match(local, /LOCAL TESTING ONLY/);
  assert.match(local, /passwords would travel in the clear/i);

  const real = renderCaddyfile(ok(BASE));
  assert.match(real, /^\{\$PUBLIC_DOMAIN\} \{/m, 'production keeps automatic HTTPS');
  assert.ok(!real.includes('LOCAL TESTING ONLY'));
  assert.ok(!real.includes('http://{$PUBLIC_DOMAIN}'));
});

test("the hub's own plaintext refusal is lifted ONLY in local mode", () => {
  // The hub refuses to serve a public URL over plaintext. Local mode has to
  // lift that or the container crash-loops — and it must not lift it anywhere
  // else, because that refusal is the thing protecting real deployments.
  const keys = (cfg) => envEntries(cfg, { hubSecret: 'x', adminPassword: 'y' }).map((e) => e.key);
  assert.ok(!keys(ok(BASE)).includes('HUB_INSECURE_HTTP'));
  assert.ok(keys(ok(LOCAL)).includes('HUB_INSECURE_HTTP'));

  const entry = envEntries(ok(LOCAL), {
    hubSecret: 'x',
    adminPassword: 'y',
  }).find((e) => e.key === 'HUB_INSECURE_HTTP');
  assert.match(entry.comment, /LOCAL TESTING ONLY/);
  assert.match(entry.comment, /Delete this line/, 'says how to undo it');
});

test('the compose file matches the scheme it is actually serving', () => {
  const local = renderCompose(ok(LOCAL));
  assert.match(local, /HUB_PUBLIC_URL: http:\/\/\$\{PUBLIC_DOMAIN\}/);
  assert.ok(!local.includes('"443:443"'), 'nothing terminates TLS, so nothing binds 443');
  assert.match(local, /HUB_INSECURE_HTTP/, 'and the variable reaches the container');

  const real = renderCompose(ok(BASE));
  assert.match(real, /HUB_PUBLIC_URL: https:\/\/\$\{PUBLIC_DOMAIN\}/);
  assert.match(real, /"443:443"/);
  assert.ok(!real.includes('HUB_INSECURE_HTTP'));
});

test('the admin PASSWORD reaches the container, not just the address', () => {
  // The half-wired state that shipped: `.env` held both, compose forwarded
  // only the email, so the hub knew who the first user was and had no way to
  // create them — and `workspace-up` still reported success, because the
  // sign-in check was one of the six that reported `skipped`.
  const compose = renderCompose(ok(BASE));
  assert.match(compose, /MAUDE_ADMIN_EMAIL/);
  assert.match(compose, /MAUDE_ADMIN_PASSWORD/);
});

test('local mode defaults to localhost and REFUSES a merely-resolving name', () => {
  // The bug this pins: the first cut used `ws.127.0.0.1.nip.io` to satisfy the
  // fully-qualified rule. Everything came up, and then the studio sync agent
  // refused to connect — its plaintext guard allowlists loopback names
  // literally, and it is right to: `127.0.0.1.nip.io` is registered and
  // controlled by a third party, so "resolves to loopback" is a promise that
  // can be withdrawn. Accepting it here would have pushed the failure to the
  // one place that matters, after the operator was told the workspace was up.
  const defaulted = ok({ ...BASE, domain: undefined, local: true });
  assert.equal(defaulted.domain, 'localhost');

  const sub = validateWorkspaceConfig({ ...BASE, domain: 'ws.localhost', local: true });
  assert.equal(sub.ok, true, 'RFC 6761 reserves everything under .localhost');

  const fake = validateWorkspaceConfig({ ...BASE, domain: 'ws.127.0.0.1.nip.io', local: true });
  assert.equal(fake.ok, false);
  assert.ok(fake.errors.some((e) => /loopback name/.test(e)));
  assert.ok(
    fake.errors.some((e) => /controlled by whoever owns the domain/.test(e)),
    'the error says WHY, or the next person picks another nip.io'
  );
});

test('`localhost` has no dot, and only local mode is allowed to skip the FQDN rule', () => {
  assert.equal(validateWorkspaceConfig({ ...BASE, domain: 'localhost', local: true }).ok, true);

  const production = validateWorkspaceConfig({ ...BASE, domain: 'localhost' });
  assert.equal(production.ok, false, 'a real deployment still needs a fully-qualified name');
  assert.ok(production.errors.some((e) => /not a valid hostname|fully qualified/.test(e)));
});

/* --------------------------------------------- Cloud Phase 16: server-owned git */

test('the workspace gets a checkout the hub can actually commit into', () => {
  // Until Phase 16 the hub had no repo at all: autosave ran only in the CLIENT,
  // so a project with no desktop attached kept no history — and "mirror to
  // GitHub" would have been a claim with nothing behind it.
  const compose = renderCompose(ok(BASE));
  assert.match(compose, /MAUDE_REPO_DIR: \/repo/, 'the hub must be told where its checkout is');
  assert.match(compose, /- hub-repo:\/repo/, 'the checkout needs a volume, or it dies with the container');
  assert.match(compose, /^volumes:\n(?:.*\n)*?  hub-repo:$/m, 'the volume must be declared');
});

test('the checkout is a SEPARATE volume from the documents', () => {
  // Same volume would mean an operator resetting a corrupt checkout also
  // destroys the documents — and the two have genuinely different recovery
  // stories (a checkout can come back from a mirror; documents cannot).
  const compose = renderCompose(ok(BASE));
  assert.match(compose, /- hub-data:\/data/);
  assert.match(compose, /- hub-repo:\/repo/);
});

test('MAUDE_SEED_REPO crosses into the container when one is configured', () => {
  // The variable existed and was rendered into .env long before anything read
  // it — the same half-wired shape as MAUDE_ADMIN_PASSWORD. Assert the
  // forwarding, because that is the half that rotted.
  const withSeed = renderCompose(ok({ ...BASE, seedRepo: 'https://github.com/acme/design.git' }));
  assert.match(withSeed, /MAUDE_SEED_REPO: \$\{MAUDE_SEED_REPO\}/);

  const without = renderCompose(ok(BASE));
  assert.ok(!/MAUDE_SEED_REPO/.test(without), 'no seed configured ⇒ no empty variable to misread');
});
