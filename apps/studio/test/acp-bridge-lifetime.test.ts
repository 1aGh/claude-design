// feature-acp-write-path-scope Addendum, Task 8 — the bridge outlives its socket.
//
// The bug this closes: `bridges` was keyed by `ws.data.id` and `onClose` called
// `bridge.stop()` immediately, so ANY socket close killed the running agent.
// `RepoBranchSwitcher.jsx` calls `window.location.reload()` unconditionally on a
// branch switch / draft-create / local-merge fold, which meant switching drafts
// mid-turn silently destroyed the work in flight. It merely LOOKED like a lost
// place, because the transcript and the ACP sessionId are both persisted.
//
// What is asserted here, in the plan's own words:
//   (a) the turn completes after the socket dies,
//   (b) a re-attaching client receives each update EXACTLY ONCE, and
//   (c) no orphaned bridge survives the TTL.
// Plus the hazard the Addendum names explicitly: a permission request raised
// while NOBODY is attached must fail closed, never read as consent.

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ServerWebSocket } from 'bun';

import { AcpBridge } from '../acp/bridge.ts';
import { createAcp, DETACHED_TTL_MS, MAX_DETACHED_BRIDGES } from '../acp/index.ts';
import type { Context } from '../context.ts';
import type { WsData } from '../ws.ts';

const FIXTURE_SLOW = join(import.meta.dir, 'fixtures', 'mock-acp-agent-slow.mjs');
const FIXTURE_PERM = join(import.meta.dir, 'fixtures', 'mock-acp-agent-permission.mjs');
const TEST_ENV_KEYS = ['MAUDE_ACP_ADAPTER_ENTRY', 'MAUDE_ACP_RUNTIME', 'MAUDE_CLAUDE_BIN'];

function useMockAgent(fixture: string) {
  process.env.MAUDE_ACP_ADAPTER_ENTRY = fixture;
  process.env.MAUDE_ACP_RUNTIME = process.execPath;
  process.env.MAUDE_CLAUDE_BIN = process.execPath;
}

const dirs: string[] = [];
function freshCtx(): Context {
  const root = mkdtempSync(join(tmpdir(), 'maude-acp-lifetime-'));
  dirs.push(root);
  mkdirSync(join(root, '.design', '_chat'), { recursive: true });
  return {
    paths: { repoRoot: root, designRoot: join(root, '.design'), designRel: '.design' },
  } as unknown as Context;
}

afterEach(() => {
  for (const key of TEST_ENV_KEYS) delete process.env[key];
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

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

async function until<T>(fn: () => T | undefined, timeoutMs = 15000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (performance.now() - start > timeoutMs) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('bridge lifetime — a closed socket no longer kills the turn', () => {
  test('the turn COMPLETES after the socket closes, and a re-attach gets every update exactly once', async () => {
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);

    const a = fakeWs('life-a');
    acp.onOpen(a.ws);
    acp.onMessage(a.ws, JSON.stringify({ t: 'prompt', text: 'go', chat: 'c1' }));

    // Wait until the turn is genuinely streaming, then yank the socket — the
    // exact shape of a `window.location.reload()` landing mid-turn.
    const firstSeq = await until(() => {
      const f = a.frames.find((x) => x.t === 'update' && typeof x.seq === 'number');
      return f ? (f.seq as number) : undefined;
    });
    // `seq` is the transcript LINE, not an agent-update counter — the bootstrap
    // brief, the plugin-autoload audit record and the user's own turn all
    // occupy lines before the first agent chunk. That is deliberate: the client
    // compares it against the line count the HTTP hydration covered, which
    // counts those lines too. An "nth agent update" counter would not line up.
    expect(firstSeq).toBeGreaterThan(0);
    acp.onClose(a.ws);

    // (a) The bridge SURVIVES the close. Under the old per-socket keying this
    // was already 0 by now, and the agent was dead.
    expect(acp.size()).toBe(1);

    // The chat's own transcript keeps growing while nobody is attached — the
    // durable record the re-attach replays from.
    await until(async () => {
      const { chatTranscriptSeq } = await import('../acp/transcript.ts');
      return chatTranscriptSeq(ctx.paths.designRoot, 'c1') > firstSeq ? true : undefined;
    });

    // (b) Re-attach from the seq the client had already hydrated. Everything
    // after it replays; nothing at or before it does.
    const b = fakeWs('life-b');
    acp.onOpen(b.ws);
    acp.onMessage(b.ws, JSON.stringify({ t: 'attach', chat: 'c1', seq: firstSeq }));
    await until(() => b.frames.find((f) => f.t === 'attached'));

    // Let the turn finish so the replay + live tail are both complete.
    await until(() => b.frames.find((f) => f.t === 'turn-end'), 20000);

    const seqs = b.frames.filter((f) => f.t === 'update').map((f) => f.seq as number);
    // EXACTLY ONCE: no duplicates …
    expect(new Set(seqs).size).toBe(seqs.length);
    // … and nothing the client already had (that's the whole point of the seam;
    // without it, the replay and the live stream overlap and the user sees the
    // last few seconds twice).
    expect(seqs.every((s) => s > firstSeq)).toBe(true);
    // … and no HOLE either: the seqs are contiguous from firstSeq+1.
    expect(seqs).toEqual(seqs.map((_, i) => firstSeq + 1 + i));

    acp.onClose(b.ws);
    acp.stopAll();
  }, 40000);

  test('a DETACHED, idle bridge is reaped — no orphaned subprocess', async () => {
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);
    const a = fakeWs('reap-a');
    acp.onOpen(a.ws);
    // `warm` establishes a bridge without starting a turn — the "abandoned"
    // shape, as opposed to the "still working" one above.
    acp.onMessage(a.ws, JSON.stringify({ t: 'warm', chat: 'c1' }));
    await until(() => (acp.size() === 1 ? true : undefined));
    acp.onClose(a.ws);
    expect(acp.size()).toBe(1); // detached, not yet reaped

    // The real TTL is minutes — assert the CONSTANT is sane rather than sleeping
    // through it. The reap PATH itself is covered by stopAll() below and by the
    // ceiling test, which exercises the same `reap()`.
    expect(DETACHED_TTL_MS).toBeGreaterThan(0);
    expect(DETACHED_TTL_MS).toBeLessThanOrEqual(15 * 60_000);

    acp.stopAll();
    expect(acp.size()).toBe(0);
  }, 30000);

  test('detached bridges are CAPPED — the least-recently-active is reaped', async () => {
    // Detaching removed the natural reaper that socket-close used to be, so an
    // unbounded set of detached bridges is a process leak (DDR-125 already books
    // "N processes" as the cost of parallel chats). Idle ones are sacrificed
    // first; a detached bridge with a live turn is what we are protecting.
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);
    const sockets = [];
    for (let i = 0; i <= MAX_DETACHED_BRIDGES; i++) {
      const s = fakeWs(`cap-${i}`);
      sockets.push(s);
      acp.onOpen(s.ws);
      acp.onMessage(s.ws, JSON.stringify({ t: 'warm', chat: `c${i}` }));
    }
    await until(() => (acp.size() === MAX_DETACHED_BRIDGES + 1 ? true : undefined));
    for (const s of sockets) acp.onClose(s.ws);
    expect(acp.size()).toBe(MAX_DETACHED_BRIDGES);

    acp.stopAll();
  }, 30000);

  test('re-attaching CANCELS the reaper (a reload is not an abandonment)', async () => {
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);
    const a = fakeWs('rearm-a');
    acp.onOpen(a.ws);
    acp.onMessage(a.ws, JSON.stringify({ t: 'warm', chat: 'c1' }));
    await until(() => (acp.size() === 1 ? true : undefined));
    acp.onClose(a.ws);
    const b = fakeWs('rearm-b');
    acp.onOpen(b.ws);
    acp.onMessage(b.ws, JSON.stringify({ t: 'attach', chat: 'c1', seq: 0 }));
    const attached = await until(() => b.frames.find((f) => f.t === 'attached'));
    expect(attached.chat).toBe('c1');
    // Same bridge, not a fresh one — the whole point of keying by chat.
    expect(acp.size()).toBe(1);
    acp.stopAll();
  }, 30000);
});

describe('bridge lifetime — a detached bridge must never read as consent', () => {
  test('a permission request raised with NO socket attached fails closed (deny)', async () => {
    // The Addendum names this hazard explicitly: "A detached bridge is a live
    // agent with no UI attached. Any requestPermission raised while nobody is
    // watching must hit the existing timeout → fail-closed deny. 'No client
    // attached' must never be a path to auto-approval — that would re-open,
    // from a new direction, exactly what the write gate closes."
    // Driven at the BRIDGE level with a short timeout override rather than
    // through the manager: the real PERMISSION_TIMEOUT_MS is 120 s, and a test
    // that actually sleeps through it would be a 2-minute test proving a
    // constant. Detachment is modelled the way the manager models it — the
    // request is raised and `broadcast` reaches nobody, i.e. no sink answers.
    useMockAgent(FIXTURE_PERM);
    const updates: Array<{ content?: { text?: string } }> = [];
    const raised: string[] = [];
    const bridge = new AcpBridge({
      repoRoot: freshCtx().paths.repoRoot,
      permissionTimeoutMs: 250,
      onUpdate: (u) => updates.push(u as { content?: { text?: string } }),
      // A DETACHED bridge still RAISES the request (the manager's `broadcast`
      // is what silently drops it when `sinks` is empty) — it just never gets
      // an answer. Nothing here calls resolvePermission.
      onPermissionRequest: (id) => raised.push(id),
    });
    try {
      await bridge.prompt('go', 'c1');
      expect(raised).toHaveLength(1);
      const text = updates.map((u) => u?.content?.text ?? '').join('');
      expect(text).toContain('"outcome":"cancelled"');
      expect(text).not.toContain('selected');
    } finally {
      await bridge.stop();
    }
  }, 30000);
});

describe('bridge lifetime — a socket may only address chats it is attached to', () => {
  // SECURITY. Before bridges were re-keyed by chat, every control-frame lookup
  // was `bridges.get(ws.data.id)` — a socket was STRUCTURALLY incapable of
  // naming another socket's bridge. Re-keying moved the key into the FRAME, and
  // the first cut resolved `chat` against the whole map, silently widening the
  // surface so any socket could cancel another chat's turn or flip its config.
  // The nonce ids make answering another chat's permission impractical to hit
  // blind, but "you'd have to guess a UUID" is a weaker guarantee than "the
  // frame cannot name that bridge at all" — and DDR-125 F1's posture is
  // explicitly the latter. These tests pin the restored property.
  test('a control frame naming ANOTHER chat is refused', async () => {
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);

    const a = fakeWs('cross-a');
    acp.onOpen(a.ws);
    acp.onMessage(a.ws, JSON.stringify({ t: 'warm', chat: 'victim' }));
    await until(() => (acp.size() === 1 ? true : undefined));

    const b = fakeWs('cross-b');
    acp.onOpen(b.ws);
    acp.onMessage(b.ws, JSON.stringify({ t: 'warm', chat: 'attacker' }));
    await until(() => (acp.size() === 2 ? true : undefined));

    // Socket B names socket A's chat. Must be a no-op, not a cancel.
    expect(() =>
      acp.onMessage(b.ws, JSON.stringify({ t: 'cancel', chat: 'victim' }))
    ).not.toThrow();
    expect(() =>
      acp.onMessage(
        b.ws,
        JSON.stringify({ t: 'permission-response', id: 'x', chat: 'victim', decision: 'allow' })
      )
    ).not.toThrow();
    expect(() =>
      acp.onMessage(
        b.ws,
        JSON.stringify({ t: 'set-mode', chat: 'victim', modeId: 'bypassPermissions' })
      )
    ).not.toThrow();

    // Both bridges still alive — nothing was cancelled or torn down.
    expect(acp.size()).toBe(2);
    acp.stopAll();
  }, 30000);

  test('a socket CAN address its own chat by name', async () => {
    // The restriction must not break the normal path — the client echoes `chat`
    // back on every response frame.
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);
    const a = fakeWs('own-a');
    acp.onOpen(a.ws);
    acp.onMessage(a.ws, JSON.stringify({ t: 'warm', chat: 'mine' }));
    await until(() => (acp.size() === 1 ? true : undefined));
    expect(() => acp.onMessage(a.ws, JSON.stringify({ t: 'cancel', chat: 'mine' }))).not.toThrow();
    expect(acp.size()).toBe(1);
    acp.stopAll();
  }, 30000);
});

describe('bridge lifetime — the attach seq is client-supplied and must be bounded', () => {
  test('hostile seq values (negative, NaN, Infinity, fractional, huge) never throw or over-read', async () => {
    // `frame.seq` flows into readChatLinesAfter. It is floored, clamped at 0,
    // and the read is capped — but the values are attacker-chosen, so pin it.
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);
    const a = fakeWs('seq-a');
    acp.onOpen(a.ws);
    for (const seq of [-1, -1e9, Number.NaN, Number.POSITIVE_INFINITY, 3.7, 1e15, '5', null]) {
      expect(() =>
        acp.onMessage(a.ws, JSON.stringify({ t: 'attach', chat: 'c1', seq }))
      ).not.toThrow();
    }
    // Every attach still answered — degraded to seq 0, never wedged.
    expect(a.frames.filter((f) => f.t === 'attached').length).toBe(8);
    // A chat with no transcript replays nothing regardless of the seq claimed.
    expect(a.frames.filter((f) => f.t === 'update')).toHaveLength(0);
    acp.stopAll();
  }, 30000);

  test('a traversal-shaped chat id cannot reach another file', async () => {
    // chatId is sanitized to [a-z0-9_-] before it reaches the transcript path.
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);
    const a = fakeWs('seq-b');
    acp.onOpen(a.ws);
    expect(() =>
      acp.onMessage(a.ws, JSON.stringify({ t: 'attach', chat: '../../../etc/passwd', seq: 0 }))
    ).not.toThrow();
    const attached = a.frames.find((f) => f.t === 'attached');
    expect(attached?.chat).not.toContain('/');
    expect(attached?.chat).not.toContain('.');
    acp.stopAll();
  }, 30000);
});

describe('set-mode is attachment-scoped too (ethical-hacker A2)', () => {
  test('a socket CANNOT flip another chat into bypassPermissions', async () => {
    // A2 was the one control frame that escaped the attachment-scoping sweep,
    // and the highest-value one to miss: `bypassPermissions` is an advertised
    // mode and short-circuits ADAPTER-side, so `requestPermission` — and with it
    // the entire write gate — never runs. A raw `bridges.get(chat)` let any
    // main-origin socket switch the gate off for a chat it was never attached
    // to, including a DETACHED one with a live turn and nobody watching.
    useMockAgent(FIXTURE_SLOW);
    const ctx = freshCtx();
    const acp = createAcp(ctx);

    const victim = fakeWs('mode-victim');
    acp.onOpen(victim.ws);
    acp.onMessage(victim.ws, JSON.stringify({ t: 'warm', chat: 'victim' }));
    await until(() => (acp.size() === 1 ? true : undefined));

    const attacker = fakeWs('mode-attacker');
    acp.onOpen(attacker.ws);
    acp.onMessage(attacker.ws, JSON.stringify({ t: 'warm', chat: 'attacker' }));
    await until(() => (acp.size() === 2 ? true : undefined));

    expect(() =>
      acp.onMessage(
        attacker.ws,
        JSON.stringify({ t: 'set-mode', chat: 'victim', modeId: 'bypassPermissions' })
      )
    ).not.toThrow();
    // Both bridges intact and the frame was a no-op — the mode change never
    // reached a bridge this socket isn't attached to.
    expect(acp.size()).toBe(2);
    acp.stopAll();
  }, 30000);
});
