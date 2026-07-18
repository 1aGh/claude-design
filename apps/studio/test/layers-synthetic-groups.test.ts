// layers-synthetic-groups — feature-4 T7. The serializer that feeds the shell's
// Layers panel must emit SYNTHETIC group rows for unstamped wrappers that hold
// stamped descendants (so the tree mirrors real nesting), while still omitting
// purely-decorative wrappers with no addressable content. This is the fix for
// the "some layers don't show up / the tree is flat" report.
//
// Needs a live DOM (children / querySelector / closest) — register happy-dom.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(() => {
  GlobalRegistrator.unregister();
});

import { serializeArtboardTree } from '../canvas-shell.tsx';

function root(html: string): Element {
  const el = document.createElement('div');
  el.className = 'dc-artboard-body';
  el.innerHTML = html;
  return el;
}

describe('serializeArtboardTree — synthetic group rows for unstamped wrappers', () => {
  test('unstamped wrapper WITH a stamped descendant → synthetic group parent (nesting preserved)', () => {
    const tree = serializeArtboardTree(
      root('<div class="hero-wrap"><button data-cd-id="aabbccdd">Go</button></div>')
    );
    expect(tree).toHaveLength(1);
    const group = tree[0]!;
    expect(group.synthetic).toBe(true);
    expect(group.type).toBe('group');
    expect(group.id.startsWith('__grp:')).toBe(true);
    expect(group.tag).toBe('div');
    // The stamped button is now a CHILD of the group (not hoisted to the root).
    expect(group.children).toHaveLength(1);
    expect(group.children[0]!.id).toBe('aabbccdd');
    expect(group.children[0]!.synthetic).toBeUndefined();
  });

  test('unstamped wrapper with NO stamped descendant → omitted (no decorative noise)', () => {
    const tree = serializeArtboardTree(root('<div class="deco"><span>just text</span></div>'));
    expect(tree).toHaveLength(0);
  });

  test('stamped child directly → a normal (non-synthetic) row, no group wrapper', () => {
    const tree = serializeArtboardTree(root('<section data-cd-id="11112222">Hi</section>'));
    expect(tree).toHaveLength(1);
    expect(tree[0]!.synthetic).toBeUndefined();
    expect(tree[0]!.id).toBe('11112222');
  });

  test('nested unstamped wrappers → nested synthetic groups (each rung shown)', () => {
    const tree = serializeArtboardTree(
      root('<div class="outer"><div class="inner"><a data-cd-id="deadbeef">L</a></div></div>')
    );
    expect(tree).toHaveLength(1);
    const outer = tree[0]!;
    expect(outer.synthetic).toBe(true);
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0]!;
    expect(inner.synthetic).toBe(true);
    expect(inner.children[0]!.id).toBe('deadbeef');
  });

  test('synthetic group ids are unique across same-signature siblings (stable keys)', () => {
    const tree = serializeArtboardTree(
      root(
        '<div class="col"><span data-cd-id="aaaa1111">a</span></div>' +
          '<div class="col"><span data-cd-id="bbbb2222">b</span></div>'
      )
    );
    expect(tree).toHaveLength(2);
    expect(tree[0]!.id).not.toBe(tree[1]!.id);
    expect(tree[0]!.synthetic).toBe(true);
    expect(tree[1]!.synthetic).toBe(true);
  });

  test('mixed: a stamped element AND a sibling unstamped-wrapper-with-content both surface', () => {
    const tree = serializeArtboardTree(
      root(
        '<h1 data-cd-id="head0001">Title</h1>' +
          '<div class="body"><p data-cd-id="para0001">copy</p></div>'
      )
    );
    expect(tree).toHaveLength(2);
    expect(tree[0]!.id).toBe('head0001');
    expect(tree[0]!.synthetic).toBeUndefined();
    expect(tree[1]!.synthetic).toBe(true);
    expect(tree[1]!.children[0]!.id).toBe('para0001');
  });
});
