// `maude hub workspace-up` — Cloud Phase 4 Task 1, the effects layer.
//
// The decisions live in `cli/lib/workspace-plan.mjs` (pure, tested without a
// VPS). This file does the parts that genuinely touch the world: read config,
// write files, boot the stack, run the verification plan, print the result.
//
// IDEMPOTENT BY CONSTRUCTION. Re-running is the upgrade path: the rendered
// files are regenerated, but `.env` secrets that already exist are REUSED, not
// re-minted. Re-minting HUB_SECRET on every run would silently lock out every
// peer that already has a token, and it would do it to the person whose
// instinct after a failed run is to try again.
//
// It does NOT claim to own the deployment afterwards — see `operatorDuties`.

import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseArgs } from '../lib/argv.mjs';
import {
  envEntries,
  operatorDuties,
  renderCaddyfile,
  renderCompose,
  renderEnv,
  validateWorkspaceConfig,
  verificationPlan,
  workspaceBaseUrl,
} from '../lib/workspace-plan.mjs';

export function usage() {
  return `maude hub workspace-up [options]

  Stand up a self-hosted Maude WORKSPACE — a hub that owns the project, commits
  autosaves, and stores media in object storage — and verify it actually works
  before saying so.

  --domain HOST            public hostname (design.acme.com)
  --acme-email EMAIL       Let's Encrypt contact
  --admin-email EMAIL      the first person who can sign in
  --admin-password PASS    their initial password (>= 12 chars; generated if omitted)
  --s3-endpoint URL        object storage (R2 / MinIO / S3)
  --s3-bucket NAME
  --s3-access-key-id ID
  --s3-secret-access-key SECRET
  --s3-region REGION       default "auto"
  --dev-minio              run a local MinIO under the compose 'dev' profile
  --local                  TESTING: serve plain HTTP on localhost, no
                           certificate, no ACME. --domain defaults to
                           "localhost" and must stay a loopback NAME.
                           Lets you exercise the whole stack — and every
                           verification step — on a laptop, with no domain and
                           no paid account. Never serve a real workspace this
                           way: sign-in passwords would travel in the clear.
  --seed-repo URL          clone an existing project; omit to start fresh
  --image-tag TAG          default "latest" — pin it before you rely on this
  --config FILE            read all of the above from a JSON file
  --out DIR                where to write compose/Caddyfile/.env (default: cwd)
  --dry-run                render + print the plan, touch nothing else
  --json                   machine-readable result

  Re-running is the UPGRADE path: files are regenerated, existing secrets in
  .env are REUSED (re-minting HUB_SECRET would lock out every peer that already
  has a token).

  What it does NOT do: own the deployment. It scaffolds and verifies once.
  Rotation, backups, upgrades and the bill stay with you — the run prints the
  list.
`;
}

export async function run({ args, pkgRoot }) {
  const { flags } = parseArgs(args, {
    booleans: ['help', 'dry-run', 'json', 'dev-minio', 'local'],
  });
  if (flags.help) {
    process.stdout.write(usage());
    return;
  }

  const outDir = resolve(String(flags.out ?? process.cwd()));
  const raw = flags.config ? readConfigFile(String(flags.config)) : {};
  const merged = {
    domain: flags.domain ?? raw.domain,
    acmeEmail: flags['acme-email'] ?? raw.acmeEmail,
    adminEmail: flags['admin-email'] ?? raw.adminEmail,
    ...((flags['admin-password'] ?? raw.adminPassword)
      ? { adminPassword: flags['admin-password'] ?? raw.adminPassword }
      : {}),
    devMinio: flags['dev-minio'] === true || raw.devMinio === true,
    local: flags.local === true || raw.local === true,
    seedRepo: flags['seed-repo'] ?? raw.seedRepo,
    imageTag: flags['image-tag'] ?? raw.imageTag,
    ...(flags['s3-endpoint'] || raw.s3
      ? {
          s3: {
            endpoint: flags['s3-endpoint'] ?? raw.s3?.endpoint,
            bucket: flags['s3-bucket'] ?? raw.s3?.bucket,
            accessKeyId: flags['s3-access-key-id'] ?? raw.s3?.accessKeyId,
            secretAccessKey: flags['s3-secret-access-key'] ?? raw.s3?.secretAccessKey,
            region: flags['s3-region'] ?? raw.s3?.region,
          },
        }
      : {}),
  };

  const { ok, errors, config } = validateWorkspaceConfig(merged);
  if (!ok) {
    if (flags.json) {
      process.stdout.write(`${JSON.stringify({ ok: false, errors }, null, 2)}\n`);
    } else {
      process.stderr.write('maude hub workspace-up: the configuration is not usable yet.\n\n');
      for (const e of errors) process.stderr.write(`  • ${e}\n`);
      process.stderr.write('\nRun with --help for the full list of options.\n');
    }
    process.exit(2);
  }

  // Reuse existing secrets — re-minting on a re-run would lock out every peer
  // that already holds a token, and re-running is exactly what someone does
  // after a failed attempt.
  const existing = readExistingEnv(resolve(outDir, '.env'));
  const hubSecret = existing.HUB_SECRET || randomBytes(32).toString('hex');
  const adminPassword = config.adminPassword || existing.MAUDE_ADMIN_PASSWORD || generatePassword();
  const reusedSecret = Boolean(existing.HUB_SECRET);

  const entries = envEntries(config, { hubSecret, adminPassword });
  const files = [
    { name: '.env', body: renderEnv(entries), mode: 0o600 },
    { name: 'docker-compose.yml', body: renderCompose(config), mode: 0o644 },
    { name: 'Caddyfile', body: renderCaddyfile(config), mode: 0o644 },
  ];
  const plan = verificationPlan(config);
  const duties = operatorDuties(config);

  if (flags['dry-run']) {
    const result = {
      ok: true,
      dryRun: true,
      outDir,
      files: files.map((f) => ({ name: f.name, bytes: Buffer.byteLength(f.body), mode: f.mode })),
      verification: plan.map((s) => ({ id: s.id, title: s.title })),
      duties: duties.map((d) => d.title),
      reusedSecret,
    };
    if (flags.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else printDryRun({ config, outDir, files, plan, duties, reusedSecret });
    return;
  }

  mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    const path = resolve(outDir, f.name);
    writeFileSync(path, f.body, { encoding: 'utf8', mode: f.mode });
    try {
      chmodSync(path, f.mode);
    } catch {
      /* windows — best effort */
    }
  }

  const dockerAvailable = await which('docker');
  if (!dockerAvailable) {
    if (flags.json) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, wrote: files.map((f) => f.name), error: 'docker not found' }, null, 2)}\n`
      );
    } else {
      process.stdout.write(
        `Wrote ${files.map((f) => f.name).join(', ')} to ${outDir}\n\n` +
          'Docker is not on PATH, so the stack was not started and NOTHING WAS VERIFIED.\n' +
          'Install Docker and run:\n\n' +
          `  cd ${outDir} && docker compose up -d\n\n` +
          'Then re-run this command to verify the deployment.\n'
      );
    }
    process.exit(1);
  }

  process.stdout.write(`Wrote ${files.map((f) => f.name).join(', ')} to ${outDir}\n`);
  process.stdout.write('Starting the stack…\n');
  // `--dev-minio` renders MinIO behind the `dev` compose profile, and a profile
  // service does NOT start on a plain `compose up`. Rendering the bucket into
  // the hub's config while never starting the bucket is the shape of failure
  // that reports "storage configured" and then cannot store anything.
  const composeArgs = config.s3?.dev
    ? ['compose', '--profile', 'dev', 'up', '-d']
    : ['compose', 'up', '-d'];
  const up = await sh('docker', composeArgs, { cwd: outDir });
  if (up.code !== 0) {
    process.stderr.write(`docker compose up failed:\n${up.stderr}\n`);
    process.exit(1);
  }

  // `compose up -d` returns when the containers are STARTED, not when they are
  // SERVING. Verifying immediately reported "the workspace answers — ✗
  // unreachable" against a stack that was healthy three seconds later: a false
  // failure, which corrodes trust in the suite exactly as fast as a false pass.
  // Bounded, and it gives up rather than waiting forever — a stack that never
  // comes up must still be reported.
  await waitForHealth(workspaceBaseUrl(config));

  // Verification is the deliverable. A URL printed without a proven round-trip
  // tells the operator something this command does not know.
  process.stdout.write('\nVerifying — this is the part that matters:\n');
  const results = [];
  let failed = 0;
  for (const step of plan) {
    const outcome = await runVerification(step, {
      config,
      hubSecret,
      adminPassword,
      outDir,
      pkgRoot,
    });
    results.push({ id: step.id, title: step.title, ...outcome });
    const mark = outcome.ok ? '✓' : outcome.skipped ? '–' : '✗';
    process.stdout.write(`  ${mark} ${step.title}${outcome.note ? ` — ${outcome.note}` : ''}\n`);
    if (!outcome.ok && !outcome.skipped) failed++;
  }

  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: failed === 0, outDir, verification: results, duties }, null, 2)}\n`
    );
  } else {
    printDuties(duties);
    process.stdout.write(
      failed === 0
        ? `\nWorkspace verified: ${workspaceBaseUrl(config)}\n`
        : `\n${failed} check(s) did NOT pass. The stack is running but is not proven — fix and re-run.\n`
    );
  }
  if (failed > 0) process.exit(1);
}

// ------------------------------------------------------------------ helpers

function readConfigFile(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (err) {
    process.stderr.write(
      `maude hub workspace-up: couldn't read --config ${path}: ${err.message}\n`
    );
    process.exit(2);
  }
}

/** Parse an existing `.env` so a re-run reuses secrets instead of re-minting. */
function readExistingEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {
    /* unreadable → treat as absent */
  }
  return out;
}

/** Readable, high-entropy, and safe to paste — no ambiguous glyphs. */
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function sh(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', () => resolvePromise({ code: 127, stdout, stderr: 'spawn failed' }));
    child.on('close', (code) => resolvePromise({ code: code ?? 1, stdout, stderr }));
  });
}

/**
 * Poll `/health` until the stack is serving, or give up.
 *
 * Deliberately silent on success and NEVER fatal: if the wait expires, the
 * verification steps run anyway and report the real failure. This function
 * removes a timing artefact; it must not become a second place that decides
 * whether the deployment is good.
 */
async function waitForHealth(base, { timeoutMs = 45_000, intervalMs = 1_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  while (Date.now() < deadline) {
    const res = await tryFetch(`${base}/health`);
    if (res.ok) return true;
    if (!announced) {
      process.stdout.write('Waiting for the stack to answer…\n');
      announced = true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function which(bin) {
  const res = await sh(process.platform === 'win32' ? 'where' : 'which', [bin]);
  return res.code === 0;
}

/**
 * Execute one verification step.
 *
 * A step this build cannot yet perform reports `skipped` with a reason — it
 * NEVER reports success. Counting an unrun check as passed is the single
 * fastest way to make a verification suite worthless.
 */
async function runVerification(step, { config, hubSecret, adminPassword, outDir, pkgRoot }) {
  const base = workspaceBaseUrl(config);
  switch (step.id) {
    case 'health': {
      const res = await tryFetch(`${base}/health`);
      return res.ok ? { ok: true } : { ok: false, note: res.note };
    }
    case 'admin-claimed': {
      const res = await tryFetch(`${base}/admin/api/status`, {
        headers: { Authorization: `Bearer ${hubSecret}` },
      });
      return res.ok ? { ok: true } : { ok: false, note: res.note };
    }
    case 'user-signin':
      return verifySignin(base, config.adminEmail, adminPassword);
    case 'git-commit':
      return verifyGitHistory(outDir);
    case 's3-object':
      return verifyBucketRoundTrip(config, pkgRoot);
    case 's3-no-expiry':
      return verifyNoLifecycle(config, pkgRoot);
    case 'restore-drill':
      return verifyRestoreDrill(config);
    default:
      return {
        ok: false,
        skipped: true,
        note: 'not yet automated — verify by hand, then close it in the plan',
      };
  }
}

/**
 * The credential the operator is about to be handed actually works.
 *
 * This is the check that would have caught the shipped bug where a provisioned
 * workspace had no users at all: every other check passed, the URL printed,
 * and the first person to try the login was the one who found out.
 */
async function verifySignin(base, email, password) {
  if (!password) return { ok: false, note: 'no admin password was generated' };
  try {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, note: `HTTP ${res.status} — the first user cannot sign in` };
    const body = await res.json().catch(() => null);
    return body?.token ? { ok: true } : { ok: false, note: 'login returned no session token' };
  } catch (err) {
    return { ok: false, note: err.name === 'TimeoutError' ? 'timed out' : 'unreachable' };
  }
}

/**
 * The server-side checkout has real commits (Cloud Phase 16).
 *
 * Read from INSIDE the container, because that is where the history lives.
 * Checking a path on the operator's laptop would pass on a machine that
 * happens to have a repo and tell us nothing about the deployment.
 */
async function verifyGitHistory(outDir) {
  const probe = await sh(
    'docker',
    ['compose', 'exec', '-T', 'hub', 'git', '-C', '/repo', 'log', '-1', '--format=%H %an'],
    { cwd: outDir }
  );
  if (probe.code !== 0) {
    const err = `${probe.stderr}`.toLowerCase();
    // A fresh workspace has no commits because nobody has edited anything yet.
    // That is the NORMAL state five seconds after provisioning, and reporting
    // it as a failure trains the operator to ignore a red mark — which is
    // precisely what makes a real one invisible later. Skipped says the truth:
    // this was not proven, and here is what would prove it.
    if (err.includes('does not have any commits') || err.includes('bad default revision')) {
      return {
        ok: false,
        skipped: true,
        note: 'the checkout is ready but empty — edit a canvas, then re-run to prove autosave commits',
      };
    }
    if (err.includes('not a git repository')) {
      return {
        ok: false,
        note: 'the workspace has no checkout — server-side history is not running',
      };
    }
    if (err.includes('executable file not found') || err.includes('not found')) {
      return { ok: false, note: 'git is missing from the hub image — history cannot be kept' };
    }
    return { ok: false, note: `git log failed: ${probe.stderr.trim().slice(0, 120)}` };
  }
  const line = probe.stdout.trim();
  if (!line) {
    return {
      ok: false,
      skipped: true,
      note: 'the checkout is ready but empty — edit a canvas, then re-run',
    };
  }
  return { ok: true, note: `HEAD by ${line.split(' ').slice(1).join(' ') || 'unknown'}` };
}

/** Load the hub's S3 client from the installed package. */
async function loadS3(pkgRoot) {
  for (const candidate of [
    resolve(pkgRoot, 'apps/hub/src/s3.mjs'),
    resolve(pkgRoot, '../apps/hub/src/s3.mjs'),
  ]) {
    const mod = await import(`file://${candidate}`).catch(() => null);
    if (mod) return mod;
  }
  return null;
}

function s3ConfigFrom(config) {
  const s = config.s3;
  // The dev MinIO endpoint (`http://minio:9000`) is a compose-network name.
  // These checks run on the OPERATOR's machine, which cannot resolve it — but
  // the compose file publishes the port, so loopback is the same bucket.
  const endpoint = s.dev ? s.endpoint.replace('//minio:', '//127.0.0.1:') : s.endpoint;
  return {
    endpoint,
    bucket: s.bucket,
    accessKeyId: s.accessKeyId,
    secretAccessKey: s.secretAccessKey,
    region: s.region ?? 'auto',
  };
}

/**
 * A real object goes into the bucket and comes back out.
 *
 * Content-addressed, so the sentinel is indistinguishable from a genuine
 * asset — and it is removed afterwards, because a verification step that
 * litters a customer's bucket is a verification step people turn off.
 */
async function verifyBucketRoundTrip(config, pkgRoot) {
  if (!config.s3) return { ok: false, skipped: true, note: 'no object storage configured' };
  const s3 = await loadS3(pkgRoot);
  if (!s3)
    return { ok: false, skipped: true, note: 'the hub S3 client was not found in this install' };
  const cfg = s3ConfigFrom(config);
  const bytes = Buffer.from(`maude workspace-up sentinel\n`);
  const key = `assets/${createHash('sha256').update(bytes).digest('hex').slice(0, 8)}.bin`;
  try {
    // The stack was declared healthy by the HUB's health check; object storage
    // is a different container and may still be starting. A one-shot attempt
    // here reported "fetch failed" against a MinIO that was serving four
    // seconds later — a false failure, which corrodes the suite as fast as a
    // false pass.
    await retry(() => s3.putObject(cfg, key, bytes), { attempts: 6, delayMs: 2000 });
    const head = await s3.headObject(cfg, key);
    if (!head) return { ok: false, note: 'the object was written but could not be read back' };
    if (head.size !== bytes.length) {
      return { ok: false, note: `read back ${head.size} bytes, wrote ${bytes.length}` };
    }
    return { ok: true };
  } catch (err) {
    if (/NoSuchBucket/i.test(err.message)) {
      return {
        ok: false,
        note: `the bucket "${cfg.bucket}" does not exist at ${cfg.endpoint} — create it, then re-run`,
      };
    }
    if (/InvalidAccessKeyId|SignatureDoesNotMatch/i.test(err.message)) {
      return { ok: false, note: 'object storage rejected the credentials' };
    }
    return { ok: false, note: `bucket rejected the round trip: ${err.message.slice(0, 120)}` };
  } finally {
    await s3.deleteObject(s3ConfigFrom(config), key).catch(() => {});
  }
}

/**
 * No lifecycle rule can expire the media.
 *
 * The quiet catastrophe this guards: assets are content-addressed and
 * referenced from git history forever, so an expiry rule deletes objects that
 * canvases still point at, with no recovery path and no error at the time.
 *
 * A bucket with NO lifecycle configuration answers 404 — that is the pass.
 */
async function verifyNoLifecycle(config, pkgRoot) {
  if (!config.s3) return { ok: false, skipped: true, note: 'no object storage configured' };
  const s3 = await loadS3(pkgRoot);
  if (!s3?.signRequest) {
    return { ok: false, skipped: true, note: 'the hub S3 client was not found in this install' };
  }
  const cfg = s3ConfigFrom(config);
  try {
    const signed = s3.signRequest(cfg, { method: 'GET', key: '', query: { lifecycle: '' } });
    const res = await fetch(signed.url, {
      method: 'GET',
      headers: signed.headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) return { ok: true, note: 'no lifecycle configuration' };
    if (!res.ok) {
      // Cannot read the config ⇒ cannot claim it is safe. Skipped, never passed.
      return {
        ok: false,
        skipped: true,
        note: `could not read lifecycle config (HTTP ${res.status})`,
      };
    }
    const xml = await res.text();
    const rules = xml.match(/<Rule>/g)?.length ?? 0;
    if (rules === 0) return { ok: true, note: 'no lifecycle rules' };
    // Any rule at all is reported. Deciding which prefixes a rule matches from
    // its XML is exactly the kind of parsing that is wrong in the one case
    // that matters, so this reports rather than adjudicates.
    return {
      ok: false,
      note: `${rules} lifecycle rule(s) on this bucket — confirm none can expire assets/`,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: true,
      note: `lifecycle check failed: ${err.message.slice(0, 100)}`,
    };
  }
}

/** A backup nobody has restored is a hypothesis. Runs the real drill. */
async function verifyRestoreDrill(config) {
  if (!config.s3) return { ok: false, skipped: true, note: 'no backup target configured' };
  // The drill needs the hub's own data dir, which lives inside the container.
  // Deliberately left to the operator's `maude hub restore-drill` rather than
  // reaching into a volume from out here: a half-run drill that reports
  // success is worse than an honest skip, and this is the one check whose
  // whole point is that somebody actually did it.
  return {
    ok: false,
    skipped: true,
    note: 'run `maude hub restore-drill` against this deployment — it needs the hub data dir',
  };
}

/** Retry a flaky-at-startup operation. Rethrows the LAST error, so the
 *  reported cause is the real one rather than "timed out". */
async function retry(fn, { attempts, delayMs }) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      // A definitive answer from the service is not worth retrying — only the
      // "not listening yet" shape is.
      if (!/fetch failed|ECONNREFUSED|socket hang up/i.test(err.message)) throw err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

async function tryFetch(url, init) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      return res.ok ? { ok: true } : { ok: false, note: `HTTP ${res.status}` };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return { ok: false, note: err.name === 'AbortError' ? 'timed out' : 'unreachable' };
  }
}

function printDryRun({ config, outDir, files, plan, duties, reusedSecret }) {
  process.stdout.write(
    `maude hub workspace-up — DRY RUN, nothing was written\n\n` +
      `  workspace   ${workspaceBaseUrl(config)}${config.local ? '  (LOCAL — plain HTTP)' : ''}\n` +
      `  first user  ${config.adminEmail}\n` +
      `  storage     ${config.s3 ? `${config.s3.bucket} @ ${config.s3.endpoint}${config.s3.dev ? ' (dev MinIO)' : ''}` : 'none — media stays in git'}\n` +
      `  project     ${config.seedRepo ?? 'starts fresh'}\n` +
      `  image       ghcr.io/1agh/maude-hub:${config.imageTag}\n` +
      `  out         ${outDir}\n` +
      (reusedSecret ? '  secrets     reusing HUB_SECRET from the existing .env\n' : '') +
      '\nWould write:\n'
  );
  for (const f of files) {
    process.stdout.write(
      `  ${f.name.padEnd(20)} ${Buffer.byteLength(f.body)} bytes  mode ${f.mode.toString(8)}\n`
    );
  }
  process.stdout.write('\nWould then verify:\n');
  for (const s of plan) process.stdout.write(`  • ${s.title} — ${s.detail}\n`);
  printDuties(duties);
}

function printDuties(duties) {
  process.stdout.write(
    '\nThis command scaffolded and verified your workspace once. It does not\noperate it. What stays yours:\n\n'
  );
  for (const d of duties) {
    process.stdout.write(`  ${d.title}\n      ${d.detail}\n`);
  }
}
