// The sandbox host — Cloud Phase 25 A1 + A1b.
//
// Owns everything ABOUT a canvas build that must not live inside it: the
// ceilings, the empty environment, the content-hash cache, and the counters
// Cloud Phase 26 Stage 4 will read. The build itself is `build-worker.ts`,
// running under the bundled Bun in its own process.
//
// THE CACHE IS AN ECONOMIC CONTROL, NOT AN OPTIMISATION (A1b). Rebuilding per
// page view makes cost scale with VIEWS; keying the built module by the hash
// of its inputs makes it scale with EDITS. That is the difference between a
// €19 plan that works and one that does not, which is why the counters below
// exist from day one rather than being retrofitted after the first invoice.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Wall clock a single canvas build may take. */
export const BUILD_TIMEOUT_MS = Number(process.env.MAUDE_CANVAS_BUILD_TIMEOUT_MS ?? 20_000);
/** Resident memory a build process may reach before it is killed. */
export const BUILD_RSS_LIMIT_MB = Number(process.env.MAUDE_CANVAS_BUILD_RSS_MB ?? 768);
/** How many built modules to keep. Each is a string; canvases are ~100–400 kB. */
export const CACHE_MAX_ENTRIES = Number(process.env.MAUDE_CANVAS_CACHE_ENTRIES ?? 64);

const counters = {
  builds: 0,
  cacheHits: 0,
  cacheMisses: 0,
  failures: 0,
  timeouts: 0,
  memoryKills: 0,
  /** Every completed build's wall-clock, newest last, capped. */
  durationsMs: [],
};

/** A snapshot for the operator surface + Phase 26 Stage 4. */
export function buildStats() {
  const d = [...counters.durationsMs].sort((a, b) => a - b);
  const p = (q) => (d.length === 0 ? null : d[Math.min(d.length - 1, Math.floor(d.length * q))]);
  const total = counters.cacheHits + counters.cacheMisses;
  return {
    builds: counters.builds,
    cacheHits: counters.cacheHits,
    cacheMisses: counters.cacheMisses,
    cacheHitRatio: total === 0 ? null : Number((counters.cacheHits / total).toFixed(3)),
    failures: counters.failures,
    timeouts: counters.timeouts,
    memoryKills: counters.memoryKills,
    p50Ms: p(0.5),
    p95Ms: p(0.95),
  };
}

/** Test seam. */
export function _resetBuildStats() {
  counters.builds = 0;
  counters.cacheHits = 0;
  counters.cacheMisses = 0;
  counters.failures = 0;
  counters.timeouts = 0;
  counters.memoryKills = 0;
  counters.durationsMs = [];
  cache.clear();
}

/** key → { js, locator, etag } */
const cache = new Map();

/**
 * The cache key: the canvas source plus every sibling source it could pull in.
 *
 * Hashing only the entry file would serve a stale bundle after an edit to an
 * imported component — the exact bug the desktop's mtime-keyed cache had to
 * grow a watcher for. Here the inputs are cheap to enumerate (the design root
 * is small and local), so the key is honest by construction.
 */
export function cacheKeyFor(designRoot, canvasAbs) {
  const h = createHash('sha256');
  h.update(canvasAbs);
  for (const file of relevantSources(designRoot, canvasAbs)) {
    try {
      const st = statSync(file);
      h.update(`\0${file}\0${st.size}\0${st.mtimeMs}`);
    } catch {
      h.update(`\0${file}\0missing`);
    }
  }
  return h.digest('hex');
}

/**
 * Files whose content can change a canvas's bundle: the canvas itself, and
 * every `.tsx`/`.ts`/`.css` file it can reach by relative import inside the
 * design root (transitively). The allowlist guarantees nothing outside can be
 * reached, so nothing outside can invalidate.
 */
function relevantSources(designRoot, canvasAbs, seen = new Set()) {
  const root = resolve(designRoot);
  const stack = [resolve(canvasAbs)];
  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    if (file !== root && !file.startsWith(root + sep)) continue;
    seen.add(file);
    let src = '';
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of src.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
      for (const candidate of resolveCandidates(dirname(file), m[1])) stack.push(candidate);
    }
  }
  return [...seen].sort();
}

function resolveCandidates(fromDir, spec) {
  const base = resolve(fromDir, spec);
  return [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
}

function remember(key, value) {
  cache.set(key, value);
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

/**
 * Resolve the runtime that runs the worker.
 *
 * In the cell image this is the Bun binary staged next to the bundle; in a
 * dev checkout it is whatever `bun` is on PATH. A missing runtime is a
 * configuration error the caller must surface — never a silent fallback to
 * "no rendering", which would look to a member exactly like an empty project.
 */
export function resolveBunPath(env = process.env) {
  return env.MAUDE_BUN_PATH || 'bun';
}

/**
 * Find a worker script across the two layouts it lives in.
 *
 * A dev checkout runs it out of `src/canvas/`; the cell image runs it out of
 * wherever the Dockerfile staged it next to the bundle. Bun reads TypeScript
 * natively, so there is nothing to compile in either case — which is why the
 * worker is shipped as SOURCE rather than being bundled into the hub (bundling
 * it would inline the whole studio engine into a Node bundle that cannot run
 * it).
 */
export function workerScript(name, env = process.env) {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    env.MAUDE_CANVAS_WORKERS ? join(env.MAUDE_CANVAS_WORKERS, name) : null,
    join(here, name),
    join(here, 'canvas', name),
    join(process.cwd(), 'src', 'canvas', name),
    join(process.cwd(), 'dist', 'canvas', name),
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[candidates.length - 1];
}

/**
 * The child's environment: a PATH to exec with, a HOME for Bun's cache, and
 * the two PATHS that tell it where our own code lives. Nothing else — every
 * secret in a cell is an env var, and a build that cannot read them cannot
 * leak them, whatever a tenant's source manages to import.
 */
export function workerEnv(env = process.env) {
  return {
    PATH: env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: env.HOME ?? '/tmp',
    ...(env.MAUDE_STUDIO_SRC ? { MAUDE_STUDIO_SRC: env.MAUDE_STUDIO_SRC } : {}),
    ...(env.NAPI_RS_NATIVE_LIBRARY_PATH
      ? { NAPI_RS_NATIVE_LIBRARY_PATH: env.NAPI_RS_NATIVE_LIBRARY_PATH }
      : {}),
  };
}

/**
 * Build one canvas, sandboxed.
 *
 * @returns {Promise<{ok: true, js: string, locator: object, etag: string, cached: boolean}
 *                  | {ok: false, error: string, kind: 'build'|'timeout'|'memory'|'runtime'}>}
 */
export async function buildCanvas({ designRoot, canvasAbs, env = process.env } = {}) {
  const key = cacheKeyFor(designRoot, canvasAbs);
  const hit = cache.get(key);
  if (hit) {
    counters.cacheHits++;
    return { ...hit, ok: true, cached: true };
  }
  counters.cacheMisses++;

  const started = Date.now();
  const result = await runWorker({ designRoot, canvasAbs, env });
  const elapsed = Date.now() - started;
  counters.durationsMs.push(elapsed);
  if (counters.durationsMs.length > 200) counters.durationsMs.shift();

  if (result.ok) {
    counters.builds++;
    const value = { js: result.js, locator: result.locator, etag: result.etag };
    remember(key, value);
    return { ...value, ok: true, cached: false };
  }
  counters.failures++;
  if (result.kind === 'timeout') counters.timeouts++;
  if (result.kind === 'memory') counters.memoryKills++;
  return result;
}

function runWorker({ designRoot, canvasAbs, env }) {
  return new Promise((resolveP) => {
    const bun = resolveBunPath(env);
    let child;
    try {
      child = spawn(bun, [workerScript('build-worker.ts', env), designRoot, canvasAbs], {
        // THE EMPTY ENVIRONMENT IS THE POINT — see workerEnv().
        env: workerEnv(env),
        cwd: designRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolveP({ ok: false, kind: 'runtime', error: `could not start the build: ${err.message}` });
      return;
    }

    let out = '';
    let errOut = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      clearInterval(rssPoll);
      resolveP(value);
    };

    const deadline = setTimeout(() => {
      child.kill('SIGKILL');
      finish({
        ok: false,
        kind: 'timeout',
        error: `this canvas took longer than ${Math.round(BUILD_TIMEOUT_MS / 1000)}s to build and was stopped.`,
      });
    }, BUILD_TIMEOUT_MS);

    // RSS ceiling. A hard `ulimit -v` is the obvious alternative and does not
    // work: JS runtimes reserve enormous virtual address space and would die
    // at boot. Polling resident size is honest about what is actually being
    // consumed on our bill.
    const rssPoll = setInterval(() => {
      const mb = rssMb(child.pid);
      if (mb !== null && mb > BUILD_RSS_LIMIT_MB) {
        child.kill('SIGKILL');
        finish({
          ok: false,
          kind: 'memory',
          error: `this canvas needed more than ${BUILD_RSS_LIMIT_MB} MB to build and was stopped.`,
        });
      }
    }, 500);
    rssPoll.unref?.();

    child.stdout.on('data', (c) => {
      out += c;
    });
    child.stderr.on('data', (c) => {
      errOut += String(c).slice(0, 2000);
    });
    child.on('error', (err) =>
      finish({ ok: false, kind: 'runtime', error: `could not start the build: ${err.message}` })
    );
    child.on('close', () => {
      if (settled) return;
      try {
        const parsed = JSON.parse(out);
        finish(
          parsed.ok ? { ok: true, ...parsed } : { ok: false, kind: 'build', error: parsed.error }
        );
      } catch {
        finish({
          ok: false,
          kind: 'runtime',
          error: `the build produced no result${errOut ? `: ${errOut.trim().slice(0, 500)}` : ''}`,
        });
      }
    });
  });
}

/** Resident set size of a pid in MB, or null when it cannot be read. */
function rssMb(pid) {
  if (!pid) return null;
  try {
    // Linux (the cell). /proc/<pid>/statm reports pages; page size is 4 KiB.
    const statm = readFileSync(`/proc/${pid}/statm`, 'utf8').split(' ');
    return (Number(statm[1]) * 4096) / (1024 * 1024);
  } catch {
    return null; // macOS dev boxes: the wall-clock ceiling still applies
  }
}
