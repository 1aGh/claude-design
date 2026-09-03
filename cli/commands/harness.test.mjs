import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { hashFile } from '../lib/harness/managed-state.mjs';
import { EXIT_CODES, observeTargetVersion, run } from './harness.mjs';

const roots = [];
const CLI = fileURLToPath(new URL('../bin/maude.mjs', import.meta.url));

afterEach(async () => {
  process.exitCode = 0;
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('target version discovery skips the Maude Codex launcher shim', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maude-codex-version-')));
  roots.push(root);
  const shimRoot = join(root, 'shim');
  const realRoot = join(root, 'real');
  await mkdir(shimRoot);
  await mkdir(realRoot);
  await writeFile(
    join(shimRoot, 'codex'),
    '#!/bin/sh\n# exec maude codex "$@"\necho shim-must-not-run >&2\nexit 2\n'
  );
  await writeFile(join(realRoot, 'codex'), '#!/bin/sh\necho "codex-cli 0.152.0"\n');
  await chmod(join(shimRoot, 'codex'), 0o755);
  await chmod(join(realRoot, 'codex'), 0o755);
  const previousPath = process.env.PATH;
  process.env.PATH = `${shimRoot}:${realRoot}`;
  try {
    assert.equal(observeTargetVersion('codex'), '0.152.0');
  } finally {
    process.env.PATH = previousPath;
  }
});

test('every projection verb uses explicit project scope and sync is a byte-identical no-op', async () => {
  const fixture = await createFixture();
  const base = ['--targets', 'opencode', '--project', fixture.project];

  const preview = cli(fixture, ['migrate', '--from', 'claude', ...base, '--json']);
  assert.equal(preview.exitCode, EXIT_CODES.drift);
  assert.equal(JSON.parse(preview.stdout).drift, true);
  await assert.rejects(stat(join(fixture.project, 'opencode.json')), { code: 'ENOENT' });

  assert.equal(
    cli(fixture, ['migrate', '--from', 'claude', ...base, '--yes']).exitCode,
    EXIT_CODES.clean
  );
  const manifestPath = await projectManifestPath(fixture);
  const before = await readFile(manifestPath);

  assert.equal(cli(fixture, ['check', ...base]).exitCode, EXIT_CODES.clean);
  assert.equal(cli(fixture, ['diff', ...base]).exitCode, EXIT_CODES.clean);
  assert.equal(cli(fixture, ['sync', ...base]).exitCode, EXIT_CODES.clean);
  assert.deepEqual(await readFile(manifestPath), before);

  const status = cli(fixture, ['status', '--project', fixture.project, '--json']);
  assert.equal(status.exitCode, EXIT_CODES.clean);
  const value = JSON.parse(status.stdout);
  assert.deepEqual(value.ownedTargets, ['opencode']);
  assert.equal(value.drift, false);
  assert.match(value.generation, /^[a-f0-9]{64}$/);
  assert.equal(typeof value.counts.native, 'number');
  assert.equal(typeof value.lastValidation, 'string');
  assert.deepEqual(value.observedTargetVersions, { opencode: null });
  assert.equal(value.rollbackAvailable, false);
});

test('byte-identical unmanaged target files remain user-owned without adoption', async () => {
  const fixture = await createFixture();
  const args = ['sync', '--targets', 'codex', '--project', fixture.project, '--json'];
  assert.equal(cli(fixture, args).exitCode, EXIT_CODES.clean);

  const manifestPath = await projectManifestPath(fixture);
  const first = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(first.outputs.length > 0, true);
  await rm(manifestPath);

  const second = cli(fixture, args);
  assert.equal(second.exitCode, EXIT_CODES.clean, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout).conflicts, []);
  assert.equal(await readOptional(manifestPath), null);
});

test('global scope, target lists, and all-target transactional sync stay inside isolated homes', async () => {
  const fixture = await createFixture();
  const realConfig = join(fixture.realHome, '.config', 'opencode', 'opencode.json');
  const realConfigBefore = await readOptional(realConfig);
  const result = cli(fixture, ['sync', '--targets', 'opencode,codex', '--global', '--json']);
  assert.equal(result.exitCode, EXIT_CODES.clean, result.stderr);
  assert.equal(JSON.parse(result.stdout).changed.length > 0, true);
  assert.equal(await exists(join(fixture.home, '.config', 'opencode', 'opencode.json')), true);
  assert.equal(await exists(join(fixture.home, '.codex', 'config.toml')), true);
  assert.deepEqual(await readOptional(realConfig), realConfigBefore);
});

test('dogfood source and project target roots stay separate from the active workspace', async () => {
  const fixture = await createFixture();
  const sourceHome = join(fixture.root, 'source-home');
  const targetProject = join(fixture.root, 'target-project');
  await mkdir(join(sourceHome, '.claude'), { recursive: true });
  await writeFile(join(sourceHome, '.claude', 'settings.json'), '{"theme":"dark"}\n');

  const result = spawnFixture(
    fixture,
    ['sync', '--targets', 'opencode,codex', '--project', fixture.project, '--json'],
    {
      MAUDE_HARNESS_PROJECT_TARGET_ROOT: targetProject,
      MAUDE_HARNESS_SOURCE_HOME: sourceHome,
    }
  );
  assert.equal(result.status, EXIT_CODES.clean, result.stderr);
  assert.equal(await exists(join(targetProject, 'opencode.json')), true);
  assert.equal(await exists(join(targetProject, '.codex', 'config.toml')), true);
  assert.equal(await exists(join(fixture.project, 'opencode.json')), false);
  assert.equal(await exists(join(fixture.project, '.codex', 'config.toml')), false);
});

test('removed sources delete every stale target output in the same all-target generation', async () => {
  const fixture = await createFixture();
  const args = ['sync', '--targets', 'opencode,codex', '--project', fixture.project, '--json'];
  assert.equal(cli(fixture, args).exitCode, EXIT_CODES.clean);
  const manifestPath = await projectManifestPath(fixture);
  const before = JSON.parse(await readFile(manifestPath, 'utf8'));
  const stalePaths = [
    ['opencode', join(fixture.project, '.opencode', 'removed-source.md')],
    ['codex', join(fixture.project, '.codex', 'maude', 'removed-source.md')],
  ];
  for (const [, path] of stalePaths) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, 'stale managed source output\n');
  }
  before.outputs.push(
    ...(await Promise.all(
      stalePaths.map(async ([target, path]) => ({
        hash: await hashFile(path),
        ownership: 'generated',
        path,
        target,
      }))
    ))
  );
  await writeFile(manifestPath, `${JSON.stringify(before, null, 2)}\n`);

  await writeFile(stalePaths[0][1], 'externally modified stale output\n');
  assert.equal(cli(fixture, args).exitCode, EXIT_CODES.ownership);
  assert.equal(await exists(stalePaths[0][1]), true);
  assert.equal(await exists(stalePaths[1][1]), true);
  assert.equal(
    JSON.parse(await readFile(manifestPath, 'utf8')).outputs.length,
    before.outputs.length
  );
  await writeFile(stalePaths[0][1], 'stale managed source output\n');

  assert.equal(cli(fixture, args).exitCode, EXIT_CODES.clean);
  const after = JSON.parse(await readFile(manifestPath, 'utf8'));
  const active = new Set(after.outputs.map((output) => output.path));
  const stale = before.outputs.filter((output) => !active.has(output.path));

  assert.equal(stale.length > 0, true);
  assert.equal(new Set(stale.map((output) => output.target)).size, 2);
  for (const output of stale) assert.equal(await exists(output.path), false, output.path);
});

test('production mutations reject diagnostic executable and target-root overrides', async () => {
  const fixture = await createFixture();
  const base = ['--targets', 'opencode', '--project', fixture.project];
  const production = { MAUDE_HARNESS_CONFORMANCE: undefined };

  assert.equal(spawnFixture(fixture, ['sync', ...base], production).status, EXIT_CODES.usage);
  assert.equal(
    spawnFixture(fixture, ['sync', ...base], {
      ...production,
      MAUDE_HARNESS_PROJECT_TARGET_ROOT: join(fixture.root, 'target-project'),
      MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF: undefined,
    }).status,
    EXIT_CODES.usage
  );
  assert.notEqual(spawnFixture(fixture, ['check', ...base], production).status, EXIT_CODES.usage);
});

test('adopt previews noninteractively, confirms explicitly, and remove restores the backup', async () => {
  const fixture = await createFixture();
  const config = join(fixture.project, '.codex', 'config.toml');
  await mkdir(join(fixture.project, '.codex'), { recursive: true });
  await writeFile(config, '# user-owned\ntheme = "dark"\n');
  const args = ['--target', 'codex', '--path', config, '--project', fixture.project];

  assert.equal(cli(fixture, ['adopt', ...args]).exitCode, EXIT_CODES.drift);
  assert.equal(cli(fixture, ['adopt', ...args, '--yes']).exitCode, EXIT_CODES.clean);
  const status = JSON.parse(
    cli(fixture, ['status', '--project', fixture.project, '--json']).stdout
  );
  assert.equal(status.rollbackAvailable, true);

  assert.equal(
    cli(fixture, ['remove', '--target', 'codex', '--project', fixture.project, '--yes']).exitCode,
    EXIT_CODES.clean
  );
  assert.equal(await readFile(config, 'utf8'), '# user-owned\ntheme = "dark"\n');
});

test('interactive confirmation applies a complete migrate diff without --yes', async () => {
  const fixture = await createFixture();
  await withEnvironment(fixture, async () => {
    const output = memoryStream();
    const response = await run({
      args: ['migrate', '--from', 'claude', '--targets', 'opencode', '--project', fixture.project],
      io: {
        confirm: async (question) => {
          assert.match(question, /apply this migration/i);
          return true;
        },
        stderr: memoryStream(),
        stdout: output,
      },
    });
    assert.equal(response.exitCode, EXIT_CODES.clean, response.error);
  });
  assert.equal(await exists(join(fixture.project, 'opencode.json')), true);
});

test('scope, target, source, strict, ownership, and interruption exit codes are stable', async () => {
  const fixture = await createFixture();
  assert.equal(cli(fixture, ['status']).exitCode, EXIT_CODES.usage);
  assert.equal(
    cli(fixture, ['status', '--global', '--project', fixture.project]).exitCode,
    EXIT_CODES.usage
  );
  assert.equal(
    cli(fixture, ['check', '--targets', 'other', '--project', fixture.project]).exitCode,
    EXIT_CODES.target
  );

  await mkdir(join(fixture.home, '.claude'), { recursive: true });
  await writeFile(join(fixture.home, '.claude', 'settings.json'), '{');
  assert.equal(
    cli(fixture, ['check', '--targets', 'opencode', '--global']).exitCode,
    EXIT_CODES.source
  );
  await writeFile(join(fixture.home, '.claude', 'settings.json'), '{"theme":"dark"}\n');
  assert.equal(
    cli(fixture, ['check', '--targets', 'opencode', '--global', '--strict']).exitCode,
    EXIT_CODES.drift
  );

  await writeFile(
    join(fixture.home, '.claude', 'settings.json'),
    '{"hooks":{"Stop":[{"hooks":[{"type":"http","url":"https://example.invalid/hook"}]}]}}\n'
  );
  assert.equal(
    cli(fixture, ['check', '--targets', 'opencode', '--global', '--strict']).exitCode,
    EXIT_CODES.strict
  );
  await writeFile(join(fixture.home, '.claude', 'settings.json'), '{"theme":"dark"}\n');

  await writeFile(join(fixture.project, 'opencode.json'), '{}\n');
  assert.equal(
    cli(fixture, [
      'migrate',
      '--from',
      'claude',
      '--targets',
      'opencode',
      '--project',
      fixture.project,
      '--yes',
    ]).exitCode,
    EXIT_CODES.ownership
  );

  await rm(join(fixture.project, 'opencode.json'));
  const scopeDir = join(fixture.state, 'global');
  await mkdir(scopeDir, { mode: 0o700, recursive: true });
  await writeFile(join(scopeDir, 'transaction.json'), '{');
  assert.equal(
    cli(fixture, ['sync', '--targets', 'opencode', '--global']).exitCode,
    EXIT_CODES.interrupted
  );
});

test('--yes cannot bypass literal secrets or invalid adoption paths', async () => {
  const fixture = await createFixture();
  await mkdir(join(fixture.home, '.claude'), { recursive: true });
  await writeFile(
    join(fixture.home, '.claude', 'settings.json'),
    '{"env":{"API_TOKEN":"literal-secret-value"}}\n'
  );
  assert.equal(
    cli(fixture, ['migrate', '--from', 'claude', '--targets', 'opencode', '--global', '--yes'])
      .exitCode,
    EXIT_CODES.strict
  );

  const outside = join(fixture.root, 'outside.json');
  await writeFile(outside, '{}\n');
  assert.equal(
    cli(fixture, [
      'adopt',
      '--target',
      'opencode',
      '--path',
      outside,
      '--project',
      fixture.project,
      '--yes',
    ]).exitCode,
    EXIT_CODES.target
  );
});

async function createFixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'maude-harness-command-')));
  roots.push(root);
  const home = join(root, 'home');
  const project = join(root, 'project');
  const state = join(root, 'state');
  await Promise.all([
    mkdir(home, { recursive: true }),
    mkdir(project, { recursive: true }),
    mkdir(state, { mode: 0o700, recursive: true }),
  ]);
  return { home, project, realHome: resolve(process.env.HOME), root, state };
}

function cli(fixture, args) {
  const result = spawnFixture(fixture, args);
  return { exitCode: result.status, stderr: result.stderr, stdout: result.stdout };
}

function spawnFixture(fixture, args, environment = {}) {
  return spawnSync(process.execPath, [CLI, 'harness', ...args], {
    cwd: fixture.project,
    encoding: 'utf8',
    env: { ...fixtureEnvironment(fixture), ...environment },
  });
}

async function withEnvironment(fixture, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(fixtureEnvironment(fixture))) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  const cwd = process.cwd();
  process.chdir(fixture.project);
  try {
    return await callback();
  } finally {
    process.chdir(cwd);
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function fixtureEnvironment(fixture) {
  return {
    ...process.env,
    CODEX_HOME: join(fixture.home, '.codex'),
    HOME: fixture.home,
    MAUDE_HARNESS_CONFORMANCE: '1',
    MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF: '1',
    MAUDE_HARNESS_STATE_ROOT: fixture.state,
    MAUDE_NO_UPDATE_CHECK: '1',
    XDG_CONFIG_HOME: join(fixture.home, '.config'),
  };
}

async function projectManifestPath(fixture) {
  const names = (await import('node:fs/promises')).readdir(fixture.state);
  const scope = (await names).find((name) => name !== 'global');
  return join(fixture.state, scope, 'manifest.json');
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function readOptional(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function memoryStream() {
  return {
    value: '',
    write(chunk) {
      this.value += chunk;
    },
  };
}
