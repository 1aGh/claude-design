import { test } from '@playwright/test';

/**
 * Scene 06b: Canvas appears — Playwright half of the split-screen "tui-new".
 *
 * Runs concurrently with `03-tui-new.tape` VHS recording. Watches for the
 * Recipe Recap canvas to materialize in the file tree (the real
 * /design:new --quick execution writes
 * `$SCRATCH/.design/ui/Recipe Recap.tsx`), then clicks it and holds.
 *
 * Test timeout extended to 240 s so the long /design:new compute (real
 * skill invocation + critic loop) fits inside the wait window.
 *
 * Intent check: last 5 s of capture shows Recipe Recap canvas rendered
 * (at least 1 artboard visible).
 */
test.setTimeout(240_000);

test('canvas-appears', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });

  // Initial hydration.
  await page.waitForTimeout(2800);

  // The UI CANVASES section is open by default. Watch for the
  // "Recipe Recap" treeitem to appear (FileRow strips .tsx; display name is
  // "Recipe Recap"). Long wait — real /design:new --quick may take 60–120 s.
  const recipe = page.getByRole('treeitem', { name: /^Recipe Recap(\s+\d+)?$/ });
  await recipe.waitFor({ state: 'visible', timeout: 180_000 });

  // Click to open the canvas iframe.
  await recipe.click();

  // Hold so the last 5 s of capture shows the canvas rendered.
  await page.waitForTimeout(8_000);
});
