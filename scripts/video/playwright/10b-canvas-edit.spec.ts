import { test } from '@playwright/test';

/**
 * Scene 10b: canvas edit — Playwright half of split-screen "tui-edit".
 *
 * Pairs with `04-tui-edit.tape`. Opens Recipe Recap canvas and waits for
 * the file-modification to materialize (the live dev-server fires a hard
 * reload when the underlying file changes — the iframe re-renders the
 * updated hero-meta block).
 *
 * Intent check: last 5 s of capture shows Recipe Recap canvas WITH the
 * edit applied (hero-meta visibly changed vs canvas-hero pre-edit).
 */
test.setTimeout(360_000);

test('canvas-edit', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);

  await page.getByRole('treeitem', { name: /^Recipe Recap(\s+\d+)?$/ }).click();
  await page.waitForTimeout(2800);

  // Focus canvas iframe, reset zoom.
  await page
    .locator('iframe')
    .first()
    .click({ position: { x: 640, y: 360 } });
  await page.keyboard.press('Meta+0');

  // Wait for the file-modification (real /design:edit completes in ~30–120 s).
  // The dev-server hard-reloads the iframe when the .tsx changes. We just
  // idle long enough to capture the before/after state in one continuous take.
  await page.waitForTimeout(300_000);
});
