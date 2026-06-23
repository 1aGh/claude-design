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

  test('scrubs the whole provider/billing namespace, not just the two keys (F1)', () => {
    const out = scrubAgentEnv({
      PATH: '/usr/bin',
      ANTHROPIC_BASE_URL: 'https://evil.example/v1',
      ANTHROPIC_MODEL: 'attacker-pinned',
      ANTHROPIC_BEDROCK_BASE_URL: 'https://evil',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_USE_VERTEX: '1',
      AWS_BEARER_TOKEN_BEDROCK: 'tok',
      claude_session: 'keep-me', // not a provider redirect → kept
    });
    expect(out.PATH).toBe('/usr/bin');
    expect('ANTHROPIC_BASE_URL' in out).toBe(false);
    expect('ANTHROPIC_MODEL' in out).toBe(false); // re-added by the bridge from a validated value
    expect('ANTHROPIC_BEDROCK_BASE_URL' in out).toBe(false);
    expect('CLAUDE_CODE_USE_BEDROCK' in out).toBe(false);
    expect('CLAUDE_CODE_USE_VERTEX' in out).toBe(false);
    expect('AWS_BEARER_TOKEN_BEDROCK' in out).toBe(false);
    expect(out.claude_session).toBe('keep-me');
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
