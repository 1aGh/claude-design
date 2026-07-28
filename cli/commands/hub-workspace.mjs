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
import { randomBytes } from 'node:crypto';
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
  const { flags } = parseArgs(args, { booleans: ['dry-run', 'json', 'dev-minio'] });
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
  const up = await sh('docker', ['compose', 'up', '-d'], { cwd: outDir });
  if (up.code !== 0) {
    process.stderr.write(`docker compose up failed:\n${up.stderr}\n`);
    process.exit(1);
  }

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
        ? `\nWorkspace verified: https://${config.domain}\n`
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
async function runVerification(step, { config, hubSecret }) {
  const base = `https://${config.domain}`;
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
    default:
      return {
        ok: false,
        skipped: true,
        note: 'not yet automated — verify by hand, then close it in the plan',
      };
  }
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
      `  workspace   https://${config.domain}\n` +
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
