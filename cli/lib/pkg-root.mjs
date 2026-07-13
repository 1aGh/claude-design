// pkg-root.mjs — real-disk `maude` package-root resolution, safe inside a
// `bun build --compile` standalone binary (DDR-166 T0b).
//
// `cli/bin/maude.mjs` originally computed PKG_ROOT via
// `dirname(fileURLToPath(import.meta.url))` walk-up — correct for the plain
// npm/node install, but the exact DDR-045 trap: inside a compiled binary,
// `import.meta.url` resolves to Bun's virtual filesystem (`/$bunfs/root` on
// POSIX, `B:/~BUN/root` on Windows), not the real on-disk location. Two
// dev-server releases (v0.18.0/v0.18.1) shipped broken because of this exact
// bug class before DDR-045 fixed it there. This module mirrors that fix
// (`apps/studio/paths.ts` `resolveDevServerRoot`) for the CLI, independently
// — not by importing paths.ts directly, to keep the CLI's compiled binary
// decoupled from the dev-server's module graph.

import { existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function isVirtualBunfsPath(p) {
  return p !== null && (p.startsWith('/$bunfs') || p.startsWith('B:/~BUN'));
}

/** True inside a `bun build --compile` standalone binary. Mirrors `apps/studio/paths.ts`'s `IS_COMPILED_BINARY`. */
export function isCompiledBinary() {
  return isVirtualBunfsPath(getImportMetaDir());
}

function getImportMetaDir() {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

/**
 * Anchor: `apps/studio/bin/screenshot.sh` is present in every real maude
 * package root (dev tree, npm tarball, and the Tauri desktop `Resources/`
 * bundle all ship it) and nowhere else — unique enough to identify the
 * package root without also requiring `package.json` (npm tarballs can drop
 * nested workspace `package.json` files, the exact false-negative DDR-045's
 * own retro already documents for the dev-server's analogous check).
 */
export function isPkgRoot(dir) {
  // Both anchors, not just one: `apps/studio/bin/screenshot.sh` ALONE is a
  // false-positive inside the Tauri desktop build — `stage-resources.mjs`
  // stages a full working copy of `apps/studio` (dev-server + bin scripts)
  // into `target/debug/apps/studio/` for the sidecar's own runtime
  // resolution, but that staged copy has no `cli/` — walking up from a
  // compiled `maude` binary placed at `target/debug/maude` matched THAT
  // copy first and stopped one level too early (caught by live testing
  // against the real Tauri build, not a synthetic path). `cli/commands/
  // design.mjs` only exists in a genuine package root.
  return (
    existsSync(join(dir, 'apps', 'studio', 'bin', 'screenshot.sh')) &&
    existsSync(join(dir, 'cli', 'commands', 'design.mjs'))
  );
}

/**
 * Resolve maude's own package root — real disk path, safe inside a compiled
 * binary. Priority: (0) explicit override, (1) dev-mode `import.meta.url`
 * (plain `node`/`bun run cli/bin/maude.mjs`), (2) compiled-binary walk-up
 * from `process.execPath` (matches the npm-install layout: binary at
 * `@1agh/maude-<platform>/maude` walks up to `@1agh/maude/`, which ships
 * `apps/studio/` via `package.json` `files`; matches the Tauri desktop layout
 * too, where the bundled `maude` binary and the `Resources/apps/studio`
 * bundle share a common ancestor within the walk-up depth).
 */
export function resolvePkgRoot() {
  const override = process.env.MAUDE_PKG_ROOT;
  if (override && !isVirtualBunfsPath(override) && isPkgRoot(override)) return override;

  const importDir = getImportMetaDir();
  if (importDir && !isVirtualBunfsPath(importDir)) {
    // Dev-mode: cli/bin/maude.mjs is 2 levels under the package root.
    const candidate = join(importDir, '..', '..');
    if (isPkgRoot(candidate)) return candidate;
  }

  // `process.execPath` is the path AS INVOKED — when launched through a
  // symlink (DDR-166 T0b stages exactly this: sidecar.rs's narrow bin-link
  // dir), it's the symlink's own path, not the real target, and walking up
  // from there (e.g. ~/Library/Caches/…/bin-link/) never reaches the repo
  // root. Dereference first. Falls back to the raw path if the file somehow
  // doesn't exist (shouldn't happen — we ARE that running process).
  let cur;
  try {
    cur = dirname(realpathSync(process.execPath));
  } catch {
    cur = dirname(process.execPath);
  }
  for (let i = 0; i < 10; i++) {
    if (isPkgRoot(cur)) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  // Final fallback for unanchored test contexts — callers should expect
  // existsSync-based lookups to fail and surface a clear error, same
  // contract as paths.ts's own resolver. Never join a VIRTUAL importDir here
  // (`/$bunfs/root/../..` collapses to `/` via path.join — a real bug an
  // earlier draft of this function had, caught by testing against an
  // unanchored compile output before wiring this into Tauri).
  return dirname(process.execPath);
}
