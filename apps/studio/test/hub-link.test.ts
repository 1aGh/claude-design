// Phase 29 (E4) Door C — hub-link credential write. Validates the lean in-app
// counterpart to `maude design link`: input validation + the global hubs.json write
// (token + per-machine trust, mode 0600). The http-layer gating (main-origin +
// loopback) is covered by canvas-origin-gate.test.ts.

import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';

import { linkHub, saveHubCredential } from '../sync/hub-link.ts';

let dir: string;
let prevPath: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'maude-hublink-'));
  prevPath = process.env.HUBS_CONFIG_PATH;
  process.env.HUBS_CONFIG_PATH = join(dir, 'hubs.json');
});
afterEach(() => {
  if (prevPath === undefined) delete process.env.HUBS_CONFIG_PATH;
  else process.env.HUBS_CONFIG_PATH = prevPath;
  rmSync(dir, { recursive: true, force: true });
});

test('rejects a missing url', async () => {
  const r = await linkHub({ token: 'tok' });
  expect(r.status).toBe(400);
  expect((r.json as { ok: boolean }).ok).toBe(false);
});

test('rejects a missing token', async () => {
  const r = await linkHub({ url: 'https://hub.example.dev' });
  expect(r.status).toBe(400);
  expect((r.json as { ok: boolean }).ok).toBe(false);
});

test('rejects a non-http(s) scheme (no file:/ftp: hub)', async () => {
  const r = await linkHub({ url: 'file:///etc/passwd', token: 'tok' });
  expect(r.status).toBe(400);
  expect(existsSync(process.env.HUBS_CONFIG_PATH as string)).toBe(false);
});

test('rejects a malformed url', async () => {
  const r = await linkHub({ url: 'not a url', token: 'tok' });
  expect(r.status).toBe(400);
});

test('saveHubCredential writes the token + records per-machine trust, mode 0600', () => {
  saveHubCredential('https://hub.example.dev', 'mau_secret');
  const p = process.env.HUBS_CONFIG_PATH as string;
  const cfg = JSON.parse(readFileSync(p, 'utf8'));
  expect(cfg.hubs['https://hub.example.dev'].token).toBe('mau_secret');
  expect(typeof cfg.hubs['https://hub.example.dev'].linkedAt).toBe('number');
  expect(cfg.trusted).toContain('https://hub.example.dev');
  if (platform() !== 'win32') {
    expect(statSync(p).mode & 0o777).toBe(0o600);
  }
});

test('a second credential for the same hub replaces the token (per-machine key)', () => {
  saveHubCredential('https://hub.example.dev', 'first');
  saveHubCredential('https://hub.example.dev', 'second');
  const cfg = JSON.parse(readFileSync(process.env.HUBS_CONFIG_PATH as string, 'utf8'));
  expect(cfg.hubs['https://hub.example.dev'].token).toBe('second');
  // Trust is not duplicated.
  expect(cfg.trusted.filter((u: string) => u === 'https://hub.example.dev')).toHaveLength(1);
});

test('role + expiresAt round-trip through the store (the renewal deadline survives)', () => {
  saveHubCredential('https://hub.example.dev', 'mau_secret', 'member', 1786400000000);
  const cfg = JSON.parse(readFileSync(process.env.HUBS_CONFIG_PATH as string, 'utf8'));
  expect(cfg.hubs['https://hub.example.dev'].role).toBe('member');
  expect(cfg.hubs['https://hub.example.dev'].expiresAt).toBe(1786400000000);
  // Absent stays absent — a self-hosted hub's credential carries no deadline.
  saveHubCredential('https://hub.example.dev', 'mau_secret2');
  const cfg2 = JSON.parse(readFileSync(process.env.HUBS_CONFIG_PATH as string, 'utf8'));
  expect(cfg2.hubs['https://hub.example.dev'].expiresAt).toBeUndefined();
});
