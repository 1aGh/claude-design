#!/usr/bin/env node
// Generate a synthetic `.design/` with the SHAPE of a large real project.
//
// WHY THIS EXISTS. Every defect in feature-large-project-seed only appears at
// scale: the request ceiling needs >200 paths to bite, the hourly write quota
// needs >2 GiB, the doručenka's unbounded map needs thousands of rows before
// its cost shows, and the door's 95 MB ceiling needs a file that exceeds it.
// The only project that reproduced all of them is 8.8 GB and 47 751 files, so
// "run it against alligators" was the entire test plan — which meant the
// regression surface was one person's laptop.
//
// SPARSE BY DEFAULT. The bytes are allocated, not written: a 3 GB fixture
// costs a few hundred milliseconds and almost no disk on APFS/ext4, because
// nothing here needs the content to be anything in particular. Pass
// `--real-bytes` when a test genuinely needs them materialised (hashing
// throughput, compression), and expect it to be slow.
//
// Deliberately NOT a `maude design` verb: it is a test fixture generator, and
// putting it on the user-facing surface would invite someone to run it at a
// real project. Internal, like `_screenshot-playwright.mjs`.
//
// Usage:
//   node apps/studio/bin/_seed-fixture.mjs --out /tmp/big --files 3000 --bytes 2GB
//   node apps/studio/bin/_seed-fixture.mjs --out /tmp/big --files 50 --bytes 10MB --real-bytes

import {
  closeSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

function parseBytes(raw) {
  const m = String(raw ?? '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!m) return null;
  const mult = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m[2] ?? 'B').toLowerCase()];
  return Math.round(Number(m[1]) * mult);
}

function parseArgs(argv) {
  const out = { files: 3000, bytes: 2 * 1024 ** 3, out: null, realBytes: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--files') out.files = Number(argv[++i]);
    else if (a === '--bytes') out.bytes = parseBytes(argv[++i]);
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--real-bytes') out.realBytes = true;
    else if (a === '--force') out.force = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.out || !Number.isFinite(args.files) || args.files < 1 || !Number.isFinite(args.bytes)) {
  process.stderr.write(
    'usage: _seed-fixture.mjs --out <dir> [--files N] [--bytes 2GB] [--real-bytes] [--force]\n'
  );
  process.exit(2);
}

// REFUSE TO WRITE INTO SOMETHING THAT LOOKS REAL. This generator creates and
// deletes a `.design/` tree; pointing it at a project by accident would be
// unrecoverable, and `--force` is the only way past.
const root = args.out;
const designRoot = join(root, '.design');
if (!args.force && !/(^\/tmp\/|^\/private\/tmp\/|fixture|scratch)/.test(root)) {
  process.stderr.write(
    `refusing to generate into ${root} — it does not look like a scratch path.\n` +
      'Use a path under /tmp, or one containing "fixture"/"scratch", or pass --force.\n'
  );
  process.exit(2);
}
rmSync(designRoot, { recursive: true, force: true });

/** Allocate a file of `size` without writing `size` bytes. */
function makeFile(abs, size, real) {
  if (real) {
    // A repeating pattern rather than zeros, so a compression-sensitive test
    // is not accidentally measuring a best case.
    const chunk = Buffer.alloc(Math.min(size, 1 << 20), 0);
    for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 31) & 0xff;
    const fd = openSync(abs, 'w');
    let left = size;
    while (left > 0) {
      const n = Math.min(left, chunk.length);
      writeSync(fd, chunk, 0, n);
      left -= n;
    }
    closeSync(fd);
    return;
  }
  const fd = openSync(abs, 'w');
  ftruncateSync(fd, size); // sparse — allocated, not written
  closeSync(fd);
}

const dirs = [
  'system/fixture-ds/assets/photos',
  'system/fixture-ds/assets/photos-cut',
  'system/fixture-ds/assets/video',
  'system/fixture-ds/assets/graphics',
  'system/fixture-ds/preview',
  'ui',
];
for (const d of dirs) mkdirSync(join(designRoot, d), { recursive: true });

writeFileSync(
  join(designRoot, 'config.json'),
  `${JSON.stringify({ designSystems: ['fixture-ds'], canvasGroups: [{ path: 'ui' }] }, null, 2)}\n`
);

// The canvas layer — small, numerous, and the part a real project actually
// edits. Kept to ~2 % of the file count, matching the observed ratio
// (149 .tsx against 4 237 .jpg).
const canvasCount = Math.max(1, Math.round(args.files * 0.02));
for (let i = 0; i < canvasCount; i++) {
  writeFileSync(
    join(designRoot, 'ui', `screen-${i}.tsx`),
    `export default function Screen${i}() {\n  return null;\n}\n`
  );
  writeFileSync(
    join(designRoot, 'ui', `screen-${i}.meta.json`),
    `${JSON.stringify({ title: `Screen ${i}`, status: 'draft' })}\n`
  );
}

// The asset bulk. Sizes are drawn deterministically around the observed
// distribution (0.5–3 MB stills), so a run is reproducible.
const assetCount = Math.max(0, args.files - canvasCount * 2);
let remaining = args.bytes;
let made = 0;
const folders = ['photos', 'photos-cut', 'graphics'];
for (let i = 0; i < assetCount && remaining > 0; i++) {
  const folder = folders[i % folders.length];
  const share = Math.max(1024, Math.round(remaining / (assetCount - i)));
  const size = Math.min(remaining, share);
  makeFile(join(designRoot, 'system/fixture-ds/assets', folder, `a${i}.jpg`), size, args.realBytes);
  remaining -= size;
  made += 1;
}

// TWO FILES OVER THE DOOR'S 95 MB CEILING, because that is the case with no
// backoff answer — the real project has exactly two (164.9 MB, 465.8 MB) and
// they are what proved the client and the door disagreed about the limit.
const over = [
  ['system/fixture-ds/assets/video/over-cap-1.mp4', 165 * 1024 ** 2],
  ['system/fixture-ds/assets/video/over-cap-2.mp4', 466 * 1024 ** 2],
];
for (const [rel, size] of over) makeFile(join(designRoot, rel), size, args.realBytes);

const totalFiles = canvasCount * 2 + made + over.length;
process.stdout.write(
  `${designRoot}\n` +
    `  ${totalFiles} files · ${(args.bytes / 1024 ** 3).toFixed(2)} GB nominal` +
    `${args.realBytes ? ' (materialised)' : ' (sparse)'}\n` +
    `  ${canvasCount} canvases · ${made} assets · ${over.length} over the 95 MB door ceiling\n`
);
