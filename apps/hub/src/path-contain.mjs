// Symlink-aware path containment — the ONE home for the guard, so the hub's
// two peer-chosen-directory write surfaces cannot drift apart.
//
// DDR-054 treats a workspace peer as untrusted, and a peer can COMMIT a symlink
// into the shared repo (`.design/ui/etc -> /etc`). A lexical containment check
// (`resolve()` + `startsWith`) never touches disk, so it passes such a path —
// and then `mkdirSync(recursive)` / `createWriteStream` / `renameSync` follow
// the link and write the peer's bytes OUTSIDE the design root as the hub user.
// Both the canvas-projection writer (workspace-agent.mjs) and the asset PUT
// (assets.mjs) choose their directory from peer input, so both need this — and
// re-typing a security guarantee is re-typing it without its tests (the
// Dockerfile rule), which is exactly how the asset PUT shipped without it once.

import { realpathSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/**
 * `realpathSync`, but for a path that does not exist yet — walk up to the
 * deepest ancestor that DOES exist, resolve THAT through its symlinks, and
 * re-attach the not-yet-created tail. `resolve()` alone is purely lexical and
 * never follows a link; this is what makes containment true on disk.
 */
export function realpathOfDeepestExisting(p) {
  let cur = p;
  for (;;) {
    try {
      return join(realpathSync(cur), relative(cur, p));
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return p;
      cur = parent;
    }
  }
}

/**
 * Is `abs` really inside `root` once every symlink on both is resolved? `root`
 * is expected to exist (its realpath is taken directly); `abs` may not yet, so
 * its deepest existing ancestor is resolved. Returns false rather than throwing
 * so a caller can turn it straight into a 400.
 */
export function isContainedReal(root, abs) {
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch {
    return false;
  }
  const real = realpathOfDeepestExisting(abs);
  return real === realRoot || real.startsWith(realRoot + sep);
}
