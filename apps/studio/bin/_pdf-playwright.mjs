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

const {
  url,
  selector,
  out,
  'out-dir': outDir,
  'widen-to-artboard': widenFlag,
  multi: multiFlag,
  timeout = '12',
} = args;

if (!url) {
  console.error('usage: _pdf-playwright.mjs --url <url> --selector <css> --out <path>');
  process.exit(2);
}

const widen = widenFlag !== undefined;
const multi = multiFlag !== undefined;
const timeoutMs = Number(timeout) * 1000;

const browser = await launchChromium();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
  // Wait for web fonts so `@font-face` glyphs land in the PDF instead of
  // fallback Latin (puppeteer #3183 / playwright equivalent).
  await page.evaluate(() => document.fonts.ready);
  // Print-media emulation — Chromium's PDF output otherwise applies *screen*
  // CSS and ignores `@media print` rules entirely.
  await page.emulateMedia({ media: 'print' });
  // `load` fires before React mounts (and a video comp never reaches
  // `networkidle`), so gate on the artboard rendering before we query it —
  // otherwise a multi `.all()` can run against an empty page.
  await page
    .locator(selector ?? '[data-dc-screen]')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs });

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
    // Widen a descendant selector to its enclosing artboard when requested
    // (artboard-via-descendant fallback); selection / artboard-by-id targets
    // pass through unchanged.
    const handle =
      widen && !multi
        ? await screens[i].evaluateHandle((el) => el.closest('[data-dc-screen]') ?? el)
        : screens[i];
    // Pin the captured element's own artboard to (0,0) right before its
    // capture so the world's multi-artboard layout doesn't push the bbox off
    // the viewport. Save the prior value so it can be restored right after
    // this artboard's PDF is written — otherwise every artboard captured
    // earlier in the loop stays stacked at (0,0) and bleeds into later pages.
    const savedPos = await handle.evaluate((el) => {
      const ab = el.closest('[data-dc-screen]') ?? el;
      const prev = { left: ab.style.left, top: ab.style.top };
      ab.style.left = '0px';
      ab.style.top = '0px';
      return prev;
    });
    const rect = await handle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.left, y: r.top };
    });
    // feature-2-print-artboards T5 — name multi output by the artboard's
    // OWN id (mirrors _png-playwright.mjs's multi-write scheme) rather than
    // a positional index, so the PDF post-pass can correlate each written
    // file back to its artboard's `print` prop via the filename alone.
    const screenId = multi ? await screens[i].getAttribute('data-dc-screen') : null;
    // Set the page size to the artboard's pixel dimensions so the resulting
    // PDF is exactly one artboard per page with no margin.
    const targetPath = multi ? join(outDir, `${screenId || `artboard-${i + 1}`}.pdf`) : out;
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
    // Restore the artboard's original position now that its page is written.
    await handle.evaluate((el, prev) => {
      const ab = el.closest('[data-dc-screen]') ?? el;
      ab.style.left = prev.left;
      ab.style.top = prev.top;
    }, savedPos);
    if (multi) console.log(`MAUDE_PROGRESS {"current":${i + 1},"total":${screens.length}}`);
  }

  for (const w of written) console.log(w);
  console.error(`✓ page.pdf wrote ${written.length} file(s)`);
} finally {
  await browser.close();
}
