// artboard-hug-commit.ts — issue #79. The Artboard Inspector's Height
// NumberField silently dropped a typed value whenever the artboard was in
// Hug mode (fixed=false, the default per DDR-027 Design Decision 1) — Width
// always worked because it has no such mode. Typing a height should instead
// promote the artboard to Fixed at that height, same as the Hug/Fixed
// toggle's own freeze-current-height write.

import { describe, expect, test } from 'bun:test';

import { resolveHeightCommit } from '../artboard-hug-commit.ts';

describe('artboard-hug-commit / resolveHeightCommit', () => {
  test('fixed=true → plain resize (Width-field parity)', () => {
    expect(resolveHeightCommit(true, 480)).toEqual({ kind: 'resize', height: 480 });
  });

  test('fixed=false (Hug, the default) → promotes to Fixed at the typed height', () => {
    // Before the fix this typed value was dropped entirely (no action) —
    // reproducing "when I want to set height... manually from inspector
    // panel, nothing happened. Width works."
    expect(resolveHeightCommit(false, 480)).toEqual({ kind: 'promote-to-fixed', height: 480 });
  });

  test('rounds a fractional typed value', () => {
    expect(resolveHeightCommit(true, 480.6)).toEqual({ kind: 'resize', height: 481 });
    expect(resolveHeightCommit(false, 480.6)).toEqual({ kind: 'promote-to-fixed', height: 481 });
  });

  test('non-finite or non-positive input → noop, in either mode', () => {
    expect(resolveHeightCommit(true, Number.NaN)).toEqual({ kind: 'noop' });
    expect(resolveHeightCommit(true, 0)).toEqual({ kind: 'noop' });
    expect(resolveHeightCommit(true, -10)).toEqual({ kind: 'noop' });
    expect(resolveHeightCommit(false, Number.NaN)).toEqual({ kind: 'noop' });
    expect(resolveHeightCommit(false, 0)).toEqual({ kind: 'noop' });
  });
});
