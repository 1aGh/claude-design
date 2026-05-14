// _screenshot-playwright.mjs — playwright fallback for screenshot.sh.
// Element-scoped form (playwright CLI has no --selector flag, so we drive
// chromium via the API for that case). Full-page form is also implemented
// here so screenshot.sh has a single fallback entrypoint regardless of mode.
//
// Invocation (called by screenshot.sh — not directly by users):
//   npm exec --package=playwright -- node _screenshot-playwright.mjs \
//     --url <url> [--selector <css>] --out <path> [--timeout 8]
//
// First invocation may install chromium (~150 MB). Subsequent runs reuse cache.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), all[i + 1]]);
    return acc;
  }, [])
);

const { url, selector, out, timeout = '8' } = args;
if (!url || !out) {
  console.error('usage: _screenshot-playwright.mjs --url <url> [--selector <css>] --out <path> [--timeout 8]');
  process.exit(2);
}

const timeoutMs = Number(timeout) * 1000;
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

  if (selector) {
    const loc = page.locator(selector).first();
    await loc.waitFor({ state: 'visible', timeout: timeoutMs });
    await loc.screenshot({ path: out });
  } else {
    await page.screenshot({ path: out, fullPage: true });
  }
  console.error(`✓ playwright wrote ${out}`);
} finally {
  await browser.close();
}
