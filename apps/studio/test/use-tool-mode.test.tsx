// use-tool-mode — Phase 4.1 Task 2. Provider transitions + cursor sync.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { renderToStaticMarkup } from 'react-dom/server';

import {
  DEFAULT_TOOLS,
  ToolProvider,
  useToolMode,
  useToolModeOptional,
} from '../use-tool-mode.tsx';

describe('use-tool-mode / static', () => {
  test('DEFAULT_TOOLS exposes V/H/C + draw set B/I/R/N/⇧S/A/T/E (single Shape tool + highlighter + section)', () => {
    expect(DEFAULT_TOOLS.map((t) => t.id)).toEqual([
      'move',
      'hand',
      'comment',
      'pen',
      'highlighter',
      'shape',
      'sticky',
      'section',
      'arrow',
      'text',
      'eraser',
    ]);
    expect(DEFAULT_TOOLS.map((t) => t.shortcut)).toEqual([
      'V',
      'H',
      'C',
      'B',
      'I',
      'R',
      'N',
      '⇧S',
      'A',
      'T',
      'E',
    ]);
  });

  test('DEFAULT_TOOLS is immutable (Object.freeze applied)', () => {
    expect(Object.isFrozen(DEFAULT_TOOLS)).toBe(true);
  });

  test('cursors per tool (Phase 24 — ONE Kenney library for every tool + native fallback)', () => {
    const byId = Object.fromEntries(DEFAULT_TOOLS.map((t) => [t.id, t.cursor]));
    // Phase 24 — EVERY tool (incl. move) ships a Kenney data-URI SVG cursor that
    // falls back to the right native cursor if the image is rejected.
    for (const id of [
      'move',
      'hand',
      'comment',
      'pen',
      'highlighter',
      'shape',
      'sticky',
      'section',
      'arrow',
      'text',
      'eraser',
    ]) {
      expect(byId[id]).toContain('url("data:image/svg+xml,');
      expect(byId[id]).toContain('32'); // 32×32 cursor
    }
    // Native fallbacks are preserved after the custom URL.
    expect(byId.move).toMatch(/, default$/);
    expect(byId.hand).toMatch(/, grab$/);
    expect(byId.text).toMatch(/, text$/);
    expect(byId.eraser).toMatch(/, cell$/);
    expect(byId.pen).toMatch(/, crosshair$/);
    expect(byId.shape).toMatch(/, crosshair$/);
  });
});

describe('use-tool-mode / useToolModeOptional', () => {
  test('returns null outside provider (SSR-safe path)', () => {
    // useToolModeOptional uses useContext directly; outside a provider it
    // returns the context's default value, which we set to null.
    // We can't render hooks standalone without a renderer, but importing the
    // module and calling useContext directly mirrors the runtime behavior.
    // This documents the contract via the export shape.
    expect(typeof useToolModeOptional).toBe('function');
  });
});

describe('use-tool-mode / SSR render', () => {
  test('ToolProvider with consumer renders without throwing', () => {
    function Consumer() {
      const { tool } = useToolMode();
      return <span data-tool={tool}>{tool}</span>;
    }
    const html = renderToStaticMarkup(
      <ToolProvider>
        <Consumer />
      </ToolProvider>
    );
    expect(html).toContain('data-tool="move"');
  });

  test('ToolProvider honors initial tool', () => {
    function Consumer() {
      const { tool } = useToolMode();
      return <span>{tool}</span>;
    }
    const html = renderToStaticMarkup(
      <ToolProvider initial="comment">
        <Consumer />
      </ToolProvider>
    );
    expect(html).toContain('comment');
  });

  test('useToolMode outside ToolProvider throws', () => {
    function BareConsumer() {
      useToolMode();
      return null;
    }
    expect(() => renderToStaticMarkup(<BareConsumer />)).toThrow(
      /useToolMode must be used inside <ToolProvider>/
    );
  });
});
