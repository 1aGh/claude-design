// DDR-184 (+ DDR-185) — the curated tool allow-list the bridge auto-approves so
// the design workflow never stalls on a per-edit / per-`maude` permission
// prompt (the "Manual mode blocks every edit" complaint). Three things under
// test:
//
//   (1) WIRE contract — the list lands on `_meta.claudeCode.options.allowedTools`
//       (SDK `allowedTools`, sdk.d.ts:1331), coexisting with the DDR-144
//       `settingSources` narrowing and the DDR-143 `plugins` carrier. Same
//       adapter/SDK-INTERNAL `_meta` path as acp-session-plugins.test.ts — a
//       bump that stops forwarding it must fail HERE, not silently re-prompt.
//   (2) SOURCE-OF-TRUTH guard — the Bash rules are EXACTLY `Bash(maude:*)`,
//       `Bash(agent-browser:*)`, and a closed read-only fs verb set (DDR-185)
//       — nothing else. `Bash(maude:*)` covers the whole design-helper surface
//       because DDR-062 routes every helper through `maude design <verb>`;
//       `Bash(agent-browser:*)` covers the RAW agent-browser calls documented
//       in `motion-critic.md`/`edit.md` that DDR-062 doesn't reach. If either
//       assumption stops being true, or someone widens the Bash scope beyond
//       this fixed set, this test fails loudly.
//   (3) `WebSearch`/`WebFetch` (DDR-185) are present as bare native tool names
//       — no prefix-matching involved, so no source-of-truth guard needed the
//       way the Bash rules need one.

import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { MAUDE_DEFAULT_ALLOWED_TOOLS, newSessionParams } from '../acp/bridge.ts';
import type { SdkPluginConfig } from '../acp/plugin-bootstrap.ts';

type Meta = {
  systemPrompt?: { append?: string };
  claudeCode?: {
    options?: {
      allowedTools?: string[];
      plugins?: SdkPluginConfig[];
      settingSources?: string[];
    };
  };
};

const PLUGINS: SdkPluginConfig[] = [
  { type: 'local', path: '/bundle/plugins/design', skipMcpDiscovery: true },
];

describe('newSessionParams — allowedTools carrier shape (DDR-184)', () => {
  test('the allow-list rides _meta.claudeCode.options.allowedTools', () => {
    const opts = (newSessionParams('/repo', undefined)._meta as Meta).claudeCode?.options;
    expect(opts?.allowedTools).toEqual([...MAUDE_DEFAULT_ALLOWED_TOOLS]);
  });

  test('allowedTools is a COPY, not the shared module constant (no accidental mutation)', () => {
    const opts = (newSessionParams('/repo')._meta as Meta).claudeCode?.options;
    expect(opts?.allowedTools).not.toBe(MAUDE_DEFAULT_ALLOWED_TOOLS);
  });

  test('coexists with settingSources (DDR-144) and plugins (DDR-143) under one options', () => {
    const opts = (newSessionParams('/repo', 'BRIEF', PLUGINS)._meta as Meta).claudeCode?.options;
    expect(opts?.settingSources).toEqual(['user']);
    expect(opts?.plugins).toEqual(PLUGINS);
    expect(opts?.allowedTools).toEqual([...MAUDE_DEFAULT_ALLOWED_TOOLS]);
  });

  test('present even with no plugins (npm / web / power-user path)', () => {
    const opts = (newSessionParams('/repo', 'BRIEF', [])._meta as Meta).claudeCode?.options;
    expect(opts?.plugins).toBeUndefined();
    expect(opts?.allowedTools).toEqual([...MAUDE_DEFAULT_ALLOWED_TOOLS]);
  });
});

describe('MAUDE_DEFAULT_ALLOWED_TOOLS — source-of-truth guard (DDR-184 / DDR-062)', () => {
  const bashRules = MAUDE_DEFAULT_ALLOWED_TOOLS.filter((t) => t.startsWith('Bash'));

  test('the canvas-editing file tools are all present', () => {
    for (const t of ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'NotebookEdit']) {
      expect(MAUDE_DEFAULT_ALLOWED_TOOLS).toContain(t);
    }
  });

  test('WebSearch and WebFetch are present (DDR-185)', () => {
    for (const t of ['WebSearch', 'WebFetch']) {
      expect(MAUDE_DEFAULT_ALLOWED_TOOLS).toContain(t);
    }
  });

  test('the Bash rules are EXACTLY this closed set — never a bare/un-scoped Bash', () => {
    // A bare `Bash` (or `Bash(*)`) would auto-approve arbitrary command execution
    // — exactly the blanket surface DDR-179 kept behind the prompt. Guard against
    // anyone widening it: the list may auto-approve `maude`, `agent-browser`, and
    // the closed read-only fs verb set (DDR-185) — nothing else. In particular,
    // `Bash(curl:*)` must NEVER appear here — DDR-185 deliberately routes
    // localhost curl through the `curl-local` verb (covered by `Bash(maude:*)`)
    // instead, specifically so raw curl to an arbitrary host keeps prompting.
    expect(bashRules).toEqual([
      'Bash(maude:*)',
      'Bash(agent-browser:*)',
      'Bash(ls:*)',
      'Bash(cat:*)',
      'Bash(pwd:*)',
      'Bash(find:*)',
      'Bash(head:*)',
      'Bash(tail:*)',
      'Bash(wc:*)',
      'Bash(tree:*)',
      'Bash(file:*)',
      'Bash(stat:*)',
    ]);
  });

  test('the `maude` Bash rule is load-bearing on DDR-062: every design helper is a `maude design <verb>`', () => {
    // Resolve cli/commands/design.mjs relative to this test file's real path
    // (mirrors acp-session-plugins.test.ts's realpath dance for compiled roots).
    const here = dirname(realpathSync(import.meta.url.replace('file://', '')));
    const designCli = join(here, '..', '..', '..', 'cli', 'commands', 'design.mjs');
    expect(existsSync(designCli)).toBe(true);
    const src = readFileSync(designCli, 'utf8');
    // The dispatch table the `Bash(maude:*)` scope rests on — helpers reached via
    // `maude design <verb>`, not raw `bash <path>.sh` (DDR-062). If this marker
    // disappears, the one-rule assumption needs re-checking.
    expect(src).toContain('BIN_VERBS');
    expect(src).toMatch(/maude design <verb>/);
  });

  test('the `curl-local` verb exists and is reached via `maude design <verb>` (DDR-185)', () => {
    // The mechanism the `Bash(agent-browser:*)`/fs-list comment in bridge.ts
    // promises for curl: real host enforcement via a first-party verb, not a
    // Bash prefix rule. If this verb disappears from BIN_VERBS, the DDR-185
    // curl story (and the bootstrap-brief nudge pointing at it) goes stale.
    const here = dirname(realpathSync(import.meta.url.replace('file://', '')));
    const designCli = join(here, '..', '..', '..', 'cli', 'commands', 'design.mjs');
    const src = readFileSync(designCli, 'utf8');
    expect(src).toMatch(/'curl-local'/);
  });

  test('the `agent-browser` Bash rule is load-bearing: it is a declared design-plugin dependency', () => {
    // `plugins/design/dependencies.json` is the source of truth for "this is a
    // named, vetted, first-party-adjacent tool" — not an arbitrary shell escape
    // hatch. If the dependency entry disappears, the trust argument in
    // bridge.ts's comment needs re-checking.
    const here = dirname(realpathSync(import.meta.url.replace('file://', '')));
    const depsPath = join(here, '..', '..', '..', 'plugins', 'design', 'dependencies.json');
    expect(existsSync(depsPath)).toBe(true);
    const deps = JSON.parse(readFileSync(depsPath, 'utf8')) as {
      dependencies?: Array<{ id?: string }>;
    };
    expect(deps.dependencies?.some((d) => d.id === 'agent-browser')).toBe(true);
  });
});
