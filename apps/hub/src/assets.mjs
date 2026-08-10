// Authenticated asset proxy — Cloud Phase 3 Task 2 (hub side).
//
// A peer that has an asset REFERENCE but not the bytes asks the hub for them.
// The hub streams from the bucket after checking the peer's token.
//
// WHY A PROXY AND NOT A PRESIGNED URL. Two independent reasons, either
// sufficient:
//
//   1. The canvas origin's CSP is `img-src 'self'` (DDR-063/DDR-054) and stays
//      that way. Media has to arrive same-origin or it does not render.
//   2. A presigned URL is a bearer credential. Handing one to tenant-authored
//      canvas content puts a credential inside the least-trusted thing in the
//      system, where any script sharing that realm can read it — and it stays
//      valid after the page is closed.
//
// The proxy costs egress on the hub. R2's $0 egress is what makes that
// affordable, and it is a reason the provider decision (DDR-193 §1) is
// load-bearing here rather than incidental.
//
// WHAT THIS ROUTE IS NOT: a general object store. Only content-addressed
// `assets/<sha8>[.ext]` keys are reachable, validated by regex before any
// network call, so a hostile key can neither traverse the bucket nor probe for
// unrelated objects.

import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createWriteStream, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

import { assetObjectKey, assetPrefixFromEnv } from './asset-key.mjs';
import { isContainedReal } from './path-contain.mjs';
import { getObject, headObject } from './s3.mjs';
import { verifyToken } from './tokens.mjs';

/**
 * A content-addressed key: the name IS the hash of the bytes. Immutable, so it
 * can be cached forever.
 */
const CONTENT_ADDRESSED = /^[0-9a-f]{8}(?:\.[A-Za-z0-9]{1,8})?$/;

/**
 * Every key shape the proxy will serve.
 *
 * Content-addressing was the ONLY shape until Cloud Phase 15 put a real
 * project in a cell and found that real projects do not look like that. The
 * alligators design system references `/assets/graphics/camo-bg.png`,
 * `/assets/fonts/Gators-Bold.woff2`, `/assets/gator_badge_roundel.svg` — human
 * names, in subdirectories. `maude design fetch-asset` mints content-addressed
 * names for things it DOWNLOADS; a design system's own fonts and graphics are
 * authored, committed, and referenced by path. Serving only hashes meant a
 * hosted project rendered with its images missing and no error anywhere.
 *
 * The security properties that mattered are kept, and they were never about
 * the hash:
 *   - no `..` segment, no leading `/`, no backslash ⇒ cannot escape `assets/`;
 *   - a bounded, conservative charset ⇒ nothing that could be read as a
 *     control character, a query, or a second path;
 *   - depth and length caps ⇒ not a vehicle for absurd keys.
 * What the hash DID buy is cache-safety, and that is handled where it belongs:
 * only content-addressed keys get an immutable cache header (see below).
 */
const ASSET_KEY =
  /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}){0,4}$/;

/** Conservative content types, chosen by extension. Never sniffed, never
 *  taken from the client, and never `text/html` — an asset must not be able to
 *  become a document on the hub's origin. */
const CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  json: 'application/json',
};

export function assetContentType(key) {
  const ext = key.includes('.') ? key.split('.').pop().toLowerCase() : '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

/** True when the key is the hash of its own bytes ⇒ safe to cache forever. */
export function isContentAddressed(key) {
  return CONTENT_ADDRESSED.test(String(key ?? ''));
}

/** Parse `/assets/<path>` → the key, or null when it is not one we will serve. */
export function parseAssetPath(pathname) {
  const m = String(pathname ?? '').match(/^\/assets\/([^?#]+)$/);
  const key = m?.[1];
  if (!key || !ASSET_KEY.test(key)) return null;
  return key;
}

/**
 * Handle `GET /assets/<sha8>[.ext]`. Returns true when handled.
 *
 * @param {object} ctx
 * @param {import('node:http').IncomingMessage} ctx.request
 * @param {import('node:http').ServerResponse} ctx.response
 * @param {string} ctx.pathname
 * @param {string} ctx.method
 * @param {string} ctx.dataDir
 * @param {string} ctx.secret
 * @param {import('./s3.mjs').S3Config|null} ctx.s3
 * @param {(request: any) => boolean} [ctx.checkRateLimit]
 */
export async function handleAssetRoute(ctx) {
  const { request, response, pathname, method, dataDir, secret, s3 } = ctx;
  const key = parseAssetPath(pathname);
  if (key === null) return false;

  if (method !== 'GET' && method !== 'HEAD' && method !== 'PUT') {
    // GET/HEAD proxy + the DDR-217 desktop push — nothing else. (The original
    // "the hub does not accept asset WRITES" posture guarded against an
    // unauthenticated-ish disk-fill surface; the PUT branch below is neither —
    // token-gated, shape-validated, size-capped, workspace-only.)
    respond(response, 405, 'method not allowed');
    return true;
  }

  const auth = request.headers?.authorization;
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  if (!token || !verifyToken(dataDir, token, secret)) {
    if (ctx.checkRateLimit && !ctx.checkRateLimit(request)) {
      respond(response, 429, 'rate limit exceeded');
      return true;
    }
    respond(response, 401, 'unauthorized');
    return true;
  }

  if (method === 'PUT') {
    // DDR-217 (fix 6, sync RCA 2026-08-10) — the desktop→cell asset push. The
    // sync lanes are text-only, so a desktop-linked project's `assets/` never
    // reached the cell and its `/assets/` route served bytes it did not have
    // (the grey boxes). The desktop is the one peer that HAS the bytes; it
    // streams them here, into the checkout the studio child already serves,
    // and `onWritten` mirrors them to the bucket — byte-for-byte the path a
    // browser upload takes (studio `POST /_api/asset` → checkout → sweepNew).
    if (!ctx.designRoot) {
      // A hub with no checkout has nowhere durable to put bytes — the
      // pre-DDR-217 refusal stands there.
      respond(response, 405, 'this hub does not accept asset writes');
      return true;
    }
    // Rate-limit the AUTHENTICATED write too (security review 2026-08-10, F2).
    // The GET/HEAD proxy only rate-limits its 401 path — but a write is the
    // expensive, disk-touching verb, so a valid token must not stream at line
    // rate unthrottled. Same bucket as the auth-failure path.
    if (ctx.checkRateLimit && !ctx.checkRateLimit(request)) {
      respond(response, 429, 'rate limit exceeded');
      return true;
    }
    return handleAssetPut({
      request,
      response,
      key,
      designRoot: ctx.designRoot,
      onWritten: ctx.onWritten,
      maxPutBytes: ctx.maxPutBytes,
      putBudget: ctx.putBudget,
    });
  }

  if (!s3) {
    respond(response, 503, 'this hub has no asset store configured');
    return true;
  }

  try {
    if (method === 'HEAD') {
      const meta = await headObject(
        s3,
        assetObjectKey(key, ctx.assetPrefix ?? assetPrefixFromEnv())
      );
      if (!meta) {
        respond(response, 404, 'not found');
        return true;
      }
      response
        .writeHead(200, {
          'Content-Type': assetContentType(key),
          'Content-Length': meta.size,
          ...cacheHeadersFor(key),
        })
        .end();
      return true;
    }

    const body = await getObject(s3, assetObjectKey(key, ctx.assetPrefix ?? assetPrefixFromEnv()));
    if (!body) {
      respond(response, 404, 'not found');
      return true;
    }
    response
      .writeHead(200, {
        'Content-Type': assetContentType(key),
        'Content-Length': body.length,
        ...cacheHeadersFor(key),
      })
      .end(body);
    return true;
  } catch (err) {
    console.error(`[hub] asset ${key} failed: ${err.message}`);
    respond(response, 502, 'asset store unavailable');
    return true;
  }
}

/**
 * Per-file ceiling for a pushed asset — mirrors the studio's
 * `ASSET_MAX_VIDEO_BYTES` (the largest thing a canvas legitimately references),
 * same env override so a power user raises both ends together.
 */
const MAX_PUT_BYTES = (() => {
  const env = Number(process.env.MAUDE_ASSET_MAX_VIDEO_BYTES);
  return Number.isFinite(env) && env > 0 ? env : 100 * 1024 * 1024;
})();

/**
 * Aggregate per-hub-process write budget for the PUT lane, mirroring the
 * studio's `ASSET_SESSION_BUDGET` (DDR-088 security review). A single valid
 * peer token would otherwise write `MAX_PUT_BYTES` across unlimited keys with
 * no ceiling — content-addressing does not dedupe a one-byte mutation, so the
 * per-file cap is not a disk-fill defence. This bounds total bytes one process
 * will ever accept over the wire. Overridable for a large legitimate import.
 */
const PUT_SESSION_BUDGET = (() => {
  const env = Number(process.env.MAUDE_ASSET_PUT_SESSION_BUDGET);
  return Number.isFinite(env) && env > 0 ? env : 2 * 1024 * 1024 * 1024;
})();
// The budget is a per-hub-PROCESS aggregate: one mutable `{ cap, used }` the
// route closure carries for the process's life. A ctx-injected one lets a test
// isolate its own budget (module-level `used` would leak across cases).
const defaultPutBudget = { cap: PUT_SESSION_BUDGET, used: 0 };

/**
 * Stream one pushed asset into the checkout: temp file + rename (a reader
 * never observes a half-written asset), hard byte cap enforced mid-stream
 * (an over-cap upload aborts and removes the partial — never buffered whole).
 *
 * CONTAINMENT IS SYMLINK-AWARE (security review 2026-08-10, both passes agreed
 * on this as the one blocker). `key` already passed `ASSET_KEY` (no `..`), but
 * that plus `resolve()` is purely LEXICAL — and a peer can COMMIT a symlink
 * under `assets/` into the shared repo (DDR-054), so `assets/x -> ../../ui`
 * plus `PUT assets/x/welcome.tsx` would follow the link and overwrite a served
 * canvas the studio child then compiles (a data→code crossing, DDR-193 §2).
 * `isContainedReal` resolves every symlink on disk before the write, exactly
 * as the sibling relocation writer (workspace-agent) already does — one guard,
 * one home (path-contain.mjs).
 */
async function handleAssetPut({
  request,
  response,
  key,
  designRoot,
  onWritten,
  maxPutBytes = MAX_PUT_BYTES,
  putBudget = defaultPutBudget,
}) {
  const assetsRoot = resolve(designRoot, 'assets');
  const abs = resolve(assetsRoot, key);
  // Lexical first (cheap), then the on-disk symlink resolution against the
  // realpath of assets/. The parent dir is what `mkdirSync`/`createWriteStream`
  // traverse, so it is what must be contained.
  mkdirSync(assetsRoot, { recursive: true });
  if (
    (abs !== assetsRoot && !abs.startsWith(assetsRoot + sep)) ||
    !isContainedReal(assetsRoot, abs)
  ) {
    respond(response, 400, 'invalid key');
    return true;
  }
  if (putBudget.used >= putBudget.cap) {
    respond(response, 507, 'asset write budget for this session is exhausted');
    return true;
  }
  // Per-REQUEST temp name — two concurrent PUTs to one key must not share a
  // temp (torn writes, one request's cleanup deleting the other's file).
  const tmp = `${abs}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  let total = 0;
  try {
    mkdirSync(dirname(abs), { recursive: true });
    const ws = createWriteStream(tmp);
    // An abort destroys the stream mid-flight; the late open/write callbacks
    // must land in this no-op, not in an uncaughtException.
    ws.on('error', () => {});
    // The effective ceiling is the smaller of the per-file cap and what is
    // left in the per-process budget, so one huge stream cannot blow past it.
    const effectiveCap = Math.min(maxPutBytes, putBudget.cap - putBudget.used);
    try {
      for await (const chunk of request) {
        total += chunk.length;
        if (total > effectiveCap) {
          const err = new Error('too large');
          err.tooLarge = true;
          throw err;
        }
        if (!ws.write(chunk)) await once(ws, 'drain');
      }
      await new Promise((res, rej) => {
        ws.end((err) => (err ? rej(err) : res()));
      });
    } catch (err) {
      ws.destroy();
      // Wait for the fd to actually settle — removing the temp while the
      // stream's async open/write is still in flight recreates it (or throws
      // ENOENT out of a callback nobody owns).
      await once(ws, 'close');
      rmSync(tmp, { force: true });
      respond(
        response,
        err.tooLarge ? 413 : 500,
        err.tooLarge
          ? `asset exceeds the ${Math.round(maxPutBytes / (1024 * 1024))} MB cap`
          : 'write failed'
      );
      return true;
    }
    renameSync(tmp, abs);
    putBudget.used += total;
  } catch (err) {
    rmSync(tmp, { force: true });
    console.error(`[hub] asset put ${key} failed: ${err.message}`);
    respond(response, 500, 'write failed');
    return true;
  }
  // Mirror to the bucket now, not at the next boot — fire-and-forget, the
  // bytes are already durable in the checkout (the browser-upload precedent).
  onWritten?.();
  const body = JSON.stringify({ ok: true, key, bytes: total });
  response
    .writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
    })
    .end(body);
  return true;
}

// Content-addressed ⇒ the bytes under a key never change ⇒ cache forever. This
// is the payoff of content addressing: no invalidation, ever.
// `nosniff` is not optional here — the content type is chosen from an
// extension, and letting a browser sniff its way to text/html would turn an
// asset into a document on the hub's own origin.
const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};

/**
 * Cache policy follows from the KEY, not from a guess.
 *
 * A content-addressed key can never point at different bytes, so it is
 * immutable and cacheable forever. A human-named one can be replaced by its
 * author tomorrow — caching that for a year means the design system's own font
 * or logo is stale in every browser that ever loaded it, with no way to
 * invalidate. `no-cache` still allows revalidation; it just forbids serving a
 * stale copy blind.
 */
function cacheHeadersFor(key) {
  return isContentAddressed(key)
    ? { ...BASE_HEADERS, 'Cache-Control': 'public, max-age=31536000, immutable' }
    : { ...BASE_HEADERS, 'Cache-Control': 'no-cache' };
}

function respond(response, status, message) {
  const body = JSON.stringify({ error: message });
  response
    .writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
      'X-Content-Type-Options': 'nosniff',
    })
    .end(body);
}
