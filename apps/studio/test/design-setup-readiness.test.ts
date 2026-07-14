// Design-setup readiness probe (DDR-166 plan, Phase 2 / T6). A pure function
// over a Context-shaped fixture — no server boot needed, `probeSetupReadiness`
// only touches `ctx.cfg` + `ctx.paths` (both destructured, so a minimal fake
// satisfies the type).

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Context, DevServerConfig } from '../context.ts';
import { probeSetupReadiness } from '../design-setup-readiness.ts';

function fixtureCtx(opts: {
  hasConfig?: boolean;
  designSystems?: DevServerConfig['designSystems'];
  canvasGroups?: DevServerConfig['canvasGroups'];
  seedCanvas?: boolean;
  seedTokens?: string[]; // ds names to write a real colors_and_type.css for
  seedLogo?: string[]; // ds names to write a preview/logo.svg for
}): Context {
  const root = mkdtempSync(join(tmpdir(), 'maude-setup-readiness-'));
  const designRoot = join(root, '.design');
  mkdirSync(designRoot, { recursive: true });

  const designSystems = opts.designSystems ?? [];
  const canvasGroups = opts.canvasGroups ?? [
    { label: 'Design system', path: 'system' },
    { label: 'UI kit', path: 'ui' },
  ];

  for (const ds of designSystems) {
    mkdirSync(join(designRoot, ds.path), { recursive: true });
    if (opts.seedTokens?.includes(ds.name)) {
      writeFileSync(join(designRoot, ds.path, 'colors_and_type.css'), ':root{}');
    }
    if (opts.seedLogo?.includes(ds.name)) {
      mkdirSync(join(designRoot, ds.path, 'preview'), { recursive: true });
      writeFileSync(join(designRoot, ds.path, 'preview', 'logo.svg'), '<svg/>');
    }
  }
  if (opts.seedCanvas) {
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(
      join(designRoot, 'ui', 'Welcome.tsx'),
      'export default function W(){return <main/>}\n'
    );
  }

  const cfg: DevServerConfig = {
    name: 'test',
    projectLabel: null,
    designRoot: '.design',
    canvasGroups,
    designSystems,
    rootClass: 'app',
    themeDefault: 'dark',
    tokensCssRel: 'system/colors_and_type.css',
    teamAccentDefault: null,
    handoffTargets: [],
    newCanvasDir: 'ui',
    newComponentDir: 'ui/components',
    _source: opts.hasConfig === false ? 'defaults' : '.design/config.json',
  };

  return {
    cfg,
    projectLabel: 'test',
    paths: {
      repoRoot: root,
      designRel: '.design',
      designRoot,
      serverInfoFile: join(designRoot, '_server.json'),
      activeFile: join(designRoot, '_active.json'),
      commentsDir: join(designRoot, '_comments'),
      canvasStateDir: join(designRoot, '_canvas-state'),
      historyDir: join(designRoot, '_history'),
      tokensUrlRel: 'system/colors_and_type.css',
      systemDirRel: 'system',
    },
    bus: { on: () => () => {}, emit: () => {} },
  } as Context;
}

describe('probeSetupReadiness', () => {
  test('bare write_minimal_design scaffold: config missing, everything else missing too', async () => {
    const report = await probeSetupReadiness(fixtureCtx({ hasConfig: false }));
    expect(report.ready).toBe(false);
    const byId = Object.fromEntries(report.items.map((i) => [i.id, i.status]));
    expect(byId).toEqual({
      project: 'missing',
      'design-system': 'missing',
      'first-canvas': 'missing',
      'brand-assets': 'missing',
    });
  });

  test('real config, no DS, no canvas: project present, rest missing', async () => {
    const report = await probeSetupReadiness(fixtureCtx({ hasConfig: true }));
    const byId = Object.fromEntries(report.items.map((i) => [i.id, i.status]));
    expect(byId.project).toBe('present');
    expect(byId['design-system']).toBe('missing');
    expect(byId['first-canvas']).toBe('missing');
    expect(byId['brand-assets']).toBe('missing');
    expect(report.ready).toBe(false);
  });

  test('DS declared but tokens file absent: still missing (declared != on-disk)', async () => {
    const report = await probeSetupReadiness(
      fixtureCtx({
        hasConfig: true,
        designSystems: [
          { name: 'acme', path: 'system/acme', tokensCssRel: 'system/acme/colors_and_type.css' },
        ],
      })
    );
    const item = report.items.find((i) => i.id === 'design-system')!;
    expect(item.status).toBe('missing');
    expect(item.detail).toContain('Declared in config');
  });

  test('all four present → ready: true', async () => {
    const report = await probeSetupReadiness(
      fixtureCtx({
        hasConfig: true,
        designSystems: [
          { name: 'acme', path: 'system/acme', tokensCssRel: 'system/acme/colors_and_type.css' },
        ],
        seedTokens: ['acme'],
        seedLogo: ['acme'],
        seedCanvas: true,
      })
    );
    expect(report.items.every((i) => i.status === 'present')).toBe(true);
    expect(report.ready).toBe(true);
  });

  test('a "system" canvas group never counts as the first user canvas', async () => {
    const root = mkdtempSync(join(tmpdir(), 'maude-setup-readiness-'));
    const designRoot = join(root, '.design');
    const canvasGroups = [{ label: 'Design system', path: 'system' }];
    mkdirSync(join(designRoot, 'system'), { recursive: true });
    writeFileSync(
      join(designRoot, 'system', 'specimen.tsx'),
      'export default function S(){return <main/>}\n'
    );
    const ctx = fixtureCtx({ hasConfig: true, canvasGroups });
    // Overwrite paths.designRoot/repoRoot to point at this second fixture dir
    // (fixtureCtx already made its own scratch dir we don't need here).
    ctx.paths.repoRoot = root;
    ctx.paths.designRoot = designRoot;
    const report = await probeSetupReadiness(ctx);
    expect(report.items.find((i) => i.id === 'first-canvas')!.status).toBe('missing');
  });
});
