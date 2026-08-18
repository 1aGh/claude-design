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

/** Every place a variable could legitimately be consumed. */
function haystack() {
  const parts = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js|ts|sh|toml|yml|yaml)$/.test(e.name)) parts.push(readFileSync(p, 'utf8'));
    }
  };
  walk(join(HUB, 'src'));
  walk(join(REPO, 'cli', 'lib'));
  walk(join(REPO, 'cli', 'commands'));
  walk(join(REPO, 'infra'));
  parts.push(readFileSync(join(HUB, 'entrypoint.sh'), 'utf8'));
  parts.push(readFileSync(join(HUB, 'Dockerfile'), 'utf8'));
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
