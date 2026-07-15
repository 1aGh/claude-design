// Pure unit tests for client/panels/acp-usage.js — parseUsage (Tasks D2/D4).

import { describe, expect, test } from 'bun:test';

import { parseUsage } from '../client/panels/acp-usage.js';

const NOW = 1_700_000_000_000;

describe('parseUsage — context + cost', () => {
  test('computes a rounded percentage from used/size', () => {
    const result = parseUsage({ t: 'usage', usage: { used: 4200, size: 200000 } }, NOW);
    expect(result.context).toEqual({ used: 4200, size: 200000, pct: 2 });
    expect(result.asOf).toBe(NOW);
  });

  test('clamps the percentage to [0,100] against a bogus used > size', () => {
    const result = parseUsage({ usage: { used: 999999, size: 1000 } }, NOW);
    expect(result.context?.pct).toBe(100);
  });

  test('size:0 (or missing) yields no context gauge rather than dividing by zero', () => {
    expect(parseUsage({ usage: { used: 10, size: 0 } }, NOW).context).toBeNull();
    expect(parseUsage({ usage: { used: 10 } }, NOW).context).toBeNull();
  });

  test('carries cost through, defaulting currency to USD when absent', () => {
    const result = parseUsage({ usage: { used: 1, size: 2, cost: { amount: 0.5, currency: 'EUR' } } }, NOW);
    expect(result.cost).toEqual({ amount: 0.5, currency: 'EUR' });
  });

  test('no cost on the frame → null, not undefined/0', () => {
    expect(parseUsage({ usage: { used: 1, size: 2 } }, NOW).cost).toBeNull();
  });
});

describe('parseUsage — rate limit (SDKRateLimitInfo fixtures)', () => {
  const TYPES = [
    ['five_hour', '5-hour limit'],
    ['seven_day', 'Weekly limit'],
    ['seven_day_opus', 'Weekly · Opus'],
    ['seven_day_sonnet', 'Weekly · Sonnet'],
    ['seven_day_overage_included', 'Weekly (overage included)'],
    ['overage', 'Overage'],
  ];

  for (const [type, label] of TYPES) {
    test(`maps rateLimitType "${type}" → "${label}"`, () => {
      const result = parseUsage(
        {
          usage: {
            used: 1,
            size: 2,
            rateLimit: { status: 'allowed_warning', rateLimitType: type, utilization: 61, resetsAt: 123 },
          },
        },
        NOW
      );
      expect(result.rateLimit).toEqual({ type, label, pct: 61, resetsAt: 123, status: 'allowed_warning' });
    });
  }

  test('an unrecognized rateLimitType falls back to a generic label, not undefined', () => {
    const result = parseUsage(
      { usage: { used: 1, size: 2, rateLimit: { status: 'rejected', rateLimitType: 'something_new' } } },
      NOW
    );
    expect(result.rateLimit?.label).toBe('Usage limit');
  });

  test('null/missing rate-limit on the frame → gauge-only (rateLimit: null), no crash', () => {
    expect(parseUsage({ usage: { used: 1, size: 2, rateLimit: null } }, NOW).rateLimit).toBeNull();
    expect(parseUsage({ usage: { used: 1, size: 2 } }, NOW).rateLimit).toBeNull();
  });

  test('utilization/resetsAt clamp + tolerate missing fields', () => {
    const result = parseUsage(
      { usage: { used: 1, size: 2, rateLimit: { status: 'allowed', utilization: 250 } } },
      NOW
    );
    expect(result.rateLimit).toEqual({ type: null, label: 'Usage limit', pct: 100, resetsAt: null, status: 'allowed' });
  });
});

describe('parseUsage — malformed input tolerance', () => {
  test('missing usage entirely → all-null shape, never throws', () => {
    expect(parseUsage({}, NOW)).toEqual({ context: null, cost: null, rateLimit: null, asOf: NOW });
    expect(parseUsage(undefined, NOW)).toEqual({ context: null, cost: null, rateLimit: null, asOf: NOW });
    expect(parseUsage(null, NOW)).toEqual({ context: null, cost: null, rateLimit: null, asOf: NOW });
  });

  test('a malformed _meta-derived rateLimit (not an object) is tolerated', () => {
    expect(() => parseUsage({ usage: { used: 1, size: 2, rateLimit: 'not-an-object' } }, NOW)).not.toThrow();
    expect(parseUsage({ usage: { used: 1, size: 2, rateLimit: 'not-an-object' } }, NOW).rateLimit).toBeNull();
  });

  test('defaults `now` to Date.now() when not injected', () => {
    const before = Date.now();
    const result = parseUsage({ usage: { used: 1, size: 2 } });
    const after = Date.now();
    expect(result.asOf).toBeGreaterThanOrEqual(before);
    expect(result.asOf).toBeLessThanOrEqual(after);
  });
});
