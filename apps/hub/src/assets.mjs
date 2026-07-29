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

import { getObject, headObject } from './s3.mjs';
import { assetObjectKey, assetPrefixFromEnv } from './asset-key.mjs';
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
const ASSET_KEY = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]{0,63}(?:\/[A-Za-z0-9][A-Za-z0-9._-]{0,63}){0,4}$/;

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

  if (method !== 'GET' && method !== 'HEAD') {
    // The hub does not accept asset WRITES. Assets are minted by the peer that
    // has the bytes (content-addressed on the way in) and pushed straight to
    // the bucket — the hub never becomes an upload endpoint, which would make
    // it an unauthenticated-ish disk-fill surface.
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

  if (!s3) {
    respond(response, 503, 'this hub has no asset store configured');
    return true;
  }

  try {
    if (method === 'HEAD') {
      const meta = await headObject(s3, assetObjectKey(key, ctx.assetPrefix ?? assetPrefixFromEnv()));
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
