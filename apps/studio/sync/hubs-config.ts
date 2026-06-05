// Read-only mirror of cli/lib/hubs-config.mjs for the dev-server runtime.
//
// The CLI owns writes (`maude design link` adds + removes entries); the
// dev-server only ever reads. This module deliberately re-implements the
// reader instead of importing from cli/lib so the Bun-side ts compile chain
// doesn't pull in the .mjs CLI surface.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export interface HubRecord {
  token: string;
  linkedAt: number;
}

export interface HubsConfig {
  hubs: Record<string, HubRecord>;
}

/** Resolve the on-disk path to hubs.json (matches cli/lib/hubs-config.mjs). */
export function hubsConfigPath(): string {
  if (process.env.HUBS_CONFIG_PATH) return process.env.HUBS_CONFIG_PATH;
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, 'maude', 'hubs.json');
}

/** Normalize a hub URL — trim trailing slash, lower-case scheme + host. */
export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  let str = u.toString();
  if (str.endsWith('/') && u.pathname === '/') str = str.slice(0, -1);
  return str;
}

export function loadHubsConfig(): HubsConfig {
  const path = hubsConfigPath();
  if (!existsSync(path)) return { hubs: {} };
  warnIfWorldOrGroupReadable(path);
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.hubs !== 'object' || parsed.hubs === null) {
      return { hubs: {} };
    }
    return parsed;
  } catch {
    return { hubs: {} };
  }
}

// DDR-054 §2h (attacker F15). The CLI writes hubs.json with mode 0600. If a
// user later opens the file with an editor that resets permissions, or syncs
// it from a different host, the dev-server warns once on read. Non-blocking —
// Windows + funky-umask hosts get a polite nudge rather than a hard refusal.
let _modeWarnedFor: string | null = null;
function warnIfWorldOrGroupReadable(path: string): void {
  if (platform() === 'win32') return; // POSIX-mode semantics don't apply
  if (_modeWarnedFor === path) return; // warn once per process
  try {
    const stats = statSync(path);
    const mode = stats.mode & 0o777;
    if ((mode & 0o077) !== 0) {
      console.warn(
        `[sync] ${path} is mode ${mode.toString(8)} — recommend 'chmod 600 ${path}' (only owner can read hub tokens).`
      );
      _modeWarnedFor = path;
    }
  } catch {
    /* statSync raced with a delete — next read will retry */
  }
}

/** Look up a token for `url`. Returns null when no entry exists. */
export function getHubToken(url: string): string | null {
  try {
    const norm = normalizeUrl(url);
    const cfg = loadHubsConfig();
    const record = cfg.hubs[norm];
    return record ? record.token : null;
  } catch {
    return null;
  }
}
