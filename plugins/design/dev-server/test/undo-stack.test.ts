import { describe, expect, test } from 'bun:test';

import {
  type EditCommand,
  MAX_DEPTH,
  canRedo,
  canUndo,
  createUndoStackState,
  peekRedo,
  peekUndo,
  undoReducer,
} from '../undo-stack.ts';

function fakeCmd(label = 'fake'): EditCommand {
  return {
    kind: 'test',
    label,
    do() {},
    undo() {},
  };
}

describe('undoReducer', () => {
  test('push appends to past and clears future', () => {
    const a = fakeCmd('a');
    const b = fakeCmd('b');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    expect(s.past).toEqual([a]);
    expect(s.future).toEqual([]);
    s = undoReducer(s, { type: 'push', cmd: b });
    expect(s.past).toEqual([a, b]);
    expect(s.future).toEqual([]);
  });

  test('double push preserves order', () => {
    const a = fakeCmd('a');
    const b = fakeCmd('b');
    const c = fakeCmd('c');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    s = undoReducer(s, { type: 'push', cmd: b });
    s = undoReducer(s, { type: 'push', cmd: c });
    expect(s.past).toEqual([a, b, c]);
  });

  test('undo pops past top into future', () => {
    const a = fakeCmd('a');
    const b = fakeCmd('b');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    s = undoReducer(s, { type: 'push', cmd: b });
    s = undoReducer(s, { type: 'undo' });
    expect(s.past).toEqual([a]);
    expect(s.future).toEqual([b]);
    expect(peekUndo(s)).toBe(a);
    expect(peekRedo(s)).toBe(b);
  });

  test('undo on empty is a no-op (identity)', () => {
    const s = createUndoStackState();
    const next = undoReducer(s, { type: 'undo' });
    expect(next).toBe(s);
    expect(canUndo(next)).toBe(false);
  });

  test('redo pops future top back into past', () => {
    const a = fakeCmd('a');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    s = undoReducer(s, { type: 'undo' });
    s = undoReducer(s, { type: 'redo' });
    expect(s.past).toEqual([a]);
    expect(s.future).toEqual([]);
  });

  test('redo on empty future is a no-op', () => {
    const a = fakeCmd('a');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    const next = undoReducer(s, { type: 'redo' });
    expect(next).toBe(s);
    expect(canRedo(next)).toBe(false);
  });

  test('push discards future branch (canonical undo-stack semantics)', () => {
    const a = fakeCmd('a');
    const b = fakeCmd('b');
    const c = fakeCmd('c');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    s = undoReducer(s, { type: 'push', cmd: b });
    s = undoReducer(s, { type: 'undo' }); // future now = [b]
    expect(s.future.length).toBe(1);
    s = undoReducer(s, { type: 'push', cmd: c });
    expect(s.past).toEqual([a, c]);
    expect(s.future).toEqual([]);
  });

  test('depth cap drops oldest from past (ring buffer)', () => {
    let s = createUndoStackState();
    const cmds: EditCommand[] = [];
    for (let i = 0; i < MAX_DEPTH + 5; i++) {
      const cmd = fakeCmd(`cmd-${i}`);
      cmds.push(cmd);
      s = undoReducer(s, { type: 'push', cmd });
    }
    expect(s.past.length).toBe(MAX_DEPTH);
    // The 5 oldest (cmd-0 .. cmd-4) fell off; newest is the last we pushed.
    expect(s.past[0]).toBe(cmds[5]!);
    expect(s.past[s.past.length - 1]).toBe(cmds[cmds.length - 1]!);
  });

  test('clear resets both stacks', () => {
    const a = fakeCmd('a');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', cmd: a });
    s = undoReducer(s, { type: 'undo' });
    s = undoReducer(s, { type: 'clear' });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });
});
