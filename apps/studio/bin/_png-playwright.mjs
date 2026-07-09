// _png-playwright.mjs — playwright shim for the PNG exporter.
//
// Replaces the screenshot.sh / agent-browser path because agent-browser
// applies its own viewport sizing that doesn't honor our 1440x900 setup,
// producing clipped captures. With our own playwright we control the
// viewport exactly and crop to the target element's bounding box.

import { mkdirSync } from 'node:fs';
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

const browser = await launchChromium();
try {
  // 1440x900 matches the canvas viewport the design tool uses everywhere;
  // exporters resize per-target before each shot to fit the artboard exactly.
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
  await page.evaluate(() => document.fonts.ready);
  // `load` fires before React mounts (and a video comp never reaches
  // `networkidle`), so gate on the artboard element actually rendering before we
  // query/capture — otherwise a multi `.all()` can run against an empty page.
  await page
    .locator(selector ?? '[data-dc-screen]')
    .first()
    .waitFor({ state: 'visible', timeout: timeoutMs });

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
    await page.evaluate(() => {
      const world = document.querySelector('.dc-world');
      if (world) {
        world.style.zoom = '1';
        world.style.transform = 'none';
      }
    });
    // Pin the captured element's OWN artboard to (0,0). Previously this reset
    // `[data-dc-screen]:first-of-type` regardless of the target, so capturing
    // artboard #2 (or any non-first selection's host) left the wrong artboard
    // at the origin (item 5 root cause). Each artboard carries
    // `style="left:…; top:…;"` for the world layout — zero the right one so the
    // screenshot clip starts at the viewport origin. Save the prior value so it
    // can be restored after this artboard's capture — otherwise every artboard
    // processed earlier in a `--multi` loop is left stacked at (0,0) and bleeds
    // into every subsequent target's clip region (the scatter bug).
    const savedPos = await widenedHandle.evaluate((el) => {
      const ab = el.closest('[data-dc-screen]') ?? el;
      const prev = { left: ab.style.left, top: ab.style.top };
      ab.style.left = '0px';
      ab.style.top = '0px';
      return prev;
    });
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
    // Restore the artboard's original position now that its capture is done,
    // so it doesn't stay pinned at (0,0) and corrupt the next target's clip.
    await widenedHandle.evaluate((el, prev) => {
      const ab = el.closest('[data-dc-screen]') ?? el;
      ab.style.left = prev.left;
      ab.style.top = prev.top;
    }, savedPos);
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
      console.log(`MAUDE_PROGRESS {"current":${i + 1},"total":${screens.length}}`);
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
