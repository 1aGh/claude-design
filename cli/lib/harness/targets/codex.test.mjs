import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { parse } from '@decimalturn/toml-patch';

import { createEnvironmentIR, sha256 } from '../model.mjs';
import {
  lowerCodex,
  smokeCodexConfig,
  validateCapabilityJson,
  validateCapabilityMarkdown,
  validateCodexAgent,
  validateCodexConfig,
  validateCodexSkill,
} from './codex.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('patches complete user and trusted-project TOML without changing unmanaged formatting', async () => {
  const paths = await fixturePaths();
  const existingUserToml = `# user comment\ntheme = "dark"\nproject_doc_fallback_filenames = [ "TEAM.md" ]\n\n[[plugins]]\nname = "user-owned"\n`;
  const existingProjectToml = `# project comment\nunknown_key = "preserve me"\n\n[unmanaged]\nanswer = 42\n`;
  const ir = createEnvironmentIR([
    item('instructions', 'project:CLAUDE.md', { body: '# Project' }),
    item('agents', 'project:reviewer', {
      body: 'Review carefully.',
      frontmatter: { description: 'Review changes' },
    }),
    item('commands', 'project:plan', {
      body: 'Create a grounded implementation plan.',
      frontmatter: { description: 'Plan implementation work' },
    }),
    item('skills', 'project:review', {
      body: '# Review\nInspect the change.',
      frontmatter: { description: 'Review code', name: 'review' },
      sourceClosure: [
        { content: '# Review\nInspect the change.', hash: sha256('skill'), path: 'SKILL.md' },
      ],
    }),
  ]);

  const first = await lowerCodex(ir, {
    ...paths,
    existingProjectToml,
    existingUserToml,
    projectTrusted: true,
  });
  const second = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: first.projectConfig,
    existingUserToml: first.userConfig,
    projectTrusted: true,
  });

  assert.equal(first.userConfig, existingUserToml);
  assert.match(first.projectConfig, /^# project comment/m);
  assert.match(first.projectConfig, /unknown_key = "preserve me"/);
  assert.match(first.projectConfig, /\[unmanaged\]\nanswer = 42/);
  assert.deepEqual(parse(first.projectConfig).project_doc_fallback_filenames, ['CLAUDE.md']);
  assert.equal(second.projectConfig, first.projectConfig);
  assert.equal(second.userConfig, first.userConfig);
  assert.deepEqual(
    second.outputs.map(({ contents, path }) => [path, contents]),
    first.outputs.map(({ contents, path }) => [path, contents])
  );

  assert.equal(first.outputs.filter((output) => output.metadata.kind === 'agent').length, 1);
  assert.equal(first.outputs.filter((output) => output.metadata.kind === 'skill').length, 2);
  assert.ok(first.outputs.every((output) => output.metadata.target === 'codex'));
  assert.ok(first.report.records.every((record) => record.enabled === true));
});

test('preserves existing fallback names and reports AGENTS.md shadow conflicts', async () => {
  const paths = await fixturePaths();
  await writeFile(join(paths.projectRoot, 'AGENTS.md'), '# User owned\n');
  const ir = createEnvironmentIR([
    item('instructions', 'project:CLAUDE.md', { body: '# Project' }),
  ]);
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: 'project_doc_fallback_filenames = ["TEAM.md", "CLAUDE.md"]\n',
    existingUserToml: '',
    projectTrusted: true,
  });

  assert.deepEqual(parse(result.projectConfig).project_doc_fallback_filenames, [
    'TEAM.md',
    'CLAUDE.md',
  ]);
  const record = result.report.records.find(byCategory(ir, 'instructions'));
  assert.equal(record.enabled, false);
  assert.match(record.reason, /shadows CLAUDE/i);
  assert.equal(
    result.outputs.some((output) => output.path.endsWith('/AGENTS.md')),
    false
  );
});

test('keeps all project capabilities inert when the project is not trusted', async () => {
  const paths = await fixturePaths();
  const existingProjectToml = '# untouched\nmodel_provider = "user-existing"\n';
  const ir = createEnvironmentIR([
    item('agents', 'project:reviewer', { body: 'Review.', frontmatter: {} }),
    item('mcp-stdio', 'project:docs', { command: 'docs-mcp', type: 'stdio' }),
  ]);
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml,
    existingUserToml: '',
    projectTrusted: false,
  });

  assert.equal(result.projectConfig, existingProjectToml);
  assert.ok(result.report.records.every((record) => record.enabled === false));
  assert.ok(result.report.records.every((record) => record.failClosed));
  assert.equal(
    result.outputs.some((output) => ['agent', 'skill'].includes(output.metadata.kind)),
    false
  );
});

test('invalid sources remain blocked while exact target mappings activate', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('commands', 'project:plan', { body: 'Plan project work.', frontmatter: {} }),
    item('permission-mode', 'project:plan', 'plan'),
    item('plugins', 'project:missing-plugin', { missing: true }),
  ]);
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '',
    projectTrusted: true,
  });

  assert.equal(result.report.records.find(byCategory(ir, 'commands')).enabled, true);
  assert.equal(result.report.records.find(byCategory(ir, 'permission-mode')).enabled, true);
  const command = result.report.records.find(byCategory(ir, 'commands'));
  assert.equal(command.status, 'degraded');
  assert.equal(command.failClosed, false);
  assert.equal(result.report.records.find(byCategory(ir, 'plugins')).invalidSource, true);
});

test('global MCP and permissive user authority keep global model content inert', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('instructions', 'global:CLAUDE.md', { body: '# Global instructions' }),
  ]);
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '',
    existingUserToml:
      'approval_policy = "never"\nsandbox_mode = "danger-full-access"\n\n[mcp_servers.user]\ncommand = "user-mcp"\n',
    projectTrusted: true,
  });

  assert.equal(
    result.outputs.some((output) => output.metadata.kind === 'instructions'),
    false
  );
  assert.equal(result.report.records[0].enabled, false);
  assert.match(result.report.records[0].reason, /authority|MCP/i);
});

test('never writes project provider, auth, notification, profile, or telemetry keys', async () => {
  const paths = await fixturePaths();
  const forbidden = [
    'model_provider',
    'model_providers',
    'notify',
    'profile',
    'profiles',
    'otel',
    'openai_base_url',
    'chatgpt_base_url',
  ];
  const ir = createEnvironmentIR(
    forbidden.map((name) => item('settings', `project:${name}`, { name, value: 'source-value' }))
  );
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '# project\n',
    existingUserToml: '',
    projectTrusted: true,
  });

  const project = parse(result.projectConfig);
  for (const name of forbidden) assert.equal(Object.hasOwn(project, name), false, name);
  assert.ok(result.report.records.every((record) => record.enabled === false));

  const preexisting = 'model_provider = "already-user-owned"\nnotify = ["fixture"]\n';
  const preserved = await lowerCodex(createEnvironmentIR([]), {
    ...paths,
    existingProjectToml: preexisting,
    existingUserToml: 'approval_policy = "never"\nsandbox_mode = "workspace-write"\n',
    projectTrusted: true,
  });
  assert.equal(preserved.projectConfig, preexisting);
  assert.equal(
    preserved.userConfig,
    'approval_policy = "never"\nsandbox_mode = "workspace-write"\n'
  );
});

test('maps native MCP references and rejects static sensitive headers', async () => {
  const paths = await fixturePaths();
  const stdio = item('mcp-stdio', 'global:docs', {
    args: ['serve'],
    command: 'docs-mcp',
    env: { DOCS_TOKEN: '$' + '{DOCS_TOKEN}' },
    type: 'stdio',
  });
  const remote = item('mcp-http', 'global:remote', {
    headers: {
      Authorization: 'Bearer $' + '{REMOTE_TOKEN}',
      'X-Client': 'maude',
      'X-Secret': '$' + '{REMOTE_SECRET}',
    },
    type: 'http',
    url: 'https://example.invalid/mcp',
  });
  const result = await lowerCodex(createEnvironmentIR([stdio, remote]), {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '# keep\n',
    projectTrusted: true,
  });
  const config = parse(result.userConfig);

  assert.equal(config.mcp_servers.docs.env_vars[0], 'DOCS_TOKEN');
  assert.equal(config.mcp_servers.remote.bearer_token_env_var, 'REMOTE_TOKEN');
  assert.ok(result.report.records.every((record) => record.enabled === true));

  const rejected = await lowerCodex(
    createEnvironmentIR([
      item('mcp-http', 'global:unsafe', {
        headers: { Authorization: 'Bearer literal-value' },
        type: 'http',
        url: 'https://example.invalid/mcp',
      }),
    ]),
    { ...paths, existingProjectToml: '', existingUserToml: '', projectTrusted: true }
  );
  assert.equal(parse(rejected.userConfig).mcp_servers, undefined);
  assert.equal(rejected.report.records[0].enabled, false);
});

test('source-controlled MCP activates after exact target validation', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('mcp-stdio', 'global:docs', { command: 'docs-mcp', type: 'stdio' }),
  ]);
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '',
    projectTrusted: true,
  });

  assert.equal(parse(result.userConfig).mcp_servers.docs.command, 'docs-mcp');
  assert.equal(result.report.records[0].enabled, true);
  assert.equal(result.report.records[0].failClosed, false);

  const projectIr = createEnvironmentIR([
    item('mcp-stdio', 'project:docs', { command: 'docs-mcp', type: 'stdio' }),
  ]);
  const projected = await lowerCodex(projectIr, {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '',
    projectTrusted: true,
  });
  const repeated = await lowerCodex(projectIr, {
    ...paths,
    existingProjectToml: projected.projectConfig,
    existingUserToml: '',
    projectTrusted: true,
  });
  assert.equal(repeated.report.records[0].enabled, true);
  assert.equal(repeated.projectConfig, projected.projectConfig);
});

test('narrows permissions and activates only exact persisted-trust hooks', async () => {
  const paths = await fixturePaths();
  const hook = item('hooks-command', 'project:SessionStart:40:0:0', {
    command: 'node .codex/hooks/start.mjs',
    event: 'SessionStart',
    matcher: 'startup|resume',
    timeout: 30,
  });
  const planMode = item('permission-mode', 'project:plan', 'plan');
  const unsupported = item('permissions-allow', 'project:Bash(git status)', 'Bash(git status)');
  const ir = createEnvironmentIR([hook, planMode, unsupported]);
  const inert = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '',
    projectTrusted: true,
  });
  assert.equal(inert.report.records.find(byCategory(ir, 'hooks-command')).enabled, false);

  const active = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '',
    projectTrusted: true,
    trustedHookHashes: [hook.sourceHash],
  });
  const config = parse(active.projectConfig);
  assert.equal(config.approval_policy, 'on-request');
  assert.equal(config.sandbox_mode, 'read-only');
  assert.equal(config.hooks.SessionStart.length, 1);
  assert.equal(active.report.records.find(byCategory(ir, 'hooks-command')).enabled, true);
  assert.equal(active.report.records.find(byCategory(ir, 'permission-mode')).enabled, true);
  assert.equal(active.report.records.find(byCategory(ir, 'permissions-allow')).enabled, true);

  const repeated = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: active.projectConfig,
    existingUserToml: '',
    projectTrusted: true,
    trustedHookHashes: [hook.sourceHash],
  });
  assert.equal(parse(repeated.projectConfig).hooks.SessionStart.length, 1);
});

test('projects multi-file skills and strips privilege-bearing command frontmatter', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('instructions', 'project:.claude/CLAUDE.md', { body: '# Hidden instructions' }),
    item('skills', 'project:multi', {
      body: '# Multi',
      frontmatter: { description: 'Multi-file skill', name: 'multi' },
      sourceClosure: [
        { content: '# Multi', hash: sha256('skill'), path: 'SKILL.md' },
        { content: 'Reference', hash: sha256('reference'), path: 'references/context.md' },
      ],
    }),
    item('commands', 'project:unsafe', {
      body: 'Run unrestricted commands.',
      frontmatter: { 'allowed-tools': ['Bash'], description: 'Unsafe command' },
    }),
  ]);
  const result = await lowerCodex(ir, {
    ...paths,
    existingProjectToml: '',
    existingUserToml: '',
    projectTrusted: true,
  });

  assert.equal(result.report.records.find(byCategory(ir, 'skills')).enabled, true);
  assert.equal(result.report.records.find(byCategory(ir, 'commands')).enabled, true);
  assert.equal(
    result.outputs.some((output) => output.metadata.kind === 'skill-support'),
    true
  );
  assert.equal(parse(result.projectConfig).project_doc_fallback_filenames, undefined);
});

test('semantic validators reject malformed or unsafe generated artifacts', () => {
  assert.throws(() => validateCodexConfig('broken = [', { scope: 'user' }), /invalid Codex/i);
  assert.throws(
    () => validateCodexConfig('model_provider = "x"\n', { scope: 'project' }),
    /user-only/i
  );
  assert.throws(() => validateCodexAgent('name = "x"\n'), /description|instructions/i);
  assert.throws(() => validateCodexSkill('# no frontmatter\n'), /frontmatter/i);
  assert.throws(() => validateCapabilityJson('{}'), /capability report/i);
  assert.throws(() => validateCapabilityMarkdown('# Wrong\n'), /heading/i);
});

test('isolated CODEX_HOME strict config smoke passes when codex is installed', async (context) => {
  const paths = await fixturePaths();
  const smoke = smokeCodexConfig({
    cwd: paths.projectRoot,
    env: { ...process.env, CODEX_HOME: paths.codexHome, HOME: paths.home },
  });
  if (!smoke.available) {
    context.skip('codex executable is not installed');
    return;
  }
  const result = await lowerCodex(
    createEnvironmentIR([
      item('permission-mode', 'project:plan', 'plan'),
      item('mcp-disabled', 'project:off', {
        command: 'never-started',
        disabled: true,
        type: 'stdio',
      }),
    ]),
    { ...paths, existingProjectToml: '', existingUserToml: '', projectTrusted: true }
  );
  await writeFile(paths.userConfigPath, result.userConfig);
  await writeFile(paths.projectConfigPath, result.projectConfig);
  assert.equal(
    smokeCodexConfig({
      cwd: paths.projectRoot,
      env: { ...process.env, CODEX_HOME: paths.codexHome, HOME: paths.home },
    }).available,
    true
  );
});

async function fixturePaths() {
  const root = await temporaryRoot();
  const home = join(root, 'home');
  const codexHome = join(home, '.codex');
  const projectRoot = join(root, 'project');
  const projectCodex = join(projectRoot, '.codex');
  await Promise.all([
    mkdir(join(home, '.agents', 'skills'), { recursive: true }),
    mkdir(codexHome, { recursive: true }),
    mkdir(join(projectRoot, '.agents', 'skills'), { recursive: true }),
    mkdir(projectCodex, { recursive: true }),
  ]);
  return {
    codexHome,
    home,
    outputRoot: join(codexHome, 'maude-projector'),
    projectConfigPath: join(projectCodex, 'config.toml'),
    projectRoot,
    projectSkillsRoot: join(projectRoot, '.agents', 'skills'),
    userConfigPath: join(codexHome, 'config.toml'),
    userSkillsRoot: join(home, '.agents', 'skills'),
  };
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'maude-codex-'));
  roots.push(root);
  return root;
}

function item(category, name, value) {
  return {
    category,
    contributors: [],
    name,
    origin: name.startsWith('flow:') ? 'plugin' : 'direct',
    precedence: 40,
    scope: name.startsWith('global:') ? 'global' : 'project',
    sourceHash: sha256(`${category}:${name}:${JSON.stringify(value)}`),
    sourcePath: `/fixture/${category}.md`,
    value,
  };
}

function byCategory(ir, category) {
  const sourceId = ir.items.find((candidate) => candidate.category === category).id;
  return (record) => record.sourceId === sourceId;
}
