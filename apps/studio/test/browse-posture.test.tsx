// browse-posture — feature-4 (browse/move split, DDR-187). The LOAD-BEARING
// gate: a DOM-level proof that the boot-default `browse` tool is a pure native
// pass-through (a real click handler under the cursor fires, nothing is
// claimed), while the `move` (select) tool CLAIMS the same bare click (native
// handler suppressed, onSelect dispatched). This promotes the input-router
// comment-invariant ("bare clicks pass through") into an enforced test — the
// canvas-origin-gate equivalent for the input posture.
//
// Needs a live DOM (capture-phase listeners + event dispatch + a real React
// effect) — register happy-dom + drive a createRoot, same convention as
// canvas-hmr-runtime.test.tsx / specimen-select.test.ts.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { type RouterCallbacks, type Tool, useInputRouter } from '../input-router.tsx';

// A minimal host that mounts the router over a single native <button>. The
// active tool is read fresh at event time via `getActiveTool` (a ref-backed
// getter), so a test can flip the tool without re-rendering.
function Harness({ getTool, callbacks }: { getTool: () => Tool; callbacks: RouterCallbacks }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  useInputRouter({ hostRef, getActiveTool: getTool, callbacks });
  return (
    <div ref={hostRef} className="dc-canvas">
      <button type="button" id="native-btn">
        Click me
      </button>
    </div>
  );
}

function fireBareLeftClick(el: Element): void {
  // The full native sequence the router gates: pointerdown → mousedown → click.
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

describe('browse tool — native pass-through (boot default)', () => {
  test('bare click: native button handler FIRES, onSelect NOT dispatched', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root: Root = createRoot(el);
    let selectCalls = 0;
    let nativeClicks = 0;

    act(() => {
      root.render(
        <Harness getTool={() => 'browse'} callbacks={{ onSelect: () => (selectCalls += 1) }} />
      );
    });

    const btn = el.querySelector('#native-btn') as HTMLButtonElement;
    btn.addEventListener('click', () => (nativeClicks += 1));
    act(() => {
      fireBareLeftClick(btn);
    });

    expect(selectCalls).toBe(0); // browse never selects
    expect(nativeClicks).toBe(1); // the mock stays alive

    act(() => root.unmount());
    el.remove();
  });
});

describe('move (select) tool — claims the bare click', () => {
  test('bare click: native button handler SUPPRESSED, onSelect dispatched', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root: Root = createRoot(el);
    let selectCalls = 0;
    let nativeClicks = 0;

    act(() => {
      root.render(
        <Harness getTool={() => 'move'} callbacks={{ onSelect: () => (selectCalls += 1) }} />
      );
    });

    const btn = el.querySelector('#native-btn') as HTMLButtonElement;
    btn.addEventListener('click', () => (nativeClicks += 1));
    act(() => {
      fireBareLeftClick(btn);
    });

    // Router claims the pointerdown (dispatches select) and swallows the
    // synthetic click so the button under the cursor never activates.
    expect(selectCalls).toBe(1);
    expect(nativeClicks).toBe(0);

    act(() => root.unmount());
    el.remove();
  });
});
