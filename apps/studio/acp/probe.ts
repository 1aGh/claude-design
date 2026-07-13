// Detection layer for the ACP chat bridge: where is the spawnable
// `claude-agent-acp` adapter, is the user's `claude` CLI installed, and which JS
// runtime should run the adapter. All disk paths resolve through DEV_SERVER_ROOT
// (DDR-045) — never `dirname(import.meta.url)`, which is the virtual `/$bunfs`
// path inside a compiled binary. Per DDR-123 the panel is native-app only; the
// native shell ships the apps/studio source tree (with node_modules), so the
// adapter resolves on disk there.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DEV_SERVER_ROOT } from '../paths.ts';
import { scrubAgentEnv } from './env.ts';

/** Adapter npm package — the renamed continuation of `@zed-industries/claude-code-acp`. */
const ADAPTER_PKG = '@agentclientprotocol/claude-agent-acp';
const ADAPTER_BIN_NAME = 'claude-agent-acp';

export interface AcpAvailability {
  /** True when both the adapter entry and a `claude` CLI are resolvable. */
  available: boolean;
  /** Human-readable reason when `available` is false (drives the not-connected UI). */
  reason?: string;
  /** Absolute path to the adapter entry JS, or null. */
  adapterEntry: string | null;
  /** Absolute path to the `claude` CLI, or null. */
  claudePath: string | null;
}

/**
 * Resolve the adapter's spawnable entry script (its `bin`), trying:
 *   1. `MAUDE_ACP_ADAPTER_ENTRY` override (tests + escape hatch).
 *   2. The package's own `package.json` `bin` field, joined to its dir.
 *   3. The pnpm `.bin/<name>` symlink, dereferenced to the real file.
 * Returns an absolute path or null.
 */
export function resolveAdapterEntry(): string | null {
  const override = process.env.MAUDE_ACP_ADAPTER_ENTRY;
  if (override) return existsSync(override) ? override : null;

  // (2) Locate the installed package via its package.json, read the bin map.
  try {
    const pkgJsonPath = Bun.resolveSync(`${ADAPTER_PKG}/package.json`, DEV_SERVER_ROOT);
    const pkgDir = dirname(pkgJsonPath);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
      bin?: string | Record<string, string>;
    };
    const binRel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[ADAPTER_BIN_NAME];
    if (binRel) {
      const entry = join(pkgDir, binRel);
      if (existsSync(entry)) return entry;
    }
  } catch {
    /* fall through to the symlink strategy */
  }

  // (3) The pnpm-linked bin symlink in the dev-server's own node_modules.
  try {
    const sym = join(DEV_SERVER_ROOT, 'node_modules', '.bin', ADAPTER_BIN_NAME);
    if (existsSync(sym)) return realpathSync(sym);
  } catch {
    /* not present */
  }

  return null;
}

/**
 * Content pin for a Maude-auto-provisioned `MAUDE_CLAUDE_BIN` override
 * (DDR-166 T0c, `installClaudeCli()` in `login-state.ts` is the only writer).
 *
 * Second-round security-review finding against the first cut of this file:
 * checking only `existsSync(override)` on every call meant that once a
 * freshly-installed binary passed its one-time freshness check, the PATH
 * override was trusted **forever** for the rest of this long-lived process —
 * a same-UID attacker who swapped the file's *content* at any later point in
 * the session (the install-flow one-time check does not repeat) got the
 * exact "durable, silent MITM over every future chat spawn" blast radius the
 * original cached-artifact design was rejected for, just reached through a
 * different door. Path existence is not authenticity.
 *
 * The fix: pin the SHA-256 captured at verified-install time, and re-hash
 * UNCONDITIONALLY on every resolution — no mtime-based caching shortcut.
 *
 * A third-round review finding against the first cut of this fix: an
 * earlier draft cached the hash result keyed on mtime ("skip the re-hash if
 * mtime is unchanged since the last verified read") as a performance
 * optimization. That cache is trivially forgeable by the EXACT SAME attacker
 * the fix exists to stop: swapping the file's content costs them nothing
 * beyond a `touch -d <original-mtime>` immediately after, at zero additional
 * privilege — same-UID write access to the file is already required for the
 * swap itself, and mtime is neither secret nor tamper-evident (`utimensat`
 * sets it with nanosecond precision, not a race against clock granularity).
 * The cache silently reopened the exact "durable, silent MITM over every
 * future chat spawn" blast radius the whole fix exists to close.
 *
 * The "don't re-hash on every 1.5s readiness-poll tick" concern that
 * motivated the cache doesn't actually hold: readiness polling
 * (`useReadiness` in `ReadinessList.jsx`) only runs while the panel is
 * DISCONNECTED — i.e., only during the bounded, actively-supervised
 * install/sign-in flow itself, not for the lifetime of a long session. Once
 * connected, nothing polls `/_api/preflight` on an interval. A live-measured
 * SHA-256 pass over the actual ~241 MB installed `claude` binary took
 * ~116 ms — cheap enough to simply always pay, especially since the other
 * caller that matters (a fresh chat-session spawn, once per session) has no
 * latency budget concern at all.
 */
let trustedBin: { path: string; sha256: string } | null = null;

/** Called only by `installClaudeCli()` after its own freshness check passes. */
export function setTrustedClaudeBin(path: string, sha256: string): void {
  trustedBin = { path, sha256 };
}

function hashFile(path: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    return null;
  }
}

/** True iff `path` is either not a Maude-provisioned override (nothing to pin) or its content still matches the pinned hash — re-hashed every call, deliberately no caching shortcut (see doc comment above). */
function contentStillTrusted(path: string): boolean {
  if (!trustedBin || trustedBin.path !== path) return true; // not our concern — e.g. a user-set override
  return hashFile(path) === trustedBin.sha256;
}

/**
 * Absolute path to the user's installed `claude` CLI, or null. Honors a
 * `MAUDE_CLAUDE_BIN` override; otherwise looks it up on PATH.
 */
export function resolveClaudePath(): string | null {
  // An explicit, content-pinned `MAUDE_CLAUDE_BIN` override is checked FIRST
  // and always wins — including over the E2E force-missing stub below. This
  // matters for the desktop-e2e `acp-cold-start` scenario (T0f): it starts
  // with MAUDE_E2E_FORCE_CLAUDE_STATUS=missing to simulate a machine with no
  // `claude` on PATH, then drives the real T0c install flow, which sets THIS
  // override once its own freshness+hash verification passes
  // (login-state.ts's setTrustedClaudeBin). A coarse "simulate absent" test
  // stub must not out-rank a just-verified, explicitly-provisioned install —
  // that would make the guided install flow untestable end-to-end.
  const override = process.env.MAUDE_CLAUDE_BIN;
  if (override) {
    if (!existsSync(override)) return null;
    if (!contentStillTrusted(override)) return null;
    return override;
  }
  // DDR-166 — deterministic E2E stub (mirrors MAUDE_E2E_FAKE_GITHUB_LOGIN in
  // oauth.rs), simulating a machine where `claude` is absent from PATH.
  // Never set in a normal launch.
  if (process.env.MAUDE_E2E_FORCE_CLAUDE_STATUS === 'missing') return null;
  return Bun.which('claude');
}

/**
 * The JS runtime used to launch the adapter. The dev-server already runs under
 * Bun, so `process.execPath` is always available; prefer a real `node` when
 * present (the adapter + `@anthropic-ai/claude-agent-sdk` are authored for Node)
 * and fall back to our own Bun. Overridable via `MAUDE_ACP_RUNTIME`.
 */
export function resolveAgentRuntime(): string {
  return process.env.MAUDE_ACP_RUNTIME || Bun.which('node') || process.execPath;
}

/**
 * Cheap, side-effect-free readiness probe (no subprocess spawned) backing
 * `GET /_api/acp/status` and the WS `ready` frame. The actual ACP session spins
 * up lazily on the first prompt.
 */
export function probeAcpAvailability(): AcpAvailability {
  const adapterEntry = resolveAdapterEntry();
  const claudePath = resolveClaudePath();
  if (!adapterEntry) {
    return {
      available: false,
      reason: 'The Claude agent bridge is not installed in this build.',
      adapterEntry: null,
      claudePath,
    };
  }
  if (!claudePath) {
    return {
      available: false,
      reason: "Claude Code isn't connected — run `claude` in a terminal and `/login`.",
      adapterEntry,
      claudePath: null,
    };
  }
  return { available: true, adapterEntry, claudePath };
}

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  /** 'firstParty' = claude.ai subscription. Anything else may mean API billing. */
  apiProvider?: string;
  subscriptionType?: string;
}

/**
 * Shells `claude auth status --json` and narrows the result to only the fields
 * ever trusted/exposed here. `email`/`orgId`/`orgName` are deliberately dropped
 * on read — never forwarded to a caller, never logged (security review finding:
 * raw-stdout-to-log is a real habit elsewhere in this codebase; the fix is to
 * never let the raw payload exist past this function).
 */
export async function getClaudeAuthStatus(): Promise<ClaudeAuthStatus | null> {
  const bin = resolveClaudePath();
  if (!bin) return null;
  try {
    const proc = Bun.spawn([bin, 'auth', 'status', '--json'], {
      env: scrubAgentEnv(),
      stdout: 'pipe',
      stderr: 'ignore',
    });
    const timeout = setTimeout(() => proc.kill(), 5000);
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    clearTimeout(timeout);
    const parsed: unknown = JSON.parse(out);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    return {
      loggedIn: !!p.loggedIn,
      apiProvider: typeof p.apiProvider === 'string' ? p.apiProvider : undefined,
      subscriptionType: typeof p.subscriptionType === 'string' ? p.subscriptionType : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * The fuller availability check backing `GET /_api/acp/status` — the ONE
 * signal the ChatPanel UI's connected/not-connected gate actually watches
 * (`probeStatus()` in ChatPanel.jsx). Adds a real sign-in check on top of
 * {@link probeAcpAvailability}'s cheap adapter+path probe.
 *
 * Security-review-grade bug found while building the T0f `acp-cold-start`
 * desktop-e2e scenario: `probeAcpAvailability()` alone reports `available:
 * true` the moment `claude` is INSTALLED, before the user has signed in —
 * exactly the "logged-out-but-installed reads as available" failure mode
 * T0d's own validation criteria calls out by name. Deliberately a SEPARATE
 * function rather than changing `probeAcpAvailability()` itself: that one
 * also backs the WS `onOpen` ready frame (cheap, no subprocess spawn on every
 * socket open) and has an existing test contract (`acp-bridge.test.ts`)
 * treating "a resolvable binary" as sufficient — this is the one call site
 * that needs the fuller, auth-checked answer.
 */
export async function probeAcpAvailabilityAuthed(): Promise<AcpAvailability> {
  const base = probeAcpAvailability();
  if (!base.available) return base;
  const authStatus = await getClaudeAuthStatus();
  if (!authStatus?.loggedIn) {
    return {
      ...base,
      available: false,
      reason: 'Claude Code is installed but not signed in — sign in to connect.',
    };
  }
  return base;
}
