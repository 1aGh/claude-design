// tool-palette.tsx — Stage I3 tail (feature-element-editing-robustness). The
// "+ Element" affordance's anchor resolver: appends relative to the ACTIVE
// artboard's last existing child (mirrors the context-menu's element-relative
// insert, since an artboard's own `<article data-dc-screen>` carries no
// `data-cd-id` of its own — DCArtboard doesn't forward it to the DOM), falling
// back to the artboard's own `data-dc-screen` id (inside-end) when it has no
// such child yet — the empty-artboard fix for the previously-silent no-op.
//
// Needs a live DOM (querySelector/:scope) — register happy-dom for this file
// only, like canvas-hmr-runtime.test.tsx.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { resolveInsertAnchor } from '../tool-palette.tsx';

describe('tool-palette / resolveInsertAnchor', () => {
  test('anchors on the last data-cd-id child of the CURRENT (aria-current) artboard', () => {
    document.body.innerHTML = `
      <article data-dc-screen="a1">
        <div class="dc-artboard-body">
          <div data-cd-id="11111111">one</div>
          <div data-cd-id="22222222">two</div>
        </div>
      </article>
      <article data-dc-screen="a2" aria-current="true">
        <div class="dc-artboard-body">
          <div data-cd-id="33333333">three</div>
          <div data-cd-id="44444444">four</div>
        </div>
      </article>
    `;
    expect(resolveInsertAnchor(document)).toEqual({ refId: '44444444', position: 'after' });
  });

  test('falls back to the FIRST artboard when none is aria-current', () => {
    document.body.innerHTML = `
      <article data-dc-screen="a1">
        <div class="dc-artboard-body"><div data-cd-id="aaaaaaaa">x</div></div>
      </article>
      <article data-dc-screen="a2">
        <div class="dc-artboard-body"><div data-cd-id="bbbbbbbb">y</div></div>
      </article>
    `;
    expect(resolveInsertAnchor(document)).toEqual({ refId: 'aaaaaaaa', position: 'after' });
  });

  test('skips a chrome direct-child with no data-cd-id, picking the last STAMPED one', () => {
    document.body.innerHTML = `
      <article data-dc-screen="a1" aria-current="true">
        <div class="dc-artboard-body">
          <div data-cd-id="11111111">one</div>
          <div class="some-chrome-node">no cd-id</div>
        </div>
      </article>
    `;
    expect(resolveInsertAnchor(document)).toEqual({ refId: '11111111', position: 'after' });
  });

  test('falls back to the artboard id (inside-end) for an EMPTY artboard — no longer a silent no-op', () => {
    document.body.innerHTML = `
      <article data-dc-screen="a1" aria-current="true">
        <div class="dc-artboard-body"></div>
      </article>
    `;
    expect(resolveInsertAnchor(document)).toEqual({ artboardId: 'a1', position: 'inside-end' });
  });

  test('returns null when there is no artboard at all', () => {
    document.body.innerHTML = '<div>no artboards here</div>';
    expect(resolveInsertAnchor(document)).toBeNull();
  });

  test('returns null when the artboard has no .dc-artboard-body wrapper', () => {
    document.body.innerHTML =
      '<article data-dc-screen="a1"><div data-cd-id="11111111">x</div></article>';
    expect(resolveInsertAnchor(document)).toBeNull();
  });
});
