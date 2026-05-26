import { describe, expect, mock, test } from 'bun:test';

import {
  type ArtboardLayoutEntry,
  createMoveArtboardsCommand,
  diffLayoutPositions,
} from '../commands/move-artboards-command.ts';

const A: ArtboardLayoutEntry = { id: 'a', x: 0, y: 0, w: 100, h: 80 };
const B: ArtboardLayoutEntry = { id: 'b', x: 200, y: 0, w: 100, h: 80 };
const A2: ArtboardLayoutEntry = { id: 'a', x: 50, y: 25, w: 100, h: 80 };
const B2: ArtboardLayoutEntry = { id: 'b', x: 260, y: 0, w: 100, h: 80 };

describe('createMoveArtboardsCommand', () => {
  test('do() patches with the AFTER snapshot', async () => {
    const patchFn = mock(() => {});
    const cmd = createMoveArtboardsCommand({ before: [A, B], after: [A2, B], patchFn });
    await cmd.do();
    expect(patchFn).toHaveBeenCalledTimes(1);
    const arg = patchFn.mock.calls[0]?.[0];
    expect(arg).toEqual([A2, B]);
  });

  test('undo() patches with the BEFORE snapshot', async () => {
    const patchFn = mock(() => {});
    const cmd = createMoveArtboardsCommand({ before: [A, B], after: [A2, B], patchFn });
    await cmd.undo();
    expect(patchFn).toHaveBeenCalledTimes(1);
    const arg = patchFn.mock.calls[0]?.[0];
    expect(arg).toEqual([A, B]);
  });

  test('redo idempotence — do() twice yields the same patch payload', async () => {
    const patchFn = mock(() => {});
    const cmd = createMoveArtboardsCommand({ before: [A, B], after: [A2, B2], patchFn });
    await cmd.do();
    await cmd.do();
    expect(patchFn).toHaveBeenCalledTimes(2);
    expect(patchFn.mock.calls[0]?.[0]).toEqual([A2, B2]);
    expect(patchFn.mock.calls[1]?.[0]).toEqual([A2, B2]);
  });

  test('snapshots are deep-cloned — mutating the source after construction has no effect', async () => {
    const before: ArtboardLayoutEntry[] = [{ ...A }, { ...B }];
    const after: ArtboardLayoutEntry[] = [{ ...A2 }, { ...B }];
    const patchFn = mock(() => {});
    const cmd = createMoveArtboardsCommand({ before, after, patchFn });
    // Poison the source arrays in place.
    after[0]!.x = 9999;
    before[1]!.y = -777;
    await cmd.do();
    expect(patchFn.mock.calls[0]?.[0]).toEqual([A2, B]);
    await cmd.undo();
    expect(patchFn.mock.calls[1]?.[0]).toEqual([A, B]);
  });

  test('label defaults to "move N artboards" with correct count', () => {
    const cmd = createMoveArtboardsCommand({
      before: [A, B],
      after: [A2, B],
      patchFn: () => {},
    });
    expect(cmd.label).toBe('move 1 artboard');

    const cmd2 = createMoveArtboardsCommand({
      before: [A, B],
      after: [A2, B2],
      patchFn: () => {},
    });
    expect(cmd2.label).toBe('move 2 artboards');
  });

  test('label override (equal-spacing wraps with its own copy)', () => {
    const cmd = createMoveArtboardsCommand({
      before: [A, B],
      after: [A2, B2],
      patchFn: () => {},
      label: 'equal-space 2 artboards',
    });
    expect(cmd.label).toBe('equal-space 2 artboards');
  });
});

describe('diffLayoutPositions', () => {
  test('identical → null (skip push)', () => {
    expect(diffLayoutPositions([A, B], [A, B])).toBeNull();
    expect(diffLayoutPositions([A, B], [{ ...A }, { ...B }])).toBeNull();
  });

  test('1 moved → { changed: 1 }', () => {
    expect(diffLayoutPositions([A, B], [A2, B])).toEqual({ changed: 1 });
  });

  test('both moved → { changed: 2 }', () => {
    expect(diffLayoutPositions([A, B], [A2, B2])).toEqual({ changed: 2 });
  });

  test('different array lengths → reports max (defensive — real flows align ids)', () => {
    expect(diffLayoutPositions([A], [A, B])).toEqual({ changed: 2 });
  });

  test('size-only diff (no position change) → null', () => {
    const Aresized: ArtboardLayoutEntry = { id: 'a', x: 0, y: 0, w: 200, h: 160 };
    expect(diffLayoutPositions([A], [Aresized])).toBeNull();
  });
});
