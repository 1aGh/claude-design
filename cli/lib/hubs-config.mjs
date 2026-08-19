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
//     },
//     "trusted": ["https://maude-hub-foo.fly.dev", ...]
//   }
//
// `trusted` is the per-machine trust allowlist for non-loopback hubs (the
// `maude design link` confirmation, DDR-054 F2). It lives here — NOT in a
// committable repo file — on purpose: a committable allowlist would let an
// attacker pre-seed trust via a PR and bypass the link-time confirmation
// (trust laundering). Trust is a per-machine decision, like `~/.ssh/known_hosts`.

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/**
 * Upsert a hub entry. Same URL replaces the existing record. `extra` merges
 * additional per-machine attestations (e.g. `adoptedAt` — the timestamp this
 * machine pushed its local state up via `--adopt`, used by the sync runtime to
 * avoid re-adopting; DDR-054 F4).
 *
 * @param {string} url
 * @param {string} token
 * `role` is the ONE prior field carried across a relink (Cloud Phase 25 C2).
 * It records what the workspace vouched for at sign-in, and this path has no
 * fresher answer — the CLI does not sign in. Dropping it would silently show
 * a viewer the editing UI again, which is the exact experience the flag
 * exists to prevent; a stale value costs a redundant hidden affordance and
 * self-corrects at the next workspace sign-in. Nothing ELSE is preserved:
 * `adoptedAt` is a per-machine attestation that a relink is entitled to clear.
 *
 * @param {{ adoptedAt?: number }} [extra]
 */
export function addHub(url, token, extra = {}) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  const priorRole = cfg.hubs[norm]?.role;
  // LOCAL CONSENT SURVIVES EVERY RE-SAVE. `role` is a cache of what the hub
  // said about you at sign-in; `codeModulesAllowed` is what YOU said about the
  // hub, and a login response must not be able to change it.
  const priorConsent = cfg.hubs[norm]?.codeModulesAllowed;
  cfg.hubs[norm] = {
    token,
    linkedAt: Date.now(),
    ...(priorRole ? { role: priorRole } : {}),
    ...(typeof priorConsent === 'boolean' ? { codeModulesAllowed: priorConsent } : {}),
    ...extra,
  };
  saveHubsConfig(cfg);
  return cfg.hubs[norm];
}

/**
 * Record whether this machine accepts executable modules from `url`.
 *
 * The one writer for the receiver's `code-module` gate. Deliberately separate
 * from `addHub` so it is greppable: a second setter appearing anywhere is the
 * bug this function exists to make visible.
 */
export function setHubCodeModules(url, allowed) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  if (!cfg.hubs[norm]) return false;
  cfg.hubs[norm].codeModulesAllowed = allowed === true;
  saveHubsConfig(cfg);
  return true;
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
 * Per-machine trust check for a non-loopback hub (DDR-054 F2). Trust is stored
 * here, not in a committable repo file, so a malicious PR cannot pre-seed it.
 */
export function isHubTrusted(url) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  return Array.isArray(cfg.trusted) && cfg.trusted.includes(norm);
}

/** Record a hub as trusted on THIS machine. Idempotent. */
export function trustHub(url) {
  const norm = normalizeUrl(url);
  const cfg = loadHubsConfig();
  if (!Array.isArray(cfg.trusted)) cfg.trusted = [];
  if (!cfg.trusted.includes(norm)) {
    cfg.trusted.push(norm);
    saveHubsConfig(cfg);
  }
  return norm;
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
