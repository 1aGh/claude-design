// peer-selection-follows-camera — the collaboration counterpart of the
// annotation-resize-handle fix (9ba40b96). A peer's selection frame is measured
// off the LOCAL DOM every render, so it only tracks a pan/zoom if the component
// actually re-renders while the camera moves. Both halos are `memo`, and through
// a gesture the peer's awareness is unchanged — so without a viewport prop that
// ticks with the camera, memo bails out and the frame sits frozen in screen
// space while the artboard it outlines slides away underneath it.
//
// Needs a live DOM (memo bailout + a stubbed getBoundingClientRect) — register
// happy-dom + drive a createRoot, same convention as mode-toggle.test.tsx.

import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PeerAnnotationSelection, PeerSelection } from '../cursors-overlay.tsx';
import type { ForeignAwareness } from '../use-collab.tsx';

// The camera the stubbed measurements project through — stands in for the world
// plane's CSS transform, which is what really moves the target under a pan.
let camera = { x: 0, y: 0, zoom: 1 };

/** A target element whose screen rect follows `camera`, like real canvas content. */
function target(
  attr: string,
  value: string,
  world: { x: number; y: number; w: number; h: number }
) {
  const el = document.createElement('div');
  el.setAttribute(attr, value);
  el.getBoundingClientRect = () =>
    ({
      left: world.x * camera.zoom + camera.x,
      top: world.y * camera.zoom + camera.y,
      width: world.w * camera.zoom,
      height: world.h * camera.zoom,
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

let root: Root | null = null;
let host: HTMLElement | null = null;

function mount(ui: ReactNode): void {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(ui);
  });
}

function rerender(ui: ReactNode): void {
  act(() => {
    root?.render(ui);
  });
}

function frameTransform(): string {
  const el = host?.querySelector('.dc-peer-selection') as HTMLElement | null;
  return el?.style.transform ?? '';
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  document.body.innerHTML = '';
  camera = { x: 0, y: 0, zoom: 1 };
});

// One stable object across the whole test — a real pan/zoom does not touch the
// peer's awareness, and that identity is exactly what makes memo bail out.
const peer = {
  clientID: 7,
  name: 'you@local.test',
  color: 'oklch(56% 0.17 50)',
  cursor: null,
  selection: { cssPath: '[data-cd-id="hero"]' },
  annotationSelection: ['stroke-1'],
} as unknown as ForeignAwareness;

describe('cursors-overlay / PeerSelection', () => {
  test('the frame follows a pan', () => {
    target('data-cd-id', 'hero', { x: 100, y: 60, w: 200, h: 120 });
    mount(<PeerSelection peer={peer} viewport={{ x: 0, y: 0, zoom: 1 }} />);
    expect(frameTransform()).toBe('translate(100px, 60px)');

    camera = { x: -40, y: -25, zoom: 1 };
    rerender(<PeerSelection peer={peer} viewport={camera} />);
    expect(frameTransform()).toBe('translate(60px, 35px)');
  });

  test('the frame follows a zoom (position AND size)', () => {
    target('data-cd-id', 'hero', { x: 100, y: 60, w: 200, h: 120 });
    mount(<PeerSelection peer={peer} viewport={{ x: 0, y: 0, zoom: 1 }} />);

    camera = { x: 0, y: 0, zoom: 2 };
    rerender(<PeerSelection peer={peer} viewport={camera} />);
    const el = host?.querySelector('.dc-peer-selection') as HTMLElement;
    expect(el.style.transform).toBe('translate(200px, 120px)');
    expect(el.style.width).toBe('400px');
    expect(el.style.height).toBe('240px');
  });
});

describe('cursors-overlay / PeerAnnotationSelection', () => {
  test('the stroke halo follows a pan', () => {
    target('data-id', 'stroke-1', { x: 100, y: 60, w: 200, h: 120 });
    mount(<PeerAnnotationSelection peer={peer} viewport={{ x: 0, y: 0, zoom: 1 }} />);
    // Padded 3px so the halo sits OUTSIDE the stroke.
    expect(frameTransform()).toBe('translate(97px, 57px)');

    camera = { x: -40, y: -25, zoom: 1 };
    rerender(<PeerAnnotationSelection peer={peer} viewport={camera} />);
    expect(frameTransform()).toBe('translate(57px, 32px)');
  });
});
