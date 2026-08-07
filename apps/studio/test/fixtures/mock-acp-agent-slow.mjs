#!/usr/bin/env bun
// A mock ACP agent that streams SEVERAL updates with a gap between them, so a
// test can close the socket MID-turn and assert the turn still completes
// (feature-acp-write-path-scope Addendum, Task 8 — bridges outlive their socket).
//
// The pacing is the whole point: `mock-acp-agent-permission.mjs` and friends
// settle in one tick, which leaves no window in which "mid-turn" is a real
// state. Six chunks at ~120 ms give a test room to observe the first one, yank
// the socket, and still have the rest arrive with nobody attached.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

const CHUNKS = Number(process.env.MAUDE_TEST_SLOW_CHUNKS || 6);
const GAP_MS = Number(process.env.MAUDE_TEST_SLOW_GAP_MS || 120);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-slow' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-slow-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    for (let i = 0; i < CHUNKS; i++) {
      await ctx.client.notify('session/update', {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          // Numbered so a test can tell WHICH chunks it received, not just how
          // many — the difference between "no duplicates" and "no gaps".
          content: { type: 'text', text: `chunk-${i}\n` },
        },
      });
      await sleep(GAP_MS);
    }
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
