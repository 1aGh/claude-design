// Regression tests for exporters/_runtime.ts — the shared shim-path + runtime
// resolver behind the desktop-export fix (RCA issue-desktop-export-failures).
//
// Guards the two defects the render exporters shipped with:
//   1. shim paths must derive from DEV_SERVER_ROOT (paths.ts), NEVER a virtual
//      `/$bunfs/root` (DDR-045).
//   2. the JS runtime must be resolved (not a hardcoded `'node'`), with an
//      actionable throw when none is on PATH.

import { afterEach, describe, expect, test } from 'bun:test';
import { EXPORT_SHIM_DIR, exportShimPath, resolveExportRuntime } from '../../exporters/_runtime.ts';
import { DEV_SERVER_ROOT } from '../../paths.ts';

const ORIGINAL_PATH = process.env.PATH;
const ORIGINAL_RUNTIME = process.env.MAUDE_EXPORT_RUNTIME;

afterEach(() => {
  // Restore any env mutated by a test (each bun:test file is its own process,
  // but tests within it share env — keep them isolated).
  if (ORIGINAL_PATH === undefined) delete process.env.PATH;
  else process.env.PATH = ORIGINAL_PATH;
  if (ORIGINAL_RUNTIME === undefined) delete process.env.MAUDE_EXPORT_RUNTIME;
  else process.env.MAUDE_EXPORT_RUNTIME = ORIGINAL_RUNTIME;
});

describe('exporters/_runtime — shim paths (DDR-045)', () => {
  test('EXPORT_SHIM_DIR is <DEV_SERVER_ROOT>/bin and never virtual /$bunfs', () => {
    expect(EXPORT_SHIM_DIR).toBe(`${DEV_SERVER_ROOT}/bin`);
    expect(EXPORT_SHIM_DIR).not.toContain('$bunfs');
    expect(EXPORT_SHIM_DIR).not.toContain('~BUN');
  });

  test('exportShimPath resolves a real disk path under the shim dir', () => {
    const p = exportShimPath('_png-playwright.mjs');
    expect(p).toBe(`${DEV_SERVER_ROOT}/bin/_png-playwright.mjs`);
    expect(p).not.toContain('$bunfs');
  });
});

describe('exporters/_runtime — runtime ladder', () => {
  test('honors the MAUDE_EXPORT_RUNTIME override', () => {
    process.env.MAUDE_EXPORT_RUNTIME = '/opt/custom/bin/node';
    expect(resolveExportRuntime()).toBe('/opt/custom/bin/node');
  });

  test('resolves an on-PATH runtime when no override is set', () => {
    delete process.env.MAUDE_EXPORT_RUNTIME;
    // The test host has bun (and usually node) on PATH → a truthy absolute path.
    const runtime = resolveExportRuntime();
    expect(runtime).toBeTruthy();
    expect(runtime).not.toBe('node'); // resolved to an absolute path, not the bare name
  });

  test('throws an actionable error when no node/bun runtime is reachable', () => {
    delete process.env.MAUDE_EXPORT_RUNTIME;
    process.env.PATH = '/nonexistent-maude-export-runtime-probe';
    expect(() => resolveExportRuntime()).toThrow(/render export needs a JS runtime/i);
  });
});
