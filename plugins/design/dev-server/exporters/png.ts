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

import {
  type ExportContext,
  type ExportOptions,
  type ExportResult,
  canvasShellUrl,
} from './index.ts';
import type { Target } from './scope.ts';

const PNG_PLAYWRIGHT = path.join(import.meta.dir, '..', 'bin', '_png-playwright.mjs');

interface CaptureOptions {
  scale?: 1 | 2 | 3;
  timeoutSec?: number;
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
    args.push('--widen-to-artboard', '1', '--out', path.join(outDir, `${target.canvasSlug}.png`));
  }
  const proc = Bun.spawn(['node', ...args], {
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
    scale: (options.scale as 1 | 2 | 3 | undefined) ?? 1,
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
