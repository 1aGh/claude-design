// text-caret / collapseEntrySelectAll — issue-106.
//
// Keyboard entry into an annotation text surface (select the stroke, press
// Enter) leaves `placeCaretAt`'s select-all fallback in place — the retype
// convention. That is right for a typed CHARACTER and wrong for Shift+Enter,
// whose whole meaning is "add a new line": the break replaced the selection, so
// pressing it wiped the sticky's body and left one blank line behind.
//
// Needs a live DOM (Selection + Range.compareBoundaryPoints) — register
// happy-dom for THIS file only, like dom-selection.test.ts.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { collapseEntrySelectAll, placeCaretAt } from '../text-caret.ts';

function editable(text: string): HTMLElement {
  document.body.innerHTML = '';
  const el = document.createElement('div');
  el.setAttribute('contenteditable', 'true');
  el.textContent = text;
  document.body.appendChild(el);
  return el;
}

describe('collapseEntrySelectAll', () => {
  test('collapses the entry select-all to the END, keeping the body intact', () => {
    const el = editable('L1\nL2');
    // Exactly what keyboard entry does: no point → select-all fallback.
    placeCaretAt(el, window);
    expect(window.getSelection()?.isCollapsed).toBe(false);

    expect(collapseEntrySelectAll(el, window)).toBe(true);

    const sel = window.getSelection();
    expect(sel?.isCollapsed).toBe(true);
    // Collapsed at the end, so the break the engine inserts next APPENDS.
    expect(sel?.getRangeAt(0).endOffset).toBe(el.childNodes.length);
    expect(el.textContent).toBe('L1\nL2');
  });

  test('leaves an already-collapsed caret alone (the double-click entry path)', () => {
    const el = editable('L1\nL2');
    const r = document.createRange();
    const node = el.firstChild as Node;
    r.setStart(node, 1);
    r.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);

    expect(collapseEntrySelectAll(el, window)).toBe(false);
    expect(window.getSelection()?.getRangeAt(0).startOffset).toBe(1);
  });

  test("leaves a user's own PARTIAL selection alone — replace-the-selected-words keeps native semantics", () => {
    const el = editable('hello world');
    const r = document.createRange();
    const node = el.firstChild as Node;
    r.setStart(node, 0);
    r.setEnd(node, 5); // "hello"
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);

    expect(collapseEntrySelectAll(el, window)).toBe(false);
    expect(window.getSelection()?.isCollapsed).toBe(false);
  });

  test('an empty body has nothing to collapse (fresh-create entry)', () => {
    const el = editable('');
    placeCaretAt(el, window);
    expect(collapseEntrySelectAll(el, window)).toBe(false);
  });

  // issue-106, F6 — deliberate deviation from native contentEditable, pinned so
  // it can't change by accident. The helper cannot tell the entry select-all
  // from the user's own Cmd+A, and Shift+Enter is the one key where "replace
  // everything with a blank line" is never what anyone meant. Typing a
  // character still replaces the selection — only the line break is spared.
  test('Cmd+A then Shift+Enter appends rather than replacing — a deliberate deviation', () => {
    const el = editable('L1\nL2');
    const r = document.createRange();
    r.selectNodeContents(el); // what Cmd+A produces
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);

    expect(collapseEntrySelectAll(el, window)).toBe(true);
    expect(window.getSelection()?.isCollapsed).toBe(true);
    expect(el.textContent).toBe('L1\nL2');
  });
});
