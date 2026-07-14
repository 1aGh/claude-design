#!/usr/bin/env node
// Compile `maude` (the CLI, cli/bin/maude.mjs) into a standalone binary for
// the Tauri sidecar `externalBin` (DDR-166 T0b). Mirrors sync-sidecar.mjs's
// platform-slug → target-triple table and naming convention.
//
// Unlike the dev-server binary (apps/studio/build.ts's buildServerBinary),
// the CLI doesn't touch oxc-parser — checkDevDeps only probes it via
// require.resolve at runtime, never imports it at bundle time — so this
// needs none of DDR-042's NAPI-binding-embed workaround. A plain
// `bun build --compile` is sufficient.
//
// Host-only (compiles for the CURRENT platform, like sync-sidecar.mjs's own
// detectSlug — this repo doesn't yet cross-compile the CLI in CI; each
// platform leg is expected to run this on its own runner, same as the
// dev-server binary's per-platform build).

import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..'); // apps/desktop/scripts → repo root
const BIN_DIR = resolve(SCRIPT_DIR, '..', 'src-tauri', 'binaries');
const ENTRY = join(REPO_ROOT, 'cli', 'bin', 'maude.mjs');

function detectSlug() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (p === 'win32') return 'win32-x64';
  if (p === 'linux') return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return null;
}

// Platform slug → { Rust/Tauri target triple, `bun build --target` value }.
const TARGETS = {
  'darwin-arm64': { triple: 'aarch64-apple-darwin', bun: 'bun-darwin-arm64' },
  'darwin-x64': { triple: 'x86_64-apple-darwin', bun: 'bun-darwin-x64' },
  'linux-x64': { triple: 'x86_64-unknown-linux-gnu', bun: 'bun-linux-x64' },
  'linux-arm64': { triple: 'aarch64-unknown-linux-gnu', bun: 'bun-linux-arm64' },
  'win32-x64': { triple: 'x86_64-pc-windows-msvc', bun: 'bun-windows-x64' },
};

const slug = process.env.MAUDE_SIDECAR_SLUG || detectSlug();
const target = slug && TARGETS[slug];
if (!target) {
  console.error(`[build-cli-binary] unsupported platform slug: ${slug}`);
  process.exit(1);
}

if (!existsSync(ENTRY)) {
  console.error(`[build-cli-binary] entry not found: ${ENTRY}`);
  process.exit(1);
}

const exe = slug.startsWith('win32') ? '.exe' : '';
const outPath = join(BIN_DIR, `maude-${target.triple}${exe}`);
mkdirSync(BIN_DIR, { recursive: true });

const proc = Bun.spawn(
  [
    'bun',
    'build',
    '--compile',
    `--target=${target.bun}`,
    '--minify',
    `--outfile=${outPath}`,
    ENTRY,
  ],
  { cwd: REPO_ROOT, stdout: 'inherit', stderr: 'inherit' }
);
const code = await proc.exited;
if (code !== 0) {
  console.error(`[build-cli-binary] bun build --compile failed (exit ${code})`);
  process.exit(1);
}
if (!exe) chmodSync(outPath, 0o755);
console.log(`[build-cli-binary] cli/bin/maude.mjs\n                 → ${outPath}`);
