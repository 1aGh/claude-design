// Phase 6.5 T7 — project-raw ZIP adapter.
//
// Consumes one or more file-tree targets (typically just the single one the
// scope resolver returns for `project-raw`) and streams them into a ZIP.
// Excludes runtime + node_modules + dist by default; user can override via
// `options.exclude` (gitignore-style globs) or `options.include` (filter to
// `'system' | 'canvases' | 'assets' | 'meta'` subtrees).
//
// Memory profile: JSZip's `generateAsync({ type: 'uint8array' })` builds the
// archive in memory. Plan T7 calls for streaming via Bun's Response stream
// to bound RSS at large designRoots — that's a refinement once a real user
// hits the buffer ceiling. Until then, the buffered path keeps the contract
// simple (Uint8Array body matches every other adapter).

import { readFileSync } from 'node:fs';
import path from 'node:path';

import JSZip from 'jszip';

import type { ExportContext, ExportOptions, ExportResult } from './index.ts';
import type { Target } from './scope.ts';

type IncludeTag = 'system' | 'canvases' | 'assets' | 'meta';

function matchesGlob(p: string, glob: string): boolean {
  // Tiny gitignore-style matcher. Supports `*`, `**`, and a trailing slash to
  // mean "directory". Anything fancier (negation, brace expansion) is left to
  // the user — surface in T13 docs.
  const norm = glob.replace(/^\.\//, '').replace(/\/+$/, '');
  if (norm.includes('**')) {
    const re = new RegExp(
      `^${norm
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')}(?:/.*)?$`
    );
    return re.test(p);
  }
  if (norm.includes('*')) {
    const re = new RegExp(`^${norm.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
    return re.test(p);
  }
  return p === norm || p.startsWith(`${norm}/`);
}

function isUnder(p: string, prefix: string): boolean {
  return p === prefix || p.startsWith(`${prefix}/`);
}

function filterPaths(paths: string[], options: ExportOptions): string[] {
  const exclude = Array.isArray(options.exclude) ? (options.exclude as string[]) : [];
  const include = Array.isArray(options.include) ? (options.include as IncludeTag[]) : null;
  const tagPrefix: Record<IncludeTag, string> = {
    system: 'system',
    canvases: 'ui',
    assets: 'assets',
    meta: '',
  };
  return paths.filter((p) => {
    if (exclude.some((g) => matchesGlob(p, g))) return false;
    if (include) {
      const hit = include.some((tag) => {
        if (tag === 'meta') {
          return /\.(json|md|css)$/i.test(p) && !p.includes('/');
        }
        return isUnder(p, tagPrefix[tag]);
      });
      if (!hit) return false;
    }
    return true;
  });
}

export async function run(
  targets: Target[],
  options: ExportOptions,
  ctx: ExportContext
): Promise<ExportResult> {
  if (!targets.length) {
    return { filename: 'project.zip', contentType: 'application/zip', body: new Uint8Array(0) };
  }
  const fileTreeTargets = targets.filter(
    (t): t is Extract<Target, { kind: 'file-tree' }> => t.kind === 'file-tree'
  );
  if (!fileTreeTargets.length) {
    throw new Error('zip adapter requires file-tree targets (got element)');
  }

  const allPaths = fileTreeTargets.flatMap((t) => t.paths);
  const kept = filterPaths(allPaths, options);

  const zip = new JSZip();
  for (const rel of kept) {
    const abs = path.join(ctx.designRoot, rel);
    try {
      const bytes = readFileSync(abs);
      zip.file(rel, new Uint8Array(bytes));
    } catch {
      // File vanished between scope walk and read — skip.
    }
  }
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const projectName = path.basename(ctx.designRoot).replace(/^\./, '') || 'project';
  return {
    filename: `${projectName}.zip`,
    contentType: 'application/zip',
    body: bytes,
  };
}
