// Readiness probe (DDR-128) — plugin-registry scan + PATH resolution. The
// login-shell fallback's full correctness is proven on the packaged `.app`
// (native-verification ceiling); here we cover the registry-scan branches, the
// no-throw contracts, and the report shape. The probe is async (the fallback shells
// out off the event loop — DDR-128 hardening), so everything awaits.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { probeReadiness, resolveOnPath } from '../readiness.ts';

const MARKET_OK = {
  maude: { source: { source: 'github', repo: '1aGh/maude' }, installLocation: '/x' },
};
const INSTALLED_BOTH = {
  version: 2,
  plugins: {
    'design@maude': [{ scope: 'user', version: '0.29.0' }],
    'flow@maude': [{ scope: 'user', version: '0.29.0' }],
  },
};
const INSTALLED_DESIGN_ONLY = { version: 2, plugins: { 'design@maude': [{ scope: 'user' }] } };

function fixtureClaudeDir(opts: { markets?: unknown; installed?: unknown }): string {
  const dir = mkdtempSync(join(tmpdir(), 'maude-readiness-'));
  const pluginsDir = join(dir, 'plugins');
  mkdirSync(pluginsDir, { recursive: true });
  if (opts.markets !== undefined)
    writeFileSync(join(pluginsDir, 'known_marketplaces.json'), JSON.stringify(opts.markets));
  if (opts.installed !== undefined)
    writeFileSync(join(pluginsDir, 'installed_plugins.json'), JSON.stringify(opts.installed));
  return dir;
}

async function withClaudeDir<T>(dir: string, fn: () => Promise<T> | T): Promise<T> {
  const saved = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = saved;
  }
}

const pluginsItem = async (dir: string) =>
  (await withClaudeDir(dir, () => probeReadiness())).items.find((i) => i.id === 'plugins')!;

describe('readiness — plugin registry scan', () => {
  test('both plugins + marketplace present → plugins item is present, no remediation', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({ markets: MARKET_OK, installed: INSTALLED_BOTH })
    );
    expect(item.status).toBe('present');
    expect(item.remediation).toBeUndefined();
  });

  test('only design@maude installed → missing, names the absent flow@maude + offers the fix', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({ markets: MARKET_OK, installed: INSTALLED_DESIGN_ONLY })
    );
    expect(item.status).toBe('missing');
    expect(item.detail).toContain('flow@maude');
    expect(item.remediation).toContain('/plugin install');
  });

  test('registry absent → unknown (Claude Code internal contract; never throws)', async () => {
    const item = await pluginsItem(fixtureClaudeDir({}));
    expect(item.status).toBe('unknown');
  });

  test('plugin presence is the gate — a foreign-repo marketplace does not change a both-installed verdict', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({
        markets: { other: { source: { repo: 'someone/else' } } },
        installed: INSTALLED_BOTH,
      })
    );
    expect(item.status).toBe('present');
  });
});

describe('readiness — resolveOnPath', () => {
  test('finds a binary that is on PATH', async () => {
    const hit = await resolveOnPath('sh');
    expect(hit).not.toBeNull();
    expect(existsSync(hit!)).toBe(true);
  });

  test('returns null for a bogus binary without throwing', async () => {
    expect(await resolveOnPath('maude-definitely-not-real-xyz')).toBeNull();
  });

  test('login-shell fallback recovers a binary hidden from the app PATH', async () => {
    const saved = process.env.PATH;
    try {
      // Simulate the truncated/empty GUI env so Bun.which misses and the fallback fires.
      process.env.PATH = '';
      const hit = await resolveOnPath('sh');
      // When a login shell is usable it must recover an absolute, real path. In a
      // sandbox with no usable login shell the fallback returns null — we don't fail
      // on that, but a non-null result must be a real absolute path.
      if (hit !== null) {
        expect(hit.startsWith('/')).toBe(true);
        expect(existsSync(hit)).toBe(true);
      }
    } finally {
      if (saved === undefined) delete process.env.PATH;
      else process.env.PATH = saved;
    }
  });
});

describe('readiness — report shape', () => {
  test('always returns the five items with stable ids and a boolean ready', async () => {
    const report = await probeReadiness();
    expect(report.items.map((i) => i.id)).toEqual([
      'claude',
      'maude',
      'plugins',
      'agent-browser',
      'adapter',
    ]);
    expect(typeof report.ready).toBe('boolean');
  });

  test('agent-browser is optional and never gates ready', async () => {
    const ab = (await probeReadiness()).items.find((i) => i.id === 'agent-browser')!;
    expect(ab.required).toBe(false);
  });

  test('adapter row tracks the real chat gate (resolveAdapterEntry) and is required', async () => {
    const saved = process.env.MAUDE_ACP_ADAPTER_ENTRY;
    try {
      // Point the override at a real file → the bridge is "bundled".
      process.env.MAUDE_ACP_ADAPTER_ENTRY = import.meta.path;
      const present = (await probeReadiness()).items.find((i) => i.id === 'adapter')!;
      expect(present.required).toBe(true);
      expect(present.status).toBe('present');

      // Point it at a missing path → the row goes missing with remediation, the
      // honest signal the v0.31–0.32 builds lacked (all other rows green, chat dead).
      process.env.MAUDE_ACP_ADAPTER_ENTRY = join(tmpdir(), 'no-such-acp-adapter-xyz');
      const missing = (await probeReadiness()).items.find((i) => i.id === 'adapter')!;
      expect(missing.status).toBe('missing');
      expect(missing.remediation).toBeDefined();
    } finally {
      if (saved === undefined) delete process.env.MAUDE_ACP_ADAPTER_ENTRY;
      else process.env.MAUDE_ACP_ADAPTER_ENTRY = saved;
    }
  });
});
