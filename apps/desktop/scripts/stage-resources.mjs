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
//     dist/runtime bundles, so the GENERAL node_modules tree is NOT needed); AND
//   • SPAWNS the ACP chat adapter `@agentclientprotocol/claude-agent-acp` from
//     DEV_SERVER_ROOT/node_modules (acp/probe.ts → resolveAdapterEntry()). This
//     one package IS needed at runtime, so we stage its JS dependency closure
//     below — without it the packaged chat panel reports "The Claude agent bridge
//     is not installed in this build" (the bug stage-resources' blanket
//     node_modules exclusion shipped in v0.31.0–v0.32.0). We ship ONLY the JS
//     (~11 MB), never the ~210 MB platform-native `claude-agent-sdk-<os>` binary:
//     bridge.ts pins CLAUDE_CODE_EXECUTABLE to the user's own `claude`, so the
//     adapter never resolves that native fallback.
// Inside a bundled .app the binary is alone in Contents/MacOS/, so we ship the
// whole apps/studio SOURCE tree here and point the sidecar at it via
// MAUDE_DEV_SERVER_ROOT (set in sidecar.rs). See DDR-106 addendum + the
// runtime-resolution trace.
//
// Layout (preserves the apps/studio ↔ plugins/design/templates `../../`
// relationship http.ts's TEMPLATES_DIR depends on):
//   src-tauri/resources/apps/studio/        (full source + dist + client, minus the below)
//   src-tauri/resources/plugins/design/     (whole plugin tree; templates/ = TEMPLATES_DIR)
//   src-tauri/resources/plugins/flow/       (whole plugin tree — DDR-143 auto-load)

import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..', '..'); // apps/desktop/scripts → repo root
const STUDIO = join(REPO_ROOT, 'apps', 'studio');
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
    // Normalize to forward slashes — on Windows `src` uses backslashes, so the
    // `/node_modules` etc. prefix checks below would never match and the whole
    // dep tree would leak into the staged bundle (it did, pre-fix: harmless
    // .msi bloat until the realpath-aware ACP copy below started colliding with
    // a leaked pnpm junction → ERR_FS_CP_EINVAL on the Windows leg).
    const rel = src.slice(STUDIO.length).replace(/\\/g, '/'); // '' for root, '/…' for children
    if (rel === '') return true;
    if (rel.startsWith('/node_modules') || rel.startsWith('/target')) return false;
    if (/^\/dist\/maude-/.test(rel)) return false; // per-platform build binaries
    if (rel.endsWith('.js.map')) return false;
    if (rel.startsWith('/dist/.compile-entries')) return false;
    return true;
  },
});

// --- Plugin trees: design + flow loadable surfaces (DDR-143) -----------------
// The ACP chat session auto-loads these as session-scoped LOCAL plugins so
// `/design:*` + `/flow:*` resolve with zero manual install: the dev-server points
// `_meta.claudeCode.options.plugins` at Resources/plugins/{design,flow} (paths.ts
// DESIGN_PLUGIN_DIR/FLOW_PLUGIN_DIR, gated on `.claude-plugin/plugin.json`). We
// copy the WHOLE plugin dir (commands/agents/skills/hooks/.claude-plugin +
// templates/) because the command markdown references `$CLAUDE_PLUGIN_ROOT/…`
// paths (templates, agents) at runtime, and the design/templates leg ALSO
// satisfies http.ts's TEMPLATES_DIR (`<root>/../../plugins/design/templates`) for
// the canvas iframe harness. Small (~2 MB markdown) vs the sidecar; no
// node_modules in a plugin tree, but filter defensively to match the studio copy.
const PLUGIN_TREES = ['design', 'flow'];
for (const plugin of PLUGIN_TREES) {
  const src = join(REPO_ROOT, 'plugins', plugin);
  need(join(src, '.claude-plugin', 'plugin.json'), `plugins/${plugin}/.claude-plugin/plugin.json`);
  cpSync(src, join(OUT, 'plugins', plugin), {
    recursive: true,
    filter: (p) => !/[\\/]node_modules([\\/]|$)/.test(p.replace(/\\/g, '/')),
  });
}

// Build-time gate (DDR-129): a plugin whose manifest/commands didn't stage would
// leave the packaged chat panel resolving NO `/design:*` on a pristine machine —
// the whole point of this feature. Fail the desktop build loud, not silent.
for (const plugin of PLUGIN_TREES) {
  const checks = {
    manifest: join(OUT, 'plugins', plugin, '.claude-plugin', 'plugin.json'),
    commands: join(OUT, 'plugins', plugin, 'commands'),
  };
  for (const [label, path] of Object.entries(checks)) {
    if (!existsSync(path)) {
      console.error(`[stage-resources] plugin ${plugin} ${label} not staged: ${path}`);
      process.exit(1);
    }
  }
}
// TEMPLATES_DIR contract (canvas iframe harness) rides on the design tree copy.
{
  const designTemplates = join(OUT, 'plugins', 'design', 'templates');
  if (!existsSync(designTemplates)) {
    console.error(
      `[stage-resources] design templates not staged (TEMPLATES_DIR): ${designTemplates}`
    );
    process.exit(1);
  }
}
console.log(`[stage-resources] staged plugin trees → ${PLUGIN_TREES.join(', ')}`);

// --- ACP chat adapter: stage its JS dependency closure -----------------------
// The dev-server spawns `@agentclientprotocol/claude-agent-acp` at runtime, so it
// must be on disk under DEV_SERVER_ROOT/node_modules. The general node_modules is
// excluded above (externalized to dist/runtime), so copy JUST this package's
// transitive JS closure, flat-hoisted and symlink-dereferenced. The closure is
// small (~11 MB, 4 packages: claude-agent-acp + @agentclientprotocol/sdk +
// @anthropic-ai/claude-agent-sdk JS + zod) with NO version conflicts, so a flat
// node_modules/<name> layout resolves correctly. The ~210 MB platform-native
// `@anthropic-ai/claude-agent-sdk-<os>-<arch>` binaries are SKIPPED — bridge.ts
// pins CLAUDE_CODE_EXECUTABLE to the user's own `claude`, so the adapter's native
// fallback path is never taken. (Skipping them also keeps the bundle
// platform-independent — the same staged tree works on every build leg.)
const ACP_ENTRY_PKG = '@agentclientprotocol/claude-agent-acp';
// Platform-native CLI packages — large, platform-locked, and unused once
// CLAUDE_CODE_EXECUTABLE is pinned. Never stage these.
const IS_NATIVE_PKG = (name) => /^@anthropic-ai\/claude-agent-sdk-(linux|darwin|win32)/.test(name);

// Guard against a pathological symlink cycle; the `parent === dir` root check is
// the real terminator, this is just belt-and-suspenders.
const MAX_ANCESTOR_WALK = 40;

// Resolve a dependency the way Node does: nested `node_modules` first, then walk
// up ancestor dirs (covers pnpm's peer-dir layout). Returns the dep's real
// package.json path, or null.
function resolveDepPkgJson(fromRealDir, dep) {
  let dir = fromRealDir;
  for (let i = 0; i < MAX_ANCESTOR_WALK; i++) {
    const cand = join(dir, 'node_modules', dep, 'package.json');
    if (existsSync(cand)) return realpathSync(cand);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Walk the JS closure from the adapter, collecting one real dir per package name.
function collectAcpClosure() {
  const entryPkgJson = join(STUDIO, 'node_modules', ACP_ENTRY_PKG, 'package.json');
  if (!existsSync(entryPkgJson)) {
    console.error(`[stage-resources] missing ACP adapter: ${entryPkgJson}`);
    console.error('Install dev-server deps first: pnpm install');
    process.exit(1);
  }
  const collected = new Map(); // name -> real dir
  const visited = new Set();
  const walk = (name, realDir) => {
    if (visited.has(realDir)) return;
    visited.add(realDir);
    collected.set(name, realDir);
    const pkg = JSON.parse(readFileSync(join(realDir, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
    for (const dep of Object.keys(deps)) {
      if (IS_NATIVE_PKG(dep)) continue; // skip the heavy platform binaries
      const depPkgJson = resolveDepPkgJson(realDir, dep);
      if (!depPkgJson) continue; // optional/native dep absent on this platform — fine
      walk(dep, dirname(depPkgJson));
    }
  };
  walk(ACP_ENTRY_PKG, realpathSync(dirname(entryPkgJson)));
  return collected;
}

const closure = collectAcpClosure();
for (const [name, realDir] of closure) {
  const dst = join(OUT_STUDIO, 'node_modules', name);
  mkdirSync(dirname(dst), { recursive: true });
  // Dereference symlinks (pnpm store), but drop each package's own node_modules —
  // every dep is hoisted flat (no version conflicts in this closure), so nested
  // trees would only duplicate or pull the symlink farm back in.
  cpSync(realDir, dst, {
    recursive: true,
    dereference: true,
    filter: (src) => {
      const rel = src.slice(realDir.length);
      if (/[\\/]node_modules([\\/]|$)/.test(rel)) return false;
      // Containment: with dereference:true, never follow a symlink whose target
      // escapes the package's own real dir — a malicious dep could otherwise
      // symlink to e.g. ~/.ssh and have its contents copied into the signed
      // bundle. The package's own files are real (pnpm stores content as real
      // files, only the linking is symlinked), so this drops nothing legit.
      try {
        const real = realpathSync(src);
        return real === realDir || real.startsWith(realDir + sep);
      } catch {
        return false;
      }
    },
  });
}

// Build-time gate: a missing adapter must FAIL the desktop build loud, not ship a
// dead chat panel. Mirror resolveAdapterEntry()'s contract — the bin must exist.
{
  const adapterPkgJson = join(OUT_STUDIO, 'node_modules', ACP_ENTRY_PKG, 'package.json');
  if (!existsSync(adapterPkgJson)) {
    console.error(`[stage-resources] ACP adapter not staged: ${adapterPkgJson}`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(adapterPkgJson, 'utf8'));
  const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['claude-agent-acp'];
  const binAbs = binRel ? join(dirname(adapterPkgJson), binRel) : null;
  if (!binAbs || !existsSync(binAbs)) {
    console.error(`[stage-resources] ACP adapter bin missing after staging: ${binAbs}`);
    process.exit(1);
  }
  console.log(
    `[stage-resources] staged ACP adapter closure (${closure.size} pkgs) → ${ACP_ENTRY_PKG}`
  );
}

console.log(`[stage-resources] staged dev-server runtime + source → ${OUT}`);
