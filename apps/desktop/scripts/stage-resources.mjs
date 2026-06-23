#!/usr/bin/env node
// Stage the dev-server runtime the sidecar needs ON DISK into src-tauri/resources/,
// so `tauri build` ships it inside Maude.app/Contents/Resources/.
//
// Why: the compiled dev-server binary does NOT embed its assets. At runtime it:
//   • serves dist/client.bundle.js, dist/runtime/*.js, client/index.html,
//     plugins/design/templates/_shell.html from DISK; AND
//   • BUILDS each canvas on demand (canvas-build.ts → Bun.build), resolving
//     `@maude/canvas-lib` → DEV_SERVER_ROOT/canvas-lib.tsx and its sibling .tsx
//     import graph FROM DISK (react/motion/etc. are externalized to the prebuilt
//     dist/runtime bundles, so node_modules is NOT needed).
// Inside a bundled .app the binary is alone in Contents/MacOS/, so we ship the
// whole apps/studio SOURCE tree here and point the sidecar at it via
// MAUDE_DEV_SERVER_ROOT (set in sidecar.rs). See DDR-106 addendum + the
// runtime-resolution trace.
//
// Layout (preserves the apps/studio ↔ plugins/design/templates `../../`
// relationship http.ts's TEMPLATES_DIR depends on):
//   src-tauri/resources/apps/studio/        (full source + dist + client, minus the below)
//   src-tauri/resources/plugins/design/templates/

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..'); // apps/desktop/scripts → repo root
const STUDIO = join(REPO_ROOT, 'apps', 'studio');
const TEMPLATES = join(REPO_ROOT, 'plugins', 'design', 'templates');
const OUT = resolve(SCRIPT_DIR, '..', 'src-tauri', 'resources');
const OUT_STUDIO = join(OUT, 'apps', 'studio');

function need(src, label) {
  if (!existsSync(src)) {
    console.error(`[stage-resources] missing ${label}: ${src}`);
    console.error('Build the dev-server first: cd apps/studio && bun run build.ts');
    process.exit(1);
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT_STUDIO, { recursive: true });

// Ship the whole apps/studio source tree (canvas-lib.tsx + its sibling import
// graph build canvases at runtime). Exclude: node_modules; build dirs; and the
// heavy per-platform `dist/maude-*` binaries / .js.map / .compile-entries that
// aren't read at runtime (they'd add ~250 MB).
need(join(STUDIO, 'dist'), 'apps/studio/dist');
need(join(STUDIO, 'canvas-lib.tsx'), 'apps/studio/canvas-lib.tsx');
cpSync(STUDIO, OUT_STUDIO, {
  recursive: true,
  filter: (src) => {
    const rel = src.slice(STUDIO.length); // '' for root, '/â€¦' for children
    if (rel === '') return true;
    if (rel.startsWith('/node_modules') || rel.startsWith('/target')) return false;
    if (/^\/dist\/maude-/.test(rel)) return false; // per-platform build binaries
    if (rel.endsWith('.js.map')) return false;
    if (rel.startsWith('/dist/.compile-entries')) return false;
    return true;
  },
});

// plugins/design/templates/ — _shell.html canvas harness (TEMPLATES_DIR resolves
// to <root>/../../plugins/design/templates). REQUIRED for canvas iframes.
need(TEMPLATES, 'plugins/design/templates');
cpSync(TEMPLATES, join(OUT, 'plugins', 'design', 'templates'), { recursive: true });

console.log(`[stage-resources] staged dev-server runtime + source → ${OUT}`);
