import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertTargetVersion,
  HARNESS_MANIFEST_SCHEMA_VERSION,
  TARGET_COMPATIBILITY,
  unsupportedManifestSchemaMessage,
} from './compatibility.mjs';

test('supported target versions share one compatibility registry', () => {
  assert.doesNotThrow(() => assertTargetVersion('opencode', TARGET_COMPATIBILITY.opencode.version));
  assert.doesNotThrow(() => assertTargetVersion('codex', TARGET_COMPATIBILITY.codex.version));
});

test('target-version mismatch fails with upgrade guidance and a no-write guarantee', () => {
  assert.throws(
    () => assertTargetVersion('codex', '999.0.0'),
    /npm install -g @1agh\/maude@latest.*maude harness check.*No target files were changed/s
  );
});

test('manifest-schema mismatch preserves recovery state and explains the upgrade', () => {
  const message = unsupportedManifestSchemaMessage('/tmp/manifest.json', 999);
  assert.match(message, new RegExp(`supports schema ${HARNESS_MANIFEST_SCHEMA_VERSION}`));
  assert.match(message, /Do not delete the manifest or its backups/);
  assert.match(message, /maude harness check/);
});
