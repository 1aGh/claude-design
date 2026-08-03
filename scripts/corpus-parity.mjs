#!/usr/bin/env bun
// Corpus parity — Cloud Phase 25 A2, and DDR-206's third re-open condition.
//
// WHAT IS ACTUALLY AT RISK, given A1's design. The Phase 21 spike measured
// esbuild against Bun.build and found 0.6% median drift; A1 then chose to run
// the SAME Bun pipeline in the cell, so bundler drift is not the exposure any
// more — the exposure is the SANDBOX. Its import allowlist and its ceilings
// are new, they are applied only in the cell, and the way they fail is by
// refusing a canvas that has always worked. That is invisible on a laptop and
// obvious to a customer.
//
// So this builds the whole corpus THROUGH the cell's sandbox and demands that
// every canvas the desktop can build, the cell can build too. A one-sided
// failure is the failure — and its message is the diagnosis.
//
//   bun scripts/corpus-parity.mjs [--root <repo>] [--design .design] [--json]
//
// BUN, NOT NODE. The sandbox host moved into the studio with Cloud Phase 27
// (DDR-209 A′2) — one engine, one host, in the process that serves the route it
// protects — and it is TypeScript, which only Bun reads directly. Running this
// under node is what the cell does NOT do, so matching the cell is also the
// simpler option.
//
// Exits non-zero on any one-sided failure. Prints a per-canvas line either way,
// because a silent pass tells an operator nothing about coverage.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const REPO = resolve(flag('--root', process.cwd()));
const DESIGN_REL = flag('--design', '.design');
const AS_JSON = args.includes('--json');
const DESIGN_ROOT = join(REPO, DESIGN_REL);

if (!existsSync(DESIGN_ROOT)) {
  console.error(`[corpus] no design root at ${DESIGN_ROOT}`);
  process.exit(2);
}

/** Every canvas the browser door would offer. Runtime state is not a canvas. */
function canvases(dir, depth = 0, out = []) {
  if (depth > 5) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name === '.git' || e.name === 'node_modules') continue;
    const abs = join(dir, e.name);
    if (e.isDirectory()) canvases(abs, depth + 1, out);
    else if (e.name.endsWith('.tsx')) out.push(abs);
  }
  return out;
}

/** A component file with no default export is not a canvas — the door says so. */
function isMountable(abs) {
  try {
    return /export\s+default/.test(readFileSync(abs, 'utf8'));
  } catch {
    return false;
  }
}

// The cell's sandbox, imported from where the cell itself imports it.
const { buildCanvasSandboxed } = await import(
  join(REPO, 'apps/studio/canvas-build-sandbox.ts')
);

const all = canvases(DESIGN_ROOT).sort();
const targets = all.filter(isMountable);
const results = [];
let failed = 0;

for (const abs of targets) {
  const rel = relative(DESIGN_ROOT, abs).split(sep).join('/');
  const started = Date.now();
  const built = await buildCanvasSandboxed({ designRoot: DESIGN_ROOT, canvasAbs: abs });
  const ms = Date.now() - started;
  results.push({
    rel,
    ok: built.ok,
    ms,
    error: built.ok ? null : built.error,
    kind: built.kind ?? null,
  });
  if (!built.ok) failed++;
  if (!AS_JSON) {
    const mark = built.ok ? 'ok  ' : 'FAIL';
    console.log(`${mark} ${String(ms).padStart(5)}ms  ${rel}`);
    if (!built.ok) console.log(`      ${String(built.error).split('\n')[0]}`);
  }
}

const times = results
  .filter((r) => r.ok)
  .map((r) => r.ms)
  .sort((a, b) => a - b);
const p = (q) =>
  times.length ? times[Math.min(times.length - 1, Math.floor(times.length * q))] : null;
const summary = {
  corpus: all.length,
  mountable: targets.length,
  built: targets.length - failed,
  failed,
  p50Ms: p(0.5),
  p95Ms: p(0.95),
};

if (AS_JSON) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  console.log(
    `\n[corpus] ${summary.built}/${summary.mountable} built through the cell sandbox ` +
      `(${all.length} .tsx total, ${all.length - targets.length} without a default export) · ` +
      `p50 ${summary.p50Ms}ms · p95 ${summary.p95Ms}ms`
  );
}

if (failed > 0) {
  console.error(
    `\n[corpus] ${failed} canvas(es) the desktop renders cannot be built in the cell.\n` +
      `         That is A2's whole subject: the sandbox must not refuse work that\n` +
      `         has always been fine. Read the message above — it is the diagnosis.`
  );
  process.exit(1);
}
