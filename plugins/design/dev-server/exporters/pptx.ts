// Phase 6.5 T6b — PPTX adapter via `dom-to-pptx`.
//
// The hand-rolled walker + classifier from the previous iteration produced
// PPTX where text/shape coordinates were collapsed near origin and colours
// were lost — see DDR-043 for the swap rationale. `dom-to-pptx` runs inside
// the page, reads computed styles + getBoundingClientRect for each element,
// and emits one shape per node — the layout the browser already computed.
// Multi-artboard exports concatenate at the byte level via a re-walk per
// artboard.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import path_dirname from 'node:path';

import { canvasShellUrl, type ExportContext, type ExportOptions, type ExportResult } from './index.ts';
import type { Target } from './scope.ts';

const PPTX_PLAYWRIGHT = path.join(import.meta.dir, '..', 'bin', '_pptx-playwright.mjs');
// dom-to-pptx ships a pre-bundled UMD that exposes `window.domToPptx`. The
// exports map hides the bundle path (only `.` is listed), so we resolve via
// the package.json directory instead of `require.resolve('dom-to-pptx/dist/…')`.
function pptxBundlePath(): string {
  const pkgJson = require.resolve('dom-to-pptx/package.json');
  return path.join(path.dirname(pkgJson), 'dist', 'dom-to-pptx.bundle.js');
}

async function captureOne(
  target: Extract<Target, { kind: 'element' }>,
  ctx: ExportContext,
  outFile: string,
  timeoutSec: number,
  bundlePath: string,
  selector?: string
): Promise<void> {
  const args = [
    PPTX_PLAYWRIGHT,
    '--url',
    canvasShellUrl(ctx, target.file),
    '--selector',
    selector ?? target.cssPath,
    '--out',
    outFile,
    '--bundle-path',
    bundlePath,
    '--timeout',
    String(timeoutSec),
  ];
  const proc = Bun.spawn(['node', ...args], {
    cwd: path.dirname(PPTX_PLAYWRIGHT),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`_pptx-playwright exited ${code}: ${stderr.trim() || stdout.trim()}`);
  }
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  if (!targets.length) {
    return {
      filename: 'export.pptx',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      body: new Uint8Array(0),
    };
  }
  const elementTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element'
  );
  if (!elementTargets.length) {
    throw new Error('pptx adapter requires element targets (got file-tree)');
  }
  const timeoutSec = (options.timeoutSec as number | undefined) ?? 20;
  const bundlePath = pptxBundlePath();
  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-pptx-'));

  try {
    // Resolve the artboard set we need to render. For `multi: true` we walk
    // `[data-dc-screen]` and render each separately, then merge.
    const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
    const target = elementTargets[0]!;

    // For canvas-as-separate (`multi: true`), render each artboard as its
    // own PPTX, then concatenate the slides into a single deck.
    if (target.multi) {
      const artboardIds = await enumerateArtboards(target, ctx, timeoutSec);
      const perArtboardFiles: string[] = [];
      for (let i = 0; i < artboardIds.length; i += 1) {
        const id = artboardIds[i];
        const outFile = path.join(tmp, `artboard-${i + 1}.pptx`);
        await captureOne(
          target,
          ctx,
          outFile,
          timeoutSec,
          bundlePath,
          `[data-dc-screen="${id}"]`
        );
        perArtboardFiles.push(outFile);
      }
      const merged = await mergePptx(perArtboardFiles);
      return {
        filename: `${baseSlug}.pptx`,
        contentType:
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        body: merged,
      };
    }

    // Single artboard.
    const outFile = path.join(tmp, `${baseSlug}.pptx`);
    await captureOne(target, ctx, outFile, timeoutSec, bundlePath);
    const bytes = new Uint8Array(readFileSync(outFile));
    return {
      filename: `${baseSlug}.pptx`,
      contentType:
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      body: bytes,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Suppress unused.
void path_dirname;

/**
 * Walk the live canvas page and return ordered `data-dc-screen` IDs.
 * Reuses the existing playwright shim path — cheap because playwright keeps
 * its browser warm across requests, but still one extra navigation per
 * canvas-as-separate export. Worth caching long-term.
 */
async function enumerateArtboards(
  target: Extract<Target, { kind: 'element' }>,
  ctx: ExportContext,
  timeoutSec: number
): Promise<string[]> {
  const url = canvasShellUrl(ctx, target.file);
  // Bun has fetch but no headless rendering; we re-use playwright via a tiny
  // inline call. Cheaper would be to extend the pptx shim to enumerate in a
  // single browser session and emit N pptxs back-to-back. Wired that way in
  // a follow-up if/when canvas-as-separate becomes hot path.
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await c.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutSec * 1000 });
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-dc-screen]')).map(
        (el) => el.getAttribute('data-dc-screen') ?? ''
      )
    );
    return ids.filter(Boolean);
  } finally {
    await browser.close();
  }
}

/**
 * Concatenate slides from many single-slide PPTX files into one deck.
 * pptxgenjs has no merge API. We unpack each ZIP, rewrite slide refs, and
 * repack — minimal OOXML twiddling because every dom-to-pptx output has the
 * same layout/master refs (the lib emits them deterministically).
 */
async function mergePptx(files: string[]): Promise<Uint8Array> {
  if (files.length === 0) return new Uint8Array(0);
  if (files.length === 1) return new Uint8Array(readFileSync(files[0]));
  const JSZip = (await import('jszip')).default;
  // Use the first file as the base — keep its layout/master/theme/presentation
  // skeleton, replace its slide collection with the union from all inputs.
  const base = await JSZip.loadAsync(new Uint8Array(readFileSync(files[0])));
  const slides: Array<{ name: string; xml: string; rels: string }> = [];

  for (const file of files) {
    const zip = await JSZip.loadAsync(new Uint8Array(readFileSync(file)));
    const slideNames = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    for (const sn of slideNames) {
      const slideEntry = zip.file(sn);
      if (!slideEntry) continue;
      const xml = await slideEntry.async('string');
      const relsName = sn.replace('slides/', 'slides/_rels/').replace('.xml', '.xml.rels');
      const relsEntry = zip.file(relsName);
      const rels = relsEntry ? await relsEntry.async('string') : '';
      slides.push({ name: sn, xml, rels });
    }
  }

  // Rewrite slide filenames so they're contiguous.
  const next = new JSZip();
  for (const name of Object.keys(base.files)) {
    // `Object.keys(base.files)` includes directory entries — `base.file(name)`
    // returns null for those. Bare path-based filter first, then the entry
    // lookup with a defensive null-check.
    if (/\/$/.test(name)) continue;
    if (/^ppt\/slides\/(slide|_rels\/slide)\d+\.xml(\.rels)?$/.test(name)) continue;
    const entry = base.file(name);
    if (!entry || entry.dir) continue;
    next.file(name, await entry.async('uint8array'));
  }
  // Insert the merged slide list.
  for (let i = 0; i < slides.length; i += 1) {
    const s = slides[i];
    const idx = i + 1;
    next.file(`ppt/slides/slide${idx}.xml`, s.xml);
    next.file(`ppt/slides/_rels/slide${idx}.xml.rels`, s.rels);
  }
  // Patch ppt/presentation.xml + its rels to reference the new slide count.
  // The original presentation.xml from the first file references slide1; for
  // merged decks > 1 slide we need to grow the sldIdLst. Done via simple
  // regex on the XML string.
  const presPath = 'ppt/presentation.xml';
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  const presEntry = base.file(presPath);
  const presRelsEntry = base.file(presRelsPath);
  if (!presEntry || !presRelsEntry) {
    // Malformed input — fall through to first input untouched. Better than
    // throwing inside the merge for a quirk we can't recover from.
    return new Uint8Array(readFileSync(files[0]));
  }
  const presXml = await presEntry.async('string');
  const presRels = await presRelsEntry.async('string');
  // sldIdLst: rebuild with N entries.
  const idEntries = slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`)
    .join('');
  const newPresXml = presXml.replace(
    /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
    `<p:sldIdLst>${idEntries}</p:sldIdLst>`
  );
  next.file(presPath, newPresXml);
  // Build rels with N slide refs, keeping existing non-slide rels.
  const existingRels = presRels.match(/<Relationship[^/]*\/>/g) ?? [];
  const nonSlideRels = existingRels.filter(
    (r) => !/Type="http:\/\/[^"]*relationships\/slide"/.test(r)
  );
  const slideRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${100 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('');
  const newPresRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nonSlideRels.join('')}${slideRels}</Relationships>`;
  next.file(presRelsPath, newPresRels);

  return next.generateAsync({ type: 'uint8array' });
}
