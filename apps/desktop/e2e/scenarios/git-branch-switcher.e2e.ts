import { $, $$, browser, expect } from '@wdio/globals';

import { capture, startReport } from '../helpers/evidence';
import { isNativeShell } from '../helpers/native';
import { waitForSidecar } from '../helpers/sidecar';

/**
 * DDR-133 — git version-switcher: fast, trustworthy, git-native.
 *
 * Boots the bundled `.app` into a generated multi-branch git repo (wdio.git.conf.ts
 * → make-git-fixture) and drives the bottom-dock RepoBranchSwitcher via data-testid.
 * Proves the three things the fix is about:
 *   1. the branch list POPULATES with multiple branches (local + remote-tracking),
 *      not just `main`, and opens fast (the iso-git statusMatrix crash / 10s-timeout
 *      regression would leave it empty / hung);
 *   2. the labels are GIT-NATIVE ("Merge this branch → main", "default branch",
 *      "Switch branch", "remote · not downloaded yet");
 *   3. NO phantom `origin` row (the origin/HEAD `%(refname:short)` leak we fixed).
 *
 * Fixture branch graph: main (both), feat/local-work (local), feat/nav-redesign
 * (local, current), feat/teammate-draft (remote-only), origin/HEAD (phantom source).
 */
describe('git-branch-switcher (native-desktop)', () => {
  before(async () => {
    startReport('git-branch-switcher (native-desktop)');
    // Cold start may run boot-self-heal (bun install + build) — give injected
    // scripts (isNativeShell / getText) generous headroom so they don't time out
    // while the webview is still bringing the app shell up.
    await browser.setTimeout({ script: 60_000 });
  });

  it('lists all branches fast, git-native, no phantom origin', async () => {
    // 1 — sidecar booted; webview navigated to the loopback dev-server (getUrl-based,
    // robust during the loading phase) BEFORE we run any injected script.
    const url = await waitForSidecar();
    expect(url).toMatch(/^http:\/\/(localhost|127\.0\.0\.1):\d+/);

    // 2 — the switcher renders AT ALL → the dev-server detected a git repo (status.repo).
    // Wait on the DOM (tolerates the slow first boot) before touching the JS context.
    const trigger = await $('[data-testid="repo-switcher-trigger"]');
    await trigger.waitForDisplayed({ timeout: 120_000 });
    await capture('booted-into-git-repo');

    // 3 — confirm we're in the real native shell (now that the shell has mounted)
    expect(await isNativeShell()).toBe(true);
    // current branch is the non-default feature branch
    expect(await trigger.getText()).toContain('feat/nav-redesign');
    await capture('switcher-trigger-on-feature-branch');

    // 4 — open the popup; time how fast the branch list paints. The regression
    // (iso-git on a many-branch repo) crashed / hit the 10s Bun.serve idle timeout
    // and left the list empty; system-git reads paint in well under a second.
    const t0 = Date.now();
    await trigger.click();
    const popup = await $('[data-testid="repo-switcher-popup"]');
    await popup.waitForDisplayed({ timeout: 10_000 });
    const mainRow = await $('[data-testid="branch-row-main"]');
    await mainRow.waitForDisplayed({ timeout: 8_000 });
    const paintMs = Date.now() - t0;
    // eslint-disable-next-line no-console
    console.log(`[git-switcher] branch list painted in ${paintMs} ms`);
    expect(paintMs).toBeLessThan(8_000); // not the 10s-timeout/crash path
    await capture('switcher-open-branches-listed');

    // 4 — MULTIPLE branches present (local + remote-tracking), not just main
    expect(await $('[data-testid="branch-row-main"]').isExisting()).toBe(true);
    expect(await $('[data-testid="branch-row-feat-local-work"]').isExisting()).toBe(true);
    expect(await $('[data-testid="branch-row-feat-teammate-draft"]').isExisting()).toBe(true);
    const rows = await $$('[data-testid^="branch-row-"]');
    expect(rows.length).toBeGreaterThanOrEqual(3);

    // 5 — NO phantom "origin" row (origin/HEAD short-form leak — the bug we fixed)
    expect(await $('[data-testid="branch-row-origin"]').isExisting()).toBe(false);

    // 6 — git-native vocabulary (not the old "Shared version / draft" plain layer)
    const text = await popup.getText();
    expect(text).toContain('Merge this branch → main');
    expect(text).toContain('default branch');
    expect(text).toContain('Switch branch');
    expect(text).toContain('remote · not downloaded yet');
    await capture('git-native-vocabulary-asserted');
  });
});
