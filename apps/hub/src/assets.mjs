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
import { verifyToken } from './tokens.mjs';

/** The only key shape the proxy will ever request. */
const ASSET_KEY = /^[0-9a-f]{8}(?:\.[A-Za-z0-9]{1,8})?$/;

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

/** Parse `/assets/<sha8>[.ext]` → the key, or null when it isn't one. */
export function parseAssetPath(pathname) {
  const m = String(pathname ?? '').match(/^\/assets\/([^/?#]+)$/);
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
      const meta = await headObject(s3, `assets/${key}`);
      if (!meta) {
        respond(response, 404, 'not found');
        return true;
      }
      response
        .writeHead(200, {
          'Content-Type': assetContentType(key),
          'Content-Length': meta.size,
          ...IMMUTABLE_HEADERS,
        })
        .end();
      return true;
    }

    const body = await getObject(s3, `assets/${key}`);
    if (!body) {
      respond(response, 404, 'not found');
      return true;
    }
    response
      .writeHead(200, {
        'Content-Type': assetContentType(key),
        'Content-Length': body.length,
        ...IMMUTABLE_HEADERS,
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
const IMMUTABLE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};

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
