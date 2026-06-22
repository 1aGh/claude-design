// DDR-123 guardrail #1 — the single load-bearing detail that keeps the chat
// panel on the user's Pro/Max subscription instead of metered API billing.

import { describe, expect, test } from 'bun:test';

import { SUBSCRIPTION_SCRUBBED_ENV_KEYS, scrubAgentEnv } from '../acp/env.ts';

describe('scrubAgentEnv — subscription guardrail', () => {
  test('strips the billing-switching keys, keeps everything else', () => {
    const out = scrubAgentEnv({
      PATH: '/usr/bin',
      HOME: '/Users/x',
      ANTHROPIC_API_KEY: 'sk-live-xxx',
      ANTHROPIC_AUTH_TOKEN: 'tok-xxx',
      UNDEFINED_VAR: undefined,
    });
    expect(out.PATH).toBe('/usr/bin');
    expect(out.HOME).toBe('/Users/x');
    expect('ANTHROPIC_API_KEY' in out).toBe(false);
    expect('ANTHROPIC_AUTH_TOKEN' in out).toBe(false);
    // undefined values are dropped (Bun.spawn env wants Record<string,string>)
    expect('UNDEFINED_VAR' in out).toBe(false);
  });

  test('pins exactly the two precedence-relevant keys', () => {
    expect([...SUBSCRIPTION_SCRUBBED_ENV_KEYS].sort()).toEqual([
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
    ]);
  });

  test('never mutates the source (process.env stays intact for the parent)', () => {
    const src: Record<string, string | undefined> = { ANTHROPIC_API_KEY: 'sk', PATH: '/bin' };
    const out = scrubAgentEnv(src);
    expect(src.ANTHROPIC_API_KEY).toBe('sk');
    expect(out).not.toBe(src);
  });

  test('defaults to process.env when called with no argument', () => {
    // Smoke: doesn't throw, returns a string map without the scrubbed keys.
    const out = scrubAgentEnv();
    expect('ANTHROPIC_API_KEY' in out).toBe(false);
  });
});
