import { test } from '@playwright/test';

/**
 * Scene 08: canvas hero — 3 Cmd+hovers showing inspector halos, then
 * Cmd+Shift+Click multi-select.
 *
 * Intent check: frames at 4.5 s / 6.0 s / 7.5 s each must show a visible
 * inspector halo outline on a DIFFERENT element. If any frame is
 * halo-less, re-shoot with longer dwell (memory rule: 1.5 s minimum).
 *
 * Pre-flight: reset viewport via /_api/canvas-meta so the canvas starts at
 * zoom=1.0 centered (Cmd+0 sent via keyboard doesn't reliably reach the
 * iframe's document — focus goes to the parent page).
 */
test.setTimeout(60_000);

test('canvas-hero', async ({ page, request }) => {
  // Reset viewport BEFORE navigating.
  await request.patch('http://localhost:4400/_api/canvas-meta', {
    headers: { 'Content-Type': 'application/json' },
    data: { file: 'ui/Recipe Recap.tsx', patch: { viewport: { x: 0, y: 0, zoom: 1 } } },
  });

  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);

  await page.getByRole('treeitem', { name: /^Recipe Recap(\s+\d+)?$/ }).click();
  await page.waitForTimeout(2800);

  // Hold Meta and Cmd+hover three different DCArtboard regions.
  // At zoom=1.0 the artboards are large; we target points inside each.
  await page.keyboard.down('Meta');
  // Hover #1 — inside hero artboard (upper-left area in viewport).
  await page.mouse.move(720, 240);
  await page.waitForTimeout(1800);
  // Hover #2 — inside scaler artboard (upper-middle).
  await page.mouse.move(960, 320);
  await page.waitForTimeout(1800);
  // Hover #3 — inside ingredient list artboard (right).
  await page.mouse.move(1180, 420);
  await page.waitForTimeout(1800);

  // Cmd+Click → single-select on the last hovered region.
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(700);

  // Cmd+Shift+Click on a different region → multi-select.
  await page.keyboard.down('Shift');
  await page.mouse.move(640, 500);
  await page.waitForTimeout(400);
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await page.keyboard.up('Meta');
  await page.waitForTimeout(1500);
});
