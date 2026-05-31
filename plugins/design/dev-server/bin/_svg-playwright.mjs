// _svg-playwright.mjs — playwright shim for the SVG exporter.
//
// Uses `dom-to-svg` (felixfbecker/dom-to-svg) to walk the rendered DOM and
// emit real SVG primitives — <rect>, <text>, <path>, <image> — that vector
// editors like Affinity Designer / Illustrator / Inkscape decompose
// correctly. The previous `<foreignObject>`-wrapping approach (DDR-038)
// renders pixel-perfect in Chrome but Affinity refuses to import it; see
// DDR-042 for the swap rationale.
//
// Bundled IIFE: exporters/_browser-bundles.ts pre-bundles dom-to-svg via
// Bun.build, caches the result under /tmp, and passes the path via
// --bundle-path. The shim loads it with addScriptTag.
//
// Invocation (Bun.spawn from exporters/svg.ts — not invoked directly):
//   node _svg-playwright.mjs --url <url> --selector <css> --out <path>
//     --bundle-path <iife.js> [--widen-to-artboard] [--multi]
//     [--out-dir <dir>] [--timeout 12]

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
  'bundle-path': bundlePath,
  'widen-to-artboard': widenFlag,
  multi: multiFlag,
  timeout = '12',
} = args;

if (!url || !bundlePath) {
  console.error(
    'usage: _svg-playwright.mjs --url <url> --selector <css> --out <path> --bundle-path <iife.js>'
  );
  process.exit(2);
}

const widen = widenFlag !== undefined;
const multi = multiFlag !== undefined;
const timeoutMs = Number(timeout) * 1000;

const browser = await launchChromium();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
  await page.evaluate(() => document.fonts.ready);
  // Reset the world plane's CSS zoom + transform so artboards render at
  // declared dimensions before dom-to-svg walks the layout.
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
  // Inject dom-to-svg into the page. Bundle attaches its exports under
  // `window.domToSvg`.
  await page.addScriptTag({ path: bundlePath });

  const written = [];

  const serializeOne = async (handle) => {
    return await handle.evaluate(
      async (el, opts) => {
        const target = opts.widenToArtboard ? (el.closest('[data-dc-screen]') ?? el) : el;
        // window.domToSvg is the IIFE-injected entry.
        const { elementToSVG, inlineResources } = /** @type any */ (window).domToSvg;
        const svgDoc = elementToSVG(target);
        // base64-embeds fonts + images so the SVG is portable outside the
        // dev-server origin. Some external fetches fail silently — Affinity
        // tolerates missing resources better than missing primitives.
        try {
          await inlineResources(svgDoc.documentElement);
        } catch {
          /* best-effort */
        }
        return new XMLSerializer().serializeToString(svgDoc);
      },
      { widenToArtboard: opts }
    );
  };
  const opts = { widenToArtboard: widen };

  if (multi) {
    if (!outDir) {
      console.error('_svg-playwright: --multi requires --out-dir');
      process.exit(2);
    }
    mkdirSync(outDir, { recursive: true });
    const screens = await page.locator(selector ?? '[data-dc-screen]').all();
    for (let i = 0; i < screens.length; i += 1) {
      const handle = screens[i];
      const id = (await handle.getAttribute('data-dc-screen')) ?? `artboard-${i + 1}`;
      const svg = await handle.evaluate(async (el) => {
        // window.domToSvg is the IIFE-injected entry. Note: dom-to-svg exports
        // only elementToSVG / inlineResources / documentToSVG — there is NO
        // `formatXML` pretty-printer (calling it threw "formatXML is not a
        // function" and 500'd every canvas-as-separate SVG export). Serialize
        // straight to a string, matching serializeOne above.
        const { elementToSVG, inlineResources } = /** @type any */ (window).domToSvg;
        const svgDoc = elementToSVG(el);
        try {
          await inlineResources(svgDoc.documentElement);
        } catch {
          /* */
        }
        return new XMLSerializer().serializeToString(svgDoc);
      });
      const target = join(outDir, `${id}.svg`);
      writeFileSync(target, svg, 'utf8');
      written.push(target);
    }
  } else {
    if (!out) {
      console.error('_svg-playwright: --out required when --multi not set');
      process.exit(2);
    }
    mkdirSync(dirname(out), { recursive: true });
    const handle = page.locator(selector ?? '[data-dc-screen]:first-of-type').first();
    await handle.waitFor({ state: 'visible', timeout: timeoutMs });
    const svg = await serializeOne(handle);
    writeFileSync(out, svg, 'utf8');
    written.push(out);
  }

  for (const w of written) console.log(w);
  console.error(`✓ dom-to-svg wrote ${written.length} svg file(s)`);
} finally {
  await browser.close();
}
