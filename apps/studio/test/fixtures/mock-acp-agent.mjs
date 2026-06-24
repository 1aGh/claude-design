#!/usr/bin/env bun
// Mock ACP agent for acp/bridge.test.ts. Stands in for `claude-agent-acp` so the
// bridge can be exercised without a real `claude` install. Implements the
// minimal handshake (initialize + session/new + session/prompt) and streams one
// `agent_message_chunk` whose text echoes whether ANTHROPIC_API_KEY survived
// into the child env — it MUST read `<unset>`, proving scrubAgentEnv (DDR-123
// guardrail #1) stripped it before spawn.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

acp
  .agent({ name: 'mock-acp-agent' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest(
    'session/new',
    (() => {
      let n = 0;
      return () => ({ sessionId: `mock-session-${++n}` });
    })()
  )
  .onRequest('session/prompt', async (ctx) => {
    // The per-request handler context exposes the client connection at `.client`.
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text:
            `apiKey=${process.env.ANTHROPIC_API_KEY ?? '<unset>'} ` +
            `model=${process.env.ANTHROPIC_MODEL ?? '<unset>'} ` +
            `thinking=${process.env.MAX_THINKING_TOKENS ?? '<unset>'} ` +
            `claudeExe=${process.env.CLAUDE_CODE_EXECUTABLE ?? '<unset>'}`,
        },
      },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
