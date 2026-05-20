import { test } from '@playwright/test';

/**
 * Scene 04: DS reveal — tree nav through 4 specimens.
 *
 * Loads scratch dev-server (port 4400, /tmp/scratch-maude-demo-YYYYMMDD).
 * Expands DESIGN SYSTEM section → opens project DS view → clicks each of:
 *   colors-accent → type-scale → components-buttons → components-callout
 * with 1.4 s holds. 2.8 s initial hydration wait.
 *
 * Intent check: mid-frame must show ONE specimen content (type ladder or
 * colors swatches) clearly readable.
 */
test('ds-reveal', async ({ page }) => {
  const url = process.env.DEV_SERVER_URL ?? 'http://localhost:4400/';
  await page.goto(url, { waitUntil: 'networkidle' });

  // Initial hydration — tree renders, DESIGN SYSTEM section appears.
  await page.waitForTimeout(2800);

  // Expand the DESIGN SYSTEM top-level section (it starts collapsed).
  await page.getByRole('button', { name: /^DESIGN SYSTEM/i }).click();
  await page.waitForTimeout(900);

  // Open the project DS view (clicks the folder name button → SystemView).
  await page.getByRole('button', { name: /Open project design system view/i }).click();
  await page.waitForTimeout(1400);

  const specimens = ['colors-accent', 'type-scale', 'components-buttons', 'components-callout'];
  for (const name of specimens) {
    await page.getByRole('treeitem', { name, exact: true }).click();
    await page.waitForTimeout(1400);
  }
});
