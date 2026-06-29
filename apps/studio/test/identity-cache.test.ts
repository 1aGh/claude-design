// DDR-132 — per-user GitHub identity SWR disk cache.
//
// Round-trips the cache against a temp XDG_CACHE_HOME, proves a different
// token-hash is a clean miss, and asserts the raw token NEVER appears in the
// on-disk file (only its sha256 prefix). Pure module — no network.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  __testing,
  cacheDir,
  clearCached,
  readCached,
  tokenHash,
  writeCached,
} from '../github/identity-cache.ts';

const realXdg = process.env.XDG_CACHE_HOME;
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'maude-idcache-'));
  process.env.XDG_CACHE_HOME = tmp;
});
afterEach(() => {
  if (realXdg === undefined) delete process.env.XDG_CACHE_HOME;
  else process.env.XDG_CACHE_HOME = realXdg;
  rmSync(tmp, { recursive: true, force: true });
});

const IDENTITY = { login: 'octocat', name: 'Octo Cat', avatar_url: 'https://x/y.png' };

describe('identity-cache', () => {
  test('cacheDir lands under $XDG_CACHE_HOME/maude', () => {
    expect(cacheDir()).toBe(join(tmp, 'maude'));
  });

  test('round-trips a written identity for the matching key', () => {
    const key = tokenHash('tok_secret_abc');
    expect(readCached(key)).toBeNull(); // first run: clean miss
    writeCached(key, IDENTITY);
    expect(readCached(key)).toEqual(IDENTITY);
  });

  test('a different token-hash is a clean miss (account/token swap)', () => {
    writeCached(tokenHash('tok_account_A'), IDENTITY);
    expect(readCached(tokenHash('tok_account_B'))).toBeNull();
  });

  test('the raw token never appears in the on-disk file', () => {
    const token = 'ghp_SUPERSECRETtokenVALUE1234567890';
    writeCached(tokenHash(token), IDENTITY);
    const raw = readFileSync(__testing.cacheFile(), 'utf8');
    expect(raw).not.toContain(token);
    // the stored key IS present and is the hash prefix, not the token
    expect(raw).toContain(tokenHash(token));
    expect(tokenHash(token).length).toBe(16);
  });

  test('tolerates a null name', () => {
    const key = tokenHash('t');
    writeCached(key, { login: 'ghost', name: null, avatar_url: 'a' });
    expect(readCached(key)?.name).toBeNull();
  });

  test('corrupt JSON is a clean miss, not a throw', () => {
    writeCached(tokenHash('t'), IDENTITY);
    // clobber the file with garbage
    const fs = require('node:fs');
    fs.writeFileSync(__testing.cacheFile(), '{ not json');
    expect(readCached(tokenHash('t'))).toBeNull();
  });

  test('clearCached forces a subsequent miss', () => {
    const key = tokenHash('t');
    writeCached(key, IDENTITY);
    expect(readCached(key)).toEqual(IDENTITY);
    clearCached();
    expect(readCached(key)).toBeNull();
  });
});
