// Phase 6.5 T4 — SVG adapter.
//
// Walks the rendered DOM via Playwright (mirrors the screenshot path) and
// emits an SVG with <foreignObject>-wrapped HTML + concatenated stylesheets.
// Web fonts are NOT inlined in v1 — see plan T4 caveat + DDR (Safari +
// Illustrator render foreignObject inconsistently; vector text from the
// HTML payload remains editable in Illustrator/Inkscape on the happy path).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';

import { getBrowserBundle } from './_browser-bundles.ts';
import { exportShimPath, resolveExportRuntime } from './_runtime.ts';
import {
  canvasShellUrl,
  type ExportContext,
  type ExportOptions,
  type ExportResult,
} from './index.ts';
import type { Target } from './scope.ts';

// DDR-045: resolve via DEV_SERVER_ROOT, never `import.meta.dir`. See _runtime.ts.
const SVG_PLAYWRIGHT = exportShimPath('_svg-playwright.mjs');

async function captureSvg(
  target: Extract<Target, { kind: 'element' }>,
  ctx: ExportContext,
  outDir: string,
  timeoutSec: number,
  bundlePath: string
): Promise<string[]> {
  const args = [
    SVG_PLAYWRIGHT,
    '--url',
    canvasShellUrl(ctx, target.file),
    '--selector',
    target.cssPath,
    '--bundle-path',
    bundlePath,
    '--timeout',
    String(timeoutSec),
  ];
  if (target.multi) {
    args.push('--multi', '1', '--out-dir', outDir);
  } else {
    // Widen to the enclosing artboard only when scope.ts requested it; a
    // `selection` target captures the element exactly.
    if (target.widen) args.push('--widen-to-artboard', '1');
    args.push('--out', path.join(outDir, `${target.canvasSlug}.svg`));
  }

  // Run via a resolved node/bun runtime so the shim's `import 'playwright'`
  // resolves against dev-server/node_modules (playwright is a devDep). `npm exec`
  // doesn't bridge the module path for ESM imports — confirmed against npm 10.x.
  // resolveExportRuntime() replaces a hardcoded `'node'` so a compiled binary
  // without `node` on PATH surfaces an actionable error, not `posix_spawn 'node'`.
  const proc = Bun.spawn([resolveExportRuntime(), ...args], {
    cwd: path.dirname(SVG_PLAYWRIGHT),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`_svg-playwright exited ${code}: ${stderr.trim() || stdout.trim()}`);
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
    return { filename: 'export.svg', contentType: 'image/svg+xml', body: new Uint8Array(0) };
  }
  const elementTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element'
  );
  if (!elementTargets.length) {
    throw new Error('svg adapter requires element targets (got file-tree)');
  }
  const timeoutSec = (options.timeoutSec as number | undefined) ?? 12;
  const bundlePath = await getBrowserBundle('dom-to-svg', 'domToSvg');
  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-svg-'));

  try {
    const written: string[] = [];
    for (const t of elementTargets) {
      const paths = await captureSvg(t, ctx, tmp, timeoutSec, bundlePath);
      written.push(...paths);
    }
    if (!written.length) {
      return { filename: 'export.svg', contentType: 'image/svg+xml', body: new Uint8Array(0) };
    }
    const entries = written.map((p) => ({
      name: path.basename(p),
      bytes: new Uint8Array(readFileSync(p)),
    }));
    if (entries.length === 1) {
      return {
        filename: entries[0].name,
        contentType: 'image/svg+xml',
        body: entries[0].bytes,
      };
    }
    const zip = new JSZip();
    for (const e of entries) zip.file(e.name, e.bytes);
    const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
    return {
      filename: `${baseSlug}.svg.zip`,
      contentType: 'application/zip',
      body: zipBytes,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
