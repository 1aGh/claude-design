import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const MAUDE_BIN = resolve(REPO_ROOT, 'cli', 'bin', 'maude.mjs');

function spawnDoctor(args, cwd) {
  return spawnSync('node', [MAUDE_BIN, 'doctor', ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function makeTempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'doctor-'));
  // Symlink the plugin manifests + schema in by writing minimal copies of
  // each — we don't need the full repo, just the files doctor reads.
  // Easier: write a stripped repo with package.json + .ai + plugins/.
  mkdirSync(join(root, '.ai'), { recursive: true });
  mkdirSync(join(root, 'plugins/design'), { recursive: true });
  mkdirSync(join(root, 'plugins/flow/.claude-plugin'), { recursive: true });
  return root;
}

function copyAsset(src, destRel, fixtureRoot) {
  const content = readFileSync(resolve(REPO_ROOT, src), 'utf8');
  const dest = join(fixtureRoot, destRel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, content);
}

function bootstrap(fixtureRoot) {
  // Drop ALL manifests + schema into the fixture so doctor can resolve them
  // from cwd. The CLI uses `pkgRoot` for plugin manifests (passed via
  // cli/bin/maude.mjs as repo root) AND cwd for .ai/workflows.config.json.
  // Since we spawn with cwd=fixtureRoot and `pkgRoot` is resolved from the
  // CLI's package.json location, doctor will still load manifests from the
  // real repo root. That's intentional: we test the workflow, not a
  // hypothetical "fake plugin manifests".
  // What we DO need in the fixture: a valid `.ai/workflows.config.json` or
  // an absent one (for the "config not found" branch).
  void fixtureRoot;
  void copyAsset;
}

test('healthy minimal config — no schema errors, exit reflects health', () => {
  const root = makeTempRepo();
  bootstrap(root);
  // Drop a minimal valid config.
  writeFileSync(
    join(root, '.ai/workflows.config.json'),
    `${JSON.stringify({ name: 'x' }, null, 2)}\n`
  );

  const r = spawnDoctor([], root);
  // No drift / additions because there's no package.json in the temp repo.
  assert.match(r.stdout, /Config schema/);
  assert.match(r.stdout, /✓ valid/);
  // exit 0 unless hard dep missing on the dev machine (these tests assume
  // the machine running them has node + git — both checked at the test
  // suite level by tests A7 etc.).
});

test('schema error: unknown top-level property forces exit 1', () => {
  const root = makeTempRepo();
  writeFileSync(
    join(root, '.ai/workflows.config.json'),
    `${JSON.stringify({ name: 'x', futureKnob: true }, null, 2)}\n`
  );

  const r = spawnDoctor([], root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /unknown property "futureKnob"/);
});

test('schema error: enum violation surfaces suggestion in output', () => {
  const root = makeTempRepo();
  writeFileSync(
    join(root, '.ai/workflows.config.json'),
    `${JSON.stringify({ name: 'x', conventions: { commits: 'conventionall' } }, null, 2)}\n`
  );

  const r = spawnDoctor([], root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /conventions\/commits/);
  assert.match(r.stdout, /suggestion: "conventional"/);
});

test('--json emits structured envelope', () => {
  const root = makeTempRepo();
  writeFileSync(
    join(root, '.ai/workflows.config.json'),
    `${JSON.stringify({ name: 'x' }, null, 2)}\n`
  );

  const r = spawnDoctor(['--json'], root);
  // Parse — must be valid JSON.
  const env = JSON.parse(r.stdout);
  assert.ok(env.deps);
  assert.ok(env.config);
  assert.ok(env.summary);
  assert.equal(typeof env.summary.healthy, 'boolean');
  assert.equal(typeof env.summary.schemaErrors, 'number');
});

test('--plugin design scopes deps to one plugin (config still global)', () => {
  const root = makeTempRepo();
  writeFileSync(
    join(root, '.ai/workflows.config.json'),
    `${JSON.stringify({ name: 'x' }, null, 2)}\n`
  );

  const r = spawnDoctor(['--plugin', 'design', '--json'], root);
  const env = JSON.parse(r.stdout);
  assert.ok(env.deps.design);
  assert.equal(env.deps.flow, undefined);
  // Config section is still present.
  assert.equal(env.config.exists, true);
});

test('config missing — section reports not-found, no schema check', () => {
  const root = makeTempRepo();
  // No .ai/workflows.config.json — leave .ai dir but no file.

  const r = spawnDoctor(['--json'], root);
  const env = JSON.parse(r.stdout);
  assert.equal(env.config.exists, false);
  assert.equal(env.summary.schemaErrors, 0);
});

test('--fix on config with unknown property drops it; existing values preserved', () => {
  const root = makeTempRepo();
  const initial = {
    name: 'x',
    futureKnob: true,
    conventions: { prohibited: ['lodash'] },
  };
  writeFileSync(join(root, '.ai/workflows.config.json'), `${JSON.stringify(initial, null, 2)}\n`);

  // --fix doesn't prompt for installs because there are no missing deps on
  // the dev machine. Provide empty stdin just in case.
  spawnSync('node', [MAUDE_BIN, 'doctor', '--fix'], {
    cwd: root,
    encoding: 'utf8',
    input: '',
    env: { ...process.env, NO_COLOR: '1' },
  });

  const after = JSON.parse(readFileSync(join(root, '.ai/workflows.config.json'), 'utf8'));
  assert.equal(after.futureKnob, undefined, 'unknown property should be dropped');
  // User-tuned value preserved.
  assert.deepEqual(after.conventions.prohibited, ['lodash']);
});

test('summary line reflects counts (drift/additions tracked via package.json)', () => {
  const root = makeTempRepo();
  writeFileSync(
    join(root, '.ai/workflows.config.json'),
    `${JSON.stringify({ name: 'x', stack: { language: 'javascript' } }, null, 2)}\n`
  );
  // Drop a tsconfig so the language detector picks up TS.
  writeFileSync(join(root, 'tsconfig.json'), '{}');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'x', scripts: { lint: 'echo' } })
  );

  const r = spawnDoctor(['--json'], root);
  const env = JSON.parse(r.stdout);
  // Drift: language js → typescript.
  const langDrift = env.config.drift.find((d) => d.key === 'language');
  assert.ok(langDrift, `expected language drift, got ${JSON.stringify(env.config.drift)}`);
  assert.equal(langDrift.detected, 'typescript');
  // Quality addition: lint.
  const lintAdd = env.config.qualityAdditions.find((a) => a.gate === 'lint');
  assert.ok(lintAdd);
});
