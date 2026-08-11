// Desktop→cell asset push — DDR-217 + the 2026-08-11 addendum (fix 6 of the
// 2026-08-10 sync RCA, completed).
//
// The sync lanes are text-only (`html`/`css`/`meta`/`syncMeta`), so a
// desktop-linked project's binary assets never reached the cell — the grey
// boxes. The desktop is the one peer that HAS the bytes and already holds an
// authenticated channel to the hub, so it pushes them. There are TWO asset
// classes, served two different ways, so they push to two different routes:
//
//   1. TOP-LEVEL content-addressed uploads (`<designRoot>/assets/<sha8>.<ext>`)
//      — referenced by the `/assets/<key>` shortcut, served on the cloud from
//      the BUCKET proxy. Push → `PUT /assets/<key>` (bucket + checkout mirror).
//   2. DS / BRAND assets (`<designRoot>/system/<ds>/assets/logos/x.svg`, fonts,
//      photos) — referenced by their FULL designRoot path
//      (`/.design/system/<ds>/assets/…`) and served from the CHECKOUT by the
//      studio child, never the bucket. The original fix only swept class 1, so
//      these stayed grey (alligators has 93 of them). Push → `PUT
//      /_asset-file/<designRoot-rel>` (checkout only, no bucket).
//
// Both are HEAD-first (skip what the cloud already holds) and streamed. The
// HUB's validation is the authoritative gate at each trust boundary; the
// filters here are the courtesy layer that keeps junk off the wire.

import { type Dirent, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** One path segment charset — matches the hub's component regexes. */
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;

/** Max designRoot-relative depth (matches the hub's 8-segment cap). */
const MAX_SEGMENTS = 8;

/** Max relative-path length (matches the hub's 512 cap). */
const MAX_REL_LEN = 512;

/**
 * The binary asset extensions that actually render — images, fonts, media.
 * Deliberately NOT `.json`/`.meta.json`/`.photo.json`/`.tsx`/`.css`: a
 * `.photo.json` sidecar is edit metadata, not a served asset, and the checkout
 * route refuses non-asset extensions anyway (so pushing them would just waste
 * the wire and 400). Case-insensitive — a DS ships `…P1020428.JPG`.
 */
const ASSET_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'mp4',
  'webm',
  'mov',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'woff2',
  'woff',
  'ttf',
  'otf',
]);

/** A 2 GB file in an assets dir is a mistake — don't move it silently. */
const MAX_PUSH_BYTES = 512 * 1024 * 1024;

export interface AssetPushResult {
  pushed: string[];
  skipped: number;
  failed: { key: string; reason: string }[];
}

/**
 * feature-sync-progress-modal — incremental asset-push progress, emitted onto
 * the sync bus so the Sync panel can show assets moving instead of a silent
 * gap between "canvases synced" and a log line at the end. Keys are LOCAL
 * designRoot-relative paths (never hub-supplied); `failures` is capped at
 * MAX_LISTED_FAILURES with `failedCount` carrying the true number.
 */
export interface AssetPushProgress {
  /** Total pushable assets found this boot. */
  total: number;
  /** Files settled so far (pushed + skipped + failed). */
  done: number;
  pushed: number;
  skipped: number;
  failedCount: number;
  /** First MAX_LISTED_FAILURES failures — enough to name the broken paths. */
  failures: { key: string; reason: string }[];
  /** The designRoot-relative path on the wire right now, null when finished. */
  active: string | null;
  /** True exactly once, on the final emit (also fires when total is 0). */
  finished: boolean;
}

/** Cap on `failures` in a progress emit (same spirit as MAX_REJECTED_SLUGS —
 *  the payload reaches `_sync.json` + every open tab, so it stays bounded). */
export const MAX_LISTED_FAILURES = 20;

/** Min ms between mid-flight progress emits. A 90-file DS at LAN speed would
 *  otherwise broadcast 90 payloads in a couple of seconds; failures and the
 *  final emit always go out regardless. */
const PROGRESS_INTERVAL_MS = 200;

function extOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Every pushable binary asset under designRoot, as a designRoot-relative path.
 * Walks into any directory named `assets` at any level (top-level `assets/`,
 * `system/<ds>/assets/`, …) and collects the asset-extension files inside it.
 * Skips runtime-state (`_*`), `.git`, `node_modules`. Missing root → [].
 */
export function listPushableAssets(designRoot: string): string[] {
  const out: string[] = [];
  // Walk the tree; once inside an `assets` dir, collect asset files below it.
  const walk = (dir: string, rel: string, insideAssets: boolean): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith('_') || name === '.git' || name === 'node_modules') continue;
      if (!SEGMENT.test(name)) continue; // dotfiles + odd charset
      const childRel = rel ? `${rel}/${name}` : name;
      if (childRel.length > MAX_REL_LEN || childRel.split('/').length > MAX_SEGMENTS) continue;
      if (entry.isDirectory()) {
        walk(path.join(dir, name), childRel, insideAssets || name === 'assets');
      } else if (entry.isFile()) {
        if (!insideAssets) continue; // only files under some assets/ dir
        if (!ASSET_EXTS.has(extOf(name))) continue;
        try {
          if (statSync(path.join(dir, name)).size > MAX_PUSH_BYTES) continue;
        } catch {
          continue;
        }
        out.push(childRel);
      }
    }
  };
  walk(designRoot, '', false);
  return out.sort();
}

/** Where a given asset pushes: the bucket-backed route (top-level `assets/`) or
 *  the checkout route (a nested `…/assets/…` served from disk). */
function routeFor(rel: string): { url: string } {
  const parts = rel.split('/');
  if (parts[0] === 'assets') {
    // Top-level content-addressed → the bucket `/assets/<key>` route.
    return { url: `/assets/${parts.slice(1).join('/')}` };
  }
  // DS / brand asset served from the checkout → the checkout-file route, keyed
  // by its FULL designRoot-relative path.
  return { url: `/_asset-file/${rel.split('/').map(encodeURIComponent).join('/')}` };
}

/**
 * Mirror local assets up to the hub. Idempotent and skip-first (one HEAD per
 * asset per boot; upload only on a miss), sequential on purpose — assets run
 * to videos, and saturating the link a fresh sync is also using would starve
 * the handshakes this rides behind. Never throws; a failed upload is retried
 * for free on the next boot.
 */
export async function pushAssets(opts: {
  designRoot: string;
  hubUrl: string;
  /** Read at call time — silent renewal swaps the credential in place. */
  token: () => string;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'log' | 'warn'>;
  /** feature-sync-progress-modal — incremental progress (throttled; failures
   *  and the final emit always fire). Never throws into the push loop. */
  onProgress?: (progress: AssetPushProgress) => void;
  /** Injectable clock for the throttle (tests). */
  now?: () => number;
}): Promise<AssetPushResult> {
  const { designRoot, hubUrl } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console;
  const now = opts.now ?? Date.now;
  const base = hubUrl.replace(/\/+$/, '');
  const out: AssetPushResult = { pushed: [], skipped: 0, failed: [] };

  const assets = listPushableAssets(designRoot);
  // -Infinity seeds the throttle open, so the first emit always passes.
  let lastEmit = -Infinity;
  const emitProgress = (active: string | null, finished: boolean, force = false): void => {
    if (!opts.onProgress) return;
    const t = now();
    if (!force && t - lastEmit < PROGRESS_INTERVAL_MS) return;
    lastEmit = t;
    try {
      opts.onProgress({
        total: assets.length,
        done: out.pushed.length + out.skipped + out.failed.length,
        pushed: out.pushed.length,
        skipped: out.skipped,
        failedCount: out.failed.length,
        failures: out.failed.slice(0, MAX_LISTED_FAILURES),
        active,
        finished,
      });
    } catch {
      /* a broken listener must never break the push */
    }
  };

  for (const rel of assets) {
    emitProgress(rel, false);
    const url = `${base}${routeFor(rel).url}`;
    const headers = { authorization: `Bearer ${opts.token()}` };
    try {
      const head = await fetchImpl(url, { method: 'HEAD', headers });
      if (head.ok) {
        out.skipped += 1;
        continue;
      }
      const put = await fetchImpl(url, {
        method: 'PUT',
        headers,
        body: Bun.file(path.join(designRoot, rel)),
      });
      if (put.ok) out.pushed.push(rel);
      else {
        out.failed.push({ key: rel, reason: `HTTP ${put.status}` });
        emitProgress(rel, false, true);
      }
    } catch (err) {
      out.failed.push({ key: rel, reason: (err as Error).message });
      emitProgress(rel, false, true);
    }
  }
  // No assets → no emits at all: a project without an assets/ dir should not
  // grow an empty assets section in its Sync panel.
  if (assets.length > 0) emitProgress(null, true, true);

  if (out.pushed.length > 0) {
    log.log?.(
      `[sync/assets] pushed ${out.pushed.length} asset(s) to ${base} (${out.skipped} already there)`
    );
  }
  if (out.failed.length > 0) {
    log.warn?.(
      `[sync/assets] ${out.failed.length} asset(s) did not reach ${base} (retried next boot): ${out.failed
        .slice(0, 3)
        .map((f) => `${f.key} — ${f.reason}`)
        .join('; ')}`
    );
  }
  return out;
}
