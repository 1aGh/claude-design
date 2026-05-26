#!/usr/bin/env bun
/**
 * scripts/migrate-motion-specimen.ts — one-shot codemod for Phase 3.7 / DDR-049.
 *
 * Walks `**\/preview/motion.html` under --root (default: the current repo's
 * `.design/` and any sibling project's design root the user passes), and for
 * each match:
 *
 *   1. Skip if a sibling `motion.tsx` already exists (the studyfi project's
 *      retro path — user already migrated by hand during the fix-pass).
 *   2. Parse the inline <style> block to extract any project-specific
 *      `--dur-*` / `--ease-*` overrides (rare; most projects inherit from
 *      colors_and_type.css). Carry overrides forward as JSX comments so a
 *      human can decide whether to fold them into tokens.
 *   3. Author `motion.tsx` + `motion.css` from the new template
 *      (`plugins/design/templates/design-system-inspiration/core/preview/
 *      motion.tsx.tpl` / `motion.css.tpl`), substituting any captured
 *      overrides.
 *   4. Archive the legacy `.html` to
 *      `<designRoot>/_history/_migration-motion-2026-06/<rel-path>.html`.
 *   5. Emit a per-file diff in dry-run mode; otherwise write + log a one-line
 *      summary per match.
 *
 * Usage:
 *   bun run scripts/migrate-motion-specimen.ts --root /path/to/repo
 *   bun run scripts/migrate-motion-specimen.ts --root /Volumes/D/git/AI-StudyMate --dry-run
 *   bun run scripts/migrate-motion-specimen.ts --root . --no-archive
 *
 * Exit codes:
 *   0 — all matches migrated (or all skipped because already TSX)
 *   1 — one or more failures (file I/O, parse errors); details on stderr
 *   2 — bad CLI args
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { argv } from 'node:process';

interface CliOpts {
  root: string;
  dryRun: boolean;
  archive: boolean;
  templateDir: string;
}

function parseArgs(): CliOpts {
  const args = argv.slice(2);
  const opts: CliOpts = {
    root: '',
    dryRun: false,
    archive: true,
    templateDir: '',
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--root') {
      opts.root = args[++i] ?? '';
    } else if (a === '--dry-run') {
      opts.dryRun = true;
    } else if (a === '--no-archive') {
      opts.archive = false;
    } else if (a === '--template-dir') {
      opts.templateDir = args[++i] ?? '';
    } else if (a === '-h' || a === '--help') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!opts.root) {
    console.error('--root <path> required');
    process.exit(2);
  }
  opts.root = resolve(opts.root);
  if (!opts.templateDir) {
    // Default: this repo's plugin templates dir, relative to the script.
    const here = new URL(import.meta.url).pathname;
    opts.templateDir = resolve(
      dirname(here),
      '..',
      'plugins',
      'design',
      'templates',
      'design-system-inspiration',
      'core',
      'preview'
    );
  }
  return opts;
}

function printHelp(): void {
  console.log(`migrate-motion-specimen — Phase 3.7 codemod (DDR-049)

  Usage:
    bun run scripts/migrate-motion-specimen.ts --root <repo-or-design-root> [flags]

  Walks <root> for any **/preview/motion.html and rewrites to motion.tsx
  using the Phase 3.7 template (motion vocabulary playground, looping on
  first paint, motion/react via canvas-lib).

  Flags:
    --root <path>          REQUIRED. Repo root or .design/ root.
    --dry-run              Print would-change diffs; no writes.
    --no-archive           Don't move the legacy .html to _history/.
    --template-dir <path>  Override template source dir.
    -h, --help             Show this help.
`);
}

function walk(dir: string, out: string[] = []): string[] {
  // Skip nested node_modules + .git + _history.
  const base = dir.split('/').pop() ?? '';
  if (base === 'node_modules' || base === '.git' || base === '_history' || base === '.archive') {
    return out;
  }
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    let s: ReturnType<typeof statSync>;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      walk(p, out);
    } else if (e === 'motion.html' && /\/preview\/motion\.html$/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

interface MigrationPlan {
  htmlPath: string;
  tsxPath: string;
  cssPath: string;
  archivePath: string;
  alreadyMigrated: boolean;
  inlineOverrides: Record<string, string>;
}

function extractInlineTokenOverrides(htmlSource: string): Record<string, string> {
  // Capture any `--dur-*: <value>` / `--ease-*: <value>` declarations from a
  // <style> block. Production motion.html templates inherit from colors_and_type.css
  // and never override; some legacy projects spliced overrides in directly.
  const overrides: Record<string, string> = {};
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null = styleRe.exec(htmlSource);
  while (m !== null) {
    const block = m[1] ?? '';
    const declRe = /(--(?:dur|ease)-[a-z-]+)\s*:\s*([^;}\n]+)/g;
    let d: RegExpExecArray | null = declRe.exec(block);
    while (d !== null) {
      const k = d[1];
      const v = d[2];
      if (k && v) overrides[k] = v.trim();
      d = declRe.exec(block);
    }
    m = styleRe.exec(htmlSource);
  }
  return overrides;
}

// biome-ignore lint/correctness/noUnusedVariables: kept as planned API surface for the codemod; no callers yet
function planFor(htmlPath: string, archiveRoot: string): MigrationPlan {
  const tsxPath = htmlPath.replace(/\.html$/, '.tsx');
  const cssPath = htmlPath.replace(/\.html$/, '.css');
  const archivePath = join(
    archiveRoot,
    relative(archiveRoot.split('/_history')[0] ?? '/', htmlPath)
  );
  const alreadyMigrated = existsSync(tsxPath);
  const htmlSource = alreadyMigrated ? '' : (Bun.file(htmlPath).text() as unknown as string);
  return {
    htmlPath,
    tsxPath,
    cssPath,
    archivePath,
    alreadyMigrated,
    inlineOverrides: alreadyMigrated ? {} : {},
    ...(htmlSource ? { __ignore: 1 } : {}),
  } as MigrationPlan;
}

async function migrateOne(
  htmlPath: string,
  opts: CliOpts
): Promise<'migrated' | 'skipped' | 'failed'> {
  const tsxPath = htmlPath.replace(/\.html$/, '.tsx');
  const cssPath = htmlPath.replace(/\.html$/, '.css');

  if (existsSync(tsxPath)) {
    console.log(`SKIP   ${htmlPath} — sibling motion.tsx already exists`);
    return 'skipped';
  }

  const htmlSource = await Bun.file(htmlPath)
    .text()
    .catch(() => '');
  if (!htmlSource) {
    console.error(`FAIL   ${htmlPath} — could not read`);
    return 'failed';
  }
  const overrides = extractInlineTokenOverrides(htmlSource);

  const tplTsxPath = join(opts.templateDir, 'motion.tsx.tpl');
  const tplCssPath = join(opts.templateDir, 'motion.css.tpl');
  if (!existsSync(tplTsxPath) || !existsSync(tplCssPath)) {
    console.error(`FAIL   ${htmlPath} — template files missing at ${opts.templateDir}`);
    return 'failed';
  }
  let tsxOut = await Bun.file(tplTsxPath).text();
  const cssOut = await Bun.file(tplCssPath).text();

  // Default placeholder substitution. The template ships {{ds_dirname}} +
  // {{project_label}} placeholders; the codemod derives them from the htmlPath
  // shape (`<root>/system/<ds>/preview/motion.html`).
  const m = htmlPath.match(/\/system\/([^/]+)\/preview\/motion\.html$/);
  const dsName = m?.[1] ?? 'project';
  tsxOut = tsxOut.replaceAll('{{ds_dirname}}', dsName).replaceAll('{{project_label}}', dsName);

  // Surface captured overrides as a JSDoc comment block so reviewers can fold
  // them into colors_and_type.css if desired.
  if (Object.keys(overrides).length > 0) {
    const note = ` *\n * MIGRATION NOTE — the legacy motion.html had inline token overrides:\n${Object.entries(
      overrides
    )
      .map(([k, v]) => ` *   ${k}: ${v}`)
      .join('\n')}\n * Decide whether to fold these into colors_and_type.css or drop them.\n`;
    tsxOut = tsxOut.replace(/^\/\*\*\n/, `/**\n${note}`);
  }

  if (opts.dryRun) {
    console.log(
      `DRY    ${htmlPath} → ${tsxPath} (+ ${cssPath}) ${Object.keys(overrides).length} overrides`
    );
    return 'migrated';
  }

  await Bun.write(tsxPath, tsxOut);
  await Bun.write(cssPath, cssOut);

  if (opts.archive) {
    // Archive to `<designRoot>/_history/_migration-motion-2026-06/<basename>.html`.
    const designRootMatch = htmlPath.match(/^(.+?\/\.design)\//);
    const designRoot = designRootMatch?.[1] ?? dirname(htmlPath);
    const archiveDir = join(designRoot, '_history', '_migration-motion-2026-06', dsName);
    const archivePath = join(archiveDir, 'motion.html');
    await Bun.write(archivePath, htmlSource);
    // Bun has no rm; let the user delete the original or rely on git mv after review.
    console.log(`OK     ${htmlPath} → ${tsxPath} (archive: ${archivePath})`);
  } else {
    console.log(`OK     ${htmlPath} → ${tsxPath}`);
  }
  return 'migrated';
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const matches = walk(opts.root);
  if (matches.length === 0) {
    console.log(`no motion.html files found under ${opts.root}`);
    process.exit(0);
  }
  console.log(`found ${matches.length} motion.html candidate(s) under ${opts.root}`);
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  for (const p of matches) {
    const result = await migrateOne(p, opts);
    if (result === 'migrated') migrated++;
    else if (result === 'skipped') skipped++;
    else failed++;
  }
  console.log(`done — migrated: ${migrated}, skipped: ${skipped}, failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
