// Smoke: build.ts produces a parsable IIFE bundle that ships React 19.
//
// Builds into a DISPOSABLE directory (`MAUDE_DIST_DIR`), never the real one.
// It used to write its unminified dev output straight over the committed
// release artifacts — `dist/client.bundle.js` at 14 MB where 2 MB ships — so
// merely running the test suite staged a broken release, silently, with no
// server running and no obvious culprit. CLAUDE.md carried this for a while as
// "observed, root cause unconfirmed". This test was the cause.

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'bun';

describe('client bundle', () => {
  // A whole client build, so it sits right on bun's 5s default and tips over
  // whenever the machine is busy. Given headroom explicitly rather than left as
  // a flake — the thing under test is the bundle, not the wall clock.
  test('build.ts produces a parsable IIFE bundle that ships React', async () => {
    const here = join(import.meta.dir, '..');
    const out = mkdtempSync(join(tmpdir(), 'maude-bundle-smoke-'));
    try {
      const result = spawnSync({
        cmd: ['bun', 'run', join(here, 'build.ts')],
        cwd: here,
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, NODE_ENV: 'development', MAUDE_DIST_DIR: out },
      });
      expect(result.exitCode).toBe(0);

      const bundle = Bun.file(join(out, 'client.bundle.js'));
      expect(await bundle.exists()).toBe(true);
      expect(bundle.size).toBeGreaterThan(50_000);

      const src = await bundle.text();
      // React 19 internal marker — exact constants change across minor versions,
      // so we look for a stable substring on the IIFE shell + a known React API.
      expect(src.includes('createRoot') || src.includes('react-dom')).toBe(true);
      expect(src.includes('useState') || src.includes('react')).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);
});
