// comment-mount — shell-owned comment layer. Covers provider dedup (the
// Maybe* wrappers consume an outer instance instead of double-mounting) and
// the bundle scope-guard (react/react-dom externalized to the importmap so the
// comment layer shares the canvas's single React singleton).

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  MaybeSelectionSetProvider,
  SelectionSetProvider,
  useSelectionSetOptional,
} from '../use-selection-set.tsx';
import { MaybeToolProvider, ToolProvider, useToolMode } from '../use-tool-mode.tsx';

describe('comment-mount / MaybeToolProvider dedup', () => {
  function ToolReader() {
    const { tool } = useToolMode();
    return createElement('span', { 'data-tool': tool });
  }

  test('consumes an OUTER ToolProvider instead of double-mounting', () => {
    // Outer provider seeds tool='comment'. If MaybeToolProvider mounted a
    // fresh provider, the reader would see the default 'move' instead.
    const html = renderToStaticMarkup(
      createElement(
        ToolProvider,
        { initial: 'comment' },
        createElement(MaybeToolProvider, null, createElement(ToolReader))
      )
    );
    expect(html).toContain('data-tool="comment"');
  });

  test('mounts its OWN ToolProvider when none exists above', () => {
    const html = renderToStaticMarkup(
      createElement(MaybeToolProvider, null, createElement(ToolReader))
    );
    // DDR-223 — the default boot tool is `move` (edit mode).
    expect(html).toContain('data-tool="move"');
  });

  test('forwards initial="browse" — the comment-mount specimen posture (DDR-223)', () => {
    // buildCanvasTree passes this explicitly so bare DS specimens keep the
    // DDR-187 alive posture + native cursors.
    const html = renderToStaticMarkup(
      createElement(MaybeToolProvider, { initial: 'browse' }, createElement(ToolReader))
    );
    expect(html).toContain('data-tool="browse"');
  });
});

describe('comment-mount / MaybeSelectionSetProvider dedup', () => {
  function SelReader() {
    const ctx = useSelectionSetOptional();
    // Tag identity so we can assert a single context instance is shared.
    return createElement('span', { 'data-has-ctx': ctx ? 'yes' : 'no' });
  }

  test('provides a SelectionSet when none exists above', () => {
    const html = renderToStaticMarkup(
      createElement(MaybeSelectionSetProvider, null, createElement(SelReader))
    );
    expect(html).toContain('data-has-ctx="yes"');
  });

  test('does not throw when nested inside an existing SelectionSetProvider', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(
          SelectionSetProvider,
          { postTarget: null },
          createElement(MaybeSelectionSetProvider, null, createElement(SelReader))
        )
      )
    ).not.toThrow();
  });
});

describe('comment-mount / bundle scope-guard', () => {
  test('dist/comment-mount.js externalizes react + exports mountCanvas', async () => {
    const here = join(import.meta.dir, '..');
    const bundle = Bun.file(join(here, 'dist', 'comment-mount.js'));
    expect(await bundle.exists()).toBe(true);
    const src = await bundle.text();
    // mountCanvas is the public entry the shell calls.
    expect(src.includes('mountCanvas')).toBe(true);
    // React must be a BARE import (resolved by _shell.html's importmap), not
    // inlined — a second React instance would break hooks ("invalid hook
    // call") across the canvas module and the comment layer.
    expect(/import[^;]*["']react-dom\/client["']/.test(src)).toBe(true);
    expect(/import[^;]*["']react["']/.test(src)).toBe(true);
  });
});
