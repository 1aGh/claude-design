import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeCapabilities,
  renderCapabilityReport,
  securityApprovalId,
} from './capabilities.mjs';
import { createEnvironmentIR } from './model.mjs';

const EXPECTED_SOURCE_CATEGORIES = [
  'instructions',
  'instruction-imports',
  'rules',
  'settings',
  'plugins',
  'commands',
  'agents',
  'skills',
  'mcp-stdio',
  'mcp-http',
  'mcp-sse',
  'mcp-disabled',
  'mcp-oauth',
  'mcp-environment',
  'hooks-command',
  'hooks-http',
  'hooks-prompt',
  'hooks-agent',
  'hooks-unknown',
  'permissions-allow',
  'permissions-ask',
  'permissions-deny',
  'permission-mode',
  'environment',
  'keychain-reference',
  'ai-state',
  'design-state',
  'kgai',
];

const TARGETS = ['opencode', 'codex'];
const STATUSES = new Set(['native', 'degraded', 'unsupported']);

test('every Claude source category has exactly one classification per target', async () => {
  let module;
  try {
    module = await import('./capabilities.mjs');
  } catch (error) {
    assert.fail(`capability registry is not implemented yet: ${error.message}`);
  }

  assert.deepEqual(module.SOURCE_CATEGORIES, EXPECTED_SOURCE_CATEGORIES);
  assert.equal(module.CAPABILITY_REGISTRY.schemaVersion, 1);

  for (const category of EXPECTED_SOURCE_CATEGORIES) {
    for (const target of TARGETS) {
      const entry = module.CAPABILITY_REGISTRY.categories[category]?.[target];
      assert.ok(entry, `missing ${target} classification for ${category}`);
      assert.ok(STATUSES.has(entry.status), `invalid ${target} status for ${category}`);
      assert.equal(typeof entry.representation, 'string');
      assert.ok(
        entry.representation.length > 0,
        `missing ${target} representation for ${category}`
      );
      assert.equal(typeof entry.reason, 'string');
      assert.ok(entry.reason.length > 0, `missing ${target} reason for ${category}`);
      if (entry.securityRelevant && entry.status !== 'native') {
        assert.equal(entry.failClosed, true, `${target}/${category} must fail closed`);
      }
    }
  }
});

test('strict analysis fails closed for permissions, hooks, missing plugins, and literal secrets', () => {
  const sentinel = 'sk-test-SENTINEL-NEVER-REPORT';
  const ir = createEnvironmentIR([
    fixtureItem('permissions-allow', 'project:Bash(git status)', 'Bash(git status)'),
    fixtureItem('hooks-command', 'project:Stop:40:0:0', {
      command: 'fixture',
      event: 'Stop',
      type: 'command',
    }),
    fixtureItem('plugins', 'missing@example', { enabled: true, missing: true }),
    fixtureItem('mcp-environment', 'project:unsafe', {
      headers: { Authorization: { $maudeSecret: 'literal-rejected' } },
    }),
  ]);

  const report = analyzeCapabilities(ir, { strict: true });
  assert.equal(report.ok, false);
  assert.equal(report.summary.securityFailures, 8);
  assert.equal(report.records.length, 8);
  assert.ok(report.records.every((record) => record.enabled === false));
  assert.equal(JSON.stringify(report).includes(sentinel), false);
  assert.equal(renderCapabilityReport(report).includes(sentinel), false);
});

test('non-security degradations remain explicit without failing non-strict analysis', () => {
  const command = fixtureItem('commands', 'global:plan', { body: '# Plan', frontmatter: {} });
  command.scope = 'global';
  const ir = createEnvironmentIR([command]);
  const report = analyzeCapabilities(ir);
  assert.equal(report.ok, true);
  assert.deepEqual(report.summary, {
    degraded: 2,
    native: 0,
    securityFailures: 0,
    unsupported: 0,
  });
  assert.match(renderCapabilityReport(report), /global:plan.*degraded/);
});

test('MCP inventory remains inert when its static acknowledgement is present', () => {
  const ir = createEnvironmentIR([
    fixtureItem('mcp-stdio', 'project:local', { command: 'fixture', type: 'stdio' }),
  ]);
  const initial = analyzeCapabilities(ir);
  assert.ok(initial.records.every((record) => record.enabled === false));

  const mcp = ir.items.find((candidate) => candidate.id === 'mcp-stdio:project:local');
  const approved = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: [securityApprovalId(mcp, 'opencode', '1.18.25')],
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });
  assert.equal(
    approved.records.find((record) => record.sourceId === 'mcp-stdio:project:local')?.enabled,
    false
  );
  assert.equal(approved.records[0].acknowledged, true);
  assert.equal(approved.records[0].failClosed, true);
});

test('security approval expires when target or registry versions change', () => {
  const ir = createEnvironmentIR([
    fixtureItem('mcp-stdio', 'project:local', { command: 'fixture', type: 'stdio' }),
  ]);
  const stale = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: ['mcp-stdio:project:local:opencode:sha256:mcp-stdio'],
  });
  assert.equal(stale.records[0].enabled, false);
});

test('plugin model content stays inert while escaping imports cannot be approved', () => {
  const ir = createEnvironmentIR([
    { ...fixtureItem('skills', 'flow:review', { body: '# Review' }), origin: 'plugin' },
    fixtureItem('instruction-imports', 'project:escape', {
      contained: false,
      reference: '../../private.md',
    }),
  ]);
  const initial = analyzeCapabilities(ir, { observedTargetVersions: { opencode: '1.18.25' } });
  assert.ok(initial.records.every((record) => record.enabled === false));

  const plugin = ir.items.find((candidate) => candidate.id === 'skills:flow:review');
  const approved = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: [securityApprovalId(plugin, 'opencode', '1.18.25')],
    observedTargetVersions: { opencode: '1.18.25' },
  });
  assert.equal(approved.records.find((record) => record.sourceId === plugin.id)?.enabled, false);
  assert.equal(
    approved.records.find((record) => record.sourceId === 'instruction-imports:project:escape')
      ?.enabled,
    false
  );
});

test('generic analysis inventories model content and MCP for target-specific authority proof', () => {
  const ir = createEnvironmentIR([
    fixtureItem('skills', 'project:review', {
      body: '# Review',
      frontmatter: { 'allowed-tools': ['Read'] },
    }),
    fixtureItem('mcp-stdio', 'project:local', { command: 'fixture', type: 'stdio' }),
  ]);
  const skill = ir.items.find((candidate) => candidate.id === 'skills:project:review');
  const mcp = ir.items.find((candidate) => candidate.id === 'mcp-stdio:project:local');
  const report = analyzeCapabilities(ir, {
    approvedCompositionIds: ['composition:legacy-approval-that-used-to-enable-the-mcp'],
    approvedSecuritySourceIds: [
      securityApprovalId(skill, 'opencode', '1.18.25'),
      securityApprovalId(mcp, 'opencode', '1.18.25'),
    ],
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });
  assert.equal(report.records.find((record) => record.sourceId === skill.id)?.enabled, false);
  const mcpRecord = report.records.find((record) => record.sourceId === mcp.id);
  assert.equal(mcpRecord?.enabled, false);
  assert.equal(mcpRecord?.status, 'native');
  assert.equal(mcpRecord?.failClosed, true);
  assert.match(mcpRecord?.reason ?? '', /STDIO MCP/i);
});

test('plugin model content and MCP retain independent generic classifications', () => {
  const ir = createEnvironmentIR([
    {
      ...fixtureItem('skills', 'flow:review', { body: '# Review' }),
      origin: 'plugin',
      scope: 'global',
    },
    fixtureItem('mcp-http', 'project:remote', { type: 'http', url: 'https://example.invalid/mcp' }),
  ]);
  const plugin = ir.items.find((candidate) => candidate.id === 'skills:flow:review');
  const mcp = ir.items.find((candidate) => candidate.id === 'mcp-http:project:remote');
  const report = analyzeCapabilities(ir, {
    approvedCompositionIds: ['composition:legacy-approval-that-used-to-enable-the-mcp'],
    approvedSecuritySourceIds: [
      securityApprovalId(plugin, 'opencode', '1.18.25'),
      securityApprovalId(mcp, 'opencode', '1.18.25'),
    ],
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });
  assert.equal(report.records.find((record) => record.sourceId === plugin.id)?.enabled, false);
  assert.equal(report.records.find((record) => record.sourceId === mcp.id)?.enabled, false);
  assert.equal(report.records.find((record) => record.sourceId === mcp.id)?.status, 'native');
});

test('generic analysis leaves exact permission monotonicity to target lowerers', () => {
  const cases = [
    {
      content: fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
      rule: 'Read',
    },
    {
      content: fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
      rule: 'Bash(git status)',
    },
    {
      content: {
        ...fixtureItem('skills', 'flow:research', { body: '# Research' }),
        origin: 'plugin',
        scope: 'global',
      },
      rule: 'WebFetch(domain:example.com)',
    },
    {
      content: fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
      rule: 'Glob(./src/**)',
    },
    {
      content: fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
      rule: 'Grep(./src/**)',
    },
    {
      content: fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
      rule: 'Task(reviewer)',
    },
    {
      content: fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
      rule: 'UnknownTool(./src/**)',
    },
  ];

  for (const { content, rule } of cases) {
    const permission = fixtureItem('permissions-allow', `global:${rule}`, rule);
    permission.scope = 'global';
    const ir = createEnvironmentIR([content, permission]);
    const permissionItem = ir.items.find(
      (item) => item.category === 'permissions-allow' && item.value === rule
    );
    const approvals = ir.items.map((item) => securityApprovalId(item, 'opencode', '1.18.25'));
    const report = analyzeCapabilities(ir, {
      approvedSecuritySourceIds: approvals,
      observedTargetVersions: { opencode: '1.18.25' },
      targets: ['opencode'],
    });
    const record = report.records.find((candidate) => candidate.sourceId === permissionItem.id);
    assert.equal(record?.enabled, false, rule);
    assert.equal(record?.status, 'degraded', rule);
    assert.equal(record?.failClosed, true, rule);
  }
});

test('model content and restrictions remain inert even with acknowledgement and proof-shaped input', () => {
  const ir = createEnvironmentIR([
    fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
    fixtureItem('permissions-deny', 'project:Bash(curl:*)', 'Bash(curl:*)'),
    fixtureItem('permissions-ask', 'project:Read(../private/**)', 'Read(../private/**)'),
    fixtureItem('permissions-allow', 'project:Read(./src/**)', 'Read(./src/**)'),
    fixtureItem('permission-mode', 'project:default', 'plan'),
  ]);
  const restricted = ir.items.filter(
    (item) => item.category.startsWith('permissions-') || item.category === 'permission-mode'
  );
  const report = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: restricted.map((item) =>
      securityApprovalId(item, 'codex', '0.151.0')
    ),
    effectiveTargetIsolationProofs: [validLookingIsolationProof('codex', '0.151.0')],
    observedTargetVersions: { codex: '0.151.0' },
    targets: ['codex'],
  });

  assert.equal(
    report.records.find((record) => record.sourceId === 'instructions:project:CLAUDE.md')?.enabled,
    true
  );
  assert.ok(
    restricted.every(
      (item) => report.records.find((record) => record.sourceId === item.id)?.acknowledged === true
    )
  );
});

test('static approvals never enable security-relevant degraded mappings', () => {
  const ir = createEnvironmentIR([
    fixtureItem('permissions-allow', 'project:Read(./src/**)', 'Read(./src/**)'),
    fixtureItem('permissions-ask', 'project:Bash(git status)', 'Bash(git status)'),
    fixtureItem('permissions-deny', 'project:WebFetch', 'WebFetch'),
    fixtureItem('permission-mode', 'project:default', 'plan'),
    fixtureItem('hooks-command', 'project:Stop:40:0:0', {
      command: 'fixture',
      event: 'Stop',
      type: 'command',
    }),
    fixtureItem('skills', 'project:review', {
      body: '# Review',
      frontmatter: { 'allowed-tools': ['Read'] },
    }),
  ]);
  const report = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: ir.items.map((item) => securityApprovalId(item, 'codex', '0.151.0')),
    observedTargetVersions: { codex: '0.151.0' },
    targets: ['codex'],
  });

  assert.ok(report.records.every((record) => record.enabled === false));
  assert.ok(
    report.records
      .filter((record) => record.sourceId !== 'skills:project:review')
      .every((record) => record.status === 'degraded')
  );
});

test('static acknowledgements never activate native or degraded environment projection', () => {
  const ir = createEnvironmentIR([
    fixtureItem('mcp-environment', 'global:TOKEN', { name: 'TOKEN' }),
    fixtureItem('environment', 'global:SAFE', { name: 'SAFE', value: '$' + '{SAFE}' }),
  ]);
  const report = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: ir.items.map((item) =>
      securityApprovalId(item, 'opencode', '1.18.25')
    ),
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });

  assert.ok(report.records.every((record) => record.securityRelevant === true));
  assert.ok(report.records.every((record) => record.acknowledged === true));
  assert.ok(report.records.every((record) => record.enabled === false));
  assert.ok(report.records.every((record) => record.failClosed === true));
});

test('generic model classification does not consume target-authority proof-shaped input', () => {
  const proof = validLookingIsolationProof('opencode', '1.18.25');
  const { unmanagedInventoryHash: _omitted, ...missingUnmanagedAuthority } = proof;
  const ir = createEnvironmentIR([
    fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
  ]);
  const report = analyzeCapabilities(ir, {
    effectiveTargetIsolationProofs: [missingUnmanagedAuthority],
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });

  assert.equal(report.records[0].enabled, true);
});

test('proof-shaped inputs cannot alter generic model classification', () => {
  const current = validLookingIsolationProof('opencode', '1.18.25');
  const invalid = { ...current, unmanagedInventoryHash: inventoryHash('tampered') };
  const staleRegistry = { ...current, registryHash: inventoryHash('tampered') };
  const stale = validLookingIsolationProof('opencode', '1.18.24');
  const ir = createEnvironmentIR([
    fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
  ]);

  for (const proof of [invalid, staleRegistry, stale]) {
    const report = analyzeCapabilities(ir, {
      effectiveTargetIsolationProofs: [proof],
      observedTargetVersions: { opencode: '1.18.25' },
      targets: ['opencode'],
    });
    assert.equal(report.records[0].enabled, true);
  }

  const malformedOption = analyzeCapabilities(ir, {
    effectiveTargetIsolationProofs: current,
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });
  assert.equal(malformedOption.records[0].enabled, true);
});

test('static acknowledgement is recorded without changing generic model classification', () => {
  const proof = validLookingIsolationProof('opencode', '1.18.25');
  const ir = createEnvironmentIR([
    fixtureItem('instructions', 'project:CLAUDE.md', { body: '# Project' }),
  ]);
  const report = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: [securityApprovalId(ir.items[0], 'opencode', '1.18.25')],
    effectiveTargetIsolationProofs: [proof],
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });

  assert.equal(report.records[0].enabled, true);
  assert.equal(report.records[0].acknowledged, true);
});

test('generic MCP and permission records remain independent before target lowering', () => {
  const ir = createEnvironmentIR([
    fixtureItem('mcp-http', 'project:remote', { type: 'http', url: 'https://example.invalid/mcp' }),
    fixtureItem('permissions-allow', 'global:Bash(curl:*)', 'Bash(curl:*)'),
  ]);
  const report = analyzeCapabilities(ir, {
    approvedSecuritySourceIds: ir.items.map((item) =>
      securityApprovalId(item, 'opencode', '1.18.25')
    ),
    observedTargetVersions: { opencode: '1.18.25' },
    targets: ['opencode'],
  });

  assert.ok(report.records.every((record) => record.enabled === false));
  assert.deepEqual(report.records.map((record) => record.status).sort(), ['degraded', 'native']);
});

function validLookingIsolationProof(target, observedTargetVersion) {
  return {
    schemaVersion: 1,
    target,
    observedTargetVersion,
    registryHash: inventoryHash('registry'),
    managedInventoryHash: inventoryHash('managed'),
    unmanagedInventoryHash: inventoryHash('unmanaged'),
    defaultInventoryHash: inventoryHash('default'),
    removedTrifectaLeg: 'outbound',
    proofHash: inventoryHash('proof'),
  };
}

function inventoryHash(label) {
  const character = {
    managed: 'a',
    unmanaged: 'b',
    default: 'c',
    tampered: 'd',
    registry: 'e',
    proof: 'f',
  }[label];
  return `sha256:${character.repeat(64)}`;
}

function fixtureItem(category, name, value) {
  return {
    category,
    name,
    scope: 'project',
    sourcePath: `/fixture/${category}.json`,
    precedence: 40,
    value,
    sourceHash: `sha256:${category}`,
    contributors: [],
  };
}
