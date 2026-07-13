// End-to-end bridge test against a mock ACP agent (test/fixtures/mock-acp-agent.mjs)
// so no real `claude` install is needed. Proves: spawn + handshake + streamed
// update + turn completion, AND that ANTHROPIC_API_KEY never reaches the child
// (DDR-123 guardrail #1, verified end-to-end — the mock echoes its own env).

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AcpBridge } from '../acp/bridge.ts';
import { probeAcpAvailability, probeAcpAvailabilityAuthed } from '../acp/probe.ts';

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

describe('AcpBridge — cross-restart session resume (DDR-125 gap)', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  test('a persisted sessionId resumes via loadSession instead of spawning a new session', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;
    dir = await mkdtemp(join(tmpdir(), 'acp-bridge-test-'));
    const storePath = join(dir, 'c1.session.json');
    await Bun.write(storePath, JSON.stringify({ sessionId: 'persisted-session-abc' }));

    const updates: unknown[] = [];
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: (u) => updates.push(u) });
    try {
      bridge.setSessionStorePath(storePath);
      await bridge.prompt('pokracuj', 'c1');
      // Resumed the persisted id verbatim — never fell through to session/new
      // (which would have minted a fresh `mock-session-N`).
      expect(bridge.sessionId).toBe('persisted-session-abc');
      // The mock's replay notification must NOT reach the UI sink.
      expect(JSON.stringify(updates)).not.toContain('REPLAYED-HISTORY-SHOULD-NOT-SURFACE');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a resume that fails (pruned session) falls back to newSession and re-persists the new id', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;
    dir = await mkdtemp(join(tmpdir(), 'acp-bridge-test-'));
    const storePath = join(dir, 'c1.session.json');
    await Bun.write(storePath, JSON.stringify({ sessionId: 'not-found' }));

    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      bridge.setSessionStorePath(storePath);
      await bridge.prompt('pokracuj', 'c1');
      expect(bridge.sessionId).toBe('mock-session-1'); // fresh session, not the stale id
      const stored = JSON.parse(await readFile(storePath, 'utf8'));
      expect(stored.sessionId).toBe('mock-session-1'); // re-persisted so the NEXT restart resumes it
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('no prior chat for this sidecar behaves exactly as before — a brand new session is created and persisted', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;
    dir = await mkdtemp(join(tmpdir(), 'acp-bridge-test-'));
    const storePath = join(dir, 'brand-new.session.json');

    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      bridge.setSessionStorePath(storePath);
      await bridge.prompt('hi', 'c1');
      expect(bridge.sessionId).toBe('mock-session-1');
      const stored = JSON.parse(await readFile(storePath, 'utf8'));
      expect(stored.sessionId).toBe('mock-session-1');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('no sidecar wired at all (e.g. a warm-up before any prompt) never touches disk and behaves exactly as before', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;

    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      // setSessionStorePath is never called — sessionStorePath stays null.
      await bridge.prompt('hi', 'c1');
      expect(bridge.sessionId).toBe('mock-session-1');
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('a malformed persisted sessionId (not a plausible shape) is rejected — falls back to newSession', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;
    dir = await mkdtemp(join(tmpdir(), 'acp-bridge-test-'));
    const storePath = join(dir, 'c1.session.json');
    // Not a plausible sessionId shape (embedded newline + non-UUID charset) —
    // must never reach the wire as a `loadSession` sessionId.
    await Bun.write(storePath, JSON.stringify({ sessionId: 'evil\nsessionId; rm -rf /' }));

    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: () => {} });
    try {
      bridge.setSessionStorePath(storePath);
      await bridge.prompt('hi', 'c1');
      expect(bridge.sessionId).toBe('mock-session-1'); // rejected — fresh session instead
    } finally {
      await bridge.stop();
    }
  }, 15000);

  test('warm and prompt racing for the same chat share one resume attempt (no replaying race)', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_ACP_RUNTIME = process.execPath;
    process.env.MAUDE_CLAUDE_BIN = process.execPath;
    dir = await mkdtemp(join(tmpdir(), 'acp-bridge-test-'));
    const storePath = join(dir, 'c1.session.json');
    await Bun.write(storePath, JSON.stringify({ sessionId: 'persisted-race-session' }));

    const updates: unknown[] = [];
    const bridge = new AcpBridge({ repoRoot: process.cwd(), onUpdate: (u) => updates.push(u) });
    try {
      bridge.setSessionStorePath(storePath);
      // Fire warmUp and prompt concurrently for the same chatId — both call
      // sessionFor('c1') before either has resolved.
      const [, result] = await Promise.all([bridge.warmUp('c1'), bridge.prompt('pokracuj', 'c1')]);
      expect(bridge.sessionId).toBe('persisted-race-session');
      expect(result.stopReason).toBe('end_turn');
      // Only ONE resume attempt happened — the mock's replay text never leaked,
      // and the prompt's own turn still streamed normally.
      expect(JSON.stringify(updates)).not.toContain('REPLAYED-HISTORY-SHOULD-NOT-SURFACE');
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

describe('probeAcpAvailabilityAuthed — DDR-166 T0d, logged-out must not read as available', () => {
  const AUTH_FIXTURE = join(import.meta.dir, 'fixtures', 'fake-claude-auth.mjs');

  afterEach(() => {
    delete process.env.FAKE_CLAUDE_LOGGED_IN;
  });

  test('installed but NOT signed in reports available:false (the bug this closes)', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_CLAUDE_BIN = AUTH_FIXTURE;
    process.env.FAKE_CLAUDE_LOGGED_IN = '0';
    const probe = await probeAcpAvailabilityAuthed();
    expect(probe.available).toBe(false);
    expect(probe.reason ?? '').toMatch(/signed in/i);
  });

  test('installed AND signed in reports available:true', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_CLAUDE_BIN = AUTH_FIXTURE;
    process.env.FAKE_CLAUDE_LOGGED_IN = '1';
    const probe = await probeAcpAvailabilityAuthed();
    expect(probe.available).toBe(true);
  });

  test('not installed still reports the plain not-installed reason (no auth spawn attempted)', async () => {
    process.env.MAUDE_ACP_ADAPTER_ENTRY = FIXTURE;
    process.env.MAUDE_CLAUDE_BIN = join(import.meta.dir, 'no-such-claude-bin');
    const probe = await probeAcpAvailabilityAuthed();
    expect(probe.available).toBe(false);
    expect(probe.reason ?? '').toMatch(/Claude Code/i);
  });
});
