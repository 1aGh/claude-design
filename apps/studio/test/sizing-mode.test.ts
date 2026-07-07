// sizing-mode.ts — Stage M1 (feature-element-editing-robustness). The pure
// Fixed / Hug / Fill mode classification + the deterministic CSS patch it writes,
// including the context-aware Fill (flex main axis → flex-grow, cross axis →
// align-self, block/grid → 100%).

import { describe, expect, test } from 'bun:test';

import { isMainAxis, sizingModeOf, sizingModePatch } from '../sizing-mode.ts';

const flexRow = { display: 'flex', flexDirection: 'row' };
const flexCol = { display: 'flex', flexDirection: 'column' };
const block = { display: 'block' };

describe('sizing-mode / isMainAxis', () => {
  test('row parent → width is main, height is cross', () => {
    expect(isMainAxis('width', flexRow)).toBe(true);
    expect(isMainAxis('height', flexRow)).toBe(false);
  });
  test('column parent → height is main, width is cross', () => {
    expect(isMainAxis('height', flexCol)).toBe(true);
    expect(isMainAxis('width', flexCol)).toBe(false);
  });
  test('missing direction defaults to row', () => {
    expect(isMainAxis('width', { display: 'flex' })).toBe(true);
  });
});

describe('sizing-mode / sizingModeOf', () => {
  test('numeric authored value → fixed', () => {
    expect(sizingModeOf('width', { width: '200px' })).toBe('fixed');
  });
  test('fit-content → hug', () => {
    expect(sizingModeOf('width', { width: 'fit-content' })).toBe('hug');
  });
  test('100% → fill', () => {
    expect(sizingModeOf('width', { width: '100%' })).toBe('fill');
  });
  test('flex-grow ≥ 1 on the main axis → fill', () => {
    expect(sizingModeOf('width', { 'flex-grow': '1' }, {}, flexRow)).toBe('fill');
  });
  test('flex-grow on the cross axis is NOT fill (grow is a main-axis property)', () => {
    expect(sizingModeOf('height', { 'flex-grow': '1' }, {}, flexRow)).toBe('fixed');
  });
  test('align-self stretch on the cross axis → fill', () => {
    expect(sizingModeOf('height', { 'align-self': 'stretch' }, {}, flexRow)).toBe('fill');
  });
  test('nothing authored → fixed default', () => {
    expect(sizingModeOf('width', {}, { width: '640px' })).toBe('fixed');
  });
});

describe('sizing-mode / sizingModePatch', () => {
  test('fixed writes an explicit px from the current rendered size', () => {
    const p = sizingModePatch('width', 'fixed', block, 321.6);
    expect(p.set).toEqual([['width', '322px']]);
    expect(p.reset).toEqual([]);
  });

  test('hug writes fit-content', () => {
    const p = sizingModePatch('height', 'hug', block, 100);
    expect(p.set).toEqual([['height', 'fit-content']]);
  });

  test('fill on a block child writes 100%', () => {
    const p = sizingModePatch('width', 'fill', block, 100);
    expect(p.set).toEqual([['width', '100%']]);
  });

  test('fill on a flex MAIN axis uses flex-grow + basis, releases the dimension', () => {
    const p = sizingModePatch('width', 'fill', flexRow, 100);
    expect(p.set).toEqual([
      ['flex-grow', '1'],
      ['flex-basis', '0%'],
      ['width', 'auto'],
    ]);
  });

  test('fill on a flex CROSS axis uses align-self: stretch', () => {
    const p = sizingModePatch('height', 'fill', flexRow, 100);
    expect(p.set).toEqual([
      ['align-self', 'stretch'],
      ['height', 'auto'],
    ]);
  });

  test('switching a flex-main child back to fixed clears the fill props', () => {
    const p = sizingModePatch('width', 'fixed', flexRow, 240);
    expect(p.set).toEqual([['width', '240px']]);
    expect(p.reset).toEqual(['flex-grow', 'flex-basis']);
  });

  test('switching a flex-cross child to hug clears align-self', () => {
    const p = sizingModePatch('height', 'hug', flexRow, 240);
    expect(p.set).toEqual([['height', 'fit-content']]);
    expect(p.reset).toEqual(['align-self']);
  });

  test('non-positive / non-finite currentPx clamps to 0px for fixed', () => {
    expect(sizingModePatch('width', 'fixed', block, 0).set).toEqual([['width', '0px']]);
    expect(sizingModePatch('width', 'fixed', block, Number.NaN).set).toEqual([['width', '0px']]);
  });
});
