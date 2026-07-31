// `.meta.json` merge — plain-JS twin of apps/studio/sync/codec.ts.
// Cloud Phase 16 Task 1.
//
// WHY A TWIN AND NOT AN IMPORT. The hub runs as a bundled, dependency-frozen
// image with no studio source tree in it, and its runtime is Node, not Bun.
// Reaching into `apps/studio/sync/codec.ts` would drag the studio's Context /
// collab graph into a container whose entire security posture (DDR-193 §2) is
// "it does not contain the things that render tenant TSX".
//
// The cost of a twin is drift, and drift here is silent: the two would keep
// working while producing subtly different `.meta.json`, so a canvas would
// oscillate between two shapes depending on whether the desktop or the cell
// wrote it last. `test/workspace-files.test.mjs` closes that by importing the
// REAL codec and asserting byte-equal output over a corpus — the twin is
// allowed to exist only for as long as it is provably identical.

/** Per-user / security keys that never sync. Mirrors codec.ts META_LOCAL_KEYS. */
export const META_LOCAL_KEYS = ['viewport', 'last_modified', 'syncable'];

/**
 * JSON.parse that drops prototype-poisoning keys (DDR-054 §2g). The meta lane
 * carries hub-pushed content, so this is the same guard the codec applies.
 */
function parseJsonSafe(s) {
  return JSON.parse(s, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  });
}

/**
 * Merge the doc's shared meta into the local `.meta.json`, preserving local keys.
 *
 * Shared keys become exactly what the doc holds, so a deletion on the source
 * propagates; local keys are layered back on top. Returns the JSON ready to
 * write (2-space, trailing newline), or null when the shared payload is
 * unparseable — null means "do not write", never "write empty".
 */
export function mergeSharedMetaIntoLocal(localMetaJson, sharedJson) {
  let shared;
  try {
    shared = parseJsonSafe(sharedJson);
  } catch {
    return null;
  }
  if (!shared || typeof shared !== 'object' || Array.isArray(shared)) return null;

  let local = {};
  if (localMetaJson) {
    try {
      const parsed = parseJsonSafe(localMetaJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) local = parsed;
    } catch {
      /* unparseable local meta — the shared subset becomes the base */
    }
  }

  const merged = { ...shared };
  for (const k of META_LOCAL_KEYS) {
    if (k in local) merged[k] = local[k];
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}
