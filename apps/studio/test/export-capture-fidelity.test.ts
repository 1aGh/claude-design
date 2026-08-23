// export-capture-fidelity.test.ts — DDR-231 T6: the fidelity gate for the
// browser export lane.
//
// The browser lane rasterizes dom-to-svg output (capture-core.ts); the
// reference spine screenshots the live element (the playwright path the
// desktop + render worker use). dom-to-svg RECONSTRUCTS the DOM as SVG
// primitives, so the two are not byte-identical — this gate pins how far
// apart they may drift on a representative artboard (tokens-styled text,
// gradient, border-radius, shadow, nested layout). A capture regression
// (dropped background, missing text, wrong geometry) blows well past these
// thresholds; anti-aliasing and shadow-softness differences do not.
//
// Runs a real Chromium (repo playwright) — lives in the studio suite, not the
// sync lane.

import { describe, expect, test } from 'bun:test';

import { getBrowserBundle, getCaptureCoreBundle } from '../exporters/_browser-bundles.ts';

const FIXTURE = `<!doctype html><html><body style="margin:0;background:#222">
  <div class="dc-world">
    <div data-dc-screen="board-1" style="position:absolute;left:0;top:0;width:420px;height:300px;
         background:linear-gradient(135deg,#1c2340,#3a1f47);border-radius:16px;overflow:hidden;
         font-family:Arial,Helvetica,sans-serif;color:#f5f2ea">
      <div style="padding:28px">
        <div style="font-size:24px;font-weight:700;letter-spacing:-0.4px">Summer Camp</div>
        <div style="font-size:13px;opacity:.75;margin-top:6px">Brno · 12–16 August</div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <div style="flex:1;height:64px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:10px"></div>
          <div style="flex:1;height:64px;background:#e4572e;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.4)"></div>
        </div>
        <div style="margin-top:16px;font-size:12px;line-height:1.5;opacity:.85">
          Registrace do konce července. Kapacita 60 hráčů.
        </div>
      </div>
    </div>
  </div></body></html>`;

describe('browser-lane capture vs playwright reference', () => {
  test(
    'raster stays within the drift thresholds on a representative artboard',
    async () => {
      const [iife, core] = await Promise.all([
        getBrowserBundle('dom-to-svg', 'domToSvg'),
        getCaptureCoreBundle(),
      ]);
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
        await page.setContent(FIXTURE);
        await page.evaluate(() => document.fonts.ready);
        await page.addScriptTag({ path: iife });
        await page.addScriptTag({ path: core, type: 'module' });
        await page.waitForFunction(
          () => !!(window as never as Record<string, unknown>)['__maudeCaptureCore']
        );

        // Reference: the playwright spine's capture of the same element.
        const el = page.locator('[data-dc-screen]');
        const refBytes: Uint8Array = await el.screenshot();
        const refB64 = Buffer.from(refBytes).toString('base64');

        const verdict = await page.evaluate(async (refDataUri: string) => {
          // biome-ignore lint/suspicious/noExplicitAny: injected globals
          const w = window as any;
          const core = w.__maudeCaptureCore;
          const target = document.querySelector('[data-dc-screen]') as Element;
          const svg = await core.svgForElement(target, w.domToSvg);
          const blob: Blob = await core.rasterizeSvg(svg, 1);

          const load = (src: string) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('decode failed'));
              img.src = src;
            });
          const candUrl = URL.createObjectURL(blob);
          const [ref, cand] = await Promise.all([load(refDataUri), load(candUrl)]);
          const W = ref.naturalWidth;
          const H = ref.naturalHeight;
          const draw = (img: HTMLImageElement) => {
            const c = document.createElement('canvas');
            c.width = W;
            c.height = H;
            const g = c.getContext('2d') as CanvasRenderingContext2D;
            g.drawImage(img, 0, 0, W, H);
            return g.getImageData(0, 0, W, H).data;
          };
          const a = draw(ref);
          const b = draw(cand);
          let sum = 0;
          let close = 0;
          const n = W * H;
          for (let i = 0; i < n * 4; i += 4) {
            const d =
              (Math.abs(a[i] - b[i]) +
                Math.abs(a[i + 1] - b[i + 1]) +
                Math.abs(a[i + 2] - b[i + 2])) /
              3;
            sum += d;
            if (d <= 32) close += 1;
          }
          URL.revokeObjectURL(candUrl);
          return {
            refW: W,
            refH: H,
            candW: cand.naturalWidth,
            candH: cand.naturalHeight,
            meanDelta: sum / n,
            closeRatio: close / n,
          };
        }, `data:image/png;base64,${refB64}`);

        // Geometry must agree exactly — a size mismatch is a broken capture,
        // not drift.
        expect(verdict.candW).toBe(verdict.refW);
        expect(verdict.candH).toBe(verdict.refH);
        // Thresholds set from the MEASURED baseline (fail-first evidence,
        // 2026-08-23): healthy capture = meanDelta 1.48, closeRatio 1.0;
        // a simulated dropped-text regression = meanDelta 5.37, closeRatio
        // 0.974. Both captures render in the SAME engine, so platform font
        // variance cancels — the residual is dom-to-svg reconstruction only.
        // meanDelta < 4 / closeRatio > 0.99 keeps ~2.7× headroom over healthy
        // while catching the text-drop class (mean-only thresholds missed it —
        // text is a small pixel fraction, hence the paired closeRatio gate).
        expect(verdict.meanDelta).toBeLessThan(4);
        expect(verdict.closeRatio).toBeGreaterThan(0.99);
      } finally {
        await browser.close();
      }
    },
    { timeout: 60_000 }
  );
});
