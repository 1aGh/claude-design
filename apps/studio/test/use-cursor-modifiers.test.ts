// use-cursor-modifiers — T28 (Wave 3). Pure reducer covers the cross-platform
// Ctrl≡Meta normalization + same-state short-circuit.

import { describe, expect, test } from 'bun:test';

import { type ModifierState, reduceModifiers } from '../use-cursor-modifiers.tsx';

const initial: ModifierState = { alt: false, shift: false, meta: false };

const k = (over: Partial<KeyboardEventInit & { ctrlKey: boolean }> = {}) => ({
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  ...over,
});

describe('reduceModifiers', () => {
  test('no change → returns same reference (cheap equality)', () => {
    const out = reduceModifiers(initial, k());
    expect(out).toBe(initial);
  });

  test('alt down → alt:true', () => {
    const out = reduceModifiers(initial, k({ altKey: true }));
    expect(out).toEqual({ alt: true, shift: false, meta: false });
  });

  test('shift down → shift:true', () => {
    const out = reduceModifiers(initial, k({ shiftKey: true }));
    expect(out).toEqual({ alt: false, shift: true, meta: false });
  });

  test('meta down → meta:true', () => {
    const out = reduceModifiers(initial, k({ metaKey: true }));
    expect(out).toEqual({ alt: false, shift: false, meta: true });
  });

  test('ctrl is normalized to meta (cross-platform parity)', () => {
    const out = reduceModifiers(initial, k({ ctrlKey: true }));
    expect(out.meta).toBe(true);
  });

  test('meta + ctrl together → meta:true (not duplicated)', () => {
    const out = reduceModifiers(initial, k({ metaKey: true, ctrlKey: true }));
    expect(out).toEqual({ alt: false, shift: false, meta: true });
  });

  test('alt+shift simultaneously → both true', () => {
    const out = reduceModifiers(initial, k({ altKey: true, shiftKey: true }));
    expect(out).toEqual({ alt: true, shift: true, meta: false });
  });

  test('releasing alt while shift still held → shift only', () => {
    const both: ModifierState = { alt: true, shift: true, meta: false };
    const out = reduceModifiers(both, k({ shiftKey: true })); // alt released
    expect(out).toEqual({ alt: false, shift: true, meta: false });
  });
});
