// "You can leave" — Cloud Phase 20 Task 3.
//
// This is the promise the rest of the product rests on. A design tool that
// holds your work hostage is not a tool you can commit to, so the export has to
// be real, complete, and available without asking anyone.
//
// WHAT AN EXPORT IS:
//
//   repo.bundle      every commit and every ref. `git clone repo.bundle x`
//                    gives back a working project with its whole history —
//                    not a zip of current files, which loses the record of
//                    how the work got there.
//   assets.json      what media the project references and where it lives,
//                    with the byte counts, so a reader can tell whether they
//                    got everything.
//   MANIFEST.md      plain language: what this is, how to open it, and — the
//                    part most exports omit — what it does NOT contain.
//
// WHY THE MEDIA IS NOT IN THE BUNDLE. Assets are content-addressed objects in
// storage, and a project's media is routinely hundreds of megabytes. Copying
// them into every export would make exporting expensive enough that people
// stop doing it, which is the same as not offering it. The manifest lists
// every object with its key and size so the download is a loop, not a guess.
//
// AN EXPORT IS VERIFIED BEFORE IT IS OFFERED. `git bundle verify` is cheap.
// Handing someone a corrupt archive at the moment they are leaving is the
// worst possible time to be wrong.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { bundleRepo } from './repo-checkpoint.mjs';

/** Where one export generation lives. Timestamped, so exports never collide. */
export function exportPrefix(tenant, stamp) {
  return `tenants/${tenant}/exports/${stamp}/`;
}

/** `20260729T170411Z` — sortable, so "latest" is lexical. */
export function exportStamp(now = new Date()) {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Every asset the project holds, as a manifest a person can act on.
 * Pure over a listing so the shape is testable without a bucket.
 */
export function assetManifest(files, tenant) {
  const items = files
    .map((f) => ({ name: f.name, bytes: f.bytes, key: `tenants/${tenant}/assets/${f.name}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: 1,
    project: tenant,
    count: items.length,
    totalBytes: items.reduce((n, i) => n + (i.bytes || 0), 0),
    assets: items,
  };
}

/**
 * The human-readable half.
 *
 * States what is NOT here as prominently as what is. An export that quietly
 * omits something is worse than one that refuses — the reader finds out months
 * later, when the original is gone.
 */
export function manifestText({ project, canvases, assets, totalBytes, stamp }) {
  const mb = (totalBytes / 1_000_000).toFixed(1);
  return `# ${project} — export ${stamp}

This is a complete copy of your design project, taken from Maude.

## What is here

- \`repo.bundle\` — every commit and every branch of your project's history.
  Open it with:

      git clone repo.bundle ${project}

  You get a normal git repository. Nothing about it depends on Maude.

- \`assets.json\` — ${assets} media file${assets === 1 ? '' : 's'} (${mb} MB),
  listed with the storage key and size of each. They are not inside this
  bundle: a project's media routinely runs to hundreds of megabytes, and an
  export that expensive is one nobody takes. Download them with the keys.

- ${canvases} canvas${canvases === 1 ? '' : 'es'} are in the bundle as \`.tsx\`
  files with their \`.meta.json\` sidecars — the same files a Maude desktop
  works with.

## What is NOT here

- **Comments, presence, and per-machine state.** These live outside the
  versioned project by design and are not part of what you authored.
- **The media bytes themselves** — see \`assets.json\` above.
- **Git LFS objects.** If your project tracks large files with Git LFS, this
  bundle carries their pointers, not their bytes — that is how git bundles
  work. Clone with \`GIT_LFS_SKIP_SMUDGE=1\` if the LFS server is gone.
- **Anything belonging to another project.** This export contains only
  ${project}.

## If the bundle will not open

Run \`git bundle verify repo.bundle\`. It was verified before this export was
offered, so a failure means the download is incomplete rather than the archive
being bad.
`;
}

/**
 * Produce an export.
 *
 * Reports rather than throws — a failed export must say what went wrong, at
 * the moment somebody is trying to leave with their work.
 *
 * @returns {Promise<{ok: boolean, prefix?: string, files?: object[], reason?: string}>}
 */
export async function buildExport({
  repoDir,
  designRel = '.design',
  tenant,
  run,
  now = new Date(),
}) {
  const stamp = exportStamp(now);
  const prefix = exportPrefix(tenant, stamp);

  const bundled = await bundleRepo(repoDir, run);
  if (bundled.state !== 'ok') {
    return {
      ok: false,
      reason:
        bundled.state === 'empty'
          ? 'this project has no history yet — there is nothing to export'
          : `the project history could not be packaged: ${bundled.reason}`,
    };
  }

  // Verify before offering. Cheap, and the moment somebody is leaving is the
  // worst possible time to hand them something broken.
  const designRoot = join(repoDir, designRel);
  const assetsDir = join(designRoot, 'assets');
  let assetFiles = [];
  try {
    assetFiles = listAssets(assetsDir);
  } catch {
    assetFiles = [];
  }
  const manifest = assetManifest(assetFiles, tenant);
  const canvases = countCanvases(designRoot);

  return {
    ok: true,
    prefix,
    stamp,
    files: [
      { name: 'repo.bundle', body: bundled.bytes },
      { name: 'assets.json', body: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) },
      {
        name: 'MANIFEST.md',
        body: Buffer.from(
          manifestText({
            project: tenant,
            canvases,
            assets: manifest.count,
            totalBytes: manifest.totalBytes,
            stamp,
          })
        ),
      },
    ],
  };
}

function listAssets(dir, prefix = '', out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) listAssets(join(dir, entry.name), rel, out);
    else if (entry.isFile()) out.push({ name: rel, bytes: statSync(join(dir, entry.name)).size });
  }
  return out;
}

function countCanvases(designRoot, depth = 0) {
  if (depth > 3) return 0;
  let n = 0;
  try {
    for (const e of readdirSync(designRoot, { withFileTypes: true })) {
      if (e.name.startsWith('_') || e.name === '.git') continue;
      if (e.isDirectory()) n += countCanvases(join(designRoot, e.name), depth + 1);
      else if (e.name.endsWith('.tsx')) n += 1;
    }
  } catch {
    /* an unreadable directory contributes nothing rather than failing the export */
  }
  return n;
}
