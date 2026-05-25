// Boot self-heal logic — Phase 19 / DDR-044.
// Covers the marketplace-cache-install gap: if dist/ or node_modules/ is
// missing on boot, self-heal runs bun install + build. Opt out with
// MAUDE_NO_AUTOBUILD=1.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { bootSelfHeal, type SelfHealOptions } from '../boot-self-heal.ts';

let TMP: string;

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'maude-self-heal-'));
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function harness(extra: Partial<SelfHealOptions> = {}) {
  const calls: { cmd: readonly string[]; cwd: string }[] = [];
  const logs: string[] = [];
  let exited: number | null = null;
  const opts: SelfHealOptions = {
    here: TMP,
    optOut: false,
    spawn: async (cmd, cwd) => {
      calls.push({ cmd, cwd });
      return { code: 0 };
    },
    log: (m) => logs.push(m),
    exit: ((code: number) => {
      exited = code;
      throw new Error(`__exit:${code}`);
    }) as never,
    ...extra,
  };
  return { opts, calls, logs, getExited: () => exited };
}

function seedDist() {
  mkdirSync(join(TMP, 'dist'), { recursive: true });
  writeFileSync(join(TMP, 'dist', 'client.bundle.js'), '/* stub */');
}

function seedDeps() {
  mkdirSync(join(TMP, 'node_modules', 'react'), { recursive: true });
  writeFileSync(join(TMP, 'node_modules', 'react', 'package.json'), '{}');
}

describe('bootSelfHeal', () => {
  test('skips when dist + node_modules both present', async () => {
    seedDist();
    seedDeps();
    const { opts, calls } = harness();
    const result = await bootSelfHeal(opts);
    expect(result.skipped).toBe('all-present');
    expect(result.ran).toEqual([]);
    expect(calls).toEqual([]);
  });

  test('runs `bun install --production` when node_modules/react is missing', async () => {
    seedDist();
    const { opts, calls } = harness();
    const result = await bootSelfHeal(opts);
    expect(result.ran).toEqual(['install']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.cmd).toEqual(['bun', 'install', '--production']);
    expect(calls[0]?.cwd).toBe(TMP);
  });

  test('runs `bun run build.ts` when dist/client.bundle.js is missing', async () => {
    seedDeps();
    const { opts, calls } = harness();
    const result = await bootSelfHeal(opts);
    expect(result.ran).toEqual(['build']);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.cmd).toEqual(['bun', 'run', 'build.ts']);
  });

  test('runs install BEFORE build when both missing (build needs deps)', async () => {
    const { opts, calls } = harness();
    const result = await bootSelfHeal(opts);
    expect(result.ran).toEqual(['install', 'build']);
    expect(calls[0]?.cmd).toEqual(['bun', 'install', '--production']);
    expect(calls[1]?.cmd).toEqual(['bun', 'run', 'build.ts']);
  });

  test('MAUDE_NO_AUTOBUILD=1: exits 1 with remediation message; no spawn', async () => {
    const { opts, calls, logs, getExited } = harness({ optOut: true });
    await expect(bootSelfHeal(opts)).rejects.toThrow('__exit:1');
    expect(getExited()).toBe(1);
    expect(calls).toEqual([]);
    expect(logs.join('\n')).toMatch(/MAUDE_NO_AUTOBUILD=1/);
    expect(logs.join('\n')).toMatch(/dist\/client\.bundle\.js/);
    expect(logs.join('\n')).toMatch(/node_modules\/react/);
  });

  test('spawn failure aborts with exit 1 + remediation hint', async () => {
    seedDist(); // only deps missing
    const { opts, logs, getExited } = harness({
      spawn: async () => ({ code: 42 }),
    });
    await expect(bootSelfHeal(opts)).rejects.toThrow('__exit:1');
    expect(getExited()).toBe(1);
    expect(logs.join('\n')).toMatch(/exited 42/);
    expect(logs.join('\n')).toMatch(/MAUDE_NO_AUTOBUILD=1/);
  });
});
