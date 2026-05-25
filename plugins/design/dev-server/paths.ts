// Path resolution for the dev-server, robust across THREE runtime modes:
//
//   1. Dev (`bun server.ts`):      import.meta.url is a real file:// path,
//                                  use dirname of it.
//   2. Compiled binary, npm:       maude installed via `npm i -g @1agh/maude`;
//                                  binary lives in a sub-package dir, deps in
//                                  the parent @1agh/maude/ dir. import.meta.url
//                                  is the virtual `/$bunfs/root` (bun --compile
//                                  embedded fs) — NOT a real disk path.
//                                  Walk up from process.execPath until we find
//                                  the real plugins/design/dev-server/ dir.
//   3. Compiled binary, marketplace cache: similar to (2) but lives at
//                                  ~/.claude/plugins/cache/maude/design/<v>/
//                                  dev-server/. Same walk-up logic finds it.
//
// Why this matters: Phase 19 v0.18.0 used `dirname(fileURLToPath(import.meta.url))`
// universally. In the compiled binary that's `/$bunfs/root` — a virtual path —
// so `existsSync('/$bunfs/root/dist/client.bundle.js')` always returned false
// even when the file was sitting on disk at the real install path. Self-heal
// false-triggered, http.ts /_client/* fell through to /$bunfs/root/client/*.jsx
// (raw source), runtime-bundle.ts synthetic entrypoint anchored in virtual fs
// so Bun.build couldn't walk node_modules. Every observed symptom traces to
// this one bug. Phase 19.1 / v0.18.1.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Real disk path to the dev-server install dir
 * (`plugins/design/dev-server/` inside whatever package layout we're in).
 *
 * Always a directory that contains `http.ts` + `dist/` + (optionally)
 * `node_modules/` and `client/`. Never a virtual `/$bunfs/*` path.
 */
export const DEV_SERVER_ROOT: string = resolveDevServerRoot();

/** `<DEV_SERVER_ROOT>/dist/` — committed artifacts + runtime bundles + binary. */
export const DIST_DIR: string = join(DEV_SERVER_ROOT, 'dist');

/** `<DEV_SERVER_ROOT>/client/` — raw source HTML + JSX + CSS for dev fallback. */
export const CLIENT_DIR: string = join(DEV_SERVER_ROOT, 'client');

/** `<DEV_SERVER_ROOT>/dist/runtime/` — pre-built /_canvas-runtime/*.js bundles. */
export const RUNTIME_BUNDLES_DIR: string = join(DIST_DIR, 'runtime');

/**
 * Whether we are running inside a `bun --compile` standalone binary
 * (true when `import.meta.url` resolves to bun's virtual filesystem).
 *
 * Useful for code that needs to know whether disk-relative fallback paths
 * (e.g. `<DEV_SERVER_ROOT>/client/app.jsx`) are even reachable — in compiled
 * mode the answer is "only if shipped via the install layout".
 */
export const IS_COMPILED_BINARY: boolean = isVirtualBunfsPath(getImportMetaDir());

function getImportMetaDir(): string | null {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

function isVirtualBunfsPath(p: string | null): boolean {
  return p !== null && (p.startsWith('/$bunfs') || p.startsWith('B:/~BUN'));
}

function isDevServerDir(dir: string): boolean {
  // Anchor: http.ts is the route-table file — unique enough to identify the
  // dev-server install dir. We do NOT also require package.json: npm excludes
  // nested workspace package.json files from tarballs by default, so checking
  // for it caused walk-up to silently fall through to /$bunfs/root for every
  // npm-installed user. Discovered in v0.18.1 retro. Process.execPath walk-up
  // only traverses node_modules layers above the binary, so false-match risk
  // from a stray http.ts file in the user's working tree is negligible.
  return existsSync(join(dir, 'http.ts'));
}

function resolveDevServerRoot(): string {
  // (1) Dev mode: import.meta.url is a real file:// path AND lands in the
  // dev-server dir. Common case for `bun run server.ts`, tests, etc.
  const importDir = getImportMetaDir();
  if (importDir && !isVirtualBunfsPath(importDir) && isDevServerDir(importDir)) {
    return importDir;
  }

  // (2 + 3) Compiled binary: walk up from process.execPath until we find a dir
  // that *contains* `plugins/design/dev-server/<canonical files>`. Match both
  // npm install layout (binary at @1agh/maude-<plat>/maude → walk up 4 levels
  // to @1agh/maude/) AND marketplace cache layout (binary somewhere under
  // ~/.claude/plugins/cache/maude/design/<v>/dev-server/dist/).
  let cur = dirname(process.execPath);
  for (let i = 0; i < 10; i++) {
    // Check if cur itself is the dev-server root.
    if (isDevServerDir(cur)) return cur;
    // Check if cur contains plugins/design/dev-server/.
    const nested = join(cur, 'plugins', 'design', 'dev-server');
    if (isDevServerDir(nested)) return nested;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  // Final fallback for unanchored test contexts (e.g. tests spawning compiled
  // binary in a tmp dir without our layout). Return the import dir even if
  // it's virtual — callers should expect existsSync to fail and surface a
  // clear error.
  return importDir ?? dirname(process.execPath);
}
