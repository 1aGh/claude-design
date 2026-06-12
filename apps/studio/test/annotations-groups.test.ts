// annotations-groups — FigJam v3 grouping / duplicate / z-order (pure, DOM-free).
// Group model: flat `groupIds` tag-array, deepest→shallowest, outermost = last.

import { describe, expect, test } from 'bun:test';

import {
  duplicateStrokes,
  expandIdsToGroups,
  groupStrokes,
  normalizeGroups,
  outermostGroupOf,
  reorderStrokes,
  ungroupStrokes,
} from '../annotations-groups.ts';
import type {
  ArrowStroke,
  PenStroke,
  RectStroke,
  Stroke,
  TextStroke,
} from '../annotations-model.ts';

function rect(id: string, x = 0, extra: Partial<RectStroke> = {}): RectStroke {
  return { id, tool: 'rect', color: '#1f1f1f', width: 3, x, y: 0, w: 100, h: 80, ...extra };
}
function pen(id: string, extra: Partial<PenStroke> = {}): PenStroke {
  return {
    id,
    tool: 'pen',
    color: '#e5484d',
    width: 3,
    points: [
      [0, 0],
      [10, 10],
    ],
    ...extra,
  };
}
function arrow(id: string, extra: Partial<ArrowStroke> = {}): ArrowStroke {
  return { id, tool: 'arrow', color: '#1f1f1f', width: 3, x1: 0, y1: 0, x2: 50, y2: 0, ...extra };
}

describe('outermostGroupOf / expandIdsToGroups', () => {
  test('outermost group is the LAST groupIds element (deepest→shallowest)', () => {
    expect(outermostGroupOf(rect('a', 0, { groupIds: ['inner', 'outer'] }))).toBe('outer');
    expect(outermostGroupOf(rect('a'))).toBeNull();
  });

  test('expanding one member id selects the whole outermost group, in z order', () => {
    const strokes: Stroke[] = [
      rect('a', 0, { groupIds: ['g1'] }),
      pen('loose'),
      rect('b', 200, { groupIds: ['g1'] }),
    ];
    expect(expandIdsToGroups(['b'], strokes)).toEqual(['a', 'b']);
  });

  test('ungrouped ids pass through; mixed selection keeps both', () => {
    const strokes: Stroke[] = [
      rect('a', 0, { groupIds: ['g1'] }),
      pen('loose'),
      rect('b', 200, { groupIds: ['g1'] }),
    ];
    expect(expandIdsToGroups(['loose', 'a'], strokes)).toEqual(['a', 'loose', 'b']);
  });
});

describe('groupStrokes', () => {
  test('groups ≥2 strokes under a fresh outermost id, contiguous at the topmost member', () => {
    const strokes: Stroke[] = [rect('a'), pen('mid'), rect('b', 200)];
    const res = groupStrokes(strokes, ['a', 'b'], 'gNew');
    expect(res).not.toBeNull();
    if (!res) return;
    // Block lands where the topmost member ('b') sat — after 'mid'.
    expect(res.strokes.map((s) => s.id)).toEqual(['mid', 'a', 'b']);
    expect(
      res.strokes.filter((s) => s.id !== 'mid').every((s) => outermostGroupOf(s) === 'gNew')
    ).toBe(true);
    expect(res.memberIds).toEqual(['a', 'b']);
  });

  test('grouping a group with a loose stroke NESTS (old id stays deeper)', () => {
    const strokes: Stroke[] = [
      rect('a', 0, { groupIds: ['g1'] }),
      rect('b', 100, { groupIds: ['g1'] }),
      pen('c'),
    ];
    const res = groupStrokes(strokes, ['c', 'a'], 'g2');
    expect(res).not.toBeNull();
    if (!res) return;
    const a = res.strokes.find((s) => s.id === 'a');
    expect(a?.groupIds).toEqual(['g1', 'g2']);
    const c = res.strokes.find((s) => s.id === 'c');
    expect(c?.groupIds).toEqual(['g2']);
  });

  test('fewer than two resolved members → null', () => {
    expect(groupStrokes([rect('a')], ['a'])).toBeNull();
    expect(groupStrokes([rect('a')], ['a', 'ghost'])).toBeNull();
  });
});

describe('ungroupStrokes / normalizeGroups', () => {
  test('ungroup strips ONE level (the outermost) and drops the key when empty', () => {
    const strokes: Stroke[] = [
      rect('a', 0, { groupIds: ['g1', 'g2'] }),
      rect('b', 100, { groupIds: ['g1', 'g2'] }),
    ];
    const out = ungroupStrokes(strokes, ['a']);
    expect(out.map((s) => s.groupIds)).toEqual([['g1'], ['g1']]);
    const out2 = ungroupStrokes(out, ['b']);
    for (const s of out2) expect('groupIds' in s).toBe(false);
  });

  test('normalizeGroups dissolves singleton groups after a delete', () => {
    const strokes: Stroke[] = [rect('a', 0, { groupIds: ['g1'] }), pen('loose')];
    const out = normalizeGroups(strokes);
    expect('groupIds' in (out[0] as Stroke)).toBe(false);
    // Referential no-op when nothing changes.
    const stable: Stroke[] = [rect('x', 0, { groupIds: ['g'] }), rect('y', 1, { groupIds: ['g'] })];
    expect(normalizeGroups(stable)).toBe(stable);
  });
});

describe('duplicateStrokes', () => {
  test('clones with fresh ids, remapped group ids, offset applied', () => {
    let n = 0;
    const makeId = () => `dup${++n}`;
    const strokes: Stroke[] = [
      rect('a', 0, { groupIds: ['g1'] }),
      rect('b', 100, { groupIds: ['g1'] }),
    ];
    const res = duplicateStrokes(strokes, ['a'], 16, 16, makeId, () => 'gDup');
    expect(res.strokes).toHaveLength(4);
    expect(res.newIds).toEqual(['dup1', 'dup2']);
    const dup1 = res.strokes.find((s) => s.id === 'dup1') as RectStroke;
    expect(dup1.x).toBe(16);
    expect(dup1.groupIds).toEqual(['gDup']);
    // Originals untouched.
    expect((res.strokes.find((s) => s.id === 'a') as RectStroke).x).toBe(0);
  });

  test('anchored text travels with its duplicated host and is NOT selectable', () => {
    const host = rect('host');
    const label: TextStroke = {
      id: 'label',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'hi',
      anchorId: 'host',
    };
    let n = 0;
    const res = duplicateStrokes([host, label], ['host'], 10, 0, () => `d${++n}`);
    expect(res.strokes).toHaveLength(4);
    const dupLabel = res.strokes.find((s) => s.tool === 'text' && s.id !== 'label') as TextStroke;
    expect(dupLabel.anchorId).toBe('d1'); // remapped to the cloned host
    expect(res.newIds).toEqual(['d1']); // anchored-text clone excluded
  });

  test('arrow binds remap to co-duplicated hosts; binds to outside hosts are kept', () => {
    const a = rect('a');
    const b = rect('b', 300);
    const ar = arrow('ar', {
      startBind: { hostId: 'a', nx: 1, ny: 0.5 },
      endBind: { hostId: 'b', nx: 0, ny: 0.5 },
    });
    let n = 0;
    const res = duplicateStrokes([a, b, ar], ['a', 'ar'], 0, 0, () => `d${++n}`);
    const dupArrow = res.strokes.find((s) => s.tool === 'arrow' && s.id !== 'ar') as ArrowStroke;
    expect(dupArrow.startBind?.hostId).toBe('d1'); // co-duplicated → remapped
    expect(dupArrow.endBind?.hostId).toBe('b'); // outside host → kept
  });
});

describe('reorderStrokes (z-order, group-contiguous units)', () => {
  const base = (): Stroke[] => [
    rect('a'),
    rect('g1a', 100, { groupIds: ['g1'] }),
    rect('g1b', 200, { groupIds: ['g1'] }),
    pen('top'),
  ];

  test('bring to front / send to back move the unit as one block', () => {
    expect(reorderStrokes(base(), ['a'], 'front').map((s) => s.id)).toEqual([
      'g1a',
      'g1b',
      'top',
      'a',
    ]);
    expect(reorderStrokes(base(), ['top'], 'back').map((s) => s.id)).toEqual([
      'top',
      'a',
      'g1a',
      'g1b',
    ]);
  });

  test('forward/backward hop over a WHOLE neighbouring group', () => {
    expect(reorderStrokes(base(), ['a'], 'forward').map((s) => s.id)).toEqual([
      'g1a',
      'g1b',
      'a',
      'top',
    ]);
    expect(reorderStrokes(base(), ['top'], 'backward').map((s) => s.id)).toEqual([
      'a',
      'top',
      'g1a',
      'g1b',
    ]);
  });

  test('selecting one group member moves the whole group', () => {
    expect(reorderStrokes(base(), ['g1b'], 'front').map((s) => s.id)).toEqual([
      'a',
      'top',
      'g1a',
      'g1b',
    ]);
  });

  test('already at the boundary is a no-op', () => {
    expect(reorderStrokes(base(), ['top'], 'forward').map((s) => s.id)).toEqual([
      'a',
      'g1a',
      'g1b',
      'top',
    ]);
  });
});
