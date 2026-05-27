// Read-only mirror of cli/lib/hubs-config.mjs for the dev-server runtime.
//
// The CLI owns writes (`maude design link` adds + removes entries); the
// dev-server only ever reads. This module deliberately re-implements the
// reader instead of importing from cli/lib so the Bun-side ts compile chain
// doesn't pull in the .mjs CLI surface.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
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
