// ~/.config/maude/hubs.json — per-machine map of hub URLs → bearer tokens.
//
// Phase 9 Task 3 (peer pairing). Plan text references `~/.config/mdcc/hubs.json`
// from before the v0.15.0 md-claude → maude rename; we ship at the new path.
// Never committed to git — tokens live per-machine.
//
// Schema:
//   {
//     "hubs": {
//       "https://maude-hub-foo.fly.dev": {
//         "token": "mau_a3f9c8b2...",
//         "linkedAt": 1716800000000
//       },
//       ...
//     }
//   }

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Resolve the on-disk path to hubs.json (XDG-compliant on POSIX). */
export function hubsConfigPath() {
  // Honors HUBS_CONFIG_PATH override (used by tests). Falls back to
  // $XDG_CONFIG_HOME/maude/hubs.json, then ~/.config/maude/hubs.json.
  if (process.env.HUBS_CONFIG_PATH) return process.env.HUBS_CONFIG_PATH;
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, 'maude', 'hubs.json');
}

/**
 * Read hubs.json. Returns `{ hubs: {} }` if the file is missing or malformed.
 *
 * @returns {{ hubs: Record<string, { token: string, linkedAt: number }> }}
 */
export function loadHubsConfig() {
  const path = hubsConfigPath();
  if (!existsSync(path)) return { hubs: {} };
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

/**
 * Write hubs.json with restrictive permissions (0600 — owner read/write only).
 * Creates the parent directory if it does not exist.
 *
 * @param {{ hubs: Record<string, { token: string, linkedAt: number }> }} config
 */
export function saveHubsConfig(config) {
  const path = hubsConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const payload = `${JSON.stringify(config, null, 2)}\n`;
  writeFileSync(path, payload, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
}

/** Upsert a hub entry. Same URL replaces the existing record. */
export function addHub(url, token) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  cfg.hubs[norm] = { token, linkedAt: Date.now() };
  saveHubsConfig(cfg);
  return cfg.hubs[norm];
}

/** Remove a hub entry. Returns true if anything was removed. */
export function removeHub(url) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  if (!(norm in cfg.hubs)) return false;
  delete cfg.hubs[norm];
  saveHubsConfig(cfg);
  return true;
}

/**
 * Look up a hub by URL. Returns null when no entry exists.
 *
 * @returns {{ token: string, linkedAt: number } | null}
 */
export function getHub(url) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  return cfg.hubs[norm] ?? null;
}

/**
 * Normalize a hub URL so different spellings resolve to the same key:
 * - Trim trailing slash.
 * - Lower-case scheme + host (RFC 3986 §3.2.2; path stays case-sensitive).
 *
 * `https://Hub.example.com/` and `https://hub.example.com` are the same hub.
 */
export function normalizeUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('url must be a non-empty string');
  }
  try {
    const u = new URL(url);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    // URL constructor drops trailing slash unless there's a path beyond `/`.
    let str = u.toString();
    if (str.endsWith('/') && u.pathname === '/') str = str.slice(0, -1);
    return str;
  } catch {
    throw new Error(`invalid url: ${url}`);
  }
}
