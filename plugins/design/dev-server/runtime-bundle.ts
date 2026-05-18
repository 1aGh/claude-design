// React 19 runtime bundle — single bundled copy of React + ReactDOM + JSX
// runtime served at `/_canvas-runtime/<pkg>.js`. Every TSX canvas resolves its
// `import "react"` / `import "react/jsx-dev-runtime"` etc. through an importmap
// that points at these URLs, so a multi-canvas session never re-downloads the
// runtime. DDR-019, Phase 3.6 Task 6.
//
// Design:
//   - One Bun.build per logical sub-path. We split into four entries
//     ('react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime')
//     rather than one mega-bundle so the browser cache key per import is stable
//     across React minor version changes (each bundle is re-keyed by content
//     hash; an unaffected sub-path keeps its cache entry).
//   - Lazy: first GET against /_canvas-runtime/<name>.js builds the bundle
//     in-process. Subsequent GETs hit the cache. The build is cheap (~150 ms
//     cold for React + ReactDOM combined) but enough that we don't want to pay
//     it for every page nav.
//   - Etag-aware: returns the bundle's content hash so the browser can 304.
//   - In dev we externalise *nothing* — the four bundles together are
//     self-contained. The importmap wires them together at runtime.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const RUNTIME_PACKAGES = [
  'react',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
] as const;

export type RuntimePackage = (typeof RUNTIME_PACKAGES)[number];

/**
 * Discover the public export keys of a package at build time. React + ReactDOM
 * ship CJS in npm; `export * from "..."` against a CJS module produces empty
 * ESM bindings (the spec only allows `export *` to re-export static bindings,
 * and CJS has none). We work around this by dynamically `import()`ing the
 * package in the host Bun process, enumerating `Object.keys`, and emitting an
 * explicit named-re-export list. Robust to React version bumps (every new
 * named export — public or `__INTERNAL_*` — gets carried automatically).
 *
 * React 19's `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`
 * is the canonical bridge ReactDOM uses to read React's shared internal state;
 * if we drop it the runtime fails with "Cannot read properties of undefined
 * (reading 'S')" on first ReactDOM.createRoot() call. Auto-discovery is the
 * only sustainable answer.
 */
const namedExportsCache = new Map<RuntimePackage, readonly string[]>();
async function namedExportsFor(pkg: RuntimePackage): Promise<readonly string[]> {
  const hit = namedExportsCache.get(pkg);
  if (hit) return hit;
  const mod = (await import(pkg)) as Record<string, unknown>;
  // `default` is auto-emitted from our synthetic entry separately; skip here.
  const keys = Object.keys(mod).filter((k) => k !== 'default').sort();
  namedExportsCache.set(pkg, keys);
  return keys;
}

/**
 * URL slug used in `/_canvas-runtime/<slug>.js`. Maps package specifier to a
 * filename-safe form. Inverse of {@link packageForSlug}.
 */
export function slugFor(pkg: RuntimePackage): string {
  return pkg.replace(/\//g, '_');
}

export function packageForSlug(slug: string): RuntimePackage | null {
  const want = slug.replace(/\.js$/, '');
  for (const p of RUNTIME_PACKAGES) {
    if (slugFor(p) === want) return p;
  }
  return null;
}

interface BundleCacheEntry {
  js: string;
  etag: string;
}

const cache = new Map<RuntimePackage, BundleCacheEntry>();

/**
 * Build (or fetch from cache) a single runtime sub-bundle. Self-contained:
 * each entry includes everything it needs; the four bundles only share state
 * at the browser level (via React's module-singleton convention — multiple
 * imports of "react" resolve to the same module thanks to the importmap).
 */
export async function getRuntimeBundle(pkg: RuntimePackage): Promise<BundleCacheEntry> {
  const hit = cache.get(pkg);
  if (hit) return hit;

  // A throwaway entrypoint that re-exports every member of the target package.
  // We use named re-exports (default + an enumerated namespace) so the bundle
  // produces real ESM exports even when the source package is CJS (React +
  // ReactDOM are CJS in their npm distribution; `export * from` against a CJS
  // module gives static analyzers nothing to bind, so Bun.build silently emits
  // an empty export shape — manual destructure works around that).
  // Synthetic entrypoint anchored inside the dev-server dir so Bun.build's
  // default resolver walks UP from HERE and finds dev-server/node_modules/react
  // (regardless of where the process happens to be launched from).
  const entryName = `${HERE}/.runtime-bundle-${slugFor(pkg)}-entry.tsx`;
  const exportNames = await namedExportsFor(pkg);
  const namedLines = exportNames.map((n) => `  ${n}`).join(',\n');
  // The `as any` cast tolerates names like `__INTERNAL_DO_NOT_USE_OR_WARN`
  // that aren't declared in the package's .d.ts; the destructure still
  // succeeds at runtime, which is what matters.
  const entryContent =
    `import * as __mod__ from ${JSON.stringify(pkg)};\n` +
    (exportNames.length > 0
      ? `const {\n${namedLines}\n} = __mod__ as any;\n` + `export {\n${namedLines}\n};\n`
      : '') +
    `export default __mod__;\n`;

  // Externalise the OTHER three runtime packages so they don't get bundled
  // multiple times into this one. The importmap re-stitches at runtime — the
  // browser resolves every reference to a single module URL per package, so
  // React's module-singleton invariant is preserved (no Invalid-Hook-Call).
  //
  // Bun's `external` field is package-name prefixed — listing "react" also
  // marks "react/jsx-runtime" external, which would defeat the per-subpath
  // bundles. We instead pin externals via a `onResolve` plugin so each
  // specifier is matched literally (exact-string compare). Any specifier NOT
  // in `externalSpecifiers` falls through to the default node_modules resolver
  // and gets inlined.
  const externalSpecifiers = new Set<string>(
    RUNTIME_PACKAGES.filter((p) => p !== pkg).flatMap((p) => [p, ...subPathExternals(p)])
  );

  const built = await Bun.build({
    entrypoints: [entryName],
    target: 'browser',
    format: 'esm',
    minify: false,
    splitting: false,
    define: {
      // Force React's production module (smaller, no dev-only `let React`
      // reassignment that triggers Bun.build's bundler-rename collision with
      // the `import * as React from "react"` namespace binding). The dev
      // variant has extra console-error scaffolding that's not worth the
      // bundler edge-case it forces us through.
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [
      {
        name: 'synthetic-entry',
        setup(builder) {
          // Resolve the synthetic entrypoint to itself.
          builder.onResolve({ filter: new RegExp(`^${escapeRegex(entryName)}$`) }, (args) => ({
            path: args.path,
            namespace: 'synth',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'synth' }, () => ({
            contents: entryContent,
            loader: 'tsx',
          }));
        },
      },
      {
        name: 'exact-externals',
        setup(builder) {
          // Match every bare specifier — JS, JSX, TS, TSX, "react", "react-dom",
          // sub-paths, file-relative imports. We use a broad `filter` and
          // decide externalisation in the callback so we don't need to escape
          // every sub-path into the regex.
          builder.onResolve({ filter: /.*/ }, (args) => {
            if (externalSpecifiers.has(args.path)) {
              return { path: args.path, external: true };
            }
            return null;
          });
        },
      },
    ],
  });

  if (!built.success) {
    const msg = built.logs
      .map((l) => {
        const lvl = (l as { level?: string }).level ?? 'error';
        return `[${lvl}] ${l.message}`;
      })
      .join('\n');
    throw new Error(`Failed to build runtime bundle for "${pkg}":\n${msg || '(no log messages)'}`);
  }

  const out = built.outputs[0];
  if (!out) throw new Error(`Bun.build produced no output for runtime bundle "${pkg}"`);
  const js = await out.text();
  const etag = Bun.hash(js).toString(16);
  const entry = { js, etag };
  cache.set(pkg, entry);
  return entry;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Additional specifiers that resolve to the same package (e.g. `react-dom` is
 * served via the `react-dom/client` bundle but downstream imports might use
 * `react-dom` bare). Listed alongside the canonical specifier in the externals
 * list so internal imports of these sibling paths don't drag the runtime back
 * into the bundle.
 */
function subPathExternals(pkg: RuntimePackage): string[] {
  if (pkg === 'react-dom/client') return ['react-dom'];
  return [];
}

/**
 * Pre-warm every sub-bundle. Called eagerly at server boot when the
 * MDCC_PREWARM_RUNTIME env var is set; otherwise bundles build on first GET.
 * The warm-up adds ~200 ms to startup; default off because the dev-server's
 * own cold-start is already the longest tail.
 */
export async function prewarmRuntimeBundles(): Promise<void> {
  await Promise.all(RUNTIME_PACKAGES.map(getRuntimeBundle));
}
