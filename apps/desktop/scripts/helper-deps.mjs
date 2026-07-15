// helper-deps.mjs — the single source of truth for "which npm packages does each
// standalone `maude design <verb>` helper actually import". Shared by BOTH
// `stage-resources.mjs` (to STAGE those closures into the bundle) and
// `check-bundle-completeness.mjs` (to ASSERT they're staged). Data-driven from
// the helpers' real import graph — so a NEW helper that adds a new dependency is
// staged automatically AND verified, closing the "vždy dělat build i
// dependencies" gap without a hand-maintained list to forget (RCA G4/G7).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Classify each `maude design` helper by reading its `.sh`:
 *   • routed     — curls the local dev-server `/_api/<verb>` (deps ride the
 *                  compiled server's embedded closure; nothing to stage);
 *   • standalone — `exec bun run _<verb>.mjs` (needs its npm closure on disk);
 *   • other      — neither (pure jq/curl-free shell).
 */
export function classifyHelpers(binDir) {
  if (!existsSync(binDir)) return [];
  const out = [];
  for (const f of readdirSync(binDir)) {
    if (!f.endsWith('.sh') || f.startsWith('_')) continue;
    const verb = f.slice(0, -3);
    const src = readFileSync(join(binDir, f), 'utf8');
    const routed = /_api\//.test(src) && !/\bexec\s+bun\s+run\b/.test(src);
    const bunEntry = src.match(/bun\s+run\s+"?\$SCRIPT_DIR\/(_[\w-]+\.mjs)/);
    out.push({
      verb,
      sh: f,
      track: routed ? 'routed' : bunEntry ? 'standalone' : 'other',
      entry: bunEntry ? bunEntry[1] : null,
      needsBun: /command -v bun/.test(src) || /\bexec\s+bun\s+run\b/.test(src),
    });
  }
  return out;
}

// Match import/export…from, bare import, and static/dynamic require/import().
const SPEC_RE =
  /(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveLocal(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  const cands = [
    base,
    `${base}.ts`,
    `${base}.mjs`,
    `${base}.js`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.mjs'),
    join(base, 'index.js'),
  ];
  return cands.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function pkgName(spec) {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0];
}

/**
 * Walk the module graph from an entry `_*.mjs`, following relative (`./`/`../`)
 * imports through the source (.ts/.mjs/.js/.tsx), and return every BARE npm
 * package specifier it (transitively, through local files) imports. Cycle-guarded.
 */
export function collectImports(entryFile) {
  const bare = new Set();
  const seen = new Set();
  const stack = [entryFile];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(SPEC_RE)) {
      const spec = (m[1] || m[2] || m[3] || '').trim();
      // A real module specifier has no whitespace/comma — the greedy `from`
      // alternative can otherwise span statements and capture junk.
      if (!spec || /[\s,]/.test(spec) || spec.startsWith('node:') || spec.startsWith('bun:')) continue;
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const local = resolveLocal(file, spec);
        if (local) stack.push(local);
        continue;
      }
      bare.add(pkgName(spec));
    }
  }
  return [...bare].sort();
}

/**
 * The union of every STANDALONE helper's npm import closure (package names).
 * `binDir` = `<studio>/bin`. This is exactly what `stage-resources.mjs` must
 * stage so the `bun run` helpers resolve their imports in the packaged app.
 */
export function standaloneHelperNpmDeps(binDir) {
  const deps = new Set();
  for (const h of classifyHelpers(binDir)) {
    if (h.track !== 'standalone' || !h.entry) continue;
    const entryFile = join(binDir, h.entry);
    for (const d of collectImports(entryFile)) deps.add(d);
  }
  return [...deps].sort();
}
