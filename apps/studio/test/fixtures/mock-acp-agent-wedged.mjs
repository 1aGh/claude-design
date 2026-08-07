#!/usr/bin/env bun
// A mock ACP agent that WEDGES on the FIRST turn only (issue-82): its
// `session/prompt` handler never resolves for call #1 — simulating a
// `claude` subprocess that has hung — and it never implements
// `session/cancel` at all, so a bridge that only sends the cooperative ACP
// `session/cancel` request and trusts it will hang forever, exactly like the
// reported "I clicked STOP and nothing happened" bug.
//
// Every call AFTER the first resolves normally and quickly — this lets a
// test start a second, overlapping `prompt()` on the same bridge/chat (the
// ethical-hacker's "no reentrancy guard" finding) and confirm that turn's
// ordinary completion doesn't blind `cancel()` to the still-wedged first one.

import { Readable, Writable } from 'node:stream';

import * as acp from '@agentclientprotocol/sdk';

const stream = acp.ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));

let promptCalls = 0;

acp
  .agent({ name: 'mock-acp-agent-wedged' })
  .onRequest('initialize', () => ({
    protocolVersion: acp.PROTOCOL_VERSION,
    agentCapabilities: { loadSession: false },
  }))
  .onRequest('session/new', () => ({ sessionId: 'mock-wedged-session' }))
  .onRequest('session/prompt', () => {
    promptCalls += 1;
    if (promptCalls === 1) return new Promise(() => {}); // never resolves, never rejects
    return Promise.resolve({ stopReason: 'end_turn' });
  })
  // Deliberately NO `session/cancel` handler — an agent that never
  // implemented turn-cancellation at all, the other real-world shape of
  // "Stop does nothing".
  .connect(stream);
