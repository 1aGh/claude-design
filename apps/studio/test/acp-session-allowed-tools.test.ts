// DDR-184 — the curated tool allow-list the bridge auto-approves so the design
// workflow never stalls on a per-edit / per-`maude` permission prompt (the
// "Manual mode blocks every edit" complaint). Two things under test:
//
//   (1) WIRE contract — the list lands on `_meta.claudeCode.options.allowedTools`
//       (SDK `allowedTools`, sdk.d.ts:1331), coexisting with the DDR-144
//       `settingSources` narrowing and the DDR-143 `plugins` carrier. Same
//       adapter/SDK-INTERNAL `_meta` path as acp-session-plugins.test.ts — a
//       bump that stops forwarding it must fail HERE, not silently re-prompt.
//   (2) SOURCE-OF-TRUTH guard — the single `Bash(maude:*)` rule only covers the
//       whole design-helper surface because DDR-062 routes every helper through
//       `maude design <verb>`. If that stops being true, or someone widens the
//       Bash scope, this test fails loudly.

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

  test('the ONLY Bash rule is prefix-scoped to `maude` — never a bare/un-scoped Bash', () => {
    // A bare `Bash` (or `Bash(*)`) would auto-approve arbitrary command execution
    // — exactly the blanket surface DDR-179 kept behind the prompt. Guard against
    // anyone widening it: the list may auto-approve `maude` and nothing else.
    expect(bashRules).toEqual(['Bash(maude:*)']);
  });

  test('the single Bash rule is load-bearing on DDR-062: every design helper is a `maude design <verb>`', () => {
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
});
