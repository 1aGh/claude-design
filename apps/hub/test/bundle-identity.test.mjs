// Cloud Phase 27 E1/D5 — one client, three shells, and a hash that proves it.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  checkBundleIdentity,
  formatIdentityFailure,
  hashArtifacts,
  identityForHealth,
  MANIFEST_NAME,
  TRACKED_ARTIFACTS,
} from '../src/bundle-identity.mjs';

function image({ client = 'BUNDLE', styles = 'CSS', seal = true, tamper = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cell-image-'));
  const studio = join(root, 'studio');
  mkdirSync(join(studio, 'dist'), { recursive: true });
  writeFileSync(join(studio, 'dist', 'client.bundle.js'), client);
  writeFileSync(join(studio, 'dist', 'styles.css'), styles);
  if (seal) {
    writeFileSync(join(root, MANIFEST_NAME), JSON.stringify({ artifacts: hashArtifacts(studio) }));
  }
  if (tamper) writeFileSync(join(studio, 'dist', 'client.bundle.js'), tamper);
  return { root, studio, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('a sealed image whose bytes are untouched boots', () => {
  const f = image();
  try {
    const r = checkBundleIdentity({ studioRoot: f.studio, manifestDir: f.root, required: true });
    assert.equal(r.ok, true);
  } finally {
    f.cleanup();
  }
});

test('a REPLACED bundle refuses to boot, and names the file', () => {
  const f = image({ tamper: 'BUNDLE-but-rebuilt-at-package-time' });
  try {
    const r = checkBundleIdentity({ studioRoot: f.studio, manifestDir: f.root, required: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'mismatched');
    assert.equal(r.detail.mismatched[0].rel, 'dist/client.bundle.js');
    const msg = formatIdentityFailure(r);
    assert.match(msg, /REFUSING TO START/);
    assert.match(msg, /dist\/client\.bundle\.js — REPLACED/);
  } finally {
    f.cleanup();
  }
});

test('a MISSING bundle is a packaging failure, told apart from a replaced one', () => {
  const f = image();
  try {
    rmSync(join(f.studio, 'dist', 'styles.css'));
    const r = checkBundleIdentity({ studioRoot: f.studio, manifestDir: f.root, required: true });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing');
    assert.deepEqual(r.detail.missing, ['dist/styles.css']);
    assert.match(formatIdentityFailure(r), /MISSING/);
  } finally {
    f.cleanup();
  }
});

test('an UNSEALED image is fatal only where sealing was promised', () => {
  const f = image({ seal: false });
  try {
    // A dev checkout: nothing staged anything, and refusing here would make the
    // cloud path untestable locally — which is how a guard ends up disabled.
    assert.equal(
      checkBundleIdentity({ studioRoot: f.studio, manifestDir: f.root, required: false }).ok,
      true
    );
    // A cell image: an absent manifest means it was never sealed.
    const sealed = checkBundleIdentity({
      studioRoot: f.studio,
      manifestDir: f.root,
      required: true,
    });
    assert.equal(sealed.ok, false);
    assert.equal(sealed.reason, 'no-manifest');
  } finally {
    f.cleanup();
  }
});

test('health reports the HASH, because a tag is not an identity', () => {
  const f = image();
  try {
    const h = identityForHealth({ studioRoot: f.studio, manifestDir: f.root });
    assert.equal(h.ok, true);
    for (const rel of TRACKED_ARTIFACTS) {
      assert.equal(typeof h.artifacts[rel], 'string');
      // Short enough that an operator can compare two cells by eye.
      assert.equal(h.artifacts[rel].length, 12);
    }
  } finally {
    f.cleanup();
  }
});

test('health says NOT-ok when the served bytes are not the image’s', () => {
  const f = image({ tamper: 'something-else' });
  try {
    assert.equal(identityForHealth({ studioRoot: f.studio, manifestDir: f.root }).ok, false);
  } finally {
    f.cleanup();
  }
});

test('an unsealed build reports null rather than claiming to be verified', () => {
  const f = image({ seal: false });
  try {
    // `null` and `false` are different answers: one is "not checked", the other
    // is "checked and wrong". Collapsing them is how an unverified cell comes to
    // look verified.
    assert.equal(identityForHealth({ studioRoot: f.studio, manifestDir: f.root }).ok, null);
  } finally {
    f.cleanup();
  }
});
