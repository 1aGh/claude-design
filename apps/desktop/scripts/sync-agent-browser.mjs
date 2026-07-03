#!/usr/bin/env node
// Stage the `agent-browser` platform binary into the Tauri sidecar location with
// the target-triple name `externalBin` requires — so the packaged `.app` ships a
// screenshot engine and `/design:*` critics can see artboards with ZERO install.
//
// agent-browser is a self-contained per-platform binary (~10 MB, no browser
// bundled — it drives a Chrome-family engine, provisioned separately as
// chrome-headless-shell via apps/studio/bin/ensure-browser.mjs). We ship just the
// current build platform's binary as `binaries/agent-browser-<triple>`; Tauri
// signs it for macOS notarization (a plain resource binary wouldn't be signed).
//
// Wired as `beforeBuildCommand` / `beforeDevCommand` in tauri.conf.json (next to
// sync-sidecar + stage-resources); CI runs it per-platform before `tauri build`.

import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..'); // apps/desktop/scripts → repo root
const BIN_DIR = resolve(SCRIPT_DIR, '..', 'src-tauri', 'binaries');

// Host platform slug (CI legs set MAUDE_SIDECAR_SLUG explicitly per matrix leg —
// reuse the same var so the two sync scripts stage the SAME platform).
function detectSlug() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  if (p === 'win32') return 'win32-x64';
  if (p === 'linux') return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
  return null;
}

// Maude slug → Rust/Tauri target triple (DDR-106 table, mirrors sync-sidecar).
const TRIPLE = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'linux-x64-musl': 'x86_64-unknown-linux-musl',
  'linux-arm64-musl': 'aarch64-unknown-linux-musl',
  'win32-x64': 'x86_64-pc-windows-msvc',
};

// Maude slug → agent-browser binary slug (its bin/ uses `linux-musl-<arch>`, not
// `linux-<arch>-musl`).
const AB_SLUG = {
  'darwin-arm64': 'darwin-arm64',
  'darwin-x64': 'darwin-x64',
  'linux-x64': 'linux-x64',
  'linux-arm64': 'linux-arm64',
  'linux-x64-musl': 'linux-musl-x64',
  'linux-arm64-musl': 'linux-musl-arm64',
  'win32-x64': 'win32-x64',
};

const slug = process.env.MAUDE_SIDECAR_SLUG || detectSlug();
if (!slug || !TRIPLE[slug] || !AB_SLUG[slug]) {
  console.error(`[sync-agent-browser] unsupported platform slug: ${slug}`);
  process.exit(1);
}

const triple = TRIPLE[slug];
const exe = slug.startsWith('win32') ? '.exe' : '';
const abBin = `agent-browser-${AB_SLUG[slug]}${exe}`;

// Locate the agent-browser package (a devDependency of @maude/desktop). Resolve
// from the repo, then fall back to a globally-installed copy (dev convenience).
function resolveAbBinDir() {
  const req = createRequire(import.meta.url);
  const candidates = [];
  try {
    candidates.push(dirname(req.resolve('agent-browser/package.json')));
  } catch {
    /* not resolvable from here — try node_modules layouts */
  }
  candidates.push(
    join(REPO_ROOT, 'node_modules', 'agent-browser'),
    join(SCRIPT_DIR, '..', 'node_modules', 'agent-browser')
  );
  for (const c of candidates) {
    if (existsSync(join(c, 'bin', abBin))) return join(c, 'bin');
  }
  return null;
}

const abBinDir = resolveAbBinDir();
if (!abBinDir) {
  console.error(`[sync-agent-browser] agent-browser binary not found (${abBin}).`);
  console.error('Add it as a devDependency of @maude/desktop and run `pnpm install`:');
  console.error('  pnpm --filter @maude/desktop add -D agent-browser');
  process.exit(1);
}

const src = join(abBinDir, abBin);
const dest = join(BIN_DIR, `agent-browser-${triple}${exe}`);
mkdirSync(BIN_DIR, { recursive: true });
copyFileSync(src, dest);
if (!exe) chmodSync(dest, 0o755);
console.log(`[sync-agent-browser] ${src}\n                 → ${dest}`);
