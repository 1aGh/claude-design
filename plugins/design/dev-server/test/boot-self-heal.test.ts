// Boot artifact check — Phase 19 / DDR-044, simplified in v0.18.1.
// v0.18.0 tried to `bun install` + `bun run build.ts` when node_modules/react
// was missing; that misfired in every install scenario (see boot-self-heal.ts
// header). v0.18.1 ships pre-built runtime bundles + just verifies they're
// reachable. Missing artifact == broken install, not first-boot gap.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bootSelfHeal, type SelfHealOptions } from '../boot-self-heal.ts';

let TMP: string;

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'maude-self-heal-'));
  mkdirSync(join(TMP, 'dist', 'runtime'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function harness(extra: Partial<SelfHealOptions> = {}) {
  const logs: string[] = [];
  let exited: number | null = null;
  const opts: SelfHealOptions = {
    here: TMP,
    log: (m) => logs.push(m),
    exit: ((code: number) => {
      exited = code;
      throw new Error(`__exit:${code}`);
    }) as never,
    ...extra,
  };
  return { opts, logs, getExited: () => exited };
}

function seedAll() {
  writeFileSync(join(TMP, 'dist', 'client.bundle.js'), '/* stub */');
  writeFileSync(join(TMP, 'dist', 'runtime', 'react.js'), '/* stub */');
}

describe('bootSelfHeal', () => {
  test('passes when both required artifacts present', async () => {
    seedAll();
    const { opts, logs } = harness();
    const result = await bootSelfHeal(opts);
    expect(result.verified).toEqual(['client.bundle.js', 'runtime/react.js']);
    expect(logs).toEqual([]);
  });

  test('exits 1 with remediation when dist/client.bundle.js missing', async () => {
    writeFileSync(join(TMP, 'dist', 'runtime', 'react.js'), '/* stub */');
    const { opts, logs, getExited } = harness();
    await expect(bootSelfHeal(opts)).rejects.toThrow('__exit:1');
    expect(getExited()).toBe(1);
    const msg = logs.join('\n');
    expect(msg).toMatch(/dist\/client\.bundle\.js/);
    expect(msg).toMatch(/npm uninstall -g @1agh\/maude/);
  });

  test('exits 1 with remediation when dist/runtime/react.js missing', async () => {
    writeFileSync(join(TMP, 'dist', 'client.bundle.js'), '/* stub */');
    const { opts, logs, getExited } = harness();
    await expect(bootSelfHeal(opts)).rejects.toThrow('__exit:1');
    expect(getExited()).toBe(1);
    const msg = logs.join('\n');
    expect(msg).toMatch(/dist\/runtime\/react\.js/);
  });

  test('lists ALL missing artifacts in one message (not first-fail-only)', async () => {
    // Nothing seeded — both missing.
    const { opts, logs } = harness();
    await expect(bootSelfHeal(opts)).rejects.toThrow('__exit:1');
    const msg = logs.join('\n');
    expect(msg).toMatch(/dist\/client\.bundle\.js/);
    expect(msg).toMatch(/dist\/runtime\/react\.js/);
  });

  test('remediation surfaces the looked-under path so user can verify', async () => {
    const { opts, logs } = harness();
    await expect(bootSelfHeal(opts)).rejects.toThrow();
    expect(logs.join('\n')).toContain(TMP);
  });
});
