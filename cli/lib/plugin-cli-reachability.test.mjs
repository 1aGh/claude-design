// DDR-061 + DDR-062 regression guard.
//
// DDR-061: a plugin must NEVER invoke a `cli/lib/*.mjs` module by a relative
// path unconditionally: in a marketplace install the plugin is copied alone into
// `cache/<marketplace>/<plugin>/<version>/`, so the sibling `cli/` does not
// exist and the call crashes with MODULE_NOT_FOUND. The reachable contract is
// the on-PATH `maude` binary (a declared plugin dependency).
//
// So any plugin file that runs `node … cli/lib/<x>.mjs` is only allowed when the
// SAME file also offers a `command -v maude` fallback (the sibling-first /
// maude-fallback pattern). This test fails loudly if a new straggler lands.
//
// DDR-062: plugin MARKDOWN must reach the dev-server bash helpers through
// `maude design <verb>`, never `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/<x>.sh"`.
// The marketplace never copies the dev-server beside a plugin, and a flow
// command's $CLAUDE_PLUGIN_ROOT points at plugins/flow (no dev-server/ at all).
// Prose mentions of the path are fine; INVOCATIONS (bash/sh/exec/$( prefixed)
// are banned.

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('no plugin runs `node cli/lib/*.mjs` without an on-PATH maude fallback', () => {
  const out = execSync(
    String.raw`grep -rlE 'node[^\n]*cli/lib/[a-z0-9_-]+\.mjs' plugins/ || true`,
    {
      encoding: 'utf8',
    }
  );
  const files = out.trim().split('\n').filter(Boolean);
  const offenders = files.filter((f) => !/command -v maude/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(
    offenders,
    [],
    `These plugin files invoke a relative cli/lib module with no \`command -v maude\` fallback — they will crash in a marketplace install (DDR-061). Route through \`maude <subcommand>\` or guard with a sibling-exists check + maude fallback:\n  ${offenders.join('\n  ')}`
  );
});

test('no plugin markdown invokes a $CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh helper (DDR-062)', () => {
  // INVOCATION = the bin path preceded by bash / sh / exec, or inside a $(…)
  // command substitution. Prose mentions of the path (backtick-wrapped, no verb)
  // are exempt — they don't run anything. Matches both the $CLAUDE_PLUGIN_ROOT
  // form and the repo-relative `plugins/<x>/dev-server/bin/` form.
  const pattern = String.raw`(bash|sh|exec) +"?(\$\{?CLAUDE_PLUGIN_ROOT\}?|plugins/[a-z]+)/dev-server/bin/[A-Za-z0-9_-]+\.sh|\$\("?\$?\{?CLAUDE_PLUGIN_ROOT\}?/dev-server/bin/[A-Za-z0-9_-]+\.sh`;
  const out = execSync(`grep -rnE '${pattern}' plugins --include='*.md' || true`, {
    encoding: 'utf8',
  });
  const hits = out.trim().split('\n').filter(Boolean);
  assert.deepEqual(
    hits,
    [],
    `These plugin markdown lines INVOKE a dev-server bin helper directly — they break in marketplace installs (the dev-server is never copied beside a plugin) and in flow commands (whose $CLAUDE_PLUGIN_ROOT has no dev-server/). Route through \`maude design <verb>\` instead (DDR-062):\n  ${hits.join('\n  ')}`
  );
});
