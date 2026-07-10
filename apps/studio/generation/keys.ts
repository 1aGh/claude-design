// generation/keys.ts — BYOK provider-key custody for AI media generation (DDR-16x).
//
// Keys live OUTSIDE the served `.design/` tree so a canvas file-route can never
// read them: `~/.config/maude/keys.json`, mode 0600 (XDG-aware, same location
// discipline as sync/hubs-config.ts's hubs.json). A provider key is resolved at
// REQUEST TIME and NEVER cached, logged, or returned to the canvas realm — the
// exact template is github/token.ts (fetch-at-request-time, null when absent).
//
// Native tier (Phase 5.1, DDR-16x): when the Tauri keychain bridge env is
// present (`MAUDE_GEN_KEY_ENDPOINT`/`_KEY`, mirroring MAUDE_TOKEN_ENDPOINT for
// GitHub), `getProviderKey` prefers the keychain over the file. The bridge is
// not wired in Phase 0 — the hook is here so `keys.ts` never has to change when
// the native keychain lands; the file store is the whole Phase-0 custody.
//
// The Settings panel POSTs a key to a PRIVILEGED main-origin route which calls
// `setProviderKey`; that route NEVER echoes a key back (it returns
// `{ configured: true }`, mirroring `github_is_signed_in`). `isConfigured` backs
// the GET status probe — it reveals only presence, never the value.

import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';

/** Slug-shaped provider id — the JSON key + keychain lookup. Never a path. */
const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Resolve the on-disk path to keys.json (mirrors hubs-config.ts's XDG logic). */
export function keysConfigPath(): string {
  if (process.env.MAUDE_GEN_KEYS_PATH) return process.env.MAUDE_GEN_KEYS_PATH;
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, 'maude', 'keys.json');
}

interface KeysFile {
  keys: Record<string, string>;
}

let _modeWarnedFor: string | null = null;
function warnIfWorldOrGroupReadable(path: string): void {
  if (platform() === 'win32') return; // POSIX-mode semantics don't apply
  if (_modeWarnedFor === path) return;
  try {
    const mode = statSync(path).mode & 0o777;
    if ((mode & 0o077) !== 0) {
      console.warn(
        `[generation] ${path} is mode ${mode.toString(8)} — recommend 'chmod 600 ${path}' (only owner can read provider keys).`
      );
      _modeWarnedFor = path;
    }
  } catch {
    /* raced with a delete — next read retries */
  }
}

function readKeysFile(): KeysFile {
  const path = keysConfigPath();
  if (!existsSync(path)) return { keys: {} };
  warnIfWorldOrGroupReadable(path);
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed.keys !== 'object' || parsed.keys === null) return { keys: {} };
    return parsed as KeysFile;
  } catch {
    return { keys: {} };
  }
}

/** Write keys.json atomically-ish with a hard 0600 mode (create + chmod). */
function writeKeysFile(data: KeysFile): void {
  const path = keysConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  // Write then chmod — writeFileSync's mode is masked by umask, so we assert
  // 0600 explicitly afterwards (same guarantee cli/lib/hubs-config.mjs makes).
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  if (platform() !== 'win32') {
    try {
      chmodSync(path, 0o600);
    } catch {
      /* best-effort — the warn-on-read path is the backstop */
    }
  }
}

/** Whether the native keychain bridge is configured (Phase 5.1 / DDR-16x). */
function keychainBridgeAvailable(): boolean {
  return Boolean(process.env.MAUDE_GEN_KEY_ENDPOINT && process.env.MAUDE_GEN_KEY_KEY);
}

/** Fetch a key from the Tauri keychain bridge over loopback (Phase 5.1). */
async function getKeyFromBridge(providerId: string): Promise<string | null> {
  const endpoint = process.env.MAUDE_GEN_KEY_ENDPOINT;
  const key = process.env.MAUDE_GEN_KEY_KEY;
  if (!endpoint || !key) return null;
  try {
    const res = await fetch(`${endpoint}?provider=${encodeURIComponent(providerId)}`, {
      headers: { 'X-Maude-Token-Key': key },
      signal: AbortSignal.timeout(3000),
    });
    if (res.status !== 200) return null; // 404 = not set; 403 = bad key
    const token = (await res.text()).trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a provider's API key at request time. Prefers the native keychain
 * bridge when present, otherwise the 0600 file. Returns null when unset (the
 * caller degrades to "add a key in Settings"). NEVER cache the result — a key
 * can be rotated in Settings and the store is the single source of truth.
 */
export async function getProviderKey(providerId: string): Promise<string | null> {
  if (!PROVIDER_ID_RE.test(providerId)) return null;
  if (keychainBridgeAvailable()) {
    const fromBridge = await getKeyFromBridge(providerId);
    if (fromBridge) return fromBridge;
    // Fall through to the file store even under the bridge, so a key added via
    // the browser Settings panel still resolves in the native app.
  }
  const key = readKeysFile().keys[providerId];
  return typeof key === 'string' && key.length > 0 ? key : null;
}

/** Persist a provider key to the 0600 file store (Settings panel write path). */
export function setProviderKey(providerId: string, value: string): void {
  if (!PROVIDER_ID_RE.test(providerId)) throw new Error('invalid provider id');
  const trimmed = value.trim();
  if (!trimmed) throw new Error('empty key');
  const file = readKeysFile();
  file.keys[providerId] = trimmed;
  writeKeysFile(file);
}

/** Remove a provider key (Settings "remove key"). No-op when absent. */
export function deleteProviderKey(providerId: string): void {
  if (!PROVIDER_ID_RE.test(providerId)) return;
  const file = readKeysFile();
  if (providerId in file.keys) {
    delete file.keys[providerId];
    writeKeysFile(file);
  }
}

/**
 * Presence-only check for the status GET. Reveals whether a key exists (file or
 * bridge) — NEVER the value. Synchronous file check + a cheap bridge-present
 * signal (the bridge itself is only queried at real request time).
 */
export function isConfigured(providerId: string): boolean {
  if (!PROVIDER_ID_RE.test(providerId)) return false;
  const key = readKeysFile().keys[providerId];
  return typeof key === 'string' && key.length > 0;
}

/** The set of provider ids that currently have a key configured (file store). */
export function configuredProviders(): string[] {
  return Object.entries(readKeysFile().keys)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([id]) => id);
}
