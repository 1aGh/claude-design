// canvas-header.ts — Phase 3.6 Task 12a. JSDoc header generator for canvas
// TSX files. Projects `<Slug>.meta.json` → the leading block comment, so a
// future Claude (or human) cold-reading the canvas sees DS / opt-out / brief /
// artboards / handoff command without opening the sidecar.
//
// Header is *generated*. `.meta.json` stays the source of truth; this module
// is a projection. /design:edit step 1 (or scripts/migrate-canvases.ts) calls
// `applyHeader(canvasPath)` to keep the projection in sync.
//
// Idempotency:
//   - First non-empty token is `/**` ending in `*/`  → overwrite that block.
//   - Otherwise                                       → prepend a new block.
//
// JSX / imports are never touched. The module-level `import` order survives.

import path from 'node:path';

export interface MetaSidecar {
  title?: string;
  subtitle?: string;
  brief?: string;
  platform?: string;
  designSystem?: string;
  opt_out_scope?: string;
  css_mode?: 'inline' | 'tailwind' | 'modules';
  sections?: Array<{ id: string; artboards?: Array<{ id: string }> }>;
  ai_context?: {
    pinned_decisions?: string[];
    known_quirks?: string[];
    why_this_exists?: string;
  };
  [k: string]: unknown;
}

export interface HeaderOpts {
  /** Bare canvas name (file stem, no extension). Used for @canvas + @handoff. */
  name: string;
  meta: MetaSidecar;
  /** Override the DS slug. Defaults to meta.designSystem ?? 'project'. */
  dsName?: string;
}

/**
 * Build the JSDoc header string (no trailing newline padding — caller picks).
 * Pure function — no fs.
 */
export function buildHeader(opts: HeaderOpts): string {
  const m = opts.meta;
  const artboardIds =
    (m.sections ?? [])
      .flatMap((s) => s.artboards ?? [])
      .map((a) => a.id)
      .join(' | ') || '—';
  const opt = m.opt_out_scope ?? 'palette';
  const platform = m.platform ?? 'desktop';
  const ds = m.designSystem ?? opts.dsName ?? 'project';
  const cssMode = m.css_mode ?? 'inline';
  const brief = (m.brief ?? '').replace(/\s+/g, ' ').trim() || '—';
  const subtitle = (m.subtitle ?? '').replace(/\s+/g, ' ').trim();
  const slug = kebabSlug(opts.name);

  const lines = [
    '/**',
    ` * @canvas      ${opts.name}${subtitle ? ` — ${subtitle}` : ''}`,
    ` * @ds          ${ds}`,
    ` * @platform    ${platform}`,
    ` * @opt_out     ${opt}`,
    ` * @artboards   ${artboardIds}`,
    ` * @brief       ${brief}`,
    ` * @stack       React 19 · TSX · Bun.build · css_mode=${cssMode}`,
    ` * @history     .design/_history/${slug}/`,
    ` * @handoff     bunx shadcn add file://./${opts.name}.registry.json`,
  ];

  const ai = m.ai_context;
  if (ai && (ai.why_this_exists || (ai.pinned_decisions?.length ?? 0) > 0)) {
    lines.push(' *');
    if (ai.why_this_exists) {
      lines.push(` * @notes       ${ai.why_this_exists.replace(/\s+/g, ' ').trim()}`);
    }
    for (const dec of ai.pinned_decisions ?? []) {
      lines.push(` * @decision    ${dec.replace(/\s+/g, ' ').trim()}`);
    }
    for (const q of ai.known_quirks ?? []) {
      lines.push(` * @quirk       ${q.replace(/\s+/g, ' ').trim()}`);
    }
  }
  lines.push(' */');
  return lines.join('\n');
}

/**
 * Pure helper: replace or insert the header in a TSX source string. Returns
 * the new source. If the source already starts with a block comment, that
 * comment is replaced; otherwise a fresh header is prepended.
 */
export function applyHeaderToSource(source: string, header: string): string {
  const trimmed = source.trimStart();
  const leading = source.length - trimmed.length;
  if (trimmed.startsWith('/**')) {
    const end = trimmed.indexOf('*/');
    if (end > 0) {
      const before = source.slice(0, leading);
      const after = trimmed.slice(end + 2);
      return `${before}${header}${after}`;
    }
  }
  return `${header}\n\n${source}`;
}

/**
 * Read a canvas file + sibling .meta.json, regenerate the JSDoc header, write
 * the canvas back atomically. No-op when content is identical.
 */
export async function applyHeader(canvasAbsPath: string): Promise<{ changed: boolean }> {
  const ext = path.extname(canvasAbsPath);
  const stem = path.basename(canvasAbsPath, ext);
  const metaPath = path.join(path.dirname(canvasAbsPath), `${stem}.meta.json`);
  const metaFile = Bun.file(metaPath);
  const meta: MetaSidecar = (await metaFile.exists())
    ? ((await metaFile.json()) as MetaSidecar)
    : {};
  const source = await Bun.file(canvasAbsPath).text();
  const header = buildHeader({ name: stem, meta });
  const next = applyHeaderToSource(source, header);
  if (next === source) return { changed: false };
  const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
  await Bun.write(tmp, next);
  const { rename } = await import('node:fs/promises');
  await rename(tmp, canvasAbsPath);
  return { changed: true };
}

function kebabSlug(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// CLI entry — invoked by /design:edit's pre-flight when canvas-meta has
// changed since the header was last projected.

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--invoke' && argv.length === 2) {
    const canvas = argv[1] as string;
    try {
      const { changed } = await applyHeader(canvas);
      console.log(JSON.stringify({ canvas, changed }));
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`canvas-header: ${msg}`);
      process.exit(2);
    }
  } else {
    console.error('Usage: bun run canvas-header.ts --invoke <canvas-abs-path>');
    process.exit(2);
  }
}
