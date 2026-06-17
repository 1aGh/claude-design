#!/usr/bin/env node
// Stage the dev-server runtime that the sidecar needs ON DISK at runtime into
// src-tauri/resources/, so `tauri build` ships it inside Maude.app/Contents/Resources/.
//
// Why: the compiled dev-server binary does NOT embed its assets — it serves
// `dist/client.bundle.js`, `dist/runtime/*.js`, `client/index.html`, and
// `plugins/design/templates/_shell.html` from DISK, resolving the root via
// paths.ts. Inside a bundled .app the binary is alone in Contents/MacOS/, so we
// ship the runtime here and point the sidecar at it via MAUDE_DEV_SERVER_ROOT
// (set in sidecar.rs). See DDR-106 addendum + the runtime-resolution trace.
//
// Layout produced (preserves the `apps/studio` ↔ `plugins/design/templates`
// `../../` relationship that http.ts's TEMPLATES_DIR depends on):
//   src-tauri/resources/apps/studio/{dist,client,whats-new.json}
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

// Fresh each build — avoid shipping stale artifacts.
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT_STUDIO, { recursive: true });

function need(src, label) {
  if (!existsSync(src)) {
    console.error(`[stage-resources] missing ${label}: ${src}`);
    console.error('Build the dev-server first: cd apps/studio && bun run build.ts');
    process.exit(1);
  }
}

// dist/ — committed artifacts the binary serves. Copy ONLY what's served at
// runtime; skip the per-platform `maude-*` build binaries, the .js.map, and
// .compile-entries (they'd bloat the bundle by ~250 MB and aren't read at runtime).
need(join(STUDIO, 'dist'), 'apps/studio/dist');
const distOut = join(OUT_STUDIO, 'dist');
mkdirSync(distOut, { recursive: true });
for (const f of ['client.bundle.js', 'styles.css', 'comment-mount.js']) {
  const src = join(STUDIO, 'dist', f);
  if (existsSync(src)) cpSync(src, join(distOut, f));
}
need(join(STUDIO, 'dist', 'runtime'), 'apps/studio/dist/runtime');
cpSync(join(STUDIO, 'dist', 'runtime'), join(distOut, 'runtime'), { recursive: true });

// client/ — index.html (shell mount) + source fallbacks. REQUIRED.
need(join(STUDIO, 'client'), 'apps/studio/client');
cpSync(join(STUDIO, 'client'), join(OUT_STUDIO, 'client'), { recursive: true });

// whats-new.json — optional product feed (served from DEV_SERVER_ROOT).
if (existsSync(join(STUDIO, 'whats-new.json'))) {
  cpSync(join(STUDIO, 'whats-new.json'), join(OUT_STUDIO, 'whats-new.json'));
}

// plugins/design/templates/ — _shell.html canvas harness (TEMPLATES_DIR resolves
// to <root>/../../plugins/design/templates). REQUIRED for canvas iframes.
need(TEMPLATES, 'plugins/design/templates');
cpSync(TEMPLATES, join(OUT, 'plugins', 'design', 'templates'), { recursive: true });

console.log(`[stage-resources] staged dev-server runtime → ${OUT}`);
