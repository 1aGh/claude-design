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

/** Longest single pause the hub can ask for. Matches the hub's rate-limit
 *  window (60 s) — a `Retry-After` larger than that is either a typo or a hub
 *  we should not be blocking a boot sweep on. */
const MAX_RETRY_DELAY_MS = 60_000;

/** Where an absent/unparsable `Retry-After` lands. Old hubs (pre-fix) send a
 *  bare 429 with no header, and their window is the same 60 s. */
const DEFAULT_RETRY_DELAY_MS = 60_000;

/** Total time ONE sweep may spend waiting out 429s. The paced retry exists to
 *  keep an un-upgraded hub livable, not to turn a boot into an hour-long
 *  background stall — past this, the remaining refusals fail fast and the
 *  next-boot backstop takes them. */
const MAX_SWEEP_BACKOFF_MS = 5 * 60_000;

/** How much of an error body reaches `failed[].reason`. Enough to tell "rate
 *  limit exceeded" from a Cloudflare error page — the distinction the 2026-08-11
 *  RCA had to reconstruct from edge logs because the client kept only a status
 *  code. Hub-supplied text ⇒ bounded and stripped before it reaches the UI. */
const ERROR_SNIPPET_CHARS = 80;

/**
 * Every upload closes its connection. NOT an optimization — a correctness
 * requirement, learned the expensive way (2026-08-11, second pass).
 *
 * A peer that refuses a PUT **before reading the body** (the cloud studio door
 * answering 401, the edge answering 503) leaves unread request bytes in an
 * HTTP/1.1 keep-alive socket. The connection is then desynchronized: the next
 * request Bun sends over it NEVER gets a response. With no retry that stayed
 * invisible — the refusal was reported and the sweep moved on. The moment a
 * retry re-sent on that same pooled socket, the sweep wedged forever and the
 * dev-server sidecar died with it (Bun segfault, 4 crash-loops, alligators).
 * Measured: `connection: close` on the retry ALONE does not help (the retry is
 * handed the already-poisoned socket) — it has to be on the request that may be
 * refused, i.e. every PUT. One TLS handshake per asset against multi-MB bodies
 * is not a cost worth reasoning about.
 */
const UPLOAD_CONNECTION_HEADERS = { connection: 'close' } as const;

/** HEAD is a small, bodyless probe — a hub that has not answered in 30 s is not
 *  about to. */
const HEAD_TIMEOUT_MS = 30_000;

/**
 * How long one upload may take before the sweep abandons it: a fixed floor plus
 * an allowance for the bytes at a deliberately pessimistic 100 kB/s, capped.
 * The backstop for anything that wedges a connection the way the keep-alive
 * desync above did — a sweep that hangs forever takes the whole dev-server with
 * it, and "this asset failed, next boot retries it" is always the better end.
 */
export function putTimeoutMs(bytes: number): number {
  return Math.min(10 * 60_000, 60_000 + (Number.isFinite(bytes) ? bytes : 0) / 100);
}

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

/** `Retry-After: <seconds>` → ms, clamped. Only the delta-seconds form is
 *  parsed; the HTTP-date form is not something our hub emits. */
function retryAfterMs(header: string | null): number {
  const secs = Number(String(header ?? '').trim());
  if (!Number.isFinite(secs) || secs <= 0) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(secs * 1000, MAX_RETRY_DELAY_MS);
}

/**
 * Why an upload was refused, in words — status PLUS a bounded snippet of the
 * body. The hub says `{"error":"rate limit exceeded"}`; an edge that never
 * reached the hub says HTML. Those are different bugs and the Sync panel should
 * not make a person read logs to tell them apart.
 *
 * The body is hub-supplied ⇒ untrusted (DDR-054): control characters stripped,
 * whitespace collapsed, hard length cap, and it only ever renders as text.
 */
async function failureReason(res: Response): Promise<string> {
  let snippet = '';
  try {
    snippet = (await res.text())
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point.
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, ERROR_SNIPPET_CHARS);
  } catch {
    /* a body we cannot read tells us nothing — the status still does */
  }
  return snippet ? `HTTP ${res.status} — ${snippet}` : `HTTP ${res.status}`;
}

/**
 * One upload, with the two retries that are worth having in-boot.
 *
 * 429 — the hub tells us when to come back (`Retry-After`), so come back then,
 * ONCE. Before the 2026-08-11 fix the write lane sat in a 5/min per-IP bucket
 * and the sweep ignored the header entirely, so a 182-asset project burned the
 * window and moved ~5 files per boot. The hub half of the fix is the real
 * one — this half is what keeps a not-yet-upgraded hub (the fleet rolls only on
 * a release tag) finishing a sweep instead of grinding.
 *
 * 5xx — one immediate retry, because a transient edge/proxy hiccup on a 30 MB
 * body should not need a whole new boot to get past.
 *
 * A second refusal is a real failure: report it and move on (the next-boot
 * backstop is unchanged).
 */
async function putWithRetry(ctx: {
  fetchImpl: typeof fetch;
  url: string;
  headers: Record<string, string>;
  file: string;
  sleep: (ms: number) => Promise<void>;
  /** Mutable per-sweep pause budget, shared across every asset. */
  backoff: { remainingMs: number };
  timeoutFor: (bytes: number) => number;
}): Promise<Response> {
  const send = (): Promise<Response> => {
    const body = Bun.file(ctx.file);
    return ctx.fetchImpl(ctx.url, {
      method: 'PUT',
      headers: {
        ...ctx.headers,
        ...UPLOAD_CONNECTION_HEADERS,
        // Bun derives this from the file anyway (measured) — stated explicitly
        // so a body length is never something a future body type has to guess.
        'content-length': String(body.size),
      },
      body,
      signal: AbortSignal.timeout(ctx.timeoutFor(body.size)),
    });
  };
  const first = await send();
  if (first.status === 429) {
    const wait = retryAfterMs(first.headers?.get?.('retry-after') ?? null);
    if (wait > ctx.backoff.remainingMs) return first;
    ctx.backoff.remainingMs -= wait;
    await ctx.sleep(wait);
    return send();
  }
  if (first.status >= 500) return send();
  return first;
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
  /** Injectable pause for the 429 backoff (tests — a fake clock, not a wait). */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable per-request time budget (tests — seconds, not minutes). */
  timeoutFor?: (bytes: number) => number;
}): Promise<AssetPushResult> {
  const { designRoot, hubUrl } = opts;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const log = opts.log ?? console;
  const now = opts.now ?? Date.now;
  const sleep =
    opts.sleep ??
    ((ms: number) =>
      new Promise<void>((res) => {
        setTimeout(res, ms);
      }));
  const timeoutFor = opts.timeoutFor ?? putTimeoutMs;
  // Shared across the whole sweep — see MAX_SWEEP_BACKOFF_MS.
  const backoff = { remainingMs: MAX_SWEEP_BACKOFF_MS };
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
      const head = await fetchImpl(url, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      });
      if (head.ok) {
        out.skipped += 1;
        continue;
      }
      // A hub that refuses the PROBE refuses the upload — pushing the body
      // anyway just streams megabytes at a door that already said no. The
      // cloud studio door answers exactly this for a route the deployed hub
      // does not have yet, once per asset, for the whole DS asset set.
      if (head.status === 401 || head.status === 403) {
        out.failed.push({ key: rel, reason: await failureReason(head) });
        emitProgress(rel, false, true);
        continue;
      }
      const put = await putWithRetry({
        fetchImpl,
        url,
        headers,
        file: path.join(designRoot, rel),
        sleep,
        backoff,
        timeoutFor,
      });
      if (put.ok) out.pushed.push(rel);
      else {
        out.failed.push({ key: rel, reason: await failureReason(put) });
        emitProgress(rel, false, true);
      }
    } catch (err) {
      const e = err as Error;
      out.failed.push({
        key: rel,
        // "TimeoutError: The operation timed out" tells a person nothing about
        // which limit fired; name the budget instead.
        reason: e.name === 'TimeoutError' ? 'timed out — the hub stopped answering' : e.message,
      });
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
