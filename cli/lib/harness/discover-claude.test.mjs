import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import { discoverClaude } from './discover-claude.mjs';
import { sha256 } from './model.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'maude-harness-discovery-'));
  roots.push(root);
  const home = join(root, 'home');
  const claudeHome = join(home, '.claude');
  const projectRoot = join(root, 'project');
  await Promise.all([
    mkdir(join(claudeHome, 'commands'), { recursive: true }),
    mkdir(join(claudeHome, 'plugins'), { recursive: true }),
    mkdir(join(projectRoot, '.claude', 'commands'), { recursive: true }),
  ]);
  return { root, home, claudeHome, projectRoot };
}

async function json(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function item(ir, category, name) {
  return ir.items.find((candidate) => candidate.category === category && candidate.name === name);
}

test('resolves settings precedence while retaining every contributor', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  await json(join(claudeHome, 'settings.json'), {
    env: {
      GLOBAL_ONLY: '$' + '{GLOBAL_ONLY}',
      NODE_ENV: 'development',
      TOKEN: '$' + '{TEST_TOKEN}',
    },
    permissions: { allow: ['Read'], deny: ['Read(.env)'] },
  });
  await json(join(projectRoot, '.claude', 'settings.json'), {
    env: { NODE_ENV: 'production', PROJECT_ONLY: '$' + '{PROJECT_ONLY}' },
    permissions: { allow: ['Write'] },
  });
  await json(join(projectRoot, '.claude', 'settings.local.json'), {
    env: { NODE_ENV: 'test' },
  });

  const ir = await discoverClaude({ home, projectRoot });
  const nodeEnvironment = item(ir, 'environment', 'project:NODE_ENV');
  assert.deepEqual(nodeEnvironment.value, { name: 'NODE_ENV', value: 'test' });
  assert.equal(nodeEnvironment.contributors.length, 3);
  assert.match(nodeEnvironment.sourcePath, /settings\.local\.json$/);
  assert.deepEqual(item(ir, 'environment', 'global:TOKEN').secretReferences, [
    { kind: 'env', name: 'TEST_TOKEN' },
  ]);

  const permissions = item(ir, 'settings', 'permissions');
  assert.equal(permissions, undefined);
  assert.equal(item(ir, 'settings', 'env'), undefined);
  assert.ok(item(ir, 'permissions-allow', 'global:0:Read'));
  assert.ok(item(ir, 'permissions-allow', 'project:0:Write'));
});

test('configured environment values redact DSNs and userinfo before serialized IR', async () => {
  const { home, projectRoot } = await fixture();
  const sentinels = {
    database: 'DATABASE_SENTINEL_PASSWORD',
    directDsn: 'DIRECT_DSN_SENTINEL_CAPABILITY',
    dsn: 'DSN_SENTINEL_CAPABILITY',
    redis: 'REDIS_SENTINEL_PASSWORD',
    redisUrl: 'REDIS_URL_SENTINEL_PASSWORD',
  };
  await json(join(projectRoot, '.claude', 'settings.json'), {
    env: {
      CI: 'false',
      DATABASE_URL: `postgres://app:${sentinels.database}@db.invalid/studyfi`,
      DSN: `https://dsn.invalid/${sentinels.directDsn}`,
      LANG: 'cs_CZ.UTF-8',
      NODE_ENV: 'production',
      OBSERVABILITY_TARGET: `https://example.invalid/project/${sentinels.dsn}`,
      PUBLIC_ENDPOINT: `redis://default:${sentinels.redis}@cache.invalid:6379`,
      REDIS_URL: `redis://default:${sentinels.redisUrl}@cache.invalid:6379`,
      REFERENCED_DATABASE: '$' + '{DATABASE_URL}',
      REFERENCED_KEYCHAIN: 'keychain:maude/database',
      TZ: 'Europe/Prague',
    },
  });

  const ir = await discoverClaude({ home, projectRoot });
  for (const sentinel of Object.values(sentinels)) {
    assert.equal(ir.serialized.includes(sentinel), false, `IR leaked ${sentinel}`);
  }
  for (const name of [
    'DATABASE_URL',
    'DSN',
    'OBSERVABILITY_TARGET',
    'PUBLIC_ENDPOINT',
    'REDIS_URL',
  ]) {
    assert.deepEqual(item(ir, 'environment', `project:${name}`).value.value, {
      $maudeSecret: 'literal-rejected',
    });
  }
  assert.equal(item(ir, 'environment', 'project:NODE_ENV').value.value, 'production');
  assert.equal(item(ir, 'environment', 'project:CI').value.value, 'false');
  assert.equal(item(ir, 'environment', 'project:LANG').value.value, 'cs_CZ.UTF-8');
  assert.equal(item(ir, 'environment', 'project:TZ').value.value, 'Europe/Prague');
  assert.deepEqual(item(ir, 'environment', 'project:REFERENCED_DATABASE').secretReferences, [
    { kind: 'env', name: 'DATABASE_URL' },
  ]);
  assert.deepEqual(item(ir, 'environment', 'project:REFERENCED_KEYCHAIN').secretReferences, [
    { kind: 'keychain', name: 'maude/database' },
  ]);
});

test('discovers namespaced global/project/plugin assets and effective plugin selection', async () => {
  const { home, claudeHome, projectRoot, root } = await fixture();
  const userPlugin = join(root, 'plugins', 'user-flow');
  const projectPlugin = join(root, 'plugins', 'project-flow');
  const disabledPlugin = join(root, 'plugins', 'disabled');
  await Promise.all(
    [userPlugin, projectPlugin, disabledPlugin].map((path) =>
      mkdir(join(path, 'commands'), { recursive: true })
    )
  );
  await writeFile(join(claudeHome, 'commands', 'plan.md'), '# Global plan\n', 'utf8');
  await writeFile(join(projectRoot, '.claude', 'commands', 'plan.md'), '# Project plan\n', 'utf8');
  await writeFile(
    join(projectPlugin, 'commands', 'plan.md'),
    '---\ndescription: Plugin plan\ntools: [Read, Grep]\n---\n# Plugin plan\n',
    'utf8'
  );
  await writeFile(join(disabledPlugin, 'commands', 'hidden.md'), '# Hidden\n', 'utf8');
  await json(join(claudeHome, 'settings.json'), {
    enabledPlugins: {
      'flow@maude': true,
      'disabled@maude': false,
      'missing@maude': true,
    },
  });
  await json(join(claudeHome, 'plugins', 'installed_plugins.json'), {
    plugins: {
      'flow@maude': [
        { installPath: userPlugin, scope: 'user' },
        { installPath: projectPlugin, projectPath: projectRoot, scope: 'project' },
      ],
      'disabled@maude': [{ installPath: disabledPlugin, scope: 'user' }],
    },
  });

  const ir = await discoverClaude({
    home,
    projectRoot,
    allowedPluginRoots: [join(root, 'plugins')],
  });
  const commandNames = ir.items
    .filter((candidate) => candidate.category === 'commands')
    .map((candidate) => candidate.name);
  assert.deepEqual(commandNames, ['flow:plan', 'global:plan', 'project:plan']);
  assert.equal(item(ir, 'commands', 'flow:plan').value.frontmatter.description, 'Plugin plan');
  assert.deepEqual(item(ir, 'commands', 'flow:plan').value.frontmatter.tools, ['Read', 'Grep']);
  assert.equal(
    ir.items.some((candidate) => candidate.name === 'disabled:hidden'),
    false
  );
  assert.equal(
    ir.items.some((candidate) => candidate.sourcePath.startsWith(userPlugin)),
    false
  );
  assert.equal(item(ir, 'plugins', 'missing@maude').value.missing, true);
});

test('discovers instructions, rules, skills, MCP, hooks, state roots, and kgai', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  await Promise.all([
    mkdir(join(projectRoot, '.claude', 'rules'), { recursive: true }),
    mkdir(join(projectRoot, '.claude', 'skills', 'review'), { recursive: true }),
    mkdir(join(projectRoot, '.ai'), { recursive: true }),
    mkdir(join(projectRoot, '.design'), { recursive: true }),
  ]);
  await writeFile(join(claudeHome, 'CLAUDE.md'), '# Global instructions\n', 'utf8');
  await writeFile(join(projectRoot, 'CLAUDE.md'), '# Project instructions\n', 'utf8');
  await writeFile(join(projectRoot, '.claude', 'rules', 'safe.md'), '# Safe rule\n', 'utf8');
  await writeFile(
    join(projectRoot, '.claude', 'skills', 'review', 'SKILL.md'),
    '---\nname: review\ndescription: Review code\n---\n# Review\n',
    'utf8'
  );
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: {
      local: { type: 'stdio', command: 'safe-fixture', args: ['--stdio'] },
      remote: { type: 'http', url: 'https://example.invalid/mcp', disabled: true },
    },
  });
  await json(join(projectRoot, '.claude', 'settings.json'), {
    hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'fixture' }] }] },
  });
  await json(join(projectRoot, '.ai', 'workflows.config.json'), {
    name: 'fixture',
    knowledgeGraph: { mode: 'auto', scope: { repo: 'fixture', dept: 'dev' } },
  });

  const ir = await discoverClaude({ home, projectRoot });
  assert.equal(ir.items.filter((candidate) => candidate.category === 'instructions').length, 2);
  assert.ok(item(ir, 'rules', 'project:safe'));
  assert.ok(item(ir, 'skills', 'project:review'));
  assert.ok(item(ir, 'mcp-stdio', 'project:local'));
  assert.ok(item(ir, 'mcp-disabled', 'project:remote'));
  assert.ok(item(ir, 'hooks-command', 'project:PreToolUse:40:0:0'));
  assert.ok(item(ir, 'ai-state', 'project:.ai'));
  assert.ok(item(ir, 'design-state', 'project:.design'));
  assert.ok(item(ir, 'kgai', 'project:kgai'));
});

test('rejects malformed JSON with a source-specific diagnostic', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  await writeFile(join(claudeHome, 'settings.json'), '{ broken', 'utf8');
  await assert.rejects(
    discoverClaude({ home, projectRoot }),
    /invalid JSON.*\.claude\/settings\.json/i
  );
});

test('fails closed for non-boolean plugin flags and keeps instruction imports review-only', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  await json(join(claudeHome, 'settings.json'), { enabledPlugins: { 'unsafe@local': 'false' } });
  await assert.rejects(discoverClaude({ home, projectRoot }), /enabledPlugins.*must be boolean/i);

  await json(join(claudeHome, 'settings.json'), {});
  await writeFile(join(projectRoot, 'public.md'), '# Public\n', 'utf8');
  await writeFile(join(projectRoot, 'CLAUDE.md'), '@../private.md\n@./public.md\n', 'utf8');
  const ir = await discoverClaude({ home, projectRoot });
  assert.equal(
    item(ir, 'instruction-imports', 'project:CLAUDE.md:import:0').value.contained,
    false
  );
  assert.equal(item(ir, 'instruction-imports', 'project:CLAUDE.md:import:1').value.contained, true);
});

test('redacts credential-bearing MCP args and URL parameters without retaining literals', async () => {
  const { home, projectRoot } = await fixture();
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: {
      local: { type: 'stdio', command: 'fixture', args: ['--api-key', 'ordinary-secret'] },
      env: {
        type: 'stdio',
        command: 'fixture',
        env: { AWS_SECRET_ACCESS_KEY: 'ordinary-access-key' },
        args: ['-H', 'Authorization: Basic ordinary-basic'],
      },
      remote: { type: 'http', url: 'https://example.invalid/mcp?auth=ordinary-header' },
    },
  });
  const serialized = JSON.stringify(await discoverClaude({ home, projectRoot }));
  assert.equal(serialized.includes('ordinary-secret'), false);
  assert.equal(serialized.includes('ordinary-header'), false);
  assert.equal(serialized.includes('ordinary-access-key'), false);
  assert.equal(serialized.includes('ordinary-basic'), false);
  assert.match(serialized, /literal-rejected/);
});

test('redacts every MCP env and sensitive-header argv encoding before serialized IR', async () => {
  const { home, projectRoot } = await fixture();
  const sentinels = [
    'SPLIT_ENV_SENTINEL',
    'EQUALS_ENV_SENTINEL',
    'SHORT_ENV_SENTINEL',
    'SPLIT_HEADER_SENTINEL',
    'EQUALS_HEADER_SENTINEL',
    'SHORT_HEADER_SENTINEL',
    'SHORT_SPLIT_HEADER_SENTINEL',
  ];
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: {
      argv: {
        type: 'stdio',
        command: 'fixture',
        args: [
          '--env',
          `API_TOKEN=${sentinels[0]}`,
          `--env=DATABASE_URL=postgres://app:${sentinels[1]}@db.invalid/studyfi`,
          `-eREDIS_URL=redis://default:${sentinels[2]}@cache.invalid:6379`,
          '--header',
          `Authorization:Bearer ${sentinels[3]}`,
          `--header=X-Api-Key:${sentinels[4]}`,
          `-HAuthorization:Bearer ${sentinels[5]}`,
          '-H',
          `X-Api-Key:${sentinels[6]}`,
          '--env=NODE_ENV=production',
          '--env=API_TOKEN=$' + '{MCP_TOKEN}',
          '-eDATABASE_URL={env:DATABASE_URL}',
          '--header=Authorization:$' + '{AUTH_HEADER}',
          '-HX-Api-Key:keychain:maude/mcp-api-key',
        ],
      },
    },
  });

  const ir = await discoverClaude({ home, projectRoot });
  for (const sentinel of sentinels) {
    assert.equal(ir.serialized.includes(sentinel), false, `IR leaked ${sentinel}`);
  }
  const argv = item(ir, 'mcp-stdio', 'project:argv');
  assert.deepEqual(argv.value.secretStatus, { $maudeSecret: 'literal-rejected' });
  const serializedArgs = JSON.stringify(argv.value.args);
  for (const reference of ['MCP_TOKEN', 'DATABASE_URL', 'AUTH_HEADER', 'maude/mcp-api-key']) {
    assert.equal(serializedArgs.includes(reference), true);
  }
  assert.equal(serializedArgs.includes('NODE_ENV=production'), true);
});

test('redacts generic credential URIs from Markdown and structured settings before IR', async () => {
  const { home, projectRoot } = await fixture();
  const sentinels = {
    jdbc: 'IR_JDBC_PASSWORD_SENTINEL',
    markdown: 'IR_MARKDOWN_PASSWORD_SENTINEL',
    query: 'IR_QUERY_TOKEN_SENTINEL',
    redis: 'IR_REDIS_PASSWORD_SENTINEL',
  };
  await json(join(projectRoot, '.claude', 'settings.json'), {
    telemetry: {
      alpha: `jdbc:postgresql://db.invalid/studyfi?password=${sentinels.jdbc}`,
      beta: `redis://default:${sentinels.redis}@cache.invalid:6379`,
      gamma: `https://example.invalid/ingest?token=${sentinels.query}`,
    },
  });
  await writeFile(
    join(projectRoot, '.claude', 'commands', 'dsn.md'),
    `Connect with postgres://app:${sentinels.markdown}@db.invalid/studyfi\n`,
    'utf8'
  );

  const ir = await discoverClaude({ home, projectRoot });
  for (const sentinel of Object.values(sentinels)) {
    assert.equal(ir.serialized.includes(sentinel), false, `IR leaked ${sentinel}`);
  }
  assert.deepEqual(item(ir, 'commands', 'project:dsn').value.secretStatus, {
    $maudeSecret: 'literal-rejected',
  });
});

test('rejects symlink escapes instead of traversing them', async () => {
  const { home, projectRoot, root } = await fixture();
  const outside = join(root, 'outside.md');
  await writeFile(outside, '# Outside\n', 'utf8');
  await symlink(outside, join(projectRoot, '.claude', 'commands', 'escaped.md'));
  await assert.rejects(discoverClaude({ home, projectRoot }), /symlink.*escaped\.md/i);
});

test('rejects state-root symlink escapes and unapproved plugin roots', async () => {
  const { home, claudeHome, projectRoot, root } = await fixture();
  const outsideState = join(root, 'outside-ai');
  await mkdir(outsideState);
  await symlink(outsideState, join(projectRoot, '.ai'));
  await assert.rejects(discoverClaude({ home, projectRoot }), /\.ai.*escapes|symlink.*\.ai/i);

  await rm(join(projectRoot, '.ai'));
  const pluginRoot = join(root, 'unapproved-plugin');
  await mkdir(pluginRoot);
  await json(join(claudeHome, 'settings.json'), { enabledPlugins: { 'unsafe@local': true } });
  await json(join(claudeHome, 'plugins', 'installed_plugins.json'), {
    plugins: { 'unsafe@local': [{ installPath: pluginRoot, scope: 'user' }] },
  });
  await assert.rejects(discoverClaude({ home, projectRoot }), /plugin.*outside approved roots/i);
});

test('rejects duplicate stable identities and invalid JSON shapes', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  await Promise.all([
    mkdir(join(projectRoot, '.claude', 'rules', 'a'), { recursive: true }),
    mkdir(join(projectRoot, '.claude', 'rules', 'b'), { recursive: true }),
  ]);
  await writeFile(join(projectRoot, '.claude', 'rules', 'a', 'safe.md'), '# A\n', 'utf8');
  await writeFile(join(projectRoot, '.claude', 'rules', 'b', 'safe.md'), '# B\n', 'utf8');
  const ir = await discoverClaude({ home, projectRoot });
  assert.ok(item(ir, 'rules', 'project:a/safe'));
  assert.ok(item(ir, 'rules', 'project:b/safe'));

  await writeFile(join(claudeHome, 'settings.json'), 'null\n', 'utf8');
  await assert.rejects(discoverClaude({ home, projectRoot }), /settings\.json.*object/i);
});

test('classifies unknown hook types explicitly and bounds directory entries', async () => {
  const { home, projectRoot } = await fixture();
  await json(join(projectRoot, '.claude', 'settings.json'), {
    hooks: { Stop: [{ hooks: [{ type: 'future-handler', value: 'fixture' }] }] },
  });
  assert.ok(
    item(await discoverClaude({ home, projectRoot }), 'hooks-unknown', 'project:Stop:40:0:0')
  );

  for (let index = 0; index < 3; index += 1) {
    await writeFile(join(projectRoot, '.claude', 'commands', `${index}.txt`), 'ignored', 'utf8');
  }
  await assert.rejects(
    discoverClaude({ home, projectRoot, limits: { maxEntries: 2 } }),
    /exceeds 2 directory entries/i
  );
});

test('rejects unsafe MCP shapes and literal credentials in Markdown bodies', async () => {
  const { home, projectRoot } = await fixture();
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: { unsafe: { type: 'future', command: 'fixture' } },
  });
  await assert.rejects(discoverClaude({ home, projectRoot }), /MCP.*unsupported type/i);

  await rm(join(projectRoot, '.mcp.json'));
  await writeFile(
    join(projectRoot, '.claude', 'commands', 'leak.md'),
    '# Never copy ghp_1234567890abcdef\n',
    'utf8'
  );
  const ir = await discoverClaude({ home, projectRoot });
  const leaked = item(ir, 'commands', 'project:leak');
  assert.equal(leaked.value.body.includes('ghp_1234567890abcdef'), false);
  assert.deepEqual(leaked.value.secretStatus, { $maudeSecret: 'literal-rejected' });
});

test('removes embedded authorization and opaque context secrets from every discovered body and MCP argv form', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  const secrets = {
    agent: 'aG3mP8xR1vN6tK9wD4sH7jL2qF5bY0c',
    command: 'Q29tbWFuZFVzZXI6U2VjcmV0MTIzNDU2Nzg5MA==',
    hook: 'hT8mQ2vR7xN4pK9wD6sL1jF5bY3cZ0a',
    instruction: 'iK7vN2xQ9mR4tY8cD6sH3jL1wF5bZ0a',
    mcpConcatenatedLong: 'mA7vN2xQ9rR4tY8cD6sH3jL1wF5bZ0a',
    mcpConcatenatedShort: 'mB7vN2xQ9rR4tY8cD6sH3jL1wF5bZ0a',
    mcpSplitLong: 'mC7vN2xQ9rR4tY8cD6sH3jL1wF5bZ0a',
    mcpSplitShort: 'mD7vN2xQ9rR4tY8cD6sH3jL1wF5bZ0a',
    skill: 'sK7vN2xQ9mR4tY8cD6sH3jL1wF5bZ0a',
  };
  await Promise.all([
    mkdir(join(projectRoot, '.claude', 'agents'), { recursive: true }),
    mkdir(join(projectRoot, '.claude', 'skills', 'secret-skill'), { recursive: true }),
  ]);
  await writeFile(
    join(projectRoot, 'CLAUDE.md'),
    `curl -H 'Authorization: Maude ${secrets.instruction}' https://example.invalid\n`
  );
  await writeFile(
    join(projectRoot, '.claude', 'commands', 'secret.md'),
    `curl -H "Authorization: Basic ${secrets.command}" https://example.invalid\n`
  );
  await writeFile(
    join(projectRoot, '.claude', 'agents', 'secret.md'),
    `env API_TOKEN=${secrets.agent} run-agent\n`
  );
  await writeFile(
    join(projectRoot, '.claude', 'skills', 'secret-skill', 'SKILL.md'),
    `---\nname: secret-skill\n---\ncurl -H Authorization:Maude ${secrets.skill}\n`
  );
  await json(join(claudeHome, 'settings.json'), {
    hooks: {
      Stop: [
        {
          hooks: [
            {
              command: `curl -H 'Authorization: Maude ${secrets.hook}' https://example.invalid`,
              type: 'command',
            },
          ],
        },
      ],
    },
  });
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: {
      concatenatedLong: {
        args: [`--header=Authorization: Maude ${secrets.mcpConcatenatedLong}`],
        command: 'fixture',
      },
      concatenatedShort: {
        args: [`-HAuthorization: Maude ${secrets.mcpConcatenatedShort}`],
        command: 'fixture',
      },
      splitLong: {
        args: ['--header', `Authorization: Maude ${secrets.mcpSplitLong}`],
        command: 'fixture',
      },
      splitShort: {
        args: ['-H', `Authorization: Maude ${secrets.mcpSplitShort}`],
        command: 'fixture',
      },
    },
  });

  const ir = await discoverClaude({ home, projectRoot });
  for (const [name, secret] of Object.entries(secrets)) {
    assert.equal(ir.serialized.split(secret).length - 1, 0, `IR leaked ${name}`);
  }
  for (const category of ['instructions', 'commands', 'agents', 'skills', 'hooks-command']) {
    assert.ok(
      ir.items.some(
        (candidate) =>
          candidate.category === category &&
          JSON.stringify(candidate.value).includes('literal-rejected')
      ),
      `${category} was not marked rejected`
    );
  }
  for (const name of Object.keys(secrets).filter((candidate) => candidate.startsWith('mcp'))) {
    const serverName = `${name[3].toLowerCase()}${name.slice(4)}`;
    const server = ir.items.find(
      (candidate) => candidate.category === 'mcp-stdio' && candidate.name.endsWith(serverName)
    );
    assert.deepEqual(server.value.secretStatus, { $maudeSecret: 'literal-rejected' });
  }
});

test('enforces file size and inventory count bounds', async () => {
  const { home, claudeHome, projectRoot } = await fixture();
  await writeFile(join(claudeHome, 'commands', 'large.md'), 'x'.repeat(65), 'utf8');
  await assert.rejects(
    discoverClaude({ home, projectRoot, limits: { maxFileBytes: 64 } }),
    /exceeds.*64 bytes/i
  );

  await writeFile(join(claudeHome, 'commands', 'large.md'), 'small', 'utf8');
  await writeFile(join(projectRoot, '.claude', 'commands', 'second.md'), 'small', 'utf8');
  await assert.rejects(
    discoverClaude({ home, projectRoot, limits: { maxItems: 1 } }),
    /inventory exceeds 1 items/i
  );
});

test('missing optional paths are valid and repeated discovery is byte-deterministic', async () => {
  const { home, projectRoot } = await fixture();
  const first = await discoverClaude({ home, projectRoot });
  const second = await discoverClaude({ home, projectRoot });
  assert.equal(first.serialized, second.serialized);
  assert.equal(first.generationHash, second.generationHash);
});

test('plugin-only discovery ignores unrelated project state symlinks', async () => {
  const { home, projectRoot, root } = await fixture();
  const externalDesign = join(root, 'external-design');
  await mkdir(externalDesign, { recursive: true });
  await symlink(externalDesign, join(projectRoot, '.design'));

  const ir = await discoverClaude({ home, profile: 'plugins', projectRoot });

  assert.ok(ir.items.every((entry) => entry.category === 'plugins'));
});

test('runtime discovery includes permissions without traversing unrelated project state', async () => {
  const { home, projectRoot, root } = await fixture();
  const externalDesign = join(root, 'external-design');
  await mkdir(externalDesign, { recursive: true });
  await symlink(externalDesign, join(projectRoot, '.design'));
  await json(join(projectRoot, '.claude', 'settings.json'), {
    permissions: { defaultMode: 'bypassPermissions', deny: ['Read(.env)'] },
  });

  const ir = await discoverClaude({ home, profile: 'runtime', projectRoot });

  assert.ok(ir.items.some((entry) => entry.category === 'permission-mode'));
  assert.ok(ir.items.some((entry) => entry.category === 'permissions-deny'));
  assert.ok(
    ir.items.every(
      (entry) => entry.category === 'plugins' || entry.category.startsWith('permission')
    )
  );
});

test('plugin-only discovery can ignore project plugin selection for an untrusted target', async () => {
  const { home, claudeHome, projectRoot, root } = await fixture();
  const pluginRoot = join(root, 'plugins', 'flow');
  await mkdir(pluginRoot, { recursive: true });
  await json(join(projectRoot, '.claude', 'settings.json'), {
    enabledPlugins: { 'flow@maude': true },
  });
  await json(join(claudeHome, 'plugins', 'installed_plugins.json'), {
    plugins: { 'flow@maude': [{ installPath: pluginRoot, scope: 'user' }] },
  });

  const trusted = await discoverClaude({
    allowedPluginRoots: [join(root, 'plugins')],
    home,
    profile: 'plugins',
    projectRoot,
  });
  const untrusted = await discoverClaude({
    allowedPluginRoots: [join(root, 'plugins')],
    home,
    includeProjectSettings: false,
    profile: 'plugins',
    projectRoot,
  });

  assert.equal(
    trusted.items.some((entry) => entry.name === 'flow@maude'),
    true
  );
  assert.equal(
    untrusted.items.some((entry) => entry.name === 'flow@maude'),
    false
  );
});

test('untrusted plugin discovery cannot prefer a project-scoped install', async () => {
  const { home, claudeHome, projectRoot, root } = await fixture();
  const userPlugin = join(root, 'plugins', 'user-flow');
  const projectPlugin = join(projectRoot, '.claude', 'plugins', 'flow');
  await Promise.all([
    mkdir(userPlugin, { recursive: true }),
    mkdir(projectPlugin, { recursive: true }),
  ]);
  await json(join(claudeHome, 'settings.json'), {
    enabledPlugins: { 'flow@maude': true },
  });
  await json(join(claudeHome, 'plugins', 'installed_plugins.json'), {
    plugins: {
      'flow@maude': [
        { installPath: projectPlugin, projectPath: projectRoot, scope: 'project' },
        { installPath: userPlugin, scope: 'user' },
      ],
    },
  });

  const trusted = await discoverClaude({
    allowedPluginRoots: [join(root, 'plugins')],
    home,
    profile: 'plugins',
    projectRoot,
  });
  const untrusted = await discoverClaude({
    allowedPluginRoots: [join(root, 'plugins')],
    home,
    includeProjectSettings: false,
    profile: 'plugins',
    projectRoot,
  });

  assert.equal(
    item(trusted, 'plugins', 'flow@maude').value.installPath,
    await realpath(projectPlugin)
  );
  assert.equal(
    item(untrusted, 'plugins', 'flow@maude').value.installPath,
    await realpath(userPlugin)
  );
});

test('skill approvals cover every regular file in deterministic relative-path order', async () => {
  const { home, projectRoot } = await fixture();
  const skillRoot = join(projectRoot, '.claude', 'skills', 'review');
  await Promise.all([
    mkdir(join(skillRoot, 'references'), { recursive: true }),
    mkdir(join(skillRoot, 'scripts'), { recursive: true }),
  ]);
  await writeFile(join(skillRoot, 'SKILL.md'), '---\nname: review\n---\n# Review\n', 'utf8');
  await writeFile(join(skillRoot, 'references', 'policy.md'), '# Policy\n', 'utf8');
  await writeFile(join(skillRoot, 'scripts', 'check.mjs'), 'export const safe = true;\n', 'utf8');

  const first = item(await discoverClaude({ home, projectRoot }), 'skills', 'project:review');
  assert.deepEqual(
    first.value.sourceClosure.map((entry) => entry.path),
    ['references/policy.md', 'scripts/check.mjs', 'SKILL.md']
  );
  assert.ok(first.value.sourceClosure.every((entry) => /^sha256:[a-f0-9]{64}$/.test(entry.hash)));

  await writeFile(join(skillRoot, 'scripts', 'check.mjs'), 'export const safe = false;\n', 'utf8');
  const second = item(await discoverClaude({ home, projectRoot }), 'skills', 'project:review');
  assert.notEqual(second.sourceHash, first.sourceHash);
});

test('skill approvals exclude Python bytecode and OS metadata files', async () => {
  const { home, projectRoot } = await fixture();
  const skillRoot = join(projectRoot, '.claude', 'skills', 'review');
  await mkdir(join(skillRoot, 'scripts', '__pycache__'), { recursive: true });
  await writeFile(join(skillRoot, 'SKILL.md'), '---\nname: review\n---\n# Review\n', 'utf8');
  await writeFile(join(skillRoot, 'scripts', 'check.py'), 'print("safe")\n', 'utf8');
  await writeFile(
    join(skillRoot, 'scripts', '__pycache__', 'check.cpython-314.pyc'),
    Buffer.from([0xff])
  );
  await writeFile(join(skillRoot, '.DS_Store'), Buffer.from([0xff]));

  const skill = item(await discoverClaude({ home, projectRoot }), 'skills', 'project:review');
  assert.deepEqual(
    skill.value.sourceClosure.map((entry) => entry.path),
    ['scripts/check.py', 'SKILL.md']
  );
});

test('skill runtime-cache names cannot hide symlinks or regular support files', async () => {
  const { home, projectRoot } = await fixture();
  const skillRoot = join(projectRoot, '.claude', 'skills', 'review');
  await mkdir(join(skillRoot, '.pytest_cache'), { recursive: true });
  await writeFile(join(skillRoot, 'SKILL.md'), '---\nname: review\n---\n# Review\n', 'utf8');
  await writeFile(join(skillRoot, '.pytest_cache', 'instructions.md'), 'Review cache.\n', 'utf8');
  await symlink(join(skillRoot, 'SKILL.md'), join(skillRoot, '.DS_Store'));

  await assert.rejects(discoverClaude({ home, projectRoot }), /cannot contain symlink/);
  await rm(join(skillRoot, '.DS_Store'));
  const skill = item(await discoverClaude({ home, projectRoot }), 'skills', 'project:review');
  assert.equal(
    skill.value.sourceClosure.some((entry) => entry.path === '.pytest_cache/instructions.md'),
    true
  );
});

test('contained skill directory symlinks resolve to their canonical in-project closure', async () => {
  const { home, projectRoot } = await fixture();
  const canonicalSkill = join(projectRoot, '.agents', 'skills', 'speech-engine');
  const claudeSkills = join(projectRoot, '.claude', 'skills');
  await Promise.all([
    mkdir(canonicalSkill, { recursive: true }),
    mkdir(claudeSkills, { recursive: true }),
  ]);
  await writeFile(
    join(canonicalSkill, 'SKILL.md'),
    '---\nname: speech-engine\n---\n# Speech engine\n',
    'utf8'
  );
  await symlink('../../.agents/skills/speech-engine', join(claudeSkills, 'speech-engine'));

  const skill = item(
    await discoverClaude({ home, projectRoot }),
    'skills',
    'project:speech-engine'
  );
  assert.deepEqual(
    skill.value.sourceClosure.map((entry) => entry.path),
    ['SKILL.md']
  );
  assert.equal(skill.sourcePath, join(await realpath(canonicalSkill), 'SKILL.md'));
});

test('plugin skills receive the same complete closure and reject every symlink', async () => {
  const { home, claudeHome, projectRoot, root } = await fixture();
  const pluginRoot = join(root, 'plugins', 'flow');
  const skillRoot = join(pluginRoot, 'skills', 'review');
  await mkdir(join(skillRoot, 'scripts'), { recursive: true });
  await writeFile(join(skillRoot, 'SKILL.md'), '---\nname: review\n---\n# Review\n', 'utf8');
  await writeFile(join(skillRoot, 'scripts', 'check.mjs'), 'export {};\n', 'utf8');
  await json(join(claudeHome, 'settings.json'), { enabledPlugins: { 'flow@maude': true } });
  await json(join(claudeHome, 'plugins', 'installed_plugins.json'), {
    plugins: { 'flow@maude': [{ installPath: pluginRoot, scope: 'user' }] },
  });

  const skill = item(
    await discoverClaude({ home, projectRoot, allowedPluginRoots: [join(root, 'plugins')] }),
    'skills',
    'flow:review'
  );
  assert.deepEqual(
    skill.value.sourceClosure.map((entry) => entry.path),
    ['scripts/check.mjs', 'SKILL.md']
  );

  await symlink(join(skillRoot, 'scripts', 'check.mjs'), join(skillRoot, 'references'));
  await assert.rejects(
    discoverClaude({ home, projectRoot, allowedPluginRoots: [join(root, 'plugins')] }),
    /skill.*symlink|symlink.*references/i
  );
});

test('instruction imports read sanitized bounded files within their narrow canonical roots', async () => {
  const { home, claudeHome, projectRoot, root } = await fixture();
  await writeFile(
    join(claudeHome, 'shared.md'),
    'token: ordinary-secret\n# Global import\n',
    'utf8'
  );
  await writeFile(join(claudeHome, 'CLAUDE.md'), '@./shared.md\n# Global body\n', 'utf8');
  await writeFile(join(projectRoot, 'same-a.md'), '# Same bytes\n', 'utf8');
  await writeFile(join(projectRoot, 'same-b.md'), '# Same bytes\n', 'utf8');
  await writeFile(
    join(projectRoot, 'CLAUDE.md'),
    '@./same-a.md\n@./same-b.md\n@../outside.md\n@~/private.md\n@/private.md\n# Parent body\n',
    'utf8'
  );
  await writeFile(join(root, 'outside.md'), '# Outside\n', 'utf8');

  const ir = await discoverClaude({ home, projectRoot });
  const globalImport = item(ir, 'instruction-imports', 'global:CLAUDE.md:import:0');
  assert.equal(globalImport.value.contained, true);
  assert.equal(globalImport.value.relativePath, 'shared.md');
  assert.equal(globalImport.value.body.includes('ordinary-secret'), false);
  assert.deepEqual(globalImport.value.secretStatus, { $maudeSecret: 'literal-rejected' });

  const first = item(ir, 'instruction-imports', 'project:CLAUDE.md:import:0');
  const second = item(ir, 'instruction-imports', 'project:CLAUDE.md:import:1');
  assert.equal(first.value.body, '# Same bytes\n');
  assert.equal(first.value.relativePath, 'same-a.md');
  assert.equal(second.value.relativePath, 'same-b.md');
  assert.notEqual(first.sourceHash, second.sourceHash);
  assert.equal(item(ir, 'instructions', 'project:CLAUDE.md').value.body, '# Parent body\n');

  for (let index = 2; index <= 4; index += 1) {
    assert.equal(
      item(ir, 'instruction-imports', `project:CLAUDE.md:import:${index}`).value.contained,
      false
    );
  }

  await assert.rejects(
    discoverClaude({ home, projectRoot, limits: { maxFileBytes: 35 } }),
    /shared\.md.*exceeds.*35 bytes/i
  );
});

test('instruction imports reject symlinks, missing paths, and non-regular files', async () => {
  const { home, projectRoot } = await fixture();
  await writeFile(join(projectRoot, 'target.md'), '# Target\n', 'utf8');
  await symlink(join(projectRoot, 'target.md'), join(projectRoot, 'linked.md'));
  await mkdir(join(projectRoot, 'real-directory'));
  await writeFile(join(projectRoot, 'real-directory', 'nested.md'), '# Nested\n', 'utf8');
  await symlink(join(projectRoot, 'real-directory'), join(projectRoot, 'linked-directory'));
  await mkdir(join(projectRoot, 'directory.md'));
  await writeFile(
    join(projectRoot, 'CLAUDE.md'),
    '@./linked.md\n@./linked-directory/nested.md\n@./missing.md\n@./directory.md\n',
    'utf8'
  );

  const ir = await discoverClaude({ home, projectRoot });
  for (let index = 0; index < 4; index += 1) {
    const imported = item(ir, 'instruction-imports', `project:CLAUDE.md:import:${index}`);
    assert.equal(imported.value.contained, false);
    assert.equal(typeof imported.value.reason, 'string');
    assert.equal(Object.hasOwn(imported.value, 'body'), false);
  }
});

test('instruction imports remain descriptor-bound during an intermediate-parent symlink swap', async () => {
  const { home, projectRoot, root } = await fixture();
  const importParent = join(projectRoot, 'instructions');
  const movedParent = join(projectRoot, 'instructions-moved');
  const outside = join(root, 'outside-instructions');
  await Promise.all([mkdir(importParent), mkdir(outside)]);
  await writeFile(join(importParent, 'shared.md'), '# Trusted bytes\n', 'utf8');
  await writeFile(join(outside, 'shared.md'), '# Attacker bytes\n', 'utf8');
  await writeFile(join(projectRoot, 'CLAUDE.md'), '@./instructions/shared.md\n', 'utf8');

  let swapped = false;
  const ir = await discoverClaude({
    home,
    projectRoot,
    discoveryFailpoint: async (name, details) => {
      if (name !== 'after-instruction-import-parent-pin' || details.depth !== 1 || swapped) return;
      swapped = true;
      await rename(importParent, movedParent);
      await symlink(outside, importParent);
    },
  });

  assert.equal(swapped, true);
  const imported = item(ir, 'instruction-imports', 'project:CLAUDE.md:import:0');
  assert.equal(imported.value.body, '# Trusted bytes\n');
  assert.equal(imported.value.body.includes('Attacker'), false);
  assert.match(imported.value.sourceIdentity.device, /^\d+$/);
  assert.match(imported.value.sourceIdentity.inode, /^\d+$/);
  const sourceInfo = await stat(join(movedParent, 'shared.md'));
  const rawHash = sha256(Buffer.from('# Trusted bytes\n'));
  assert.equal(
    imported.sourceHash,
    sha256(`instructions/shared.md\0${sourceInfo.dev}:${sourceInfo.ino}\0${rawHash}`)
  );
});

test('remote MCP URLs redact every literal query component without collapsing repeats', async () => {
  const { home, projectRoot } = await fixture();
  const token = 'aZ9_7Yx2Qp8Lm4Nr6Ts1Uv5Wx0Bc3DeF';
  const querySentinels = {
    bare: 'B4rE0paquEQueryCapability987654321',
    code: 'CODE_SENTINEL_LITERAL_CAPABILITY',
    fragment: 'FRAGMENT_SENTINEL_LITERAL_CAPABILITY',
    repeatedKey: 'RepeatedOpaqueCapabilityKey987654321',
    repeatedOne: 'REPEATED_SENTINEL_ONE',
    repeatedTwo: 'REPEATED_SENTINEL_TWO',
    sig: 'SIG_SENTINEL_LITERAL_CAPABILITY',
  };
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: {
      known: { type: 'http', url: 'https://example.invalid/mcp/ghp_1234567890abcdef/events' },
      disabled: {
        type: 'http',
        url: `https://example.invalid/mcp/${token}/disabled`,
        disabled: true,
      },
      disabledUntyped: {
        url: 'https://example.invalid/mcp?SAS=literal-capability#literal-fragment',
        disabled: true,
      },
      reference: {
        type: 'http',
        url:
          'https://example.invalid/mcp/$' +
          '{MCP_TOKEN}/events?$' +
          '{MCP_QUERY_KEY}=$' +
          '{MCP_QUERY_VALUE}&$' +
          '{MCP_QUERY_KEY}={env:MCP_QUERY_VALUE_2}&keychain:service/account#' +
          '$' +
          '{MCP_FRAGMENT}',
      },
      safe: { type: 'http', url: 'https://example.invalid/api/v1/streamable-http' },
      unsafe: { type: 'http', url: `https://example.invalid/mcp/${token}/events` },
      literalCapabilities: {
        type: 'http',
        url: `https://example.invalid/mcp?sig=${querySentinels.sig}&code=${querySentinels.code}&${querySentinels.bare}&${querySentinels.repeatedKey}=${querySentinels.repeatedOne}&${querySentinels.repeatedKey}=${querySentinels.repeatedTwo}&signature=value&SAS=token#${querySentinels.fragment}`,
      },
    },
  });

  const ir = await discoverClaude({ home, projectRoot });
  assert.equal(
    item(ir, 'mcp-http', 'project:safe').value.url.endsWith('/api/v1/streamable-http'),
    true
  );
  assert.equal(item(ir, 'mcp-http', 'project:reference').value.url.includes('MCP_TOKEN'), true);
  const unsafe = item(ir, 'mcp-http', 'project:unsafe');
  assert.equal(unsafe.value.url.includes(token), false);
  assert.deepEqual(unsafe.value.secretStatus, { $maudeSecret: 'literal-rejected' });
  const known = item(ir, 'mcp-http', 'project:known');
  assert.equal(typeof known.value.url, 'string');
  assert.equal(known.value.url.includes('ghp_1234567890abcdef'), false);
  assert.deepEqual(known.value.secretStatus, { $maudeSecret: 'literal-rejected' });
  const disabled = item(ir, 'mcp-disabled', 'project:disabled');
  assert.equal(disabled.value.url.includes(token), false);
  assert.deepEqual(disabled.value.secretStatus, { $maudeSecret: 'literal-rejected' });
  const disabledUntyped = item(ir, 'mcp-disabled', 'project:disabledUntyped');
  assert.equal(disabledUntyped.value.url.includes('literal-capability'), false);
  assert.equal(disabledUntyped.value.url.includes('literal-fragment'), false);
  assert.deepEqual(disabledUntyped.value.secretStatus, { $maudeSecret: 'literal-rejected' });
  const reference = item(ir, 'mcp-http', 'project:reference');
  assert.equal(reference.value.secretStatus, undefined);
  assert.equal(reference.value.url.includes('MCP_FRAGMENT'), true);
  assert.equal(reference.value.url.includes('keychain:service/account'), true);
  const referenceParts = new URL(reference.value.url).search.slice(1).split('&');
  assert.equal(referenceParts.length, 3);
  assert.equal(referenceParts.filter((part) => part.includes('MCP_QUERY_KEY')).length, 2);
  const capabilities = item(ir, 'mcp-http', 'project:literalCapabilities');
  const serialized = ir.serialized;
  for (const sentinel of Object.values(querySentinels)) {
    assert.equal(serialized.includes(sentinel), false, `IR leaked ${sentinel}`);
  }
  const capabilityUrl = new URL(capabilities.value.url);
  assert.equal(capabilityUrl.search.slice(1).split('&').length, 7);
  assert.equal(capabilityUrl.search.includes('sig'), false);
  assert.equal(capabilityUrl.search.includes('code'), false);
  assert.equal(capabilityUrl.hash.includes(querySentinels.fragment), false);
  assert.deepEqual(capabilities.value.secretStatus, { $maudeSecret: 'literal-rejected' });
});

test('full IR contains zero credential sentinels across every supported literal form', async () => {
  const { home, projectRoot } = await fixture();
  const sentinels = [
    'IR_USERNAME_ONLY_SENTINEL',
    'IR_QUERY_USER_SENTINEL',
    'IR_PATH_PASSWORD_SENTINEL',
    'IR_SEMICOLON_TOKEN_SENTINEL',
    'IR_TOKEN_PATH_4f8a7d93b6214c43bca231fe9b2db124',
    'IR_SLACK_WEBHOOK_SENTINEL',
    'IR_COOKIE_SENTINEL',
    'IR_SET_COOKIE_SENTINEL',
    'IR_AUTH_SENTINEL',
    'IR_DATABASE_URL_SENTINEL',
    'IR_REDIS_URL_SENTINEL',
    'IR_DSN_SENTINEL',
  ];
  await json(join(projectRoot, '.claude', 'settings.json'), {
    env: {
      DATABASE_URL: `postgres://app:${sentinels[9]}@db.invalid/studyfi`,
      REDIS_URL: `redis://default:${sentinels[10]}@cache.invalid/0`,
      DSN: `Server=db.invalid;Password=${sentinels[11]}`,
      SAFE_DATABASE_URL: '$' + '{DATABASE_URL}',
    },
    telemetry: {
      username: `https://${sentinels[0]}@example.invalid/path`,
      query: `https://example.invalid/path?user=${sentinels[1]}`,
      path: `https://example.invalid/password/${sentinels[2]}`,
      semicolon: `jdbc:sqlserver://db.invalid;token=${sentinels[3]}`,
      tokenPath: `https://example.invalid/hooks/${sentinels[4]}`,
      slack: `https://hooks.slack.com/services/T00000000/B00000000/${sentinels[5]}`,
    },
  });
  await json(join(projectRoot, '.mcp.json'), {
    mcpServers: {
      headers: {
        type: 'http',
        url: 'https://example.invalid/mcp',
        headers: {
          Cookie: `session=${sentinels[6]}`,
          'Set-Cookie': `session=${sentinels[7]}`,
          Authorization: `Bearer ${sentinels[8]}`,
          'X-Safe': 'public',
        },
      },
    },
  });

  const ir = await discoverClaude({ home, projectRoot });
  for (const sentinel of sentinels) {
    assert.equal(ir.serialized.includes(sentinel), false, `full IR leaked ${sentinel}`);
  }
  assert.equal(ir.serialized.includes('DATABASE_URL'), true);
});

test('frontmatter diagnostics expose only stable code, line, and column', async () => {
  const { home, projectRoot } = await fixture();
  const warningSentinel = 'ghp_WARNING_DIAGNOSTIC_SENTINEL';
  await writeFile(
    join(projectRoot, '.claude', 'commands', 'warning.md'),
    `---\nname: [${warningSentinel}\n---\n# Body\n`,
    'utf8'
  );

  const ir = await discoverClaude({ home, projectRoot });
  const warning = item(ir, 'commands', 'project:warning').value.frontmatterWarning;
  assert.match(warning, /^BAD_INDENT at line 2, column \d+$/);
  assert.equal(ir.serialized.includes(warningSentinel), false);
  assert.equal(warning.includes('\n'), false);

  const duplicateSentinel = 'DUPLICATE_DIAGNOSTIC_SENTINEL';
  await writeFile(
    join(projectRoot, '.claude', 'commands', 'duplicate.md'),
    `---\nname: safe\nname: ${duplicateSentinel}\n---\n# Body\n`,
    'utf8'
  );
  await assert.rejects(discoverClaude({ home, projectRoot }), (error) => {
    assert.match(error.message, /DUPLICATE_KEY at line 3, column 1/);
    assert.equal(error.message.includes(duplicateSentinel), false);
    assert.equal(error.message.includes('\n'), false);
    return true;
  });

  await rm(join(projectRoot, '.claude', 'commands', 'duplicate.md'));
  const aliasSentinel = 'ALIAS_DIAGNOSTIC_SENTINEL';
  await writeFile(
    join(projectRoot, '.claude', 'commands', 'alias.md'),
    `---\nvalue: &${aliasSentinel} [*${aliasSentinel}]\n---\n# Body\n`,
    'utf8'
  );
  await assert.rejects(discoverClaude({ home, projectRoot }), (error) => {
    assert.match(error.message, /YAML_PARSE_ERROR at line 1, column 1/);
    assert.equal(error.message.includes(aliasSentinel), false);
    assert.equal(error.message.includes('\n'), false);
    return true;
  });
});
