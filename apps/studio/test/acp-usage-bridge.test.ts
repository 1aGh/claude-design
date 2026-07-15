// Proves the usage-channel harvest (Milestone D, Task D1) end-to-end against
// a mock ACP agent (fixtures/mock-acp-agent-usage.mjs) — no real `claude`
// needed. Covers: onUsage fires with {used,size,cost}, the rate-limit _meta
// payload is carried through opaque, usage_update never leaks into onUpdate
// (chrome, not turn content), and the Acp manager caches + replays it to a
// freshly-opened socket.

import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import { AcpBridge, type BridgeUsage } from '../acp/bridge.ts';
import { createAcp } from '../acp/index.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'mock-acp-agent-usage.mjs');
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

describe('AcpBridge — usage harvest (Task D1)', () => {
  test('onUsage fires with used/size/cost; usage_update never reaches onUpdate', async () => {
    useMockAgent();
    const usages: BridgeUsage[] = [];
    const updates: unknown[] = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onUsage: (u) => usages.push(u),
    });
    try {
      await bridge.prompt('hi', 'c1');
      const usage = await until(() => (usages.length ? usages[usages.length - 1] : undefined));
      expect(usage.used).toBe(4200);
      expect(usage.size).toBe(200000);
      expect(usage.cost).toEqual({ amount: 0.0123, currency: 'USD' });
      expect(bridge.usage).toEqual(usage);
      // chrome, not turn content — no usage_update leaked into onUpdate
      expect(
        updates.some((u) => (u as { sessionUpdate?: string }).sessionUpdate === 'usage_update')
      ).toBe(false);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('the rate-limit _meta payload is carried through opaque', async () => {
    useMockAgent();
    const usages: BridgeUsage[] = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onUsage: (u) => usages.push(u),
    });
    try {
      await bridge.prompt('trigger-rate-limit', 'c1');
      const withRateLimit = await until(() => usages.find((u) => u.rateLimit != null));
      expect(withRateLimit.rateLimit).toMatchObject({
        status: 'allowed_warning',
        rateLimitType: 'five_hour',
        utilization: 82,
      });
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('no usage yet → bridge.usage is null', async () => {
    useMockAgent();
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      expect(bridge.usage).toBeNull();
    } finally {
      await bridge.stop();
    }
  }, 15000);
});

describe('Acp manager — usage frame is cached + replayed on a fresh socket (Task D1)', () => {
  test('a usage frame is broadcast during a turn, then replayed to a newly-opened socket', async () => {
    useMockAgent();
    const ctx = {
      paths: { repoRoot: process.cwd(), designRoot: '/tmp/does-not-matter-usage' },
    } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('usage-ws-a');
    try {
      acp.onOpen(a.ws);
      acp.onMessage(a.ws, JSON.stringify({ t: 'prompt', text: 'hi', chat: 'c1' }));
      const usageFrame = await until(() => a.frames.find((f) => f.t === 'usage'));
      expect((usageFrame.usage as BridgeUsage).used).toBe(4200);

      const b = fakeWs('usage-ws-b');
      acp.onOpen(b.ws);
      const replay = b.frames.find((f) => f.t === 'usage');
      if (!replay) throw new Error('expected a replayed usage frame');
      expect((replay.usage as BridgeUsage).used).toBe(4200);
      acp.onClose(b.ws);
    } finally {
      acp.onClose(a.ws);
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 20000);
});
