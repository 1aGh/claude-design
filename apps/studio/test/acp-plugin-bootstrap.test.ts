// ACP session-scoped plugin auto-bootstrap resolver (DDR-143).
//
// The pure gate logic — native/bundle context, per-plugin bundled-dir presence,
// and the no-op-for-power-users registry gate — all exercised without touching
// disk or ~/.claude. The wire-level presence test (that the resolved configs
// actually land on `_meta.claudeCode.options.plugins`) lives in
// acp-session-plugins.test.ts.

import { describe, expect, test } from 'bun:test';

import { computeSessionPlugins } from '../acp/plugin-bootstrap.ts';

const DESIGN = '/bundle/plugins/design';
const FLOW = '/bundle/plugins/flow';
const NEITHER_INSTALLED = { design: false, flow: false };

describe('computeSessionPlugins — gates', () => {
  test('neither installed, native, both bundled ⇒ inject BOTH', () => {
    const out = computeSessionPlugins({
      native: true,
      designDir: DESIGN,
      flowDir: FLOW,
      scan: NEITHER_INSTALLED,
    });
    expect(out).toEqual([
      { type: 'local', path: DESIGN, skipMcpDiscovery: true },
      { type: 'local', path: FLOW, skipMcpDiscovery: true },
    ]);
  });

  test('no-op gate: design already installed ⇒ skip design, keep flow', () => {
    const out = computeSessionPlugins({
      native: true,
      designDir: DESIGN,
      flowDir: FLOW,
      scan: { design: true, flow: false },
    });
    expect(out).toEqual([{ type: 'local', path: FLOW, skipMcpDiscovery: true }]);
  });

  test('no-op gate: BOTH already installed (power user) ⇒ inject nothing', () => {
    const out = computeSessionPlugins({
      native: true,
      designDir: DESIGN,
      flowDir: FLOW,
      scan: { design: true, flow: true },
    });
    expect(out).toEqual([]);
  });

  test('native-only gate: not native (web serve) ⇒ inject nothing even if dirs resolve', () => {
    const out = computeSessionPlugins({
      native: false,
      designDir: DESIGN,
      flowDir: FLOW,
      scan: NEITHER_INSTALLED,
    });
    expect(out).toEqual([]);
  });

  test('path-missing gate: design dir null (not bundled) ⇒ skip design, keep flow', () => {
    const out = computeSessionPlugins({
      native: true,
      designDir: null,
      flowDir: FLOW,
      scan: NEITHER_INSTALLED,
    });
    expect(out).toEqual([{ type: 'local', path: FLOW, skipMcpDiscovery: true }]);
  });

  test('web/npm layout: native false AND both dirs null ⇒ empty', () => {
    const out = computeSessionPlugins({
      native: false,
      designDir: null,
      flowDir: null,
      scan: NEITHER_INSTALLED,
    });
    expect(out).toEqual([]);
  });

  test('every injected config sets skipMcpDiscovery (SDK host owns MCP)', () => {
    const out = computeSessionPlugins({
      native: true,
      designDir: DESIGN,
      flowDir: FLOW,
      scan: NEITHER_INSTALLED,
    });
    expect(out.every((c) => c.skipMcpDiscovery === true && c.type === 'local')).toBe(true);
  });
});
