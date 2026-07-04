// _html-playwright.mjs — playwright shim for the HTML exporter.
//
// Walks the rendered DOM, serializes the full document with stylesheets
// inlined, and emits a standalone `index.html`. Web fonts + remote images
// are NOT inlined in v1 — the doc references them by absolute URL so the
// resulting file works under file:// when the user has those origins
// available. Full asset inlining is a follow-up; see plan T5.
//
// Invocation (Bun.spawn from exporters/html.ts — not invoked directly):
//   npm exec --package=playwright -- node _html-playwright.mjs \
//     --url <url> --selector <css> --out <path> \
//     [--widen-to-artboard] [--multi] [--out-dir <dir>] [--timeout 8]

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
  timeout = '8',
} = args;

if (!url) {
  console.error('usage: _html-playwright.mjs --url <url> --selector <css> --out <path>');
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
  await page.evaluate(() => document.fonts.ready);
  // `load` fires before React mounts (and a video comp never reaches
  // `networkidle`), so gate on the artboard rendering before we query it —
  // otherwise a multi `.all()` can run against an empty page.
  await page
    .locator(selector ?? '[data-dc-screen]')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs });
  // Reset the world plane's CSS zoom + transform so the captured artboard
  // outerHTML carries 1440×900 dimensions instead of the pan-zoomed thumb.
  await page.evaluate(() => {
    const world = document.querySelector('.dc-world');
    if (world) {
      world.style.zoom = '1';
      world.style.transform = 'none';
    }
    for (const el of document.querySelectorAll('[data-dc-screen]')) {
      el.style.left = '0px';
      el.style.top = '0px';
    }
  });

  const written = [];

  if (multi) {
    if (!outDir) {
      console.error('_html-playwright: --multi requires --out-dir');
      process.exit(2);
    }
    mkdirSync(outDir, { recursive: true });
    const screens = await page.locator(selector ?? '[data-dc-screen]').all();
    for (let i = 0; i < screens.length; i += 1) {
      const handle = screens[i];
      const id = (await handle.getAttribute('data-dc-screen')) ?? `artboard-${i + 1}`;
      const html = await serializeOne(handle, false);
      const target = join(outDir, `${id}.html`);
      writeFileSync(target, html, 'utf8');
      written.push(target);
    }
  } else {
    if (!out) {
      console.error('_html-playwright: --out required when --multi not set');
      process.exit(2);
    }
    mkdirSync(dirname(out), { recursive: true });
    const handle = page.locator(selector ?? '[data-dc-screen]:first-of-type').first();
    await handle.waitFor({ state: 'visible', timeout: timeoutMs });
    const html = await serializeOne(handle, widen);
    writeFileSync(out, html, 'utf8');
    written.push(out);
  }

  for (const w of written) console.log(w);
  console.error(`✓ playwright wrote ${written.length} html file(s)`);
} finally {
  await browser.close();
}

async function serializeOne(locator, widenToArtboard) {
  return await locator.evaluate(
    (el, opts) => {
      const target = opts.widenToArtboard ? (el.closest('[data-dc-screen]') ?? el) : el;
      const cssChunks = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            cssChunks.push(rule.cssText);
          }
        } catch {
          // Cross-origin sheet — skip.
        }
      }
      const styleBlock = `<style>${cssChunks.join('\n')}</style>`;
      const innerHtml = target.outerHTML;
      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${document.title || 'Maude export'}</title>
<base href="${location.origin}/" />
${styleBlock}
</head>
<body>${innerHtml}</body>
</html>`;
    },
    { widenToArtboard }
  );
}
