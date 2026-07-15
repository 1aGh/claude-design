#!/usr/bin/env bun
// Mock ACP agent emitting `usage_update` notifications (Milestone D) — one
// after the prompt result (context/cost), and one carrying the thin
// `_meta["_claude/rateLimit"]` rate-limit signal (mirrors the real adapter's
// `rate_limit_event` forwarding, acp-agent.js:1768-1776). No real `claude` needed.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

let n = 0;

acp
  .agent({ name: 'mock-acp-agent-usage' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: `mock-usage-session-${++n}` }))
  .onRequest('session/prompt', async (ctx) => {
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'ok' } },
    });
    await ctx.client.notify('session/update', {
      sessionId: ctx.params.sessionId,
      update: {
        sessionUpdate: 'usage_update',
        used: 4200,
        size: 200000,
        cost: { amount: 0.0123, currency: 'USD' },
      },
    });
    if (ctx.params.prompt?.[0]?.text === 'trigger-rate-limit') {
      await ctx.client.notify('session/update', {
        sessionId: ctx.params.sessionId,
        update: {
          sessionUpdate: 'usage_update',
          used: 4200,
          size: 200000,
          _meta: {
            '_claude/rateLimit': {
              status: 'allowed_warning',
              rateLimitType: 'five_hour',
              utilization: 82,
              resetsAt: 1234567890,
            },
          },
        },
      });
    }
    return { stopReason: 'end_turn' };
  })
  .connect(stream);
