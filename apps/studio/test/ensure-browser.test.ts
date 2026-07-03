// Screenshot-browser resolver (bundled-screenshots feature). Covers the pure
// resolution priority; the actual download (priority 5) is exercised only when no
// browser exists on the host — untestable in CI where system Chrome / a Playwright
// headless-shell are usually present, so we assert `download:false` never fetches.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CFT_VERSION_RE, isTrustedDownloadUrl, resolveBrowser } from '../bin/_ensure-browser.mjs';

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) {
    saved[k] = process.env[k];
    if (patch[k] === undefined) delete process.env[k];
    else process.env[k] = patch[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(patch)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

describe('resolveBrowser — resolution priority', () => {
  test('AGENT_BROWSER_EXECUTABLE_PATH override wins', async () => {
    const r = await withEnv({ AGENT_BROWSER_EXECUTABLE_PATH: import.meta.path }, () =>
      resolveBrowser({ download: false })
    );
    expect(r.source).toBe('override');
    expect(r.path).toBe(import.meta.path);
  });

  test('a cached chrome-headless-shell in MAUDE_BROWSERS_DIR resolves before system Chrome', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-browsers-'));
    const sub = join(dir, 'chrome-headless-shell-1.2.3-mac-arm64');
    mkdirSync(sub, { recursive: true });
    const exeName =
      process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
    const exe = join(sub, exeName);
    writeFileSync(exe, '#!/bin/sh\n');
    try {
      const r = await withEnv(
        {
          MAUDE_BROWSERS_DIR: dir,
          AGENT_BROWSER_EXECUTABLE_PATH: undefined,
          MAUDE_BROWSER_EXECUTABLE: undefined,
        },
        () => resolveBrowser({ download: false })
      );
      expect(r.source).toBe('cache');
      expect(r.path).toBe(exe);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('download:false never fetches (source is never "downloaded")', async () => {
    const r = await resolveBrowser({ download: false });
    expect(r.source).not.toBe('downloaded');
  });
});

describe('download hardening (DDR-144 security fixes)', () => {
  test('isTrustedDownloadUrl accepts only https on the allowlisted CDN hosts (F2)', () => {
    expect(
      isTrustedDownloadUrl('https://storage.googleapis.com/chrome-for-testing-public/x.zip')
    ).toBe(true);
    expect(isTrustedDownloadUrl('https://googlechromelabs.github.io/x.json')).toBe(true);
    // plaintext scheme (MITM-able) rejected
    expect(isTrustedDownloadUrl('http://storage.googleapis.com/x.zip')).toBe(false);
    // foreign host (manifest tampering / redirect) rejected
    expect(isTrustedDownloadUrl('https://evil.example.com/x.zip')).toBe(false);
    // garbage rejected, no throw
    expect(isTrustedDownloadUrl('not a url')).toBe(false);
    expect(isTrustedDownloadUrl('')).toBe(false);
  });

  test('CFT_VERSION_RE accepts real versions, rejects shell-injection payloads (F3)', () => {
    expect(CFT_VERSION_RE.test('150.0.7871.46')).toBe(true);
    expect(CFT_VERSION_RE.test('120')).toBe(true);
    // the PowerShell -Command break-out attempt
    expect(CFT_VERSION_RE.test("1.0'; Remove-Item C:\\ -Recurse #")).toBe(false);
    expect(CFT_VERSION_RE.test('$(rm -rf /)')).toBe(false);
    expect(CFT_VERSION_RE.test('../../etc')).toBe(false);
  });
});
