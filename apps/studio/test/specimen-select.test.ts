// specimen-select — feature-element-editing-robustness Stage E (Task E1 + G2).
// A DS preview specimen (`system/<ds>/preview/*.tsx`) has no CanvasShell — no
// `.dc-canvas` host, no artboard-scoped selector. `isBareSpecimen`/
// `pickSpecimenSelectEl` (canvas-comment-mount.tsx) are the generalized select
// resolver that lets a specimen element still resolve to a `Selection` the
// Inspector can edit, with a NULL artboard scope (the selector degrades to a
// bare `[data-cd-id="…"]`, per dom-selection.ts `scopedCdSelector`).
//
// Needs a live DOM (elementFromPoint / closest / querySelector) — register
// happy-dom for this file only, same convention as canvas-hmr-runtime.test.tsx.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { isBareSpecimen, pickSpecimenSelectEl } from '../canvas-comment-mount.tsx';
import { hoverTargetToSelection } from '../dom-selection.ts';
import type { HoverTarget } from '../input-router.tsx';

describe('isBareSpecimen', () => {
  test('true when no .dc-canvas host is mounted (a bare specimen)', () => {
    document.body.innerHTML = '<article data-cd-id="aaaaaaaa"><span>hi</span></article>';
    expect(isBareSpecimen()).toBe(true);
  });

  test('false when a .dc-canvas host is present (a UI canvas owns select instead)', () => {
    document.body.innerHTML =
      '<div class="dc-canvas"><article data-cd-id="aaaaaaaa">hi</article></div>';
    expect(isBareSpecimen()).toBe(false);
  });
});

describe('pickSpecimenSelectEl', () => {
  test('climbs from the raw hit to its closest stamped [data-cd-id] ancestor', () => {
    document.body.innerHTML = '<article data-cd-id="aaaaaaaa"><span id="inner">hi</span></article>';
    const inner = document.getElementById('inner') as HTMLElement;
    const article = document.querySelector('[data-cd-id]') as HTMLElement;
    document.elementFromPoint = () => inner;

    const el = pickSpecimenSelectEl(10, 10);
    expect(el).toBe(article);
  });

  test('falls back to the bare hit when nothing is stamped (defensive, no crash)', () => {
    document.body.innerHTML = '<div id="plain">no cd-id here</div>';
    const plain = document.getElementById('plain') as HTMLElement;
    document.elementFromPoint = () => plain;

    expect(pickSpecimenSelectEl(5, 5)).toBe(plain);
  });

  test('returns null over comment chrome / the resize-handle overlay', () => {
    document.body.innerHTML =
      '<article data-cd-id="aaaaaaaa"><div class="cm-composer"><span id="chrome">x</span></div></article>';
    const chromeEl = document.getElementById('chrome') as HTMLElement;
    document.elementFromPoint = () => chromeEl;

    expect(pickSpecimenSelectEl(1, 1)).toBeNull();
  });

  test('returns null when the hit is HTML/BODY (no content under the cursor)', () => {
    document.elementFromPoint = () => document.body;
    expect(pickSpecimenSelectEl(0, 0)).toBeNull();
  });
});

describe('specimen select → Selection has a NULL artboard scope', () => {
  test('hoverTargetToSelection({artboardId: null}) degrades to a bare [data-cd-id] selector', () => {
    document.body.innerHTML = '<article data-cd-id="aaaaaaaa">hi</article>';
    const el = document.querySelector('[data-cd-id]') as HTMLElement;
    const target: HoverTarget = { el, cdId: 'aaaaaaaa', artboardId: null };

    const sel = hoverTargetToSelection(target);

    expect(sel.artboardId).toBeNull();
    expect(sel.id).toBe('aaaaaaaa');
    // No `[data-dc-screen="…"]` artboard scope prefix — a specimen has no
    // artboard, so the selector must stay bare (dom-selection.ts scopedCdSelector).
    expect(sel.selector).not.toContain('data-dc-screen');
    expect(sel.selector).toContain('data-cd-id="aaaaaaaa"');
  });
});
