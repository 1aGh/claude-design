// First-open AI-editing readiness probe (DDR-128). Backs `GET /_api/preflight`.
//
// Read-only: it reports which pieces of the AI-editing chain are present — the
// `claude` CLI, the `maude` CLI, the maude marketplace + plugins registered in the
// paired Claude Code, and the optional `agent-browser` — with per-item remediation.
// It NEVER installs, links, or mutates anything (DDR-128 detect-and-guide posture).
//
// PATH accuracy: in the packaged `.app` the sidecar's PATH is corrected at the Rust
// boundary (apps/desktop/.../sidecar.rs, DDR-128), so `Bun.which` is accurate here;
// `resolveOnPath` keeps a login-shell fallback as defense-in-depth for an unusual
// shell config the Rust resolution missed. Under `maude design serve` the terminal
// PATH is already correct.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { resolveAdapterEntry, resolveClaudePath } from './acp/probe.ts';

export type ReadinessStatus = 'present' | 'missing' | 'unknown';

export interface ReadinessItem {
  id: 'claude' | 'maude' | 'plugins' | 'agent-browser' | 'adapter';
  /** Short human label for the row. */
  label: string;
  /** Required items gate `ready`; optional ones never block it. */
  required: boolean;
  status: ReadinessStatus;
  /** One-line current-state description. */
  detail: string;
  /** Copy-paste-able fix, present only when the item is not satisfied. */
  remediation?: string;
}

export interface ReadinessReport {
  /** True when every REQUIRED item is `present`. */
  ready: boolean;
  items: ReadinessItem[];
}

/**
 * Resolve a binary on PATH. `Bun.which` first (accurate once the sidecar PATH is
 * Rust-corrected, and always correct under a terminal launch); a login-shell
 * fallback recovers a binary the app env can't see when the Rust resolution missed.
 * Unix-only fallback (Windows GUI apps inherit the user PATH). Returns an absolute
 * path or null. `bin` is always a hardcoded literal — never user input.
 *
 * Async + `Bun.spawn` (not `spawnSync`): the fallback shells out for up to 5 s, so a
 * synchronous spawn would block the single-threaded dev-server event loop for the
 * whole probe — a real freeze on a fresh machine where the binary is missing
 * (DDR-128 hardening, ethical-hacker F1). Awaiting yields the loop; the 5 s kill
 * bounds a misconfigured rc.
 */
export async function resolveOnPath(bin: string): Promise<string | null> {
  const direct = Bun.which(bin);
  if (direct) return direct;
  if (process.platform === 'win32') return null;
  try {
    const shell = process.env.SHELL || '/bin/sh';
    const proc = Bun.spawn([shell, '-ilc', `command -v ${bin} 2>/dev/null`], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'ignore',
    });
    const killer = setTimeout(() => {
      try {
        proc.kill(9);
      } catch {
        /* already gone */
      }
    }, 5000);
    let out: string;
    try {
      out = await new Response(proc.stdout).text();
    } finally {
      clearTimeout(killer);
    }
    // Instant-prompt frameworks (powerlevel10k) can print to stdout on interactive
    // start, so take the last line that is an absolute path to a real file.
    const hit = out
      .split('\n')
      .map((l) => l.trim())
      .reverse()
      .find((l) => l.startsWith('/') && existsSync(l));
    return hit ?? null;
  } catch {
    return null;
  }
}

/** Claude Code's config dir — relocatable via `CLAUDE_CONFIG_DIR` (its own contract). */
function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

function readJson<T = unknown>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

interface PluginScan {
  /** 'unknown' when the registry couldn't be read (Claude Code's internal contract). */
  status: 'present' | 'unknown';
  marketplace: boolean;
  design: boolean;
  flow: boolean;
}

/**
 * Read-only scan of Claude Code's plugin registry for the maude marketplace
 * (`repo: 1aGh/maude`) and the `design@maude` / `flow@maude` plugins. `readFileSync`
 * follows symlinks (a dev's `~/.claude` is symlinked into Dotfiles). Never writes,
 * never throws — an unrecognized layout yields `status: 'unknown'`.
 */
function scanPlugins(): PluginScan {
  const dir = claudeConfigDir();
  const markets = readJson<Record<string, { source?: { repo?: string } }>>(
    join(dir, 'plugins', 'known_marketplaces.json')
  );
  const installed = readJson<{ plugins?: Record<string, unknown> }>(
    join(dir, 'plugins', 'installed_plugins.json')
  );
  if (!markets && !installed) {
    return { status: 'unknown', marketplace: false, design: false, flow: false };
  }
  const marketplace =
    !!markets &&
    Object.values(markets).some(
      (m) => String(m?.source?.repo ?? '').toLowerCase() === '1agh/maude'
    );
  const plugins = installed?.plugins ?? {};
  const has = (key: string): boolean => {
    const v = plugins[key];
    return Array.isArray(v) ? v.length > 0 : !!v;
  };
  return { status: 'present', marketplace, design: has('design@maude'), flow: has('flow@maude') };
}

/**
 * Side-effect-free readiness report. The three binary probes run concurrently so a
 * fresh machine (where the login-shell fallback fires) resolves in ~one shell round
 * trip, not three sequential ones. The backing route gates cross-origin callers
 * (DDR-128 hardening) so this can't be turned into a spawn-storm from a drive-by page.
 */
export async function probeReadiness(): Promise<ReadinessReport> {
  const [claude, maude, agentBrowser] = await Promise.all([
    (async () => resolveClaudePath() ?? (await resolveOnPath('claude')))(),
    resolveOnPath('maude'),
    resolveOnPath('agent-browser'),
  ]);

  const items: ReadinessItem[] = [];

  items.push({
    id: 'claude',
    label: 'Claude Code (the `claude` CLI)',
    required: true,
    status: claude ? 'present' : 'missing',
    detail: claude
      ? 'Installed — AI editing drives it on your own Pro/Max subscription.'
      : 'Not found on PATH.',
    remediation: claude
      ? undefined
      : 'Install Claude Code, then run `claude` and `/login` once. AI editing runs on your own Pro/Max subscription — never API billing.',
  });

  items.push({
    id: 'maude',
    label: 'maude CLI',
    required: true,
    status: maude ? 'present' : 'missing',
    detail: maude ? 'On PATH — `/design:edit` can reach its helpers.' : 'Not found on PATH.',
    remediation: maude
      ? undefined
      : 'Install it: `npm i -g @1agh/maude`. `/design:edit` shells out to `maude design …`, so it must be on PATH.',
  });

  const scan = scanPlugins();
  const pluginsPresent = scan.design && scan.flow;
  const pluginStatus: ReadinessStatus =
    scan.status === 'unknown' ? 'unknown' : pluginsPresent ? 'present' : 'missing';
  const missing = [!scan.design && 'design@maude', !scan.flow && 'flow@maude']
    .filter(Boolean)
    .join(' + ');
  items.push({
    id: 'plugins',
    label: 'Maude plugins in Claude Code',
    required: true,
    status: pluginStatus,
    detail:
      scan.status === 'unknown'
        ? "Couldn't read Claude Code's plugin registry — check it manually."
        : pluginsPresent
          ? 'design@maude + flow@maude are installed.'
          : `Missing: ${missing}${scan.marketplace ? '' : ' (and the maude marketplace)'}.`,
    remediation:
      pluginStatus === 'present'
        ? undefined
        : 'In Claude Code: `/plugin marketplace add 1aGh/maude`, then `/plugin install design@maude` and `/plugin install flow@maude`.',
  });

  items.push({
    id: 'agent-browser',
    label: 'agent-browser (optional)',
    required: false,
    status: agentBrowser ? 'present' : 'missing',
    detail: agentBrowser
      ? 'Installed — screenshot evidence during edits.'
      : 'Optional — richer screenshot evidence during edits.',
    remediation: agentBrowser
      ? undefined
      : 'Optional. Install `agent-browser` for screenshot evidence during `/design:edit`.',
  });

  // The chat bridge itself: the adapter must be resolvable on disk. This is what
  // actually gates the chat panel (probeAcpAvailability → resolveAdapterEntry),
  // distinct from the user-environment checks above. Shown so a build that ships
  // without the staged adapter closure surfaces here instead of leaving every
  // other row green while chat reports "bridge is not installed" (the v0.31–0.32
  // desktop bug; see apps/desktop/scripts/stage-resources.mjs).
  const adapter = resolveAdapterEntry();
  items.push({
    id: 'adapter',
    label: 'Claude agent bridge',
    required: true,
    status: adapter ? 'present' : 'missing',
    detail: adapter ? 'Bundled — the chat panel can spawn it.' : 'Not bundled in this build.',
    remediation: adapter
      ? undefined
      : 'The Claude agent bridge is missing from this build — reinstall or update Maude. If you built it yourself, ensure the desktop staging step bundled `@agentclientprotocol/claude-agent-acp`.',
  });

  const ready = items.filter((i) => i.required).every((i) => i.status === 'present');
  return { ready, items };
}
