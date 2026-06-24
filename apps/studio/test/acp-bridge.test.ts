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
      const result = await bridge.prompt('hello', 'c1');
      expect(bridge.connected).toBe(true);
      expect(bridge.sessionId).toBe('mock-session-1');
      expect(result.stopReason).toBe('end_turn');

      // The mock streamed its own ANTHROPIC_API_KEY — it must read `<unset>`,
      // proving scrubAgentEnv stripped it from the child env before spawn.
      const streamed = JSON.stringify(updates);
      expect(streamed).toContain('apiKey=<unset>');
      expect(streamed).not.toContain('sk-must-be-scrubbed');
      // DDR-123 guardrail #2 — the bridge pins the adapter to the user's own
      // `claude` (here MAUDE_CLAUDE_BIN = this bun) via CLAUDE_CODE_EXECUTABLE, so
      // it never falls back to the unshipped ~210 MB native binary.
      expect(streamed).toContain(`claudeExe=${process.execPath}`);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('setConfig passes model + effort to the child env (ANTHROPIC_MODEL / MAX_THINKING_TOKENS)', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;

    const updates: unknown[] = [];
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: (u) => updates.push(u) });
    try {
      bridge.setConfig('opus', 'thorough');
      await bridge.prompt('hi', 'c1');
      const first = JSON.stringify(updates);
      expect(first).toContain('model=opus');
      expect(first).toContain('thinking=31999');

      // Changing the config re-spawns with the new env on the next prompt.
      updates.length = 0;
      bridge.setConfig(null, 'fast');
      await bridge.prompt('again', 'c1');
      const second = JSON.stringify(updates);
      expect(second).toContain('model=<unset>'); // null model → ANTHROPIC_MODEL not set
      expect(second).toContain('thinking=0'); // fast → thinking disabled
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
      await bridge.prompt('first', 'c1');
      const sid = bridge.sessionId;
      await bridge.prompt('second', 'c1');
      expect(bridge.sessionId).toBe(sid);
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('different chat ids get separate claude sessions; same id reuses its own', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;

    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      await bridge.prompt('a', 'chatA');
      const sa = bridge.sessionId;
      await bridge.prompt('b', 'chatB');
      const sb = bridge.sessionId;
      expect(sa).not.toBe(sb); // separate per-chat contexts
      await bridge.prompt('a again', 'chatA');
      expect(bridge.sessionId).toBe(sa); // chatA reuses its own session
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
