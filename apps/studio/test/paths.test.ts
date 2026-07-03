// paths.ts — resolves real disk install root across dev mode, compiled npm
// install, and compiled marketplace install. Phase 19.1 / v0.18.1.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CLIENT_DIR,
  DESIGN_PLUGIN_DIR,
  DEV_SERVER_ROOT,
  DIST_DIR,
  FLOW_PLUGIN_DIR,
  IS_COMPILED_BINARY,
  pluginDirFrom,
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

describe('pluginDirFrom — session-scoped plugin auto-bootstrap resolution (DDR-143)', () => {
  // Both simulated layouts keep `plugins/` a sibling of `apps/studio/`, matching
  // the dev tree and the desktop Resources bundle (stage-resources.mjs).
  function makeLayout(shape: 'desktop-bundle' | 'npm'): { root: string; devServerRoot: string } {
    const root = mkdtempSync(join(tmpdir(), 'maude-paths-'));
    const devServerRoot = join(root, 'apps', 'studio');
    mkdirSync(devServerRoot, { recursive: true });
    for (const plugin of ['design', 'flow'] as const) {
      const pluginRoot = join(root, 'plugins', plugin);
      // Both layouts ship templates (DDR-044).
      mkdirSync(join(pluginRoot, 'templates'), { recursive: true });
      if (shape === 'desktop-bundle') {
        // The desktop bundle stages the full loadable tree incl. the manifest.
        mkdirSync(join(pluginRoot, '.claude-plugin'), { recursive: true });
        mkdirSync(join(pluginRoot, 'commands'), { recursive: true });
        writeFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), '{"name":"x"}');
      }
      // npm layout: NO .claude-plugin/plugin.json (DDR-044 minimal surface).
    }
    return { root, devServerRoot };
  }

  test('desktop Resources layout → resolves both plugin dirs (manifest present)', () => {
    const { root, devServerRoot } = makeLayout('desktop-bundle');
    try {
      expect(pluginDirFrom(devServerRoot, 'design')).toBe(join(root, 'plugins', 'design'));
      expect(pluginDirFrom(devServerRoot, 'flow')).toBe(join(root, 'plugins', 'flow'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('npm/web layout → null (templates ship, but no plugin manifest)', () => {
    const { root, devServerRoot } = makeLayout('npm');
    try {
      expect(pluginDirFrom(devServerRoot, 'design')).toBeNull();
      expect(pluginDirFrom(devServerRoot, 'flow')).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('exported constants resolve under the running dev tree (manifest present here)', () => {
    // This suite runs from the repo dev tree, where plugins/{design,flow}/ carry
    // their manifests — so the module-load-time constants are non-null and point
    // at the real plugin roots.
    expect(DESIGN_PLUGIN_DIR).toBe(join(DEV_SERVER_ROOT, '..', '..', 'plugins', 'design'));
    expect(FLOW_PLUGIN_DIR).toBe(join(DEV_SERVER_ROOT, '..', '..', 'plugins', 'flow'));
  });
});
