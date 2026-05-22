// Lazy IIFE bundling of ESM libraries that need to run inside `page.evaluate`.
//
// `dom-to-svg` and `dom-to-pptx` ship as Node ESM only — they can't be
// `<script>`-loaded into a browser context as-is. Bun.build turns them into
// single-file IIFE bundles cached under the OS temp dir so the playwright
// shims can `addScriptTag({ path })` without re-bundling per request.

import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface CachedBundle {
  path: string;
  ready: Promise<string>;
}

const bundles = new Map<string, CachedBundle>();

async function buildIife(entry: string, globalName: string, cachePath: string): Promise<string> {
  if (existsSync(cachePath)) return cachePath;
  // Bun.build doesn't expose IIFE directly — wrap a generated ESM bundle with
  // a tiny shim that exposes its exports as a window global.
  const built = await Bun.build({
    entrypoints: [entry],
    target: 'browser',
    format: 'esm',
    minify: true,
  });
  if (!built.success) {
    throw new Error(
      `bundle ${entry} failed: ${built.logs.map((l) => l.message).join('; ')}`
    );
  }
  const esm = await built.outputs[0]!.text();
  // ESM → IIFE wrapper: evaluate the module as a Function body, then attach
  // its exports to `window[globalName]`. We can't use top-level `import`
  // inside a Function, so we transform `export {` to assignments via regex
  // — the Bun-emitted bundle is consistent (`export { a as foo, b as bar };`).
  const exportsMatch = esm.match(/export\s*\{([^}]+)\}\s*;?\s*$/);
  let body = esm;
  let exportsBlock = '';
  if (exportsMatch) {
    body = esm.slice(0, exportsMatch.index);
    const entries = exportsMatch[1]!
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        // `localName as exportedName` | bare `name`
        const m = s.match(/^(.+?)\s+as\s+(.+)$/);
        if (m) return { local: m[1]!.trim(), exported: m[2]!.trim() };
        return { local: s, exported: s };
      });
    exportsBlock = entries
      .map((e) => `globalThis[${JSON.stringify(globalName)}][${JSON.stringify(e.exported)}] = ${e.local};`)
      .join('\n');
  }
  const iife = `(function(){
  globalThis[${JSON.stringify(globalName)}] = globalThis[${JSON.stringify(globalName)}] || {};
  ${body}
  ${exportsBlock}
})();`;
  await Bun.write(cachePath, iife);
  return cachePath;
}

/**
 * Returns the path to an IIFE bundle for the given npm package, attaching its
 * exports under `window[globalName]`. Caches under the OS temp dir so a long-
 * running dev server pays the build cost once.
 */
export function getBrowserBundle(
  packageName: string,
  globalName: string
): Promise<string> {
  const key = `${packageName}::${globalName}`;
  const existing = bundles.get(key);
  if (existing) return existing.ready;

  const entry = require.resolve(packageName);
  const cachePath = path.join(
    tmpdir(),
    `maude-${packageName.replace(/[^a-z0-9]/gi, '_')}-${globalName}.iife.js`
  );
  const ready = buildIife(entry, globalName, cachePath);
  bundles.set(key, { path: cachePath, ready });
  return ready;
}
