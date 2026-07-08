// KNOB_PROPS round-trip — feature-element-editing-robustness Stage B (Task B1
// + G2 item b). Promoting a property into `KNOB_PROPS` (dom-selection.ts) does
// two things: `styleMapsFor` captures its authored/computed value into the
// `Selection` payload (so the new Position/Transform/Typography/Media panel
// rows have something to render), AND it moves the prop OUT of the Advanced
// "customStyles" escape hatch — a canvas that had one of these as a raw custom
// style no longer double-surfaces it there.
//
// `hoverTargetToSelection` (the exported, already-tested entry point) spreads
// `...styleMapsFor(el)` into its return, so this exercises the real promoted
// list end-to-end without needing to export the private `styleMapsFor`/
// `KNOB_PROPS` internals.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { hoverTargetToSelection } from '../dom-selection.ts';
import type { HoverTarget } from '../input-router.tsx';

function selectionFor(styleText: string) {
  document.body.innerHTML = `<div data-cd-id="aaaaaaaa" style="${styleText}">x</div>`;
  const el = document.querySelector('[data-cd-id]') as HTMLElement;
  const target: HoverTarget = { el, cdId: 'aaaaaaaa', artboardId: null };
  return hoverTargetToSelection(target);
}

describe('KNOB_PROPS — the Stage-B promoted (formerly DDR-104 OUT-list) properties', () => {
  test('position + inset (top/right/bottom/left) + z-index round-trip into authored', () => {
    const sel = selectionFor(
      'position: absolute; top: 10px; right: 20px; bottom: 30px; left: 40px; z-index: 5;'
    );
    expect(sel.authored?.position).toBe('absolute');
    expect(sel.authored?.top).toBe('10px');
    expect(sel.authored?.right).toBe('20px');
    expect(sel.authored?.bottom).toBe('30px');
    expect(sel.authored?.left).toBe('40px');
    expect(sel.authored?.['z-index']).toBe('5');
  });

  test('transform + transform-origin round-trip', () => {
    const sel = selectionFor('transform: rotate(12deg); transform-origin: center;');
    expect(sel.authored?.transform).toBe('rotate(12deg)');
    expect(sel.authored?.['transform-origin']).toBe('center');
  });

  test('font-style / text-transform / text-decoration / white-space round-trip', () => {
    const sel = selectionFor(
      'font-style: italic; text-transform: uppercase; text-decoration: underline; white-space: nowrap;'
    );
    expect(sel.authored?.['font-style']).toBe('italic');
    expect(sel.authored?.['text-transform']).toBe('uppercase');
    expect(sel.authored?.['text-decoration']).toBe('underline');
    expect(sel.authored?.['white-space']).toBe('nowrap');
  });

  test('overflow + media framing (object-fit/aspect-ratio/object-position) round-trip', () => {
    const sel = selectionFor(
      'overflow: hidden; object-fit: cover; aspect-ratio: 16 / 9; object-position: top;'
    );
    expect(sel.authored?.overflow).toBe('hidden');
    expect(sel.authored?.['object-fit']).toBe('cover');
    expect(sel.authored?.['aspect-ratio']).toBe('16 / 9');
    expect(sel.authored?.['object-position']).toBe('top');
  });

  test('a promoted prop never leaks into customStyles (the B1 exclusion gotcha)', () => {
    const sel = selectionFor('position: absolute; cursor: pointer;');
    // `position` is curated now → excluded from the Advanced hatch.
    expect(sel.customStyles?.position).toBeUndefined();
    // A genuinely uncurated prop (not in KNOB_PROPS) still lands in
    // customStyles as before — proves the exclusion is targeted, not a
    // blanket "nothing goes to customStyles anymore" regression.
    expect(sel.customStyles?.cursor).toBe('pointer');
  });

  test('computed values are also captured (placeholder-hint source)', () => {
    const sel = selectionFor('position: relative;');
    expect(sel.computed?.position).toBe('relative');
  });
});
