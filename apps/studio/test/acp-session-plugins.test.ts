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
  claudeCode?: {
    options?: {
      plugins?: SdkPluginConfig[];
      settingSources?: string[];
      settings?: { enabledPlugins?: Record<string, boolean> };
    };
  };
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

  // DDR-168 — the structural double-registration guard: a non-empty `plugins`
  // must also force off any natively-loaded user-level copy of the same id via
  // the SDK's "flag" settings layer, so the bundled copy is the ONLY one that
  // ever loads.
  test('with plugins: forces design@maude off via options.settings.enabledPlugins (double-registration guard)', () => {
    const p = newSessionParams('/repo', undefined, PLUGINS);
    expect((p._meta as Meta).claudeCode?.options?.settings?.enabledPlugins).toEqual({
      'design@maude': false,
    });
  });

  test('empty plugins: options.settings is entirely absent (web/npm path unaffected)', () => {
    const p = newSessionParams('/repo', 'BRIEF', []);
    expect((p._meta as Meta).claudeCode?.options?.settings).toBeUndefined();
  });

  test('undefined plugins: options.settings is entirely absent', () => {
    const p = newSessionParams('/repo', 'BRIEF');
    expect((p._meta as Meta).claudeCode?.options?.settings).toBeUndefined();
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

  // DDR-168 — the same style of guard, for the `options.settings` mechanism the
  // double-registration fix depends on: `settings` must NOT be among the fields
  // the adapter overrides after the `...userProvidedOptions` spread (else our
  // `enabledPlugins: false` override would be silently discarded), and the SDK
  // must still declare `Settings.enabledPlugins` as an accepted field.
  test('adapter forwards `settings` from userProvidedOptions and only ever overrides it conditionally when the caller left it unset', () => {
    expect(existsSync(adapterEntry)).toBe(true);
    const src = readFileSync(adapterEntry, 'utf8');
    // Locate the `...userProvidedOptions` spread and inspect what follows it up
    // to the `query({ options })` call. Verified live at claude-agent-acp@0.57.0:
    // the object DOES contain a later `settings:` assignment (a
    // CLAUDE_MODEL_CONFIG env-var fallback) — but it's gated behind
    // `!userProvidedOptions?.settings && …`, i.e. it only fires when the caller
    // did NOT already provide a settings object. A caller-provided `settings`
    // (ours, carrying `enabledPlugins`) always wins. A bump that drops that
    // guard — making the fallback unconditional — must fail here, since it
    // would silently clobber DDR-168's double-registration override.
    const spreadIdx = src.indexOf('...userProvidedOptions');
    expect(spreadIdx).toBeGreaterThan(-1);
    const queryIdx = src.indexOf('query(', spreadIdx);
    expect(queryIdx).toBeGreaterThan(spreadIdx);
    const window = src.slice(spreadIdx, queryIdx);
    expect(window).toMatch(/!userProvidedOptions\?\.settings\s*&&/);
  });

  test("SDK Options declares settings (Settings.enabledPlugins is the field DDR-168's guard relies on)", () => {
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
    // sdk.d.ts:1831 `settings?: Settings;` (or similarly named field on Options) +
    // :5193 `Settings.enabledPlugins` — a bump that renames/drops either must
    // fail here, then adapt, rather than silently reopening double-registration.
    expect(src).toMatch(/settings\?\s*:/);
    expect(src).toMatch(/enabledPlugins\??\s*:/);
  });
});
