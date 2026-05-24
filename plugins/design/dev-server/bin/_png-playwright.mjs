// _png-playwright.mjs — playwright shim for the PNG exporter.
//
// Replaces the screenshot.sh / agent-browser path because agent-browser
// applies its own viewport sizing that doesn't honor our 1440x900 setup,
// producing clipped captures. With our own playwright we control the
// viewport exactly and crop to the target element's bounding box.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

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
  scale = '1',
} = args;

if (!url) {
  console.error('usage: _png-playwright.mjs --url <url> --selector <css> --out <path>');
  process.exit(2);
}

const widen = widenFlag !== undefined;
const multi = multiFlag !== undefined;
const timeoutMs = Number(timeout) * 1000;
const deviceScaleFactor = Math.max(1, Math.min(4, Number(scale) || 1));

const browser = await chromium.launch();
try {
  // 1440x900 matches the canvas viewport the design tool uses everywhere;
  // exporters resize per-target before each shot to fit the artboard exactly.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  await page.evaluate(() => document.fonts.ready);

  const written = [];

  const captureHandle = async (handle, target) => {
    // Widen to artboard if requested — the selection's selector points at a
    // descendant, but for "Export this artboard" we want the enclosing
    // [data-dc-screen]. Done browser-side so the locator + bbox align.
    const widenedHandle = widen
      ? await handle.evaluateHandle((el) => el.closest('[data-dc-screen]') ?? el)
      : handle;
    // Reset the world plane's pan/zoom so every artboard renders at its
    // declared native dimensions (1440×900 etc.). The dev-server uses CSS
    // `zoom` (not `transform: scale`) on `.dc-world`, which actually shrinks
    // layout — getBoundingClientRect returns 818×512 instead of 1440×900
    // unless we zero both `zoom` and `transform` here.
    await page.evaluate(
      (sel) => {
        const world = document.querySelector('.dc-world');
        if (world) {
          world.style.zoom = '1';
          world.style.transform = 'none';
        }
        // Each artboard carries `style="left: …; top: …;"` so the world plane
        // can position it as part of a multi-artboard layout. Pin the target
        // to (0,0) so the screenshot clip starts at the viewport origin.
        const ab = document.querySelector(sel);
        if (ab) {
          ab.style.left = '0px';
          ab.style.top = '0px';
        }
      },
      widen ? '[data-dc-screen]:first-of-type' : (selector ?? '[data-dc-screen]:first-of-type')
    );
    const rect = await widenedHandle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    // Resize the viewport to fit the artboard so the screenshot doesn't
    // include the world plane's pan/zoom margin. The artboard then sits at
    // (0,0) with its native dimensions.
    await page.setViewportSize({
      width: Math.max(1, Math.ceil(rect.width)),
      height: Math.max(1, Math.ceil(rect.height)),
    });
    await widenedHandle.evaluate((el) => {
      el.scrollIntoView({ block: 'start', inline: 'start' });
      window.scrollTo(0, 0);
    });
    // After scroll, recompute rect — it's now anchored near (0,0).
    const finalRect = await widenedHandle.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    await page.screenshot({
      path: target,
      clip: {
        x: Math.max(0, Math.floor(finalRect.x)),
        y: Math.max(0, Math.floor(finalRect.y)),
        width: Math.max(1, Math.ceil(finalRect.width)),
        height: Math.max(1, Math.ceil(finalRect.height)),
      },
    });
    written.push(target);
  };

  if (multi) {
    if (!outDir) {
      console.error('_png-playwright: --multi requires --out-dir');
      process.exit(2);
    }
    mkdirSync(outDir, { recursive: true });
    const screens = await page.locator(selector ?? '[data-dc-screen]').all();
    for (let i = 0; i < screens.length; i += 1) {
      const handle = screens[i];
      const id = (await handle.getAttribute('data-dc-screen')) ?? `artboard-${i + 1}`;
      await captureHandle(handle, join(outDir, `${id}.png`));
    }
  } else {
    if (!out) {
      console.error('_png-playwright: --out required when --multi not set');
      process.exit(2);
    }
    mkdirSync(dirname(out), { recursive: true });
    const handle = page.locator(selector ?? '[data-dc-screen]:first-of-type').first();
    await handle.waitFor({ state: 'visible', timeout: timeoutMs });
    await captureHandle(handle, out);
  }

  for (const w of written) console.log(w);
  console.error(`✓ playwright wrote ${written.length} png file(s)`);
} finally {
  await browser.close();
}
