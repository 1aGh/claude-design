import { describe, expect, mock, test } from 'bun:test';

import type { PenStroke, RectStroke, Stroke } from '../annotations-layer.tsx';
import { createAnnotationStrokesCommand } from '../commands/annotation-strokes-command.ts';

const pen1: PenStroke = {
  id: 'pen-1',
  tool: 'pen',
  color: '#000',
  width: 2,
  points: [
    [0, 0],
    [10, 10],
  ],
};

const pen2: PenStroke = {
  id: 'pen-2',
  tool: 'pen',
  color: '#f00',
  width: 4,
  points: [[20, 20]],
};

const rect1: RectStroke = {
  id: 'rect-1',
  tool: 'rect',
  color: '#000',
  width: 2,
  x: 0,
  y: 0,
  w: 50,
  h: 30,
  fill: null,
};

describe('createAnnotationStrokesCommand', () => {
  test('do() PUTs the AFTER set', async () => {
    const putFn = mock(() => Promise.resolve());
    const cmd = createAnnotationStrokesCommand({
      before: [],
      after: [pen1],
      putFn,
    });
    await cmd.do();
    expect(putFn).toHaveBeenCalledTimes(1);
    expect(putFn.mock.calls[0]?.[0]).toEqual([pen1]);
  });

  test('undo() PUTs the BEFORE set', async () => {
    const putFn = mock(() => Promise.resolve());
    const cmd = createAnnotationStrokesCommand({
      before: [pen1],
      after: [pen1, pen2],
      putFn,
    });
    await cmd.undo();
    expect(putFn).toHaveBeenCalledTimes(1);
    expect(putFn.mock.calls[0]?.[0]).toEqual([pen1]);
  });

  test('round-trip — add stroke then undo restores empty', async () => {
    const calls: Stroke[][] = [];
    const putFn: (next: readonly Stroke[]) => Promise<void> = (next) => {
      calls.push([...next]);
      return Promise.resolve();
    };
    const cmd = createAnnotationStrokesCommand({
      before: [],
      after: [pen1],
      putFn,
    });
    await cmd.do();
    await cmd.undo();
    await cmd.do(); // redo
    expect(calls).toEqual([[pen1], [], [pen1]]);
  });

  test('eraser path — before has stroke, after is empty', async () => {
    const putFn = mock(() => Promise.resolve());
    const cmd = createAnnotationStrokesCommand({
      before: [pen1],
      after: [],
      putFn,
    });
    expect(cmd.label).toBe('erase 1 stroke');
    await cmd.do();
    expect(putFn.mock.calls[0]?.[0]).toEqual([]);
    await cmd.undo();
    expect(putFn.mock.calls[1]?.[0]).toEqual([pen1]);
  });

  test('default label — add 2 strokes', () => {
    const cmd = createAnnotationStrokesCommand({
      before: [pen1],
      after: [pen1, pen2, rect1],
      putFn: () => {},
    });
    expect(cmd.label).toBe('add 2 strokes');
  });

  test('default label — same-count edit', () => {
    const cmd = createAnnotationStrokesCommand({
      before: [pen1],
      after: [{ ...pen1, color: '#f00' }],
      putFn: () => {},
    });
    expect(cmd.label).toBe('edit 1 stroke');
  });

  test('snapshots are deep-cloned — mutating source after construction does not poison', async () => {
    // Use locally-owned strokes so the test's mutation only affects the
    // source arrays, never the module-scope `pen1`/`pen2` shared with other
    // tests.
    const localPen: PenStroke = {
      id: 'local',
      tool: 'pen',
      color: '#000',
      width: 1,
      points: [
        [1, 1],
        [2, 2],
      ],
    };
    const localPenAfter: PenStroke = {
      id: 'local-after',
      tool: 'pen',
      color: '#111',
      width: 1,
      points: [[3, 3]],
    };
    const sourceBefore: Stroke[] = [localPen];
    const sourceAfter: Stroke[] = [localPen, localPenAfter];
    const putFn = mock(() => Promise.resolve());
    const cmd = createAnnotationStrokesCommand({
      before: sourceBefore,
      after: sourceAfter,
      putFn,
    });
    // Mutate source arrays after construction — replace entries entirely so
    // we don't reach through into shared sub-arrays.
    sourceAfter[0] = { ...localPen, color: '#POISONED' };
    sourceBefore.length = 0;
    await cmd.do();
    expect(putFn.mock.calls[0]?.[0]).toEqual([localPen, localPenAfter]);
    await cmd.undo();
    expect(putFn.mock.calls[1]?.[0]).toEqual([localPen]);
  });
});
