#!/usr/bin/env node
// check-bundle-completeness.mjs — assert the packaged Maude bundle is truly
// self-contained: every runtime-spawned surface has, INSIDE the bundle, a JS
// runtime to execute it AND its complete dependency closure. Guards the class of
// regression documented in
// `.ai/logs/rca/issue-acp-panel-hangs-on-nodeless-machine.md` (G1–G4): the app
// shipped compiled binaries but not the `node`/`bun` runtimes and npm deps its
// own `maude design <verb>` helpers shell out to — green in `tauri dev`, broken
// in the packaged `.app` (the "native-app verification ceiling" class).
//
// This is the durable answer to "vždy dělat build i dependencies": a new helper
// that adds a new dependency without staging it (or routing it through the
// compiled server) fails THIS check, before it can ship.
//
// Usage:
//   node check-bundle-completeness.mjs [<path-to-.app | resources-dir>] [--smoke]
//
// Default target: /Applications/Maude.app. `--smoke` additionally runs each
// `maude design <verb>` against the bundle in a stripped PATH (no node/bun/claude
// on PATH — simulating a fresh machine) and asserts none reports the missing-
// runtime / missing-helper / missing-module signatures.
//
// Exit 0 = complete. Exit 1 = at least one gap. Exit 2 = bad invocation / target
// not found (so CI can distinguish "bundle incomplete" from "ran wrong").

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { classifyHelpers, collectImports } from './helper-deps.mjs';

const RED = '\x1b[31m';
const GRN = '\x1b[32m';
const YEL = '\x1b[33m';
const DIM = '\x1b[2m';
const RST = '\x1b[0m';

const failures = [];
const notes = [];
function fail(check, detail) {
  failures.push({ check, detail });
  console.error(`  ${RED}✗${RST} ${check}\n    ${DIM}${detail}${RST}`);
}
function ok(check, detail = '') {
  console.log(`  ${GRN}✓${RST} ${check}${detail ? `  ${DIM}${detail}${RST}` : ''}`);
}
function warn(check, detail) {
  notes.push({ check, detail });
  console.log(`  ${YEL}⚠${RST} ${check}\n    ${DIM}${detail}${RST}`);
}

// --- Resolve the bundle layout ------------------------------------------------
// Accepts either a macOS `.app`, a Tauri `resources/` staging dir, or a repo/npm
// package root. We need two anchors: the compiled `maude` BINARY (to smoke) and
// the RESOURCES root (where the staged `apps/studio` + `cli` live, i.e. the
// pkgRoot the binary must resolve).
function resolveTarget(argPath) {
  const p = resolve(argPath);
  if (!existsSync(p)) return null;

  // macOS .app
  if (p.endsWith('.app')) {
    return {
      kind: 'app',
      macosDir: join(p, 'Contents', 'MacOS'),
      resources: join(p, 'Contents', 'Resources'),
      binary: join(p, 'Contents', 'MacOS', 'maude'),
    };
  }
  // A dir that itself contains Contents/ (an unwrapped .app path)
  if (existsSync(join(p, 'Contents', 'MacOS'))) {
    return {
      kind: 'app',
      macosDir: join(p, 'Contents', 'MacOS'),
      resources: join(p, 'Contents', 'Resources'),
      binary: join(p, 'Contents', 'MacOS', 'maude'),
    };
  }
  // Tauri staging `resources/` (pre-package, CI) — has apps/studio + plugins.
  if (existsSync(join(p, 'apps', 'studio'))) {
    return { kind: 'resources', macosDir: null, resources: p, binary: null };
  }
  return null;
}

// Helper classification + the module-graph dep walk live in the shared
// `helper-deps.mjs` — the SAME source `stage-resources.mjs` uses to decide what
// to stage, so "what the gate checks" can never drift from "what staging ships".

// -----------------------------------------------------------------------------
const arg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const doSmoke = process.argv.includes('--smoke');
const target = resolveTarget(arg || '/Applications/Maude.app');

if (!target) {
  console.error(`${RED}check-bundle-completeness: target not found or unrecognized:${RST} ${arg || '/Applications/Maude.app'}`);
  console.error('Pass a path to a built Maude.app, a Tauri resources/ dir, or a package root.');
  process.exit(2);
}

console.log(`\n${'='.repeat(70)}\nMaude bundle self-containment check — ${target.kind}: ${arg || '/Applications/Maude.app'}\n${'='.repeat(70)}`);

const studio = join(target.resources, 'apps', 'studio');
const binDir = join(studio, 'bin');
const stagedNodeModules = join(studio, 'node_modules');

// === Check 1 — pkgRoot: the compiled `maude` must be able to resolve helpers ===
// (G2) It walks up from the binary looking for a dir with BOTH anchors; the
// staged resources root must satisfy isPkgRoot, and (macOS) the binary lives in
// Contents/MacOS while assets are in Contents/Resources, so MAUDE_PKG_ROOT must
// bridge them. We assert the resources root IS a valid pkgRoot.
console.log('\n[1] pkgRoot resolvability (G2)');
const hasScreenshot = existsSync(join(binDir, 'screenshot.sh'));
const hasCliDesign = existsSync(join(target.resources, 'cli', 'commands', 'design.mjs'));
if (hasScreenshot && hasCliDesign) {
  ok('resources root is a valid pkgRoot', join(target.resources));
} else {
  fail(
    'resources root is NOT a valid pkgRoot — compiled `maude` will fall back to its own bin dir',
    `need BOTH anchors under ${target.resources}: apps/studio/bin/screenshot.sh=${hasScreenshot}, cli/commands/design.mjs=${hasCliDesign}. ` +
      `Stage cli/ (+ top-level package.json) into resources and set MAUDE_PKG_ROOT (sidecar.rs).`
  );
}

// === Check 2 — a bundled JS runtime for the helpers/adapter (G1, G3) ==========
console.log('\n[2] bundled JS runtime (G1 adapter, G3 bun helpers)');
// A bundled runtime is either a real `bun`/`node` shipped next to the binary,
// OR — the actual fix (RCA G1/G3) — the compiled `maude-server`/`maude`
// executables, which ARE `bun --compile` binaries and behave as the `bun` CLI
// when run with BUN_BE_BUN=1 (the adapter spawn sets it; design.mjs's shim wraps
// it for the helpers). So a bundle with any of these HAS a usable JS runtime with
// zero extra bytes.
let runtimeFound = null;
if (target.macosDir) {
  for (const name of ['bun', 'node', 'maude-server', 'maude']) {
    const cand = join(target.macosDir, name);
    if (existsSync(cand)) { runtimeFound = cand; break; }
  }
}
if (runtimeFound) {
  const viaBunBeBun = /maude(-server)?$/.test(runtimeFound);
  ok(
    'bundled JS runtime present',
    viaBunBeBun ? `${runtimeFound} (compiled Bun; used via BUN_BE_BUN=1)` : runtimeFound
  );
} else if (target.kind === 'resources') {
  warn(
    'runtime not observable from a resources-only dir',
    'the bundled `bun` launcher is staged by sidecar.rs at run time / lives in Contents/MacOS — re-run against the built .app with --smoke to verify.'
  );
} else {
  fail(
    'no bundled JS runtime (bun/node) beside the binary',
    'the ACP adapter and the 15 "bun run" design helpers need a JS runtime; none is bundled, so a machine with no node/bun cannot run them. ' +
      'Stage a "bun" launcher (compiled sidecar via BUN_BE_BUN) into Contents/MacOS and point MAUDE_ACP_RUNTIME at it.'
  );
}

// === Check 3 — every standalone helper's dep closure is staged (G4) ===========
console.log('\n[3] standalone-helper dependency closures (G4)');
const helpers = classifyHelpers(binDir);
if (!helpers.length) {
  fail('no design helpers found', `expected apps/studio/bin/*.sh under ${binDir}`);
} else {
  const routed = helpers.filter((h) => h.track === 'routed').map((h) => h.verb);
  if (routed.length) notes.push({ check: 'server-routed helpers (deps ride the compiled server)', detail: routed.join(', ') });
  const standalone = helpers.filter((h) => h.track === 'standalone' && h.entry);
  let anyDepGap = false;
  for (const h of standalone) {
    const entryFile = join(binDir, h.entry);
    if (!existsSync(entryFile)) {
      fail(`${h.verb}: entry ${h.entry} not staged`, entryFile);
      anyDepGap = true;
      continue;
    }
    const deps = collectImports(entryFile);
    const missing = deps.filter((d) => !existsSync(join(stagedNodeModules, d)));
    if (missing.length) {
      fail(`${h.verb} → ${h.entry}: missing staged deps`, `${missing.join(', ')}  (imports: ${deps.join(', ') || 'none'})`);
      anyDepGap = true;
    } else {
      ok(`${h.verb} → ${h.entry}`, deps.length ? `deps ok: ${deps.join(', ')}` : 'no npm deps');
    }
  }
  if (!anyDepGap && standalone.length) ok(`all ${standalone.length} standalone helpers have complete dep closures`);
}

// === Check 4 — optional stripped-PATH smoke against the real binary (G1–G4) ===
if (doSmoke) {
  console.log('\n[4] stripped-PATH smoke (no node/bun/claude on PATH — fresh-machine sim)');
  if (!target.binary || !existsSync(target.binary)) {
    warn('smoke skipped', `no runnable maude binary at ${target.binary}`);
  } else {
    // A minimal PATH that a fresh macOS user has — deliberately WITHOUT the dirs
    // where nvm/homebrew/curl-installers put node/bun/claude.
    const strippedPath = '/usr/bin:/bin:/usr/sbin:/sbin';
    const BAD = [
      /helper not found/i,
      /is not a dev-tooling verb/i,
      /Cannot find (module|package)/i,
      /bun is required/i,
      /command not found/i,
      /ERR_MODULE_NOT_FOUND/i,
    ];
    // Probe a representative verb from each track. `--help`/no-op so we exercise
    // resolution (pkgRoot + runtime + import) without needing real inputs.
    const probes = helpers.filter((h) => h.track !== 'other').slice(0, 12);
    for (const h of probes) {
      let output = '';
      try {
        output = execFileSync(target.binary, ['design', h.verb, '--help'], {
          env: { PATH: strippedPath, HOME: process.env.HOME || '/tmp' },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 20000,
        });
      } catch (e) {
        output = `${e.stdout || ''}${e.stderr || ''}`;
      }
      const hit = BAD.find((re) => re.test(output));
      if (hit) {
        fail(`smoke ${h.verb}`, `matched failure signature ${hit} — ${output.split('\n')[0]?.slice(0, 160)}`);
      } else {
        ok(`smoke ${h.verb}`, 'reached helper (no missing runtime/dep/helper)');
      }
    }
  }
}

// === Report ===================================================================
console.log(`\n${'='.repeat(70)}`);
if (notes.length) {
  console.log(`${YEL}Notes:${RST}`);
  for (const n of notes) console.log(`  • ${n.check}: ${DIM}${n.detail}${RST}`);
}
if (failures.length) {
  console.error(`\n${RED}BUNDLE INCOMPLETE — ${failures.length} gap(s):${RST}`);
  for (const f of failures) console.error(`  ${RED}✗${RST} ${f.check}`);
  console.error(`\nSee .ai/logs/rca/issue-acp-panel-hangs-on-nodeless-machine.md and .ai/plans/feature-desktop-standalone-bundle-completeness.md.`);
  process.exit(1);
}
console.log(`${GRN}Bundle is self-contained — all checks passed.${RST}`);
process.exit(0);
