import { test } from '@playwright/test';

test('dev-server smoke', async ({ page }) => {
  // Default = dev-server landing page (always 200 when server is up).
  // run.sh overrides with DEV_SERVER_URL pointing at a real canvas-shell URL
  // so the smoke video shows the project's Canvas Viewport, not just the shell.
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4399/';
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.mouse.move(640, 360);
  await page.waitForTimeout(2000);
});
