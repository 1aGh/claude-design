// Detection layer for the ACP chat bridge: where is the spawnable
// `claude-agent-acp` adapter, is the user's `claude` CLI installed, and which JS
// runtime should run the adapter. All disk paths resolve through DEV_SERVER_ROOT
// (DDR-045) — never `dirname(import.meta.url)`, which is the virtual `/$bunfs`
// path inside a compiled binary. Per DDR-123 the panel is native-app only; the
// native shell ships the apps/studio source tree (with node_modules), so the
// adapter resolves on disk there.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DEV_SERVER_ROOT } from '../paths.ts';

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
 * Absolute path to the user's installed `claude` CLI, or null. Honors a
 * `MAUDE_CLAUDE_BIN` override; otherwise looks it up on PATH.
 */
export function resolveClaudePath(): string | null {
  const override = process.env.MAUDE_CLAUDE_BIN;
  if (override) return existsSync(override) ? override : null;
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
