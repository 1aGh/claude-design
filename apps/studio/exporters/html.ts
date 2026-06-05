// Phase 6.5 T5 — HTML adapter (standalone bundler).
//
// Renders the target through Playwright, emits a self-contained `index.html`
// with all stylesheets inlined (fonts + remote images still referenced by
// origin — full asset inlining is a follow-up). Output is always a ZIP per
// plan T5 ("Always zipped (multi-file)"), even for a single artboard,
// because the consuming workflow typically wants one bundle per export.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';

import {
  canvasShellUrl,
  type ExportContext,
  type ExportOptions,
  type ExportResult,
} from './index.ts';
import type { Target } from './scope.ts';

const HTML_PLAYWRIGHT = path.join(import.meta.dir, '..', 'bin', '_html-playwright.mjs');

async function captureHtml(
  target: Extract<Target, { kind: 'element' }>,
  ctx: ExportContext,
  outDir: string,
  timeoutSec: number
): Promise<string[]> {
  const args = [
    HTML_PLAYWRIGHT,
    '--url',
    canvasShellUrl(ctx, target.file),
    '--selector',
    target.cssPath,
    '--timeout',
    String(timeoutSec),
  ];
  if (target.multi) {
    args.push('--multi', '1', '--out-dir', outDir);
  } else {
    // Widen to the enclosing artboard only when scope.ts requested it; a
    // `selection` target serializes the element exactly.
    if (target.widen) args.push('--widen-to-artboard', '1');
    args.push('--out', path.join(outDir, `${target.canvasSlug}.html`));
  }
  const proc = Bun.spawn(['node', ...args], {
    cwd: path.dirname(HTML_PLAYWRIGHT),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`_html-playwright exited ${code}: ${stderr.trim() || stdout.trim()}`);
  }
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  if (!targets.length) {
    return { filename: 'export.zip', contentType: 'application/zip', body: new Uint8Array(0) };
  }
  const elementTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element'
  );
  if (!elementTargets.length) {
    throw new Error('html adapter requires element targets (got file-tree)');
  }
  const timeoutSec = (options.timeoutSec as number | undefined) ?? 8;
  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-html-'));
  try {
    const written: string[] = [];
    for (const t of elementTargets) {
      const paths = await captureHtml(t, ctx, tmp, timeoutSec);
      written.push(...paths);
    }
    if (!written.length) {
      return { filename: 'export.zip', contentType: 'application/zip', body: new Uint8Array(0) };
    }
    const zip = new JSZip();
    for (const p of written) {
      zip.file(path.basename(p), new Uint8Array(readFileSync(p)));
    }
    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
    return {
      filename: `${baseSlug}.html.zip`,
      contentType: 'application/zip',
      body: zipBytes,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
