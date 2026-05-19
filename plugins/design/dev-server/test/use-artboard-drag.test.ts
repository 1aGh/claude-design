// use-artboard-drag — Phase 4.2 Task 2. Pure reducer + helpers.
//
// The hook itself attaches DOM listeners; we verify the state-machine reducer
// (`dragReducer`) and the follower/others computations are correct without
// spinning up a DOM. The integration smoke (T3 ghost render, T5 commit
// round-trip) is covered by the scenario in `.ai/scenarios/canvas-artboard-drag.md`.

import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_GRID_SIZE,
  DEFAULT_SNAP_TOLERANCE,
  DRAG_THRESHOLD_PX,
  type DragEvent,
  type DragState,
  commitFromState,
  computeFollowers,
  computeOthers,
  dragReducer,
  selectionsToArtboardIds,
} from '../use-artboard-drag.tsx';
import type { Selection } from '../use-selection-set.tsx';
import type { Rect } from '../use-snap-guides.tsx';

const rect = (id: string, x: number, y: number, w = 100, h = 80): Rect => ({
  id,
  x,
  y,
  w,
  h,
});

const move = (over: Partial<Extract<DragEvent, { type: 'move' }>>): DragEvent => ({
  type: 'move',
  clientX: 0,
  clientY: 0,
  alt: false,
  zoom: 1,
  gridSize: DEFAULT_GRID_SIZE,
  tolerance: DEFAULT_SNAP_TOLERANCE,
  ...over,
});

// ─────────────────────────────────────────────────────────────────────────────
// computeFollowers + computeOthers

describe('computeFollowers', () => {
  test('returns [] when leader is not in selection', () => {
    const all = [rect('a', 0, 0), rect('b', 200, 0), rect('c', 400, 0)];
    const followers = computeFollowers('a', all[0] as Rect, new Set(['b', 'c']), all);
    expect(followers).toEqual([]);
  });

  test('returns siblings selected alongside leader, with relative offsets', () => {
    const all = [rect('a', 100, 50), rect('b', 300, 200), rect('c', 600, 400)];
    const followers = computeFollowers('a', all[0] as Rect, new Set(['a', 'b', 'c']), all);
    expect(followers).toHaveLength(2);
    expect(followers[0]).toMatchObject({ id: 'b', offsetX: 200, offsetY: 150 });
    expect(followers[1]).toMatchObject({ id: 'c', offsetX: 500, offsetY: 350 });
  });

  test('excludes the leader from its own followers', () => {
    const all = [rect('a', 0, 0), rect('b', 200, 0)];
    const followers = computeFollowers('a', all[0] as Rect, new Set(['a', 'b']), all);
    expect(followers.map((f) => f.id)).toEqual(['b']);
  });
});

describe('computeOthers', () => {
  test('excludes leader + followers from the snap candidate set', () => {
    const all = [rect('a', 0, 0), rect('b', 200, 0), rect('c', 400, 0), rect('d', 600, 0)];
    const others = computeOthers('a', new Set(['b']), all);
    expect(others.map((r) => r.id)).toEqual(['c', 'd']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// dragReducer — state machine

function downAt(clientX: number, clientY: number, leaderStart: Rect): DragEvent {
  return {
    type: 'down',
    clientX,
    clientY,
    leaderId: leaderStart.id ?? '',
    leaderStart,
    followers: [],
    others: [],
  };
}

describe('dragReducer / idle → pending', () => {
  test('down event transitions to pending', () => {
    const leader = rect('a', 0, 0);
    const next = dragReducer({ kind: 'idle' }, downAt(50, 60, leader));
    expect(next.kind).toBe('pending');
    if (next.kind !== 'pending') throw new Error();
    expect(next.startClientX).toBe(50);
    expect(next.startClientY).toBe(60);
    expect(next.leaderId).toBe('a');
  });
});

describe('dragReducer / pending → idle when below threshold', () => {
  test('move below 4 px stays in pending', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const next = dragReducer(pending, move({ clientX: 102, clientY: 101 }));
    expect(next.kind).toBe('pending');
  });

  test(`move past ${DRAG_THRESHOLD_PX} px transitions to dragging`, () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const next = dragReducer(pending, move({ clientX: 100 + DRAG_THRESHOLD_PX, clientY: 100 }));
    expect(next.kind).toBe('dragging');
  });
});

describe('dragReducer / dragging math', () => {
  test('world delta scales by zoom (zoom 1.0)', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 200, clientY: 100, zoom: 1 }));
    if (dragging.kind !== 'dragging') throw new Error();
    expect(dragging.leaderRect.x).toBe(100);
    expect(dragging.leaderRect.y).toBe(0);
  });

  test('world delta scales by zoom (zoom 0.5 — every screen px = 2 world px)', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 200, clientY: 100, zoom: 0.5 }));
    if (dragging.kind !== 'dragging') throw new Error();
    expect(dragging.leaderRect.x).toBe(200);
  });

  test('world delta scales by zoom (zoom 2.0 — every screen px = 0.5 world px)', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 200, clientY: 100, zoom: 2 }));
    if (dragging.kind !== 'dragging') throw new Error();
    expect(dragging.leaderRect.x).toBe(50);
  });

  test('snap applies during drag (proposed near grid line)', () => {
    // Move leader from (0,0) by (+37 client px) at zoom 1 → proposed.x = 37.
    // Grid line at 40 within tolerance 8 → snaps to 40.
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 137, clientY: 100 }));
    if (dragging.kind !== 'dragging') throw new Error();
    expect(dragging.leaderRect.x).toBe(40);
    expect(dragging.snap.guides.find((g) => g.axis === 'x')?.pos).toBe(40);
  });

  test('alt=true disables snap mid-drag', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 137, clientY: 100, alt: true }));
    if (dragging.kind !== 'dragging') throw new Error();
    expect(dragging.leaderRect.x).toBe(37);
    expect(dragging.snap.guides).toEqual([]);
  });
});

describe('dragReducer / cancel + up', () => {
  test('cancel returns to idle from pending', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const next = dragReducer(pending, { type: 'cancel' });
    expect(next.kind).toBe('idle');
  });

  test('cancel returns to idle from dragging (no commit emitted by reducer)', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 200, clientY: 100 }));
    const next = dragReducer(dragging, { type: 'cancel' });
    expect(next.kind).toBe('idle');
  });

  test('up returns to idle', () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 200, clientY: 100 }));
    const next = dragReducer(dragging, { type: 'up' });
    expect(next.kind).toBe('idle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// commitFromState

describe('commitFromState', () => {
  test('returns null for idle/pending', () => {
    expect(commitFromState({ kind: 'idle' })).toBeNull();
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    expect(commitFromState(pending)).toBeNull();
  });

  test("returns leader's snapped position when no followers", () => {
    const leader = rect('a', 0, 0);
    const pending = dragReducer({ kind: 'idle' }, downAt(100, 100, leader));
    const dragging = dragReducer(pending, move({ clientX: 200, clientY: 100 }));
    const commit = commitFromState(dragging);
    expect(commit).toEqual([{ id: 'a', x: 100, y: 0 }]);
  });

  test('multi-drag preserves relative offsets', () => {
    // Leader 'a' starts at (0, 0). Follower 'b' starts at (200, 150) — offset
    // (200, 150) from leader. Drag leader by (50, 25) world — alt=true to
    // disable snap so we can predict the result exactly.
    const leader = rect('a', 0, 0);
    const follower = rect('b', 200, 150);
    const all = [leader, follower];
    const followers = computeFollowers('a', leader, new Set(['a', 'b']), all);
    const others = computeOthers('a', new Set(['b']), all);

    const down: DragEvent = {
      type: 'down',
      clientX: 100,
      clientY: 100,
      leaderId: 'a',
      leaderStart: leader,
      followers,
      others,
    };
    const pending = dragReducer({ kind: 'idle' }, down);
    const dragging = dragReducer(pending, move({ clientX: 150, clientY: 125, alt: true }));
    const commit = commitFromState(dragging);
    expect(commit).toEqual([
      { id: 'a', x: 50, y: 25 },
      { id: 'b', x: 250, y: 175 },
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration — snap also applies in dragging with siblings present

describe('dragReducer / snap with siblings', () => {
  test("leader snaps to sibling's left edge during drag", () => {
    const leader = rect('a', 0, 0, 100, 80);
    const sibling = rect('b', 200, 0, 100, 80);
    const others = computeOthers('a', new Set(), [leader, sibling]);

    const down: DragEvent = {
      type: 'down',
      clientX: 100,
      clientY: 100,
      leaderId: 'a',
      leaderStart: leader,
      followers: [],
      others,
    };
    const pending = dragReducer({ kind: 'idle' }, down);
    // Drag leader by (+197 client px) at zoom 1 → proposed.x = 197.
    // Sibling.left = 200, delta = 3 → snap to 200.
    const dragging = dragReducer(pending, move({ clientX: 297, clientY: 100 }));
    if (dragging.kind !== 'dragging') throw new Error();
    expect(dragging.leaderRect.x).toBe(200);
    expect(dragging.snap.guides.find((g) => g.axis === 'x')?.pos).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Move event from idle is a no-op (defensive)

describe('dragReducer / move from idle is a no-op', () => {
  test('move dispatched without a prior down stays idle', () => {
    const next = dragReducer({ kind: 'idle' }, move({ clientX: 100 }));
    expect(next.kind).toBe('idle');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectionsToArtboardIds — Phase 4.2 multi-drag identity gate (C1 regression).
//
// Selection.id is a child element's data-cd-id; Selection.artboardId is the
// host artboard. Multi-drag identity MUST key on artboardId only — falling
// back to id would pollute the set with child cd-ids and silently disable
// multi-drag.

describe('selectionsToArtboardIds', () => {
  const sel = (over: Partial<Selection>): Selection => ({
    selector: '[data-cd-id="x"]',
    ...over,
  });

  test('ignores Selection.id (child cd-id) and keys on artboardId only', () => {
    const list: Selection[] = [
      sel({ id: 'button_cd_xyz', artboardId: 'A' }),
      sel({ id: 'span_cd_abc', artboardId: 'B' }),
    ];
    const ids = selectionsToArtboardIds(list);
    expect([...ids].sort()).toEqual(['A', 'B']);
    expect(ids.has('button_cd_xyz')).toBe(false);
  });

  test('skips selections that have no artboardId (orphan / world-level)', () => {
    const list: Selection[] = [
      sel({ id: 'orphan_cd', artboardId: null }),
      sel({ artboardId: 'A' }),
    ];
    const ids = selectionsToArtboardIds(list);
    expect([...ids]).toEqual(['A']);
  });

  test('dedupes when two selections share the same artboardId', () => {
    const list: Selection[] = [
      sel({ id: 'a1', artboardId: 'A' }),
      sel({ id: 'a2', artboardId: 'A' }),
    ];
    const ids = selectionsToArtboardIds(list);
    expect(ids.size).toBe(1);
    expect(ids.has('A')).toBe(true);
  });

  test('empty list → empty set', () => {
    const ids = selectionsToArtboardIds([]);
    expect(ids.size).toBe(0);
  });
});
