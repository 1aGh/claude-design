// use-undo-stack — Provider runner contract. SSR-only because bun:test has
// no React renderer for state-driven re-renders; we capture the value object
// and exercise its action closures directly. The reducer itself is unit-
// tested separately in undo-stack.test.ts.

import { describe, expect, mock, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import type { EditCommand } from '../undo-stack.ts';
import { UndoStackProvider, useUndoStack, useUndoStackOptional } from '../use-undo-stack.tsx';

function mkCmd(label: string, opts?: { failDo?: boolean; failUndo?: boolean }) {
  const doFn = mock(() => {
    if (opts?.failDo) throw new Error('do-boom');
  });
  const undoFn = mock(() => {
    if (opts?.failUndo) throw new Error('undo-boom');
  });
  const cmd: EditCommand = { kind: 'test', label, do: doFn, undo: undoFn };
  return { cmd, doFn, undoFn };
}

function capture<T>(useHook: () => T, tree: (consumer: React.ReactElement) => React.ReactElement) {
  let captured: T | null = null;
  function Consumer() {
    captured = useHook();
    return null;
  }
  renderToStaticMarkup(tree(<Consumer />));
  if (!captured) throw new Error('hook did not capture a value');
  return captured;
}

describe('use-undo-stack / contract outside provider', () => {
  test('useUndoStack() throws outside provider', () => {
    function Bare() {
      useUndoStack();
      return null;
    }
    expect(() => renderToStaticMarkup(<Bare />)).toThrow(
      /useUndoStack must be used inside <UndoStackProvider>/
    );
  });

  test('useUndoStackOptional() returns no-op value outside provider', () => {
    const value = capture(useUndoStackOptional, (child) => <>{child}</>);
    expect(value.canUndo).toBe(false);
    expect(value.canRedo).toBe(false);
    expect(value.lastLabel).toBeNull();
    // No-op methods don't throw.
    expect(() => value.clear()).not.toThrow();
  });
});

describe('use-undo-stack / provider API surface', () => {
  test('exposes the documented contract', () => {
    const v = capture(useUndoStack, (child) => <UndoStackProvider>{child}</UndoStackProvider>);
    expect(typeof v.push).toBe('function');
    expect(typeof v.undo).toBe('function');
    expect(typeof v.redo).toBe('function');
    expect(typeof v.clear).toBe('function');
    expect(v.canUndo).toBe(false);
    expect(v.canRedo).toBe(false);
    expect(v.lastLabel).toBeNull();
    expect(v.lastTick).toBe(0);
  });
});

describe('use-undo-stack / runner side-effects', () => {
  test('push() invokes cmd.do() exactly once', async () => {
    const v = capture(useUndoStack, (child) => <UndoStackProvider>{child}</UndoStackProvider>);
    const { cmd, doFn, undoFn } = mkCmd('move 1');
    await v.push(cmd);
    expect(doFn).toHaveBeenCalledTimes(1);
    expect(undoFn).toHaveBeenCalledTimes(0);
  });

  test('undo() invokes cmd.undo() on the most recently pushed command', async () => {
    const v = capture(useUndoStack, (child) => <UndoStackProvider>{child}</UndoStackProvider>);
    const a = mkCmd('a');
    const b = mkCmd('b');
    await v.push(a.cmd);
    await v.push(b.cmd);
    await v.undo();
    expect(b.undoFn).toHaveBeenCalledTimes(1);
    expect(a.undoFn).toHaveBeenCalledTimes(0);
  });

  test('redo() re-invokes cmd.do() on the most recently undone command', async () => {
    const v = capture(useUndoStack, (child) => <UndoStackProvider>{child}</UndoStackProvider>);
    const { cmd, doFn } = mkCmd('a');
    await v.push(cmd);
    await v.undo();
    await v.redo();
    expect(doFn).toHaveBeenCalledTimes(2);
  });

  test('push runner reports do() failure via onCommandError and does not commit', async () => {
    const onError = mock(() => {});
    let captured: ReturnType<typeof useUndoStack> | null = null;
    function Capture() {
      captured = useUndoStack();
      return null;
    }
    renderToStaticMarkup(
      <UndoStackProvider onCommandError={onError}>
        <Capture />
      </UndoStackProvider>
    );
    if (!captured) throw new Error('no capture');
    const { cmd, undoFn } = mkCmd('boom', { failDo: true });
    await captured.push(cmd);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(undoFn).toHaveBeenCalledTimes(0);
  });
});
