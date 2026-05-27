#!/usr/bin/env node
// Maude Hub — self-hostable Yjs sync backend.
//
// Phase 9 (v1.1). Hocuspocus over PartyKit — see
// .ai/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md.
// Admin auth architecture — see DDR-053-hub-admin-auth-architecture.md.
//
// Environment (consumed only when run as a CLI / main module):
//   PORT                    listen port (default 1234)
//   DATA_DIR                SQLite + tokens.json dir (default ./data)
//   HUB_SECRET              escape-hatch token; tokens.json is the primary store
//   HUB_INSECURE_HTTP       if '1', logs note non-TLS (TLS terminates upstream)
//   HUB_PUBLIC_URL          base URL printed in admin / bootstrap logs
//   HUB_ADMIN_RATE_LIMIT    'off' disables the per-IP rate limiter (dev only)
//
// Auth: tokens.json next to hub.db is checked first; HUB_SECRET is a fallback
// for headless / scripted setups. With NEITHER configured the hub runs in
// permissive dev mode and prints a warning on every connect. Phase 9 Task 6
// hardens this with HMAC-SHA256 stored in SQLite.
//
// Admin: /admin serves a vanilla-JS single-page UI (src/admin/). /admin/api/*
// JSON routes mint tokens, rotate them, list peers, and report hub status.
// Bootstrap key (single-use, 24h TTL, no reissue post-consume per DDR-053)
// lets the first admin claim the hub without typing HUB_SECRET.
//
// Per DDR-053 hardening:
//   - Bearer-only admin auth (no ?secret= query).
//   - Atomic single-use bootstrap (POSIX rename-to-consume).
//   - Scope-bound tokens (default scope = label; documentName must match).
//   - Rotate kicks active WS sessions for the rotated label.
//   - CSP + X-Frame-Options + Referrer-Policy on /admin*.
//   - Per-IP rate limit (5/60s) on /admin/api/bootstrap + 401s.
//   - readJsonBody enforces Content-Type, body timeout, proto-pollution guard.
//   - All log lines that interpolate user data go through sanitizeForLog.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { SQLite } from '@hocuspocus/extension-sqlite';
import { Server } from '@hocuspocus/server';

import { ADMIN_CSS, ADMIN_HTML, ADMIN_JS, adminAssetsLoaded } from './admin-assets.mjs';
import {
  generateAdminSecret,
  readAdminSecret,
  verifyAdminAuth,
  writeAdminSecret,
} from './admin-auth.mjs';
import { maybeIssueOnBoot, verifyAndConsume } from './bootstrap.mjs';
import {
  addToken,
  assertValidLabel,
  listTokenLabels,
  matchesScope,
  readTokensFile,
  recordTokenUse,
  rotateToken,
  verifyToken,
} from './tokens.mjs';

const HUB_VERSION = readOwnVersion();
const DOCUMENT_NAME_REGEX = /^[A-Za-z0-9._/\-]{1,256}$/;
const PUBLIC_URL_REGEX = /^https?:\/\/[^\s;'"<>`]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

/**
 * @typedef {Object} HubConfig
 * @property {number} [port]
 * @property {string} [dataDir]
 * @property {string} [secret]
 * @property {string} [publicUrl]
 * @property {boolean} [insecureHttp]
 * @property {boolean} [verbose]
 * @property {boolean} [rateLimit]  default true; set false in tests/dev
 */

/**
 * Build (but don't yet start) a Hocuspocus instance against the given config.
 * Callers run `await instance.listen()` and `await instance.destroy()`.
 *
 * @param {HubConfig} [config]
 */
export function createHub(config = {}) {
  const port = config.port ?? 1234;
  const dataDir = config.dataDir ?? resolve(process.cwd(), 'data');
  const secret = config.secret ?? '';
  const publicUrl = config.publicUrl ?? `http://localhost:${port}`;
  const verbose = config.verbose ?? true;
  const rateLimit = config.rateLimit ?? true;
  const startedAt = Date.now();

  // DDR-053 §5: refuse to boot if publicUrl can be weaponized into shell
  // injection on operators who copy-paste from the admin UI.
  if (!PUBLIC_URL_REGEX.test(publicUrl)) {
    throw new Error(
      `invalid publicUrl: ${JSON.stringify(publicUrl)} — must match ${PUBLIC_URL_REGEX}`
    );
  }

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const sqlitePath = join(dataDir, 'hub.db');

  /** @type {Map<string, { socketId: string, documentName: string, user: string, connectedAt: number, connection: any }>} */
  const peers = new Map();

  /** Per-IP rate limit buckets: ip → { count, windowStart } */
  const rateBuckets = new Map();

  const server = new Server({
    port,

    extensions: [new SQLite({ database: sqlitePath })],

    async onAuthenticate({ token, documentName }) {
      // DDR-053 §5: defend against log forging + future XSS regression by
      // rejecting documentNames with HTML / log metacharacters at source.
      if (!DOCUMENT_NAME_REGEX.test(documentName ?? '')) {
        throw new Error('invalid documentName');
      }
      const match = verifyToken(dataDir, token, secret);
      if (match) {
        // DDR-053 §3: scope binding gates Chain B (token leak → full hub).
        if (!matchesScope(match.scope, documentName)) {
          throw new Error('token not authorized for this documentName');
        }
        if (match.source === 'file') recordTokenUse(dataDir, match.label);
        return { user: { name: match.label, source: match.source, dev: !!match.dev } };
      }
      // No tokens.json entries and no HUB_SECRET → permissive dev mode.
      const { tokens } = readTokensFile(dataDir);
      if (tokens.length === 0 && secret === '') {
        if (verbose) {
          console.warn(
            `[hub] no tokens configured; accepting any token for documentName=${sanitizeForLog(documentName)}`
          );
        }
        return { user: { name: 'anon', anon: true } };
      }
      throw new Error('invalid token');
    },

    async onRequest({ request, response }) {
      if (!request.url) return;
      const url = request.url;
      const method = request.method ?? 'GET';

      if (method === 'GET' && (url === '/health' || url.startsWith('/health?'))) {
        respondJson(
          response,
          200,
          buildStatusPayload({ dataDir, secret, port, startedAt, peersCount: peers.size })
        );
        bailFromOnRequest();
      }
      if (url === '/admin' || url.startsWith('/admin?')) {
        respondAsset(response, ADMIN_HTML, 'text/html; charset=utf-8', { hardenAdminOrigin: true });
        bailFromOnRequest();
      }
      if (url === '/admin/') {
        response.writeHead(301, { Location: '/admin' });
        response.end();
        bailFromOnRequest();
      }
      if (url === '/admin/style.css' || url.startsWith('/admin/style.css?')) {
        respondAsset(response, ADMIN_CSS, 'text/css; charset=utf-8', { hardenAdminOrigin: true });
        bailFromOnRequest();
      }
      if (url === '/admin/app.js' || url.startsWith('/admin/app.js?')) {
        respondAsset(response, ADMIN_JS, 'application/javascript; charset=utf-8', {
          hardenAdminOrigin: true,
        });
        bailFromOnRequest();
      }
      if (url.startsWith('/admin/api/')) {
        await handleAdminApi({
          request,
          response,
          dataDir,
          secret,
          port,
          startedAt,
          peers,
          publicUrl,
          rateBuckets,
          rateLimit,
        });
        bailFromOnRequest();
      }
      // Fall through — Hocuspocus' default handler responds to unknown routes.
    },

    async onConnect({ documentName, socketId, context }) {
      // Pre-init peers entry without the `connection` reference — that field
      // isn't on the onConnect payload in @hocuspocus/server 4.x; we patch it
      // in via the `connected` hook below. Keeping the entry available here
      // so /admin/api/peers shows pending connections during auth.
      const user = context?.user?.name ?? 'anon';
      peers.set(socketId, {
        socketId,
        documentName,
        user,
        connectedAt: Date.now(),
        connection: null,
      });
      if (verbose) {
        console.log(
          `[hub] connect documentName=${sanitizeForLog(documentName)} user=${sanitizeForLog(user)}`
        );
      }
    },
    async connected({ socketId, connection, context }) {
      // Per @hocuspocus/server 4.x types: `connection` is delivered on the
      // `connected` hook (post-auth, post-document-load), NOT onConnect.
      // The context.user is ALSO only populated here — onConnect fires BEFORE
      // onAuthenticate, so the Map entry recorded `user: 'anon'` there.
      // Patch BOTH fields so kickSessionsForLabel matches correctly (DDR-053 §4).
      const entry = peers.get(socketId);
      if (!entry) return;
      entry.connection = connection;
      const realUser = context?.user?.name;
      if (realUser) entry.user = realUser;
    },
    async onDisconnect({ documentName, socketId, context }) {
      const user = context?.user?.name ?? 'anon';
      peers.delete(socketId);
      if (verbose) {
        console.log(
          `[hub] disconnect documentName=${sanitizeForLog(documentName)} user=${sanitizeForLog(user)}`
        );
      }
    },
    async onLoadDocument({ documentName }) {
      if (verbose) console.log(`[hub] load documentName=${sanitizeForLog(documentName)}`);
    },
  });

  return {
    server,
    sqlitePath,
    port,
    secret,
    dataDir,
    publicUrl,
    startedAt,
    version: HUB_VERSION,
    peers,
  };
}

// ----------------------------------------------------------------- /admin API

async function handleAdminApi(ctx) {
  const { request, response, dataDir, secret, peers, publicUrl, rateBuckets, rateLimit } = ctx;
  const url = new URL(request.url, 'http://x');
  const path = url.pathname.slice('/admin/api'.length); // '/status', '/tokens', …
  const method = request.method ?? 'GET';

  // /identity is unauthenticated — surfaces the hub's public URL + a stable
  // fingerprint so a claim-link victim can verify they're claiming the
  // expected hub (DDR-053 §7).
  if (method === 'GET' && path === '/identity') {
    respondAdminJson(response, 200, {
      publicUrl,
      version: HUB_VERSION,
      hostFingerprint: createHash('sha256').update(publicUrl).digest('hex').slice(0, 16),
    });
    return;
  }

  // /bootstrap is the only state-changing unauthenticated admin route — the
  // bootstrap key in the JSON body validates instead.
  if (method === 'POST' && path === '/bootstrap') {
    if (rateLimit && !checkRateLimit(rateBuckets, request)) {
      respondRateLimited(response);
      return;
    }
    return handleBootstrap({ request, response, dataDir });
  }

  if (!verifyAdminAuth(request, { hubSecret: secret, dataDir })) {
    // Consume budget on 401s — burst of wrong-auth → 429 (limits brute force).
    if (rateLimit && !checkRateLimit(rateBuckets, request)) {
      respondRateLimited(response);
      return;
    }
    respondAdminJson(response, 401, { error: 'unauthorized' });
    return;
  }

  if (method === 'GET' && path === '/status') {
    respondAdminJson(
      response,
      200,
      buildStatusPayload({
        dataDir,
        secret,
        port: ctx.port,
        startedAt: ctx.startedAt,
        peersCount: peers.size,
      })
    );
    return;
  }
  if (method === 'GET' && path === '/tokens') {
    respondAdminJson(response, 200, { tokens: listTokenLabels(dataDir) });
    return;
  }
  if (method === 'GET' && path === '/peers') {
    respondAdminJson(response, 200, {
      peers: Array.from(peers.values()).map((p) => ({
        socketId: p.socketId,
        documentName: p.documentName,
        user: p.user,
        connectedAt: p.connectedAt,
      })),
    });
    return;
  }
  if (method === 'POST' && path === '/token') {
    try {
      const body = await readJsonBody(request);
      const label = String(body?.label ?? '').trim();
      assertValidLabel(label);
      // scope optional; default = label (DDR-053 §3). '*' = wildcard opt-in.
      const scope = body?.scope === undefined ? undefined : String(body.scope).trim();
      const record = addToken(dataDir, { label, scope });
      respondAdminJson(response, 201, formatInviteResponse(record, publicUrl));
    } catch (err) {
      respondAdminJson(response, 400, { error: err.message });
    }
    return;
  }
  if (method === 'POST' && path === '/token/rotate') {
    try {
      const body = await readJsonBody(request);
      const label = String(body?.label ?? '').trim();
      assertValidLabel(label);
      const record = rotateToken(dataDir, label);
      // DDR-053 §4: kick existing WS sessions for the rotated label so dwell
      // time on a compromised token is bounded by rotate latency, not by the
      // attacker's choice to never disconnect.
      const disconnected = kickSessionsForLabel(peers, label);
      respondAdminJson(response, 200, { ...formatInviteResponse(record, publicUrl), disconnected });
    } catch (err) {
      const status = err.message.startsWith('no token') ? 404 : 400;
      respondAdminJson(response, status, { error: err.message });
    }
    return;
  }

  respondAdminJson(response, 404, { error: 'not found' });
}

async function handleBootstrap({ request, response, dataDir }) {
  try {
    const body = await readJsonBody(request);
    const key = String(body?.key ?? '').trim();
    if (!key) {
      respondAdminJson(response, 400, { error: 'key required' });
      return;
    }
    if (!verifyAndConsume(dataDir, key)) {
      respondAdminJson(response, 401, { error: 'invalid or expired bootstrap key' });
      return;
    }
    let adminSecret = readAdminSecret(dataDir);
    if (!adminSecret) {
      adminSecret = generateAdminSecret();
      writeAdminSecret(dataDir, adminSecret);
    }
    respondAdminJson(response, 200, { secret: adminSecret });
  } catch (err) {
    respondAdminJson(response, 400, { error: err.message });
  }
}

function formatInviteResponse(record, publicUrl) {
  return {
    label: record.label,
    token: record.value,
    scope: record.scope ?? '*',
    createdAt: record.createdAt,
    command: `maude design link ${publicUrl} --token=${record.value}`,
  };
}

function buildStatusPayload({ dataDir, secret, port, startedAt, peersCount }) {
  const { tokens } = readTokensFile(dataDir);
  return {
    ok: true,
    version: HUB_VERSION,
    uptimeMs: Date.now() - startedAt,
    port,
    dataDir,
    tokenCount: tokens.length,
    authMode: tokens.length > 0 ? 'tokens.json' : secret ? 'env-secret' : 'dev',
    peersCount: peersCount ?? 0,
  };
}

// ------------------------------------------------------------ session kicker

/**
 * Force-close every connection whose context.user.name matches `label`.
 * Returns the count of closed sessions.
 */
function kickSessionsForLabel(peers, label) {
  let count = 0;
  for (const [socketId, peer] of peers.entries()) {
    if (peer.user !== label) continue;
    try {
      peer.connection?.close?.();
    } catch {
      /* best-effort */
    }
    peers.delete(socketId);
    count++;
  }
  return count;
}

// ----------------------------------------------------------- rate limiter

/**
 * Per-IP token bucket. Returns true when the request is within budget.
 * Per DDR-053 §6 — in-memory only (single-process hub), 5 req / 60s.
 *
 * X-Forwarded-For intentionally not trusted in v1.1 — operators behind a
 * proper reverse proxy get accurate buckets in Task 6 when trustProxy lands.
 */
function checkRateLimit(buckets, request) {
  const ip = request.socket?.remoteAddress ?? '0.0.0.0';
  const now = Date.now();
  // Opportunistic eviction (~1% of calls) so a long-running hub doesn't
  // accumulate entries for one-shot IPs (botnet / IPv6 rotation). Cheap.
  if (Math.random() < 0.01) {
    for (const [key, b] of buckets) {
      if (now - b.windowStart >= RATE_LIMIT_WINDOW_MS) buckets.delete(key);
    }
  }
  const bucket = buckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

function respondRateLimited(response) {
  const body = JSON.stringify({ error: 'rate limit exceeded' });
  response.writeHead(429, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Retry-After': '60',
    'Content-Length': Buffer.byteLength(body),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(body);
}

/** Sugar — admin-API JSON responses always opt into the hardened header set. */
function respondAdminJson(response, status, payload) {
  return respondJson(response, status, payload, { hardenAdminOrigin: true });
}

// ------------------------------------------------------------- HTTP helpers

const ADMIN_HARDENED_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

function respondJson(response, status, payload, { hardenAdminOrigin = false } = {}) {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  };
  if (hardenAdminOrigin) {
    for (const [k, v] of Object.entries(ADMIN_HARDENED_HEADERS)) {
      // Don't let the bundle clobber Content-Type / Cache-Control on a JSON
      // response (it currently shares Cache-Control with us — both 'no-store').
      if (k !== 'Content-Type' && k !== 'Cache-Control') headers[k] = v;
    }
  }
  response.writeHead(status, headers);
  response.end(body);
}

function respondAsset(response, body, contentType, { hardenAdminOrigin = false } = {}) {
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...(hardenAdminOrigin ? ADMIN_HARDENED_HEADERS : {}),
  };
  // Avoid duplicate Content-Type from spread above
  headers['Content-Type'] = contentType;
  response.writeHead(200, headers);
  response.end(body);
}

/**
 * Read + parse a JSON body. Per DDR-053 §5:
 *   - Enforces Content-Type: application/json (rejects text/plain etc.).
 *   - 64 KB max payload.
 *   - 15 s request timeout (defeats slow-POST DoS).
 *   - Rejects bodies containing __proto__ / constructor / prototype keys
 *     (proto-pollution defense-in-depth).
 */
async function readJsonBody(request, { maxBytes = 64 * 1024, timeoutMs = 15_000 } = {}) {
  const contentType = (request.headers?.['content-type'] ?? '').toString().toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw new Error('Content-Type must be application/json');
  }
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let total = 0;
    const onTimeout = () => {
      try {
        request.destroy();
      } catch {
        /* ignore */
      }
      reject(new Error('request body timeout'));
    };
    try {
      request.setTimeout?.(timeoutMs, onTimeout);
    } catch {
      /* best-effort */
    }
    request.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        request.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (total === 0) return resolveBody({});
      const raw = Buffer.concat(chunks).toString('utf8');
      if (/"\s*(?:__proto__|constructor|prototype)\s*"\s*:/.test(raw)) {
        reject(new Error('reserved property name in body'));
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`invalid JSON body: ${err.message}`));
      }
    });
    request.on('error', reject);
  });
}

/** Strip CR/LF/control chars and clamp length. Use for any user-controlled
 * value that lands in console.log lines (defends against log forging). */
function sanitizeForLog(value) {
  let out = '';
  const s = String(value ?? '').slice(0, 256);
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    out += code < 0x20 || code === 0x7f ? '·' : s[i];
  }
  return out;
}

/**
 * Short-circuit Hocuspocus' default `200 Welcome to Hocuspocus!` writer.
 * Its requestHandler swallows falsy throws (`if (error) throw error;`) — this
 * is the framework's documented bail-from-onRequest contract.
 */
function bailFromOnRequest() {
  // eslint-disable-next-line no-throw-literal
  throw null;
}

// ------------------------------------------------------------------- main

/** Run the hub as a CLI process. */
async function runAsMain() {
  const port = Number.parseInt(process.env.PORT ?? '1234', 10);
  const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), 'data');
  const secret = process.env.HUB_SECRET ?? '';
  const insecureHttp = process.env.HUB_INSECURE_HTTP === '1';
  const publicUrl =
    process.env.HUB_PUBLIC_URL ?? `http${insecureHttp ? '' : 's'}://localhost:${port}`;
  const rateLimit = process.env.HUB_ADMIN_RATE_LIMIT !== 'off';

  let built;
  try {
    built = createHub({ port, dataDir, secret, publicUrl, rateLimit });
  } catch (err) {
    console.error('[hub] config error:', err.message);
    process.exit(1);
  }
  const { server, sqlitePath } = built;

  try {
    await server.listen();
  } catch (err) {
    console.error('[hub] failed to listen:', err);
    process.exit(1);
  }

  const scheme = insecureHttp ? 'http' : 'ws';
  console.log(`[hub] Maude Hub v${HUB_VERSION} listening on ${scheme}://0.0.0.0:${port}`);
  console.log(`[hub] data dir: ${dataDir}`);
  console.log(`[hub] SQLite at ${sqlitePath}`);
  console.log(`[hub] admin UI: ${publicUrl}/admin`);
  if (!adminAssetsLoaded()) {
    console.warn(
      '[hub] admin assets missing — /admin will serve empty page. Run `bun run build` in plugins/design/hub.'
    );
  }

  const bootstrap = maybeIssueOnBoot(dataDir, { secret });
  if (bootstrap) {
    console.log('');
    console.log(
      '[hub] First-run setup link (single-use, expires in 24h, NO regeneration after consumption):'
    );
    console.log(`      ${publicUrl}/admin?key=${bootstrap.key}`);
    console.log('');
  } else {
    // Tell the operator why no link was printed when one might be expected.
    const { tokens } = readTokensFile(dataDir);
    if (tokens.length === 0 && secret === '') {
      console.warn(
        '[hub] Hub unclaimed window closed (prior bootstrap consumed or expired). Restart with HUB_SECRET=<value> to set admin.'
      );
    }
  }

  const { tokens } = readTokensFile(dataDir);
  if (tokens.length === 0 && secret === '') {
    console.warn(
      '[hub] no tokens configured — running in permissive dev mode. Do NOT expose to the internet.'
    );
  } else if (tokens.length > 0) {
    console.log(`[hub] tokens.json contains ${tokens.length} token(s).`);
  } else {
    console.log('[hub] HUB_SECRET is set — accepting that single token.');
  }

  const shutdown = (signal) => {
    console.log(`[hub] ${signal} received, shutting down`);
    server
      .destroy()
      .catch((err) => {
        console.error('[hub] shutdown error:', err);
      })
      .finally(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function readOwnVersion() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Auto-start only when invoked directly (`node src/server.mjs` or the bundled
// dist/hub.bundle.mjs). Tests import { createHub } and drive the lifecycle
// themselves.
const invokedAsMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedAsMain) {
  await runAsMain();
}
