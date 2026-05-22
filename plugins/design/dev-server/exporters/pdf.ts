// Phase 6.5 T3 — PDF adapter (Playwright page.pdf, vector-faithful).
//
// Uses Chromium's print-to-PDF pipeline so the output is a TRUE vector PDF —
// selectable text, web fonts embedded, SVG primitives kept as paths. The old
// pdf-lib-over-PNG approach (which the user correctly complained was raster)
// is gone; this adapter is now ~50 lines because Chromium does the work.
//
// Multi-target rendering: one PDF per target via the playwright shim, then
// pdf-lib concatenates pages into a single document.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { canvasShellUrl, type ExportContext, type ExportOptions, type ExportResult } from './index.ts';
import type { Target } from './scope.ts';

const PDF_PLAYWRIGHT = path.join(import.meta.dir, '..', 'bin', '_pdf-playwright.mjs');

async function capturePdf(
  target: Extract<Target, { kind: 'element' }>,
  ctx: ExportContext,
  outDir: string,
  timeoutSec: number
): Promise<string[]> {
  const args = [
    PDF_PLAYWRIGHT,
    '--url',
    canvasShellUrl(ctx, target.file),
    '--selector',
    target.cssPath,
    '--timeout',
    String(timeoutSec),
  ];
  if (target.multi) args.push('--multi', '1', '--out-dir', outDir);
  else args.push('--out', path.join(outDir, `${target.canvasSlug}.pdf`));

  const proc = Bun.spawn(['node', ...args], {
    cwd: path.dirname(PDF_PLAYWRIGHT),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`_pdf-playwright exited ${code}: ${stderr.trim() || stdout.trim()}`);
  }
  return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  if (!targets.length) {
    return { filename: 'export.pdf', contentType: 'application/pdf', body: new Uint8Array(0) };
  }
  const elementTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element'
  );
  if (!elementTargets.length) {
    throw new Error('pdf adapter requires element targets (got file-tree)');
  }
  const timeoutSec = (options.timeoutSec as number | undefined) ?? 12;
  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-pdf-'));
  try {
    const written: string[] = [];
    for (const t of elementTargets) {
      const paths = await capturePdf(t, ctx, tmp, timeoutSec);
      written.push(...paths);
    }
    if (!written.length) {
      return { filename: 'export.pdf', contentType: 'application/pdf', body: new Uint8Array(0) };
    }
    if (written.length === 1) {
      const bytes = new Uint8Array(readFileSync(written[0]));
      const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
      return { filename: `${baseSlug}.pdf`, contentType: 'application/pdf', body: bytes };
    }
    // Multi-target → concatenate via pdf-lib `copyPages`. The vector
    // primitives produced by Chromium copy through losslessly — we never
    // re-render or rasterize.
    const out = await PDFDocument.create();
    for (const p of written) {
      const src = await PDFDocument.load(new Uint8Array(readFileSync(p)));
      const pages = await out.copyPages(src, src.getPageIndices());
      for (const page of pages) out.addPage(page);
    }
    const bytes = await out.save();
    const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
    return { filename: `${baseSlug}.pdf`, contentType: 'application/pdf', body: bytes };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
