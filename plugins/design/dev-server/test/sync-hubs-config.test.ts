// hubs-config reader tests — Phase 9 Task 4.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getHubToken, hubsConfigPath, loadHubsConfig, normalizeUrl } from '../sync/hubs-config.ts';

let dir: string;
let cfgPath: string;
let savedEnv: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hubs-config-'));
  cfgPath = join(dir, 'hubs.json');
  savedEnv = process.env.HUBS_CONFIG_PATH;
  process.env.HUBS_CONFIG_PATH = cfgPath;
});

afterEach(() => {
  // Node's process.env stringifies on assignment; assigning undefined yields
  // the literal string "undefined". delete is the correct restoration.
  // biome-ignore lint/performance/noDelete: process.env semantics.
  if (savedEnv === undefined) delete process.env.HUBS_CONFIG_PATH;
  else process.env.HUBS_CONFIG_PATH = savedEnv;
  rmSync(dir, { recursive: true, force: true });
});

describe('hubsConfigPath', () => {
  test('honors HUBS_CONFIG_PATH override (used by tests)', () => {
    expect(hubsConfigPath()).toBe(cfgPath);
  });
});

describe('normalizeUrl', () => {
  test('trims trailing slash from root paths', () => {
    expect(normalizeUrl('https://hub.example.com/')).toBe('https://hub.example.com');
  });

  test('lower-cases scheme + host', () => {
    expect(normalizeUrl('HTTPS://Hub.Example.COM')).toBe('https://hub.example.com');
  });

  test('preserves non-root path case', () => {
    expect(normalizeUrl('https://Hub.example.com/Path')).toBe('https://hub.example.com/Path');
  });
});

// Write the test hubs.json with mode 0600 so the DDR-054 §2h mode-warning
// logic doesn't fire on every test. The warning has its own dedicated test
// below.
function writeCfg(content: string): void {
  writeFileSync(cfgPath, content);
  chmodSync(cfgPath, 0o600);
}

describe('loadHubsConfig + getHubToken', () => {
  test('returns empty hubs when file missing', () => {
    expect(loadHubsConfig()).toEqual({ hubs: {} });
  });

  test('returns empty hubs on malformed JSON', () => {
    writeCfg('{ not json');
    expect(loadHubsConfig()).toEqual({ hubs: {} });
  });

  test('returns empty hubs when hubs field is absent', () => {
    writeCfg('{"unrelated":true}');
    expect(loadHubsConfig()).toEqual({ hubs: {} });
  });

  test('returns the parsed config when shape is valid', () => {
    const cfg = {
      hubs: {
        'https://hub.example.com': { token: 'mau_abc', linkedAt: 123 },
      },
    };
    writeCfg(JSON.stringify(cfg));
    expect(loadHubsConfig()).toEqual(cfg);
  });

  test('getHubToken returns token for matching URL', () => {
    writeCfg(
      JSON.stringify({ hubs: { 'https://hub.example.com': { token: 'mau_abc', linkedAt: 1 } } })
    );
    expect(getHubToken('https://hub.example.com')).toBe('mau_abc');
  });

  test('getHubToken normalizes URL before lookup', () => {
    writeCfg(
      JSON.stringify({ hubs: { 'https://hub.example.com': { token: 'mau_xyz', linkedAt: 1 } } })
    );
    expect(getHubToken('HTTPS://Hub.example.COM/')).toBe('mau_xyz');
  });

  test('getHubToken returns null when URL unknown', () => {
    writeCfg(JSON.stringify({ hubs: {} }));
    expect(getHubToken('https://nowhere.example.com')).toBeNull();
  });

  test('getHubToken returns null on malformed url', () => {
    expect(getHubToken('not a url')).toBeNull();
  });

  test('DDR-054 §2h — warns once when hubs.json is world/group readable', () => {
    writeFileSync(
      cfgPath,
      JSON.stringify({ hubs: { 'https://hub.example.com': { token: 'tok', linkedAt: 1 } } })
    );
    // Permissive mode — should trigger a warn on first load.
    chmodSync(cfgPath, 0o644);
    const warnings: unknown[][] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      loadHubsConfig();
      loadHubsConfig(); // second call — should NOT warn again (warn-once)
    } finally {
      console.warn = origWarn;
    }
    const modeWarnings = warnings.filter(
      (w) => typeof w[0] === 'string' && w[0].includes('chmod 600')
    );
    expect(modeWarnings.length).toBe(1);
  });
});
