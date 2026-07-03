// DDR-143 — session-scoped plugin auto-bootstrap: the WIRE contract.
//
// Two layers: (1) the newSession params carrier — the resolved plugin configs
// must land on `_meta.claudeCode.options.plugins`, coexisting with the studio
// brief's `_meta.systemPrompt.append`; (2) the UPGRADE GUARD — that `_meta` path
// is adapter/SDK-INTERNAL and undocumented, so a dependency bump that stops
// forwarding `_meta.claudeCode.options` (adapter) or drops `plugins` (SDK) must
// fail HERE, loudly, instead of silently shipping a desktop app whose chat
// resolves no `/design:*` on a pristine machine.

import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { newSessionParams } from '../acp/bridge.ts';
import type { SdkPluginConfig } from '../acp/plugin-bootstrap.ts';

const PLUGINS: SdkPluginConfig[] = [
  { type: 'local', path: '/bundle/plugins/design', skipMcpDiscovery: true },
  { type: 'local', path: '/bundle/plugins/flow', skipMcpDiscovery: true },
];

type Meta = {
  systemPrompt?: { append?: string };
  claudeCode?: { options?: { plugins?: SdkPluginConfig[]; settingSources?: string[] } };
};

describe('newSessionParams — plugin carrier shape', () => {
  test('with plugins: they ride _meta.claudeCode.options.plugins', () => {
    const p = newSessionParams('/repo', undefined, PLUGINS);
    expect(p.cwd).toBe('/repo');
    expect((p._meta as Meta).claudeCode?.options?.plugins).toEqual(PLUGINS);
  });

  test('empty plugins: claudeCode carries settingSources but NO plugins (power-user / web no-op)', () => {
    const p = newSessionParams('/repo', 'BRIEF', []);
    const opts = (p._meta as Meta).claudeCode?.options;
    expect(opts?.plugins).toBeUndefined();
    expect(opts?.settingSources).toEqual(['user']); // security narrowing always present
  });

  test('undefined plugins: claudeCode carries settingSources, no plugins', () => {
    const p = newSessionParams('/repo', 'BRIEF');
    const opts = (p._meta as Meta).claudeCode?.options;
    expect(opts?.plugins).toBeUndefined();
    expect(opts?.settingSources).toEqual(['user']);
  });

  test('brief + plugins coexist under one _meta (both siblings intact)', () => {
    const p = newSessionParams('/repo', 'BRIEF', PLUGINS);
    const meta = p._meta as Meta;
    expect(meta.systemPrompt?.append).toBe('BRIEF');
    expect(meta.claudeCode?.options?.plugins).toEqual(PLUGINS);
  });

  test('plugins only, no brief: still no systemPrompt, but claudeCode present', () => {
    const p = newSessionParams('/repo', undefined, PLUGINS);
    const meta = p._meta as Meta;
    expect(meta.systemPrompt).toBeUndefined();
    expect(meta.claudeCode?.options?.plugins).toEqual(PLUGINS);
  });

  test('nothing injected: _meta still carries the settingSources security narrowing', () => {
    const p = newSessionParams('/repo', undefined, []);
    const meta = p._meta as Meta;
    expect(meta.systemPrompt).toBeUndefined();
    expect(meta.claudeCode?.options?.plugins).toBeUndefined();
    // Every Maude bridge session is auto-approving → settingSources is ALWAYS narrowed.
    expect(meta.claudeCode?.options?.settingSources).toEqual(['user']);
  });

  test('settingSources is narrowed to user-only on EVERY session (DDR-144 F2)', () => {
    for (const p of [
      newSessionParams('/repo'),
      newSessionParams('/repo', 'BRIEF'),
      newSessionParams('/repo', 'BRIEF', PLUGINS),
      newSessionParams('/repo', undefined, PLUGINS),
    ]) {
      expect((p._meta as Meta).claudeCode?.options?.settingSources).toEqual(['user']);
    }
  });
});

describe('upgrade guard — installed adapter + SDK still honor the plugins contract', () => {
  const adapterEntry = join(
    import.meta.dir,
    '..',
    'node_modules',
    '@agentclientprotocol',
    'claude-agent-acp',
    'dist',
    'acp-agent.js'
  );

  test('adapter newSession reads _meta.claudeCode.options and forwards it to query()', () => {
    expect(existsSync(adapterEntry)).toBe(true);
    const src = readFileSync(adapterEntry, 'utf8');
    // Verified at claude-agent-acp@0.49.0 (acp-agent.js newSession):
    //   const userProvidedOptions = sessionMeta?.claudeCode?.options;   (:2302)
    //   const options = { …, ...userProvidedOptions, … };               (:2333)
    //   const q = query({ prompt: input, options });                    (:2455)
    // `plugins` is not in the override list after the spread, so it survives into
    // query(). A bump that renames/drops any link in this chain must fail here —
    // then adapt, or fall back to settings.enabledPlugins + a local marketplace
    // (plan Task 1 fallback).
    expect(src).toMatch(/claudeCode\s*(\?\.|\.)\s*options/);
    expect(src).toContain('userProvidedOptions');
    expect(src).toMatch(/\.\.\.userProvidedOptions/);
    expect(src).toMatch(/query\(\{[\s\S]{0,80}options[\s\S]{0,40}\}\)/);
  });

  test('SDK Options declares plugins?: SdkPluginConfig[] (the accepted field)', () => {
    // Resolve the transitive @anthropic-ai/claude-agent-sdk. Resolve from the
    // adapter's REAL dir (pnpm store), where the SDK is a peer sibling — the
    // apps/studio symlink alone doesn't expose the pnpm peer node_modules.
    let sdkPkg: string | null = null;
    try {
      const realAdapterDir = dirname(realpathSync(adapterEntry));
      sdkPkg = Bun.resolveSync('@anthropic-ai/claude-agent-sdk/package.json', realAdapterDir);
    } catch {
      sdkPkg = null;
    }
    expect(sdkPkg).not.toBeNull();
    const dts = join(dirname(sdkPkg as string), 'sdk.d.ts');
    expect(existsSync(dts)).toBe(true);
    const src = readFileSync(dts, 'utf8');
    // sdk.d.ts:1683 `plugins?: SdkPluginConfig[];` + :3766 the { type:'local'; path } shape.
    expect(src).toMatch(/plugins\?\s*:\s*SdkPluginConfig\[\]/);
    expect(src).toMatch(/SdkPluginConfig\s*=\s*\{/);
    expect(src).toMatch(/type:\s*'local'/);
  });
});
