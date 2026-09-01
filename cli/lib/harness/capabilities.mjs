import { createHash } from 'node:crypto';

import { TARGET_COMPATIBILITY } from './compatibility.mjs';
import { containsRejectedLiteral } from './secrets.mjs';

export const SOURCE_CATEGORIES = [
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

const N = (representation, reason, securityRelevant = false) =>
  entry('native', representation, reason, securityRelevant);
const D = (representation, reason, securityRelevant = false) =>
  entry('degraded', representation, reason, securityRelevant);
const U = (reason, securityRelevant = true) =>
  entry('unsupported', 'disabled', reason, securityRelevant);

export const CAPABILITY_REGISTRY = Object.freeze({
  schemaVersion: 1,
  reviewed: '2026-08-31',
  targets: Object.fromEntries(
    Object.entries(TARGET_COMPATIBILITY).map(([target, compatibility]) => [
      target,
      compatibility.version,
    ])
  ),
  categories: {
    instructions: both(
      N('instruction-fallback', 'Target supports project instruction discovery.'),
      N('project-doc-fallback', 'Codex supports CLAUDE.md as a documented fallback.')
    ),
    'instruction-imports': both(
      D('disabled-instruction-glob', 'Imports require contained-path review.', true),
      D('disabled-instruction-reference', 'Imports require contained-path review.', true)
    ),
    rules: both(
      D('instruction-glob', 'Claude path-conditioned rule semantics are narrower.'),
      D('instruction-reference', 'Claude path-conditioned rule semantics are narrower.')
    ),
    settings: both(
      D('registered-setting', 'Only versioned, target-compatible setting keys are emitted.'),
      D('registered-setting', 'Only versioned, scope-compatible setting keys are emitted.')
    ),
    plugins: both(
      D('lowered-assets', 'Claude plugin identity and lifecycle are not reproduced.'),
      D('lowered-assets', 'Compatible assets are packaged individually.')
    ),
    commands: both(
      D('command', 'Claude frontmatter and invocation semantics differ.'),
      D('skill', 'Codex has no equivalent custom slash-command registration.')
    ),
    agents: both(
      D('disabled-agent', 'Claude agent privileges and lifecycle require explicit review.', true),
      D(
        'disabled-custom-agent',
        'Claude agent privileges and lifecycle require explicit review.',
        true
      )
    ),
    skills: both(
      N('skill', 'Target discovers compatible SKILL.md assets.'),
      N('skill', 'Target discovers compatible SKILL.md assets.')
    ),
    'mcp-stdio': both(
      N('local-mcp', 'Target supports STDIO MCP.', true),
      N('stdio-mcp', 'Target supports STDIO MCP.', true)
    ),
    'mcp-http': both(
      N('remote-mcp', 'Target supports streamable HTTP MCP.', true),
      N('http-mcp', 'Target supports streamable HTTP MCP.', true)
    ),
    'mcp-sse': both(
      D('disabled-remote-mcp', 'Legacy SSE requires explicit endpoint compatibility proof.', true),
      D('disabled-http-mcp', 'Legacy SSE requires explicit endpoint compatibility proof.', true)
    ),
    'mcp-disabled': both(
      N('disabled-mcp', 'Disabled state is preserved.', true),
      N('disabled-mcp', 'Disabled state is preserved.', true)
    ),
    'mcp-oauth': both(
      D('disabled-oauth', 'OAuth callback and client option schemas differ.', true),
      D('disabled-oauth', 'OAuth callback and client option schemas differ.', true)
    ),
    'mcp-environment': both(
      N('environment-reference', 'Target supports environment-backed MCP values.', true),
      N('environment-reference', 'Target supports environment-backed MCP values.', true)
    ),
    'hooks-command': both(
      D('disabled-hook', 'Hook remains disabled until the complete lifecycle tuple matches.', true),
      D('disabled-hook', 'Hook remains disabled until event and persisted trust match.', true)
    ),
    'hooks-http': both(U('No reviewed HTTP hook equivalent.'), U('No HTTP hook equivalent.')),
    'hooks-prompt': both(U('No prompt hook equivalent.'), U('Prompt hooks are not executed.')),
    'hooks-agent': both(U('No agent hook equivalent.'), U('Agent hooks are not executed.')),
    'hooks-unknown': both(U('Unknown hook type.'), U('Unknown hook type.')),
    'permissions-allow': both(
      D('narrow-permission', 'Only exactly expressible scope may be emitted.', true),
      D('approval-sandbox-intersection', 'Approval and sandbox semantics differ.', true)
    ),
    'permissions-ask': both(
      D('narrow-approval', 'Only exactly expressible approval scope may be emitted.', true),
      D('approval-sandbox-intersection', 'Approval and sandbox semantics differ.', true)
    ),
    'permissions-deny': both(
      D('narrow-deny', 'An unrepresentable deny blocks projection.', true),
      D('sandbox-exec-deny', 'An unrepresentable deny blocks projection.', true)
    ),
    'permission-mode': both(
      D('narrow-approval', 'Claude modes are narrowed to ask-by-default authority.', true),
      D('narrow-approval-sandbox', 'Only a provably narrower combination may be emitted.', true)
    ),
    environment: both(
      D('bounded-plugin-reference', 'Only names and references are projected.', true),
      D('shell-environment-policy', 'Only names and references are projected.', true)
    ),
    'keychain-reference': both(
      D('reference-only', 'Resolved keychain values are never read.', true),
      D('reference-only', 'Resolved keychain values are never read.', true)
    ),
    'ai-state': both(
      D('in-place-reference', '.ai is referenced and never copied.'),
      D('in-place-reference', '.ai is referenced and never copied.')
    ),
    'design-state': both(
      D('in-place-reference', '.design is referenced and never copied.'),
      D('in-place-reference', '.design is referenced and never copied.')
    ),
    kgai: both(
      D(
        'bounded-prompt-plugin',
        'Graph output remains untrusted and transcript hooks stay disabled.',
        true
      ),
      D(
        'bounded-instruction-hook',
        'Graph output remains untrusted and transcript hooks stay disabled.',
        true
      )
    ),
  },
});

export const CAPABILITY_REGISTRY_HASH = `sha256:${createHash('sha256')
  .update(JSON.stringify(CAPABILITY_REGISTRY))
  .digest('hex')}`;

export function securityApprovalId(item, target, observedTargetVersion) {
  if (!observedTargetVersion) return undefined;
  return `${item.id}:${target}:${observedTargetVersion}:${CAPABILITY_REGISTRY_HASH}:${item.sourceHash}`;
}

export function analyzeCapabilities(
  ir,
  {
    approvedSecuritySourceIds = [],
    observedTargetVersions = {},
    strict = false,
    targets = ['opencode', 'codex'],
  } = {}
) {
  const records = [];
  let invalidSources = 0;
  const approved = new Set(approvedSecuritySourceIds.filter(Boolean));
  for (const item of ir.items) {
    for (const target of targets) {
      const registered = CAPABILITY_REGISTRY.categories[item.category]?.[target];
      let classification = registered ?? U(`Unknown source category: ${item.category}`);
      let invalidSource = false;
      if (item.category === 'plugins' && item.value?.missing) {
        classification = U('Enabled Claude plugin has no approved installed source.');
        invalidSource = true;
      } else if (containsRejectedLiteral(item.value)) {
        classification = U('Source contains a literal credential in a migratable field.');
        invalidSource = true;
      } else if (item.category === 'instruction-imports' && !item.value?.contained) {
        classification = U('Instruction import is missing or outside its canonical scope.');
        invalidSource = true;
      } else if (hasPrivilegeFrontmatter(item) || isPluginModelAsset(item)) {
        classification = entry(
          'degraded',
          'disabled-reviewed-asset',
          isPluginModelAsset(item)
            ? 'Plugin model-facing content requires content-hash approval.'
            : 'Privilege-bearing frontmatter requires an exact reviewed target mapping.',
          true
        );
      }
      if (invalidSource) invalidSources += 1;
      const acknowledged = approved.has(
        securityApprovalId(item, target, observedTargetVersions[target])
      );
      const enabled =
        item.category !== 'mcp-disabled' &&
        (classification.status === 'native' || classification.status === 'degraded') &&
        !classification.securityRelevant;
      records.push({
        sourceId: item.id,
        sourcePath: item.sourcePath,
        sourceHash: item.sourceHash,
        target,
        status: classification.status,
        representation: classification.representation,
        reason: classification.reason,
        securityRelevant: classification.securityRelevant,
        failClosed: classification.failClosed || (classification.securityRelevant && !enabled),
        enabled,
        acknowledged,
        ownedOutputs: [],
        invalidSource,
      });
    }
  }
  const summary = {
    degraded: records.filter((record) => record.status === 'degraded').length,
    native: records.filter((record) => record.status === 'native').length,
    securityFailures: records.filter(
      (record) => record.securityRelevant && record.status !== 'native'
    ).length,
    unsupported: records.filter((record) => record.status === 'unsupported').length,
  };
  return {
    schemaVersion: 1,
    generationHash: ir.generationHash,
    strict,
    ok: invalidSources === 0 && (!strict || summary.securityFailures === 0),
    summary,
    records,
  };
}

function isPluginModelAsset(item) {
  return (
    item.origin === 'plugin' && ['agents', 'commands', 'rules', 'skills'].includes(item.category)
  );
}

function hasPrivilegeFrontmatter(item) {
  if (!['agents', 'commands', 'skills'].includes(item.category)) return false;
  const frontmatter = item.value?.frontmatter;
  if (!frontmatter || typeof frontmatter !== 'object') return false;
  return [
    'allowed-tools',
    'disallowed-tools',
    'hooks',
    'mcpServers',
    'permissionMode',
    'tools',
  ].some((key) => Object.hasOwn(frontmatter, key));
}

export function renderCapabilityReport(report) {
  const lines = [
    `Harness capability report ${report.generationHash}`,
    `native=${report.summary.native} degraded=${report.summary.degraded} unsupported=${report.summary.unsupported} security-failures=${report.summary.securityFailures}`,
  ];
  for (const record of report.records) {
    lines.push(
      `${record.sourceId} ${record.target} ${record.status} ${record.enabled ? 'enabled' : 'disabled'}: ${record.reason}`
    );
  }
  return `${lines.join('\n')}\n`;
}

function entry(status, representation, reason, securityRelevant) {
  return Object.freeze({
    status,
    representation,
    reason,
    securityRelevant,
    failClosed: securityRelevant && status !== 'native',
  });
}

function both(opencode, codex) {
  return Object.freeze({ codex, opencode });
}
