import { test } from '@playwright/test';

/**
 * Phase 15.5-style browser capture: a brief tour of the dev-server.
 * Loads the landing page, lets the canvas browser render, idles 4s.
 * Output: ~5s WebM at 1920×1080 in scripts/video/.work/playwright/<hash>/video.webm.
 *
 * Pre-flight: `plugins/design/dev-server/bin/server-up.sh` must have booted
 * the dev-server already (run.sh handles this in the smoke pipeline).
 */
test('dev-server tour', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4399/';
  await page.goto(url, { waitUntil: 'networkidle' });

  // Let the canvas browser hydrate.
  await page.waitForTimeout(1500);

  // Move the mouse to mid-canvas so the cursor sits in a stable spot for the
  // recording (no jitter from where Playwright parked it).
  await page.mouse.move(960, 540);
  await page.waitForTimeout(3500);
});
