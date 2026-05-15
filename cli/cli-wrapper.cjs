#!/usr/bin/env node
/* eslint-disable */
// Safe-mode entry. Exposed as the `mdcc-safe` bin in main package.json.
//
// Used when postinstall was skipped (`npm install --ignore-scripts`) or when
// the hardlink failed for some reason. Performs platform detection on every
// invocation, then spawnSyncs the matching sub-package binary. Slower than
// the hardlinked path but always works.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function detectSlug() {
  const p = process.platform;
  const a = process.arch;
  if (p === 'darwin') {
    if (a === 'arm64') return 'darwin-arm64';
    try {
      const t = spawnSync('sysctl', ['-n', 'sysctl.proc_translated'], { encoding: 'utf8' });
      if (t.stdout?.trim() === '1') return 'darwin-arm64';
    } catch {
      /* not Rosetta */
    }
    return 'darwin-x64';
  }
  if (p === 'linux') {
    const report = process.report?.getReport?.();
    const isMusl = !report?.header?.glibcVersionRuntime;
    if (a === 'arm64') return isMusl ? 'linux-arm64-musl' : 'linux-arm64';
    return isMusl ? 'linux-x64-musl' : 'linux-x64';
  }
  if (p === 'win32') return 'win32-x64';
  throw new Error(`Unsupported platform: ${p}-${a}`);
}

function resolveBinary(slug) {
  const filename = process.platform === 'win32' ? 'mdcc.exe' : 'mdcc';
  const pkg = `@1agh/md-claude-${slug}`;
  try {
    const manifest = require.resolve(`${pkg}/package.json`);
    return path.join(path.dirname(manifest), filename);
  } catch {
    return null;
  }
}

function main() {
  const slug = detectSlug();
  const bin = resolveBinary(slug);
  if (!bin || !fs.existsSync(bin)) {
    console.error(
      `mdcc-safe: missing @1agh/md-claude-${slug}. ` +
        'Reinstall without --ignore-scripts: `npm i -g @1agh/md-claude`.',
    );
    process.exit(1);
  }
  const res = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit' });
  if (res.error) {
    console.error('mdcc-safe:', res.error.message);
    process.exit(1);
  }
  process.exit(res.status ?? 0);
}

main();
