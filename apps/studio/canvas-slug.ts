// Canonical canvas slug derivation. Extracted from api.ts so canvas-artifacts.ts
// (a pure, dependency-free artifact-inventory module) and api.ts can both depend
// on it without a cycle between the two. api.ts re-exports this for existing
// external callers (canvas-list-watch.ts, tests) so their import surface is
// unchanged.

/**
 * Canonical canvas slug from a (repo- or design-root-relative) canvas path.
 * Pure — the `fileSlug` closure inside `createApi` delegates here, and the
 * external-canvas watcher (`canvas-list-watch.ts`) imports it so both creation
 * paths derive identical `canvas-list-update` slugs. Strips an optional
 * `<designRel>/` prefix, then `/`→`-`, whitespace→`_`, drops the `.tsx`/`.html`
 * extension, and lowercases.
 */
export function canvasSlugFromRel(file: string, designRel: string): string {
  let p = String(file).replace(/^\/+|\/+$/g, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* ignore */
  }
  const prefix = `${designRel.replace(/^\/+|\/+$/g, '')}/`;
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}
