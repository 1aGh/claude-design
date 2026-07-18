// DDR-185 security addendum — the hardened agent-browser wrapper behind
// `maude design agent-browser-safe` (apps/studio/bin/_agent-browser-safe.mjs).
// This suite locks the SECURITY CORE: the closed subcommand allow-list (no
// cookies/clipboard/storage/connect/chat reachable) and the closed flag
// reject-list (no --profile/--session-name/--allowed-domains/--cdp/
// --auto-connect/--proxy/--engine override of this wrapper's own forced
// safety constraints). See the file's own header comment for the full
// ethical-hacker Finding D rationale this file exists to close.

import { describe, expect, test } from 'bun:test';
import { ALLOWED_SUBCOMMANDS, REJECTED_FLAGS, validateArgv } from './_agent-browser-safe.mjs';

describe('validateArgv — subcommand allow-list', () => {
  for (const sub of ALLOWED_SUBCOMMANDS) {
    test(`accepts the allowed subcommand "${sub}"`, () => {
      expect(validateArgv([sub, 'x'])).toBeNull();
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

  test('rejects a flag appearing BEFORE the subcommand — no global flags permitted ahead of it', () => {
    // agent-browser's own CLI convention places global flags before the
    // subcommand; requiring the subcommand at argv[0] closes the parsing
    // ambiguity a "scan for the first non-flag token" approach would have
    // (e.g. `--color-scheme dark open url` — "dark" is not a flag-looking
    // token either, so a naive scan could misidentify it as the subcommand).
    const reason = validateArgv(['--profile', 'Default', 'open', 'https://github.com']);
    expect(reason).not.toBeNull();
  });
});

describe('validateArgv — rejected flags after the subcommand', () => {
  for (const flag of REJECTED_FLAGS) {
    test(`rejects ${flag} after an otherwise-allowed subcommand`, () => {
      const reason = validateArgv(['open', 'http://localhost:3000', flag, 'x']);
      expect(reason).toContain(flag);
    });
  }

  test('rejects the persistent-profile PoC verbatim (ethical-hacker Finding D)', () => {
    const reason = validateArgv([
      'open',
      '--profile',
      'Default',
      'https://github.com/settings/tokens',
    ]);
    expect(reason).not.toBeNull();
  });

  test('rejects the CDP-attach PoC verbatim (security-auditor finding)', () => {
    const reason = validateArgv(['snapshot', '--cdp', '9222']);
    expect(reason).not.toBeNull();
  });

  test('rejects a `--flag=value` form of a rejected flag, not just the bare form', () => {
    expect(validateArgv(['open', 'http://localhost:3000', '--allowed-domains=*'])).not.toBeNull();
  });

  test('an ordinary allowed invocation with no rejected flags passes', () => {
    expect(
      validateArgv(['eval', "matchMedia('(prefers-reduced-motion: reduce)').matches"])
    ).toBeNull();
    expect(validateArgv(['screenshot', '/tmp/out.png'])).toBeNull();
  });
});
