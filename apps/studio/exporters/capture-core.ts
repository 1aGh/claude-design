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

import { applyCaptureChrome, CAPTURE_HIDDEN_SELECTORS } from './capture-chrome.ts';

/** The subset of dom-to-svg the capture uses (IIFE `window.domToSvg` in the
 * shim host; `await import('dom-to-svg')` through the importmap in the canvas
 * runtime host). */
export interface DomToSvgApi {
  elementToSVG(el: Element): XMLDocument;
  /**
   * Present on the module but NOT used — dom-to-svg 0.12.2's own inlining is
   * broken for images (it writes `xlink:href`, reads `href.baseVal`). Kept in
   * the type so the shape of the injected module still documents itself; the
   * working implementation is {@link inlineCaptureResources}.
   */
  inlineResources?(el: Element): Promise<void>;
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

// ── paint polyfills for dom-to-svg ──────────────────────────────────────────
//
// dom-to-svg reconstructs CSS paint as SVG primitives and has no equivalent for
// two things design systems lean on for signature decoration: a
// `repeating-linear-gradient` (it matches `linear-gradient` only) and a
// `clip-path: polygon()` (it opens a stacking context and drops the clip). The
// alligators "Sash" — a diagonal yellow stripe band, clipped to a corner
// triangle — is both at once, and vanished from every dom-to-svg lane (SVG
// everywhere, browser PNG, PPTX deck) while the screenshot lanes kept it.
//
// SVG has exact analogues: <linearGradient spreadMethod="repeat"> and
// <clipPath>. So for a LEAF decorative element (no element children — the only
// shape where substituting the paint cannot re-layout anything) we insert an
// equivalent inline <svg> for the duration of elementToSVG — dom-to-svg copies
// inline SVG verbatim — and restore the element right after. Synchronous,
// bracketing a synchronous call: the live canvas never paints the substitute.

interface ParsedStop {
  color: string;
  px: number;
}
interface ParsedRepeatingGradient {
  angleDeg: number;
  stops: ParsedStop[];
}

/** Split on top-level commas (colors carry commas inside `rgb(...)`). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Parse a COMPUTED `repeating-linear-gradient(...)` (stops already expanded
 * to `<color> <px|%>` pairs by the engine). `null` for anything else. */
function parseRepeatingLinearGradient(
  value: string,
  w: number,
  h: number
): ParsedRepeatingGradient | null {
  const m = /^repeating-linear-gradient\((.*)\)$/.exec(value.trim());
  if (!m) return null;
  const parts = splitTopLevel(m[1] ?? '');
  if (!parts.length) return null;
  let angleDeg = 180;
  let first = parts[0] ?? '';
  const angle = /^(-?[\d.]+)deg$/.exec(first);
  const corner = Math.atan2(w, h) * (180 / Math.PI);
  const keyword: Record<string, number> = {
    'to top': 0,
    'to right': 90,
    'to bottom': 180,
    'to left': 270,
    'to top right': corner,
    'to right top': corner,
    'to top left': 360 - corner,
    'to left top': 360 - corner,
    'to bottom right': 180 - corner,
    'to right bottom': 180 - corner,
    'to bottom left': 180 + corner,
    'to left bottom': 180 + corner,
  };
  if (angle) {
    angleDeg = Number.parseFloat(angle[1] ?? '180');
    parts.shift();
  } else if (first in keyword) {
    angleDeg = keyword[first] as number;
    parts.shift();
  }
  first = '';
  // Gradient-line length per CSS Images: |w·sin a| + |h·cos a|.
  const rad = (angleDeg * Math.PI) / 180;
  const lineLen = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const stops: ParsedStop[] = [];
  for (const part of parts) {
    const sm = /^(.*?)\s+(-?[\d.]+)(px|%)$/.exec(part);
    if (!sm) return null; // a stop without a position — not the computed form
    const px =
      sm[3] === '%'
        ? (Number.parseFloat(sm[2] ?? '0') / 100) * lineLen
        : Number.parseFloat(sm[2] ?? '0');
    stops.push({ color: (sm[1] ?? '').trim(), px });
  }
  if (stops.length < 2) return null;
  return { angleDeg, stops };
}

/** `polygon(...)` of a computed clip-path → absolute points in the box. */
function parsePolygonClip(value: string, w: number, h: number): string | null {
  const m = /^polygon\((.*)\)$/.exec(value.trim());
  if (!m) return null;
  const pts: string[] = [];
  for (const pair of splitTopLevel(m[1] ?? '')) {
    const [xs, ys] = pair.split(/\s+/);
    if (!xs || !ys) return null;
    const len = (v: string, ref: number) =>
      v.endsWith('%') ? (Number.parseFloat(v) / 100) * ref : Number.parseFloat(v);
    const x = len(xs, w);
    const y = len(ys, h);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    pts.push(`${x},${y}`);
  }
  return pts.length >= 3 ? pts.join(' ') : null;
}

let polyfillSeq = 0;

/**
 * Substitute unsupported paint on leaf elements under `target` with inline
 * SVG; returns the undo. Call immediately before `elementToSVG`, undo
 * immediately after.
 */
export function applyPaintPolyfills(target: Element): () => void {
  const undos: Array<() => void> = [];
  const NS = 'http://www.w3.org/2000/svg';
  const candidates: HTMLElement[] = [];
  const consider = (el: Element) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.children.length > 0) return; // leaf only
    const cs = getComputedStyle(el);
    const hasRepeating = cs.backgroundImage.startsWith('repeating-linear-gradient(');
    const hasPolygon = cs.clipPath.startsWith('polygon(');
    if (hasRepeating || hasPolygon) candidates.push(el);
  };
  consider(target);
  for (const el of target.querySelectorAll('*')) consider(el);

  for (const el of candidates) {
    const cs = getComputedStyle(el);
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) continue;
    polyfillSeq += 1;
    const uid = `maude-pp-${polyfillSeq}`;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-maude-paint-polyfill', '1');
    svg.style.cssText =
      'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:block';
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);

    let fill: string | null = null;
    let paintNode: Element | null = null;
    const grad = parseRepeatingLinearGradient(cs.backgroundImage, w, h);
    if (grad) {
      const rad = (grad.angleDeg * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      const lineLen = Math.abs(w * dx) + Math.abs(h * Math.cos(rad));
      const cx = w / 2;
      const cy = h / 2;
      const sx = cx - (dx * lineLen) / 2;
      const sy = cy - (dy * lineLen) / 2;
      const firstPx = grad.stops[0]?.px ?? 0;
      const lastPx = grad.stops[grad.stops.length - 1]?.px ?? firstPx + 1;
      const period = Math.max(0.01, lastPx - firstPx);
      const lg = document.createElementNS(NS, 'linearGradient');
      lg.setAttribute('id', `${uid}-g`);
      lg.setAttribute('gradientUnits', 'userSpaceOnUse');
      lg.setAttribute('spreadMethod', 'repeat');
      lg.setAttribute('x1', String(sx + dx * firstPx));
      lg.setAttribute('y1', String(sy + dy * firstPx));
      lg.setAttribute('x2', String(sx + dx * lastPx));
      lg.setAttribute('y2', String(sy + dy * lastPx));
      for (const st of grad.stops) {
        const stop = document.createElementNS(NS, 'stop');
        stop.setAttribute('offset', String((st.px - firstPx) / period));
        stop.setAttribute('stop-color', st.color);
        lg.appendChild(stop);
      }
      defs.appendChild(lg);
      fill = `url(#${uid}-g)`;
    } else if (isOpaque(cs.backgroundColor) && cs.backgroundImage === 'none') {
      fill = cs.backgroundColor;
    }
    const bgUrl = /^url\(["']?([^"')]+)["']?\)$/.exec(cs.backgroundImage)?.[1];
    if (!fill && bgUrl) {
      // A clipped background IMAGE (the camo corner): <image> with the cover
      // mapping; the inliner embeds it like every other <image>.
      const im = document.createElementNS(NS, 'image');
      im.setAttribute('href', bgUrl);
      im.setAttribute('xlink:href', bgUrl);
      im.setAttribute('x', '0');
      im.setAttribute('y', '0');
      im.setAttribute('width', String(w));
      im.setAttribute('height', String(h));
      im.setAttribute(
        'preserveAspectRatio',
        cs.backgroundSize === 'cover'
          ? 'xMidYMid slice'
          : cs.backgroundSize === 'contain'
            ? 'xMidYMid meet'
            : 'none'
      );
      paintNode = im;
    } else if (fill) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', String(w));
      rect.setAttribute('height', String(h));
      rect.setAttribute('fill', fill);
      paintNode = rect;
    }
    if (!paintNode) continue;

    const poly = parsePolygonClip(cs.clipPath, w, h);
    if (poly) {
      const cp = document.createElementNS(NS, 'clipPath');
      cp.setAttribute('id', `${uid}-c`);
      cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const pg = document.createElementNS(NS, 'polygon');
      pg.setAttribute('points', poly);
      cp.appendChild(pg);
      defs.appendChild(cp);
      paintNode.setAttribute('clip-path', `url(#${uid}-c)`);
    }
    svg.appendChild(paintNode);

    // Swap: hide the CSS paint dom-to-svg would mis-render, mount the SVG.
    const prev = {
      backgroundImage: el.style.backgroundImage,
      backgroundColor: el.style.backgroundColor,
      position: el.style.position,
    };
    el.style.backgroundImage = 'none';
    if (fill && fill === cs.backgroundColor) el.style.backgroundColor = 'transparent';
    if (cs.position === 'static') el.style.position = 'relative';
    el.appendChild(svg);
    undos.push(() => {
      svg.remove();
      el.style.backgroundImage = prev.backgroundImage;
      el.style.backgroundColor = prev.backgroundColor;
      el.style.position = prev.position;
    });
  }
  return () => {
    for (const u of undos.reverse()) u();
  };
}

export interface SvgCaptureOptions {
  /** Capture the enclosing `[data-dc-screen]` rather than the element itself. */
  widenToArtboard?: boolean;
  /**
   * Ceiling on the pre-capture asset wait AND on each resource inline, in ms.
   * A stalled asset must delay a capture, never hang it.
   */
  assetTimeoutMs?: number;
}

const DEFAULT_ASSET_TIMEOUT_MS = 10_000;

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

/** Resolve once an `<img>` has finished loading — successfully or not. */
function imageSettled(img: HTMLImageElement): Promise<void> {
  if (img.complete) return img.decode().catch(() => {});
  return new Promise<void>((resolve) => {
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  }).then(() => img.decode().catch(() => {}));
}

/**
 * Wait for the things a capture silently drops if it races them: webfonts, and
 * every `<img>` inside the target.
 *
 * The playwright hosts get this for free — they navigate and wait for `load`
 * before evaluating. The browser lane captures a LIVE canvas whose images may
 * still be in flight ("musí se počkat na obrázky a assety"), so the wait has to
 * live in the shared spine instead of in one host's navigation options.
 *
 * Bounded: a broken or hanging asset costs `timeoutMs` and then the capture
 * proceeds without it. A late image beats no export.
 */
export async function waitForCaptureAssets(
  target: Element,
  timeoutMs: number = DEFAULT_ASSET_TIMEOUT_MS
): Promise<void> {
  const doc = target.ownerDocument ?? document;
  const waits: Promise<unknown>[] = [];
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) waits.push(fonts.ready.catch(() => {}));
  const imgs: HTMLImageElement[] = [];
  if (target instanceof HTMLImageElement) imgs.push(target);
  for (const img of target.querySelectorAll('img')) imgs.push(img);
  for (const img of imgs) waits.push(imageSettled(img));
  await withTimeout(
    Promise.all(waits).then(() => undefined),
    timeoutMs,
    undefined
  );
}

/**
 * Drop the serialized remains of hidden editor chrome.
 *
 * `applyCaptureChrome` makes the chrome render nothing, but dom-to-svg still
 * emits an (empty) `<g>` for a `display:none` element, carrying its class and
 * `aria-label` — so the artboard's title text survived into the file as
 * metadata even once it stopped painting. Nothing downstream wants it: it is
 * an editor affordance, not design content.
 */
export function stripChromeNodes(root: Element): void {
  const removedIds = new Set<string>();
  for (const selector of CAPTURE_HIDDEN_SELECTORS) {
    // ids are rewritten during serialization — class/attribute selectors are
    // the ones that survive, and they cover every entry that can appear here.
    if (selector.startsWith('#')) continue;
    for (const node of Array.from(root.querySelectorAll(selector))) {
      const id = node.getAttribute('id');
      if (id) removedIds.add(id);
      node.remove();
    }
  }
  if (!removedIds.size) return;
  // dom-to-svg mirrors the DOM's accessibility tree onto the output, so the
  // artboard still points at the label it no longer contains. Leave no dangling
  // idref: it is invalid ARIA, and it is how the label's name survived the
  // node's removal.
  for (const owner of Array.from(root.querySelectorAll('[aria-owns]'))) {
    const kept = (owner.getAttribute('aria-owns') ?? '')
      .split(/\s+/)
      .filter((id) => id && !removedIds.has(id));
    if (kept.length) owner.setAttribute('aria-owns', kept.join(' '));
    else owner.removeAttribute('aria-owns');
  }
}

/**
 * Remove any `<image>` element still pointing at a remote `http(s)` URL after
 * inlining — a beacon the capture CSP blocked from embedding but that would
 * fire on open. Data URIs and in-document `#fragment` refs are kept.
 */
export function dropRemoteRefs(root: Element): void {
  for (const node of Array.from(root.querySelectorAll('image'))) {
    const href = node.getAttribute('xlink:href') ?? node.getAttribute('href') ?? '';
    if (/^\s*https?:/i.test(href)) node.remove();
  }
}

const isEmbeddable = (href: string | null): href is string =>
  !!href && !href.startsWith('data:') && !href.startsWith('#');

/** Read whichever href attribute dom-to-svg happened to write. */
function readHref(el: Element): string | null {
  return el.getAttribute('xlink:href') ?? el.getAttribute('href');
}

/** Write BOTH, so every downstream consumer sees the embedded bytes. */
function writeHref(el: Element, value: string): void {
  el.setAttribute('xlink:href', value);
  el.setAttribute('href', value);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('failed to read resource blob'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Fetch a resource and return it as a `data:` URI — original bytes, original
 * MIME (so an SVG logo stays vector). Same-origin by construction for canvas
 * assets, so the browser attaches whatever credential the live `<img>` used. */
async function dataUrlByFetch(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await withTimeout(fetch(url), timeoutMs, null as Response | null);
    if (!res?.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

/**
 * Last-resort inline: repaint an ALREADY-DECODED `<img>` through a canvas.
 * No network, so it survives a resource the capture context may not re-fetch
 * (a credentialed URL, an opaque-origin document, a revoked object URL). A
 * cross-origin bitmap without CORS taints the canvas and `toDataURL` throws —
 * caught, and the ref is left remote rather than emitting a wrong picture.
 */
function dataUrlFromDecodedImage(img: HTMLImageElement, filter?: string): string | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (filter) {
      // Bake the element's CSS `filter` into the bitmap. Canvas 2D accepts the
      // same grammar as CSS — including `url(#id)` against an SVG filter in
      // THIS document — so a duotone/posterize treatment survives into the
      // artifact. An engine that doesn't support it leaves `ctx.filter` at
      // 'none'; detect that and report failure so the caller falls back to
      // the unfiltered bytes rather than silently shipping a wrong picture.
      ctx.filter = filter;
      if (ctx.filter !== filter) return null;
    }
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** The element's computed CSS `filter`, or null when it paints unfiltered. */
function imageFilterOf(img: HTMLImageElement): string | null {
  const f = getComputedStyle(img).filter;
  return f && f !== 'none' ? f : null;
}

/**
 * The SVG `preserveAspectRatio` equivalent of an <img>'s `object-fit` +
 * `object-position`, or null for the default (`contain`-like `meet` at centre).
 * `object-position` maps to the nine alignment keywords by thirds — exact for
 * the keyword/percentage values designs use, approximate for arbitrary lengths.
 */
function preserveAspectRatioFor(img: HTMLImageElement): string | null {
  const cs = getComputedStyle(img);
  const fit = cs.objectFit;
  if (fit === 'fill') return 'none';
  const align = (pos: string, size: number): 'Min' | 'Mid' | 'Max' => {
    const n = pos.endsWith('%') ? Number.parseFloat(pos) : (Number.parseFloat(pos) / size) * 100;
    if (!Number.isFinite(n)) return 'Mid';
    return n < 33.4 ? 'Min' : n > 66.6 ? 'Max' : 'Mid';
  };
  const [px = '50%', py = '50%'] = cs.objectPosition.split(/\s+/);
  const x = align(px, img.clientWidth || 1);
  const y = align(py, img.clientHeight || 1);
  if (fit === 'cover') return `x${x}Y${y} slice`;
  if (fit === 'contain' || fit === 'scale-down') return `x${x}Y${y} meet`;
  return null; // `none` — no scaling; SVG has no exact analogue, keep default
}

/** Index the live `<img>` elements by the URL they actually loaded. */
function liveImagesByUrl(target: Element): Map<string, HTMLImageElement> {
  const map = new Map<string, HTMLImageElement>();
  const add = (img: HTMLImageElement) => {
    for (const u of [img.currentSrc, img.src]) if (u) map.set(u, img);
  };
  if (target instanceof HTMLImageElement) add(target);
  for (const img of target.querySelectorAll('img')) add(img);
  return map;
}

/**
 * Embed every external resource the serialized SVG still points at.
 *
 * WHY THIS EXISTS INSTEAD OF `domToSvg.inlineResources` (the DDR-231 Phase 2
 * root cause): dom-to-svg 0.12.2 WRITES image URLs to `xlink:href` but READS
 * them back as `element.href.baseVal`, which reflects the SVG2 `href`
 * attribute. In a document built with `createElementNS` that is `''`, so its
 * own `assert(url, 'No URL passed')` throws for every image — and it catches
 * its own error and `console.error`s it. The result was an export whose
 * `<image>` refs all stayed remote, with zero `data:` URIs and no thrown error
 * anywhere: broken pictures in the SVG, and NOTHING in the PNG, because an
 * SVG-as-image loads no external resources at all. It never worked; the desktop
 * looked fine only because its PNG comes from a real screenshot, not this path.
 *
 * Order is deliberate — `fetch` first (keeps the original bytes and MIME, so a
 * vector logo stays vector), decoded-`<img>` repaint second (no network, so it
 * still works where the fetch is refused).
 */
export async function inlineCaptureResources(
  root: Element,
  target: Element,
  timeoutMs: number = DEFAULT_ASSET_TIMEOUT_MS
): Promise<void> {
  const live = liveImagesByUrl(target);
  const cache = new Map<string, string | null>();
  const resolve = async (url: string): Promise<string | null> => {
    const hit = cache.get(url);
    if (hit !== undefined) return hit;
    const img = live.get(url);
    // A FILTERED image (CSS `filter:` — a brand duotone, a posterize via an
    // in-page SVG filter) must be baked, not fetched: dom-to-svg carries no
    // `filter` onto its <image>, so the original bytes would render flat.
    // DDR-232 follow-up — the cloud PNG/SVG/PPTX lost the photo treatment
    // the desktop screenshot kept. Unfiltered images stay fetch-first (the
    // original bytes and MIME; a vector logo stays vector).
    const filter = img ? imageFilterOf(img) : null;
    let out: string | null = null;
    if (img && filter) out = dataUrlFromDecodedImage(img, filter);
    if (!out) out = await dataUrlByFetch(url, timeoutMs);
    if (!out && img) out = dataUrlFromDecodedImage(img);
    cache.set(url, out);
    return out;
  };

  const images = Array.from(root.querySelectorAll('image'));
  await Promise.all(
    images.map(async (node) => {
      const href = readHref(node);
      if (!isEmbeddable(href)) return;
      const abs = new URL(href, document.baseURI).href;
      // dom-to-svg writes an <img> as <image x y width height> and nothing
      // else — `object-fit: cover` (every hero photo) therefore rendered
      // LETTERBOXED under SVG's default `xMidYMid meet`. Carry the fit over.
      const img = live.get(abs);
      if (img && !node.hasAttribute('preserveAspectRatio')) {
        const par = preserveAspectRatioFor(img);
        if (par) node.setAttribute('preserveAspectRatio', par);
      }
      const dataUrl = await resolve(abs);
      if (dataUrl) writeHref(node, dataUrl);
    })
  );

  // `@font-face` (and any other `url()`) inside the emitted <style> blocks —
  // dom-to-svg puts the captured stylesheet there. Without this the SVG falls
  // back to a system font the moment it leaves the serving origin, which is
  // the classic silent fidelity killer.
  appendInlineFontFaces(root);
  await Promise.all(
    Array.from(root.querySelectorAll('style')).map(async (styleEl) => {
      const css = styleEl.textContent ?? '';
      const urls = new Set<string>();
      for (const m of css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)) {
        const raw = m[2]?.trim();
        if (isEmbeddable(raw ?? null)) urls.add(raw as string);
      }
      if (!urls.size) return;
      const pairs = await Promise.all(
        Array.from(urls, async (u) => {
          let abs: string;
          try {
            abs = new URL(u, document.baseURI).href;
          } catch {
            return [u, null] as const;
          }
          return [u, await resolve(abs)] as const;
        })
      );
      let next = css;
      for (const [original, dataUrl] of pairs) {
        if (!dataUrl) continue;
        next = next.split(original).join(dataUrl);
      }
      styleEl.textContent = next;
    })
  );
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
  const timeoutMs = opts.assetTimeoutMs ?? DEFAULT_ASSET_TIMEOUT_MS;
  // Editor chrome OFF before anything is measured: the shim host gets this from
  // `?hide-chrome=1`, the live-canvas host has no navigation to carry it, and
  // hiding the artboard's `.dc-artboard-label` header also reflows the body
  // into its space — so it must precede getComputedStyle, not follow it.
  const releaseChrome = applyCaptureChrome(target.ownerDocument ?? document);
  try {
    return await serializeCapture(target, api, timeoutMs);
  } finally {
    releaseChrome();
  }
}

async function serializeCapture(
  target: Element,
  api: DomToSvgApi,
  timeoutMs: number
): Promise<string> {
  const toSrgb = makeToSrgb();
  await waitForCaptureAssets(target, timeoutMs);

  const bg = effectiveBg(target);
  const fillColor = bg ? toSrgb(bg) : null;
  // Bracket the synchronous serialization ONLY — the substitute paint must
  // never be on screen across an await.
  const undoPaint = applyPaintPolyfills(target);
  let svgDoc: XMLDocument;
  try {
    svgDoc = api.elementToSVG(target);
  } finally {
    undoPaint();
  }
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
  // `api.inlineResources` is deliberately NOT used — see inlineCaptureResources.
  void api;
  stripChromeNodes(root);
  try {
    await inlineCaptureResources(root, target, timeoutMs);
  } catch {
    /* best-effort — a missing resource beats a missing primitive */
  }
  // BOUNDARY, not a fixture assertion (security review F5): any `<image>` whose
  // href is STILL remote after inlining — a tenant `background:url(http://
  // attacker/beacon)` the capture CSP refused to fetch — would fire when a
  // DIFFERENT user opens the delivered file (outside any CSP). Drop it so the
  // artifact carries no phone-home. A data:/#-fragment ref is fine.
  dropRemoteRefs(root);
  let out = new XMLSerializer().serializeToString(svgDoc);
  out = out.replace(/(?:oklch|oklab|lch|lab|color)\([^)]*\)/gi, (m) => toSrgb(m) || m);
  return out;
}

/**
 * Carry over `@font-face` rules dom-to-svg drops.
 *
 * dom-to-svg copies `@font-face` into the output ONLY from stylesheets that
 * have an `href` (it needs one to absolutize relative `src` URLs) — a rule
 * declared in an inline `<style>` is skipped outright, so a canvas whose font
 * arrives that way renders in a fallback face everywhere but the live page.
 * Append those rules, `src` made absolute against the document, so the
 * `url()` inliner below treats them like every other font.
 */
function appendInlineFontFaces(root: Element): void {
  const doc = root.ownerDocument;
  const styleEl = root.querySelector('style');
  if (!styleEl) return;
  const extra: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.href) continue; // dom-to-svg already copied these
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet — unreadable, and not ours to embed
    }
    for (const rule of Array.from(rules)) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const text = rule.cssText.replace(
        /url\(\s*(['"]?)([^)'"]+)\1\s*\)/g,
        (_m, q: string, u: string) => {
          try {
            return `url(${q}${new URL(u, document.baseURI).href}${q})`;
          } catch {
            return _m;
          }
        }
      );
      extra.push(text);
    }
  }
  if (!extra.length) return;
  void doc;
  styleEl.textContent = `${styleEl.textContent ?? ''}\n${extra.join('\n')}`;
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
  waitForCaptureAssets,
  inlineCaptureResources,
  stripChromeNodes,
  applyPaintPolyfills,
  dropRemoteRefs,
  CAPTURE_HIDDEN_SELECTORS,
};

export type CaptureCore = typeof core;

// Side-effect global for the playwright-shim host (injected via addScriptTag,
// no importmap there) — mirrors video-encode-lib's `window.__maudeEnc`.
if (typeof window !== 'undefined') {
  (window as unknown as { __maudeCaptureCore: CaptureCore }).__maudeCaptureCore = core;
}
