import { $, browser, expect } from '@wdio/globals';
import { capture, startReport } from '../helpers/evidence';
import { isNativeShell } from '../helpers/native';
import { waitForSidecar } from '../helpers/sidecar';

/**
 * Regression guard for the desktop "Starting…" hang: a Backspace keypress while
 * no canvas tab is active (or focus is on shell chrome, not an input) must NOT
 * fall through to WKWebView's default back-navigation. Before the fix, the
 * shell-level guard in app.jsx returned before calling preventDefault() in this
 * exact state, letting WebKit navigate back and strand the app on the native
 * splash (apps/desktop/src/index.html, `.status` = "Starting…") with no way to
 * recover. See .ai/logs/rca/issue-desktop-backspace-wkwebview-back-nav-hang.md.
 */
describe('backspace-no-active-canvas-no-hang (native-desktop)', () => {
  before(() => startReport('backspace-no-active-canvas-no-hang (native-desktop)'));

  it('does not hang the shell when Backspace is pressed with no active canvas', async () => {
    expect(await isNativeShell()).toBe(true);

    const appUrl = await waitForSidecar();
    await capture('webview-on-localhost');

    const list = await $('[data-testid="canvas-list"]');
    await list.waitForDisplayed({ timeout: 60_000 });

    // Focus shell chrome (not a text input) — the file tree row area — then
    // press Backspace with no canvas open. Before the fix this reached
    // WebKit's default back-navigation because `activePath` is falsy here.
    await list.click();
    await browser.keys(['Backspace']);
    await capture('backspace-pressed-no-active-canvas');

    // The webview must still be on the dev-server, not reverted to the native
    // splash's file:// URL — the tell-tale of the back-navigation hang.
    const urlAfter = await browser.getUrl();
    expect(urlAfter).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):\d+/);
    expect(urlAfter).toBe(appUrl);

    // The shell is still interactive: the canvas list is still rendered.
    await expect(list).toBeDisplayed();
  });
});
