// Docs that break the build when they lie — Track D D6.
//
// The plan's own Problem #4 is a README stale since 2026-05-28, describing a
// phase that had already shipped. The remedy for that cannot be five more
// hand-written pages and a nine-stage skill: that is the same problem, five
// times, written more recently.
//
// So every `HUB_*` / `MAUDE_*` token that appears in the hub's documentation
// must exist somewhere that can actually read it. A page naming a variable the
// code has never heard of is the exact failure this catches — and it catches
// it at `pnpm test`, not when an operator sets it and nothing happens.
//
// Deliberately one-directional: documenting every variable is a goal, not a
// gate (some are internal to the cell and would be noise in a self-host page).
// Naming one that does not exist is always a bug.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const here = new URL('.', import.meta.url).pathname;
const HUB = join(here, '..');
const REPO = join(HUB, '..', '..');

/** Strip line and block comments, so a var named only in prose does not count. */
function decomment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Every place a variable could legitimately be consumed — REACHABILITY-AWARE.
 *
 * The first cut of this test read a blob of every file under `src/`, which made
 * it a spell-checker: a variable named only in dead code (a module nothing
 * imports) passed. That is exactly how the unwired OIDC surface once satisfied
 * "docs that break when they lie" while the behaviour it named did not exist.
 *
 * So crawl the import graph from the real entry points and read only what is
 * reachable, with comments stripped. A `HUB_*` var that survives here is one
 * some running code path actually consults.
 */
function haystack() {
  const seen = new Set();
  const parts = [];
  const resolveImport = (fromFile, spec) => {
    if (!spec.startsWith('.')) return null;
    const p = join(fromFile, '..', spec);
    for (const cand of [p, `${p}.mjs`, `${p}.js`, `${p}.ts`, join(p, 'index.mjs')]) {
      if (existsSync(cand) && !cand.endsWith('/')) return cand;
    }
    return null;
  };
  const crawl = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    parts.push(decomment(src));
    for (const m of src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g)) {
      const target = resolveImport(file, m[1]);
      if (target) crawl(target);
    }
  };
  // The real entry points: the server, the cold-start path, and the CLI that
  // renders deployments.
  crawl(join(HUB, 'src', 'server.mjs'));
  crawl(join(HUB, 'src', 'rehydrate.mjs'));
  crawl(join(REPO, 'cli', 'commands', 'hub.mjs'));
  crawl(join(REPO, 'cli', 'commands', 'hub-workspace.mjs'));
  crawl(join(REPO, 'cli', 'lib', 'workspace-plan.mjs'));
  crawl(join(REPO, 'cli', 'commands', 'design.mjs'));
  // Shell + Docker + infra are read whole (no import graph), comments stripped.
  for (const f of [
    join(HUB, 'entrypoint.sh'),
    join(HUB, 'Dockerfile'),
    join(REPO, 'infra', 'cell', 'entrypoint.sh'),
  ]) {
    if (existsSync(f)) parts.push(decomment(readFileSync(f, 'utf8')));
  }
  return parts.join('\n');
}

/** Every documentation surface that talks about this hub. */
function docs() {
  const out = [];
  const add = (p) => {
    if (existsSync(p)) out.push([p, readFileSync(p, 'utf8')]);
  };
  add(join(HUB, 'README.md'));
  const site = join(REPO, 'site', 'content', 'docs', 'hub');
  if (existsSync(site)) {
    for (const f of readdirSync(site)) if (f.endsWith('.mdx')) add(join(site, f));
  }
  const skill = join(REPO, 'plugins', 'design', 'skills', 'self-host');
  if (existsSync(skill)) {
    for (const f of readdirSync(skill)) if (f.endsWith('.md')) add(join(skill, f));
  }
  return out;
}

test('every HUB_*/MAUDE_* variable named in the docs exists in the code', () => {
  const code = haystack();
  const unknown = [];
  for (const [path, text] of docs()) {
    for (const m of text.matchAll(/\b((?:HUB|MAUDE)_[A-Z0-9_]{2,})\b/g)) {
      const name = m[1];
      // A placeholder in a template, not a claim about a real variable.
      if (/_(?:X|N|FOO|BAR)$/.test(name)) continue;
      if (!code.includes(name)) unknown.push(`${path.replace(REPO, '')} → ${name}`);
    }
  }
  assert.deepEqual(
    unknown,
    [],
    `documentation names variables no code reads:\n  ${unknown.join('\n  ')}`
  );
});

test('the README does not still advertise itself as unfinished Phase 9', () => {
  // The literal staleness the plan opened on: "deploy templates land in a
  // subsequent slice" was written 2026-05-28 and was wrong for months.
  const readme = readFileSync(join(HUB, 'README.md'), 'utf8');
  assert.ok(
    !/land in a subsequent slice/i.test(readme),
    'the README still promises work that has shipped'
  );
});
