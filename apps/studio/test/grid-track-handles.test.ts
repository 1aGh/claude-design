// grid-track-handles.ts — feature-3-web-artboards T5 (absorbed
// feature-grid-track-editor stub). Pure geometry for the on-canvas grid
// gutter drag-resize overlay: track list parse/serialize (fr round-trip),
// gutter placement, and per-unit drag math.

import { describe, expect, test } from 'bun:test';

import {
  computeGutterLines,
  computeTrackDrag,
  type GridTrack,
  gutterTrackIndices,
  parseTrackList,
  serializeTrackList,
} from '../grid-track-handles.ts';

describe('grid-track-handles / parseTrackList', () => {
  test('parses numeric tracks with mixed units', () => {
    expect(parseTrackList('200px 1fr 50%')).toEqual([
      { value: 200, unit: 'px' },
      { value: 1, unit: 'fr' },
      { value: 50, unit: '%' },
    ]);
  });

  test('parses keyword tracks', () => {
    expect(parseTrackList('auto min-content max-content')).toEqual([
      { value: 0, unit: 'auto' },
      { value: 0, unit: 'min-content' },
      { value: 0, unit: 'max-content' },
    ]);
  });

  test('mixed numeric + keyword tracks', () => {
    expect(parseTrackList('120px auto 2fr')).toEqual([
      { value: 120, unit: 'px' },
      { value: 0, unit: 'auto' },
      { value: 2, unit: 'fr' },
    ]);
  });

  test('empty/whitespace-only string parses to []', () => {
    expect(parseTrackList('')).toEqual([]);
    expect(parseTrackList('   ')).toEqual([]);
    expect(parseTrackList(null)).toEqual([]);
    expect(parseTrackList(undefined)).toEqual([]);
  });

  test('unparseable tokens (repeat()/minmax()) bail to []', () => {
    expect(parseTrackList('repeat(3, 1fr)')).toEqual([]);
    expect(parseTrackList('minmax(100px, 1fr) 1fr')).toEqual([]);
  });

  test('a malformed multi-dot number (security-auditor correctness finding) bails to [] rather than NaN', () => {
    expect(parseTrackList('1.2.3px')).toEqual([]);
    expect(parseTrackList('200px 1.2.3fr')).toEqual([]);
  });
});

describe('grid-track-handles / serializeTrackList', () => {
  test('round-trips a mixed track list, including fr', () => {
    const tracks: GridTrack[] = [
      { value: 200, unit: 'px' },
      { value: 1, unit: 'fr' },
      { value: 2.5, unit: 'fr' },
    ];
    expect(serializeTrackList(tracks)).toBe('200px 1fr 2.5fr');
    expect(parseTrackList(serializeTrackList(tracks))).toEqual(tracks);
  });

  test('keyword tracks serialize without a unit suffix', () => {
    expect(
      serializeTrackList([
        { value: 0, unit: 'auto' },
        { value: 100, unit: 'px' },
      ])
    ).toBe('auto 100px');
  });
});

describe('grid-track-handles / computeGutterLines', () => {
  const RECT = { x: 100, y: 200, w: 300, h: 150 };

  test('fewer than 2 tracks → no gutters', () => {
    expect(computeGutterLines(RECT, [], 0, 'col')).toEqual([]);
    expect(computeGutterLines(RECT, [300], 0, 'col')).toEqual([]);
  });

  test('places gutters at cumulative track boundaries, column axis, no gap', () => {
    const lines = computeGutterLines(RECT, [100, 100, 100], 0, 'col');
    expect(lines).toEqual([
      { index: 0, axis: 'x', x: 200, y: 275 }, // rect.x + 100
      { index: 1, axis: 'x', x: 300, y: 275 }, // rect.x + 200
    ]);
  });

  test('accounts for gap when placing the gutter at the gap midpoint', () => {
    const lines = computeGutterLines(RECT, [100, 100], 20, 'col');
    // First track ends at x=200; gutter sits at the 20px gap's midpoint (210).
    expect(lines[0]).toEqual({ index: 0, axis: 'x', x: 210, y: 275 });
  });

  test('row axis places gutters vertically', () => {
    const lines = computeGutterLines(RECT, [50, 50], 0, 'row');
    expect(lines).toEqual([{ index: 0, axis: 'y', x: 250, y: 250 }]); // rect.y + 50
  });
});

describe('grid-track-handles / computeTrackDrag', () => {
  test('px is additive (1 world px = 1 unit), like padding drag', () => {
    expect(computeTrackDrag({ value: 100, unit: 'px' }, 100, 20, 0, 1, 'x')).toBe(120);
    expect(computeTrackDrag({ value: 100, unit: 'px' }, 100, -30, 0, 1, 'x')).toBe(70);
  });

  test('px clamps at 0', () => {
    expect(computeTrackDrag({ value: 10, unit: 'px' }, 10, -100, 0, 1, 'x')).toBe(0);
  });

  test('em uses the same additive math as px', () => {
    expect(computeTrackDrag({ value: 5, unit: 'em' }, 80, 16, 0, 1, 'x')).toBe(21);
  });

  test('fr scales proportionally from the resolved-px ratio', () => {
    // Track authored as 1fr currently resolves to 100px; dragging +50 screen
    // px targets 150px → ratio 1.5 → new fr = 1.5.
    expect(computeTrackDrag({ value: 1, unit: 'fr' }, 100, 50, 0, 1, 'x')).toBe(1.5);
  });

  test('fr floor prevents collapsing to zero share', () => {
    expect(computeTrackDrag({ value: 1, unit: 'fr' }, 100, -1000, 0, 1, 'x')).toBe(0.1);
  });

  test('percent scales proportionally with a 1% floor', () => {
    expect(computeTrackDrag({ value: 50, unit: '%' }, 150, 30, 0, 1, 'x')).toBe(60);
    expect(computeTrackDrag({ value: 50, unit: '%' }, 150, -1000, 0, 1, 'x')).toBe(1);
  });

  test('keyword units are returned unchanged (not draggable)', () => {
    expect(computeTrackDrag({ value: 0, unit: 'auto' }, 100, 50, 0, 1, 'x')).toBe(0);
  });

  test('divides screen delta by zoom (world units)', () => {
    expect(computeTrackDrag({ value: 100, unit: 'px' }, 100, 40, 0, 2, 'x')).toBe(120); // 40/2=20
  });

  test('row axis reads dyScreen instead of dxScreen', () => {
    expect(computeTrackDrag({ value: 100, unit: 'px' }, 100, 999, 20, 1, 'y')).toBe(120);
  });
});

describe('grid-track-handles / gutterTrackIndices', () => {
  test('plain drag touches only the track before the gutter', () => {
    expect(gutterTrackIndices(0, false)).toEqual([0]);
    expect(gutterTrackIndices(2, false)).toEqual([2]);
  });
  test('shift touches both neighboring tracks', () => {
    expect(gutterTrackIndices(0, true)).toEqual([0, 1]);
    expect(gutterTrackIndices(2, true)).toEqual([2, 3]);
  });
});
