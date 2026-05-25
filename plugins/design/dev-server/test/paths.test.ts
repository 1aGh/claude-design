// paths.ts — resolves real disk install root across dev mode, compiled npm
// install, and compiled marketplace install. Phase 19.1 / v0.18.1.

import { describe, expect, test } from 'bun:test';

import {
  CLIENT_DIR,
  DEV_SERVER_ROOT,
  DIST_DIR,
  IS_COMPILED_BINARY,
  RUNTIME_BUNDLES_DIR,
} from '../paths.ts';

describe('paths.ts', () => {
  test('DEV_SERVER_ROOT contains http.ts + package.json (canonical anchor)', () => {
    expect(DEV_SERVER_ROOT).not.toMatch(/\$bunfs|~BUN/);
    expect(Bun.file(`${DEV_SERVER_ROOT}/http.ts`).size).toBeGreaterThan(0);
    expect(Bun.file(`${DEV_SERVER_ROOT}/package.json`).size).toBeGreaterThan(0);
  });

  test('DIST_DIR + CLIENT_DIR + RUNTIME_BUNDLES_DIR are descendants of DEV_SERVER_ROOT', () => {
    expect(DIST_DIR).toBe(`${DEV_SERVER_ROOT}/dist`);
    expect(CLIENT_DIR).toBe(`${DEV_SERVER_ROOT}/client`);
    expect(RUNTIME_BUNDLES_DIR).toBe(`${DEV_SERVER_ROOT}/dist/runtime`);
  });

  test('IS_COMPILED_BINARY is false when running under bun directly (this test)', () => {
    // bun:test invokes via `bun`, so import.meta.url is a real file:// path.
    expect(IS_COMPILED_BINARY).toBe(false);
  });
});
