import { afterEach, describe, expect, test } from 'bun:test';

import {
  type CommandRecord,
  MAX_DEPTH,
  _clearBuilderRegistry,
  _clearStackStore,
  canRedo,
  canUndo,
  createUndoStackState,
  loadStackState,
  peekRedo,
  peekUndo,
  rebuildCommand,
  registerCommand,
  saveStackState,
  undoReducer,
} from '../undo-stack.ts';

afterEach(() => {
  _clearStackStore();
});

function rec(label = 'fake', payload: unknown = null): CommandRecord {
  return { kind: 'test', label, payload };
}

describe('undoReducer', () => {
  test('push appends record to past and clears future', () => {
    const a = rec('a');
    const b = rec('b');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    expect(s.past).toEqual([a]);
    expect(s.future).toEqual([]);
    s = undoReducer(s, { type: 'push', record: b });
    expect(s.past).toEqual([a, b]);
    expect(s.future).toEqual([]);
  });

  test('double push preserves order', () => {
    const a = rec('a');
    const b = rec('b');
    const c = rec('c');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    s = undoReducer(s, { type: 'push', record: b });
    s = undoReducer(s, { type: 'push', record: c });
    expect(s.past).toEqual([a, b, c]);
  });

  test('undo pops past top into future', () => {
    const a = rec('a');
    const b = rec('b');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    s = undoReducer(s, { type: 'push', record: b });
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
    const a = rec('a');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    s = undoReducer(s, { type: 'undo' });
    s = undoReducer(s, { type: 'redo' });
    expect(s.past).toEqual([a]);
    expect(s.future).toEqual([]);
  });

  test('redo on empty future is a no-op', () => {
    const a = rec('a');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    const next = undoReducer(s, { type: 'redo' });
    expect(next).toBe(s);
    expect(canRedo(next)).toBe(false);
  });

  test('push discards future branch (canonical undo-stack semantics)', () => {
    const a = rec('a');
    const b = rec('b');
    const c = rec('c');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    s = undoReducer(s, { type: 'push', record: b });
    s = undoReducer(s, { type: 'undo' });
    expect(s.future.length).toBe(1);
    s = undoReducer(s, { type: 'push', record: c });
    expect(s.past).toEqual([a, c]);
    expect(s.future).toEqual([]);
  });

  test('depth cap drops oldest from past (ring buffer)', () => {
    let s = createUndoStackState();
    const records: CommandRecord[] = [];
    for (let i = 0; i < MAX_DEPTH + 5; i++) {
      const r = rec(`r-${i}`);
      records.push(r);
      s = undoReducer(s, { type: 'push', record: r });
    }
    expect(s.past.length).toBe(MAX_DEPTH);
    expect(s.past[0]).toBe(records[5]!);
    expect(s.past[s.past.length - 1]).toBe(records[records.length - 1]!);
  });

  test('clear resets both stacks', () => {
    const a = rec('a');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'push', record: a });
    s = undoReducer(s, { type: 'undo' });
    s = undoReducer(s, { type: 'clear' });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  test('hydrate replaces both stacks atomically', () => {
    const a = rec('a');
    const b = rec('b');
    let s = createUndoStackState();
    s = undoReducer(s, { type: 'hydrate', state: { past: [a, b], future: [a] } });
    expect(s.past).toEqual([a, b]);
    expect(s.future).toEqual([a]);
  });
});

describe('command builder registry', () => {
  test('registerCommand + rebuildCommand round-trip', () => {
    _clearBuilderRegistry();
    registerCommand('test', (record, sinks) => {
      const fn = sinks.layoutPatchFn as ((layout: unknown) => void) | undefined;
      if (!fn) return null;
      return {
        kind: record.kind,
        label: record.label,
        do() {
          fn(record.payload);
        },
        undo() {
          fn({ undone: true });
        },
      };
    });
    const record = rec('test-label', { foo: 'bar' });
    const built = rebuildCommand(record, { layoutPatchFn: () => {} } as never);
    expect(built).not.toBeNull();
    expect(built?.label).toBe('test-label');
  });

  test('rebuildCommand returns null for unknown kind', () => {
    _clearBuilderRegistry();
    const out = rebuildCommand({ kind: 'unknown', label: '?', payload: null }, {});
    expect(out).toBeNull();
  });

  test('rebuildCommand returns null when required sink is missing', () => {
    _clearBuilderRegistry();
    registerCommand('needs-sink', (_record, sinks) => {
      if (!sinks.layoutPatchFn) return null;
      return { kind: 'needs-sink', label: '', do() {}, undo() {} };
    });
    const out = rebuildCommand({ kind: 'needs-sink', label: '', payload: null }, {});
    expect(out).toBeNull();
  });
});

describe('cross-iframe persistence (loadStackState / saveStackState)', () => {
  test('round-trips state under a canvas file key', () => {
    const a = rec('a');
    const initial = loadStackState('ui/Foo.tsx');
    expect(initial).toEqual({ past: [], future: [] });
    saveStackState('ui/Foo.tsx', { past: [a], future: [] });
    expect(loadStackState('ui/Foo.tsx').past).toEqual([a]);
  });

  test('isolation across canvas files', () => {
    saveStackState('ui/Foo.tsx', { past: [rec('foo')], future: [] });
    saveStackState('ui/Bar.tsx', { past: [rec('bar-1'), rec('bar-2')], future: [] });
    expect(loadStackState('ui/Foo.tsx').past.length).toBe(1);
    expect(loadStackState('ui/Bar.tsx').past.length).toBe(2);
    expect(loadStackState('ui/Baz.tsx').past).toEqual([]);
  });

  test('survives a "remount" simulation — load → save → reload yields same state', () => {
    // Simulate: iframe A pushes 2 records, iframe A unmounts, iframe B
    // mounts for the same canvas → sees both records.
    saveStackState('ui/Persist.tsx', {
      past: [rec('e1'), rec('e2')],
      future: [rec('redo-me')],
    });
    // Pretend a remount happens — same window store, fresh load.
    const reloaded = loadStackState('ui/Persist.tsx');
    expect(reloaded.past.length).toBe(2);
    expect(reloaded.future.length).toBe(1);
  });
});
