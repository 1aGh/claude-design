// input-router — Phase 4.1 Task 1. Pure classifier table tests.

import { describe, expect, test } from 'bun:test';

import {
  type ClassifyInput,
  classify,
  crossedDragThreshold,
  DRAG_THRESHOLD_PX,
  isEditableTarget,
  type Tool,
} from '../input-router.tsx';

const base = (over: Partial<ClassifyInput>): ClassifyInput => ({
  type: 'pointermove',
  activeTool: 'move' as Tool,
  ...over,
});

describe('input-router / pointermove — move tool', () => {
  test('bare hover → no-op (native interactions pass through)', () => {
    const action = classify(base({ type: 'pointermove', clientX: 10, clientY: 20 }));
    expect(action.kind).toBe('no-op');
  });

  test('cmd-hover → hover preview with deep=true', () => {
    const action = classify(base({ type: 'pointermove', metaKey: true, clientX: 5, clientY: 6 }));
    expect(action).toMatchObject({ kind: 'hover', deep: true });
  });

  test('ctrl-hover (windows/linux) → hover with deep=true', () => {
    const action = classify(base({ type: 'pointermove', ctrlKey: true }));
    expect(action).toMatchObject({ kind: 'hover', deep: true });
  });

  test('hover in hand tool → no-op', () => {
    const action = classify(base({ type: 'pointermove', activeTool: 'hand' }));
    expect(action.kind).toBe('no-op');
  });

  test('hover in comment tool → hover with deep=true (preview deepest)', () => {
    const action = classify(
      base({ type: 'pointermove', activeTool: 'comment', clientX: 1, clientY: 2 })
    );
    expect(action).toEqual({ kind: 'hover', deep: true, clientX: 1, clientY: 2 });
  });
});

describe('input-router / pointerdown — move tool select', () => {
  test('bare left-click → no-op (native interactions pass through)', () => {
    const action = classify(base({ type: 'pointerdown', button: 0, clientX: 100, clientY: 200 }));
    expect(action.kind).toBe('no-op');
  });

  test('shift+left-click (no cmd) → no-op (no select without Cmd)', () => {
    const action = classify(base({ type: 'pointerdown', button: 0, shiftKey: true }));
    expect(action.kind).toBe('no-op');
  });

  test('cmd+left-click → select replace, deep=true (nested single)', () => {
    const action = classify(
      base({ type: 'pointerdown', button: 0, metaKey: true, clientX: 11, clientY: 22 })
    );
    expect(action).toEqual({
      kind: 'select',
      mode: 'replace',
      deep: true,
      clientX: 11,
      clientY: 22,
    });
  });

  test('cmd+shift+left-click → select add, deep=true (multi nested)', () => {
    const action = classify(
      base({ type: 'pointerdown', button: 0, metaKey: true, shiftKey: true })
    );
    expect(action).toMatchObject({ kind: 'select', mode: 'add', deep: true });
  });

  test('ctrl+left-click (linux/windows cmd-equivalent) → select replace deep', () => {
    const action = classify(base({ type: 'pointerdown', button: 0, ctrlKey: true }));
    expect(action).toMatchObject({ kind: 'select', mode: 'replace', deep: true });
  });
});

describe('input-router / pointerdown — non-left buttons', () => {
  test('middle-button → no-op (viewport-controller owns it)', () => {
    const action = classify(base({ type: 'pointerdown', button: 1 }));
    expect(action.kind).toBe('no-op');
  });

  test('right-button → context-menu', () => {
    const action = classify(base({ type: 'pointerdown', button: 2, clientX: 50, clientY: 60 }));
    expect(action).toEqual({ kind: 'context-menu', clientX: 50, clientY: 60 });
  });

  test('space-held + left-click → no-op (viewport-controller pans)', () => {
    const action = classify(base({ type: 'pointerdown', button: 0, spaceHeld: true }));
    expect(action.kind).toBe('no-op');
  });
});

describe('input-router / pointerdown — tool-aware', () => {
  test('comment tool + bare click → drop-comment', () => {
    const action = classify(
      base({ type: 'pointerdown', button: 0, activeTool: 'comment', clientX: 12, clientY: 34 })
    );
    expect(action).toEqual({ kind: 'drop-comment', clientX: 12, clientY: 34 });
  });

  test('comment tool + shift+click → drop-comment (modifier ignored for now)', () => {
    const action = classify(
      base({ type: 'pointerdown', button: 0, activeTool: 'comment', shiftKey: true })
    );
    expect(action.kind).toBe('drop-comment');
  });

  test('hand tool + bare click → no-op (viewport-controller claims the drag)', () => {
    const action = classify(base({ type: 'pointerdown', button: 0, activeTool: 'hand' }));
    expect(action.kind).toBe('no-op');
  });

  test('hand tool + cmd+click → still no-op (no select in hand mode)', () => {
    const action = classify(
      base({ type: 'pointerdown', button: 0, activeTool: 'hand', metaKey: true })
    );
    expect(action.kind).toBe('no-op');
  });
});

describe('input-router / contextmenu event', () => {
  test('always opens menu + carries cursor coords', () => {
    const action = classify(base({ type: 'contextmenu', clientX: 77, clientY: 88 }));
    expect(action).toEqual({ kind: 'context-menu', clientX: 77, clientY: 88 });
  });
});

describe('input-router / keydown — tool letters', () => {
  test('V → tool move', () => {
    const action = classify(base({ type: 'keydown', key: 'v' }));
    expect(action).toEqual({ kind: 'tool', tool: 'move' });
  });

  test('uppercase V (Shift held during letter)', () => {
    const action = classify(base({ type: 'keydown', key: 'V' }));
    expect(action).toEqual({ kind: 'tool', tool: 'move' });
  });

  test('H → tool hand', () => {
    expect(classify(base({ type: 'keydown', key: 'h' }))).toEqual({
      kind: 'tool',
      tool: 'hand',
    });
  });

  test('C → tool comment', () => {
    expect(classify(base({ type: 'keydown', key: 'c' }))).toEqual({
      kind: 'tool',
      tool: 'comment',
    });
  });

  test('Escape → escape action', () => {
    expect(classify(base({ type: 'keydown', key: 'Escape' }))).toEqual({
      kind: 'escape',
    });
  });

  test('Cmd+C with modifier → no-op (browser copy / viewport-controller)', () => {
    const action = classify(base({ type: 'keydown', key: 'c', metaKey: true }));
    expect(action.kind).toBe('no-op');
  });

  test('Cmd+V with modifier → no-op', () => {
    const action = classify(base({ type: 'keydown', key: 'v', metaKey: true }));
    expect(action.kind).toBe('no-op');
  });

  test('Cmd+Escape → escape (cancels regardless of modifiers)', () => {
    const action = classify(base({ type: 'keydown', key: 'Escape', metaKey: true }));
    expect(action.kind).toBe('escape');
  });

  test('V in input field → no-op', () => {
    const action = classify(base({ type: 'keydown', key: 'v', isEditable: true }));
    expect(action.kind).toBe('no-op');
  });

  test('Other letters → no-op', () => {
    expect(classify(base({ type: 'keydown', key: 'x' })).kind).toBe('no-op');
    expect(classify(base({ type: 'keydown', key: 'Tab' })).kind).toBe('no-op');
    expect(classify(base({ type: 'keydown', key: 'Enter' })).kind).toBe('no-op');
  });
});

describe('input-router / keydown — Phase 5 draw tools', () => {
  test('B → tool pen', () => {
    expect(classify(base({ type: 'keydown', key: 'b' }))).toEqual({
      kind: 'tool',
      tool: 'pen',
    });
  });

  test('R → tool shape (Phase 24 — single Shape tool)', () => {
    expect(classify(base({ type: 'keydown', key: 'r' }))).toEqual({
      kind: 'tool',
      tool: 'shape',
    });
  });

  test('A → tool arrow', () => {
    expect(classify(base({ type: 'keydown', key: 'a' }))).toEqual({
      kind: 'tool',
      tool: 'arrow',
    });
  });

  test('E → tool eraser', () => {
    expect(classify(base({ type: 'keydown', key: 'e' }))).toEqual({
      kind: 'tool',
      tool: 'eraser',
    });
  });

  test('O → tool shape (Phase 24 — legacy ellipse key now arms Shape)', () => {
    expect(classify(base({ type: 'keydown', key: 'o' }))).toEqual({
      kind: 'tool',
      tool: 'shape',
    });
  });

  test('shape tool owns bare pointer events (SVG overlay claims)', () => {
    expect(classify(base({ type: 'pointerdown', activeTool: 'shape', button: 0 })).kind).toBe(
      'no-op'
    );
    expect(classify(base({ type: 'pointermove', activeTool: 'shape' })).kind).toBe('no-op');
  });

  test('N → tool sticky (Phase 21)', () => {
    expect(classify(base({ type: 'keydown', key: 'n' }))).toEqual({
      kind: 'tool',
      tool: 'sticky',
    });
  });

  test('T → tool text (Phase 21)', () => {
    expect(classify(base({ type: 'keydown', key: 't' }))).toEqual({
      kind: 'tool',
      tool: 'text',
    });
  });

  test('uppercase B (shift held) — still maps to pen (lowercased)', () => {
    expect(classify(base({ type: 'keydown', key: 'B', shiftKey: true }))).toEqual({
      kind: 'tool',
      tool: 'pen',
    });
  });

  test('Cmd+B (modifier-held) → no-op so the browser keeps it', () => {
    expect(classify(base({ type: 'keydown', key: 'b', metaKey: true })).kind).toBe('no-op');
  });
});

describe('input-router / pointer events — Phase 5 annotation tools', () => {
  test('pointermove in pen tool → no-op (SVG overlay owns it)', () => {
    expect(
      classify(base({ type: 'pointermove', activeTool: 'pen', clientX: 1, clientY: 2 })).kind
    ).toBe('no-op');
  });

  test('pointermove in eraser tool → no-op', () => {
    expect(classify(base({ type: 'pointermove', activeTool: 'eraser' })).kind).toBe('no-op');
  });

  test('bare left-click in rect tool → no-op (SVG overlay claims)', () => {
    expect(classify(base({ type: 'pointerdown', activeTool: 'rect', button: 0 })).kind).toBe(
      'no-op'
    );
  });

  test('bare left-click in ellipse tool → no-op (Phase 5.1)', () => {
    expect(classify(base({ type: 'pointerdown', activeTool: 'ellipse', button: 0 })).kind).toBe(
      'no-op'
    );
  });

  test('pointermove in ellipse tool → no-op (SVG overlay owns it)', () => {
    expect(classify(base({ type: 'pointermove', activeTool: 'ellipse' })).kind).toBe('no-op');
  });

  test('sticky + text tools own bare pointer events (Phase 21 — SVG overlay claims)', () => {
    for (const activeTool of ['sticky', 'text'] as const) {
      expect(classify(base({ type: 'pointerdown', activeTool, button: 0 })).kind).toBe('no-op');
      expect(classify(base({ type: 'pointermove', activeTool })).kind).toBe('no-op');
    }
  });

  test('cmd+left-click in arrow tool → select replace (escape hatch to move)', () => {
    expect(
      classify(
        base({
          type: 'pointerdown',
          activeTool: 'arrow',
          button: 0,
          metaKey: true,
          clientX: 4,
          clientY: 5,
        })
      )
    ).toEqual({
      kind: 'select',
      mode: 'replace',
      deep: true,
      clientX: 4,
      clientY: 5,
    });
  });

  test('right-click in pen tool → context-menu (unchanged)', () => {
    expect(classify(base({ type: 'pointerdown', activeTool: 'pen', button: 2 })).kind).toBe(
      'context-menu'
    );
  });
});

describe('input-router / isEditableTarget', () => {
  test('null target → false', () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  test('plain div → false', () => {
    const el = { tagName: 'DIV', isContentEditable: false } as HTMLElement;
    expect(isEditableTarget(el)).toBe(false);
  });

  test('INPUT → true', () => {
    const el = { tagName: 'INPUT', isContentEditable: false } as HTMLElement;
    expect(isEditableTarget(el)).toBe(true);
  });

  test('TEXTAREA → true', () => {
    const el = { tagName: 'TEXTAREA', isContentEditable: false } as HTMLElement;
    expect(isEditableTarget(el)).toBe(true);
  });

  test('contentEditable=true → true', () => {
    const el = { tagName: 'DIV', isContentEditable: true } as HTMLElement;
    expect(isEditableTarget(el)).toBe(true);
  });

  // Dogfood fix — the reported bug: typing "R" while editing in-canvas
  // element text (canvas-shell.tsx's contenteditable="plaintext-only") fired
  // the Rectangle tool shortcut. `.isContentEditable` SHOULD reflect
  // "plaintext-only" per spec, but engine/version inconsistencies mean it
  // can't be the only check — these lock in the raw-attribute fallback that
  // now makes isEditableTarget resilient regardless.
  test('contenteditable="plaintext-only" (isContentEditable false or unreliable) → true', () => {
    const el = {
      tagName: 'DIV',
      isContentEditable: false,
      getAttribute: (name: string) => (name === 'contenteditable' ? 'plaintext-only' : null),
    } as unknown as HTMLElement;
    expect(isEditableTarget(el)).toBe(true);
  });

  test('bare contenteditable="" attribute → true', () => {
    const el = {
      tagName: 'DIV',
      isContentEditable: false,
      getAttribute: (name: string) => (name === 'contenteditable' ? '' : null),
    } as unknown as HTMLElement;
    expect(isEditableTarget(el)).toBe(true);
  });

  test('plain div WITH a getAttribute method (real-element shape) still → false', () => {
    const el = {
      tagName: 'DIV',
      isContentEditable: false,
      getAttribute: () => null,
    } as unknown as HTMLElement;
    expect(isEditableTarget(el)).toBe(false);
  });
});

// T25 — Drag-vs-click threshold. Centralized here so every drag-class gesture
// (artboard drag, artboard marquee, element marquee, annotation pen/rect/etc.)
// reads the same value. Microsoft Win32 SM_CXDRAG default + d3-drag convention.
describe('input-router / crossedDragThreshold', () => {
  test('constant is 4', () => {
    expect(DRAG_THRESHOLD_PX).toBe(4);
  });

  test('no movement → false', () => {
    expect(crossedDragThreshold(100, 200, 100, 200)).toBe(false);
  });

  test('3 px move (sub-threshold) → false', () => {
    expect(crossedDragThreshold(0, 0, 3, 0)).toBe(false);
    expect(crossedDragThreshold(0, 0, 2, 2)).toBe(false); // hypot ≈ 2.83
  });

  test('exactly 4 px → true (boundary inclusive)', () => {
    expect(crossedDragThreshold(0, 0, 4, 0)).toBe(true);
    expect(crossedDragThreshold(0, 0, 0, 4)).toBe(true);
  });

  test('5 px diagonal → true', () => {
    // 3-4-5 right triangle: hypot = 5
    expect(crossedDragThreshold(10, 20, 13, 24)).toBe(true);
  });

  test('negative deltas — hypot is direction-agnostic', () => {
    expect(crossedDragThreshold(50, 50, 47, 46)).toBe(true); // hypot = 5
    expect(crossedDragThreshold(50, 50, 48, 49)).toBe(false); // hypot ≈ 2.24
  });
});

describe('input-router / keydown — undo + redo (Phase 20)', () => {
  test('Cmd+Z → undo', () => {
    expect(classify(base({ type: 'keydown', key: 'z', metaKey: true })).kind).toBe('undo');
  });

  test('Cmd+Shift+Z → redo', () => {
    expect(classify(base({ type: 'keydown', key: 'z', metaKey: true, shiftKey: true })).kind).toBe(
      'redo'
    );
  });

  test('Ctrl+Z → undo (Windows / Linux mac-less)', () => {
    expect(classify(base({ type: 'keydown', key: 'z', ctrlKey: true })).kind).toBe('undo');
  });

  test('Ctrl+Y → redo (Windows convention)', () => {
    expect(classify(base({ type: 'keydown', key: 'y', ctrlKey: true })).kind).toBe('redo');
  });

  test('Cmd+Y → redo (mac users with Windows muscle-memory)', () => {
    expect(classify(base({ type: 'keydown', key: 'y', metaKey: true })).kind).toBe('redo');
  });

  test('Cmd+Z inside editable → no-op (browser native text undo wins)', () => {
    expect(
      classify(base({ type: 'keydown', key: 'z', metaKey: true, isEditable: true })).kind
    ).toBe('no-op');
  });

  test('Cmd+Opt+Z → no-op (Alt is reserved for browser text gestures)', () => {
    expect(classify(base({ type: 'keydown', key: 'z', metaKey: true, altKey: true })).kind).toBe(
      'no-op'
    );
  });

  test('bare Z → no-op (Z is not a tool letter; needs Cmd)', () => {
    expect(classify(base({ type: 'keydown', key: 'z' })).kind).toBe('no-op');
  });

  test('Cmd+Shift+Y → no-op (only Cmd+Y; we do not over-claim)', () => {
    expect(classify(base({ type: 'keydown', key: 'y', metaKey: true, shiftKey: true })).kind).toBe(
      'no-op'
    );
  });
});
