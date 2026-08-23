// _html-playwright.mjs — playwright shim for the HTML exporter.
//
// Walks the rendered DOM, serializes the artboard with every stylesheet
// inlined and EVERY resource embedded as a data: URI (images, fonts, CSS
// url()s, out-of-artboard SVG defs), and emits a self-contained `index.html`
// that opens under file:// with nothing else around. v1 referenced assets by
// absolute URL against a `<base>` — dead the moment the serving origin went
// away, which on the render worker is the end of the job (DDR-232 follow-up).
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
  });

  const written = [];

  // Pin one artboard to (0,0) for its capture, returning a restore function.
  // Per-target rather than a one-shot reset of every `[data-dc-screen]` — a
  // multi-target loop must not leave an already-captured artboard sitting at
  // the origin, overlapping the next target's geometry (the scatter bug).
  const pinArtboard = async (handle) => {
    const saved = await handle.evaluate((el) => {
      const ab = el.closest('[data-dc-screen]') ?? el;
      const prev = { left: ab.style.left, top: ab.style.top };
      ab.style.left = '0px';
      ab.style.top = '0px';
      return prev;
    });
    return async () => {
      await handle.evaluate((el, prev) => {
        const ab = el.closest('[data-dc-screen]') ?? el;
        ab.style.left = prev.left;
        ab.style.top = prev.top;
      }, saved);
    };
  };

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
      const restore = await pinArtboard(handle);
      const html = await serializeOne(handle, false);
      await restore();
      const target = join(outDir, `${id}.html`);
      writeFileSync(target, html, 'utf8');
      written.push(target);
      console.log(`MAUDE_PROGRESS {"current":${i + 1},"total":${screens.length}}`);
    }
  } else {
    if (!out) {
      console.error('_html-playwright: --out required when --multi not set');
      process.exit(2);
    }
    mkdirSync(dirname(out), { recursive: true });
    const handle = page.locator(selector ?? '[data-dc-screen]:first-of-type').first();
    await handle.waitFor({ state: 'visible', timeout: timeoutMs });
    const restore = await pinArtboard(handle);
    const html = await serializeOne(handle, widen);
    await restore();
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
    async (el, opts) => {
      const target = opts.widenToArtboard ? (el.closest('[data-dc-screen]') ?? el) : el;
      // Work on a CLONE — the live canvas must not be mutated (the member may
      // be looking at it on the browser lane's sibling host, and the worker
      // captures several artboards from one page).
      const clone = target.cloneNode(true);

      // Editor chrome never ships (the artboard's own title bar is a child of
      // the artboard — DDR-232 §2). capture-core exposes the one shared list.
      const hidden = window.__maudeCaptureCore?.CAPTURE_HIDDEN_SELECTORS ?? [];
      for (const sel of hidden) {
        if (sel.startsWith('#')) continue;
        for (const n of Array.from(clone.querySelectorAll(sel))) n.remove();
      }

      // ── resource inlining ────────────────────────────────────────────────
      // Until now every src/url() stayed RELATIVE and the doc carried
      // `<base href=<this origin>>`. On the desktop that origin is the dev
      // server (alive only while Maude runs); on the render worker it is the
      // job's THROWAWAY token-proxy loopback, dead the moment the job ends —
      // so a cloud HTML export had no assets at all (DDR-232 follow-up). The
      // file is now self-contained: same-origin fetch → data: URI.
      const cache = new Map();
      const toDataUrl = async (raw) => {
        if (!raw || /^(data:|blob:|#)/.test(raw)) return null;
        let abs;
        try {
          abs = new URL(raw, document.baseURI).href;
        } catch {
          return null;
        }
        if (cache.has(abs)) return cache.get(abs);
        let out = null;
        try {
          const r = await fetch(abs);
          if (r.ok) {
            const blob = await r.blob();
            out = await new Promise((resolve) => {
              const fr = new FileReader();
              fr.onload = () => resolve(String(fr.result));
              fr.onerror = () => resolve(null);
              fr.readAsDataURL(blob);
            });
          }
        } catch {
          out = null;
        }
        cache.set(abs, out);
        return out;
      };

      // <img> — bake a CSS `filter` into the bitmap (a duotone/posterize via an
      // in-page SVG filter), the same rule the SVG/PNG spine applies; an
      // unfiltered image keeps its original bytes.
      const liveImgs = Array.from(target.querySelectorAll('img'));
      const cloneImgs = Array.from(clone.querySelectorAll('img'));
      for (let i = 0; i < cloneImgs.length; i += 1) {
        const c = cloneImgs[i];
        const live = liveImgs[i];
        let data = null;
        const filter = live ? getComputedStyle(live).filter : 'none';
        if (live && filter && filter !== 'none' && live.naturalWidth && live.naturalHeight) {
          try {
            const cv = document.createElement('canvas');
            cv.width = live.naturalWidth;
            cv.height = live.naturalHeight;
            const g = cv.getContext('2d');
            if (g) {
              g.filter = filter;
              if (g.filter === filter) {
                g.drawImage(live, 0, 0);
                data = cv.toDataURL('image/png');
                c.style.filter = 'none';
              }
            }
          } catch {
            data = null;
          }
        }
        if (!data) data = await toDataUrl(c.getAttribute('src'));
        if (data) {
          c.setAttribute('src', data);
          c.removeAttribute('srcset');
        }
      }
      for (const n of Array.from(clone.querySelectorAll('[poster]'))) {
        const d = await toDataUrl(n.getAttribute('poster'));
        if (d) n.setAttribute('poster', d);
      }
      for (const n of Array.from(clone.querySelectorAll('image'))) {
        const href = n.getAttribute('href') ?? n.getAttribute('xlink:href');
        const d = await toDataUrl(href);
        if (d) {
          n.setAttribute('href', d);
          n.setAttribute('xlink:href', d);
        }
      }

      // SVG defs the artboard references but does not CONTAIN — a design
      // system typically mounts its <filter>/<linearGradient>/<pattern> once
      // per canvas, outside any artboard. `outerHTML` of the artboard alone
      // silently dropped them ("the image is still missing some filter").
      const defsHtml = [];
      for (const d of Array.from(
        document.querySelectorAll(
          'filter,linearGradient,radialGradient,pattern,clipPath,mask,symbol'
        )
      )) {
        if (target.contains(d)) continue;
        defsHtml.push(d.outerHTML);
      }
      const defsBlock = defsHtml.length
        ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${defsHtml.join('')}</defs></svg>`
        : '';

      // Stylesheets — every rule, every url() inlined (fonts, background images).
      const cssChunks = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) cssChunks.push(rule.cssText);
        } catch {
          /* cross-origin sheet — skip */
        }
      }
      let css = cssChunks.join('\n');
      const urls = new Set();
      for (const m of css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) urls.add(m[2]);
      for (const u of urls) {
        const d = await toDataUrl(u);
        if (d) css = css.split(u).join(d);
      }

      return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${document.title || 'Maude export'}</title>
<style>${css}</style>
</head>
<body>${defsBlock}${clone.outerHTML}</body>
</html>`;
    },
    { widenToArtboard }
  );
}
