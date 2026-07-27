// ACP session-scoped plugin auto-bootstrap resolver (DDR-143; unconditional
// injection DDR-168).
//
// The pure gate logic — native/bundle context and per-plugin bundled-dir
// presence — all exercised without touching disk or ~/.claude. Since DDR-168,
// there is no longer a `scan`-gated no-op: a bundled plugin injects regardless
// of whether it's ALSO installed on disk (the double-registration risk that
// used to gate this is now closed structurally in bridge.ts instead — see
// acp-session-plugins.test.ts). The wire-level presence test (that the
// resolved configs actually land on `_meta.claudeCode.options.plugins`) lives
// in acp-session-plugins.test.ts.

import { describe, expect, test } from 'bun:test';

import { computeSessionPlugins } from '../acp/plugin-bootstrap.ts';

const DESIGN = '/bundle/plugins/design';
const FLOW = '/bundle/plugins/flow';
const KGAI = '/bundle/plugins/kgai';

describe('computeSessionPlugins — gates', () => {
  // `/flow` auto-load is intentionally OFF for now (2026-07-03) — only `design`
  // is ever injected, even when the flow dir resolves.
  test('native, both bundled ⇒ inject design only (flow disabled)', () => {
    const out = computeSessionPlugins({ native: true, designDir: DESIGN, flowDir: FLOW });
    expect(out).toEqual([{ type: 'local', path: DESIGN, skipMcpDiscovery: true }]);
  });

  // DDR-168 — no more no-op gate: injection no longer depends on disk state.
  // The double-registration risk this used to guard against is now closed
  // structurally via bridge.ts's `options.settings.enabledPlugins` override.
  test('design already installed on disk ⇒ STILL injects (no more scan-gated no-op)', () => {
    const out = computeSessionPlugins({ native: true, designDir: DESIGN, flowDir: FLOW });
    expect(out).toEqual([{ type: 'local', path: DESIGN, skipMcpDiscovery: true }]);
  });

  test('native-only gate: not native (web serve) ⇒ inject nothing even if dirs resolve', () => {
    const out = computeSessionPlugins({ native: false, designDir: DESIGN, flowDir: FLOW });
    expect(out).toEqual([]);
  });

  test('path-missing gate: design dir null ⇒ inject nothing (flow disabled, so no fallback)', () => {
    const out = computeSessionPlugins({ native: true, designDir: null, flowDir: FLOW });
    expect(out).toEqual([]);
  });

  test('web/npm layout: native false AND both dirs null ⇒ empty', () => {
    const out = computeSessionPlugins({ native: false, designDir: null, flowDir: null });
    expect(out).toEqual([]);
  });

  test('every injected config sets skipMcpDiscovery (SDK host owns MCP)', () => {
    const out = computeSessionPlugins({ native: true, designDir: DESIGN, flowDir: FLOW });
    expect(out.every((c) => c.skipMcpDiscovery === true && c.type === 'local')).toBe(true);
  });

  // feature-kgai-ecosystem-integration Phase 8 — the third-party kgai plugin
  // carries the `Stop` hook that IS autonomous decision capture. Without
  // injection the packaged app records nothing (settingSources:['user'], and a
  // terminal-less DDR-177 user never marketplace-installs it).
  test('kgai bundled ⇒ injected alongside design (autonomous capture in the .app)', () => {
    const out = computeSessionPlugins({
      native: true,
      designDir: DESIGN,
      flowDir: FLOW,
      kgaiDir: KGAI,
    });
    expect(out).toEqual([
      { type: 'local', path: DESIGN, skipMcpDiscovery: true },
      { type: 'local', path: KGAI, skipMcpDiscovery: true },
    ]);
  });

  test('kgai absent (dev tree / npm layout) ⇒ design only, no crash', () => {
    expect(
      computeSessionPlugins({ native: true, designDir: DESIGN, flowDir: FLOW, kgaiDir: null })
    ).toEqual([{ type: 'local', path: DESIGN, skipMcpDiscovery: true }]);
    // omitted entirely (optional field) behaves the same
    expect(computeSessionPlugins({ native: true, designDir: DESIGN, flowDir: FLOW })).toEqual([
      { type: 'local', path: DESIGN, skipMcpDiscovery: true },
    ]);
  });

  test('not native ⇒ kgai is NOT injected either (web-serve gate holds)', () => {
    expect(
      computeSessionPlugins({ native: false, designDir: DESIGN, flowDir: FLOW, kgaiDir: KGAI })
    ).toEqual([]);
  });
});
