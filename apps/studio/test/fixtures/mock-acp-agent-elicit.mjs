#!/usr/bin/env bun
// Mock ACP agent exercising the elicitation-form gate (feature-acp-ask-user-
// question) — session/prompt calls back INTO the client via a REAL
// `elicitation/create` request, shaped exactly like
// `askUserQuestionsToCreateRequest`'s single-question output (confirmed on
// disk against the installed `@agentclientprotocol/claude-agent-acp` — a
// titled `oneOf` enum plus its sibling `_custom` free-text field), before
// streaming its final reply. Mirrors mock-acp-agent-permission.mjs's shape.
// No real `claude` needed.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-elicit' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-elicit-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    // `ctx.client` (AgentContext) only exposes the generic request()/notify() —
    // no typed convenience method — so call the raw ACP method via
    // `acp.methods.client.elicitation.create` (confirmed on disk: acp.js's
    // `methods.client.elicitation.create === schema.CLIENT_METHODS.elicitation_create`).
    const response = await ctx.client.request(acp.methods.client.elicitation.create, {
      mode: 'form',
      sessionId: ctx.params.sessionId,
      toolCallId: 'tc-elicit-1',
      message: 'Which color do you like?',
      requestedSchema: {
        type: 'object',
        properties: {
          question_0: {
            type: 'string',
            oneOf: [
              { const: 'Red', title: 'Red' },
              { const: 'Blue', title: 'Blue' },
            ],
          },
          question_0_custom: {
            type: 'string',
            title: 'Other',
            description: 'Type your own answer instead of choosing an option above (optional).',
          },
        },
      },
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
