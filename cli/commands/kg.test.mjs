import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const MAUDE_BIN = resolve(REPO_ROOT, 'cli', 'bin', 'maude.mjs');

function kg(args, cwd) {
  return spawnSync('node', [MAUDE_BIN, 'kg', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

/** Temp repo carrying a `.ai/workflows.config.json` with the given knowledgeGraph block. */
function repoWith(knowledgeGraph) {
  const root = mkdtempSync(join(tmpdir(), 'kg-test-'));
  mkdirSync(join(root, '.ai'), { recursive: true });
  const config = { name: 'fixture' };
  if (knowledgeGraph !== undefined) config.knowledgeGraph = knowledgeGraph;
  writeFileSync(join(root, '.ai', 'workflows.config.json'), JSON.stringify(config));
  return root;
}

function resolveJson(cwd) {
  const r = kg(['resolve', '--json'], cwd);
  assert.equal(r.status ?? 0, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('absent block ⇒ mode auto (opt-out default)', () => {
  const out = resolveJson(repoWith(undefined));
  assert.equal(out.mode, 'auto');
  // auto with no store ⇒ inactive regardless of whether kg is on this PATH.
  assert.equal(out.active, false);
});

test('mode:off ⇒ inactive even if kg present + store set', () => {
  const out = resolveJson(repoWith({ mode: 'off', store: 's3://x/store' }));
  assert.equal(out.mode, 'off');
  assert.equal(out.active, false);
});

test('mode:on ⇒ active (forced, independent of kg presence)', () => {
  const out = resolveJson(repoWith({ mode: 'on' }));
  assert.equal(out.active, true);
});

test('mode:auto + store ⇒ active tracks kg presence', () => {
  const out = resolveJson(repoWith({ mode: 'auto', store: 's3://co/store' }));
  // storeResolvable is true, so the only remaining gate is the kg binary.
  assert.equal(out.active, out.kgPresent);
});

test('store + scope surface in resolve', () => {
  const out = resolveJson(
    repoWith({ store: 's3://studyfi-kg/store', scope: { repo: 'maude', dept: 'dev' } })
  );
  assert.equal(out.store, 's3://studyfi-kg/store');
  assert.deepEqual(out.scope, { repo: 'maude', dept: 'dev' });
});

test('engineVersion defaults to the pinned release when absent', () => {
  const out = resolveJson(repoWith(undefined));
  assert.match(out.engineVersion, /^v\d+\.\d+\.\d+$/);
});

test('doctor prints the active line', () => {
  const r = kg(['doctor'], repoWith({ mode: 'off' }));
  assert.equal(r.status ?? 0, 0);
  assert.match(r.stdout, /active/);
  assert.match(r.stdout, /classic \.ai\/ path/);
});

test('scope verb prints the resolved scope', () => {
  const r = kg(['scope'], repoWith({ scope: { repo: 'x', dept: 'finance' } }));
  assert.equal(r.status ?? 0, 0);
  assert.deepEqual(JSON.parse(r.stdout), { repo: 'x', dept: 'finance' });
});

test('session-sync is a silent no-op when inactive', () => {
  const r = kg(['session-sync', '--warn-only'], repoWith({ mode: 'off' }));
  assert.equal(r.status ?? 0, 0);
  assert.equal(r.stdout.trim(), '');
});

test('unknown verb exits 2', () => {
  const r = kg(['frobnicate'], repoWith(undefined));
  assert.equal(r.status, 2);
});

test('help exits 0 and prints usage', () => {
  const r = kg(['help'], repoWith(undefined));
  assert.equal(r.status ?? 0, 0);
  assert.match(r.stdout, /maude kg <verb>/);
});

test('passthrough strips the maude-owned --root flag from the kg argv', () => {
  // A stub kg that echoes its argv so we can assert --root never leaks through.
  const root = repoWith({ mode: 'on' });
  const stub = join(root, 'kg-stub.sh');
  writeFileSync(stub, '#!/usr/bin/env bash\necho "ARGV:$*"\n');
  spawnSync('chmod', ['+x', stub]);
  const r = spawnSync('node', [MAUDE_BIN, 'kg', 'context', '--root', root, '--about', 'x'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', KGAI_BIN: stub },
  });
  assert.equal(r.status ?? 0, 0, r.stderr);
  assert.match(r.stdout, /ARGV:context --about x/);
  assert.doesNotMatch(r.stdout, /--root/);
});
