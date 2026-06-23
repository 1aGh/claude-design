// DDR-115 follow-up — Changes-panel canvas grouping (GitPanel variant A).
// Verifies the pure grouping helpers: a canvas unifies with its same-stem
// `.meta.json` + its slug-named `.annotations.svg`; loose / orphan files become
// standalone "other" units; sort + slug-matching (spaces, subdirs) are correct.

import { describe, expect, test } from 'bun:test';

import { baseName, buildUnits, canvasSlug, supportLabel } from '../client/panels/git-grouping.js';

const F = (path: string, status = 'modified') => ({ path, status });

describe('GitPanel canvas grouping (buildUnits)', () => {
  test('unifies a canvas with its same-stem meta and slug-matched annotation', () => {
    const files = [
      F('.design/ui/Pricing.tsx'),
      F('.design/ui/Pricing.meta.json'),
      F('.design/ui-pricing.annotations.svg'),
    ];
    const { canvasUnits, otherUnits } = buildUnits(files, '.design');
    expect(canvasUnits.length).toBe(1);
    expect(otherUnits.length).toBe(0);
    const u = canvasUnits[0];
    expect(u.primary.path).toBe('.design/ui/Pricing.tsx');
    expect(u.supporting.map((s) => s.path).sort()).toEqual([
      '.design/ui-pricing.annotations.svg',
      '.design/ui/Pricing.meta.json',
    ]);
  });

  test('canvas with spaces + subdir matches its annotation slug', () => {
    // fileSlug('.design/ui/Sync Hub Admin.tsx') => 'ui-sync_hub_admin'
    expect(canvasSlug('.design/ui/Sync Hub Admin.tsx', '.design')).toBe('ui-sync_hub_admin');
    const files = [
      F('.design/ui/Sync Hub Admin.tsx'),
      F('.design/ui-sync_hub_admin.annotations.svg'),
    ];
    const { canvasUnits } = buildUnits(files, '.design');
    expect(canvasUnits.length).toBe(1);
    expect(canvasUnits[0].supporting.map((s) => s.path)).toEqual([
      '.design/ui-sync_hub_admin.annotations.svg',
    ]);
  });

  test('a meta with no canvas in the changeset is a standalone other unit', () => {
    const { canvasUnits, otherUnits } = buildUnits([F('.design/ui/Orphan.meta.json')], '.design');
    expect(canvasUnits.length).toBe(0);
    expect(otherUnits.length).toBe(1);
    expect(otherUnits[0].primary.path).toBe('.design/ui/Orphan.meta.json');
    expect(otherUnits[0].supporting.length).toBe(0);
  });

  test('an annotation with no canvas in the changeset is a standalone other unit', () => {
    const { canvasUnits, otherUnits } = buildUnits(
      [F('.design/ui-ghost.annotations.svg')],
      '.design'
    );
    expect(canvasUnits.length).toBe(0);
    expect(otherUnits).toHaveLength(1);
    expect(otherUnits[0].primary.path).toBe('.design/ui-ghost.annotations.svg');
  });

  test('loose files (config, DS tokens) are other units, never grouped under a canvas', () => {
    const files = [
      F('.design/ui/Pricing.tsx'),
      F('.design/config.json'),
      F('.design/system/project/tokens.css'),
    ];
    const { canvasUnits, otherUnits } = buildUnits(files, '.design');
    expect(canvasUnits.map((u) => u.primary.path)).toEqual(['.design/ui/Pricing.tsx']);
    expect(canvasUnits[0].supporting.length).toBe(0);
    expect(otherUnits.map((u) => u.primary.path).sort()).toEqual([
      '.design/config.json',
      '.design/system/project/tokens.css',
    ]);
  });

  test('multiple canvases are sorted by display name; each keeps its own sidecars', () => {
    const files = [
      F('.design/ui/Zebra.tsx'),
      F('.design/ui/Zebra.meta.json'),
      F('.design/ui/Alpha.tsx'),
      F('.design/ui/Alpha.meta.json'),
    ];
    const { canvasUnits } = buildUnits(files, '.design');
    expect(canvasUnits.map((u) => baseName(u.primary.path))).toEqual(['Alpha', 'Zebra']);
    expect(canvasUnits[0].supporting.map((s) => s.path)).toEqual(['.design/ui/Alpha.meta.json']);
    expect(canvasUnits[1].supporting.map((s) => s.path)).toEqual(['.design/ui/Zebra.meta.json']);
  });

  test('a meta does NOT cross-attach to a different-stem canvas (Pricing vs Pricing v3)', () => {
    const files = [
      F('.design/ui/Pricing.tsx'),
      F('.design/ui/Pricing v3.meta.json'), // belongs to a (clean, absent) "Pricing v3" canvas
    ];
    const { canvasUnits, otherUnits } = buildUnits(files, '.design');
    expect(canvasUnits[0].supporting.length).toBe(0); // not grabbed by "Pricing"
    expect(otherUnits.map((u) => u.primary.path)).toEqual(['.design/ui/Pricing v3.meta.json']);
  });

  test('supportLabel + baseName render friendly names', () => {
    expect(supportLabel('.design/ui/Pricing.meta.json')).toBe('Layout & settings');
    expect(supportLabel('.design/ui-pricing.annotations.svg')).toBe('Annotations');
    expect(baseName('.design/ui/Sync Hub Admin.tsx')).toBe('Sync Hub Admin');
    expect(baseName('.design/ui-pricing.annotations.svg')).toBe('ui-pricing');
  });
});
