// export-capture-hygiene.test.ts — DDR-231 Phase 2 T2/T3.
//
// The Phase-1 fidelity gate (export-capture-fidelity.test.ts) compares the
// browser lane against the playwright reference IN THE SAME ENGINE on a
// fixture that has neither editor chrome nor a network-loaded asset. Both
// defects the first live cloud export hit therefore passed it clean:
//
//   1. CHROME LEAK — the browser lane captures the LIVE canvas DOM, where the
//      artboard's own `.dc-artboard-label` header (an editor affordance, a
//      child of `[data-dc-screen]`) is visible. The desktop lane never sees it
//      because its shell is loaded with `?hide-chrome=1`, which flips
//      `_shell.html`'s `#canvas-hide-chrome` block to `media="all"`. Evidence:
//      the exported `post-lokace.svg` carried
//      `<g class="dc-artboard-label" aria-label="Artboard Lokace týdne …">`.
//   2. ASSETS NOT EMBEDDED — every `<image>` kept a remote `http(s)` href and
//      the artifact had zero `data:` URIs, so the SVG renders with broken
//      images outside the serving origin, and the PNG rasterization (an
//      SVG-as-image loads NO external resources) drops them entirely.
//   3. NO LOAD WAIT — the capture serializes immediately, so an artboard whose
//      images are still decoding captures without them.
//
// This file pins all three against a real Chromium with a real HTTP origin,
// which is what makes #2 reproducible at all (a `file:`/`setContent` fixture
// has no network asset to fail on).

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getBrowserBundle, getCaptureCoreBundle } from '../exporters/_browser-bundles.ts';

/** A real (tiny, latin-subset, OFL) woff2 — the test is about the `@font-face`
 * `src` becoming a `data:` URI, not about glyph coverage. */
const WOFF2 = readFileSync(join(import.meta.dir, 'fixtures', 'tiny-subset.woff2'));

/** 1×1 red PNG — small enough to inline in the fixture host verbatim. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const SVG_ASSET = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0a0"/></svg>`;

/**
 * A canvas-shaped fixture: the world plane, one artboard, the artboard's own
 * `.dc-artboard-label` header (exactly where canvas-lib puts it — a child of
 * the `[data-dc-screen]` article), a shell-level overlay, and two network
 * assets (a raster `<img>` and an SVG `<img>`).
 */
function fixtureHtml(origin: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#222">
  <div class="dc-world">
    <article class="dc-artboard" data-dc-screen="board-1"
      style="position:absolute;left:0;top:0;width:360px;height:240px;background:#12203a;
             font-family:Arial,Helvetica,sans-serif;color:#f5f2ea">
      <header class="dc-artboard-label sku">Artboard Lokace týdne · IG Post · 1:1</header>
      <div class="dc-artboard-body" style="padding:16px">
        <div style="font-size:18px;font-weight:700">Summer Camp</div>
        <img id="photo" src="${origin}/photo.png" width="120" height="80" alt="photo" />
        <img id="logo" src="${origin}/logo.svg" width="40" height="40" alt="logo" />
      </div>
    </article>
    <div class="dc-mm" style="position:absolute;left:10px;top:10px;width:60px;height:40px;background:#f0f">minimap</div>
    <div class="dc-participants" style="position:absolute;right:4px;top:4px">MD</div>
  </div>
</body></html>`;
}

/** Serve the fixture + its assets from a real origin so `<img>` is a real fetch. */
function startFixtureHost(): { origin: string; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url);
      if (pathname === '/photo.png') {
        return new Response(PNG_1PX, { headers: { 'content-type': 'image/png' } });
      }
      if (pathname === '/logo.svg') {
        return new Response(SVG_ASSET, { headers: { 'content-type': 'image/svg+xml' } });
      }
      const origin = `http://127.0.0.1:${server.port}`;
      return new Response(fixtureHtml(origin), { headers: { 'content-type': 'text/html' } });
    },
  });
  return { origin: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
}

describe('browser-lane capture hygiene (chrome + assets)', () => {
  test(
    'a captured artboard carries no editor chrome and no remote resource refs',
    async () => {
      const [iife, core] = await Promise.all([
        getBrowserBundle('dom-to-svg', 'domToSvg'),
        getCaptureCoreBundle(),
      ]);
      const host = startFixtureHost();
      const { launchChromium } = (await import('../bin/_pw-launch.mjs')) as {
        launchChromium: () => Promise<{
          newContext: (o: unknown) => Promise<{ newPage: () => Promise<unknown> }>;
          close: () => Promise<void>;
        }>;
      };
      const browser = await launchChromium();
      try {
        const ctx = await browser.newContext({
          viewport: { width: 800, height: 600 },
          deviceScaleFactor: 1,
        });
        // biome-ignore lint/suspicious/noExplicitAny: playwright page surface
        const page: any = await ctx.newPage();
        const consoleErrors: string[] = [];
        page.on('console', (m: { type: () => string; text: () => string }) => {
          if (m.type() === 'error') consoleErrors.push(m.text());
        });
        await page.goto(host.origin, { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ path: iife });
        await page.addScriptTag({ path: core, type: 'module' });
        await page.waitForFunction(
          () => !!(window as never as Record<string, unknown>)['__maudeCaptureCore']
        );

        const { svg, chromeDrawables } = await page.evaluate(async () => {
          // biome-ignore lint/suspicious/noExplicitAny: injected globals
          const w = window as any;
          const core = w.__maudeCaptureCore;
          const target = document.querySelector('[data-dc-screen]') as Element;
          const out: string = await core.svgForElement(target, w.domToSvg);
          // dom-to-svg still emits an (empty) <g> for a display:none element,
          // carrying its class — inert, and the playwright reference lane
          // produces the same. What must be absent is anything that PAINTS, so
          // assert on drawable descendants rather than on the class string.
          const doc = new DOMParser().parseFromString(out, 'image/svg+xml');
          const drawable = 'text,image,rect,path,circle,ellipse,line,polygon,polyline,use';
          let painted = 0;
          for (const sel of core.CAPTURE_HIDDEN_SELECTORS as string[]) {
            // Class/attribute selectors survive serialization; ids are rewritten.
            if (sel.startsWith('#')) continue;
            for (const node of doc.querySelectorAll(sel)) {
              painted += node.querySelectorAll(drawable).length;
            }
          }
          return { svg: out, chromeDrawables: painted };
        });

        // (1) chrome — the artboard's own label header, and any overlay from
        // `_shell.html`'s `#canvas-hide-chrome` list, must contribute nothing
        // that renders. The label's text is the exact leak the live cloud
        // export shipped.
        expect(chromeDrawables).toBe(0);
        // …and the nodes are gone outright, so the label text does not even
        // survive as `aria-label` metadata in the delivered file.
        expect(svg).not.toContain('dc-artboard-label');
        expect(svg).not.toContain('Lokace týdne');
        expect(svg).not.toContain('minimap');

        // (2) assets — every resource ref must be embedded. A remote
        // `http(s)://` href in the output is the live defect: an SVG-as-image
        // loads no external resources, so the raster silently drops it.
        const remoteRefs = svg.match(/(?:xlink:)?href="https?:\/\/[^"]+"/g) ?? [];
        expect(remoteRefs).toEqual([]);
        expect(svg).toContain('data:image/png');

        // The capture must not have papered over a failure by logging it.
        expect(consoleErrors.filter((t) => /inlin|resource/i.test(t))).toEqual([]);
      } finally {
        await browser.close();
        host.stop();
      }
    },
    { timeout: 60_000 }
  );

  test(
    'the capture waits for images that have not decoded yet',
    async () => {
      const [iife, core] = await Promise.all([
        getBrowserBundle('dom-to-svg', 'domToSvg'),
        getCaptureCoreBundle(),
      ]);
      // A host that stalls the photo response — the capture must still come
      // back with the image embedded, not race past it.
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          const { pathname } = new URL(req.url);
          if (pathname === '/photo.png') {
            await Bun.sleep(600);
            return new Response(PNG_1PX, { headers: { 'content-type': 'image/png' } });
          }
          if (pathname === '/logo.svg') {
            return new Response(SVG_ASSET, { headers: { 'content-type': 'image/svg+xml' } });
          }
          return new Response(fixtureHtml(`http://127.0.0.1:${server.port}`), {
            headers: { 'content-type': 'text/html' },
          });
        },
      });
      const { launchChromium } = (await import('../bin/_pw-launch.mjs')) as {
        launchChromium: () => Promise<{
          newContext: (o: unknown) => Promise<{ newPage: () => Promise<unknown> }>;
          close: () => Promise<void>;
        }>;
      };
      const browser = await launchChromium();
      try {
        const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
        // biome-ignore lint/suspicious/noExplicitAny: playwright page surface
        const page: any = await ctx.newPage();
        // `domcontentloaded`, deliberately: the slow <img> is still in flight,
        // which is exactly the live-canvas state the browser lane captures in.
        await page.goto(`http://127.0.0.1:${server.port}`, { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ path: iife });
        await page.addScriptTag({ path: core, type: 'module' });
        await page.waitForFunction(
          () => !!(window as never as Record<string, unknown>)['__maudeCaptureCore']
        );
        const svg: string = await page.evaluate(async () => {
          // biome-ignore lint/suspicious/noExplicitAny: injected globals
          const w = window as any;
          const target = document.querySelector('[data-dc-screen]') as Element;
          return await w.__maudeCaptureCore.svgForElement(target, w.domToSvg);
        });
        expect(svg).toContain('data:image/png');
      } finally {
        await browser.close();
        server.stop(true);
      }
    },
    { timeout: 60_000 }
  );
});

describe('browser-lane capture hygiene (webfonts)', () => {
  test(
    '@font-face sources are embedded — from a <link> stylesheet AND an inline <style>',
    async () => {
      // Fonts are the classic silent fidelity killer (DDR-231 SHIPPER's top
      // risk): an SVG whose @font-face still points at the serving origin
      // renders in a fallback face everywhere but the live page, and nothing
      // errors. Two declaration shapes, because dom-to-svg only copies the
      // first on its own (it needs a stylesheet href to absolutize `src`) —
      // the second is what capture-core's appendInlineFontFaces carries over.
      const [iife, core] = await Promise.all([
        getBrowserBundle('dom-to-svg', 'domToSvg'),
        getCaptureCoreBundle(),
      ]);
      const server = Bun.serve({
        port: 0,
        fetch(req) {
          const { pathname } = new URL(req.url);
          if (pathname === '/f.woff2')
            return new Response(WOFF2, { headers: { 'content-type': 'font/woff2' } });
          if (pathname === '/linked.css')
            return new Response(
              '@font-face{font-family:"LinkedFace";src:url(/f.woff2) format("woff2")}',
              { headers: { 'content-type': 'text/css' } }
            );
          return new Response(
            `<!doctype html><html><head><link rel="stylesheet" href="/linked.css">
             <style>@font-face{font-family:"InlineFace";src:url("/f.woff2") format("woff2")}</style>
             </head><body style="margin:0"><div class="dc-world">
             <article data-dc-screen="b1" style="position:absolute;left:0;top:0;width:320px;height:120px;background:#123;color:#fff">
               <p style="font-family:LinkedFace,serif">Linked</p>
               <p style="font-family:InlineFace,serif">Inline</p>
             </article></div></body></html>`,
            { headers: { 'content-type': 'text/html' } }
          );
        },
      });
      const { launchChromium } = (await import('../bin/_pw-launch.mjs')) as {
        launchChromium: () => Promise<{
          newContext: (o: unknown) => Promise<{ newPage: () => Promise<unknown> }>;
          close: () => Promise<void>;
        }>;
      };
      const browser = await launchChromium();
      try {
        const ctx = await browser.newContext({});
        // biome-ignore lint/suspicious/noExplicitAny: playwright page surface
        const page: any = await ctx.newPage();
        await page.goto(`http://127.0.0.1:${server.port}`, { waitUntil: 'load' });
        await page.addScriptTag({ path: iife });
        await page.addScriptTag({ path: core, type: 'module' });
        await page.waitForFunction(
          () => !!(window as never as Record<string, unknown>).__maudeCaptureCore
        );
        const svg: string = await page.evaluate(async () => {
          // biome-ignore lint/suspicious/noExplicitAny: injected globals
          const w = window as any;
          const target = document.querySelector('[data-dc-screen]') as Element;
          return await w.__maudeCaptureCore.svgForElement(target, w.domToSvg);
        });
        const faces = svg.match(/@font-face[^}]*}/g) ?? [];
        const families = faces.map((f) => /font-family:\s*"?([^;"]+)"?/.exec(f)?.[1]?.trim());
        expect(families.sort()).toEqual(['InlineFace', 'LinkedFace']);
        for (const face of faces) expect(face).toContain('data:font/woff2;base64,');
        // No font source may still point at the serving origin.
        expect(svg.match(/url\(["']?https?:[^)]*\)/g) ?? []).toEqual([]);
      } finally {
        await browser.close();
        server.stop(true);
      }
    },
    { timeout: 60_000 }
  );
});
