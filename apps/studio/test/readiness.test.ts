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
// `/flow` is no longer part of the chat (2026-07-03) — the gate tracks `design`
// alone, so a registry with flow-but-not-design is the "design missing" case.
const INSTALLED_FLOW_ONLY = { version: 2, plugins: { 'flow@maude': [{ scope: 'user' }] } };

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

/** Plugins row under the given ~/.claude fixture. `nativeBootstrap:false` sets
 *  MAUDE_NO_PLUGIN_BOOTSTRAP to force the web / manual (DDR-128) path — needed to
 *  isolate the registry scan, since this suite runs in the dev tree where the
 *  bundled plugin dirs resolve and DDR-143 auto-load would otherwise mask it. */
const pluginsItem = async (dir: string, opts: { nativeBootstrap?: boolean } = {}) => {
  const savedOptOut = process.env.MAUDE_NO_PLUGIN_BOOTSTRAP;
  if (opts.nativeBootstrap === false) process.env.MAUDE_NO_PLUGIN_BOOTSTRAP = '1';
  try {
    return (await withClaudeDir(dir, () => probeReadiness())).items.find(
      (i) => i.id === 'plugins'
    )!;
  } finally {
    if (savedOptOut === undefined) delete process.env.MAUDE_NO_PLUGIN_BOOTSTRAP;
    else process.env.MAUDE_NO_PLUGIN_BOOTSTRAP = savedOptOut;
  }
};

// Registry-scan branches under the WEB / manual path (auto-bootstrap opted out) —
// the pure DDR-128 detect-and-guide behavior, still what a `maude design serve`
// user sees.
describe('readiness — plugin registry scan (web / manual path)', () => {
  test('design@maude + marketplace present → plugins item is present, no remediation', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({ markets: MARKET_OK, installed: INSTALLED_DESIGN_ONLY }),
      { nativeBootstrap: false }
    );
    expect(item.status).toBe('present');
    expect(item.remediation).toBeUndefined();
  });

  test('design@maude NOT installed → missing, names the absent design@maude + offers the fix', async () => {
    // flow-only registry: `/flow` is irrelevant to the chat now, so this reads as
    // "design missing" — the gate tracks design alone.
    const item = await pluginsItem(
      fixtureClaudeDir({ markets: MARKET_OK, installed: INSTALLED_FLOW_ONLY }),
      { nativeBootstrap: false }
    );
    expect(item.status).toBe('missing');
    expect(item.detail).toContain('design@maude');
    expect(item.remediation).toContain('/plugin install');
  });

  test('registry absent → unknown (Claude Code internal contract; never throws)', async () => {
    const item = await pluginsItem(fixtureClaudeDir({}), { nativeBootstrap: false });
    expect(item.status).toBe('unknown');
  });

  test('plugin presence is the gate — a foreign-repo marketplace does not change a design-installed verdict', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({
        markets: { other: { source: { repo: 'someone/else' } } },
        installed: INSTALLED_BOTH,
      }),
      { nativeBootstrap: false }
    );
    expect(item.status).toBe('present');
  });
});

// DDR-143 / DDR-168 — on the native/desktop path the ACP session ALWAYS loads
// the bundled plugins, so the row is satisfied even against a pristine
// registry, AND even when a marketplace copy is also installed at the user
// level (DDR-168 removed the old scan-gated no-op — the bundled copy wins
// regardless of disk state). This suite runs in the dev tree, so the bundled
// plugin dirs resolve → native context is on by default (no opt-out).
describe('readiness — plugin auto-bootstrap (native, DDR-143/DDR-168)', () => {
  test('pristine registry → present + "Bundled with this app" detail, no manual remediation', async () => {
    const item = await pluginsItem(fixtureClaudeDir({}));
    expect(item.status).toBe('present');
    expect(item.detail).toContain('Bundled with this app');
    expect(item.remediation).toBeUndefined();
  });

  test('design NOT installed (flow-only registry) → still present (design is bundled, no red wall)', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({ markets: MARKET_OK, installed: INSTALLED_FLOW_ONLY })
    );
    expect(item.status).toBe('present');
    expect(item.detail).toContain('Bundled with this app');
    expect(item.remediation).toBeUndefined();
  });

  test('design ALSO installed on disk → present, STILL reads as bundled (DDR-168 — no more "is installed" framing)', async () => {
    const item = await pluginsItem(
      fixtureClaudeDir({ markets: MARKET_OK, installed: INSTALLED_DESIGN_ONLY })
    );
    expect(item.status).toBe('present');
    expect(item.detail).toContain('Bundled with this app');
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

  test('screenshot engine: required + present (bundled) on native → never blocks ready', async () => {
    // Native (this dev tree): agent-browser is bundled, so the row is first-class
    // (required) but PRESENT — it can't turn `ready` false.
    const ab = (await probeReadiness()).items.find((i) => i.id === 'agent-browser')!;
    expect(ab.required).toBe(true);
    expect(ab.status).toBe('present');
  });

  test('screenshot engine: optional on the web/opt-out path', async () => {
    const saved = process.env.MAUDE_NO_PLUGIN_BOOTSTRAP;
    process.env.MAUDE_NO_PLUGIN_BOOTSTRAP = '1'; // force native=false
    try {
      const ab = (await probeReadiness()).items.find((i) => i.id === 'agent-browser')!;
      expect(ab.required).toBe(false);
    } finally {
      if (saved === undefined) delete process.env.MAUDE_NO_PLUGIN_BOOTSTRAP;
      else process.env.MAUDE_NO_PLUGIN_BOOTSTRAP = saved;
    }
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
