#!/usr/bin/env bun
// Mock ACP agent that sends a `mode:'url'` elicitation request — proves
// AcpBridge.unstable_createElicitation rejects it structurally (declines
// without ever calling onElicitationRequest) even though the adapter/agent
// side ignored the client's declared `elicitation:{form:{}}`-only capability
// (ethical-hacker finding — capability negotiation is advisory, not
// enforced; the client must reject what it never advertised, not just hope
// the other side honors it).

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-elicit-url' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-elicit-url-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    const response = await ctx.client.request(acp.methods.client.elicitation.create, {
      mode: 'url',
      sessionId: ctx.params.sessionId,
      message: 'Confirm you have completed verification',
      url: 'https://example.com/verify',
      elicitationId: 'elicit-url-1',
    });
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `response=${JSON.stringify(response)}` },
      },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
