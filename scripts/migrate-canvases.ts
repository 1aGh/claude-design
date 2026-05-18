#!/usr/bin/env bun
// Phase 3.6 Task 8 — one-shot HTML → TSX canvas codemod.
//
// Walks every `.design/ui/*.html` canvas (NOT the system/project/preview/*.html
// specimens — those stay HTML per the plan's "Files to Update" gotcha), and
// rewrites it as a paired `<Slug>.tsx` + `<Slug>.css` + `<Slug>.meta.json` set:
//
//   - <Slug>.tsx  → default-export React 19 component lifted from the canvas's
//                   <script type="text/babel"> body. `React.useState/Effect/...`
//                   references are rewritten to bare-named hook imports. The
//                   `ReactDOM.createRoot(...).render(<App />)` trailing line is
//                   stripped (the dev-server shell mounts the canvas via the
//                   /_canvas-shell.html harness).
//   - <Slug>.css  → inline <style> block extracted verbatim (global selectors,
//                   side-effect import). Heavy class-by-class deduplication
//                   against `_components.css` is out of scope for v1 — these
//                   files are migration drops, not steady-state authoring.
//   - <Slug>.meta.json → mirrors the existing sidecar; `css_mode: "inline"` +
//                        `data_cd_id_version: 1` injected.
//
// The original .html is moved (not deleted) to
// `.design/_history/_migration-2026-05-15/<original-rel-path>` so the migration
// is reversible.
//
// JSDoc header (Task 12a) is generated from .meta.json + prepended to the TSX.
//
// CLI:
//   bun scripts/migrate-canvases.ts [--dry-run] [--canvas <path>]
//
//   --dry-run      Print per-file diff summary; don't write anything.
//   --canvas <p>   Migrate one canvas only. Otherwise every `.design/ui/*.html`
//                  in the project root is migrated.
//
// Exit codes: 0 success / non-zero on any file failing.

import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { rename, readdir } from 'node:fs/promises';

const REPO_ROOT = path.resolve(import.meta.dir, '..');
const DESIGN_ROOT = path.join(REPO_ROOT, '.design');
const UI_DIR = path.join(DESIGN_ROOT, 'ui');
const MIGRATION_STAMP = '2026-05-15';
const HISTORY_DIR = path.join(DESIGN_ROOT, '_history', `_migration-${MIGRATION_STAMP}`);

interface MetaSidecar {
  title?: string;
  subtitle?: string;
  brief?: string;
  platform?: string;
  designSystem?: string;
  opt_out_scope?: string;
  sections?: Array<{
    id: string;
    title?: string;
    label?: string;
    subtitle?: string;
    artboards?: Array<{ id: string; label: string }>;
  }>;
  iteration_count?: number;
  envelope_path?: string;
  css_mode?: 'inline' | 'tailwind' | 'modules';
  data_cd_id_version?: number;
  [key: string]: unknown;
}

interface MigrationResult {
  canvas: string;
  tsxBytes: number;
  cssBytes: number;
  artboards: number;
  reactHooks: string[];
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Helpers

function kebabSlug(stem: string): string {
  return stem
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function pascalIdent(stem: string): string {
  return stem
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Pull the text between <script type="text/babel">...</script>. Returns the
 * raw body (preserving leading/trailing newlines) or null if no babel block.
 */
function extractBabelScript(html: string): string | null {
  const m = html.match(/<script[^>]*type="text\/babel"[^>]*>([\s\S]*?)<\/script>/i);
  return m && m[1] ? m[1] : null;
}

/** Extract the contents of the first top-level <style> block. */
function extractStyleBlock(html: string): string | null {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return m && m[1] ? m[1] : null;
}

/**
 * Rewrite `React.useState` → `useState` (etc.) and return the set of hook
 * names referenced. Also strips the trailing ReactDOM mount line.
 */
function transformBabelBody(body: string): { code: string; hooks: Set<string> } {
  const hooks = new Set<string>();
  // Capture every React.<id> reference; we'll rewrite to bare ids and import
  // them from react. Hooks + non-hook exports (Fragment, memo, forwardRef)
  // share the rewrite.
  const REACT_REF = /React\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let code = body.replace(REACT_REF, (_, name: string) => {
    hooks.add(name);
    return name;
  });
  // Drop the ReactDOM mount line(s). Canvases historically use:
  //   ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  //   ReactDOM.render(<App />, document.getElementById('root'));
  code = code.replace(
    /^\s*ReactDOM\.(createRoot[^;]*|render[^;]*);\s*$/gm,
    ''
  );
  // Any stray `ReactDOM.` reference left over is suspicious — leave as-is so
  // the per-file diff surfaces it.
  return { code: code.trimEnd() + '\n', hooks };
}

/**
 * Detect the top-level component name to default-export. Prefer the one in
 * the dropped `ReactDOM.createRoot(...).render(<X />)` line; fall back to the
 * last `function PascalIdent() {` definition in the body.
 */
function detectComponent(rawBabel: string): string {
  const renderMatch = rawBabel.match(/render\(\s*<([A-Z][A-Za-z0-9_]*)/);
  if (renderMatch && renderMatch[1]) return renderMatch[1];
  // Last `function Pascal() {` definition.
  const fnRe = /function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = fnRe.exec(rawBabel)) !== null) {
    last = m[1] as string;
  }
  return last ?? 'Canvas';
}

/**
 * Build a JSDoc header (Task 12a) from a meta sidecar. Block is *generated*;
 * /design:edit step 1 (or future canvas-header.ts) should re-sync it when
 * .meta.json changes.
 */
export function jsDocHeader(opts: {
  name: string;
  meta: MetaSidecar;
  dsName?: string;
  cssMode: string;
}): string {
  const artboardIds = (opts.meta.sections ?? [])
    .flatMap((s) => s.artboards ?? [])
    .map((a) => a.id)
    .join(' | ');
  const opt = opts.meta.opt_out_scope ?? 'palette';
  const platform = opts.meta.platform ?? 'desktop';
  const ds = opts.meta.designSystem ?? opts.dsName ?? 'project';
  const brief = (opts.meta.brief ?? '').replace(/\s+/g, ' ').trim();
  const subtitle = (opts.meta.subtitle ?? '').replace(/\s+/g, ' ').trim();
  const lines: string[] = [
    '/**',
    ` * @canvas      ${opts.name}${subtitle ? ` — ${subtitle}` : ''}`,
    ` * @ds          ${ds}`,
    ` * @platform    ${platform}`,
    ` * @opt_out     ${opt}`,
    ` * @artboards   ${artboardIds || '—'}`,
    ` * @brief       ${brief || '—'}`,
    ` * @stack       React 19 · TSX · Bun.build · css_mode=${opts.cssMode}`,
    ` * @history     .design/_history/${kebabSlug(opts.name)}/`,
    ` * @handoff     bunx shadcn add file://./${opts.name}.registry.json`,
  ];
  const ai = opts.meta.ai_context as
    | { why_this_exists?: string; pinned_decisions?: string[]; known_quirks?: string[] }
    | undefined;
  if (ai?.why_this_exists) {
    lines.push(' *', ` * @notes       ${ai.why_this_exists.replace(/\s+/g, ' ').trim()}`);
  }
  lines.push(' */');
  return lines.join('\n') + '\n';
}

/**
 * Build the final TSX text from a transformed babel body + hooks set +
 * detected component name + jsdoc header + side-effect CSS import.
 */
function assembleTsx(args: {
  header: string;
  body: string;
  hooks: Set<string>;
  componentName: string;
  cssBasename: string | null;
}): string {
  const importNames = [...args.hooks].sort().join(', ');
  const reactImport = importNames ? `import { ${importNames} } from "react";\n` : '';
  const cssImport = args.cssBasename ? `import "./${args.cssBasename}";\n` : '';
  const exportLine = `\nexport default ${args.componentName};\n`;
  return `${args.header}\n${reactImport}${cssImport}\n${args.body.trim()}${exportLine}`;
}

// ---------------------------------------------------------------------------
// Per-canvas migration

async function migrateOne(htmlAbsPath: string, dryRun: boolean): Promise<MigrationResult> {
  const html = await Bun.file(htmlAbsPath).text();
  const babel = extractBabelScript(html);
  if (!babel) {
    throw new Error(`${htmlAbsPath}: no <script type="text/babel"> block found`);
  }
  const styleBlock = extractStyleBlock(html);

  const stem = path.basename(htmlAbsPath, '.html');
  const slug = kebabSlug(stem);
  const dir = path.dirname(htmlAbsPath);
  const tsxPath = path.join(dir, `${stem}.tsx`);
  const cssPath = path.join(dir, `${stem}.css`);
  const metaPath = path.join(dir, `${stem}.meta.json`);

  // Load existing meta sidecar (if any).
  let meta: MetaSidecar = {};
  if (existsSync(metaPath)) {
    try {
      meta = (await Bun.file(metaPath).json()) as MetaSidecar;
    } catch {
      // ignore — corrupt meta is rare; we'll overwrite cleanly
    }
  }

  // Inject css_mode + data_cd_id_version.
  meta.css_mode = meta.css_mode ?? 'inline';
  meta.data_cd_id_version = meta.data_cd_id_version ?? 1;

  // Codemod the babel body.
  const componentName = detectComponent(babel);
  const transformed = transformBabelBody(babel);
  // Ensure the named component is reachable as a default export. If the body
  // doesn't include a top-level `function <componentName>` or `const
  // <componentName> =`, we still emit the export line (consumer can adjust).
  const cssBasename = styleBlock && styleBlock.trim().length > 0 ? `${stem}.css` : null;

  // Generate JSDoc header (Task 12a integrated).
  const header = jsDocHeader({
    name: stem,
    meta,
    dsName: meta.designSystem,
    cssMode: meta.css_mode ?? 'inline',
  });

  const tsx = assembleTsx({
    header,
    body: transformed.code,
    hooks: transformed.hooks,
    componentName,
    cssBasename,
  });

  const artboardCount = (meta.sections ?? []).reduce(
    (n, s) => n + (s.artboards?.length ?? 0),
    0
  );

  if (!dryRun) {
    if (cssBasename && styleBlock) {
      await Bun.write(cssPath, `${styleBlock.trim()}\n`);
    }
    await Bun.write(tsxPath, tsx);
    await Bun.write(metaPath, `${JSON.stringify(meta, null, 2)}\n`);

    // Archive the original .html.
    const relFromUi = path.relative(DESIGN_ROOT, htmlAbsPath);
    const archive = path.join(HISTORY_DIR, relFromUi);
    mkdirSync(path.dirname(archive), { recursive: true });
    await rename(htmlAbsPath, archive);
  }

  return {
    canvas: htmlAbsPath,
    tsxBytes: tsx.length,
    cssBytes: styleBlock?.length ?? 0,
    artboards: artboardCount,
    reactHooks: [...transformed.hooks].sort(),
    dryRun,
  };
}

// ---------------------------------------------------------------------------
// Discovery

async function listUiCanvases(): Promise<string[]> {
  if (!existsSync(UI_DIR)) return [];
  const entries = await readdir(UI_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => path.join(UI_DIR, e.name));
}

// ---------------------------------------------------------------------------
// CLI

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const idxCanvas = argv.indexOf('--canvas');
  const single = idxCanvas >= 0 ? argv[idxCanvas + 1] : null;

  const canvases = single
    ? [path.isAbsolute(single) ? single : path.join(REPO_ROOT, single)]
    : await listUiCanvases();

  if (canvases.length === 0) {
    console.error('migrate-canvases: no .html canvases found under', UI_DIR);
    return 1;
  }

  let failures = 0;
  for (const c of canvases) {
    try {
      const r = await migrateOne(c, dryRun);
      const rel = path.relative(REPO_ROOT, r.canvas);
      const dryTag = dryRun ? '[DRY] ' : '';
      console.log(
        `${dryTag}✓ ${rel} → tsx=${r.tsxBytes}B css=${r.cssBytes}B artboards=${r.artboards} hooks=[${r.reactHooks.join(',')}]`
      );
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${c}: ${msg}`);
    }
  }
  if (failures > 0) {
    console.error(`migrate-canvases: ${failures} failure(s)`);
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
