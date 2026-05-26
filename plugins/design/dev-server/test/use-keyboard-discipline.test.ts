// use-keyboard-discipline — T29 (Wave 3). Pure nudge-delta fixture.

import { describe, expect, test } from 'bun:test';

import { nudgeDelta } from '../use-keyboard-discipline.tsx';

describe('nudgeDelta', () => {
  test('non-arrow key → null', () => {
    expect(nudgeDelta({ key: 'a', shift: false })).toBeNull();
    expect(nudgeDelta({ key: 'Tab', shift: false })).toBeNull();
    expect(nudgeDelta({ key: 'Enter', shift: true })).toBeNull();
  });

  test('arrow without shift → 1 px step', () => {
    expect(nudgeDelta({ key: 'ArrowLeft', shift: false })).toEqual({ dx: -1, dy: 0 });
    expect(nudgeDelta({ key: 'ArrowRight', shift: false })).toEqual({ dx: 1, dy: 0 });
    expect(nudgeDelta({ key: 'ArrowUp', shift: false })).toEqual({ dx: 0, dy: -1 });
    expect(nudgeDelta({ key: 'ArrowDown', shift: false })).toEqual({ dx: 0, dy: 1 });
  });

  test('arrow with shift → 10 px step', () => {
    expect(nudgeDelta({ key: 'ArrowLeft', shift: true })).toEqual({ dx: -10, dy: 0 });
    expect(nudgeDelta({ key: 'ArrowRight', shift: true })).toEqual({ dx: 10, dy: 0 });
    expect(nudgeDelta({ key: 'ArrowUp', shift: true })).toEqual({ dx: 0, dy: -10 });
    expect(nudgeDelta({ key: 'ArrowDown', shift: true })).toEqual({ dx: 0, dy: 10 });
  });
});
