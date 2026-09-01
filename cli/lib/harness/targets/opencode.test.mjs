import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { createEnvironmentIR, sha256 } from '../model.mjs';
import {
  lowerOpenCode,
  OPENCODE_INVENTORY_FILE,
  OPENCODE_PLUGIN_FILE,
  smokeOpenCodeConfig,
  validateCapabilityJson,
  validateCapabilityMarkdown,
  validateOpenCodeConfig,
  validateOpenCodeInventory,
} from './opencode.mjs';

const roots = [];
const SAFE_DEFAULTS = {
  permission: {
    bash: 'ask',
    edit: 'ask',
    external_directory: 'ask',
    webfetch: 'ask',
  },
  tools: { task: false, websearch: false },
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

test('golden lowering is deterministic and preserves unmanaged config', async () => {
  const paths = await fixturePaths();
  const existingConfig = {
    $schema: 'https://opencode.ai/config.json',
    autoupdate: false,
    command: { user: { template: 'user-owned' } },
    mcp: { figma: { enabled: false, type: 'remote', url: 'https://example.invalid/mcp' } },
    plugin: ['user-plugin'],
    theme: 'system',
  };
  const ir = createEnvironmentIR([
    item('commands', 'flow:plan', { body: '# Plan', frontmatter: { description: 'Plan work' } }),
    item('agents', 'flow:reviewer', { body: 'Review carefully.', frontmatter: {} }),
    item('skills', 'flow:review', { body: '# Review', frontmatter: { name: 'review' } }),
    item('instructions', 'project:CLAUDE.md', { body: '# Project' }),
    item('permissions-allow', 'project:Bash(git status)', 'Bash(git status)'),
    item('hooks-command', 'project:Stop:40:0:0', {
      command: 'never-run',
      event: 'Stop',
      type: 'command',
    }),
  ]);

  const first = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig,
  });
  const second = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig,
  });

  assert.deepEqual(
    first.outputs.map(({ contents, path }) => [path, contents]),
    second.outputs.map(({ contents, path }) => [path, contents])
  );
  const config = validateOpenCodeConfig(first.outputs[0].contents);
  assert.equal(config.theme, 'system');
  assert.deepEqual(config.command, existingConfig.command);
  assert.deepEqual(config.mcp, existingConfig.mcp);
  assert.deepEqual(config.plugin.slice(0, -1), ['user-plugin']);
  assert.equal(config.plugin.at(-1)[0].endsWith(`/${OPENCODE_PLUGIN_FILE}`), true);

  assert.equal(first.inventory.config.command['flow:plan'].template, '# Plan');
  assert.equal(first.inventory.config.agent['flow:reviewer'].mode, 'subagent');
  assert.deepEqual(first.inventory.config.permission.bash, {
    '*': 'ask',
    'git status': 'allow',
  });
  assert.deepEqual(first.inventory.environment, {});
  assert.equal(Object.hasOwn(first.inventory, 'authorityHash'), false);
  assert.equal(first.report.records.find(byCategory(ir, 'hooks-command')).enabled, false);
  assert.equal(first.report.records.find(byCategory(ir, 'commands')).enabled, true);
  assert.equal(first.report.records.find(byCategory(ir, 'skills')).enabled, true);
  assert.ok(first.outputs.every((output) => output.metadata.target === 'opencode'));
  assert.ok(first.outputs.every((output) => output.metadata.sourceHashes));
  validateOpenCodeInventory(first.outputs[1].contents);
  validateCapabilityJson(first.outputs[3].contents);
  validateCapabilityMarkdown(first.outputs[4].contents);

  const runtimeRoot = await temporaryRoot();
  await writeFile(join(runtimeRoot, OPENCODE_INVENTORY_FILE), first.outputs[1].contents);
  await writeFile(join(runtimeRoot, 'maude-projector.mjs'), first.outputs[2].contents);
  const runtime = await import(
    `${pathToFileURL(join(runtimeRoot, 'maude-projector.mjs')).href}?test=1`
  );
  const hooks = await runtime.MaudeProjectorPlugin();
  const runtimeConfig = validateOpenCodeConfig(first.outputs[0].contents);
  await hooks.config(runtimeConfig);
  assert.equal(runtimeConfig.command['flow:plan'].template, '# Plan');
  assert.equal(runtimeConfig.command.user.template, 'user-owned');
});

test('unmanaged collisions and unsafe defaults keep model-facing assets inert', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('commands', 'flow:plan', { body: '# Plan', frontmatter: {} }),
    item('skills', 'flow:review', { body: '# Review', frontmatter: {} }),
  ]);
  const result = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: { ...SAFE_DEFAULTS, permission: { ...SAFE_DEFAULTS.permission, bash: 'allow' } },
    existingConfig: { command: { 'flow:plan': { template: 'user' } }, plugin: ['user-plugin'] },
  });

  assert.equal(result.inventory.config.command, undefined);
  assert.equal(result.inventory.config.skills, undefined);
  assert.ok(result.report.records.every((record) => record.enabled === false));
  assert.match(result.report.records[0].reason, /authority/i);
});

test('invalid sources remain blocked while exact target mappings activate', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('commands', 'project:plan', { body: '# Project plan', frontmatter: {} }),
    item('permission-mode', 'project:default', 'bypassPermissions'),
    item('plugins', 'project:missing-plugin', { missing: true }),
  ]);
  const result = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig: {},
  });

  assert.equal(result.inventory.config.command.plan.template, '# Project plan');
  const command = result.report.records.find(byCategory(ir, 'commands'));
  assert.equal(command.status, 'degraded');
  assert.equal(command.enabled, true);
  assert.equal(result.report.records.find(byCategory(ir, 'plugins')).invalidSource, true);
});

test('specific allow and agent auto authority keep global model content inert', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('instructions', 'global:CLAUDE.md', { body: '# Global instructions' }),
  ]);
  const specificAllow = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig: { permission: { bash: { '*': 'ask', 'git status': 'allow' } } },
  });
  const agentAuto = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig: { agent: { build: { permission: { bash: 'auto' } } } },
  });

  assert.equal(specificAllow.inventory.config.instructions, undefined);
  assert.equal(agentAuto.inventory.config.instructions, undefined);
  assert.match(specificAllow.report.records[0].reason, /authority/i);
  assert.match(agentAuto.report.records[0].reason, /authority/i);
});

test('exact source permissions map without blanket widening', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('permissions-allow', 'project:Bash', 'Bash'),
    item('permissions-allow', 'project:Bash(git status)', 'Bash(git status)'),
    item('permissions-allow', 'project:Edit', 'Edit'),
    item('permissions-allow', 'project:Write', 'Write'),
    item('permissions-allow', 'project:mcp__docs__*', 'mcp__docs__*'),
    item('permissions-allow', 'project:Read', 'Read'),
    item('permissions-allow', 'project:Read(./src/**)', 'Read(./src/**)'),
    item('permissions-deny', 'project:Read(.env)', 'Read(.env)'),
    item('permission-mode', 'project:default', 'bypassPermissions'),
  ]);
  const result = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig: {},
  });

  assert.deepEqual(result.inventory.config.permission.bash, {
    '*': 'allow',
    'git status': 'allow',
  });
  assert.deepEqual(result.inventory.config.permission.edit, { '*': 'allow' });
  assert.deepEqual(result.inventory.config.permission['docs_*'], { '*': 'allow' });
  assert.deepEqual(result.inventory.config.permission.read, {
    '*': 'allow',
    './src/**': 'allow',
    '.env': 'deny',
  });
  assert.equal(result.report.records.find(byValue(ir, 'Bash(git status)')).enabled, true);
  assert.equal(result.report.records.find(byValue(ir, 'Read(./src/**)')).enabled, true);
  assert.equal(result.report.records.find(byValue(ir, 'Write')).enabled, true);
  assert.equal(result.report.records.find(byValue(ir, 'mcp__docs__*')).enabled, true);
  assert.equal(result.report.records.find(byValue(ir, 'bypassPermissions')).enabled, true);
});

test('MCP mappings and environment references activate under safe authority', async () => {
  const paths = await fixturePaths();
  const mcp = item('mcp-stdio', 'project:docs', {
    args: ['serve'],
    command: 'docs-mcp',
    env: { TOKEN: '$' + '{DOCS_TOKEN}' },
    type: 'stdio',
  });
  const environment = item('mcp-environment', 'project:docs', {
    env: { TOKEN: '$' + '{DOCS_TOKEN}' },
    headers: {},
  });
  const native = await lowerOpenCode(createEnvironmentIR([mcp, environment]), {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig: {},
  });
  assert.equal(native.inventory.config.mcp.docs.type, 'local');
  assert.equal(native.inventory.config.mcp.docs.environment.TOKEN, '{env:DOCS_TOKEN}');
  assert.ok(native.report.records.every((record) => record.enabled === true));

  const composed = await lowerOpenCode(
    createEnvironmentIR([
      mcp,
      environment,
      item('instructions', 'project:CLAUDE.md', { body: '# Untrusted project' }),
    ]),
    { ...paths, defaultConfig: SAFE_DEFAULTS, existingConfig: {} }
  );
  assert.equal(composed.inventory.config.mcp.docs.enabled, true);
  assert.equal(
    composed.report.records.find((record) => record.sourceId === 'mcp-stdio:project:docs').enabled,
    true
  );

  const literal = await lowerOpenCode(
    createEnvironmentIR([
      item('mcp-http', 'project:remote', {
        headers: { Authorization: 'Bearer literal' },
        type: 'http',
        url: 'https://example.invalid/mcp',
      }),
    ]),
    { ...paths, defaultConfig: SAFE_DEFAULTS, existingConfig: {} }
  );
  assert.equal(literal.inventory.config.mcp, undefined);
});

test('source-controlled MCP activates after exact target validation', async () => {
  const paths = await fixturePaths();
  const ir = createEnvironmentIR([
    item('mcp-stdio', 'global:docs', { command: 'docs-mcp', type: 'stdio' }),
  ]);
  const result = await lowerOpenCode(ir, {
    ...paths,
    defaultConfig: SAFE_DEFAULTS,
    existingConfig: {},
  });

  assert.equal(result.inventory.config.mcp.docs.command[0], 'docs-mcp');
  assert.equal(result.report.records[0].enabled, true);
  assert.equal(result.report.records[0].failClosed, false);
});

test('semantic validators reject malformed JSON, Markdown, inventory, and duplicate projector entries', async () => {
  assert.throws(() => validateOpenCodeConfig('{'), /invalid OpenCode config/i);
  assert.throws(
    () =>
      validateOpenCodeConfig(
        JSON.stringify({ plugin: ['file:///a/maude-projector.ts', 'file:///b/maude-projector.ts'] })
      ),
    /exactly one/i
  );
  assert.throws(() => validateOpenCodeInventory('{}'), /metadata/i);
  assert.throws(() => validateCapabilityJson('{}'), /capability report/i);
  assert.throws(() => validateCapabilityMarkdown('# Wrong\n'), /heading/i);
});

test('isolated HOME opencode debug config smoke passes when the executable exists', async (context) => {
  const root = await temporaryRoot();
  const home = join(root, 'home');
  const configRoot = join(home, '.config', 'opencode');
  await mkdir(configRoot, { recursive: true });
  const paths = {
    configPath: join(configRoot, 'opencode.json'),
    outputRoot: configRoot,
  };
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, '.config') };
  const defaults = smokeOpenCodeConfig({ cwd: root, env, pure: true });
  if (!defaults.available) {
    context.skip('opencode executable is not installed');
    return;
  }
  const result = await lowerOpenCode(
    createEnvironmentIR([
      item('commands', 'global:fixture', { body: 'Projected command.', frontmatter: {} }),
    ]),
    {
      ...paths,
      defaultConfig: defaults.config,
      existingConfig: {},
    }
  );
  for (const output of result.outputs.slice(0, 3)) {
    await writeFile(output.path, output.contents);
  }
  const smoke = smokeOpenCodeConfig({ cwd: root, env, pure: true });
  assert.ok(smoke.config);
  assert.equal(smoke.config.plugin?.length, 1);
});

test('generated plugin reads inventory only and contains no Claude rediscovery', async () => {
  const template = await readFile(
    new URL('../../../templates/harness/opencode/maude-projector.ts', import.meta.url),
    'utf8'
  );
  assert.match(template, new RegExp(OPENCODE_INVENTORY_FILE.replaceAll('.', '\\.')));
  assert.doesNotMatch(template, /\.claude|CLAUDE_HOME|installed_plugins|settings\.json/);
  assert.doesNotMatch(template, /child_process|spawn|execFile/);
  assert.doesNotMatch(template, /authorityHash|createHash|sha256/);
});

async function fixturePaths() {
  const root = await temporaryRoot();
  const outputRoot = join(root, 'opencode');
  await mkdir(outputRoot);
  return { configPath: join(outputRoot, 'opencode.json'), outputRoot };
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'maude-opencode-'));
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

function byValue(ir, value) {
  const sourceId = ir.items.find((candidate) => candidate.value === value).id;
  return (record) => record.sourceId === sourceId;
}
