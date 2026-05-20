import { test } from '@playwright/test';

/**
 * Scene 14: docs — smooth-scroll the maude site via scrollTo, NOT
 * mouse.wheel (memory rule: external URL scrolls must use evaluate +
 * window.scrollTo({behavior:'smooth'}), wheel emits jumpy native events).
 *
 * Intent check: frame at 0.5 s must NOT be pure white — must show
 * "Plugins & Vibes." headline OR any rendered content. Three scroll
 * samples must show different scroll positions.
 */
test.setTimeout(20_000);

test('docs', async ({ page }) => {
  await page.goto('https://maude.iagh.cz', { waitUntil: 'networkidle' });
  // ≥ 2.5 s paint wait (memory rule).
  await page.waitForTimeout(3_000);

  await page.evaluate(() => {
    window.scrollTo({ top: 600, behavior: 'smooth' });
  });
  await page.waitForTimeout(1_200);

  await page.evaluate(() => {
    window.scrollTo({ top: 1200, behavior: 'smooth' });
  });
  await page.waitForTimeout(1_500);
});
