import { beforeAll, describe, expect, mock, test } from 'bun:test';

import {
  buildEditSourceRecord,
  createEditSourceCommand,
  EDIT_SOURCE_KIND,
  type EditSourceApplyFn,
  type EditSourcePayload,
} from '../commands/edit-source-command.ts';
import { type CommandSinks, rebuildCommand, registerCommand } from '../undo-stack.ts';

const cssEdit: EditSourcePayload = {
  op: 'css',
  canvas: '.design/ui/Foo.tsx',
  id: 'cd-1',
  key: 'color',
  before: 'red',
  after: 'blue',
};

describe('createEditSourceCommand', () => {
  test('do() applies the AFTER value', async () => {
    const applyFn = mock(() => {});
    const cmd = createEditSourceCommand({ payload: cssEdit, applyFn });
    await cmd.do();
    expect(applyFn).toHaveBeenCalledTimes(1);
    expect(applyFn.mock.calls[0]?.[0]).toEqual({
      op: 'css',
      canvas: '.design/ui/Foo.tsx',
      id: 'cd-1',
      key: 'color',
      value: 'blue',
      // do() writes `after` over `before`, so `from` = before; css has no occurrence.
      from: 'red',
      occurrence: undefined,
    });
  });

  test('do()/undo() carry occurrence + from for a text edit (variable re-target)', async () => {
    const applyFn = mock(() => {});
    const textEdit: EditSourcePayload = {
      op: 'text',
      canvas: '.design/ui/Foo.tsx',
      id: 'cd-9',
      key: '',
      before: 'Old',
      after: 'New',
      occurrence: 2,
    };
    const cmd = createEditSourceCommand({ payload: textEdit, applyFn });
    await cmd.do();
    // redo/do: write New over Old → from = Old.
    expect(applyFn.mock.calls[0]?.[0]).toMatchObject({ value: 'New', from: 'Old', occurrence: 2 });
    await cmd.undo();
    // undo: write Old over New → from = New.
    expect(applyFn.mock.calls[1]?.[0]).toMatchObject({ value: 'Old', from: 'New', occurrence: 2 });
  });

  test('undo() applies the BEFORE value', async () => {
    const applyFn = mock(() => {});
    const cmd = createEditSourceCommand({ payload: cssEdit, applyFn });
    await cmd.undo();
    expect(applyFn.mock.calls[0]?.[0]?.value).toBe('red');
  });

  test('undo() of a NEW prop (before:null) applies null = reset', async () => {
    const applyFn = mock(() => {});
    const cmd = createEditSourceCommand({
      payload: { ...cssEdit, before: null, after: 'blue' },
      applyFn,
    });
    await cmd.undo();
    expect(applyFn.mock.calls[0]?.[0]?.value).toBeNull();
  });

  test('do() of a RESET (after:null) applies null = remove the prop', async () => {
    const applyFn = mock(() => {});
    const cmd = createEditSourceCommand({
      payload: { ...cssEdit, before: 'red', after: null },
      applyFn,
    });
    await cmd.do();
    expect(applyFn.mock.calls[0]?.[0]?.value).toBeNull();
  });

  test('label reflects op + key', () => {
    expect(createEditSourceCommand({ payload: cssEdit, applyFn: () => {} }).label).toBe(
      'edit color'
    );
    expect(
      createEditSourceCommand({ payload: { ...cssEdit, after: null }, applyFn: () => {} }).label
    ).toBe('reset color');
    expect(
      createEditSourceCommand({
        payload: { op: 'attr', canvas: 'x', id: 'y', key: 'data-x', before: null, after: '1' },
        applyFn: () => {},
      }).label
    ).toBe('edit @data-x');
    expect(
      createEditSourceCommand({
        payload: { op: 'text', canvas: 'x', id: 'y', key: '', before: 'a', after: 'b' },
        applyFn: () => {},
      }).label
    ).toBe('edit text');
  });
});

describe('buildEditSourceRecord', () => {
  test('produces a serializable record under the edit-source kind', () => {
    const rec = buildEditSourceRecord(cssEdit);
    expect(rec.kind).toBe(EDIT_SOURCE_KIND);
    expect(rec.payload).toEqual(cssEdit);
    expect(JSON.parse(JSON.stringify(rec))).toEqual(rec); // round-trips
  });
});

describe('edit-source registry', () => {
  // The module self-registers on import, but sibling test files wipe the shared
  // builder registry in their beforeEach — re-register here so this block is
  // order-independent. Mirrors the real registration in edit-source-command.ts.
  beforeAll(() => {
    registerCommand<EditSourcePayload>(EDIT_SOURCE_KIND, (record, sinks) => {
      const applyFn = sinks.editSourceApplyFn as EditSourceApplyFn | undefined;
      if (!applyFn) return null;
      return createEditSourceCommand({ payload: record.payload, applyFn, label: record.label });
    });
  });

  test('rebuildCommand returns null when the editSourceApplyFn sink is unbound', () => {
    expect(rebuildCommand(buildEditSourceRecord(cssEdit), {} as CommandSinks)).toBeNull();
  });

  test('rebuildCommand wires the bound sink into a runnable command', async () => {
    const applyFn = mock(() => {});
    const cmd = rebuildCommand(buildEditSourceRecord(cssEdit), {
      editSourceApplyFn: applyFn,
    } as CommandSinks);
    expect(cmd).not.toBeNull();
    await cmd?.do();
    expect(applyFn.mock.calls[0]?.[0]?.value).toBe('blue');
  });
});
