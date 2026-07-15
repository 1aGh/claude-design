// Proves the permission approve/deny gate end-to-end (Milestone B, retires
// DDR-125 F2's blanket auto-approve) against a mock ACP agent that calls back
// into the client via a REAL `session/request_permission` request (fixtures/
// mock-acp-agent-permission.mjs) — no real `claude` needed. Covers:
//   • requestPermission is forwarded via onPermissionRequest (+ onPermission
//     transparency) and stays pending until resolvePermission is called.
//   • A valid decision (an offered optionId, or 'cancelled') resolves it.
//   • An UNOFFERED decision fails closed to 'cancelled' (DDR-125 F1 posture).
//   • Timeout defaults to 'cancelled' (deny), never allow.
//   • A turn-cancel denies every pending request instead of leaving it hung.
//   • The Acp manager relays permission-request/-response frames end to end.

import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import { AcpBridge } from '../acp/bridge.ts';
import { createAcp } from '../acp/index.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'mock-acp-agent-permission.mjs');
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

describe('AcpBridge — permission approve/deny (Task B1)', () => {
  test('a request is forwarded via onPermissionRequest + onPermission, stays pending, and a valid decision resolves the turn', async () => {
    useMockAgent();
    const requests: Array<{ id: string; toolCallTitle?: string; optionIds: string[] }> = [];
    const transparency: unknown[] = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onPermission: (req) => transparency.push(req),
      onPermissionRequest: (id, req) =>
        requests.push({ id, toolCallTitle: req.toolCall?.title, optionIds: req.options.map((o) => o.optionId) }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      expect(req.toolCallTitle).toBe('Write file');
      expect(req.optionIds).toEqual(['allow-once', 'allow-always', 'reject-once']);
      expect(transparency.length).toBe(1); // transparency fires unconditionally too

      bridge.resolvePermission(req.id, 'allow-once');
      await promptPromise;
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('an unoffered decision fails closed to cancelled — never forwards an arbitrary optionId', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onPermissionRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      // Not one of ['allow-once','allow-always','reject-once'] — must deny, not select.
      bridge.resolvePermission(req.id, 'some-optionId-never-offered');
      await promptPromise;
      const text = updates.map((u) => u?.content?.text ?? '').join('');
      expect(text).toContain('"outcome":"cancelled"');
      expect(text).not.toContain('some-optionId-never-offered');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('resolvePermission("cancelled") denies explicitly', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onPermissionRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      bridge.resolvePermission(req.id, 'cancelled');
      await promptPromise;
      const text = updates.map((u) => u?.content?.text ?? '').join('');
      expect(text).toContain('"outcome":"cancelled"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a stale/unknown id is a silent no-op — never throws', async () => {
    useMockAgent();
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      expect(() => bridge.resolvePermission('does-not-exist', 'allow-once')).not.toThrow();
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('timeout defaults to cancelled (deny), never allow', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      permissionTimeoutMs: 150, // short override — see AcpBridgeOptions.permissionTimeoutMs (tests only)
    });
    try {
      await bridge.prompt('hi', 'c1'); // never calls resolvePermission — must resolve itself
      const text = updates.map((u) => u?.content?.text ?? '').join('');
      expect(text).toContain('"outcome":"cancelled"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a turn-cancel denies every pending permission request instead of hanging it forever', async () => {
    useMockAgent();
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onPermissionRequest: (id) => requests.push({ id }),
      permissionTimeoutMs: 60000, // long — proves cancel() settles it, not the timeout racing in
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      await until(() => (requests.length ? true : undefined));
      await bridge.cancel(); // must deny the pending request, not leave it hanging
      await promptPromise; // resolves because the mock's requestPermission() call unblocked
    } finally {
      await bridge.stop();
    }
  }, 15000);
});

describe('Acp manager — permission-request/-response frames (Task B2)', () => {
  test('a permission-request frame is relayed to the client and a valid permission-response resolves it', async () => {
    useMockAgent();
    const ctx = { paths: { repoRoot: process.cwd(), designRoot: '/tmp/does-not-matter' } } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('perm-ws-a');
    try {
      acp.onOpen(a.ws);
      acp.onMessage(a.ws, JSON.stringify({ t: 'prompt', text: 'hi', chat: 'c1' }));
      const reqFrame = await until(() => a.frames.find((f) => f.t === 'permission-request'));
      expect(reqFrame.toolCall).toMatchObject({ title: 'Write file' });
      const options = reqFrame.options as Array<{ optionId: string }>;
      expect(options.map((o) => o.optionId)).toEqual(['allow-once', 'allow-always', 'reject-once']);

      acp.onMessage(
        a.ws,
        JSON.stringify({ t: 'permission-response', id: reqFrame.id, decision: 'allow-once' })
      );
      await until(() => a.frames.find((f) => f.t === 'turn-end'));
    } finally {
      acp.onClose(a.ws);
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 20000);

  test('a permission-response with an unknown id is a harmless no-op — the turn still settles via timeout', async () => {
    useMockAgent();
    const ctx = { paths: { repoRoot: process.cwd(), designRoot: '/tmp/does-not-matter-2' } } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('perm-ws-b');
    try {
      acp.onOpen(a.ws);
      acp.onMessage(a.ws, JSON.stringify({ t: 'prompt', text: 'hi', chat: 'c1' }));
      await until(() => a.frames.find((f) => f.t === 'permission-request'));

      // Bogus id — must not throw / crash the manager.
      expect(() =>
        acp.onMessage(a.ws, JSON.stringify({ t: 'permission-response', id: 'not-a-real-id', decision: 'allow-once' }))
      ).not.toThrow();
    } finally {
      acp.onClose(a.ws);
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 20000);
});
