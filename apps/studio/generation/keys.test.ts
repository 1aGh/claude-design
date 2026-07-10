// generation/keys.test.ts — key custody: 0600 mode assert, round-trip, and
// missing-key returns null. Points MAUDE_GEN_KEYS_PATH at a sandbox file so the
// user's real ~/.config/maude/keys.json is never touched.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  configuredProviders,
  deleteProviderKey,
  getProviderKey,
  isConfigured,
  keysConfigPath,
  setProviderKey,
} from './keys.ts';

let dir: string;
const prevPath = process.env.MAUDE_GEN_KEYS_PATH;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'maude-keys-'));
  process.env.MAUDE_GEN_KEYS_PATH = join(dir, 'keys.json');
});

afterEach(() => {
  if (prevPath === undefined) delete process.env.MAUDE_GEN_KEYS_PATH;
  else process.env.MAUDE_GEN_KEYS_PATH = prevPath;
  rmSync(dir, { recursive: true, force: true });
});

describe('generation key custody', () => {
  test('missing key resolves to null; isConfigured false', async () => {
    expect(await getProviderKey('gemini')).toBeNull();
    expect(isConfigured('gemini')).toBe(false);
    expect(configuredProviders()).toEqual([]);
  });

  test('set → get round-trips and reports configured', async () => {
    setProviderKey('gemini', 'AIza-secret-123');
    expect(await getProviderKey('gemini')).toBe('AIza-secret-123');
    expect(isConfigured('gemini')).toBe(true);
    expect(configuredProviders()).toContain('gemini');
  });

  test('the keys file is written mode 0600', () => {
    setProviderKey('elevenlabs', 'sk-eleven');
    const path = keysConfigPath();
    expect(existsSync(path)).toBe(true);
    if (platform() !== 'win32') {
      const mode = statSync(path).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  test('set trims whitespace and rejects empties', () => {
    setProviderKey('gemini', '  padded-key  ');
    expect(isConfigured('gemini')).toBe(true);
    expect(() => setProviderKey('gemini', '   ')).toThrow();
  });

  test('delete removes the key', async () => {
    setProviderKey('gemini', 'k');
    deleteProviderKey('gemini');
    expect(await getProviderKey('gemini')).toBeNull();
    expect(isConfigured('gemini')).toBe(false);
  });

  test('a malformed provider id never resolves or writes', async () => {
    expect(await getProviderKey('../etc')).toBeNull();
    expect(() => setProviderKey('../etc', 'x')).toThrow();
    expect(isConfigured('../etc')).toBe(false);
  });
});
