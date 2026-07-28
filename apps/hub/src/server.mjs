#!/usr/bin/env node
// Maude Hub — self-hostable Yjs sync backend.
//
// Phase 9 (v1.1). Hocuspocus over PartyKit — see
// .ai/archive/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md.
// Admin auth architecture — see DDR-053-hub-admin-auth-architecture.md.
//
// Environment (consumed only when run as a CLI / main module):
//   PORT                    listen port (default 1234)
//   DATA_DIR                tokens.db + hub.db dir (default ./data)
//   HUB_SECRET              escape-hatch token; the token store is primary
//   HUB_INSECURE_HTTP       if '1', allow plaintext HTTP to a public host (testing)
//   HUB_PUBLIC_URL          base URL printed in admin / bootstrap logs
//   HUB_ADMIN_RATE_LIMIT    'off' disables the per-IP rate limiter (dev only)
//
// Auth: the SQLite token store (tokens.db, HMAC-SHA256 at rest — Task 6) is
// checked first; HUB_SECRET is a fallback for headless / scripted setups. With
// NEITHER configured the hub runs in permissive dev mode and warns on every
// connect. Connections are rate-limited to 100 auths/min per token; the hub
// refuses to boot over plaintext HTTP to a non-loopback host (TLS upstream).
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
  rotateAdminSecret,
  verifyAdminAuth,
  writeAdminSecret,
} from './admin-auth.mjs';
import { handleAssetRoute } from './assets.mjs';
import {
  handleAuthRoutes,
  handleUserAdminRoutes,
  permissiveDevAuthDisabled,
} from './auth-routes.mjs';
import { scheduleBackups, targetFromEnv } from './backup.mjs';
import { maybeIssueOnBoot, verifyAndConsume } from './bootstrap.mjs';
import { clientIpFor, parseTrustedProxies } from './client-ip.mjs';
import { groupCanvases } from './doc-namespace.mjs';
import { createRateStore } from './rate-store.mjs';
import { s3ConfigFromEnv } from './s3.mjs';
import { readSettings, writeSettings } from './settings.mjs';
import {
  addToken,
  assertValidLabel,
  listTokenLabels,
  matchesScope,
  readTokens,
  recordTokenUse,
  removeToken,
  rotateToken,
  verifyToken,
} from './tokens.mjs';

const HUB_VERSION = readOwnVersion();
const DOCUMENT_NAME_REGEX = /^[A-Za-z0-9._/-]{1,256}$/;
const PUBLIC_URL_REGEX = /^https?:\/\/[^\s;'"<>`]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
// DDR-102 rate-limit redesign. The original single 100/min-per-label bucket
// was an anti-brute-force control, but it throttled VALID tokens: under WS
// multiplexing the hub still authenticates once per DOCUMENT, so two peers
// booting an 83-canvas project burst ~166 valid auths and pinned the bucket
// forever (the 2026-06-11 permission-denied storm). Brute force is about
// INVALID attempts — so the buckets split:
//   - valid-token auths: per label, generous (default 600/min, env
//     HUB_CONN_RATE_LIMIT) — legitimate peers can't starve sync.
//   - invalid-token attempts: per IP, tight (100/min) — the brute-force
//     control the old bucket was meant to be.
export const CONN_RATE_LIMIT_MAX = 600;
export const INVALID_CONN_RATE_LIMIT_MAX = 100;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
// Activity feed (admin console): bounded in-memory ring buffer. Ephemeral —
// lost on restart, NOT a persisted audit trail (DDR-097). Caps memory.
export const ACTIVITY_CAP = 200;

/**
 * @typedef {Object} HubConfig
 * @property {number} [port]
 * @property {string} [dataDir]
 * @property {string} [secret]
 * @property {string} [publicUrl]
 * @property {boolean} [insecureHttp]  allow plaintext HTTP to a public host (testing only)
 * @property {boolean} [verbose]
 * @property {boolean} [rateLimit]  default true; set false in tests/dev
 * @property {number} [connRateLimit]  valid-token auths per label per minute (default CONN_RATE_LIMIT_MAX; env HUB_CONN_RATE_LIMIT)
 */

/**
 * DDR-102 — build an auth-rejection error whose REASON crosses the wire.
 * Hocuspocus' connection handler propagates `error.reason ?? 'permission-denied'`
 * to the peer's onAuthenticationFailed — a plain `new Error(message)` carries
 * no `.reason`, so peers used to see only the generic fallback (the incident's
 * RC4: the client hint pointed at scopes while the real cause was the rate
 * limit). Old peers ignore the richer reason — interop-safe.
 *
 * @param {string} reason
 * @returns {Error & { reason: string }}
 */
function authError(reason) {
  const err = /** @type {Error & { reason: string }} */ (new Error(reason));
  err.reason = reason;
  return err;
}

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
  const insecureHttp = config.insecureHttp ?? false;
  // DDR-102 — valid-token auth ceiling (per label per minute).
  const connRateLimitMax = config.connRateLimit ?? CONN_RATE_LIMIT_MAX;
  const startedAt = Date.now();

  // DDR-053 §5: refuse to boot if publicUrl can be weaponized into shell
  // injection on operators who copy-paste from the admin UI.
  if (!PUBLIC_URL_REGEX.test(publicUrl)) {
    throw new Error(
      `invalid publicUrl: ${JSON.stringify(publicUrl)} — must match ${PUBLIC_URL_REGEX}`
    );
  }

  // Task 6 (transport hardening): refuse to serve a PUBLIC hub over plaintext
  // HTTP. TLS terminates upstream (Fly auto-cert / Caddy ACME / Cloudflare /
  // Tailscale Funnel) so the hub itself sees http://, but HUB_PUBLIC_URL must
  // declare https:// for any non-loopback host. Loopback (local dev) is exempt;
  // HUB_INSECURE_HTTP=1 overrides for explicit non-TLS testing.
  if (!insecureHttp) {
    const u = new URL(publicUrl);
    if (u.protocol === 'http:' && !LOOPBACK_HOSTS.has(u.hostname)) {
      throw new Error(
        `refusing to serve a public hub over plaintext HTTP (publicUrl=${publicUrl}). Set HUB_PUBLIC_URL to an https:// URL (TLS terminates at your proxy), or set HUB_INSECURE_HTTP=1 for local-only testing.`
      );
    }
  }

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const sqlitePath = join(dataDir, 'hub.db');

  /** @type {Map<string, { socketId: string, documentName: string, user: string, connectedAt: number, connection: any }>} */
  const peers = new Map();

  // Cloud Phase 2 Task 2 — trusted proxies. Empty by default, which keeps the
  // DDR-053 §6 stance ("X-Forwarded-For is not trusted") byte-for-byte intact
  // for anyone who does not opt in.
  const trustedProxies = parseTrustedProxies(process.env.HUB_TRUSTED_PROXIES);
  if (trustedProxies.length > 0 && verbose) {
    console.warn(
      `[hub] trusting X-Forwarded-For from ${trustedProxies.length} configured proxy range(s)`
    );
  }
  /** The address a rate-limit bucket is keyed by (see client-ip.mjs). */
  const clientIp = (request) => clientIpFor(request, trustedProxies);

  // Persistent sliding-window limiter. In-memory buckets reset on restart,
  // which made "crash the hub, keep guessing" a free counter reset.
  const rateStore = createRateStore(dataDir);

  // Cloud Phase 2 Task 3 — scheduled doc-store backups. No destination
  // configured ⇒ no backups, and that is a quiet no-op rather than a boot
  // failure: a laptop hub genuinely does not need one. Verify with
  // `maude hub restore-drill` — a backup nobody has restored is a hypothesis.
  // The bucket the asset proxy reads from. Same env set as backups — one
  // storage configuration per hub, not two.
  const assetStore = s3ConfigFromEnv();
  const backupTarget = targetFromEnv();
  const backupIntervalMs = Number(process.env.MAUDE_BACKUP_INTERVAL_MS ?? 6 * 3600_000);
  const stopBackups = scheduleBackups({
    dataDir,
    target: backupTarget,
    intervalMs: backupTarget ? backupIntervalMs : 0,
  });
  if (backupTarget) {
    console.log(
      `[hub] backups → ${backupTarget.describe} every ${Math.round(backupIntervalMs / 60000)} min`
    );
  }

  /** Per-IP rate limit buckets (admin API): ip → { count, windowStart } */
  const rateBuckets = new Map();

  /** Per-token rate limit buckets (valid WS auth): label → { count, windowStart } */
  const connBuckets = new Map();

  /** Activity feed ring buffer (newest last). Bounded to ACTIVITY_CAP. */
  const activity = [];

  const server = new Server({
    port,

    extensions: [new SQLite({ database: sqlitePath })],

    async onAuthenticate({ token, documentName, request }) {
      // DDR-053 §5: defend against log forging + future XSS regression by
      // rejecting documentNames with HTML / log metacharacters at source.
      // DDR-102: every rejection goes through authError() so the SPECIFIC
      // reason reaches the peer's onAuthenticationFailed (Hocuspocus sends
      // `error.reason ?? 'permission-denied'` — a bare Error message is lost).
      if (!DOCUMENT_NAME_REGEX.test(documentName ?? '')) {
        throw authError('invalid documentName');
      }
      const match = verifyToken(dataDir, token, secret);
      if (match) {
        // DDR-053 §3: scope binding gates Chain B (token leak → full hub).
        if (!matchesScope(match.scope, documentName)) {
          throw authError('token not authorized for this documentName');
        }
        // DDR-102 — valid-token ceiling: generous (default 600/min per label),
        // sized so multi-peer boot bursts of large projects (auth fires once
        // per DOCUMENT even on a multiplexed socket) never starve sync. The
        // anti-brute-force control moved to the invalid-attempt bucket below.
        if (rateLimit && !checkConnRateLimit(connBuckets, match.label, connRateLimitMax)) {
          if (verbose) {
            const bucket = connBuckets.get(match.label);
            console.warn(
              `[hub] rate limit exceeded for token label=${sanitizeForLog(match.label)} ` +
                `(valid bucket: ${bucket?.count ?? '?'}/${connRateLimitMax} per 60s)`
            );
          }
          throw authError('rate limit exceeded for this token — retry in up to 60s');
        }
        if (match.source === 'file') recordTokenUse(dataDir, match.label);
        return {
          user: {
            name: match.label,
            source: match.source,
            dev: !!match.dev,
            scope: match.scope ?? '*',
          },
        };
      }
      // No tokens configured and no HUB_SECRET → permissive dev mode.
      //
      // Cloud Phase 2 — this path is off the moment the hub has ANY user, or
      // when the operator declares workspace mode. On a scratch hub it is a
      // convenience; on a hub with real accounts it would let an
      // unauthenticated stranger read and write every document, which is
      // strictly worse than refusing to start.
      const { tokens } = readTokens(dataDir);
      if (tokens.length === 0 && secret === '' && !permissiveDevAuthDisabled(dataDir)) {
        if (verbose) {
          console.warn(
            `[hub] no tokens configured; accepting any token for documentName=${sanitizeForLog(documentName)}`
          );
        }
        return { user: { name: 'anon', anon: true } };
      }
      // DDR-102 — invalid-token attempts are the brute-force surface: tight
      // per-IP bucket (100/min). The old design never rate-limited these at
      // all (the label bucket only ever counted VALID tokens).
      // Resolve through the trusted-proxy chain so a hub behind Caddy buckets
      // attackers individually instead of collapsing them into the proxy's IP.
      const ip = clientIp(request);
      if (
        rateLimit &&
        !rateStore.check(`auth:${ip}`, INVALID_CONN_RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)
      ) {
        if (verbose) {
          console.warn(
            `[hub] invalid-token attempt rate limit exceeded for ip=${sanitizeForLog(ip)} ` +
              `(ceiling ${INVALID_CONN_RATE_LIMIT_MAX} per 60s, persisted across restarts)`
          );
        }
        throw authError('rate limit exceeded — retry in up to 60s');
      }
      throw authError('invalid token');
    },

    async onRequest({ request, response }) {
      if (!request.url) return;
      const url = request.url;
      const method = request.method ?? 'GET';

      if (method === 'GET' && (url === '/health' || url.startsWith('/health?'))) {
        // /health is UNAUTHENTICATED and internet-reachable on a deploy (the
        // fly.toml + compose health check + `maude hub status` all hit it).
        // Omit `dataDir` (a server filesystem path) from the public payload —
        // it's a recon over-share. The authenticated /admin/api/status keeps
        // the full payload (operator already has admin access there).
        respondJson(
          response,
          200,
          buildStatusPayload({
            dataDir,
            secret,
            port,
            startedAt,
            peersCount: peers.size,
            exposeDataDir: false,
          })
        );
        bailFromOnRequest();
      }
      if (method === 'GET' && (url === '/' || url === '' || url.startsWith('/?'))) {
        // Minimal landing — replaces Hocuspocus' default "Welcome to Hocuspocus!"
        // with a sensible signpost into the admin console. Self-hosted operator
        // surface, deliberately NOT a marketing page (DDR-097). Server-rendered
        // with the hub name; links the admin stylesheet (no inline styles — the
        // admin CSP `style-src 'self'` would drop them).
        respondAsset(
          response,
          renderLanding(readSettings(dataDir).name),
          'text/html; charset=utf-8',
          {
            hardenAdminOrigin: true,
          }
        );
        bailFromOnRequest();
      }
      // Cloud Phase 2 — human sign-in. /auth/login is unauthenticated (and
      // rate-limited on the same bucket as /admin/api/bootstrap); /auth/logout
      // and /auth/session authenticate with the peer token they concern.
      // Match on the pathname, not the raw URL: an exact-equality check would
      // silently fall through on `/auth/login?next=…` and land the request in
      // the Hocuspocus catch-all.
      const authPath = url.split('?')[0];

      // Cloud Phase 3 — authenticated asset proxy. Peer-token gated, GET/HEAD
      // only, and reachable ONLY for content-addressed keys. Never a presigned
      // URL: the canvas CSP is `img-src 'self'` and a presigned URL would be a
      // bearer credential living inside tenant-authored content.
      if (authPath.startsWith('/assets/')) {
        const handled = await handleAssetRoute({
          request,
          response,
          pathname: authPath,
          method,
          dataDir,
          secret,
          s3: assetStore,
          checkRateLimit: rateLimit
            ? (req) => checkRateLimit(rateBuckets, req, { store: rateStore, ip: clientIp(req) })
            : undefined,
        });
        if (handled) bailFromOnRequest();
      }
      if (
        authPath === '/auth/login' ||
        authPath === '/auth/logout' ||
        authPath === '/auth/session'
      ) {
        const handled = await handleAuthRoutes({
          request,
          response,
          path: authPath,
          method,
          dataDir,
          secret,
          checkRateLimit: rateLimit
            ? (req) => checkRateLimit(rateBuckets, req, { store: rateStore, ip: clientIp(req) })
            : undefined,
          respondRateLimited: () => respondRateLimited(response),
          respondJson: (status, payload) => respondAdminJson(response, status, payload),
          readJsonBody,
          kickLabel: (label) => kickSessionsForLabel(peers, label),
          pushActivity: (evt) => pushActivity(activity, evt),
        });
        if (handled) bailFromOnRequest();
      }

      if (url === '/admin' || url.startsWith('/admin?')) {
        respondAsset(response, ADMIN_HTML, 'text/html; charset=utf-8', { hardenAdminOrigin: true });
        bailFromOnRequest();
      }
      if (url === '/admin/') {
        // RELATIVE redirect (not '/admin') so it survives a path-stripping
        // reverse proxy: the browser is at <prefix>/admin/ and resolves
        // '../admin' against it → <prefix>/admin, preserving the mount prefix.
        // An absolute '/admin' would drop the prefix and 404 on the proxy.
        response.writeHead(301, { Location: '../admin' });
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
          rateStore,
          clientIp,
          rateLimit,
          activity,
          sqlitePath,
          insecureHttp,
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
        scope: null,
        connectedAt: Date.now(),
        connection: null,
      });
      if (verbose) {
        console.log(
          `[hub] connect documentName=${sanitizeForLog(documentName)} user=${sanitizeForLog(user)}`
        );
      }
    },
    // Note: the join activity event is emitted from the `connected` hook below,
    // not here — onConnect fires BEFORE onAuthenticate, so context.user is still
    // 'anon'. By `connected` the real label is known (same reason peers.user is
    // patched there for kickSessionsForLabel — DDR-053 §4).
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
      if (context?.user?.scope) entry.scope = context.user.scope;
      pushActivity(activity, {
        type: 'join',
        user: entry.user,
        doc: entry.documentName,
      });
    },
    async onDisconnect({ documentName, socketId, context }) {
      const user = context?.user?.name ?? 'anon';
      peers.delete(socketId);
      pushActivity(activity, { type: 'leave', user, doc: documentName });
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
    activity,
    backupTarget,
    /** Stop the backup schedule + close the rate store. Tests call this; the
     *  process exiting does the same thing in production. */
    stopBackgroundWork() {
      stopBackups();
      rateStore.close();
    },
  };
}

// ----------------------------------------------------------------- /admin API

async function handleAdminApi(ctx) {
  const { request, response, dataDir, secret, peers, publicUrl, rateBuckets, rateLimit } = ctx;
  const { rateStore, clientIp } = ctx;
  const rateOpts = { store: rateStore, ip: clientIp?.(request) };
  const { activity, sqlitePath } = ctx;
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
    if (rateLimit && !checkRateLimit(rateBuckets, request, rateOpts)) {
      respondRateLimited(response);
      return;
    }
    return handleBootstrap({ request, response, dataDir });
  }

  if (!verifyAdminAuth(request, { hubSecret: secret, dataDir })) {
    // Consume budget on 401s — burst of wrong-auth → 429 (limits brute force).
    if (rateLimit && !checkRateLimit(rateBuckets, request, rateOpts)) {
      respondRateLimited(response);
      return;
    }
    respondAdminJson(response, 401, { error: 'unauthorized' });
    return;
  }

  // ---- everything below is ADMIN-BEARER-AUTHENTICATED ----

  // Cloud Phase 2 — user administration. Reached only past the Bearer gate
  // above; there is deliberately no path from a user password to this surface.
  if (path === '/users' || path.startsWith('/users/')) {
    const handled = await handleUserAdminRoutes({
      request,
      response,
      path,
      method,
      dataDir,
      respondJson: (status, payload) => respondAdminJson(response, status, payload),
      readJsonBody,
      kickLabel: (label) => kickSessionsForLabel(peers, label),
      pushActivity: (evt) => pushActivity(activity, evt),
    });
    if (handled) return;
    respondAdminJson(response, 404, { error: 'not found' });
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
        scope: p.scope ?? null,
        connectedAt: p.connectedAt,
      })),
    });
    return;
  }
  // Kick a single live peer by socketId (per-connection disconnect). Distinct
  // from rotate (which kicks every session for a token label). DDR-053 §4.
  if (method === 'POST' && path === '/peers/kick') {
    try {
      const body = await readJsonBody(request);
      const socketId = String(body?.socketId ?? '');
      const peer = peers.get(socketId);
      if (!peer) {
        respondAdminJson(response, 404, { error: 'no such peer' });
        return;
      }
      try {
        peer.connection?.close?.();
      } catch {
        /* best-effort */
      }
      peers.delete(socketId);
      pushActivity(activity, {
        type: 'warn',
        user: peer.user,
        doc: `kicked from ${peer.documentName}`,
      });
      respondAdminJson(response, 200, { ok: true });
    } catch (err) {
      respondAdminJson(response, 400, { error: err.message });
    }
    return;
  }
  // Canvases browser — read the Hocuspocus SQLite `documents` table read-only.
  // `canvases` stays a flat list (unchanged wire shape for existing admin
  // clients); `groups` adds the DDR-192 §5 workspace/branch grouping. Legacy
  // flat slugs are not hidden — they collect in one `legacy: true` group, so a
  // hub mid-rollout shows both kinds at once instead of appearing to lose docs.
  if (method === 'GET' && path === '/canvases') {
    const canvases = listCanvases(sqlitePath, peers);
    respondAdminJson(response, 200, { canvases, groups: groupCanvases(canvases) });
    return;
  }
  // Activity feed — newest-first slice of the in-memory ring buffer.
  if (method === 'GET' && path === '/activity') {
    respondAdminJson(response, 200, { activity: (activity ?? []).slice().reverse() });
    return;
  }
  // Settings — GET reads identity + persisted name/description; POST persists
  // the editable bits (name/description) atomically.
  if (method === 'GET' && path === '/settings') {
    const stored = readSettings(dataDir);
    const { tokens } = readTokens(dataDir);
    respondAdminJson(response, 200, {
      name: stored.name,
      description: stored.description,
      publicUrl,
      transport: ctx.insecureHttp ? 'plaintext HTTP (dev)' : 'TLS upstream',
      dataDir,
      authMode: tokens.length > 0 ? 'tokens' : secret ? 'env-secret' : 'dev',
      version: HUB_VERSION,
    });
    return;
  }
  if (method === 'POST' && path === '/settings') {
    try {
      const body = await readJsonBody(request);
      const saved = writeSettings(dataDir, { name: body?.name, description: body?.description });
      respondAdminJson(response, 200, { ok: true, ...saved });
    } catch (err) {
      respondAdminJson(response, 400, { error: err.message });
    }
    return;
  }
  // Danger zone — rotate the admin secret (signs every device out). High blast
  // radius: the new value is NOT returned (operator re-claims via bootstrap /
  // HUB_SECRET). DDR-097.
  if (method === 'POST' && path === '/admin-secret/rotate') {
    try {
      // Body is unused, but route it through readJsonBody for the same
      // Content-Type + proto-pollution guard the other POST routes get
      // (defense-in-depth consistency — DDR-053 §5).
      await readJsonBody(request);
    } catch (err) {
      respondAdminJson(response, 400, { error: err.message });
      return;
    }
    rotateAdminSecret(dataDir);
    pushActivity(activity, { type: 'warn', user: 'admin', doc: 'admin secret rotated' });
    respondAdminJson(response, 200, { ok: true, reauth: true });
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
      pushActivity(activity, {
        type: 'token',
        user: label,
        doc: `invite issued · scope ${record.scope ?? '*'}`,
      });
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
      pushActivity(activity, {
        type: 'warn',
        user: label,
        doc: `token rotated — ${disconnected} session${disconnected === 1 ? '' : 's'} kicked`,
      });
      respondAdminJson(response, 200, { ...formatInviteResponse(record, publicUrl), disconnected });
    } catch (err) {
      const status = err.message.startsWith('no token') ? 404 : 400;
      respondAdminJson(response, status, { error: err.message });
    }
    return;
  }
  if (method === 'POST' && path === '/token/delete') {
    try {
      const body = await readJsonBody(request);
      const label = String(body?.label ?? '').trim();
      assertValidLabel(label);
      removeToken(dataDir, label);
      // Kick live sessions that authenticated with the deleted token (DDR-053 §4).
      const disconnected = kickSessionsForLabel(peers, label);
      pushActivity(activity, {
        type: 'warn',
        user: label,
        doc: `token deleted — ${disconnected} session${disconnected === 1 ? '' : 's'} kicked`,
      });
      respondAdminJson(response, 200, { ok: true, disconnected });
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

/** Escape HTML metacharacters for safe interpolation into server-rendered HTML. */
function escapeHtmlAttr(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * Minimal landing page served at `/`. Links the admin stylesheet + reuses its
 * classes (no inline styles — the CSP `style-src 'self'` drops those). The
 * sparkle uses presentation attributes (fill=), which the CSP allows.
 */
function renderLanding(hubName) {
  const name = escapeHtmlAttr(hubName || 'Studio Hub');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${name}</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZD0iTTcgMEgyNUE3IDcgMCAwIDEgMzIgN1YzMkg3QTcgNyAwIDAgMSAwIDI1VjdBNyA3IDAgMCAxIDcgMFoiIGZpbGw9IiM2ZDVlZjUiLz48cGF0aCBkPSJNMTYgNWwyLjggOC4yTDI3IDE2bC04LjIgMi44TDE2IDI3bC0yLjgtOC4yTDUgMTZsOC4yLTIuOHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=">
  <link rel="stylesheet" href="admin/style.css">
</head>
<body>
<div class="maude landing dotted">
  <div class="landing-card">
    <span class="mark mark--lg" aria-hidden="true"><svg class="mark-ic" viewBox="0 0 32 32" fill="currentColor"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z"/></svg></span>
    <h1>${name}</h1>
    <p class="landing-sub">self-hosted sync · Yjs + Hocuspocus</p>
    <p class="landing-status"><span class="presence-dot presence-dot--online" aria-hidden="true"></span> online</p>
    <a class="btn btn--primary btn--lg" href="admin">Open admin console →</a>
  </div>
</div>
</body>
</html>`;
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

function buildStatusPayload({
  dataDir,
  secret,
  port,
  startedAt,
  peersCount,
  exposeDataDir = true,
}) {
  const { tokens } = readTokens(dataDir);
  return {
    ok: true,
    version: HUB_VERSION,
    uptimeMs: Date.now() - startedAt,
    port,
    // `dataDir` is a server filesystem path — only included for authenticated
    // callers (/admin/api/status). The unauthenticated /health omits it.
    ...(exposeDataDir ? { dataDir } : {}),
    tokenCount: tokens.length,
    authMode: tokens.length > 0 ? 'tokens' : secret ? 'env-secret' : 'dev',
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

// --------------------------------------------------------- activity feed

/**
 * Append an event to the bounded ring buffer (DDR-097). Fields are run through
 * the log sanitizer + clamped so a hostile documentName / label can't inflate
 * the buffer or smuggle control chars into the console feed. NEVER pass a token
 * VALUE here — only labels / doc names / human-readable summaries.
 */
function pushActivity(activity, { type, user, doc }) {
  if (!Array.isArray(activity)) return;
  activity.push({
    type: String(type),
    user: sanitizeForLog(user).slice(0, 120),
    doc: sanitizeForLog(doc).slice(0, 200),
    at: Date.now(),
  });
  while (activity.length > ACTIVITY_CAP) activity.shift();
}

// --------------------------------------------------------- canvases browser

const sqliteRequire = createRequire(import.meta.url);
/** Lazily resolve better-sqlite3 (a runtime-external native binding). */
let BetterSqlite3 = null;
function loadSqlite() {
  if (BetterSqlite3 === null) {
    try {
      BetterSqlite3 = sqliteRequire('better-sqlite3');
    } catch {
      BetterSqlite3 = false;
    }
  }
  return BetterSqlite3 || null;
}

/** Build the peer-count-per-document map from the live peers Map. */
function peerCountsByDoc(peers) {
  const counts = new Map();
  for (const p of peers.values()) {
    counts.set(p.documentName, (counts.get(p.documentName) ?? 0) + 1);
  }
  return counts;
}

function docsFromPeers(peerCounts) {
  return Array.from(peerCounts.entries()).map(([name, count]) => ({
    name,
    bytes: 0,
    peers: count,
  }));
}

/**
 * Read the Hocuspocus SQLite `documents` table READ-ONLY and join the live peer
 * count per document. The extension schema is:
 *   CREATE TABLE "documents" ("name" varchar, "data" blob, UNIQUE(name))
 * There are NO timestamp columns — size is `length(data)`; activity is the
 * joined live peer count (DDR-097). Defensive: never mutates, never 500s — a
 * missing table (no syncs yet) / lock / schema drift falls back to the
 * peer-derived view.
 */
function listCanvases(sqlitePath, peers) {
  const peerCounts = peerCountsByDoc(peers);
  if (!sqlitePath || !existsSync(sqlitePath)) return docsFromPeers(peerCounts);
  const Database = loadSqlite();
  if (!Database) return docsFromPeers(peerCounts);

  let db;
  try {
    db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
    const rows = db.prepare('SELECT name, length(data) AS bytes FROM "documents"').all();
    // Union persisted docs (with size) with currently-active peer docs that
    // may not be persisted yet (size 0 until the extension stores them). This
    // keeps a live-but-unsaved canvas visible. Keyed by name; sorted by name.
    const byName = new Map();
    for (const r of rows) {
      const name = String(r.name);
      // Enforce the documentName charset at the READ boundary too — onAuthenticate
      // gates live WS auth, but rows could predate that guard (upgrade) or arrive
      // via another write path. Don't surface a name that isn't regex-clean into
      // the admin DOM (defense-in-depth alongside client escaping).
      if (!DOCUMENT_NAME_REGEX.test(name)) continue;
      byName.set(name, {
        name,
        bytes: typeof r.bytes === 'number' ? r.bytes : 0,
        peers: peerCounts.get(name) ?? 0,
      });
    }
    for (const [name, count] of peerCounts) {
      if (!byName.has(name)) byName.set(name, { name, bytes: 0, peers: count });
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return docsFromPeers(peerCounts);
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

// ----------------------------------------------------------- rate limiter

/**
 * Per-IP token bucket. Returns true when the request is within budget.
 * Per DDR-053 §6 — in-memory only (single-process hub), 5 req / 60s.
 *
 * X-Forwarded-For intentionally not trusted in v1.1 — operators behind a
 * proper reverse proxy get accurate buckets in Task 6 when trustProxy lands.
 */
function checkRateLimit(buckets, request, { store = null, ip: resolvedIp } = {}) {
  const ip = resolvedIp ?? request.socket?.remoteAddress ?? '0.0.0.0';
  // When a persistent store is wired, it IS the limiter — the in-memory bucket
  // below stays only as the fallback path (and for the pure-unit tests that
  // call this without a store).
  if (store) return store.check(`http:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
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

/**
 * Connection-auth rate limit (Task 6, redesigned in DDR-102). Returns true
 * when the key is within budget (`max` auths per 60s window). Keyed by token
 * LABEL for valid auths (default ceiling CONN_RATE_LIMIT_MAX, generous) and
 * by IP for invalid attempts (INVALID_CONN_RATE_LIMIT_MAX, tight).
 * Exported for unit testing — the production caller is onAuthenticate.
 */
export function checkConnRateLimit(buckets, key, max = CONN_RATE_LIMIT_MAX) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
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
  // DDR-102 — valid-token auth ceiling override (per label per minute).
  const connRateLimitEnv = Number.parseInt(process.env.HUB_CONN_RATE_LIMIT ?? '', 10);
  const connRateLimit = Number.isFinite(connRateLimitEnv) ? connRateLimitEnv : undefined;

  let built;
  try {
    built = createHub({ port, dataDir, secret, publicUrl, rateLimit, insecureHttp, connRateLimit });
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
      '[hub] admin assets missing — /admin will serve empty page. Run `bun run build` in apps/hub.'
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
    const { tokens } = readTokens(dataDir);
    if (tokens.length === 0 && secret === '') {
      console.warn(
        '[hub] Hub unclaimed window closed (prior bootstrap consumed or expired). Restart with HUB_SECRET=<value> to set admin.'
      );
    }
  }

  const { tokens } = readTokens(dataDir);
  if (tokens.length === 0 && secret === '') {
    console.warn(
      '[hub] no tokens configured — running in permissive dev mode. Do NOT expose to the internet.'
    );
  } else if (tokens.length > 0) {
    console.log(`[hub] token store contains ${tokens.length} token(s).`);
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
