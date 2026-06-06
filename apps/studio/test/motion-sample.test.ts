// Unit cover for the live-motion proof sampler's pure delta test. The browser
// drive itself is integration-shape (needs Chromium + a running dev server);
// here we pin the `signatureChanged` classifier that decides motion-proven vs
// dead-mechanism, so a regression can't silently turn a freeze-frame "pass"
// into a false motion confirmation (DDR-094 M1).

import { describe, expect, test } from 'bun:test';
import { signatureChanged } from '../bin/_motion-sample-playwright.mjs';

const base = { x: 10, y: 10, width: 80, height: 80, transform: 'none', opacity: 1 };

describe('signatureChanged', () => {
  test('identical samples ⇒ no change (dead mechanism)', () => {
    expect(signatureChanged(base, { ...base })).toBe(false);
  });
  test('a bbox shift (morph/scale/translate) ⇒ change', () => {
    expect(signatureChanged(base, { ...base, width: 92 })).toBe(true);
  });
  test('a transform-matrix change ⇒ change (rotate/scale via CSS)', () => {
    expect(signatureChanged(base, { ...base, transform: 'matrix(1,0.2,0,1,0,0)' })).toBe(true);
  });
  test('an opacity fade ⇒ change (no bbox delta)', () => {
    expect(signatureChanged(base, { ...base, opacity: 0.4 })).toBe(true);
  });
  test('sub-epsilon numeric jitter is NOT a change (anti-flake)', () => {
    expect(signatureChanged(base, { ...base, x: 10.1 })).toBe(false);
    expect(signatureChanged(base, { ...base, x: 10.1 }, 0.05)).toBe(true); // tighter eps catches it
  });
  test('the internal __missing marker never counts as a change', () => {
    expect(signatureChanged({ __missing: true }, { __missing: true })).toBe(false);
  });
  test('a null sample is not a change (fail closed)', () => {
    expect(signatureChanged(null, base)).toBe(false);
  });
});
