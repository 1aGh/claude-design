// Phase 6.5 T1 — scope resolver.
//
// Pure function: takes the current `_active.json` state + a user-chosen
// scope, returns a flat `Target[]`. The downstream adapter (PNG / PDF / …)
// owns rendering each Target; the resolver is render-agnostic.
//
// Why a single function instead of one-per-scope: the four scopes share an
// `activeJson` precondition and a designRoot walk for `project-raw`. Keeping
// them inline makes the fallback chain (`selection` → `artboard` when no
// selection captured) explicit.

import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** The four user-facing scope choices from the export dialog. */
export type Scope = 'selection' | 'artboard' | 'canvas-as-separate' | 'project-raw';

/**
 * What an adapter receives for each render unit. `element` targets carry a
 * CSS selector + canvas reference (resolved at render time via Playwright);
 * `file-tree` targets carry a flat list of repo-relative paths (consumed by
 * the zip adapter only — other adapters reject).
 */
export type Target =
  | {
      kind: 'element';
      /** CSS selector. Multi-match selectors (e.g. `[data-dc-screen]`) are valid; see `multi`. */
      cssPath: string;
      /** Slug derived from the canvas file path — POSIX, ext-less, relative to designRoot. */
      canvasSlug: string;
      /** Repo-relative canvas file path. */
      file: string;
      /** True when `cssPath` is expected to match many elements; the adapter iterates. */
      multi?: boolean;
    }
  | {
      kind: 'file-tree';
      /** Repo-relative file paths to bundle. Always non-empty. */
      paths: string[];
    };

/** Subset of `_active.json` the resolver consumes. */
export interface ActiveJsonShape {
  active: string | null;
  selected:
    | { file?: string; selector?: string; cssPath?: string }
    | Array<{ file?: string; selector?: string; cssPath?: string }>
    | null;
}

export interface ResolveScopeArgs {
  scope: Scope;
  activeJson: ActiveJsonShape;
  /** Absolute path to the design root (e.g. `/abs/.design`). */
  designRoot: string;
  /** Absolute path to repo root. Required for `project-raw` to bound the walk. */
  repoRoot?: string;
}

const RAW_EXCLUDES = new Set([
  '_server.json',
  '_active.json',
  '_export-history.json',
  '_history',
  '_comments',
  '_canvas-state',
  'node_modules',
  'dist',
  '.DS_Store',
]);

/**
 * Derive a canvas slug from a repo-relative or designRoot-relative file path.
 * Mirrors `api.ts:fileSlug` semantics but stays inline to avoid a circular
 * import (api.ts will eventually call into exporters from `commentsAdd`-style
 * factories).
 */
function slugify(file: string, designRel: string): string {
  let p = String(file).replace(/^\/+|\/+$/g, '');
  const prefix = `${designRel.replace(/^\/+|\/+$/g, '')}/`;
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

interface SelectionShape {
  file?: string;
  selector?: string;
  cssPath?: string;
}

function firstSelection(selected: ActiveJsonShape['selected']): SelectionShape | null {
  if (!selected) return null;
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}

async function walkProjectRaw(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(absDir: string, relDir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (RAW_EXCLUDES.has(e.name)) continue;
      if (e.name.endsWith('.log')) continue;
      const abs = path.join(absDir, e.name);
      const rel = relDir ? path.posix.join(relDir, e.name) : e.name;
      if (e.isDirectory()) {
        await walk(abs, rel);
      } else if (e.isFile()) {
        out.push(rel);
      }
    }
  }
  await walk(root, '');
  return out;
}

/**
 * Resolve a scope choice into a Target[]. Pure beyond filesystem walks for
 * `project-raw`. Never throws — invalid input collapses to `[]` and the
 * adapter's "no targets" path emits an empty payload.
 */
export async function resolveScope(args: ResolveScopeArgs): Promise<Target[]> {
  const { scope, activeJson, designRoot } = args;
  const designRel = path.basename(designRoot);

  // `project-raw` is independent of `_active.json` — the user always exports
  // the whole tree regardless of what's selected.
  if (scope === 'project-raw') {
    const paths = await walkProjectRaw(designRoot);
    if (!paths.length) return [];
    return [{ kind: 'file-tree', paths }];
  }

  const activeFile = activeJson.active;
  if (!activeFile) return [];
  const slug = slugify(activeFile, designRel);
  const sel = firstSelection(activeJson.selected);

  if (scope === 'selection') {
    const selector = sel?.selector ?? sel?.cssPath;
    if (!sel || !selector) {
      // Plan: "Falls back to artboard if no selection." Recurse with the
      // artboard scope so the fallback semantics live in one place.
      return resolveScope({ ...args, scope: 'artboard' });
    }
    const file = sel.file ?? activeFile;
    return [
      {
        kind: 'element',
        cssPath: selector,
        canvasSlug: slugify(file, designRel),
        file,
      },
    ];
  }

  if (scope === 'artboard') {
    // The adapter handles "closest [data-dc-screen] ancestor" at render time
    // via Playwright. Server-side we only know the selection's selector — we
    // pass it through with a marker and the adapter widens to the artboard.
    // If no selection, fall back to "first artboard on the active canvas".
    const baseSelector = sel?.selector ?? sel?.cssPath ?? '[data-dc-screen]:first-of-type';
    return [
      {
        kind: 'element',
        cssPath: baseSelector,
        canvasSlug: slug,
        file: activeFile,
      },
    ];
  }

  // canvas-as-separate — every [data-dc-screen] on the active canvas.
  // Adapter expands `multi: true` into N renders in document order.
  return [
    {
      kind: 'element',
      cssPath: '[data-dc-screen]',
      canvasSlug: slug,
      file: activeFile,
      multi: true,
    },
  ];
}
