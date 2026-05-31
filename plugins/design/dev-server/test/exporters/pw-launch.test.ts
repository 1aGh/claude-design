// Unit cover for the shared Chromium launcher's error mapping. The launch path
// itself is integration-shape (needs a real browser); here we pin the pure
// classifier + the user-facing contract so a regression can't silently turn the
// "browser not installed" 500 back into an opaque stack trace.
//
// Regression guard for `.ai/logs/rca/issue-nefunguji-exporty.md`.

import { describe, expect, test } from 'bun:test';

import { INSTALL_HINT, NO_BROWSER_EXIT, isMissingBrowserError } from '../../bin/_pw-launch.mjs';

describe('_pw-launch — missing-browser classifier', () => {
  test('matches the real Playwright "Executable doesn\'t exist" message', () => {
    const real =
      "browserType.launch: Executable doesn't exist at " +
      '/Users/x/Library/Caches/ms-playwright/chromium_headless_shell-1223/' +
      'chrome-headless-shell-mac-arm64/chrome-headless-shell\n' +
      '╔════════════════════════════════════════════════════════════╗';
    expect(isMissingBrowserError(real)).toBe(true);
  });

  test('matches the "please run … to download" + "playwright install" variants', () => {
    expect(isMissingBrowserError('Please run the following command to download new browsers')).toBe(
      true
    );
    expect(
      isMissingBrowserError('Looks like Playwright was just installed... npx playwright install')
    ).toBe(true);
  });

  test('does NOT match unrelated launch failures (preserve real diagnostics)', () => {
    expect(isMissingBrowserError('Target page, context or browser has been closed')).toBe(false);
    expect(isMissingBrowserError('connect ECONNREFUSED 127.0.0.1:9222')).toBe(false);
    expect(isMissingBrowserError('Timeout 30000ms exceeded')).toBe(false);
    expect(isMissingBrowserError('')).toBe(false);
    expect(isMissingBrowserError(null)).toBe(false);
    expect(isMissingBrowserError(undefined)).toBe(false);
  });
});

describe('_pw-launch — user-facing contract', () => {
  test('INSTALL_HINT is the copy-pasteable remediation', () => {
    expect(INSTALL_HINT).toContain('npx playwright install chromium');
  });

  test('NO_BROWSER_EXIT is a distinct non-zero code', () => {
    expect(NO_BROWSER_EXIT).toBeGreaterThan(0);
  });
});
