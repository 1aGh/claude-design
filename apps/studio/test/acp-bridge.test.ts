// End-to-end bridge test against a mock ACP agent (test/fixtures/mock-acp-agent.mjs)
// so no real `claude` install is needed. Proves: spawn + handshake + streamed
// update + turn completion, AND that ANTHROPIC_API_KEY never reaches the child
// (DDR-123 guardrail #1, verified end-to-end — the mock echoes its own env).

import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { AcpBridge } from '../acp/bridge.ts';
import { probeAcpAvailability } from '../acp/probe.ts';

const FIXTURE = join(import.meta.dir, 'fixtures', 'mock-acp-agent.mjs');
const TEST_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'MAUDE_ACP_ADAPTER_ENTRY',
  'MAUDE_ACP_RUNTIME',
  'MAUDE_CLAUDE_BIN',
];

afterEach(() => {
  for (const key of TEST_ENV_KEYS) delete process.env[key];
});

describe('AcpBridge — round-trip + subscription guardrail', () => {
  test('connects, streams an update, completes a turn, and scrubs ANTHROPIC_API_KEY', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-must-be-scrubbed';
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath; // run the mock under this bun
    process.env.MAUDE_CLAUDE_BIN = process.execPath; // satisfy the claude-present check

    const updates: unknown[] = [];
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: (u) => updates.push(u) });
    try {
      const result = await bridge.prompt('hello');
      expect(bridge.connected).toBe(true);
      expect(bridge.sessionId).toBe('mock-session-1');
      expect(result.stopReason).toBe('end_turn');

      // The mock streamed its own ANTHROPIC_API_KEY — it must read `<unset>`,
      // proving scrubAgentEnv stripped it from the child env before spawn.
      const streamed = JSON.stringify(updates);
      expect(streamed).toContain('apiKey=<unset>');
      expect(streamed).not.toContain('sk-must-be-scrubbed');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a second prompt reuses the same live session', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;

    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      await bridge.prompt('first');
      const sid = bridge.sessionId;
      await bridge.prompt('second');
      expect(bridge.sessionId).toBe(sid);
    } finally {
      await bridge.stop();
    }
  }, 15000);
});

describe('probeAcpAvailability — not-connected detection', () => {
  test('reports not-available with a Claude-Code reason when the CLI is absent', () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_CLAUDE_BIN = join(import.meta.dir, 'no-such-claude-bin');
    const probe = probeAcpAvailability();
    expect(probe.available).toBe(false);
    expect(probe.reason ?? '').toMatch(/Claude Code/i);
  });

  test('reports available when both the adapter and a claude binary resolve', () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;
    const probe = probeAcpAvailability();
    expect(probe.available).toBe(true);
    expect(probe.adapterEntry).toBe(FIXTURE);
  });
});
