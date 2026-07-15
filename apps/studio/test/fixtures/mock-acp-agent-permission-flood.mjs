#!/usr/bin/env bun
// Mock ACP agent proving the MAX_PENDING_PERMISSIONS cap (SECURITY /
// ethical-hacker finding, retroactive review of Milestone B — a single agent
// turn can legitimately issue several tool calls back to back, so "one per
// tool call" is not a natural rate limit). Fires MORE than the cap
// concurrently, without waiting for each one, and reports which ones actually
// round-tripped to the client vs. were denied immediately by the bridge's
// own cap.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

const FLOOD_COUNT = 13; // > MAX_PENDING_PERMISSIONS (10) in acp/bridge.ts

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-permission-flood' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-perm-flood-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    const requests = Array.from({ length: FLOOD_COUNT }, (_, i) =>
      ctx.client.request(acp.methods.client.session.requestPermission, {
        sessionId: ctx.params.sessionId,
        toolCall: { toolCallId: `tc${i}`, title: `Flood tool call ${i}`, kind: 'edit' },
        options: [
          { optionId: 'allow-once', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject-once', name: 'Reject', kind: 'reject_once' },
        ],
      })
    );
    const outcomes = await Promise.all(requests);
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `outcomes=${JSON.stringify(outcomes.map((o) => o.outcome))}`,
        },
      },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
