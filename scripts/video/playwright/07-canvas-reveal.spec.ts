import { test } from '@playwright/test';

/**
 * Scene 07: canvas reveal — Space+drag pan from hero artboard to print
 * preview, then Cmd+wheel zoom-out to reveal all 4 artboards.
 *
 * Intent check: three sampled frames (25 % / 50 % / 75 %) must show clearly
 * different canvas positions (visible mid-pan motion).
 */
test.setTimeout(45_000);

test('canvas-reveal', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);

  await page.getByRole('treeitem', { name: /^Recipe Recap(\s+\d+)?$/ }).click();
  await page.waitForTimeout(2800);

  // Cmd+0 zoom reset — focus the canvas iframe first.
  await page
    .locator('iframe')
    .first()
    .click({ position: { x: 400, y: 300 } });
  await page.keyboard.press('Meta+0');
  await page.waitForTimeout(700);

  // Space+drag pan — hold Space, drag from right (hero) to left (print preview area).
  await page.keyboard.down('Space');
  await page.mouse.move(900, 360);
  await page.mouse.down();
  await page.mouse.move(900, 360, { steps: 1 });
  // Smooth interpolated drag (steps gives easing).
  await page.mouse.move(300, 360, { steps: 25 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await page.waitForTimeout(1000);

  // Cmd+wheel zoom-out (ctrl+wheel on chromium emulates pinch).
  await page.mouse.move(640, 360);
  await page.keyboard.down('Meta');
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(120);
  }
  await page.keyboard.up('Meta');
  await page.waitForTimeout(1500);
});
