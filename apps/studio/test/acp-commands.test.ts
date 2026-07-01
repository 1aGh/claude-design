// Proves the slash-command catalogue path end-to-end against a mock ACP agent
// (fixtures/mock-acp-agent-commands.mjs) — no real `claude` needed:
//   • AcpBridge.warmUp() creates a session (no prompt) and surfaces the agent's
//     `available_commands_update` via onCommands.
//   • The Acp manager caches it, broadcasts a `{t:'commands'}` frame, and replays
//     the cached list to a freshly-opened socket.

import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import { AcpBridge } from '../acp/bridge.ts';
import { createAcp } from '../acp/index.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'mock-acp-agent-commands.mjs');
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

/** Minimal fake ServerWebSocket capturing every sent frame. */
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

describe('AcpBridge.warmUp — publishes the command catalogue without a prompt', () => {
  test('onCommands fires with the agent catalogue on warm-up', async () => {
    useMockAgent();
    const seen: Array<Array<{ name: string }>> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onCommands: (cmds) => seen.push(cmds as Array<{ name: string }>),
    });
    try {
      await bridge.warmUp('c1');
      expect(bridge.connected).toBe(true);
      const cmds = await until(() => (seen.length ? seen[seen.length - 1] : undefined));
      expect(cmds.map((c) => c.name)).toEqual(['design:edit', 'flow:plan']);
    } finally {
      await bridge.stop();
    }
  }, 20000);
});

describe('Acp manager — warm frame broadcasts + open replays commands', () => {
  test('a {t:warm} frame yields a {t:commands} frame, replayed to a new socket', async () => {
    useMockAgent();
    const ctx = {
      paths: { repoRoot: process.cwd(), designRoot: join(process.cwd(), '.design') },
    } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('ws-a');
    try {
      acp.onOpen(a.ws);
      // first frame is `ready`; no cached commands yet on a cold manager
      expect(a.frames[0]).toMatchObject({ t: 'ready' });
      expect(a.frames.some((f) => f.t === 'commands')).toBe(false);

      acp.onMessage(a.ws, JSON.stringify({ t: 'warm', chat: 'c1' }));
      const cmdFrame = await until(() => a.frames.find((f) => f.t === 'commands'));
      expect((cmdFrame.commands as Array<{ name: string }>).map((c) => c.name)).toEqual([
        'design:edit',
        'flow:plan',
      ]);

      // a second socket opening now replays the cached catalogue immediately
      const b = fakeWs('ws-b');
      acp.onOpen(b.ws);
      const replay = b.frames.find((f) => f.t === 'commands');
      expect(replay).toBeDefined();
      expect((replay?.commands as Array<{ name: string }>).length).toBe(2);
      acp.onClose(b.ws);
    } finally {
      acp.onClose(a.ws);
      // give teardown a tick to kill the subprocess
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 20000);
});
