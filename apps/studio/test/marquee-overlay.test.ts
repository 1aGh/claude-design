// marquee-overlay — T26 (Wave 3). Aseprite-vocabulary modifier semantics
// table tests + applyMarqueeMode set-algebra tests. Pure functions, no DOM.

import { describe, expect, test } from 'bun:test';

import { applyMarqueeMode, modeOf } from '../marquee-overlay.tsx';
import type { Selection } from '../use-selection-set.tsx';

describe('marquee-overlay / modeOf', () => {
  test('no modifiers → replace', () => {
    expect(modeOf({ shiftKey: false, altKey: false })).toBe('replace');
  });
  test('shift → add', () => {
    expect(modeOf({ shiftKey: true, altKey: false })).toBe('add');
  });
  test('alt → subtract', () => {
    expect(modeOf({ shiftKey: false, altKey: true })).toBe('subtract');
  });
  test('shift+alt → intersect', () => {
    expect(modeOf({ shiftKey: true, altKey: true })).toBe('intersect');
  });
});

describe('marquee-overlay / applyMarqueeMode', () => {
  // Stub `selSet` that records the last call so the test can assert outcome.
  type Recorded = { method: 'replace' | 'add'; payload: Selection[] };
  const makeStub = () => {
    const log: Recorded[] = [];
    const stub = {
      replace: (s: Selection | Selection[]) => {
        log.push({ method: 'replace', payload: Array.isArray(s) ? s : [s] });
      },
      add: (s: Selection | Selection[]) => {
        log.push({ method: 'add', payload: Array.isArray(s) ? s : [s] });
      },
    };
    return { stub, log };
  };

  const sel = (id: string): Selection => ({ id, selector: `[data-cd-id="${id}"]` });

  test('replace with empty hits → no-op (selection preserved)', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'replace', [sel('a')], []);
    expect(log).toHaveLength(0);
  });

  test('replace with hits → swaps to hits', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'replace', [sel('a')], [sel('b'), sel('c')]);
    expect(log).toEqual([{ method: 'replace', payload: [sel('b'), sel('c')] }]);
  });

  test('add with empty hits → no-op', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'add', [sel('a')], []);
    expect(log).toHaveLength(0);
  });

  test('add with hits → adds to existing', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'add', [sel('a')], [sel('b')]);
    expect(log).toEqual([{ method: 'add', payload: [sel('b')] }]);
  });

  test('subtract removes the hit ids from startSet', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'subtract', [sel('a'), sel('b'), sel('c')], [sel('b')]);
    expect(log).toEqual([{ method: 'replace', payload: [sel('a'), sel('c')] }]);
  });

  test('subtract with no overlap → identity (replace with startSet)', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'subtract', [sel('a'), sel('b')], [sel('z')]);
    expect(log).toEqual([{ method: 'replace', payload: [sel('a'), sel('b')] }]);
  });

  test('intersect keeps only ids present in both sets', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(
      stub,
      'intersect',
      [sel('a'), sel('b'), sel('c')],
      [sel('b'), sel('c'), sel('d')]
    );
    expect(log).toEqual([{ method: 'replace', payload: [sel('b'), sel('c')] }]);
  });

  test('intersect with empty hits → clears (empty replace)', () => {
    const { stub, log } = makeStub();
    applyMarqueeMode(stub, 'intersect', [sel('a'), sel('b')], []);
    expect(log).toEqual([{ method: 'replace', payload: [] }]);
  });
});
