// PPTX adapter — native editable slides via svg2pptx (export-pipeline-fixes
// item 6, final architecture; see DDR-069).
//
// Pipeline per artboard:
//   1. Render the artboard to SVG (the project's vector pipeline: exact glyph
//      positions, oklch→sRGB, fonts inlined).
//   2. Pre-process the SVG (`preprocessSvg`): lift each `<tspan>` x/y onto its
//      `<text>` parent (dom-to-svg positions on the tspan; svg2pptx reads the
//      text element → without this every run collapses to 0,0 and overlaps),
//      and collapse the CSS `font-family` stack to its first concrete name (a
//      PPTX `typeface` is a SINGLE font, not a fallback list).
//   3. svg2pptx converts the SVG to NATIVE PowerPoint shapes + text boxes —
//      editable in PowerPoint / Keynote / Canva, opens everywhere (no `svgBlip`
//      that Canva rejects, no text reflow that broke dom-to-pptx).
//   4. Merge the per-artboard single-slide decks into one (`mergeDecks`).
//
// svg2pptx is a Python tool (the only OSS path that yields faithful + editable
// native objects — see DDR-069 for the alternatives ruled out: dom-to-pptx
// reflows, SVG-image `svgBlip` breaks Canva, LibreOffice emits empty). When
// python3 + svg2pptx are absent we fall back to a PNG-per-slide deck (faithful,
// universal, Canva-safe, NOT editable) and log a one-line install hint.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import PptxGenJS from 'pptxgenjs';

import { getBrowserBundle } from './_browser-bundles.ts';
import { exportShimPath, runShim } from './_runtime.ts';
import {
  canvasShellUrl,
  type ExportContext,
  type ExportHooks,
  type ExportOptions,
  type ExportResult,
} from './index.ts';
import type { Target } from './scope.ts';

// DDR-045: resolve via DEV_SERVER_ROOT, never `import.meta.dir`. See _runtime.ts.
const SVG_PLAYWRIGHT = exportShimPath('_svg-playwright.mjs');
const PNG_PLAYWRIGHT = exportShimPath('_png-playwright.mjs');
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';
const SCREEN_DPI = 96; // canvas px → inches (PNG fallback slide sizing)
const FALLBACK_SCALE = 3; // raster fallback rendered at 3× for crisp non-vector viewers

type ElementTarget = Extract<Target, { kind: 'element' }>;

function isElementTarget(t: Target): t is ElementTarget {
  return t.kind === 'element';
}

/** Spawn a playwright shim via the shared runtime, returning the written file paths (stdout). */
function spawnPlaywrightShim(args: string[], hooks?: ExportHooks): Promise<string[]> {
  return runShim(args, {
    cwd: path.dirname(args[0]),
    signal: hooks?.signal,
    onProgress: hooks?.onProgress,
  });
}

// ─── SVG pre-processing (the fix that makes svg2pptx faithful) ────────────────

/**
 * Make a dom-to-svg SVG consumable by svg2pptx without text collapsing to the
 * origin or rendering in a fallback font. Two transforms:
 *   - lift the first `<tspan>` x/y onto the enclosing `<text>` (svg2pptx reads
 *     `text@x/y`; dom-to-svg leaves those off and positions the tspan);
 *   - collapse `font-family="<stack>"` to its first concrete name (a PPTX
 *     typeface is one font name, not a CSS fallback list).
 * Pure string transform — exported for unit coverage.
 */
export function preprocessSvg(svg: string): string {
  let out = svg.replace(
    /<text\b([^>]*)>(\s*)<tspan\b([^>]*)>/g,
    (full, textAttrs, ws, tspanAttrs) => {
      if (/\bx=/.test(textAttrs)) return full; // already positioned
      const x = /\bx="([^"]*)"/.exec(tspanAttrs)?.[1];
      const y = /\by="([^"]*)"/.exec(tspanAttrs)?.[1];
      if (x == null || y == null) return full;
      return `<text x="${x}" y="${y}"${textAttrs}>${ws}<tspan${tspanAttrs}>`;
    }
  );
  out = out.replace(/font-family="([^"]*)"/g, (m, val: string) => {
    const first = val
      .split(',')[0]
      .replace(/&quot;|["']/g, '')
      .trim();
    return first ? `font-family="${first}"` : m;
  });
  return out;
}

// ─── svg2pptx (Python) detection + invocation ─────────────────────────────────

/**
 * argv prefix for svg2pptx. `MAUDE_SVG2PPTX` overrides (space-separated, e.g. a
 * venv path or `python3 -m svg2pptx`); defaults to the `svg2pptx` CLI on PATH.
 */
function svg2pptxArgv(): string[] {
  const env = process.env.MAUDE_SVG2PPTX?.trim();
  return env ? env.split(/\s+/) : ['svg2pptx'];
}

let _svg2pptxAvailable: boolean | null = null;
async function svg2pptxAvailable(): Promise<boolean> {
  if (_svg2pptxAvailable !== null) return _svg2pptxAvailable;
  try {
    const [bin, ...rest] = svg2pptxArgv();
    const proc = Bun.spawn([bin, ...rest, '--version'], { stdout: 'pipe', stderr: 'pipe' });
    _svg2pptxAvailable = (await proc.exited) === 0;
  } catch {
    _svg2pptxAvailable = false;
  }
  return _svg2pptxAvailable;
}

async function runSvg2pptx(inSvg: string, outPptx: string): Promise<void> {
  const [bin, ...rest] = svg2pptxArgv();
  const proc = Bun.spawn([bin, ...rest, inSvg, outPptx], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`svg2pptx exited ${code}: ${stderr.trim() || stdout.trim()}`);
  }
}

// ─── deck merge (single-slide svg2pptx decks → one) ───────────────────────────

/**
 * Merge N single-slide svg2pptx decks into one. svg2pptx output carries no
 * media (pure native shapes) so there's no media-collision to namespace — we
 * keep the first deck's master/layout/theme skeleton, append each slide
 * renumbered, and reconcile presentation.xml + its rels + Content-Types.
 * Pure (in→out buffers); exported for unit coverage.
 */
export async function mergeDecks(decks: Uint8Array[]): Promise<Uint8Array> {
  if (decks.length === 0) return new Uint8Array(0);
  if (decks.length === 1) return decks[0];
  const JSZip = (await import('jszip')).default;
  const base = await JSZip.loadAsync(decks[0]);
  const next = new JSZip();

  // Skeleton (master / layouts / theme / presProps / viewProps / docProps …),
  // everything except the slides (re-emitted renumbered).
  for (const name of Object.keys(base.files)) {
    if (/\/$/.test(name)) continue;
    if (/^ppt\/slides\//.test(name)) continue;
    const entry = base.file(name);
    if (!entry || entry.dir) continue;
    next.file(name, await entry.async('uint8array'));
  }

  // Append each deck's slide(s), contiguous.
  let count = 0;
  for (const buf of decks) {
    const zip = await JSZip.loadAsync(buf);
    const slideNames = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort();
    for (const sn of slideNames) {
      const slideEntry = zip.file(sn);
      if (!slideEntry) continue;
      count += 1;
      next.file(`ppt/slides/slide${count}.xml`, await slideEntry.async('string'));
      const relsName = `${sn.replace('ppt/slides/', 'ppt/slides/_rels/')}.rels`;
      const relsEntry = zip.file(relsName);
      if (relsEntry) {
        next.file(`ppt/slides/_rels/slide${count}.xml.rels`, await relsEntry.async('string'));
      }
    }
  }

  // presentation.xml — grow sldIdLst to N.
  const presEntry = base.file('ppt/presentation.xml');
  const presRelsEntry = base.file('ppt/_rels/presentation.xml.rels');
  if (!presEntry || !presRelsEntry) return decks[0];
  let pres = await presEntry.async('string');
  const idEntries = Array.from(
    { length: count },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`
  ).join('');
  pres = pres.replace(
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    `<p:sldIdLst>${idEntries}</p:sldIdLst>`
  );
  next.file('ppt/presentation.xml', pres);

  // presentation.xml.rels — STRIP slide rels (Type ending `/relationships/slide`,
  // `[^>]*` so the `//` in the Type URL doesn't truncate the match), KEEP
  // everything else (slideMaster/theme/presProps), append N slide rels.
  let prels = await presRelsEntry.async('string');
  prels = prels.replace(/<Relationship\b[^>]*Type="[^"]*\/relationships\/slide"[^>]*\/>/g, '');
  const slideRels = Array.from(
    { length: count },
    (_, i) =>
      `<Relationship Id="rId${100 + i}" Type="${SLIDE_REL}" Target="slides/slide${i + 1}.xml"/>`
  ).join('');
  prels = prels.replace(/<\/Relationships>\s*$/, `${slideRels}</Relationships>`);
  next.file('ppt/_rels/presentation.xml.rels', prels);

  // Content-Types — contiguous slide Overrides, then drop any Override pointing
  // at a non-existent part (svg2pptx/pptxgenjs over-declare slideMaster<N> etc.).
  const ctEntry = base.file('[Content_Types].xml');
  if (ctEntry) {
    let ct = await ctEntry.async('string');
    ct = ct.replace(/<Override\s+PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '');
    const slideOverrides = Array.from(
      { length: count },
      (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${SLIDE_CT}"/>`
    ).join('');
    ct = ct.replace(/<\/Types>\s*$/, `${slideOverrides}</Types>`);
    const parts = new Set(Object.keys(next.files).filter((n) => !n.endsWith('/')));
    ct = ct.replace(/<Override\s+PartName="([^"]+)"[^>]*\/>/g, (full, p: string) =>
      parts.has(p.replace(/^\//, '')) ? full : ''
    );
    next.file('[Content_Types].xml', ct);
  }

  return next.generateAsync({ type: 'uint8array' });
}

// ─── render helpers ───────────────────────────────────────────────────────────

function svgArgsFor(target: ElementTarget, url: string, outDir: string, bundle: string): string[] {
  const args = [
    SVG_PLAYWRIGHT,
    '--url',
    url,
    '--selector',
    target.cssPath,
    '--bundle-path',
    bundle,
    '--timeout',
    '20',
  ];
  if (target.multi) args.push('--multi', '1', '--out-dir', outDir);
  else {
    if (target.widen) args.push('--widen-to-artboard', '1');
    args.push('--out', path.join(outDir, `${target.canvasSlug}.svg`));
  }
  return args;
}

function pngArgsFor(target: ElementTarget, url: string, outDir: string): string[] {
  const args = [
    PNG_PLAYWRIGHT,
    '--url',
    url,
    '--selector',
    target.cssPath,
    '--scale',
    String(FALLBACK_SCALE),
    '--timeout',
    '20',
  ];
  if (target.multi) args.push('--multi', '1', '--out-dir', outDir);
  else {
    if (target.widen) args.push('--widen-to-artboard', '1');
    args.push('--out', path.join(outDir, `${target.canvasSlug}.png`));
  }
  return args;
}

// ─── PNG fallback deck ────────────────────────────────────────────────────────

async function buildPngDeck(pngPaths: string[]): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  // Slide size from the first PNG (px → inches); contain-fit the rest.
  const dims = pngPaths.map((p) => {
    // PNG IHDR: width @ byte 16, height @ 20 (big-endian).
    const b = readFileSync(p);
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), p };
  });
  const maxW = Math.max(...dims.map((d) => d.w));
  const maxH = Math.max(...dims.map((d) => d.h));
  // The PNGs are FALLBACK_SCALE× the artboard; normalise to artboard inches.
  const slideW = maxW / SCREEN_DPI / FALLBACK_SCALE;
  const slideH = maxH / SCREEN_DPI / FALLBACK_SCALE;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'MAUDE_ARTBOARD', width: slideW, height: slideH });
  pptx.layout = 'MAUDE_ARTBOARD';
  for (const d of dims) {
    const slide = pptx.addSlide();
    const nativeW = d.w / SCREEN_DPI / FALLBACK_SCALE;
    const nativeH = d.h / SCREEN_DPI / FALLBACK_SCALE;
    const scale = Math.min(slideW / nativeW, slideH / nativeH);
    const w = nativeW * scale;
    const h = nativeH * scale;
    const dataUri = `data:image/png;base64,${readFileSync(d.p).toString('base64')}`;
    slide.addImage({ data: dataUri, x: (slideW - w) / 2, y: (slideH - h) / 2, w, h });
  }
  const buf = new Uint8Array((await pptx.write({ outputType: 'nodebuffer' })) as Uint8Array);
  // Strip pptxgenjs's phantom slideMaster<N> Content-Types Overrides.
  const zip = await JSZip.loadAsync(buf);
  const ctEntry = zip.file('[Content_Types].xml');
  if (ctEntry) {
    const parts = new Set(Object.keys(zip.files).filter((n) => !n.endsWith('/')));
    let ct = await ctEntry.async('string');
    ct = ct.replace(/<Override\s+PartName="([^"]+)"[^>]*\/>/g, (full, p: string) =>
      parts.has(p.replace(/^\//, '')) ? full : ''
    );
    zip.file('[Content_Types].xml', ct);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext,
  hooks?: ExportHooks
): Promise<ExportResult> {
  const empty: ExportResult = {
    filename: 'export.pptx',
    contentType: PPTX_MIME,
    body: new Uint8Array(0),
  };
  if (!targets.length) return empty;
  const elementTargets = targets.filter(isElementTarget);
  if (!elementTargets.length) {
    throw new Error('pptx adapter requires element targets (got file-tree)');
  }
  // `options.raster` forces the PNG (non-editable) path even when svg2pptx exists.
  const forceRaster = options.raster === true || options.mode === 'raster';
  const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-pptx-'));
  const svgDir = path.join(tmp, 'svg');
  const pngDir = path.join(tmp, 'png');
  mkdirSync(svgDir, { recursive: true });
  mkdirSync(pngDir, { recursive: true });

  try {
    const useNative = !forceRaster && (await svg2pptxAvailable());

    if (useNative) {
      try {
        const bundle = await getBrowserBundle('dom-to-svg', 'domToSvg');
        const svgFiles: string[] = [];
        for (let i = 0; i < elementTargets.length; i += 1) {
          const t = elementTargets[i];
          svgFiles.push(
            ...(await spawnPlaywrightShim(
              svgArgsFor(t, canvasShellUrl(ctx, t.file), svgDir, bundle),
              hooks
            ))
          );
          hooks?.onProgress?.({ current: i + 1, total: elementTargets.length });
        }
        if (!svgFiles.length) return empty;
        const deckBuffers: Uint8Array[] = [];
        for (let i = 0; i < svgFiles.length; i += 1) {
          const pre = path.join(svgDir, `slide-${i + 1}.pre.svg`);
          writeFileSync(pre, preprocessSvg(readFileSync(svgFiles[i], 'utf8')));
          const outPptx = path.join(svgDir, `slide-${i + 1}.pptx`);
          await runSvg2pptx(pre, outPptx);
          deckBuffers.push(new Uint8Array(readFileSync(outPptx)));
        }
        const body = await mergeDecks(deckBuffers);
        return { filename: `${baseSlug}.pptx`, contentType: PPTX_MIME, body };
      } catch (err) {
        // svg2pptx present but failed on this canvas — fall through to PNG so
        // the export still succeeds, with a diagnostic.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  warn: svg2pptx native PPTX failed, falling back to PNG: ${msg}`);
      }
    } else if (!forceRaster) {
      console.error(
        '  note: svg2pptx not found — exporting a (non-editable) PNG deck. For editable native PowerPoint objects: `pip install svg2pptx` (needs python3).'
      );
    }

    // PNG fallback (faithful, universal, Canva-safe, not editable).
    const pngFiles: string[] = [];
    for (let i = 0; i < elementTargets.length; i += 1) {
      const t = elementTargets[i];
      pngFiles.push(
        ...(await spawnPlaywrightShim(pngArgsFor(t, canvasShellUrl(ctx, t.file), pngDir), hooks))
      );
      hooks?.onProgress?.({ current: i + 1, total: elementTargets.length });
    }
    if (!pngFiles.length) return empty;
    const body = await buildPngDeck(pngFiles);
    return { filename: `${baseSlug}.pptx`, contentType: PPTX_MIME, body };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
