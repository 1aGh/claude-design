// Unit: pure helpers from use-collab.tsx (color hash + slug derivation).
// The provider itself + the WS round-trip live in browser-shaped harnesses.

import { describe, expect, test } from 'bun:test';

import { canvasSlugFromPath, colorForName } from '../use-collab.tsx';

describe('colorForName', () => {
  test('returns a color from the curated palette', () => {
    const color = colorForName('Alice');
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('deterministic per input', () => {
    const a = colorForName('Alice');
    const b = colorForName('Alice');
    expect(a).toBe(b);
  });

  test('different names land on different colors (probabilistically)', () => {
    // Sample many distinct names; expect at least 8 distinct colors among 30
    // names. With 12-color palette + uniform-ish djb2, this is comfortable.
    const names = Array.from({ length: 30 }, (_, i) => `peer-${i}`);
    const colors = new Set(names.map(colorForName));
    expect(colors.size).toBeGreaterThanOrEqual(8);
  });

  test('empty string returns a palette color (not crash)', () => {
    expect(colorForName('')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test('unicode names work', () => {
    expect(colorForName('Michał Dovrtěl')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(colorForName('佐藤')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('canvasSlugFromPath', () => {
  test('normalizes a typical canvas path', () => {
    expect(canvasSlugFromPath('ui/Foo.tsx')).toBe('ui-foo');
    expect(canvasSlugFromPath('ui/Canvas Viewport.tsx')).toBe('ui-canvas_viewport');
    expect(canvasSlugFromPath('system/project/preview/colors-accent.tsx')).toBe(
      'system-project-preview-colors-accent'
    );
  });

  test('strips .tsx + .html extensions case-insensitively', () => {
    expect(canvasSlugFromPath('ui/Foo.TSX')).toBe('ui-foo');
    expect(canvasSlugFromPath('ui/Foo.html')).toBe('ui-foo');
  });

  test('returns null for paths that would yield invalid slug chars', () => {
    // Dots in name (not extension) survive normalization and fail the gate.
    expect(canvasSlugFromPath('ui/Foo.Bar.tsx')).toBeNull();
    // Empty input.
    expect(canvasSlugFromPath('')).toBeNull();
    expect(canvasSlugFromPath(null)).toBeNull();
    expect(canvasSlugFromPath(undefined)).toBeNull();
  });

  test('round-trips against the slug grammar parseCollabSlug accepts', () => {
    // parseCollabSlug regex = ^[a-z0-9_-]+$
    const re = /^[a-z0-9_-]+$/;
    const samples = ['ui/Foo.tsx', 'system/project/preview/x.tsx', 'a/b c.tsx'];
    for (const s of samples) {
      const slug = canvasSlugFromPath(s);
      expect(slug).not.toBeNull();
      expect(re.test(slug!)).toBe(true);
    }
  });
});
