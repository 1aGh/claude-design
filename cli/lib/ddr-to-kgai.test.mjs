import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildDdrBatch } from './ddr-to-kgai.mjs';

function fixtureDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ddr-'));
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const DDR1 = `# DDR-001: First decision

**Status:** Accepted
**Date:** 2026-01-01
**Tags:** infra, monorepo, ci

## Context
The problem is X.

## Decision
We pick A because it is simplest and safest.
`;

const DDR2 = `# DDR-002: Second decision

**Status:** Accepted
**Date:** 2026-02-02
**Tags:** auth

**Supersedes:** DDR-001
**Related:** DDR-003

## Decision
We replace the earlier approach. See DDR-001 for history and DDR-003 alongside.
`;

test('each DDR yields one decision with area + title + date + rationale', () => {
  const { batch, stats } = buildDdrBatch(fixtureDir({ 'DDR-001-x.md': DDR1 }), {});
  assert.equal(batch.decisions.length, 1);
  const d = batch.decisions[0];
  assert.equal(d.title, 'First decision');
  assert.equal(d.date, '2026-01-01');
  assert.match(d.rationale, /simplest and safest/);
  // area = primary tag, decision element, ABOUT link
  const kinds = d.mutations.map((m) => `${m.op}:${m.kind || m.link || ''}`);
  assert.ok(kinds.includes('upsert_element:area'));
  assert.ok(kinds.includes('upsert_element:decision'));
  assert.ok(kinds.includes('add_link:ABOUT'));
  assert.equal(stats.files, 1);
});

test('secondary tags become topic elements + TOUCHES links', () => {
  const { batch } = buildDdrBatch(fixtureDir({ 'DDR-001-x.md': DDR1 }), {});
  const muts = batch.decisions[0].mutations;
  const topics = muts
    .filter((m) => m.op === 'upsert_element' && m.kind === 'topic')
    .map((m) => m.name);
  assert.deepEqual(topics.sort(), ['ci', 'monorepo']); // primary 'infra' is the area, not a topic
  assert.ok(muts.some((m) => m.link === 'TOUCHES'));
});

test('typed Supersedes marker wins; bare mention does not duplicate it', () => {
  const { batch } = buildDdrBatch(fixtureDir({ 'DDR-002-y.md': DDR2 }), {});
  const links = batch.decisions[0].mutations.filter((m) => m.op === 'add_link');
  const sup = links.filter((l) => l.link === 'SUPERSEDES' && l.to === 'decision:DDR-001');
  assert.equal(
    sup.length,
    1,
    'exactly one SUPERSEDES → DDR-001 (typed marker, not duplicated by the bare mention)'
  );
  // DDR-003 came from **Related:** → REFERENCES
  assert.ok(links.some((l) => l.link === 'REFERENCES' && l.to === 'decision:DDR-003'));
});

test('scope tags are added per decision when scope is set (model A)', () => {
  const { batch } = buildDdrBatch(fixtureDir({ 'DDR-001-x.md': DDR1 }), {
    repo: 'maude',
    dept: 'dev',
  });
  const muts = batch.decisions[0].mutations;
  assert.ok(muts.some((m) => m.op === 'upsert_element' && m.kind === 'repo' && m.name === 'maude'));
  assert.ok(muts.some((m) => m.link === 'IN_REPO' && m.to === 'repo:maude'));
  assert.ok(muts.some((m) => m.link === 'IN_DEPT' && m.to === 'dept:dev'));
});

test('no scope ⇒ no scope mutations', () => {
  const { batch } = buildDdrBatch(fixtureDir({ 'DDR-001-x.md': DDR1 }), {});
  const muts = batch.decisions[0].mutations;
  assert.ok(!muts.some((m) => m.link === 'IN_REPO' || m.link === 'IN_DEPT'));
});

test('non-DDR files are ignored', () => {
  const { batch } = buildDdrBatch(fixtureDir({ 'DDR-001-x.md': DDR1, 'README.md': '# index' }), {});
  assert.equal(batch.decisions.length, 1);
});
