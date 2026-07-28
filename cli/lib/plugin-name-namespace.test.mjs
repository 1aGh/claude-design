// DDR-006 (superseded) regression guard.
//
// Claude Code now prepends the `<plugin>:` namespace to every plugin
// command/agent/skill itself (fixed upstream in Claude Code 2.1.216 — see
// changelog "Fixed plugin skills with a `name` frontmatter field losing
// their plugin prefix in slash-command autocomplete" — and Claude Code
// 2.1.218 explicitly reserves `:` in agent names for that namespacing).
// Baking the prefix into our own `name:` frontmatter, which DDR-006
// (2026-05-13) required as a workaround for the OLD (opposite) bug, now
// produces a doubled prefix — `/design:design:new`, `flow:flow:a11y-auditor`.
//
// Two invariants this guards:
//   1. `name:` frontmatter in plugins/{design,flow}/{commands,agents,skills}/
//      must be the BARE slug — no `design:`/`flow:` prefix.
//   2. `subagent_type:` references to our OWN plugin agents must carry
//      exactly ONE `<plugin>:` prefix (the form the runtime's own namespace
//      + our bare `name:` resolves to) — never zero (broken lookup against
//      a namespaced registry) and never two (stale pre-fix leftover).

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { test } from 'node:test';

function grep(pattern, extraArgs = '') {
  const out = execSync(
    `grep -rn ${extraArgs} '${pattern}' plugins/design plugins/flow --include='*.md' || true`,
    { encoding: 'utf8' }
  );
  return out.trim().split('\n').filter(Boolean);
}

test('no plugin name: frontmatter carries a redundant design:/flow: prefix', () => {
  const offenders = grep('^name: \\(design\\|flow\\):');
  assert.deepEqual(
    offenders,
    [],
    `These files declare name: with the plugin prefix baked in — Claude Code adds the plugin namespace itself now, so this doubles into e.g. /design:design:new (DDR-006 superseded):\n  ${offenders.join('\n  ')}`
  );
});

test('no doubled design:design: / flow:flow: namespace anywhere in plugin markdown', () => {
  const offenders = grep('design:design:\\|flow:flow:');
  assert.deepEqual(
    offenders,
    [],
    `Doubled plugin namespace found — strip one level (DDR-006 superseded):\n  ${offenders.join('\n  ')}`
  );
});

test('subagent_type references to our own plugin agents carry exactly one <plugin>: prefix', () => {
  // Bare `subagent_type: <slug>` where <slug> looks like one of our
  // agent-style names (-critic/-agent/-auditor/-hacker/-keeper/-director/
  // -analyst suffix) but has no plugin prefix — excludes Claude Code
  // built-ins (e.g. code-simplifier, which is not one of our plugin agents)
  // and the `"<critic-name>"` template placeholder.
  const bareOffenders = grep(
    'subagent_type:.*"\\?[a-z][a-z0-9-]*\\(-critic\\|-agent\\|-auditor\\|-hacker\\|-keeper\\|-director\\|-analyst\\)"\\?'
  ).filter((line) => !/design:|flow:|<critic-name>|code-simplifier/.test(line));
  assert.deepEqual(
    bareOffenders,
    [],
    `These subagent_type references to a plugin-owned agent are missing the <plugin>: prefix and will fail to resolve against the namespaced registry:\n  ${bareOffenders.join('\n  ')}`
  );

  const doubledOffenders = grep('subagent_type:.*\\(design:design:\\|flow:flow:\\)');
  assert.deepEqual(
    doubledOffenders,
    [],
    `These subagent_type references are double-prefixed (DDR-006 superseded):\n  ${doubledOffenders.join('\n  ')}`
  );
});
