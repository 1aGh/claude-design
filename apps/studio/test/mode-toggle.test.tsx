// mode-toggle — DDR-223 (issue #93). The preview/edit mode layer over the
// DDR-187 browse/move tool split: boot posture, the mode⇄tool invariant
// (arming a resting tool moves the mode; annotation tools are mode-neutral),
// resetTool, read-only preview boot, and the palette's segmented toggle.
//
// Needs a live DOM (context callbacks fired via act) — register happy-dom +
// drive a createRoot, same convention as browse-posture.test.tsx.

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
import type { Tool } from '../input-router.tsx';
import { _resetReadOnlyCache } from '../read-only-mode.ts';
import { ToolPalette } from '../tool-palette.tsx';
import { type CanvasMode, ToolProvider, useToolMode } from '../use-tool-mode.tsx';

// Capture the live context value so tests can drive setMode/setTool/resetTool
// directly and assert the resulting (tool, mode) pair.
let ctx: ReturnType<typeof useToolMode> | null = null;
function Capture() {
  ctx = useToolMode();
  return null;
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

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  root = null;
  host = null;
  ctx = null;
  _resetReadOnlyCache();
  setPageUrl('http://localhost/');
});

// happy-dom: `history.replaceState` does not update `location.search`; the
// DetachedWindowAPI `setURL` is the supported seam.
function setPageUrl(url: string): void {
  (window as unknown as { happyDOM?: { setURL?: (u: string) => void } }).happyDOM?.setURL?.(url);
}

const pair = (): { tool: Tool; mode: CanvasMode } => ({
  tool: ctx?.tool as Tool,
  mode: ctx?.mode as CanvasMode,
});

describe('mode-toggle / boot posture (DDR-223)', () => {
  test('default boot = edit with move armed', () => {
    mount(
      <ToolProvider>
        <Capture />
      </ToolProvider>
    );
    expect(pair()).toEqual({ tool: 'move', mode: 'edit' });
  });

  test('initial="browse" boots preview (comment-mount specimen posture)', () => {
    mount(
      <ToolProvider initial="browse">
        <Capture />
      </ToolProvider>
    );
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
  });

  test('read-only (?ro=1) boots preview/browse — the DDR-187 viewer posture', () => {
    setPageUrl('http://localhost/?ro=1');
    _resetReadOnlyCache();
    mount(
      <ToolProvider>
        <Capture />
      </ToolProvider>
    );
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
  });
});

describe('mode-toggle / mode⇄tool invariant', () => {
  test('setMode arms the resting tool both ways', () => {
    mount(
      <ToolProvider>
        <Capture />
      </ToolProvider>
    );
    act(() => ctx?.setMode('preview'));
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
    act(() => ctx?.setMode('edit'));
    expect(pair()).toEqual({ tool: 'move', mode: 'edit' });
  });

  test('arming a resting tool moves the mode (V / tool-set / escape hatch)', () => {
    mount(
      <ToolProvider>
        <Capture />
      </ToolProvider>
    );
    act(() => ctx?.setTool('browse'));
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
    // The Cmd+click-in-browse escape hatch is a plain setTool('move') at its
    // call site — the invariant is what turns it into a coherent mode flip.
    act(() => ctx?.setTool('move'));
    expect(pair()).toEqual({ tool: 'move', mode: 'edit' });
  });

  test('annotation tools are mode-neutral — pen in preview stays preview', () => {
    mount(
      <ToolProvider initial="browse">
        <Capture />
      </ToolProvider>
    );
    act(() => ctx?.setTool('pen'));
    expect(pair()).toEqual({ tool: 'pen', mode: 'preview' });
    act(() => ctx?.setTool('comment'));
    expect(pair()).toEqual({ tool: 'comment', mode: 'preview' });
  });

  test('resetTool arms the CURRENT mode’s resting tool', () => {
    mount(
      <ToolProvider initial="browse">
        <Capture />
      </ToolProvider>
    );
    // Preview: drawing an annotation then resetting returns to browse (the
    // alive posture) — never to move.
    act(() => ctx?.setTool('pen'));
    act(() => ctx?.resetTool());
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
    // Edit: byte-identical to the pre-DDR-223 hardcoded setTool('move').
    act(() => ctx?.setMode('edit'));
    act(() => ctx?.setTool('pen'));
    act(() => ctx?.resetTool());
    expect(pair()).toEqual({ tool: 'move', mode: 'edit' });
  });
});

describe('mode-toggle / palette segmented toggle', () => {
  const mountPalette = () =>
    mount(
      <ToolProvider>
        <Capture />
        <ToolPalette />
      </ToolProvider>
    );
  const seg = (which: 'preview' | 'edit' | 'present'): HTMLButtonElement | null =>
    document.querySelector(`[data-testid="palette-mode-${which}"]`);

  test('renders three icon segments; Edit is pressed on boot; no browse/move tool buttons', () => {
    mountPalette();
    expect(seg('preview')).not.toBeNull();
    expect(seg('edit')?.getAttribute('aria-pressed')).toBe('true');
    expect(seg('preview')?.getAttribute('aria-pressed')).toBe('false');
    // Owner steer 2026-08-15 — icon-only segments (lucide eye / pencil-ruler /
    // presentation); the words live in aria-label/title.
    expect(seg('preview')?.querySelector('svg')).not.toBeNull();
    expect(seg('edit')?.querySelector('svg')).not.toBeNull();
    expect(seg('present')?.querySelector('svg')).not.toBeNull();
    // The segments ARE the resting-tool affordances — no separate Select /
    // Browse buttons in the nav group.
    expect(document.querySelector('[aria-label^="Select (V)"]')).toBeNull();
    expect(document.querySelector('[aria-label^="Browse ("]')).toBeNull();
    // Present moved INTO the toggle — exactly one presentation affordance, and
    // it is the segment (the palette's right-end button is gone).
    const present = document.querySelectorAll('[aria-label^="Presentation mode"]');
    expect(present.length).toBe(1);
    expect(present[0]).toBe(seg('present') as Element);
    expect(seg('present')?.getAttribute('aria-pressed')).toBe('false');
  });

  test('clicking Preview flips the posture; insert (+) is edit-only', () => {
    mountPalette();
    expect(
      document.querySelector('[aria-label="Insert element — Div, Text, or Image"]')
    ).not.toBeNull();
    act(() => {
      seg('preview')?.click();
    });
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
    expect(seg('preview')?.getAttribute('aria-pressed')).toBe('true');
    expect(
      document.querySelector('[aria-label="Insert element — Div, Text, or Image"]')
    ).toBeNull();
    // Draw tools stay available in preview (issue #93: annotations in preview).
    expect(document.querySelector('[aria-label^="Pen (B)"]')).not.toBeNull();
    // And the Edit segment arms move again.
    act(() => {
      seg('edit')?.click();
    });
    expect(pair()).toEqual({ tool: 'move', mode: 'edit' });
  });

  test('clicking the ACTIVE segment re-arms the resting tool', () => {
    mountPalette();
    act(() => {
      seg('preview')?.click();
    });
    act(() => ctx?.setTool('pen'));
    expect(pair()).toEqual({ tool: 'pen', mode: 'preview' });
    act(() => {
      seg('preview')?.click();
    });
    expect(pair()).toEqual({ tool: 'browse', mode: 'preview' });
  });
});
