// DDR-185 security addendum, round 2 — the hardened agent-browser wrapper
// behind `maude design agent-browser-safe`
// (apps/studio/bin/_agent-browser-safe.mjs). This suite locks the SECURITY
// CORE: the closed subcommand allow-list (no cookies/clipboard/storage/
// connect/chat reachable) and — replacing round 1's flag reject-list, which
// a live verification pass found still missed `-p`/`--provider` (routes the
// session through a remote cloud browser) and several env-var equivalents
// of already-rejected flags — a fixed positional-argument ARITY per
// subcommand with NO flag vocabulary of any kind. See the file's own header
// comment for the round-2 rationale.

import { describe, expect, test } from 'bun:test';
import {
  ALLOWED_SUBCOMMANDS,
  CLEARED_ENV_KEYS,
  SUBCOMMAND_ARITY,
  validateArgv,
} from './_agent-browser-safe.mjs';

describe('validateArgv — subcommand allow-list', () => {
  for (const sub of ALLOWED_SUBCOMMANDS) {
    test(`accepts "${sub}" with its minimum expected argument count`, () => {
      const [min] = SUBCOMMAND_ARITY[sub];
      const args = Array.from({ length: min }, (_, i) => `arg${i}`);
      expect(validateArgv([sub, ...args])).toBeNull();
    });
  }

  for (const sub of [
    'cookies',
    'clipboard',
    'storage',
    'connect',
    'chat',
    'upload',
    'auth',
    'profiles',
  ]) {
    test(`rejects the credential/session-hijack-capable subcommand "${sub}" (ethical-hacker Finding D)`, () => {
      const reason = validateArgv([sub, 'get']);
      expect(reason).toContain(sub);
    });
  }

  test('rejects when no subcommand is given', () => {
    expect(validateArgv([])).not.toBeNull();
  });
});

describe('validateArgv — fixed arity, NO flag vocabulary at all (round-2 redesign)', () => {
  test('rejects an extra argument beyond the expected arity, whatever it looks like', () => {
    const reason = validateArgv(['eval', '1+1', 'extra']);
    expect(reason).toContain('exactly 1');
  });

  test('rejects the --provider/-p remote-cloud-browser PoC verbatim (round-2 finding)', () => {
    expect(
      validateArgv(['open', 'http://localhost:1', '--provider', 'browserbase'])
    ).not.toBeNull();
    expect(validateArgv(['open', '-p', 'browserbase', 'http://localhost:1'])).not.toBeNull();
  });

  test('rejects the persistent-profile PoC verbatim (still closed under the new model)', () => {
    expect(
      validateArgv(['open', '--profile', 'Default', 'https://github.com/settings/tokens'])
    ).not.toBeNull();
  });

  test('rejects the CDP-attach PoC verbatim (still closed under the new model)', () => {
    expect(validateArgv(['snapshot', '--cdp', '9222'])).not.toBeNull();
  });

  test('a positional value that itself starts with "-" is NOT mistaken for a flag (arity-based, not prefix-based)', () => {
    // agent-browser-safe eval "-1 + 2" must work — the arity model looks at
    // COUNT, not at whether a token happens to start with a dash.
    expect(validateArgv(['eval', '-1 + 2'])).toBeNull();
  });

  test('screenshot accepts 0 or 1 positional args (optional path)', () => {
    expect(validateArgv(['screenshot'])).toBeNull();
    expect(validateArgv(['screenshot', '/tmp/out.png'])).toBeNull();
    expect(validateArgv(['screenshot', '/tmp/out.png', 'extra'])).not.toBeNull();
  });

  test('get accepts 1 or 2 positional args (thing + optional selector)', () => {
    expect(validateArgv(['get', 'text'])).toBeNull();
    expect(validateArgv(['get', 'text', '.selector'])).toBeNull();
    expect(validateArgv(['get'])).not.toBeNull();
  });

  test('snapshot and close accept exactly 0 arguments', () => {
    expect(validateArgv(['snapshot'])).toBeNull();
    expect(validateArgv(['snapshot', '-i'])).not.toBeNull();
    expect(validateArgv(['close'])).toBeNull();
    expect(validateArgv(['close', '--all'])).not.toBeNull();
  });

  test('an ordinary allowed invocation with no extra args passes', () => {
    expect(
      validateArgv(['eval', "matchMedia('(prefers-reduced-motion: reduce)').matches"])
    ).toBeNull();
    expect(validateArgv(['screenshot', '/tmp/out.png'])).toBeNull();
  });
});

describe('CLEARED_ENV_KEYS — round-2: env-var equivalents of already-rejected flags', () => {
  test('covers the three vars a live verification pass found missing from round 1', () => {
    for (const key of [
      'AGENT_BROWSER_AUTO_CONNECT',
      'AGENT_BROWSER_PROXY',
      'AGENT_BROWSER_ENGINE',
    ]) {
      expect(CLEARED_ENV_KEYS).toContain(key);
    }
  });

  test('covers all four standard proxy env vars, both cases', () => {
    for (const key of [
      'HTTP_PROXY',
      'HTTPS_PROXY',
      'ALL_PROXY',
      'http_proxy',
      'https_proxy',
      'all_proxy',
    ]) {
      expect(CLEARED_ENV_KEYS).toContain(key);
    }
  });

  test('still covers the original round-1 set', () => {
    for (const key of [
      'AGENT_BROWSER_PROFILE',
      'AGENT_BROWSER_SESSION_NAME',
      'AGENT_BROWSER_ACTION_POLICY',
      'AGENT_BROWSER_CONFIRM_ACTIONS',
      'AGENT_BROWSER_CONFIRM_INTERACTIVE',
    ]) {
      expect(CLEARED_ENV_KEYS).toContain(key);
    }
  });
});
