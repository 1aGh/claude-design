// dom-selection — resolveByDomPath, the structural fallback comments-overlay
// (and future consumers) reach for when a stored `data-cd-id` selector no
// longer identifies the intended element. This is the DDR-019 renumbering
// scenario: a canvas rewrite (/design:edit regenerating JSX) shifts every
// subsequent element's positional id within a component, so the id can end up
// on an unrelated element, or on none at all. See
// .ai/logs/rca/issue-comment-anchor-drift-and-popup-edge-clamp.md.
//
// Needs a live DOM (querySelectorAll / getAttribute walk) — register happy-dom
// for THIS file only, like annotations-roundtrip.test.ts.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { buildComposeSelection, openCommentComposer, resolveByDomPath } from '../dom-selection.ts';

function setArtboard(html: string): void {
  document.body.innerHTML = `<div data-dc-screen="art1">${html}</div>`;
}

describe('resolveByDomPath', () => {
  test('finds the structurally-matching element when a same-id decoy has the wrong tag', () => {
    // Simulates the renumbering bug: the stored data-cd-id ("bbb22222") now
    // belongs to an unrelated <div>, while the ORIGINAL <button> the comment
    // was anchored to survives under a different id ("ccc33333"). The
    // fallback must find the button by structure, not by the stale id.
    setArtboard(`
      <div data-cd-id="bbb22222" class="decoy">Wrong element now has the old id</div>
      <section class="hero">
        <button class="cta primary" data-cd-id="ccc33333">Buy now</button>
      </section>
    `);
    const found = resolveByDomPath(document, {
      artboardId: 'art1',
      tag: 'button',
      classes: 'cta primary',
      dom_path: [
        'html',
        'body',
        'div[data-dc-screen="art1"]',
        'section.hero',
        'button.cta.primary',
      ],
    });
    expect(found).not.toBeNull();
    expect(found?.getAttribute('data-cd-id')).toBe('ccc33333');
  });

  test('prefers the candidate with the longer matching ancestor suffix over a shallower same-tag sibling', () => {
    setArtboard(`
      <button class="cta primary" data-cd-id="aaa11111">Outer decoy button</button>
      <section class="hero">
        <button class="cta primary" data-cd-id="bbb22222">Nested target</button>
      </section>
    `);
    const found = resolveByDomPath(document, {
      artboardId: 'art1',
      tag: 'button',
      classes: 'cta primary',
      dom_path: [
        'html',
        'body',
        'div[data-dc-screen="art1"]',
        'section.hero',
        'button.cta.primary',
      ],
    });
    expect(found?.getAttribute('data-cd-id')).toBe('bbb22222');
  });

  test('returns null when no element in the artboard shares the stored tag', () => {
    setArtboard(`<div data-cd-id="aaa11111" class="cta primary">Not a button</div>`);
    const found = resolveByDomPath(document, {
      artboardId: 'art1',
      tag: 'button',
      classes: 'cta primary',
      dom_path: ['html', 'body', 'div[data-dc-screen="art1"]', 'button.cta.primary'],
    });
    expect(found).toBeNull();
  });

  test('returns null with no dom_path or no tag (nothing to match against)', () => {
    setArtboard(`<button class="cta primary" data-cd-id="aaa11111">Buy now</button>`);
    expect(
      resolveByDomPath(document, { artboardId: 'art1', tag: 'button', classes: 'cta primary' })
    ).toBeNull();
    expect(
      resolveByDomPath(document, {
        artboardId: 'art1',
        classes: 'cta primary',
        dom_path: ['button.cta.primary'],
      })
    ).toBeNull();
  });

  test('scopes the search to the given artboard — a matching element in a different artboard is ignored', () => {
    document.body.innerHTML = `
      <div data-dc-screen="art1">
        <button class="cta primary" data-cd-id="aaa11111">Art1 button</button>
      </div>
      <div data-dc-screen="art2">
        <section class="hero">
          <button class="cta primary" data-cd-id="bbb22222">Art2 button</button>
        </section>
      </div>
    `;
    const found = resolveByDomPath(document, {
      artboardId: 'art1',
      tag: 'button',
      classes: 'cta primary',
      dom_path: [
        'html',
        'body',
        'div[data-dc-screen="art2"]',
        'section.hero',
        'button.cta.primary',
      ],
    });
    // The art2 button structurally matches perfectly, but art1 is the requested
    // scope — the only art1 candidate is a shallower, shorter-suffix match.
    expect(found?.getAttribute('data-cd-id')).toBe('aaa11111');
  });
});

// issue-90 — right-click "Add comment" on empty canvas background or an
// artboard's chrome/border (neither carries a `data-cd-id`) used to have no
// menu entry at all, and even where the entry DID exist (on an element) it
// never actually opened the composer (see `openCommentComposer` below).
// `buildComposeSelection` is the shared builder canvas-shell.tsx's
// context-menu registry now calls for all three target kinds.
describe('buildComposeSelection', () => {
  test('with an element under the cursor — delegates to hoverTargetToSelection (same anchor a comment-tool click gets)', () => {
    setArtboard(`<button class="cta" data-cd-id="aaa11111">Buy now</button>`);
    const el = document.querySelector('[data-cd-id="aaa11111"]');
    const sel = buildComposeSelection({ el, cdId: 'aaa11111', artboardId: 'art1' }, 100, 200);
    expect(sel.selector).toBe('[data-dc-screen="art1"] [data-cd-id="aaa11111"]');
    expect(sel.id).toBe('aaa11111');
    expect(sel.tag).toBe('button');
  });

  test('with no element (empty canvas background) — a FLOATING selection anchored to the click point', () => {
    document.body.innerHTML = '';
    const sel = buildComposeSelection({ el: null, cdId: null, artboardId: null }, 100, 200);
    expect(sel.selector).toBe('');
    expect(sel.tag).toBe('');
    expect(sel.artboardId).toBeNull();
    expect(sel.bounds).toEqual({ x: 88, y: 188, w: 24, h: 24 });
  });

  test('with no element but INSIDE an artboard (right-click on its chrome/border) — floating, but keeps the artboardId', () => {
    document.body.innerHTML = '';
    const sel = buildComposeSelection({ el: null, cdId: null, artboardId: 'art1' }, 50, 60);
    expect(sel.selector).toBe('');
    expect(sel.artboardId).toBe('art1');
    expect(sel.bounds).toEqual({ x: 38, y: 48, w: 24, h: 24 });
  });
});

describe('openCommentComposer', () => {
  // The regression: canvas-shell.tsx's context-menu "Add comment" used to
  // ONLY postMessage the parent shell (which merely mirrors the target for
  // the StatusBar/sidebar) and never dispatched `cm:open-composer` — the one
  // event `comments-overlay.tsx` listens on to actually render the composer.
  // Selecting the menu item silently did nothing.
  test('dispatches cm:open-composer carrying the selection + click point', () => {
    let detail: { selection?: unknown; clientX?: number; clientY?: number } | null = null;
    const onOpen = (e: Event) => {
      detail = (e as CustomEvent).detail;
    };
    document.addEventListener('cm:open-composer', onOpen);
    const sel = {
      selector: '',
      artboardId: null,
      tag: '',
      classes: '',
      text: '',
      dom_path: [],
      bounds: { x: 30, y: 40, w: 24, h: 24 },
      html: '',
    };
    try {
      openCommentComposer(sel, 42, 52);
    } finally {
      document.removeEventListener('cm:open-composer', onOpen);
    }
    expect(detail).not.toBeNull();
    expect(detail?.selection).toBe(sel);
    expect(detail?.clientX).toBe(42);
    expect(detail?.clientY).toBe(52);
  });
});
