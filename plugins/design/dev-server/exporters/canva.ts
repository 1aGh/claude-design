// Phase 6.5 T6c — Canva handoff adapter.
//
// Wraps T6b's PPTX bytes with a sibling `.canva-handoff.md` artifact and
// ZIPs both into a single bundle. The user unzips, then either drag-drops
// the PPTX into Canva web (universal path) or feeds the markdown prompt
// to their own Canva MCP (one-click handoff for users who've configured
// one). Maude never touches Canva credentials — see DDR.
//
// `--canva=raster` legacy bundle (T6d) is the opt-out for users who want a
// flat reference image set instead of the editable handoff. Routed via
// `options.mode = 'raster'`.

import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';

import { buildHandoffMarkdown } from './canva-handoff-prompt.ts';
import type { ExportContext, ExportOptions, ExportResult } from './index.ts';
import { run as runPng } from './png.ts';
import { run as runPptx } from './pptx.ts';
import type { Target } from './scope.ts';

async function buildRasterBundle(
  elementTargets: Array<Extract<Target, { kind: 'element' }>>,
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  // T6d — legacy PNG+CSV+README handoff. Reuses the PNG adapter for capture
  // then assembles a ZIP with a manifest CSV + a README pointing the user
  // at the raster files as reference imagery (no editable Canva path).
  const pngResult = await runPng(elementTargets, options, ctx);
  const zip = new JSZip();
  const rows: string[] = ['index,filename,canvas_slug'];

  if (pngResult.contentType === 'image/png') {
    zip.file(pngResult.filename, pngResult.body);
    rows.push(`1,${pngResult.filename},${elementTargets[0]?.canvasSlug ?? 'export'}`);
  } else if (pngResult.contentType === 'application/zip' && pngResult.body.byteLength) {
    const inner = await JSZip.loadAsync(pngResult.body);
    let i = 0;
    for (const fname of Object.keys(inner.files)) {
      const file = inner.file(fname);
      if (!file) continue;
      const bytes = await file.async('uint8array');
      zip.file(fname, bytes);
      i += 1;
      rows.push(`${i},${fname},${elementTargets[0]?.canvasSlug ?? 'export'}`);
    }
  }

  const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
  zip.file('manifest.csv', rows.join('\n'));
  zip.file(
    'README.md',
    '# Canva raster bundle\n\n' +
      'Legacy reference-only handoff. PNGs in this folder are NOT editable in Canva — they import as flat images.\n\n' +
      'For an **editable** Canva design (text, shapes, images), re-export without `--canva=raster` to get the PPTX + MCP-prompt bundle instead.\n'
  );
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return {
    filename: `${baseSlug}.canva-raster.zip`,
    contentType: 'application/zip',
    body: zipBytes,
  };
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  if (!targets.length) {
    return {
      filename: 'export.canva.zip',
      contentType: 'application/zip',
      body: new Uint8Array(0),
    };
  }
  const elementTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element'
  );
  if (!elementTargets.length) {
    throw new Error('canva adapter requires element targets (got file-tree)');
  }

  if (options.mode === 'raster') {
    return buildRasterBundle(elementTargets, options, ctx);
  }

  // Editable handoff — delegate to the pptx adapter (which now runs
  // dom-to-pptx) for the payload, then wrap with handoff markdown. We pass
  // the full targets through so multi-artboard canvases produce one slide
  // per artboard inside the pptx.
  const pptxResult = await runPptx(elementTargets, options, ctx);
  const pptxBytes = pptxResult.body;

  const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
  const pptxName = `${baseSlug}.pptx`;
  // dom-to-pptx doesn't surface artboard count from outside; we infer it
  // from the target's multi-ness. For single-artboard exports the count is
  // 1; for canvas-as-separate we report "all artboards" plainly — Canva
  // splits them on import regardless of what we claim here.
  const artboardCount = elementTargets[0]?.multi ? -1 : 1;
  const markdown = buildHandoffMarkdown({
    pptxFilename: pptxName,
    absolutePath: path.join('<your-unzip-location>', pptxName),
    canvasSlug: baseSlug,
    artboardCount: artboardCount > 0 ? artboardCount : 1,
  });

  const zip = new JSZip();
  zip.file(pptxName, pptxBytes);
  zip.file(`${baseSlug}.canva-handoff.md`, markdown);
  const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

  return {
    filename: `${baseSlug}.canva.zip`,
    contentType: 'application/zip',
    body: zipBytes,
  };
}

// Suppress unused-import for `tmpdir` — kept for future raster-bundle
// branches that may need a temp dir.
void tmpdir;
