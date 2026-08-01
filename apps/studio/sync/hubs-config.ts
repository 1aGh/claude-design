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
  /**
   * The role the workspace vouched for at sign-in (Cloud Phase 25 C2).
   *
   * Stored so a viewer is known to be a viewer at BOOT, before any request is
   * made — the alternative is discovering it from the first refusal, which
   * means showing somebody an editor and taking it away.
   *
   * Absent means `member`: every credential written before this shipped was
   * write-capable, and nobody is demoted by an upgrade.
   */
  role?: string;
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

/**
 * Is the credential for `url` a READ-ONLY one? (Cloud Phase 25 C2)
 *
 * Answered from the role the workspace vouched for at sign-in, so the app
 * knows at BOOT rather than discovering it from the first refused write —
 * which would mean showing somebody an editor and then taking it away.
 *
 * Unknown, unreadable, or absent all answer FALSE, matching every credential
 * written before this shipped. This flag decides what the UI OFFERS; it is
 * never the thing that stops a write. That is the cell (Phase 25 C1) and the
 * gate in http.ts, both of which hold whatever this returns.
 */
export function isHubReadOnly(url: string): boolean {
  try {
    const record = loadHubsConfig().hubs[normalizeUrl(url)];
    return record?.role === 'viewer';
  } catch {
    return false;
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
