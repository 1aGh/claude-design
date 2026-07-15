// Proves the session-capabilities channel end-to-end against a mock ACP agent
// (fixtures/mock-acp-agent-caps.mjs) — no real `claude` needed. Covers Tasks
// A1/A2/A3/A4 of feature-acp-panel-dynamic-claude-code-capabilities:
//   • AcpBridge captures modes/configOptions from session/new and fires onCaps
//     once the resume-replay window is closed.
//   • AcpBridge.setMode/setConfigOption drive LIVE changes on an established
//     session (no respawn) and the full refreshed configOptions echoes back.
//   • setConfig's persisted model/effort/mode picks are applied ONCE, best-
//     effort, right after a session establishes (never onto an already-live one).
//   • The Acp manager (index.ts) validates `set-mode`/`set-config` frames
//     against the bridge's last-advertised caps before ever calling the bridge
//     (DDR-125 F1 — the dynamic replacement for VALID_MODELS/VALID_EFFORT).

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import { AcpBridge } from '../acp/bridge.ts';
import { createAcp } from '../acp/index.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'mock-acp-agent-caps.mjs');
const TEST_ENV_KEYS = ['MAUDE_ACP_ADAPTER_ENTRY', 'MAUDE_ACP_RUNTIME', 'MAUDE_CLAUDE_BIN'];

function useMockAgent() {
  process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
  process.env.MAUDE_ACP_RUNTIME = process.execPath;
  process.env.MAUDE_CLAUDE_BIN = process.execPath;
}

afterEach(() => {
  for (const key of TEST_ENV_KEYS) delete process.env[key];
});

async function until<T>(fn: () => T | undefined, timeoutMs = 12000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (performance.now() - start > timeoutMs) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 25));
  }
}

function fakeWs(id: string) {
  const frames: Array<Record<string, unknown>> = [];
  const ws = {
    data: { id } as WsData,
    send: (raw: string) => {
      frames.push(JSON.parse(raw));
    },
  } as unknown as ServerWebSocket<WsData>;
  return { ws, frames };
}

describe('AcpBridge — capability channel (Tasks A1/A2/A3)', () => {
  test('onCaps fires with the initial modes + configOptions once a session establishes', async () => {
    useMockAgent();
    const caps: Array<[unknown, unknown]> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onCaps: (modes, configOptions) => caps.push([modes, configOptions]),
    });
    try {
      await bridge.warmUp('c1');
      const [modes, configOptions] = await until(() =>
        caps.length ? caps[caps.length - 1] : undefined
      );
      expect((modes as { currentModeId: string }).currentModeId).toBe('default');
      expect(
        (modes as { availableModes: Array<{ id: string }> }).availableModes.map((m) => m.id)
      ).toEqual(['default', 'plan']);
      const ids = (configOptions as Array<{ id: string }>).map((o) => o.id);
      expect(ids).toEqual(['model', 'effort', 'mode']);
      expect(bridge.modes?.currentModeId).toBe('default');
      expect(bridge.configOptions.length).toBe(3);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('onSessionInfo fires with the agent-generated title', async () => {
    useMockAgent();
    const infos: Array<{ title?: string | null }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onSessionInfo: (info) => infos.push(info),
    });
    try {
      await bridge.warmUp('c1');
      const info = await until(() => (infos.length ? infos[infos.length - 1] : undefined));
      expect(info.title).toBe('New chat');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('setMode live-changes the mode on an established session (no respawn) and lastModes cross-derives from config_option_update', async () => {
    useMockAgent();
    const caps: Array<[unknown, unknown]> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onCaps: (modes, configOptions) => caps.push([modes, configOptions]),
    });
    try {
      await bridge.warmUp('c1');
      await until(() => (caps.length ? true : undefined));
      const procBefore = bridge.connected;

      await bridge.setMode('c1', 'plan');
      await until(() => {
        const last = caps[caps.length - 1];
        const modes = last?.[0] as { currentModeId: string } | null;
        return modes?.currentModeId === 'plan' ? true : undefined;
      });

      expect(bridge.connected).toBe(procBefore); // never tore down / respawned
      expect(bridge.modes?.currentModeId).toBe('plan');
      const modeOpt = bridge.configOptions.find((o) => o.id === 'mode') as
        | { currentValue?: unknown }
        | undefined;
      expect(modeOpt?.currentValue).toBe('plan');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('setConfigOption live-changes the model and the FULL refreshed option set echoes back through onCaps', async () => {
    useMockAgent();
    const caps: Array<[unknown, unknown]> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onCaps: (modes, configOptions) => caps.push([modes, configOptions]),
    });
    try {
      await bridge.warmUp('c1');
      await until(() => (caps.length ? true : undefined));
      expect(bridge.configOptions.some((o) => o.id === 'fast')).toBe(false);

      await bridge.setConfigOption('c1', 'model', 'opus');
      await until(() => (bridge.configOptions.some((o) => o.id === 'fast') ? true : undefined));

      const modelOpt = bridge.configOptions.find((o) => o.id === 'model') as
        | { currentValue?: unknown }
        | undefined;
      expect(modelOpt?.currentValue).toBe('opus');
      // Switching to opus offers a NEW "fast" option in this fixture — proves
      // the bridge feeds back the full refreshed set, not just the changed field.
      expect(bridge.configOptions.some((o) => o.id === 'fast')).toBe(true);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('setConfig persists a pick applied ONCE on a fresh session — never forced onto an already-live one', async () => {
    useMockAgent();
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      bridge.setConfig('opus', 'high', 'plan');
      await bridge.warmUp('c1');
      await until(() => (bridge.configOptions.length ? true : undefined));

      const modelOpt = bridge.configOptions.find((o) => o.id === 'model') as
        | { currentValue?: unknown }
        | undefined;
      const effortOpt = bridge.configOptions.find((o) => o.id === 'effort') as
        | { currentValue?: unknown }
        | undefined;
      expect(modelOpt?.currentValue).toBe('opus');
      expect(effortOpt?.currentValue).toBe('high');
      expect(bridge.modes?.currentModeId).toBe('plan');

      // A DIFFERENT persisted pick set later must NOT retroactively change this
      // already-established chat — it only affects the NEXT fresh session.
      bridge.setConfig('sonnet', 'default', 'default');
      await bridge.prompt('hi', 'c1');
      const modelAfter = bridge.configOptions.find((o) => o.id === 'model') as
        | { currentValue?: unknown }
        | undefined;
      expect(modelAfter?.currentValue).toBe('opus'); // unchanged — no forced respawn
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('an unsupported persisted pick is skipped, not thrown — the session keeps its own default', async () => {
    useMockAgent();
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      bridge.setConfig('does-not-exist-model', null, 'does-not-exist-mode');
      await bridge.warmUp('c1'); // must not throw
      await until(() => (bridge.configOptions.length ? true : undefined));
      const modelOpt = bridge.configOptions.find((o) => o.id === 'model') as
        | { currentValue?: unknown }
        | undefined;
      expect(modelOpt?.currentValue).toBe('sonnet'); // session's own default, untouched
      expect(bridge.modes?.currentModeId).toBe('default');
    } finally {
      await bridge.stop();
    }
  }, 15000);
});

describe('Acp manager — set-mode/set-config frames validate against last-advertised caps (DDR-125 F1)', () => {
  test('a caps frame is broadcast on establish; set-mode/set-config apply live; unadvertised values are rejected silently', async () => {
    useMockAgent();
    const designRoot = await mkdtemp(join(tmpdir(), 'acp-caps-test-'));
    const ctx = { paths: { repoRoot: process.cwd(), designRoot } } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('caps-ws-a');
    try {
      acp.onOpen(a.ws);
      acp.onMessage(a.ws, JSON.stringify({ t: 'warm', chat: 'c1' }));
      const capsFrame = await until(() => a.frames.find((f) => f.t === 'caps'));
      expect((capsFrame.modes as { currentModeId: string }).currentModeId).toBe('default');

      // Valid live mode change — advertised by the caps frame above.
      acp.onMessage(a.ws, JSON.stringify({ t: 'set-mode', chat: 'c1', modeId: 'plan' }));
      await until(() =>
        a.frames.find(
          (f) =>
            f.t === 'caps' &&
            (f.modes as { currentModeId?: string } | null)?.currentModeId === 'plan'
        )
      );

      // An unadvertised modeId must be rejected BEFORE ever reaching the bridge
      // — no new caps frame, no error frame, no crash.
      const framesBefore = a.frames.length;
      acp.onMessage(
        a.ws,
        JSON.stringify({ t: 'set-mode', chat: 'c1', modeId: 'bypassPermissions' })
      );
      await new Promise((r) => setTimeout(r, 150));
      expect(a.frames.length).toBe(framesBefore); // nothing new sent

      // An unadvertised config value is likewise rejected pre-call.
      acp.onMessage(
        a.ws,
        JSON.stringify({ t: 'set-config', chat: 'c1', configId: 'model', value: 'gpt-5' })
      );
      await new Promise((r) => setTimeout(r, 150));
      expect(a.frames.length).toBe(framesBefore);

      // A valid config change still works after the rejected attempts.
      acp.onMessage(
        a.ws,
        JSON.stringify({ t: 'set-config', chat: 'c1', configId: 'model', value: 'opus' })
      );
      await until(() =>
        a.frames.find(
          (f) =>
            f.t === 'caps' &&
            (f.configOptions as Array<{ id: string; currentValue?: unknown }>).find(
              (o) => o.id === 'model'
            )?.currentValue === 'opus'
        )
      );
    } finally {
      acp.onClose(a.ws);
      await new Promise((r) => setTimeout(r, 50));
      await rm(designRoot, { recursive: true, force: true });
    }
  }, 20000);
});
