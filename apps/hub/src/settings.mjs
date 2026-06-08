// Hub operator settings — the editable identity bits the admin console exposes
// (hub name + description). Persisted to settings.json beside admin.json with
// the same atomic-write + 0600 discipline (DDR-053). Everything else the
// Settings surface shows (public URL, transport, storage, version, uptime) is
// READ from the existing /identity + /status payloads — not stored here.
//
// settings.json layout:
//   { "name": "Studio Hub", "description": "", "updatedAt": 1716800000000 }

import {
  chmodSync,
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_HUB_NAME = 'Studio Hub';
// Same character class as token labels (DDR-053 §5) — blocks log-forging /
// HTML-metacharacter names from reaching the console chrome.
const NAME_REGEX = /^[A-Za-z0-9 _.-]{1,64}$/;
const DESC_MAX = 120;

export function settingsFilePath(dataDir) {
  return join(dataDir, 'settings.json');
}

/** Read settings, falling back to defaults. Never throws. */
export function readSettings(dataDir) {
  const path = settingsFilePath(dataDir);
  if (!existsSync(path)) return { name: DEFAULT_HUB_NAME, description: '' };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return {
      name: typeof parsed?.name === 'string' && parsed.name ? parsed.name : DEFAULT_HUB_NAME,
      description: typeof parsed?.description === 'string' ? parsed.description : '',
    };
  } catch {
    return { name: DEFAULT_HUB_NAME, description: '' };
  }
}

/** Strip control chars (CR/LF/etc.) and clamp; defends against log-forging. */
function stripControl(value) {
  let out = '';
  const s = String(value ?? '');
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0x20 && code !== 0x7f) out += s[i];
  }
  return out;
}

/**
 * Validate + atomically persist settings. Throws on invalid input so the route
 * can surface a 400. `description` is optional; control chars are stripped.
 *
 * @param {string} dataDir
 * @param {{ name?: unknown, description?: unknown }} input
 * @returns {{ name: string, description: string }}
 */
export function writeSettings(dataDir, input) {
  const name = String(input?.name ?? '').trim();
  if (!NAME_REGEX.test(name)) {
    throw new Error('invalid hub name (allowed: letters, digits, space, _ . -; 1-64 chars)');
  }
  const description = stripControl(input?.description).slice(0, DESC_MAX);

  const path = settingsFilePath(dataDir);
  const tmp = `${path}.tmp`;
  const payload = `${JSON.stringify({ name, description, updatedAt: Date.now() }, null, 2)}\n`;
  writeFileSync(tmp, payload, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(tmp, 0o600);
  } catch {
    /* Windows / read-only fs — best effort. */
  }
  try {
    renameSync(tmp, path);
  } catch {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
    renameSync(tmp, path);
  }
  return { name, description };
}
