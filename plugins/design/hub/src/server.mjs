#!/usr/bin/env node
// Maude Hub — self-hostable Yjs sync backend.
//
// Phase 9 (v1.1). Hocuspocus over PartyKit — see
// .ai/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md.
//
// Environment (consumed only when run as a CLI / main module):
//   PORT              listen port (default 1234)
//   DATA_DIR          SQLite + tokens.json dir (default ./data)
//   HUB_SECRET        escape-hatch token; tokens.json is the primary store
//   HUB_INSECURE_HTTP if '1', logs note non-TLS (TLS terminates upstream)
//
// Auth: tokens.json next to hub.db is checked first; HUB_SECRET is a fallback
// for headless / scripted setups. With NEITHER configured the hub runs in
// permissive dev mode and prints a warning on every connect. Phase 9 Task 6
// hardens this with HMAC-SHA256 stored in SQLite + per-token rate limit.

import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { Server } from '@hocuspocus/server';
import { SQLite } from '@hocuspocus/extension-sqlite';

import { readTokensFile, verifyToken } from './tokens.mjs';

const HUB_VERSION = readOwnVersion();

/**
 * @typedef {Object} HubConfig
 * @property {number} [port]          Listen port (default 1234).
 * @property {string} [dataDir]       Directory for hub.db + tokens.json (default ./data).
 * @property {string} [secret]        Optional HUB_SECRET escape hatch.
 * @property {boolean} [insecureHttp] Cosmetic — logs `http://` instead of `ws://`.
 * @property {boolean} [verbose]      Log lifecycle hooks. Default true.
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
  const verbose = config.verbose ?? true;
  const startedAt = Date.now();

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const sqlitePath = join(dataDir, 'hub.db');

  const server = new Server({
    port,

    extensions: [
      new SQLite({ database: sqlitePath }),
    ],

    async onAuthenticate({ token, documentName }) {
      const match = verifyToken(dataDir, token, secret);
      if (match) {
        return { user: { name: match.label, source: match.source, dev: !!match.dev } };
      }
      // No tokens.json entries and no HUB_SECRET → permissive dev mode.
      const { tokens } = readTokensFile(dataDir);
      if (tokens.length === 0 && secret === '') {
        if (verbose) console.warn(`[hub] no tokens configured; accepting any token for documentName=${documentName}`);
        return { user: { name: 'anon', anon: true } };
      }
      throw new Error('invalid token');
    },

    async onRequest({ request, response }) {
      if (!request.url) return;
      if (request.method === 'GET' && (request.url === '/health' || request.url.startsWith('/health?'))) {
        const { tokens } = readTokensFile(dataDir);
        const body = JSON.stringify({
          ok: true,
          version: HUB_VERSION,
          uptimeMs: Date.now() - startedAt,
          port,
          dataDir,
          tokenCount: tokens.length,
          authMode: tokens.length > 0 ? 'tokens.json' : (secret ? 'env-secret' : 'dev'),
        });
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        });
        response.end(body);
        // Short-circuit Hocuspocus' default `200 Welcome to Hocuspocus!` writer.
        // Its requestHandler swallows falsy throws ("if (error) throw error;")
        // — this is the framework's documented bail-from-onRequest contract.
        // eslint-disable-next-line no-throw-literal
        throw null;
      }
      // Fall through — Hocuspocus' default handler responds to unknown routes.
    },

    async onConnect({ documentName }) {
      if (verbose) console.log(`[hub] connect documentName=${documentName}`);
    },
    async onDisconnect({ documentName }) {
      if (verbose) console.log(`[hub] disconnect documentName=${documentName}`);
    },
    async onLoadDocument({ documentName }) {
      if (verbose) console.log(`[hub] load documentName=${documentName}`);
    },
  });

  return { server, sqlitePath, port, secret, dataDir, startedAt, version: HUB_VERSION };
}

/** Run the hub as a CLI process. */
async function runAsMain() {
  const port = Number.parseInt(process.env.PORT ?? '1234', 10);
  const dataDir = process.env.DATA_DIR ?? resolve(process.cwd(), 'data');
  const secret = process.env.HUB_SECRET ?? '';
  const insecureHttp = process.env.HUB_INSECURE_HTTP === '1';

  const { server, sqlitePath } = createHub({ port, dataDir, secret });

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

  const { tokens } = readTokensFile(dataDir);
  if (tokens.length === 0 && secret === '') {
    console.warn('[hub] no tokens configured — running in permissive dev mode. Do NOT expose to the internet.');
  } else if (tokens.length > 0) {
    console.log(`[hub] tokens.json contains ${tokens.length} token(s).`);
  } else {
    console.log('[hub] HUB_SECRET is set — accepting that single token.');
  }

  const shutdown = (signal) => {
    console.log(`[hub] ${signal} received, shutting down`);
    server.destroy()
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
