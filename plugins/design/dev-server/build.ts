#!/usr/bin/env bun
// Build orchestrator for the dev-server.
//
// Three steps (run on demand):
//   (a) Client JSX bundle:  client/app.jsx + React 19  ->  dist/client.bundle.js (IIFE, tree-shaken).
//   (b) CSS bundle:         client/styles/_index.css (Lightning CSS, @layer, OKLCH fallback).
//   (c) Server binary:      server.ts  ->  dist/mdcc-<platform>  (bun build --compile, per-platform).
//
// Modes:
//   bun run build.ts                       -> dev build for current platform (no compile, no minify)
//   bun run build.ts --release             -> release build for all platforms in the matrix
//   bun run build.ts --release --target=bun-darwin-arm64
//   bun run build.ts --watch               -> watch client + CSS; broadcast over HMR socket
//   bun run build.ts --dry-run             -> exit 0 without writing files (smoke for CI / Task 2 validation)
//
// Per DDR-009 (Bun runtime authoritative) + DDR-012 (React 19 unified) + DDR-014 (Lightning CSS).

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browserslistToTargets, bundle as lcssBundle } from 'lightningcss';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');

const ARGS = new Set(process.argv.slice(2));
const FLAG_TARGET = process.argv.find((a) => a.startsWith('--target='))?.slice('--target='.length);
const MODE: 'dev' | 'release' | 'dry' = ARGS.has('--dry-run')
  ? 'dry'
  : ARGS.has('--release')
    ? 'release'
    : 'dev';
const WATCH = ARGS.has('--watch');

const PLATFORM_MATRIX = [
  'bun-darwin-arm64',
  'bun-darwin-x64',
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-linux-x64-musl',
  'bun-linux-arm64-musl',
  'bun-windows-x64',
] as const;

type PlatformTarget = (typeof PLATFORM_MATRIX)[number];

function platformSlug(target: PlatformTarget): string {
  // bun calls Windows "windows"; npm and process.platform call it "win32".
  // Sub-package directories + the build-binaries.yml matrix slug use win32-x64.
  const s = target.replace(/^bun-/, '');
  return s === 'windows-x64' ? 'win32-x64' : s;
}

function currentTarget(): PlatformTarget {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') return a === 'arm64' ? 'bun-darwin-arm64' : 'bun-darwin-x64';
  if (p === 'linux') return a === 'arm64' ? 'bun-linux-arm64' : 'bun-linux-x64';
  if (p === 'win32') return 'bun-windows-x64';
  throw new Error(`Unsupported host platform: ${p}-${a}`);
}

function ensureDist() {
  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });
}

// ---------- (a) Client JSX bundle ----------

async function buildClient(): Promise<{ outBytes: number; outPath: string }> {
  ensureDist();
  const outPath = join(DIST, 'client.bundle.js');
  // Read package.json version at build time for the wordmark sub-line.
  const pkg = JSON.parse(await Bun.file(join(ROOT, '..', '..', '..', 'package.json')).text());
  const result = await Bun.build({
    entrypoints: [join(ROOT, 'client/app.jsx')],
    outdir: DIST,
    target: 'browser',
    // ESM — not IIFE. Bun.build's IIFE + full minify + React 19 hits a TDZ
    // bug (`Cannot access 'VZ' before initialization`) because top-level
    // `const`s get rotated past their declaration. ESM has stable hoisting
    // semantics the minifier respects. Cost: `<script type="module">` in
    // index.html (already set).
    format: 'esm',
    naming: 'client.bundle.js',
    minify: MODE === 'release',
    sourcemap: MODE === 'dev' ? 'inline' : 'none',
    define: {
      'process.env.NODE_ENV': JSON.stringify(MODE === 'release' ? 'production' : 'development'),
      __MDCC_VERSION__: JSON.stringify(pkg.version),
    },
  });
  if (!result.success) {
    const messages = result.logs.map((l) => l.message ?? String(l)).join('\n');
    throw new Error(`Client build failed:\n${messages}`);
  }
  const out = Bun.file(outPath);
  return { outBytes: out.size, outPath };
}

// ---------- (b) CSS bundle (Lightning CSS) ----------

async function buildCss(): Promise<{ outBytes: number; outPath: string }> {
  ensureDist();
  const inputPath = join(ROOT, 'client/styles/_index.css');
  const outPath = join(DIST, 'styles.css');
  const { code } = lcssBundle({
    filename: inputPath,
    minify: MODE === 'release',
    sourceMap: false,
    targets: browserslistToTargets([
      'Chrome >= 110',
      'Safari >= 16',
      'Firefox >= 110',
      'Edge >= 110',
    ]),
    drafts: { customMedia: true },
  });
  await Bun.write(outPath, code);
  return { outBytes: code.byteLength, outPath };
}

// ---------- (c) Server binary (bun build --compile, per-platform) ----------

async function buildServerBinary(target: PlatformTarget): Promise<{ outPath: string }> {
  ensureDist();
  const slug = platformSlug(target);
  const ext = slug.startsWith('win32') ? '.exe' : '';
  const outPath = join(DIST, `mdcc-${slug}${ext}`);
  const entry = join(ROOT, 'server.ts');
  if (!existsSync(entry)) {
    // T7 not landed yet — fall back to the .mjs entry so this script remains runnable mid-migration.
    const legacy = join(ROOT, 'server.mjs');
    if (!existsSync(legacy)) throw new Error(`Neither server.ts nor server.mjs exists in ${ROOT}`);
    const proc = Bun.spawn(
      [
        'bun',
        'build',
        '--compile',
        `--target=${target}`,
        '--minify',
        '--sourcemap',
        `--outfile=${outPath}`,
        legacy,
      ],
      { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' }
    );
    const code = await proc.exited;
    if (code !== 0)
      throw new Error(`bun build --compile (legacy) failed for ${target} (exit ${code})`);
    return { outPath };
  }
  const proc = Bun.spawn(
    [
      'bun',
      'build',
      '--compile',
      `--target=${target}`,
      '--minify',
      '--sourcemap',
      '--smol',
      `--outfile=${outPath}`,
      entry,
    ],
    { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' }
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`bun build --compile failed for ${target} (exit ${code})`);
  return { outPath };
}

// ---------- Watch mode ----------

async function watch() {
  await buildClient();
  await buildCss();
  console.log('[build:watch] initial build complete; watching client/ + server source...');

  // Bun fs.watch is recursive on darwin/linux/win32.
  const fs = await import('node:fs');
  const seen = new Map<string, number>();
  const debounce = 50;

  const trigger = async (path: string) => {
    const now = Date.now();
    const last = seen.get(path) ?? 0;
    if (now - last < debounce) return;
    seen.set(path, now);
    try {
      if (path.endsWith('.css')) {
        const r = await buildCss();
        console.log(`[build:watch] CSS rebuilt (${r.outBytes} B)`);
        broadcastHmr({ type: 'css-update', path: '/_client/styles.css', hash: now });
      } else if (/\.(jsx|tsx|ts|mjs)$/.test(path)) {
        const r = await buildClient();
        console.log(`[build:watch] client rebuilt (${r.outBytes} B)`);
        broadcastHmr({ type: 'module-update', path: '/_client/client.bundle.js', hash: now });
      }
    } catch (err) {
      console.error('[build:watch] rebuild failed:', err);
    }
  };

  fs.watch(join(ROOT, 'client'), { recursive: true }, (_, filename) => {
    if (filename) void trigger(filename);
  });
}

// HMR notifications: the dev-server (server.ts) owns the WS endpoint; here we just POST a hint.
async function broadcastHmr(payload: object) {
  try {
    const port = Bun.env.MDCC_DEV_PORT ?? '4399';
    await fetch(`http://localhost:${port}/_hmr`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // server may not be running yet; ignore.
  }
}

// ---------- Orchestrate ----------

async function main() {
  if (MODE === 'dry') {
    console.log(`[build] --dry-run OK (mode=dry, target=${FLAG_TARGET ?? currentTarget()})`);
    return;
  }

  if (WATCH) {
    await watch();
    // Keep alive — fs.watch holds the event loop.
    await new Promise(() => {});
    return;
  }

  console.log(`[build] mode=${MODE}`);

  const t0 = performance.now();
  const client = await buildClient();
  const t1 = performance.now();
  console.log(
    `[build] client.bundle.js  ${client.outBytes.toLocaleString()} B  (${(t1 - t0).toFixed(0)} ms)`
  );

  const css = await buildCss();
  const t2 = performance.now();
  console.log(
    `[build] styles.css        ${css.outBytes.toLocaleString()} B  (${(t2 - t1).toFixed(0)} ms)`
  );

  if (MODE === 'release') {
    const targets: PlatformTarget[] = FLAG_TARGET
      ? [FLAG_TARGET as PlatformTarget]
      : [currentTarget()];
    for (const target of targets) {
      const t = performance.now();
      const bin = await buildServerBinary(target);
      console.log(`[build] ${bin.outPath}  (${(performance.now() - t).toFixed(0)} ms)`);
    }
  }
}

await main();

export { buildClient, buildCss, buildServerBinary, PLATFORM_MATRIX, type PlatformTarget };
