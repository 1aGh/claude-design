import { test } from '@playwright/test';

/**
 * Scene 11: comments — Cmd+0 zoom reset, drop a pin via empty-area click,
 * compose + submit, click an open pin, reply.
 *
 * Intent check: mid-frame OR 75-% frame must show a visible pin dot OR
 * composer text-field on the canvas. If neither, re-shoot with confirmed
 * zoom reset.
 */
test.setTimeout(45_000);

test('comments', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);

  await page.getByRole('treeitem', { name: /^Recipe Recap(\s+\d+)?$/ }).click();
  await page.waitForTimeout(2800);

  const iframe = page.locator('iframe').first();
  await iframe.click({ position: { x: 640, y: 360 } });
  await page.keyboard.press('Meta+0');
  await page.waitForTimeout(700);

  // Switch to Comment tool (C).
  await page.keyboard.press('c');
  await page.waitForTimeout(400);

  // Click an empty area to drop a pin → composer opens.
  await iframe.click({ position: { x: 540, y: 200 } });
  await page.waitForTimeout(800);

  // Type into composer (it auto-focuses).
  await page.keyboard.type('Dýchá to víc?', { delay: 60 });
  await page.waitForTimeout(400);
  await page.keyboard.press('Meta+Enter');
  await page.waitForTimeout(1500);

  // Click the pin again to open the thread popover.
  await iframe.click({ position: { x: 540, y: 200 } });
  await page.waitForTimeout(700);
  await page.keyboard.type('souhlasím', { delay: 60 });
  await page.keyboard.press('Meta+Enter');
  await page.waitForTimeout(1500);
});
