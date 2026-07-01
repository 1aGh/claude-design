#!/usr/bin/env bun
// Mock ACP agent variant that publishes an `available_commands_update` the moment
// a session is created (before the prompt) — stands in for Claude Code's command
// catalogue so acp-commands.test.ts can exercise the warm-up + broadcast path
// WITHOUT a real `claude`. Also answers a prompt so prompt-based paths still work.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-commands' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', async (ctx) => {
    const sessionId = `mock-session-${++n}`;
    // Publish the command catalogue on session creation — the warm-up path relies
    // on this arriving without a prompt.
    await ctx.client.notify('session/update', {
      sessionId,
      update: {
        sessionUpdate: 'available_commands_update',
        availableCommands: [
          { name: 'design:edit', description: 'Iterate on the active canvas' },
          { name: 'flow:plan', description: 'Create a plan' },
        ],
      },
    });
    return { sessionId };
  })
  .onRequest('session/prompt', async (ctx) => {
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } },
    });
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
