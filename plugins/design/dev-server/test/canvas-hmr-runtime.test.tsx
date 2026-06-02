// canvas-hmr-runtime — Phase 13.1 / DDR-077. The resettable error boundary that
// keeps the last good render (no white flash) when an agent edit produces a
// broken intermediate, and recovers when a good build lands.
//
// Error boundaries don't run under renderToStaticMarkup (SSR rethrows), so this
// needs a live DOM. We register happy-dom for THIS file only (like
// annotations-roundtrip.test.ts) and drive a real createRoot.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { act, createElement } from 'react';
import { type Root, createRoot } from 'react-dom/client';

import { CanvasErrorBoundary } from '../canvas-comment-mount.tsx';

function Good({ tag }: { tag: string }) {
  return createElement('div', { 'data-good': tag }, `good:${tag}`);
}
function Boom(): never {
  throw new Error('render exploded (missing import)');
}

function mount(el: HTMLElement) {
  let root!: Root;
  act(() => {
    root = createRoot(el);
  });
  return root;
}

describe('CanvasErrorBoundary', () => {
  test('renders children when they do not throw', () => {
    const host = document.createElement('div');
    const root = mount(host);
    act(() => {
      root.render(
        createElement(
          CanvasErrorBoundary,
          {
            attempt: 0,
            onError: () => {},
            fallback: () => createElement(Good, { tag: 'fallback' }),
          },
          createElement(Good, { tag: 'live' })
        )
      );
    });
    expect(host.querySelector('[data-good="live"]')).not.toBeNull();
    expect(host.querySelector('[data-good="fallback"]')).toBeNull();
    act(() => root.unmount());
  });

  test('a throwing child → renders fallback (NOT blank) and fires onError once', () => {
    const host = document.createElement('div');
    const root = mount(host);
    let errors = 0;
    act(() => {
      root.render(
        createElement(
          CanvasErrorBoundary,
          {
            attempt: 0,
            onError: () => {
              errors++;
            },
            fallback: () => createElement(Good, { tag: 'lastgood' }),
          },
          createElement(Boom)
        )
      );
    });
    // The boundary held a render (the fallback) — the host is NOT empty.
    expect(host.querySelector('[data-good="lastgood"]')).not.toBeNull();
    expect(host.textContent).toContain('good:lastgood');
    expect(errors).toBe(1);
    act(() => root.unmount());
  });

  test('a new attempt with a good child recovers (swaps fallback → live)', () => {
    const host = document.createElement('div');
    const root = mount(host);
    const render = (attempt: number, child: ReturnType<typeof createElement>) =>
      act(() => {
        root.render(
          createElement(
            CanvasErrorBoundary,
            {
              attempt,
              onError: () => {},
              fallback: () => createElement(Good, { tag: 'lastgood' }),
            },
            child
          )
        );
      });

    render(0, createElement(Boom)); // broken build → fallback
    expect(host.querySelector('[data-good="lastgood"]')).not.toBeNull();

    render(1, createElement(Good, { tag: 'fixed' })); // good build lands
    expect(host.querySelector('[data-good="fixed"]')).not.toBeNull();
    expect(host.querySelector('[data-good="lastgood"]')).toBeNull();
    act(() => root.unmount());
  });
});
