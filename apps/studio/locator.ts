// LocatorMap reader/writer for <designRoot>/_locator.json (DDR-019, Phase 3.6 Task 2).
//
// _locator.json is a multi-canvas map keyed by canvas slug. Each canvas's value
// is its LocatorMap (data-cd-id -> source location). The same file holds the
// state for every canvas under the design root, so concurrent transpiles
// against different canvases share the file but must not corrupt each other.
//
// Concurrency strategy: per-path Promise-chained mutex. Each write to a given
// _locator.json serialises behind the previous write on the same path. Cheap
// (no OS-level locking) and sufficient because the dev-server is the only
// writer.
//
// On-disk shape:
//   {
//     "ui/Docs Site": {
//       "a1b2c3d4": { canvas, line, col, jsxPath, componentName },
//       ...
//     },
//     "ui/Canvas Viewport": { ... }
//   }
// Top-level keys are POSIX-style canvas slugs relative to designRoot, ext-less.

import path from 'node:path';

export interface LocatorEntry {
  /** Absolute path of the canvas .tsx file the ID belongs to. */
  canvas: string;
  /** 1-based line number of the JSXElement's opening tag. */
  line: number;
  /** 0-based column number of the JSXElement's opening tag. */
  col: number;
  /** Breadcrumb of JSX element-type names from component root down. */
  jsxPath: string[];
  /** Enclosing component name (PascalCase fn/arrow), "" if outside any component. */
  componentName: string;
}

export type LocatorMap = Record<string, LocatorEntry>;
export type LocatorFile = Record<string, LocatorMap>;

/**
 * Canvas slug used as the top-level key in _locator.json. Posix-style,
 * extension-less, relative to designRoot. Matches the slug shape that
 * bin/slug.sh produces for `_history/<slug>/`.
 */
export function canvasSlug(canvasAbsPath: string, designRoot: string): string {
  const rel = path.posix.normalize(
    path.relative(designRoot, canvasAbsPath).split(path.sep).join('/')
  );
  // strip extension
  const dot = rel.lastIndexOf('.');
  return dot > 0 ? rel.slice(0, dot) : rel;
}

// ---------------------------------------------------------------------------
// Per-path mutex. Promise chain — each acquire waits on the previous release.

const locks = new Map<string, Promise<void>>();
function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(filePath) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  const next = prev.then(() => gate);
  locks.set(filePath, next);
  return prev.then(fn).finally(() => {
    release();
    // Only the last queued acquire clears the map entry; intermediate ones
    // leave it pointing at the still-pending tail.
    if (locks.get(filePath) === next) locks.delete(filePath);
  });
}

// ---------------------------------------------------------------------------
// Reader

export async function readLocatorFile(locatorAbsPath: string): Promise<LocatorFile> {
  const f = Bun.file(locatorAbsPath);
  if (!(await f.exists())) return {};
  try {
    const raw = await f.text();
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LocatorFile;
    }
    return {};
  } catch {
    // Corrupt / mid-write — treat as empty rather than throw. The next write
    // overwrites cleanly.
    return {};
  }
}

export async function readLocator(
  locatorAbsPath: string,
  slug: string
): Promise<LocatorMap | null> {
  const file = await readLocatorFile(locatorAbsPath);
  return file[slug] ?? null;
}

// ---------------------------------------------------------------------------
// Writer — atomic per-canvas update. Writes to "<file>.tmp.<rand>", then
// renames over the original. Per-path mutex prevents concurrent writers from
// trampling each other's slug entries.

export function writeLocator(locatorAbsPath: string, slug: string, map: LocatorMap): Promise<void> {
  return withLock(locatorAbsPath, async () => {
    const current = await readLocatorFile(locatorAbsPath);
    const next: LocatorFile = { ...current, [slug]: map };
    const json = stableStringify(next);
    const tmp = `${locatorAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, json);
    // Bun has no direct rename — use node:fs/promises. fsync of the dir is
    // overkill for a dev-tool sidecar; the rename is atomic on POSIX which is
    // all we ship to.
    const { rename } = await import('node:fs/promises');
    await rename(tmp, locatorAbsPath);
  });
}

/**
 * Drop a canvas's slug from the locator file (e.g. on canvas deletion).
 * No-op if the slug isn't present.
 */
export function clearLocatorSlug(locatorAbsPath: string, slug: string): Promise<void> {
  return withLock(locatorAbsPath, async () => {
    const current = await readLocatorFile(locatorAbsPath);
    if (!(slug in current)) return;
    delete current[slug];
    const json = stableStringify(current);
    const tmp = `${locatorAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, json);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, locatorAbsPath);
  });
}

// ---------------------------------------------------------------------------
// Deterministic JSON — sorted keys at every level, 2-space indent, trailing
// newline. Makes git diffs of _locator.json reviewable (and stable across
// re-transpiles when source hasn't changed). The replacer sorts; callers do
// not need to pre-sort.

function stableStringify(obj: LocatorFile): string {
  return `${JSON.stringify(obj, sortedSlugKeysReplacer, 2)}\n`;
}

// biome-ignore lint/suspicious/noExplicitAny: JSON.stringify replacer signature
function sortedSlugKeysReplacer(_key: string, value: any): any {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value).sort()) sorted[k] = value[k];
    return sorted;
  }
  return value;
}
