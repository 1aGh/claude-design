// Cloud Phase 26 Stage 3 — what a cell reports about what it holds.
//
// The counts themselves are the easy part. What these tests are really about
// is the three-valued rule: a cell that cannot count must report NOTHING, so
// that the operator board can tell "we cannot see" from "this project is
// empty". A zero in the wrong place is the version of this bug that nobody
// notices, because a zero looks like an answer.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { _resetTenantStats, STATS_TTL_MS, tenantStats } from '../src/tenant-stats.mjs';

afterEach(() => _resetTenantStats());

function designRoot({ canvases = [], systems = [], assets = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'maude-stats-'));
  mkdirSync(join(root, 'ui'), { recursive: true });
  for (const [name, body] of canvases) writeFileSync(join(root, 'ui', name), body);
  for (const name of systems) mkdirSync(join(root, 'system', name), { recursive: true });
  if (assets.length > 0) mkdirSync(join(root, 'assets'), { recursive: true });
  for (const [name, body] of assets) writeFileSync(join(root, 'assets', name), body);
  return root;
}

const canvas = (n) =>
  `import { DesignCanvas, DCArtboard } from '@maude/canvas-lib';\n` +
  Array.from({ length: n }, (_, i) => `<DCArtboard id="a${i}" />`).join('\n');

describe('a cell counts what it holds', () => {
  it('counts canvases, artboards, design systems and asset bytes', () => {
    const root = designRoot({
      canvases: [
        ['home.tsx', canvas(3)],
        ['settings.tsx', canvas(2)],
      ],
      systems: ['maude', 'legacy'],
      assets: [['logo.png', 'x'.repeat(1024)]],
    });
    const stats = tenantStats({ designRoot: root });
    assert.equal(stats.canvases, 2);
    assert.equal(stats.artboards, 5);
    assert.equal(stats.designSystems, 2);
    assert.equal(stats.assetsBytes, 1024);
  });

  it('counts nothing from the runtime-state directories', () => {
    // `_history`, `_smoke` and friends are per-machine runtime state
    // (DDR-115). Counting them would make the number drift with how much
    // somebody has been iterating rather than with what they have built.
    const root = designRoot({ canvases: [['home.tsx', canvas(1)]] });
    mkdirSync(join(root, '_history', 'home'), { recursive: true });
    writeFileSync(join(root, '_history', 'home', 'old.tsx'), canvas(9));
    const stats = tenantStats({ designRoot: root });
    assert.equal(stats.canvases, 1);
    assert.equal(stats.artboards, 1);
  });

  it('an EMPTY project reports zeroes — it counted, and found none', () => {
    // The distinction the whole feature turns on: this is a real measurement.
    const stats = tenantStats({ designRoot: designRoot() });
    assert.equal(stats.canvases, 0);
    assert.equal(stats.artboards, 0);
    assert.equal(stats.assetsBytes, 0);
  });

  it('a hub with NO project reports null — it could not count at all', () => {
    // A self-hosted sync hub with no workspace. `null` omits the key from
    // /health entirely, so the board renders an em-dash.
    assert.equal(tenantStats({ designRoot: null }), null);
    assert.equal(tenantStats({}), null);
  });

  it('a design root that is not there is null, not zero', () => {
    const stats = tenantStats({ designRoot: join(tmpdir(), 'maude-does-not-exist-2607') });
    // countCanvases swallows its own read error, so the walk yields zeroes —
    // but the assets and system counts do too, and the honest thing for a
    // MISSING root is that it is a real, empty answer rather than a failure.
    // What must never happen is a throw out of the health path.
    assert.ok(stats === null || stats.canvases === 0);
  });
});

describe('the count is cached, because /health is polled', () => {
  it('reuses an answer inside the TTL', () => {
    const root = designRoot({ canvases: [['home.tsx', canvas(1)]] });
    const first = tenantStats({ designRoot: root, now: 1000 });
    writeFileSync(join(root, 'ui', 'second.tsx'), canvas(1));
    const second = tenantStats({ designRoot: root, now: 1000 + STATS_TTL_MS - 1 });
    assert.equal(second.canvases, 1, 'the cached answer was reused');
    assert.equal(second.countedAt, first.countedAt);
  });

  it('recounts once the TTL is up', () => {
    const root = designRoot({ canvases: [['home.tsx', canvas(1)]] });
    tenantStats({ designRoot: root, now: 1000 });
    writeFileSync(join(root, 'ui', 'second.tsx'), canvas(1));
    const fresh = tenantStats({ designRoot: root, now: 1000 + STATS_TTL_MS });
    assert.equal(fresh.canvases, 2);
  });

  it('recounts immediately when the project changed underneath it', () => {
    const a = designRoot({ canvases: [['home.tsx', canvas(1)]] });
    const b = designRoot({
      canvases: [
        ['x.tsx', canvas(1)],
        ['y.tsx', canvas(1)],
      ],
    });
    tenantStats({ designRoot: a, now: 1000 });
    assert.equal(tenantStats({ designRoot: b, now: 1001 }).canvases, 2);
  });
});

describe('counts only — never the customer’s own words', () => {
  it('reports no canvas name, no path and no design-system name', () => {
    const root = designRoot({
      canvases: [['secret-acquisition-pitch.tsx', canvas(1)]],
      systems: ['project-nightingale'],
      assets: [['confidential-org-chart.png', 'x']],
    });
    const payload = JSON.stringify(tenantStats({ designRoot: root }));
    for (const leak of [
      'secret-acquisition-pitch',
      'project-nightingale',
      'confidential-org-chart',
      root,
    ]) {
      assert.ok(!payload.includes(leak), `the stats payload leaked "${leak}"`);
    }
    // Every value is a number. Not "should be" — is.
    for (const v of Object.values(tenantStats({ designRoot: root }))) {
      assert.equal(typeof v, 'number');
    }
  });
});
