// _pdf-playwright.mjs — playwright shim for the PDF exporter.
//
// Drives Chromium's print-to-PDF (`page.pdf()`) directly so the output is a
// true vector PDF with selectable text — NOT a PNG embedded in a PDF wrapper.
// Per DDR-041 (PDF via page.pdf()): print-media emulation, font readiness
// wait, explicit page size matching the artboard rect.
//
// Invocation (Bun.spawn from exporters/pdf.ts — not invoked directly):
//   node _pdf-playwright.mjs --url <url> --selector <css> --out <path>
//     [--multi] [--out-dir <dir>] [--timeout 12]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { launchChromium } from './_pw-launch.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), all[i + 1] ?? '1']);
    return acc;
  }, [])
);

const { url, selector, out, 'out-dir': outDir, multi: multiFlag, timeout = '12' } = args;

if (!url) {
  console.error('usage: _pdf-playwright.mjs --url <url> --selector <css> --out <path>');
  process.exit(2);
}

const multi = multiFlag !== undefined;
const timeoutMs = Number(timeout) * 1000;

const browser = await launchChromium();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  // Wait for web fonts so `@font-face` glyphs land in the PDF instead of
  // fallback Latin (puppeteer #3183 / playwright equivalent).
  await page.evaluate(() => document.fonts.ready);
  // Print-media emulation — Chromium's PDF output otherwise applies *screen*
  // CSS and ignores `@media print` rules entirely.
  await page.emulateMedia({ media: 'print' });

  const written = [];
  const screens = multi
    ? await page.locator(selector ?? '[data-dc-screen]').all()
    : [page.locator(selector ?? '[data-dc-screen]:first-of-type').first()];

  if (multi && outDir) mkdirSync(outDir, { recursive: true });
  else if (out) mkdirSync(dirname(out), { recursive: true });

  // Reset the world plane's pan/zoom + transform so artboards render at
  // their declared dimensions. CSS `zoom` on .dc-world actually shrinks
  // layout, so getBoundingClientRect returns the post-zoom size unless
  // we zero this. Done once per page; affects every artboard read below.
  await page.evaluate(() => {
    const world = document.querySelector('.dc-world');
    if (world) {
      world.style.zoom = '1';
      world.style.transform = 'none';
    }
  });

  for (let i = 0; i < screens.length; i += 1) {
    const handle = screens[i];
    // Pin each artboard to (0,0) right before its capture so the world's
    // multi-artboard layout doesn't push the bbox off the viewport.
    await handle.evaluate((el) => {
      el.style.left = '0px';
      el.style.top = '0px';
    });
    const rect = await handle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.left, y: r.top };
    });
    // Set the page size to the artboard's pixel dimensions so the resulting
    // PDF is exactly one artboard per page with no margin.
    const targetPath = multi ? join(outDir, `artboard-${i + 1}.pdf`) : out;
    // Crop trick: set the viewport to the artboard rect, scroll it into the
    // top-left corner, then page.pdf() with matching width/height.
    await page.setViewportSize({
      width: Math.ceil(rect.w),
      height: Math.ceil(rect.h),
    });
    await handle.evaluate((el) => {
      el.scrollIntoView({ block: 'start', inline: 'start' });
      window.scrollTo(0, 0);
    });
    const pdf = await page.pdf({
      width: `${Math.ceil(rect.w)}px`,
      height: `${Math.ceil(rect.h)}px`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    writeFileSync(targetPath, pdf);
    written.push(targetPath);
  }

  for (const w of written) console.log(w);
  console.error(`✓ page.pdf wrote ${written.length} file(s)`);
} finally {
  await browser.close();
}
