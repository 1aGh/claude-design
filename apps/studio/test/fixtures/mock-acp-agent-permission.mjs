#!/usr/bin/env bun
// Mock ACP agent exercising the permission approve/deny gate (Milestone B,
// retires DDR-125 F2) — session/prompt calls back INTO the client via
// `ctx.client.requestPermission(...)` (a real request, not a notification)
// before streaming its final reply, mirroring how claude-agent-acp asks for
// tool authorization mid-turn. No real `claude` needed.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-permission' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-perm-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    // `ctx.client` (AgentContext) only exposes the generic request()/notify() —
    // no typed `.requestPermission()` convenience method — so call the raw ACP
    // method via `acp.methods.client.session.requestPermission`.
    const outcome = await ctx.client.request(acp.methods.client.session.requestPermission, {
      sessionId: ctx.params.sessionId,
      toolCall: {
        toolCallId: 'tc1',
        title: 'Write file',
        kind: 'edit',
        rawInput: { path: '/tmp/x' },
      },
      options: [
        { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
        { optionId: 'allow-always', name: 'Allow always', kind: 'allow_always' },
        { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
      ],
    });
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `outcome=${JSON.stringify(outcome.outcome)}` },
      },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
