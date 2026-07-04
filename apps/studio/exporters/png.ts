// Phase 6.5 T2 — PNG adapter (playwright-native).
//
// Drives `bin/_png-playwright.mjs` — Chromium-via-Playwright with explicit
// viewport sizing per target. The previous `screenshot.sh` path used
// agent-browser which applied its own viewport defaults and produced clipped
// captures of the world-plane background instead of the artboard. With our
// own shim we control the viewport, scroll the artboard to (0,0), then
// `page.screenshot({ clip })`.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { exportShimPath, resolveExportRuntime } from './_runtime.ts';
import {
  canvasShellUrl,
  type ExportContext,
  type ExportOptions,
  type ExportResult,
} from './index.ts';
import type { Target } from './scope.ts';

// DDR-045: resolve via DEV_SERVER_ROOT, never `import.meta.dir` (→ /$bunfs/root
// in a compiled binary). See exporters/_runtime.ts.
const PNG_PLAYWRIGHT = exportShimPath('_png-playwright.mjs');

interface CaptureOptions {
  scale?: 1 | 2 | 3;
  timeoutSec?: number;
}

/**
 * Coerce an arbitrary `options.scale` into the 1–3 preset range (default 2×).
 * Exported for unit coverage of the item-1 default/clamp behaviour.
 */
export function clampScale(raw: unknown): 1 | 2 | 3 {
  const n = Math.round(Number(raw));
  if (n === 1) return 1;
  if (n === 3) return 3;
  return 2;
}

async function captureElement(
  target: Extract<Target, { kind: 'element' }>,
  ctx: ExportContext,
  outDir: string,
  options: CaptureOptions
): Promise<string[]> {
  const args = [
    PNG_PLAYWRIGHT,
    '--url',
    canvasShellUrl(ctx, target.file),
    '--selector',
    target.cssPath,
    '--scale',
    String(options.scale ?? 1),
    '--timeout',
    String(options.timeoutSec ?? 12),
  ];
  if (target.multi) {
    args.push('--multi', '1', '--out-dir', outDir);
  } else {
    // Only widen to the enclosing artboard when scope.ts asked for it
    // (artboard-via-descendant fallback). `selection` scope sets widen=false so
    // the capture is the element exactly; artboard-by-id targets the screen
    // element directly and needs no widening.
    if (target.widen) args.push('--widen-to-artboard', '1');
    args.push('--out', path.join(outDir, `${target.canvasSlug}.png`));
  }
  const proc = Bun.spawn([resolveExportRuntime(), ...args], {
    cwd: path.dirname(PNG_PLAYWRIGHT),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`_png-playwright exited ${code}: ${stderr.trim() || stdout.trim()}`);
  }
  return stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readBytes(paths: string[]): Array<{ name: string; bytes: Uint8Array }> {
  return paths.map((p) => ({
    name: path.basename(p),
    bytes: new Uint8Array(readFileSync(p)),
  }));
}

async function bundleZip(entries: Array<{ name: string; bytes: Uint8Array }>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const e of entries) {
    zip.file(e.name, e.bytes);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  if (!targets.length) {
    return { filename: 'export.png', contentType: 'image/png', body: new Uint8Array(0) };
  }
  const elementTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'element' }> => t.kind === 'element'
  );
  if (!elementTargets.length) {
    throw new Error('png adapter requires element targets (got file-tree)');
  }

  const tmp = mkdtempSync(path.join(tmpdir(), 'maude-png-'));
  const captureOpts: CaptureOptions = {
    // Default 2× — a single-scale PNG was uselessly small (item 1). The dialog
    // sends an explicit scale; this default covers direct API / curl callers.
    // Clamped to the 1–3 preset range; the shim re-clamps deviceScaleFactor ≤ 4.
    scale: clampScale(options.scale),
    timeoutSec: (options.timeoutSec as number | undefined) ?? 8,
  };

  try {
    const written: string[] = [];
    for (const t of elementTargets) {
      const paths = await captureElement(t, ctx, tmp, captureOpts);
      written.push(...paths);
    }
    const entries = readBytes(written);

    if (entries.length === 0) {
      return { filename: 'export.png', contentType: 'image/png', body: new Uint8Array(0) };
    }
    if (entries.length === 1) {
      return {
        filename: entries[0].name,
        contentType: 'image/png',
        body: entries[0].bytes,
      };
    }
    const zipBytes = await bundleZip(entries);
    const baseSlug = elementTargets[0]?.canvasSlug ?? 'export';
    return {
      filename: `${baseSlug}.zip`,
      contentType: 'application/zip',
      body: zipBytes,
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
