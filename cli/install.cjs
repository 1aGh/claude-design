#!/usr/bin/env node
/* eslint-disable */
// Postinstall: resolve the matching @1agh/maude-<slug> sub-package and
// write its absolute binary path to `cli/.platform-binary-path` so the
// dispatcher (`cli/bin/maude.mjs`) can `execFileSync` the native binary for
// hot paths (`maude design serve`) with zero Node startup tax on subsequent
// invocations.
//
// Pragmatic deviation from plan T12: see DDR-015. The full "maude IS the
// binary" port (delete maude.mjs entirely) is deferred — currently the binary
// only handles the dev-server, so we route only that subcommand through it.
// CLI subcommands (init, config, version) keep running on Node for now.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const SIDE_CHANNEL = path.join(HERE, '.platform-binary-path');

function isLocalDev() {
  // Don't run inside the source tree (when the user is developing the package itself).
  return fs.existsSync(path.join(HERE, '..', 'packages', 'maude-darwin-arm64', 'package.json'));
}

function detectSlug() {
  const p = process.platform;
  const a = process.arch;

  if (p === 'darwin') {
    if (a === 'arm64') return 'darwin-arm64';
    try {
      const { execSync } = require('node:child_process');
      const t = execSync('sysctl -n sysctl.proc_translated', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
      if (t === '1') return 'darwin-arm64';
    } catch {
      /* not running under Rosetta */
    }
    return 'darwin-x64';
  }

  if (p === 'linux') {
    const isMusl = (() => {
      try {
        const report = process.report?.getReport?.();
        const glibc = report?.header?.glibcVersionRuntime;
        return !glibc;
      } catch {
        return false;
      }
    })();
    if (a === 'arm64') return isMusl ? 'linux-arm64-musl' : 'linux-arm64';
    return isMusl ? 'linux-x64-musl' : 'linux-x64';
  }

  if (p === 'win32') return 'win32-x64';

  throw new Error(`Unsupported platform: ${p}-${a}`);
}

function resolveBinary(slug) {
  const pkg = `@1agh/maude-${slug}`;
  const filename = process.platform === 'win32' ? 'maude.exe' : 'maude';
  try {
    const manifest = require.resolve(`${pkg}/package.json`);
    return path.join(path.dirname(manifest), filename);
  } catch (err) {
    throw new Error(
      `Cannot find ${pkg}. Reinstall with \`npm i -g @1agh/maude\` or \`npm rebuild @1agh/maude\`. (${err?.message ? err.message : err})`
    );
  }
}

function main() {
  // Accept both env-var names for one cycle (BC alias). Drop MD_CLAUDE_SKIP_POSTINSTALL in v0.17.x.
  if (
    process.env.MAUDE_SKIP_POSTINSTALL === '1' ||
    process.env.MD_CLAUDE_SKIP_POSTINSTALL === '1'
  ) {
    console.log('@1agh/maude: postinstall skipped via MAUDE_SKIP_POSTINSTALL=1');
    return;
  }
  if (isLocalDev()) {
    return;
  }
  try {
    const slug = detectSlug();
    const bin = resolveBinary(slug);
    if (!fs.existsSync(bin)) {
      throw new Error(`binary missing at ${bin}`);
    }
    fs.writeFileSync(SIDE_CHANNEL, bin, 'utf8');
    try {
      fs.chmodSync(bin, 0o755);
    } catch {
      /* read-only fs / Windows — ignore */
    }
    console.log(`@1agh/maude: registered ${slug} binary (${bin})`);
  } catch (err) {
    console.error(`@1agh/maude: postinstall failed — ${err?.message ? err.message : err}`);
    console.error(
      '  `maude design serve` will fall back to running server.ts on Bun (if available).'
    );
    process.exit(0); // Don't fail the install.
  }
}

main();
