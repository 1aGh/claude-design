import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { discoverClaude } from './discover-claude.mjs';
import { createEnvironmentIR } from './model.mjs';
import { lowerCodex } from './targets/codex.mjs';
import { lowerOpenCode } from './targets/opencode.mjs';
import { runManagedTransaction, transactionFailpoints } from './transaction.mjs';

const CLI = fileURLToPath(new URL('../../bin/maude.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('../../fixtures/harness', import.meta.url));
const TRANSACTION = new URL('./transaction.mjs', import.meta.url).href;
const roots = [];
const SECRET_SENTINELS = [
  'T8_LITERAL_SECRET_SENTINEL_7f3dce9b',
  'T8_MCP_SECRET_SENTINEL_89c0a712',
  'T8_HEADER_SECRET_SENTINEL_96a20f4e',
];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('committed fixture has exhaustive provenance, safe target statuses, and golden output trees', async () => {
  const fixture = await materializeFixture();
  const discovered = await discoverClaude({ home: fixture.home, projectRoot: fixture.project });
  const globalIr = createEnvironmentIR(discovered.items.filter((item) => item.scope === 'global'));
  const projectIr = createEnvironmentIR(
    discovered.items.filter((item) => item.scope === 'project')
  );

  assert.ok(globalIr.items.length > 0);
  assert.ok(projectIr.items.length > 0);
  assert.equal(
    projectIr.items.find((item) => item.name === 'project:NODE_ENV').value.value,
    'test'
  );
  assert.ok(projectIr.items.some((item) => item.name === 'fixture:plugin-command'));
  assert.ok(projectIr.items.some((item) => item.name === 'project:duplicate'));
  assert.ok(globalIr.items.some((item) => item.name === 'global:duplicate'));
  assert.ok(projectIr.items.some((item) => item.category === 'hooks-http'));
  assert.ok(projectIr.items.some((item) => item.category === 'hooks-agent'));
  assert.ok(projectIr.items.some((item) => item.category === 'hooks-unknown'));

  const opencode = await lowerOpenCode(projectIr, {
    configPath: join(fixture.project, 'opencode.json'),
    defaultConfig: safeOpenCodeDefaults(),
    existingConfig: JSON.parse(await readFile(join(fixture.project, 'opencode.json'), 'utf8')),
    outputRoot: join(fixture.project, '.opencode'),
  });
  const codex = await lowerCodex(projectIr, {
    existingProjectToml: await readFile(join(fixture.project, '.codex', 'config.toml'), 'utf8'),
    existingUserToml: await readFile(join(fixture.home, '.codex', 'config.toml'), 'utf8'),
    outputRoot: join(fixture.project, '.codex', 'maude'),
    projectConfigPath: join(fixture.project, '.codex', 'config.toml'),
    projectRoot: fixture.project,
    projectSkillsRoot: join(fixture.project, '.agents', 'skills'),
    projectTrusted: true,
    userConfigPath: join(fixture.home, '.codex', 'config.toml'),
    userSkillsRoot: join(fixture.home, '.agents', 'skills'),
  });

  for (const result of [opencode, codex]) {
    assert.equal(result.report.records.length, projectIr.items.length);
    assert.deepEqual(
      result.report.records.map((record) => record.sourceId).sort(),
      projectIr.items.map((item) => item.id).sort()
    );
    assert.equal(
      new Set(result.report.records.map((record) => record.sourceId)).size,
      projectIr.items.length
    );
  }
  assert.ok(projectIr.items.every((item) => item.contributors.length > 0));
  assert.ok(
    projectIr.items.every((item) => item.contributors.every((source) => source.sourcePath))
  );

  const openPermission = opencode.inventory.config.permission;
  assert.equal(openPermission.bash['rm *'], 'deny');
  assert.equal(openPermission.read['./secrets/**'], 'deny');
  assert.match(codex.projectConfig, /approval_policy = "on-request"/);
  assert.match(codex.projectConfig, /sandbox_mode = "read-only"/);

  await assertGolden('opencode', opencode.outputs, fixture);
  await assertGolden('codex', codex.outputs, fixture);
  assert.equal(await exists(fixture.hookMarker), false);
});

test('C1 operational drill preserves unmanaged bytes through sync, conflict, remove, and re-migrate', async () => {
  const fixture = await materializeFixture({ operational: true });
  const unmanagedBefore = await unmanagedSnapshot(fixture);

  assert.equal(
    cli(fixture, [
      'adopt',
      '--target',
      'opencode',
      '--path',
      join(fixture.project, 'opencode.json'),
      '--project',
      fixture.project,
      '--yes',
    ]).status,
    0
  );
  assert.equal(
    cli(fixture, [
      'adopt',
      '--target',
      'codex',
      '--path',
      join(fixture.project, '.codex', 'config.toml'),
      '--project',
      fixture.project,
      '--yes',
    ]).status,
    0
  );
  const migrate = cli(fixture, [
    'migrate',
    '--from',
    'claude',
    '--targets',
    'opencode,codex',
    '--project',
    fixture.project,
    '--yes',
    '--json',
  ]);
  assert.equal(migrate.status, 0, `${migrate.stderr}\n${migrate.stdout}`);

  const manifestPath = await projectManifestPath(fixture);
  const manifestOne = await readFile(manifestPath);
  const managed = JSON.parse(manifestOne).outputs;
  const treeOne = await managedTree(managed);
  const second = cli(fixture, [
    'sync',
    '--targets',
    'opencode,codex',
    '--project',
    fixture.project,
    '--json',
  ]);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(await readFile(manifestPath), manifestOne);
  assert.deepEqual(await managedTree(managed), treeOne);
  assert.deepEqual(await unmanagedSnapshot(fixture), unmanagedBefore);

  const edited = managed.find((output) => output.ownership === 'generated');
  await writeFile(edited.path, 'external edit sentinel\n');
  const beforeConflict = await fullTargetSnapshot(fixture);
  const conflict = cli(fixture, [
    'sync',
    '--targets',
    'opencode,codex',
    '--project',
    fixture.project,
    '--json',
  ]);
  assert.equal(conflict.status, 4);
  assert.deepEqual(await fullTargetSnapshot(fixture), beforeConflict);
  await writeFile(edited.path, treeOne[edited.path]);

  for (const target of ['opencode', 'codex']) {
    assert.equal(
      cli(fixture, ['remove', '--target', target, '--project', fixture.project, '--yes']).status,
      0
    );
  }
  const removedManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.deepEqual(removedManifest.outputs, []);
  for (const output of managed.filter((item) => item.ownership === 'generated')) {
    assert.equal(await exists(output.path), false, output.path);
  }
  assert.deepEqual(await unmanagedSnapshot(fixture), unmanagedBefore);

  assert.equal(
    cli(fixture, [
      'adopt',
      '--target',
      'opencode',
      '--path',
      join(fixture.project, 'opencode.json'),
      '--project',
      fixture.project,
      '--yes',
    ]).status,
    0
  );
  assert.equal(
    cli(fixture, [
      'adopt',
      '--target',
      'codex',
      '--path',
      join(fixture.project, '.codex', 'config.toml'),
      '--project',
      fixture.project,
      '--yes',
    ]).status,
    0
  );
  assert.equal(
    cli(fixture, [
      'migrate',
      '--from',
      'claude',
      '--targets',
      'opencode,codex',
      '--project',
      fixture.project,
      '--yes',
    ]).status,
    0
  );
  assert.equal(await exists(fixture.hookMarker), false);
  await assertNoSentinels(fixture.root);
});

test('malformed sources and literal secrets fail closed without target or state mutation', async () => {
  for (const hostile of ['malformed-settings.txt', 'literal-secret-settings.json']) {
    const fixture = await materializeFixture({ operational: true });
    await cp(join(FIXTURES, 'hostile', hostile), join(fixture.project, '.claude', 'settings.json'));
    if (hostile.includes('literal-secret')) {
      await cp(
        join(FIXTURES, 'hostile', 'literal-secret-mcp.json'),
        join(fixture.project, '.mcp.json')
      );
    }
    const before = await fullTargetSnapshot(fixture);
    const result = cli(fixture, [
      'migrate',
      '--from',
      'claude',
      '--targets',
      'opencode,codex',
      '--project',
      fixture.project,
      '--yes',
      '--json',
    ]);
    assert.equal(result.status, hostile.startsWith('malformed') ? 5 : 3);
    assert.deepEqual(await fullTargetSnapshot(fixture), before);
    for (const sentinel of SECRET_SENTINELS) {
      assert.equal(result.stdout.includes(sentinel), false);
      assert.equal(result.stderr.includes(sentinel), false);
    }
    assert.equal(await exists(fixture.hookMarker), false);
    await assertNoSentinels(fixture.state);
  }
});

test('target-version drift and absent executables are non-mutating and explicit', async () => {
  const fixture = await materializeFixture({ operational: true });
  const before = await fullTargetSnapshot(fixture);
  const absent = cli(
    fixture,
    ['check', '--targets', 'opencode,codex', '--project', fixture.project, '--json'],
    { PATH: '' }
  );
  assert.notEqual(absent.status, 6);
  assert.deepEqual(JSON.parse(absent.stdout).observedTargetVersions, {
    codex: null,
    opencode: null,
  });
  assert.deepEqual(await fullTargetSnapshot(fixture), before);

  const bin = join(fixture.root, 'bin');
  await mkdir(bin);
  const fake = join(bin, 'opencode');
  await writeFile(fake, '#!/bin/sh\necho 9.9.9\n');
  await chmod(fake, 0o700);
  const drift = cli(
    fixture,
    ['check', '--targets', 'opencode', '--project', fixture.project, '--json'],
    { PATH: bin, MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF: undefined }
  );
  assert.equal(drift.status, 6);
  assert.match(drift.stderr, /unsupported opencode version 9\.9\.9/i);
  assert.deepEqual(await fullTargetSnapshot(fixture), before);
});

test('SIGKILL recovery succeeds at every supported transaction failpoint', {
  timeout: 120_000,
}, async () => {
  for (const failpoint of transactionFailpoints({ existingIndexes: [0, 1], outputCount: 2 })) {
    const root = await temporaryRoot(`maude-harness-kill-${failpoint.replaceAll(':', '-')}-`);
    const scopeDir = join(root, 'state');
    const targetRoot = join(root, 'target');
    await Promise.all([mkdir(scopeDir, { mode: 0o700 }), mkdir(targetRoot)]);
    const first = join(targetRoot, 'first.txt');
    const second = join(targetRoot, 'second.txt');
    const marker = join(scopeDir, 'committed');
    await Promise.all([writeFile(first, 'old-first\n'), writeFile(second, 'old-second\n')]);
    const child = spawn(process.execPath, ['--input-type=module', '-e', KILL_CHILD], {
      env: {
        ...process.env,
        FAILPOINT: failpoint,
        FIRST: first,
        MARKER: marker,
        SCOPE: scopeDir,
        SECOND: second,
        TARGET: targetRoot,
        TRANSACTION,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const [ready] = await once(child.stdout, 'data');
    assert.equal(ready.toString(), `${failpoint}\n`);
    child.kill('SIGKILL');
    await once(child, 'exit');

    const committed = await exists(marker);
    await runManagedTransaction({
      allowRoots: [targetRoot],
      generationId: `recover-${failpoint.replaceAll(':', '-')}`,
      isGenerationCommitted: async () => committed,
      outputs: [{ contents: 'recovery-probe\n', path: join(targetRoot, 'probe.txt') }],
      scopeDir,
      staleAgeMs: 0,
    });
    assert.equal(
      await readFile(first, 'utf8'),
      committed ? 'new-first\n' : 'old-first\n',
      failpoint
    );
    assert.equal(
      await readFile(second, 'utf8'),
      committed ? 'new-second\n' : 'old-second\n',
      failpoint
    );
    assert.equal(
      (await readdir(targetRoot)).some((name) => name.startsWith('.maude-')),
      false,
      failpoint
    );
    assert.equal(await exists(join(scopeDir, 'transaction.json')), false, failpoint);
    assert.equal(await exists(join(scopeDir, 'transaction.lock')), false, failpoint);
  }
});

async function materializeFixture({ operational = false } = {}) {
  const root = await temporaryRoot('maude-harness-conformance-');
  const home = join(root, 'home');
  const project = join(root, 'project');
  const state = join(root, 'state');
  const hookMarker = join(root, 'HOOK-EXECUTED');
  await Promise.all([
    cp(join(FIXTURES, 'claude-home'), home, { recursive: true }),
    cp(join(FIXTURES, 'project'), project, { recursive: true }),
    mkdir(state, { mode: 0o700 }),
  ]);
  await replacePlaceholders(home, {
    '{{HOME}}': home,
    '{{HOOK_MARKER}}': hookMarker,
    '{{PROJECT}}': project,
  });
  await replacePlaceholders(project, {
    '{{HOME}}': home,
    '{{HOOK_MARKER}}': hookMarker,
    '{{PROJECT}}': project,
  });
  await mkdir(join(home, '.codex'), { recursive: true });
  await writeFile(
    join(home, '.codex', 'config.toml'),
    `# user target plugin\n[[plugins]]\nname = "user-codex-plugin"\n\n[projects."${tomlString(project)}"]\ntrust_level = "trusted"\n`
  );
  if (operational) {
    await rm(join(project, '.claude'), { recursive: true });
    await rm(join(project, '.mcp.json'));
    await rm(join(project, '.ai'), { recursive: true });
    await rm(join(project, '.design'), { recursive: true });
    await rm(join(project, 'CLAUDE.md'));
    await rm(join(home, '.claude', 'settings.json'));
    await rm(join(home, '.claude.json'));
  }
  return {
    env: fixtureEnvironment({ home, project, state }),
    home,
    hookMarker,
    project,
    root,
    state,
  };
}

function cli(fixture, args, overrides = {}) {
  const env = { ...fixture.env, ...overrides };
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete env[key];
  return spawnSync(process.execPath, [CLI, 'harness', ...args], {
    cwd: fixture.project,
    encoding: 'utf8',
    env,
  });
}

function fixtureEnvironment({ home, state }) {
  return {
    ...process.env,
    CODEX_HOME: join(home, '.codex'),
    HOME: home,
    MAUDE_HARNESS_CONFORMANCE: '1',
    MAUDE_HARNESS_SKIP_EXECUTABLE_PROOF: '1',
    MAUDE_HARNESS_STATE_ROOT: state,
    MAUDE_NO_UPDATE_CHECK: '1',
    XDG_CONFIG_HOME: join(home, '.config'),
  };
}

async function assertGolden(target, outputs, fixture) {
  const actual = await normalizedGolden(outputs, fixture);
  const path = join(FIXTURES, 'expected', target, 'golden-tree.json');
  if (process.env.MAUDE_UPDATE_HARNESS_GOLDENS === '1') {
    await writeFile(path, `${JSON.stringify(actual, null, 2)}\n`);
  }
  assert.deepEqual(actual, JSON.parse(await readFile(path, 'utf8')));
}

async function normalizedGolden(outputs, fixture) {
  const entries = {};
  for (const output of outputs) {
    entries[normalizeText(output.path, fixture)] = normalizeText(String(output.contents), fixture);
  }
  return entries;
}

function normalizeText(value, fixture) {
  return value
    .replaceAll(fixture.project, '<PROJECT>')
    .replaceAll(fixture.home, '<HOME>')
    .replaceAll(fixture.root, '<ROOT>')
    .replaceAll(/sha256:[a-f0-9]{64}/g, 'sha256:<HASH>');
}

async function replacePlaceholders(root, replacements) {
  for (const path of await files(root)) {
    let text = await readFile(path, 'utf8');
    for (const [token, value] of Object.entries(replacements)) text = text.replaceAll(token, value);
    await writeFile(path, text);
  }
}

async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.isFile()) result.push(path);
  }
  return result.sort();
}

async function unmanagedSnapshot(fixture) {
  const paths = [
    join(fixture.project, 'AGENTS.md'),
    join(fixture.project, '.opencode', 'user-owned.txt'),
    join(fixture.project, '.codex', 'user-owned.txt'),
  ];
  return Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await readFile(path, 'utf8')]))
  );
}

async function fullTargetSnapshot(fixture) {
  const rootsToRead = [
    join(fixture.project, 'opencode.json'),
    join(fixture.project, '.opencode'),
    join(fixture.project, '.codex'),
  ];
  const entries = {};
  for (const root of rootsToRead) {
    if (!(await exists(root))) continue;
    const info = await lstat(root);
    const paths = info.isDirectory() ? await files(root) : [root];
    for (const path of paths) entries[relative(fixture.root, path)] = await readFile(path, 'utf8');
  }
  return entries;
}

async function managedTree(outputs) {
  return Object.fromEntries(
    await Promise.all(
      outputs.map(async (output) => [output.path, await readFile(output.path, 'utf8')])
    )
  );
}

async function projectManifestPath(fixture) {
  const name = (await readdir(fixture.state)).find((entry) => entry !== 'global');
  return join(fixture.state, name, 'manifest.json');
}

async function assertNoSentinels(root) {
  if (!(await exists(root))) return;
  for (const path of await files(root)) {
    const text = await readFile(path, 'utf8');
    for (const sentinel of SECRET_SENTINELS) assert.equal(text.includes(sentinel), false, path);
  }
}

async function temporaryRoot(prefix) {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
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

function safeOpenCodeDefaults() {
  return {
    permission: { bash: 'ask', edit: 'ask', external_directory: 'ask', webfetch: 'ask' },
    tools: { task: false, websearch: false },
  };
}

function tomlString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

const KILL_CHILD = `
const { readFile, writeFile } = await import('node:fs/promises');
const { hashFile } = await import(new URL('./managed-state.mjs', process.env.TRANSACTION));
const { runManagedTransaction } = await import(process.env.TRANSACTION);
await runManagedTransaction({
  allowRoots: [process.env.TARGET],
  commitManifest: async () => writeFile(process.env.MARKER, 'kill-generation\\n'),
  failpoint: async (name) => {
    if (name !== process.env.FAILPOINT) return;
    process.stdout.write(name + '\\n');
    await new Promise(() => {});
  },
  generationId: 'kill-generation',
  outputs: [
    { contents: 'new-first\\n', expectedHash: await hashFile(process.env.FIRST), path: process.env.FIRST },
    { contents: 'new-second\\n', expectedHash: await hashFile(process.env.SECOND), path: process.env.SECOND },
  ],
  scopeDir: process.env.SCOPE,
});
`;
