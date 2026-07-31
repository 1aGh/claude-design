// `maude share` — publish a read-only view of a project. Cloud Phase 18.
//
// The effects half; every decision lives in cli/lib/share-plan.mjs.
//
// RENDERING HAPPENS HERE, ON THIS MACHINE. That is the containment invariant
// (DDR-193 §2, narrowed by DDR-197), not an implementation detail: the vendor
// serves finished pictures it never produced and never interprets. Moving this
// to the server would be a one-line convenience that deletes the guarantee.
//
//   maude share publish --project alligators --from <dir> [--name "Brno Alligators"]
//   maude share off     --project alligators
//
// `--from` is a directory of screenshots — typically what `maude design smoke
// --out-dir <dir>` just wrote, which is already one PNG per canvas.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseArgs } from '../lib/argv.mjs';
import { publishPlan, publishSummary, shareMarker, validProjectId } from '../lib/share-plan.mjs';

export function usage() {
  return `maude share <publish|off> [options]

  Publish a read-only view of a design project, so someone can look at it in a
  browser without installing anything.

  publish   upload the pictures in --from and turn sharing ON
  off       turn sharing off (the pictures stay; nothing serves them)

  --project ID       the project (lowercase, hyphens)
  --from DIR         directory of screenshots to publish (publish only)
  --name "Title"     what the view calls itself (default: the project id)
  --zone HOST        default cloud.maude.sh
  --dry-run          print the plan, upload nothing
  --json             machine-readable result

  Storage credentials come from the environment:
    MAUDE_R2_ENDPOINT  MAUDE_R2_ACCESS_KEY_ID  MAUDE_R2_SECRET_ACCESS_KEY
    MAUDE_R2_BUCKET    (default maude-cloud-assets)

  The pictures are taken on THIS machine and uploaded as finished images. The
  shared view never renders anything — that is what makes it safe to hand to
  someone who is not on your team.
`;
}

/** Every file under `dir`, relative to it. */
function listFiles(dir, prefix = '', out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) listFiles(join(dir, entry.name), rel, out);
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function s3ConfigFromEnv(env = process.env) {
  const missing = [
    'MAUDE_R2_ENDPOINT',
    'MAUDE_R2_ACCESS_KEY_ID',
    'MAUDE_R2_SECRET_ACCESS_KEY',
  ].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `object storage is not configured — missing ${missing.join(', ')}.\n` +
        'A publish needs somewhere to put the pictures.'
    );
  }
  return {
    endpoint: env.MAUDE_R2_ENDPOINT,
    bucket: env.MAUDE_R2_BUCKET ?? 'maude-cloud-assets',
    accessKeyId: env.MAUDE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.MAUDE_R2_SECRET_ACCESS_KEY,
    region: 'auto',
  };
}

async function loadS3(pkgRoot) {
  for (const candidate of [
    resolve(pkgRoot, 'apps/hub/src/s3.mjs'),
    resolve(pkgRoot, '../apps/hub/src/s3.mjs'),
  ]) {
    const mod = await import(`file://${candidate}`).catch(() => null);
    if (mod) return mod;
  }
  throw new Error('the storage client (apps/hub/src/s3.mjs) was not found in this install');
}

export async function run({ args, pkgRoot }) {
  const { positional, flags } = parseArgs(args, { booleans: ['help', 'dry-run', 'json'] });
  const sub = positional[0];
  if (flags.help || !sub) {
    process.stdout.write(usage());
    return;
  }

  const project = validProjectId(flags.project);
  if (!project) {
    process.stderr.write(
      'maude share: --project is required (lowercase letters, digits, hyphens)\n'
    );
    process.exit(2);
  }
  const zone = String(flags.zone ?? 'cloud.maude.sh');

  if (sub === 'off') {
    const s3 = await loadS3(pkgRoot);
    const marker = shareMarker(project, { enabled: false, name: flags.name });
    if (flags['dry-run']) {
      process.stdout.write(`Would turn sharing OFF for ${project}.\n`);
      return;
    }
    await s3.putObject(s3ConfigFromEnv(), marker.key, Buffer.from(marker.body));
    process.stdout.write(
      `Sharing is off for ${project}. The link no longer shows anything.\n` +
        'The pictures are still in storage — nothing serves them.\n'
    );
    return;
  }

  if (sub !== 'publish') {
    process.stderr.write(`maude share: unknown command "${sub}"\n`);
    process.exit(2);
  }

  const from = flags.from ? resolve(String(flags.from)) : null;
  if (!from) {
    process.stderr.write('maude share publish: --from <dir> is required\n');
    process.exit(2);
  }
  try {
    if (!statSync(from).isDirectory()) throw new Error('not a directory');
  } catch {
    process.stderr.write(`maude share publish: ${from} is not a directory\n`);
    process.exit(2);
  }

  const { uploads, skipped } = publishPlan(listFiles(from), project);
  if (uploads.length === 0) {
    process.stderr.write(
      `maude share publish: nothing to publish in ${from}.\n` +
        'The shared view serves PNG, JPEG, WebP and AVIF. Take screenshots first\n' +
        '(`maude design smoke --out-dir <dir>` writes one per canvas).\n'
    );
    process.exit(1);
  }

  if (flags['dry-run']) {
    process.stdout.write(`Would publish ${uploads.length} file(s) for ${project}:\n`);
    for (const u of uploads.slice(0, 20)) process.stdout.write(`  ${u.from} → ${u.key}\n`);
    if (uploads.length > 20) process.stdout.write(`  …and ${uploads.length - 20} more\n`);
    if (skipped.length) process.stdout.write(`Would skip ${skipped.length} unshareable file(s).\n`);
    return;
  }

  const s3 = await loadS3(pkgRoot);
  const cfg = s3ConfigFromEnv();
  let uploaded = 0;
  const failed = [];
  for (const u of uploads) {
    try {
      await s3.putObject(cfg, u.key, readFileSync(join(from, u.from)));
      uploaded += 1;
    } catch (err) {
      failed.push({ file: u.from, reason: err.message.slice(0, 120) });
    }
  }

  // The marker goes LAST. Its presence is what turns sharing on, so writing it
  // first would expose a half-published gallery — the same reasoning as the
  // backup manifest.
  const marker = shareMarker(project, { enabled: true, name: flags.name });
  await s3.putObject(cfg, marker.key, Buffer.from(marker.body));

  if (flags.json) {
    process.stdout.write(
      `${JSON.stringify({ ok: failed.length === 0, project, uploaded, skipped: skipped.length, failed, url: `https://view-${project}.${zone}` }, null, 2)}\n`
    );
    return;
  }
  process.stdout.write(`${publishSummary({ project, uploaded, skipped: skipped.length, zone })}\n`);
  if (failed.length) {
    process.stderr.write(`\n${failed.length} file(s) failed to upload:\n`);
    for (const f of failed.slice(0, 5)) process.stderr.write(`  ${f.file} — ${f.reason}\n`);
    process.exit(1);
  }
}
