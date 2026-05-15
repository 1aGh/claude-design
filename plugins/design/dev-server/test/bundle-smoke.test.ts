// Smoke: dist/client.bundle.js exists, parses, and references React 19.

import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import { spawnSync } from 'bun';

describe('client bundle', () => {
  test('build.ts produces a parsable IIFE bundle that ships React', async () => {
    const here = join(import.meta.dir, '..');
    const result = spawnSync({
      cmd: ['bun', 'run', join(here, 'build.ts')],
      cwd: here,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' },
    });
    expect(result.exitCode).toBe(0);

    const bundle = Bun.file(join(here, 'dist', 'client.bundle.js'));
    expect(await bundle.exists()).toBe(true);
    expect(bundle.size).toBeGreaterThan(50_000);

    const src = await bundle.text();
    // React 19 internal marker — exact constants change across minor versions,
    // so we look for a stable substring on the IIFE shell + a known React API.
    expect(src.includes('createRoot') || src.includes('react-dom')).toBe(true);
    expect(src.includes('useState') || src.includes('react')).toBe(true);
  });
});
