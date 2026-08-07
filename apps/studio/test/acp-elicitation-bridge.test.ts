// Proves the elicitation-form gate end-to-end (feature-acp-ask-user-question)
// against a mock ACP agent that calls back into the client via a REAL
// `elicitation/create` request (fixtures/mock-acp-agent-elicit.mjs), shaped
// exactly like the AskUserQuestion → form-elicitation mapping
// (askUserQuestionsToCreateRequest) — no real `claude` needed. Covers:
//   • the request is forwarded via onElicitationRequest and stays pending.
//   • accept with a selected option resolves with that content.
//   • accept with a custom free-text answer resolves with that content
//     (mirrors applyAskElicitationResponse's override rule — the UI, not the
//     bridge, decides which one to send; the bridge just forwards it).
//   • accept with missing/malformed content fails closed to decline — never
//     fabricates content.
//   • an explicit decline / cancel round-trips as sent.
//   • a malformed/unrecognized action fails closed to decline.
//   • timeout defaults to decline (not cancel — decline lets the turn
//     continue per applyAskElicitationResponse's documented contract).
//   • a turn-cancel declines every pending request instead of hanging it.
//   • a stale/unknown id is a silent no-op.
//   • the Acp manager relays elicitation-request/-response frames end to end.

import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import {
  AcpBridge,
  elicitationSchemaWithinBounds,
  MAX_ELICITATION_SCHEMA_BYTES,
  MAX_ELICITATION_SCHEMA_PROPERTIES,
  MAX_PENDING_ELICITATIONS,
} from '../acp/bridge.ts';
import { createAcp } from '../acp/index.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'mock-acp-agent-elicit.mjs');
const FIXTURE_URL = join(import.meta.dir, 'fixtures', 'mock-acp-agent-elicit-url.mjs');
const FIXTURE_FLOOD = join(import.meta.dir, 'fixtures', 'mock-acp-agent-elicit-flood.mjs');
const TEST_ENV_KEYS = ['MAUDE_ACP_ADAPTER_ENTRY', 'MAUDE_ACP_RUNTIME', 'MAUDE_CLAUDE_BIN'];

function useMockAgent(fixture = FIXTURE) {
  process.env.MAUDE_ACP_ADAPTER_ENTRY = fixture;
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

describe('AcpBridge — elicitation-form gate', () => {
  test('a request is forwarded via onElicitationRequest, stays pending, and accept-with-selection resolves it', async () => {
    useMockAgent();
    const requests: Array<{ id: string; message?: string; mode?: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onElicitationRequest: (id, req) =>
        requests.push({ id, message: req.message, mode: req.mode }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      expect(req.message).toBe('Which color do you like?');
      expect(req.mode).toBe('form');

      bridge.resolveElicitation(req.id, { action: 'accept', content: { question_0: 'Red' } });
      await promptPromise;
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('accept with a custom free-text answer resolves with that exact content', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onElicitationRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      bridge.resolveElicitation(req.id, {
        action: 'accept',
        content: { question_0_custom: 'Something else' },
      });
      await promptPromise;
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"question_0_custom":"Something else"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('accept with missing/malformed content fails closed to decline — never fabricates content', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onElicitationRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      // @ts-expect-error — deliberately malformed (accept with no content) to prove the fail-closed path
      bridge.resolveElicitation(req.id, { action: 'accept' });
      await promptPromise;
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"action":"decline"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('an explicit decline round-trips as sent', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onElicitationRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      bridge.resolveElicitation(req.id, { action: 'decline' });
      await promptPromise;
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"action":"decline"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('an explicit cancel round-trips as sent (distinct from decline)', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onElicitationRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      bridge.resolveElicitation(req.id, { action: 'cancel' });
      await promptPromise;
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"action":"cancel"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a malformed/unrecognized action fails closed to decline', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onElicitationRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      bridge.resolveElicitation(req.id, { action: 'yolo' });
      await promptPromise;
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"action":"decline"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a stale/unknown id is a silent no-op — never throws', async () => {
    useMockAgent();
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      expect(() =>
        bridge.resolveElicitation('does-not-exist', { action: 'accept', content: {} })
      ).not.toThrow();
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('timeout defaults to decline (never cancel, never accept)', async () => {
    useMockAgent();
    const updates: unknown[] = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      permissionTimeoutMs: 150, // short override — reused for elicitation too (see AcpBridgeOptions doc)
    });
    try {
      await bridge.prompt('hi', 'c1'); // never calls resolveElicitation — must resolve itself
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"action":"decline"');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a turn-cancel declines every pending elicitation request instead of hanging it forever', async () => {
    useMockAgent();
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onElicitationRequest: (id) => requests.push({ id }),
      permissionTimeoutMs: 60000, // long — proves cancel() settles it, not the timeout racing in
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      await until(() => (requests.length ? true : undefined));
      await bridge.cancel(); // must decline the pending request, not leave it hanging
      await promptPromise; // resolves because the mock's elicitation/create call unblocked
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a mode:"url" request is rejected structurally — declined without ever reaching onElicitationRequest', async () => {
    useMockAgent(FIXTURE_URL);
    const updates: unknown[] = [];
    const requests: unknown[] = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: (u) => updates.push(u),
      onElicitationRequest: (id, req) => requests.push({ id, req }),
    });
    try {
      await bridge.prompt('hi', 'c1');
      const text = (updates as Array<{ content?: { text?: string } }>)
        .map((u) => u?.content?.text ?? '')
        .join('');
      expect(text).toContain('"action":"decline"');
      // Never even surfaced to the client — only `form` was ever declared, so
      // a non-compliant/malicious sender's url-mode request must not reach
      // the UI at all (ethical-hacker finding — capability negotiation alone
      // isn't a rejection).
      expect(requests.length).toBe(0);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('onElicitationSettled fires on a bridge-initiated timeout — the client can learn its card is dead', async () => {
    useMockAgent();
    const settled: string[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onElicitationRequest: (id) => requests.push({ id }),
      onElicitationSettled: (id) => settled.push(id),
      permissionTimeoutMs: 150,
    });
    try {
      await bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      expect(settled).toEqual([req.id]);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('onElicitationSettled also fires for a client-driven resolveElicitation call', async () => {
    useMockAgent();
    const settled: string[] = [];
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onElicitationRequest: (id) => requests.push({ id }),
      onElicitationSettled: (id) => settled.push(id),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      const req = await until(() => (requests.length ? requests[0] : undefined));
      bridge.resolveElicitation(req.id, { action: 'decline' });
      await promptPromise;
      expect(settled).toEqual([req.id]);
    } finally {
      await bridge.stop();
    }
  }, 15000);
});

describe('Acp manager — elicitation-request/-response frames', () => {
  test('an elicitation-request frame is relayed to the client and a valid elicitation-response resolves it', async () => {
    useMockAgent();
    const ctx = {
      paths: { repoRoot: process.cwd(), designRoot: '/tmp/does-not-matter-elicit' },
    } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('elicit-ws-a');
    try {
      acp.onOpen(a.ws);
      acp.onMessage(a.ws, JSON.stringify({ t: 'prompt', text: 'hi', chat: 'c1' }));
      const reqFrame = await until(() => a.frames.find((f) => f.t === 'elicitation-request'));
      expect(reqFrame.message).toBe('Which color do you like?');
      expect(reqFrame.requestedSchema).toBeTruthy();
      // Forwarded so the client can attribute the request to a specific tool
      // call instead of a blanket "from Claude" label (ethical-hacker finding).
      expect(reqFrame.toolCallId).toBe('tc-elicit-1');

      acp.onMessage(
        a.ws,
        JSON.stringify({
          t: 'elicitation-response',
          id: reqFrame.id,
          action: 'accept',
          content: { question_0: 'Blue' },
        })
      );
      await until(() => a.frames.find((f) => f.t === 'turn-end'));
      // A client-driven response also gets the settled-notice frame (harmless
      // for this path — acp-runtime.js's client-side removal is optimistic —
      // but proves the manager relays onElicitationSettled unconditionally).
      const settledFrame = await until(() => a.frames.find((f) => f.t === 'elicitation-resolved'));
      expect(settledFrame.id).toBe(reqFrame.id);
    } finally {
      acp.onClose(a.ws);
      // Task 8 — `onClose` DETACHES now; it no longer stops the bridge (that is
      // the point: a page reload must not kill a running turn). So a test that
      // relied on socket-close for teardown leaks the adapter subprocess for the
      // whole DETACHED_TTL_MS. Tear down explicitly.
      acp.stopAll();
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 20000);

  test('an elicitation-response with an unknown id is a harmless no-op — the turn still settles via timeout', async () => {
    useMockAgent();
    const ctx = {
      paths: { repoRoot: process.cwd(), designRoot: '/tmp/does-not-matter-elicit-2' },
    } as unknown as Context;
    const acp = createAcp(ctx);

    const a = fakeWs('elicit-ws-b');
    try {
      acp.onOpen(a.ws);
      acp.onMessage(a.ws, JSON.stringify({ t: 'prompt', text: 'hi', chat: 'c1' }));
      await until(() => a.frames.find((f) => f.t === 'elicitation-request'));

      // Bogus id — must not throw / crash the manager.
      expect(() =>
        acp.onMessage(
          a.ws,
          JSON.stringify({
            t: 'elicitation-response',
            id: 'not-a-real-id',
            action: 'accept',
            content: {},
          })
        )
      ).not.toThrow();
    } finally {
      acp.onClose(a.ws);
      await new Promise((r) => setTimeout(r, 50));
    }
  }, 20000);
});

// SECURITY (ethical-hacker finding) — a compromised/hostile MCP server can
// issue elicitation requests directly, with no natural rate limit the way a
// permission request has (one per tool call). Prove both caps that guard
// against that: an oversized/too-many-properties schema is rejected before
// ever reaching the client, and a flood of concurrent requests only ever
// keeps MAX_PENDING_ELICITATIONS of them live at once — the rest are declined
// immediately rather than queued.
describe('elicitationSchemaWithinBounds — pure bound check', () => {
  test('a normal, small schema is within bounds', () => {
    expect(
      elicitationSchemaWithinBounds({
        type: 'object',
        properties: { question_0: { type: 'string', oneOf: [{ const: 'a', title: 'A' }] } },
      })
    ).toBe(true);
  });

  test('a missing/malformed schema is treated as within bounds — nothing to bound', () => {
    expect(elicitationSchemaWithinBounds(undefined)).toBe(true);
    expect(elicitationSchemaWithinBounds(null)).toBe(true);
    expect(elicitationSchemaWithinBounds('not-an-object')).toBe(true);
  });

  test('too many top-level properties fails the bound', () => {
    const properties: Record<string, unknown> = {};
    for (let i = 0; i < MAX_ELICITATION_SCHEMA_PROPERTIES + 1; i++) {
      properties[`q${i}`] = { type: 'string' };
    }
    expect(elicitationSchemaWithinBounds({ type: 'object', properties })).toBe(false);
  });

  test('a schema within the property-count limit but exceeding the byte cap still fails', () => {
    const bigDescription = 'x'.repeat(MAX_ELICITATION_SCHEMA_BYTES + 1);
    expect(
      elicitationSchemaWithinBounds({
        type: 'object',
        properties: { question_0: { type: 'string', description: bigDescription } },
      })
    ).toBe(false);
  });
});

describe('AcpBridge — elicitation flood cap', () => {
  test(`a burst of concurrent elicitation requests only forwards ${MAX_PENDING_ELICITATIONS} to the client — the rest decline immediately`, async () => {
    useMockAgent(FIXTURE_FLOOD);
    const requests: Array<{ id: string }> = [];
    const bridge = new AcpBridge({
      repoRoot: process.cwd(),
      onUpdate: () => {},
      onElicitationRequest: (id) => requests.push({ id }),
    });
    try {
      const promptPromise = bridge.prompt('hi', 'c1');
      // Poll instead of a fixed sleep — a fixed 300ms window flaked under
      // concurrent machine load (subprocess spawn + ACP handshake alone can
      // exceed it well before the flood itself even starts; confirmed via a
      // throwaway diagnostic run: 0 requests at 300ms, exactly
      // MAX_PENDING_ELICITATIONS at 3s). The 8 flood requests fire
      // essentially synchronously from the fixture's own `Promise.all`, and
      // declining an overflow request is synchronous inside
      // `unstable_createElicitation`, so once the FIRST request arrives the
      // rest of the accepted batch is already settled — polling for the cap
      // to be reached is both faster on a fast machine and correct on a slow one.
      await until(() => (requests.length >= MAX_PENDING_ELICITATIONS ? true : undefined));
      expect(requests.length).toBe(MAX_PENDING_ELICITATIONS);
      for (const req of requests) bridge.resolveElicitation(req.id, { action: 'decline' });
      await promptPromise;
    } finally {
      await bridge.stop();
    }
  }, 15000);
});
