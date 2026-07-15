#!/usr/bin/env bun
// Mock ACP agent proving the MAX_PENDING_ELICITATIONS cap (feature-acp-ask-
// user-question, SECURITY / ethical-hacker finding — an unbounded queue lets
// any connected MCP server flood the client with elicitation requests). Fires
// MORE than the cap concurrently, without waiting for each one — mirroring a
// hostile/compromised MCP server that never waits for an answer before
// issuing the next request — and reports which ones actually round-tripped to
// the client vs. were declined immediately by the bridge's own cap.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

const FLOOD_COUNT = 8; // > MAX_PENDING_ELICITATIONS (5) in acp/bridge.ts

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-elicit-flood' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-elicit-flood-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    const requests = Array.from({ length: FLOOD_COUNT }, (_, i) =>
      ctx.client.request(acp.methods.client.elicitation.create, {
        mode: 'form',
        sessionId: ctx.params.sessionId,
        message: `Flood question ${i}`,
        requestedSchema: { type: 'object', properties: { [`q${i}`]: { type: 'string' } } },
      })
    );
    const responses = await Promise.all(requests);
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `responses=${JSON.stringify(responses)}` },
      },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
