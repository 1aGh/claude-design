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

  // Single in-page serializer used by BOTH branches (single + multi) so they
  // can't drift again (the `formatXML` 500 bug came from a divergent copy).
  // Note: dom-to-svg exports only elementToSVG / inlineResources /
  // documentToSVG — there is NO `formatXML` pretty-printer; serialize straight
  // to a string. dom-to-svg also does NOT paint the captured root's background
  // fill, so the artboard's background was dropped (item 4) — we prepend a
  // backdrop <rect> from the artboard's effective (visible) background color.
  const serializeOne = async (handle, widenToArtboard) => {
    return await handle.evaluate(
      async (el, opts) => {
        const target = opts.widenToArtboard ? (el.closest('[data-dc-screen]') ?? el) : el;
        // window.domToSvg is the IIFE-injected entry.
        const { elementToSVG, inlineResources } = /** @type any */ (window).domToSvg;

        // Convert ANY computed color (modern Chromium serializes `oklch(...)`
        // verbatim from getComputedStyle) to sRGB rgb()/rgba(). Affinity
        // Designer / older Illustrator / Inkscape don't parse CSS Color 4
        // (`oklch`, `color()`) and silently drop the fill — the artboard then
        // shows as transparent (the exact symptom: bg vanished in Affinity).
        // A 1×1 canvas normalizes any CSS color string to sRGB bytes. Returns
        // null if the value can't be painted (keep the rect off rather than
        // emit a wrong colour).
        const _srgbCache = new Map();
        const _srgbCanvas = document.createElement('canvas');
        _srgbCanvas.width = 1;
        _srgbCanvas.height = 1;
        const _srgbCtx = _srgbCanvas.getContext('2d');
        const toSrgb = (color) => {
          if (_srgbCache.has(color)) return _srgbCache.get(color);
          let result = null;
          try {
            if (_srgbCtx) {
              _srgbCtx.clearRect(0, 0, 1, 1);
              _srgbCtx.fillStyle = '#000';
              _srgbCtx.fillStyle = color; // ignored (stays #000) if syntax unsupported
              _srgbCtx.fillRect(0, 0, 1, 1);
              const [r, g, b, a] = _srgbCtx.getImageData(0, 0, 1, 1).data;
              if (a !== 0) {
                result =
                  a === 255
                    ? `rgb(${r}, ${g}, ${b})`
                    : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
              }
            }
          } catch {
            result = null;
          }
          _srgbCache.set(color, result);
          return result;
        };

        const isOpaque = (bg) =>
          !!bg &&
          bg !== 'transparent' &&
          !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(bg) &&
          !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0(\.0+)?\s*\)$/.test(bg);
        // Effective background of the artboard region: the DS theme bg usually
        // sits on an inner full-bleed wrapper (`.app` / `.mdcc`), occasionally
        // on the artboard element itself, sometimes on body. Descend first to
        // find a near-full-bleed opaque bg, then fall back to ancestors. An
        // intentionally transparent artboard returns null → stays transparent.
        const effectiveBg = (node) => {
          const abRect = node.getBoundingClientRect();
          const abArea = Math.max(1, abRect.width * abRect.height);
          const queue = [node];
          let guard = 0;
          while (queue.length && guard < 80) {
            const e = queue.shift();
            guard += 1;
            const bg = getComputedStyle(e).backgroundColor;
            if (isOpaque(bg)) {
              const r = e.getBoundingClientRect();
              if (r.width * r.height >= abArea * 0.6) return bg;
            }
            for (const c of e.children) queue.push(c);
          }
          let cur = node.parentElement;
          let up = 0;
          while (cur && up < 12) {
            const bg = getComputedStyle(cur).backgroundColor;
            if (isOpaque(bg)) return bg;
            cur = cur.parentElement;
            up += 1;
          }
          return null;
        };

        const bg = effectiveBg(target);
        // Normalize to sRGB so the fill survives in vector editors (item 4 /
        // oklch follow-up). If conversion fails, skip the backdrop rather than
        // emit an unparseable fill.
        const fillColor = bg ? toSrgb(bg) : null;
        const svgDoc = elementToSVG(target);
        const root = svgDoc.documentElement;
        if (fillColor) {
          const NS = 'http://www.w3.org/2000/svg';
          const rect = svgDoc.createElementNS(NS, 'rect');
          const vb = (root.getAttribute('viewBox') || '').split(/\s+/).map(Number);
          if (vb.length === 4 && vb.every((n) => !Number.isNaN(n))) {
            rect.setAttribute('x', String(vb[0]));
            rect.setAttribute('y', String(vb[1]));
            rect.setAttribute('width', String(vb[2]));
            rect.setAttribute('height', String(vb[3]));
          } else {
            rect.setAttribute('x', '0');
            rect.setAttribute('y', '0');
            rect.setAttribute('width', '100%');
            rect.setAttribute('height', '100%');
          }
          rect.setAttribute('fill', fillColor);
          root.insertBefore(rect, root.firstChild);
        }
        // base64-embeds fonts + images so the SVG is portable outside the
        // dev-server origin. Some external fetches fail silently — Affinity
        // tolerates missing resources better than missing primitives.
        try {
          await inlineResources(root);
        } catch {
          /* best-effort */
        }
        let out = new XMLSerializer().serializeToString(svgDoc);
        // dom-to-svg copies computed colours through VERBATIM, and modern
        // Chromium serializes DS tokens as `oklch(...)` — Affinity Designer /
        // older Illustrator / Inkscape can't parse CSS Color 4 and drop every
        // such fill/stroke (the artboard bg + many element colours vanish).
        // Rewrite every CSS Color 4 colour function (oklch/oklab/lch/lab/color)
        // anywhere in the serialized SVG to its sRGB rgb()/rgba() equivalent.
        // Each token is a standalone colour (no nested parens), so a single
        // `\([^)]*\)` match is safe; toSrgb returns null on an unconvertible
        // value and we keep the original rather than corrupt it.
        out = out.replace(/(?:oklch|oklab|lch|lab|color)\([^)]*\)/gi, (m) => toSrgb(m) || m);
        return out;
      },
      { widenToArtboard }
    );
  };

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
      // Each multi handle is already a `[data-dc-screen]` artboard — no widen.
      const svg = await serializeOne(handle, false);
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
    const svg = await serializeOne(handle, widen);
    writeFileSync(out, svg, 'utf8');
    written.push(out);
  }

  for (const w of written) console.log(w);
  console.error(`✓ dom-to-svg wrote ${written.length} svg file(s)`);
} finally {
  await browser.close();
}
