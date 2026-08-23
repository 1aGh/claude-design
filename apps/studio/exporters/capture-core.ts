// capture-core.ts — the SHARED in-page capture spine (DDR-231 single-spine).
//
// Pure browser code, two hosts, ONE source:
//   1. The playwright SVG shim (`bin/_svg-playwright.mjs`) injects this file
//      as a module bundle (`getCaptureCoreBundle()`) and calls it inside
//      `page.evaluate` — the desktop / render-worker lane.
//   2. The canvas runtime (`canvas-lib.tsx` export-capture listener) imports
//      it directly — the workspace `browser` lane, where the member's own
//      browser does the capture (DDR-231: images render client-side).
//
// History: this logic lived inline in `_svg-playwright.mjs`'s serializeOne
// (backdrop rect from the artboard's effective background, oklch→sRGB
// normalization for vector editors, dom-to-svg inlineResources). Extracting it
// is DDR-231's BUILDER condition — if the two hosts fork, the browser lane
// rots into a second implementation. Do not re-inline.
//
// NO Node imports allowed here — this file must bundle for `target: 'browser'`
// with zero shims. Loaded as a side-effect module: assigns
// `window.__maudeCaptureCore` so the shim can reach it without an importmap.

/** The subset of dom-to-svg the capture uses (IIFE `window.domToSvg` in the
 * shim host; `await import('dom-to-svg')` through the importmap in the canvas
 * runtime host). */
export interface DomToSvgApi {
  elementToSVG(el: Element): XMLDocument;
  inlineResources(el: Element): Promise<void>;
}

// Raster ceilings — mirrored from bin/_png-playwright.mjs (feature-2-print-
// artboards T4): 16k px matches common canvas/texture limits across engines;
// ~600MB is the RGBA-buffer ceiling that still admits a 600dpi A0 poster.
export const MAX_OUTPUT_SIDE_PX = 16000;
export const MAX_OUTPUT_BYTES = 600 * 1024 * 1024;

/** Throws with an actionable message (max supported DPI for this artboard)
 * when the requested raster exceeds the render guard. */
export function assertRasterSizeOk(widthCss: number, heightCss: number, scale: number): void {
  const outW = Math.ceil(widthCss * scale);
  const outH = Math.ceil(heightCss * scale);
  const estBytes = outW * outH * 4;
  if (outW > MAX_OUTPUT_SIDE_PX || outH > MAX_OUTPUT_SIDE_PX || estBytes > MAX_OUTPUT_BYTES) {
    const maxScaleForSide = MAX_OUTPUT_SIDE_PX / Math.max(widthCss, heightCss);
    const maxScaleForBytes = Math.sqrt(MAX_OUTPUT_BYTES / 4 / (widthCss * heightCss));
    const maxScale = Math.min(maxScaleForSide, maxScaleForBytes);
    const maxDpi = Math.floor(maxScale * 96);
    throw new Error(
      `requested output ${outW}×${outH}px at ${scale}× exceeds the render guard ` +
        `(max side ${MAX_OUTPUT_SIDE_PX}px / ~${Math.round(MAX_OUTPUT_BYTES / 1024 / 1024)}MB). ` +
        `For this artboard (${Math.round(widthCss)}×${Math.round(heightCss)}px) the max ` +
        `supported DPI is ~${maxDpi}.`
    );
  }
}

/** Pin an element's enclosing artboard to (0,0); returns the style values to
 * hand back to {@link restoreArtboard}. Per-target save/restore (not a global
 * reset) — the multi-artboard scatter-bug lesson from the playwright shims. */
export function pinArtboard(el: Element): { left: string; top: string } {
  const ab = (el.closest('[data-dc-screen]') ?? el) as HTMLElement;
  const prev = { left: ab.style.left, top: ab.style.top };
  ab.style.left = '0px';
  ab.style.top = '0px';
  return prev;
}

export function restoreArtboard(el: Element, prev: { left: string; top: string }): void {
  const ab = (el.closest('[data-dc-screen]') ?? el) as HTMLElement;
  ab.style.left = prev.left;
  ab.style.top = prev.top;
}

/** Reset the world plane's pan/zoom so artboards measure at their declared
 * dimensions (CSS `zoom` shrinks LAYOUT — getBoundingClientRect lies under
 * it). Returns the saved styles for {@link restoreWorldPlane}; the live-canvas
 * host MUST restore (the member is looking at the plane), the throwaway shim
 * page never bothers. */
export function restoreWorldPlane(saved: { zoom: string; transform: string } | null): void {
  const world = document.querySelector<HTMLElement>('.dc-world');
  if (!world || !saved) return;
  world.style.zoom = saved.zoom;
  world.style.transform = saved.transform;
}

export function resetWorldPlane(): { zoom: string; transform: string } | null {
  const world = document.querySelector<HTMLElement>('.dc-world');
  if (!world) return null;
  const saved = { zoom: world.style.zoom, transform: world.style.transform };
  world.style.zoom = '1';
  world.style.transform = 'none';
  return saved;
}

/** Convert ANY computed color (modern Chromium serializes `oklch(...)`
 * verbatim from getComputedStyle) to sRGB rgb()/rgba(). Affinity Designer /
 * older Illustrator / Inkscape don't parse CSS Color 4 and silently drop the
 * fill. A 1×1 canvas normalizes any CSS color string to sRGB bytes; null when
 * the value can't be painted (keep the original rather than emit a wrong
 * colour). */
function makeToSrgb(): (color: string) => string | null {
  const cache = new Map<string, string | null>();
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return (color: string) => {
    const hit = cache.get(color);
    if (hit !== undefined) return hit;
    let result: string | null = null;
    try {
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = color; // ignored (stays #000) if syntax unsupported
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a !== 0) {
          result =
            a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
        }
      }
    } catch {
      result = null;
    }
    cache.set(color, result);
    return result;
  };
}

const isOpaque = (bg: string | null): bg is string =>
  !!bg &&
  bg !== 'transparent' &&
  !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(bg) &&
  !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0(\.0+)?\s*\)$/.test(bg);

/** Effective background of the artboard region: the DS theme bg usually sits
 * on an inner full-bleed wrapper (`.app` / `.mdcc`), occasionally on the
 * artboard element itself, sometimes on an ancestor. Descend first for a
 * near-full-bleed opaque bg, then fall back to ancestors. An intentionally
 * transparent artboard returns null → stays transparent. */
function effectiveBg(node: Element): string | null {
  const abRect = node.getBoundingClientRect();
  const abArea = Math.max(1, abRect.width * abRect.height);
  const queue: Element[] = [node];
  let guard = 0;
  while (queue.length && guard < 80) {
    const e = queue.shift() as Element;
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
}

export interface SvgCaptureOptions {
  /** Capture the enclosing `[data-dc-screen]` rather than the element itself. */
  widenToArtboard?: boolean;
}

/**
 * Serialize one element (usually an artboard) to a portable SVG string:
 * dom-to-svg primitives + a backdrop `<rect>` from the effective background
 * (dom-to-svg doesn't paint the root's fill — the "artboard bg vanished in
 * Affinity" bug) + base64-inlined fonts/images + a global CSS-Color-4 → sRGB
 * rewrite so vector editors keep every fill.
 */
export async function svgForElement(
  el: Element,
  api: DomToSvgApi,
  opts: SvgCaptureOptions = {}
): Promise<string> {
  const target = opts.widenToArtboard ? (el.closest('[data-dc-screen]') ?? el) : el;
  const toSrgb = makeToSrgb();

  const bg = effectiveBg(target);
  const fillColor = bg ? toSrgb(bg) : null;
  const svgDoc = api.elementToSVG(target);
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
  // base64-embeds fonts + images so the SVG is portable outside the serving
  // origin — and, for the raster path, so the <img> decode is self-contained
  // (an SVG-as-image loads NO external resources; a data: font/image does).
  try {
    await api.inlineResources(root);
  } catch {
    /* best-effort — a missing resource beats a missing primitive */
  }
  let out = new XMLSerializer().serializeToString(svgDoc);
  out = out.replace(/(?:oklch|oklab|lch|lab|color)\([^)]*\)/gi, (m) => toSrgb(m) || m);
  return out;
}

/** Parse the root viewBox (or width/height) out of a serialized SVG. */
export function svgDimensions(svg: string): { width: number; height: number } | null {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName === 'parsererror') return null;
  const vb = (root.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  if (vb.length === 4 && vb.every((n) => !Number.isNaN(n)) && vb[2] > 0 && vb[3] > 0) {
    return { width: vb[2], height: vb[3] };
  }
  const w = Number.parseFloat(root.getAttribute('width') || '');
  const h = Number.parseFloat(root.getAttribute('height') || '');
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
    ? { width: w, height: h }
    : null;
}

/**
 * Rasterize a self-contained SVG string to a PNG Blob at `scale`×. The SVG
 * must already have its resources inlined ({@link svgForElement} does) — an
 * external URL inside an SVG-as-image silently doesn't load, and a
 * cross-origin bitmap would taint the canvas and make toBlob throw.
 */
export async function rasterizeSvg(svg: string, scale: number): Promise<Blob> {
  const dims = svgDimensions(svg);
  if (!dims) throw new Error('capture produced an SVG with no measurable dimensions');
  assertRasterSizeOk(dims.width, dims.height, scale);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG rasterization failed to decode'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(dims.width * scale));
    canvas.height = Math.max(1, Math.ceil(dims.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas context unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!blob) throw new Error('canvas.toBlob returned null');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const core = {
  MAX_OUTPUT_SIDE_PX,
  MAX_OUTPUT_BYTES,
  assertRasterSizeOk,
  pinArtboard,
  restoreArtboard,
  resetWorldPlane,
  restoreWorldPlane,
  svgForElement,
  svgDimensions,
  rasterizeSvg,
};

export type CaptureCore = typeof core;

// Side-effect global for the playwright-shim host (injected via addScriptTag,
// no importmap there) — mirrors video-encode-lib's `window.__maudeEnc`.
if (typeof window !== 'undefined') {
  (window as unknown as { __maudeCaptureCore: CaptureCore }).__maudeCaptureCore = core;
}
