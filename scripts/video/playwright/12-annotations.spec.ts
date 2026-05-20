import { test } from '@playwright/test';

/**
 * Scene 12: annotations — pen path + arrow + text label.
 *
 * Intent check: frame at 70 % duration must show ≥ 1 drawn mark + 1 text
 * label.
 */
test.setTimeout(45_000);

test('annotations', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);

  // Treeitem name now includes a comments-count badge (e.g. "Recipe Recap 2");
  // use a regex to match either bare or counted form.
  await page.getByRole('treeitem', { name: /^Recipe Recap(\s+\d+)?$/ }).click();
  await page.waitForTimeout(2800);

  const iframe = page.locator('iframe').first();
  await iframe.click({ position: { x: 640, y: 360 } });
  await page.keyboard.press('Meta+0');
  await page.waitForTimeout(700);

  // Pen tool (B / pen).
  await page.keyboard.press('b');
  await page.waitForTimeout(400);

  // Draw a small 3-point path across the hero area.
  await iframe.click({ position: { x: 380, y: 280 } });
  await page.mouse.move(380, 280);
  await page.mouse.down();
  await page.mouse.move(480, 240, { steps: 12 });
  await page.mouse.move(580, 300, { steps: 12 });
  await page.mouse.move(680, 260, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(800);

  // Arrow tool (A).
  await page.keyboard.press('a');
  await page.waitForTimeout(400);
  await page.mouse.move(720, 320);
  await page.mouse.down();
  await page.mouse.move(900, 380, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(800);

  // Text label (T).
  await page.keyboard.press('t');
  await page.waitForTimeout(400);
  await iframe.click({ position: { x: 460, y: 420 } });
  await page.waitForTimeout(400);
  await page.keyboard.type('+10% spacing', { delay: 60 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
});
