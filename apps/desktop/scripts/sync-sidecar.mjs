#!/usr/bin/env node
// Copy the compiled dev-server platform binary into the Tauri sidecar location
// with the target-triple name Tauri's `externalBin` requires.
//
// DDR-106: the dev-server ships as `maude` inside a `maude-<slug>/` dir (DDR-084),
// or is built to `apps/studio/dist/maude-<slug>`. Tauri sidecars must be named
// `<name>-<target-triple>`. This script bridges the two naming schemes so
// `app.shell().sidecar("maude-server")` resolves at dev + build time.
//
// Wired as `beforeBuildCommand` in tauri.conf.json; run manually for `tauri dev`
// after a fresh checkout. CI (Task 7) runs it per-platform before `tauri build`.

import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..'); // apps/desktop/scripts → repo root
const BIN_DIR = resolve(SCRIPT_DIR, '..', 'src-tauri', 'binaries');

// Mirrors cli/commands/design.mjs:detectPlatformSlug (host-only; musl detection
// is omitted here — CI builds set the slug explicitly per matrix leg).
function detectSlug() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (p === 'win32') return 'win32-x64';
  if (p === 'linux') return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return null;
}

// Platform slug → Rust/Tauri target triple (DDR-106 table).
const TRIPLE = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64-musl': 'x86_64-unknown-linux-musl',
  'linux-arm64-musl': 'aarch64-unknown-linux-musl',
  'win32-x64': 'x86_64-pc-windows-msvc',
};

const slug = process.env.MAUDE_SIDECAR_SLUG || detectSlug();
if (!slug || !TRIPLE[slug]) {
  console.error(`[sync-sidecar] unsupported platform slug: ${slug}`);
  process.exit(1);
}

const triple = TRIPLE[slug];
const exe = slug.startsWith('win32') ? '.exe' : '';

// Source: prefer the local build output, fall back to the installed platform pkg.
const candidates = [
  join(REPO_ROOT, 'apps', 'studio', 'dist', `maude-${slug}${exe}`),
  join(REPO_ROOT, 'node_modules', '@1agh', `maude-${slug}`, `maude${exe}`),
  join(REPO_ROOT, 'packages', `maude-${slug}`, `maude${exe}`),
];
const src = candidates.find((p) => existsSync(p));
if (!src) {
  console.error('[sync-sidecar] no dev-server binary found. Looked in:');
  for (const c of candidates) console.error(`  - ${c}`);
  console.error('Build it first: cd apps/studio && bun run build:binary');
  process.exit(1);
}

const dest = join(BIN_DIR, `maude-server-${triple}${exe}`);
mkdirSync(BIN_DIR, { recursive: true });
copyFileSync(src, dest);
if (!exe) chmodSync(dest, 0o755);
console.log(`[sync-sidecar] ${src}\n            → ${dest}`);
