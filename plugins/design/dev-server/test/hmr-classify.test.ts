// Unit test for hmr-broadcast.ts classifyChange().
//
// The load-bearing case: a canvas/specimen sibling stylesheet (e.g. motion.css
// next to motion.tsx) is INLINED into the built module — there is no <link> for
// the iframe css-swap to target, so it must route to a module reload keyed on
// the sibling .tsx. Link-mounted CSS (tokens / _components / _layout — no
// sibling .tsx) keeps the fast css swap. Regression guard for the silent-drop
// bug (see .ai/logs/rca/hmr-inlined-css-dropped.md).

import { describe, expect, test } from 'bun:test';

import { classifyChange } from '../hmr-broadcast.ts';

describe('classifyChange', () => {
  const noSibling = () => false;
  const hasSibling = () => true;

  test('sibling-tsx CSS → module reload keyed on the .tsx', () => {
    const msg = classifyChange('system/x/preview/motion.css', (cssRel) =>
      cssRel === 'system/x/preview/motion.css'
    );
    expect(msg?.mode).toBe('module');
    expect(msg?.file).toBe('system/x/preview/motion.tsx');
    expect(msg?.scope).toBe('canvas');
  });

  test('link-mounted partial CSS (no sibling .tsx) → css swap', () => {
    expect(classifyChange('system/x/preview/_components.css', noSibling)?.mode).toBe('css');
    expect(classifyChange('system/x/preview/_layout.css', noSibling)?.mode).toBe('css');
    expect(classifyChange('system/x/colors_and_type.css', noSibling)?.mode).toBe('css');
  });

  test('css mode echoes the changed file path', () => {
    const msg = classifyChange('system/x/colors_and_type.css', noSibling);
    expect(msg?.mode).toBe('css');
    expect(msg?.file).toBe('system/x/colors_and_type.css');
  });

  test('_lib/** → hard reload (no file)', () => {
    const msg = classifyChange('_lib/canvas-lib.tsx', hasSibling);
    expect(msg?.mode).toBe('hard');
    expect(msg?.scope).toBe('lib');
    expect(msg?.file).toBeUndefined();
  });

  test('.tsx / .jsx / .ts / .js → module reload', () => {
    for (const f of ['ui/Foo.tsx', 'ui/Foo.jsx', 'ui/Foo.ts', 'ui/Foo.js']) {
      expect(classifyChange(f, noSibling)?.mode).toBe('module');
      expect(classifyChange(f, noSibling)?.file).toBe(f);
    }
  });

  test('.meta.json → meta (not treated as a .json no-op)', () => {
    const msg = classifyChange('ui/Foo.meta.json', noSibling);
    expect(msg?.mode).toBe('meta');
    expect(msg?.file).toBe('ui/Foo.meta.json');
  });

  test('unrelated extensions → null', () => {
    expect(classifyChange('ui/notes.md', noSibling)).toBeNull();
    expect(classifyChange('assets/logo.svg', noSibling)).toBeNull();
  });

  test('backslash paths are normalised before classification', () => {
    const msg = classifyChange('system\\x\\preview\\motion.css', () => true);
    expect(msg?.mode).toBe('module');
    expect(msg?.file).toBe('system/x/preview/motion.tsx');
  });
});
