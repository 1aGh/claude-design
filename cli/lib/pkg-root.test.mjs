// pkg-root.mjs tests (DDR-166 T0b).
//
// The regression this locks down: a naive single-anchor check
// (`apps/studio/bin/screenshot.sh` alone) false-positives inside the Tauri
// desktop build, because `stage-resources.mjs` stages a full working copy of
// `apps/studio` into `target/debug/apps/studio/` for the sidecar's own
// runtime resolution — that staged copy has no `cli/`, so a compiled `maude`
// binary walking up from `target/debug/maude` matched it and stopped one
// level too early, resolving PKG_ROOT to `target/debug` instead of the real
// repo root. Caught by live testing against the real Tauri build (not a
// synthetic path), not by static review — worth a regression test.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { isPkgRoot, resolvePkgRoot, resolveTauriResourcePkgRoot } from './pkg-root.mjs';

function makeRealRoot(base) {
  mkdirSync(join(base, 'apps', 'studio', 'bin'), { recursive: true });
  writeFileSync(join(base, 'apps', 'studio', 'bin', 'screenshot.sh'), '#!/bin/sh\n');
  mkdirSync(join(base, 'cli', 'commands'), { recursive: true });
  writeFileSync(join(base, 'cli', 'commands', 'design.mjs'), 'export const run = () => {};\n');
}

test('isPkgRoot requires BOTH anchors — the staged-resources false-positive is rejected', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'maude-pkgroot-'));
  try {
    // The exact shape of the bug: apps/studio/bin/screenshot.sh present
    // (mirrors stage-resources.mjs's staged copy), no cli/ at all.
    mkdirSync(join(tmp, 'apps', 'studio', 'bin'), { recursive: true });
    writeFileSync(join(tmp, 'apps', 'studio', 'bin', 'screenshot.sh'), '#!/bin/sh\n');
    assert.equal(isPkgRoot(tmp), false);

    // cli/ alone, no apps/studio — also not a real root.
    const tmp2 = mkdtempSync(join(tmpdir(), 'maude-pkgroot-'));
    try {
      mkdirSync(join(tmp2, 'cli', 'commands'), { recursive: true });
      writeFileSync(join(tmp2, 'cli', 'commands', 'design.mjs'), '');
      assert.equal(isPkgRoot(tmp2), false);
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }

    // Both anchors together — a genuine package root.
    makeRealRoot(tmp);
    assert.equal(isPkgRoot(tmp), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveTauriResourcePkgRoot finds the .app sibling Resources tree (RCA G2)', () => {
  // Mirror the packaged macOS layout: binary in Contents/MacOS, staged tree in
  // the SIBLING Contents/Resources — NOT an ancestor of the binary, which is why
  // the plain walk-up misses it and every `maude design <verb>` broke.
  const app = mkdtempSync(join(tmpdir(), 'maude-app-'));
  try {
    const macosDir = join(app, 'Contents', 'MacOS');
    const resources = join(app, 'Contents', 'Resources');
    mkdirSync(macosDir, { recursive: true });
    makeRealRoot(resources); // stages apps/studio/bin/screenshot.sh + cli/commands/design.mjs

    // From the binary's own dir, the sibling probe must find Resources.
    assert.equal(resolveTauriResourcePkgRoot(macosDir), resources);

    // Regression guard: Resources WITHOUT cli/ (the shipped-broken v0.45.1 shape)
    // must NOT resolve — that's exactly the false-positive isPkgRoot rejects.
    const broken = mkdtempSync(join(tmpdir(), 'maude-app-broken-'));
    try {
      const bMacos = join(broken, 'Contents', 'MacOS');
      const bRes = join(broken, 'Contents', 'Resources', 'apps', 'studio', 'bin');
      mkdirSync(bMacos, { recursive: true });
      mkdirSync(bRes, { recursive: true });
      writeFileSync(join(bRes, 'screenshot.sh'), '#!/bin/sh\n'); // no cli/ staged
      assert.equal(resolveTauriResourcePkgRoot(bMacos), null);
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

test('resolvePkgRoot honors MAUDE_PKG_ROOT only when it actually satisfies both anchors', () => {
  const real = mkdtempSync(join(tmpdir(), 'maude-pkgroot-real-'));
  const fake = mkdtempSync(join(tmpdir(), 'maude-pkgroot-fake-'));
  const prevOverride = process.env.MAUDE_PKG_ROOT;
  try {
    makeRealRoot(real);
    // Fake: only the staged-resources-shaped anchor, same false-positive shape.
    mkdirSync(join(fake, 'apps', 'studio', 'bin'), { recursive: true });
    writeFileSync(join(fake, 'apps', 'studio', 'bin', 'screenshot.sh'), '#!/bin/sh\n');

    process.env.MAUDE_PKG_ROOT = real;
    assert.equal(resolvePkgRoot(), real);

    process.env.MAUDE_PKG_ROOT = fake;
    // Falls through past the (rejected) override to whatever the real
    // walk-up finds in THIS test process — just assert it's NOT the fake
    // dir, since accepting it would be exactly the regression.
    assert.notEqual(resolvePkgRoot(), fake);
  } finally {
    if (prevOverride === undefined) delete process.env.MAUDE_PKG_ROOT;
    else process.env.MAUDE_PKG_ROOT = prevOverride;
    rmSync(real, { recursive: true, force: true });
    rmSync(fake, { recursive: true, force: true });
  }
});
