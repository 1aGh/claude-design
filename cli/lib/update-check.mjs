// Update-availability notifier for the `maude` CLI.
//
// Design (intentional, see PR discussion):
//   • Hot path reads ONLY the local cache. Never blocks on a network fetch.
//   • A detached child process refreshes the cache when stale (>24h). The
//     notice for a freshly published version therefore appears on the run
//     AFTER the cache rolls — same pattern as `update-notifier`.
//   • Opt-out via MAUDE_NO_UPDATE_CHECK=1, NO_UPDATE_NOTIFIER=1, CI=true,
//     or any non-TTY stderr (pipes, CI logs, etc.).
//   • Best-effort everywhere: cache read/write, registry fetch, and spawn
//     all swallow errors. The CLI must never fail because of this module.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isCompiledBinary } from './pkg-root.mjs';

const PKG_NAME = '@1agh/maude';
const REGISTRY_URL = `https://registry.npmjs.org/${PKG_NAME}/latest`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;

function cachePath() {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(base, 'maude', 'update-check.json');
}

function shouldSkip() {
  if (process.env.MAUDE_NO_UPDATE_CHECK) return true;
  if (process.env.NO_UPDATE_NOTIFIER) return true;
  if (process.env.CI) return true;
  if (!process.stderr.isTTY) return true;
  // DDR-166 T0b — a Tauri-bundled `maude` binary updates via the app's own
  // auto-updater (DDR-126), not `npm i -g @1agh/maude@latest`; the notice
  // would be actively wrong advice. Also sidesteps spawnDetachedRefresh()'s
  // self-respawn, which re-invokes `import.meta.url` as a script path — a
  // real file:// path in dev/node, but Bun's virtual `/$bunfs/root` inside
  // this exact compiled binary (DDR-045-class trap).
  if (isCompiledBinary()) return true;
  return false;
}

// Compare semver x.y.z (ignoring prerelease/build metadata). Returns
// positive if a > b, negative if a < b, 0 if equal.
export function cmpSemver(a, b) {
  const parse = (v) =>
    String(v)
      .split(/[-+]/)[0]
      .split('.')
      .map((n) => Number(n) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function readCacheSync() {
  try {
    const raw = readFileSync(cachePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latest === 'string' && typeof parsed?.checkedAt === 'number') {
      return parsed;
    }
  } catch {
    /* missing or corrupt — treat as no cache */
  }
  return null;
}

function writeCacheSync(data) {
  const path = cachePath();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(data), 'utf8');
  } catch {
    /* read-only fs / no permission — non-fatal */
  }
}

function printNotice(current, latest) {
  const msg = [
    '',
    `  ⚠ maude update available: ${current} → ${latest}`,
    `    Run: npm i -g ${PKG_NAME}@latest   (or pnpm add -g / bun add -g)`,
    '',
    '',
  ].join('\n');
  process.stderr.write(msg);
}

function spawnDetachedRefresh() {
  try {
    const self = fileURLToPath(import.meta.url);
    const child = spawn(process.execPath, [self, '--refresh'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, MAUDE_UPDATE_CHECK_CHILD: '1' },
    });
    child.unref();
  } catch {
    /* spawn failed — skip the refresh, will retry next run */
  }
}

async function refreshCache() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(REGISTRY_URL, {
      headers: { accept: 'application/json' },
      signal: ac.signal,
    });
    if (!res.ok) return;
    const json = await res.json();
    if (typeof json?.version === 'string') {
      writeCacheSync({ latest: json.version, checkedAt: Date.now() });
    }
  } catch {
    /* offline, DNS failure, registry down — ignore */
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run the update check from the CLI entry. Synchronous-fast: reads cache,
 * prints notice if outdated, kicks off a detached refresh when the cache
 * is stale, returns immediately.
 */
export function runUpdateCheck(currentVersion) {
  if (shouldSkip()) return;
  if (!currentVersion) return;

  const cache = readCacheSync();
  if (cache?.latest && cmpSemver(cache.latest, currentVersion) > 0) {
    printNotice(currentVersion, cache.latest);
  }
  const isStale = !cache || Date.now() - cache.checkedAt > CACHE_TTL_MS;
  if (isStale) spawnDetachedRefresh();
}

// Entrypoint when invoked as a detached refresh child:
//   node cli/lib/update-check.mjs --refresh
if (process.argv[1]?.endsWith('update-check.mjs') && process.argv.includes('--refresh')) {
  refreshCache().catch(() => process.exit(0));
}
