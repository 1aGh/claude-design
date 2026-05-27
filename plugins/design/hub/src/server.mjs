#!/usr/bin/env node
// Maude Hub — self-hostable Yjs sync backend.
//
// Phase 9 (v1.1) Task 1 skeleton. Hocuspocus over PartyKit — see
// .ai/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md.
//
// Environment (consumed only when run as a CLI / main module):
//   PORT              listen port (default 1234)
//   DATA_DIR          SQLite + future state dir (default ./data)
//   HUB_SECRET        shared bearer token; if unset → permissive dev mode
//   HUB_INSECURE_HTTP if '1', logs note non-TLS (TLS terminates upstream)
//
// Auth is a Task 1 stub — exact-match against HUB_SECRET when set, else
// accept-and-warn. Phase 9 Task 6 hardens this with HMAC + rate limit and
// per-token records in a `tokens` SQLite table.
//
// The published binary is dist/hub.bundle.mjs (bun build). For local dev:
//   node plugins/design/hub/src/server.mjs

import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Server } from '@hocuspocus/server';
import { SQLite } from '@hocuspocus/extension-sqlite';

/**
 * @typedef {Object} HubConfig
 * @property {number} [port]          Listen port (default 1234).
 * @property {string} [dataDir]       Directory for hub.db (default ./data).
 * @property {string} [secret]        Shared bearer token. Empty → dev mode.
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

  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const sqlitePath = join(dataDir, 'hub.db');

  const server = new Server({
    port,

    extensions: [
      new SQLite({ database: sqlitePath }),
    ],

    // Task 1 auth stub. Two modes:
    //   1. secret === ''   → accept any token, label peer 'anon' (dev only).
    //   2. secret set      → exact match against the configured value.
    // Phase 9 Task 6 replaces this with HMAC-SHA256 against per-token rows.
    async onAuthenticate({ token, documentName }) {
      if (secret === '') {
        if (verbose) console.warn(`[hub] secret unset; accepting any token for documentName=${documentName}`);
        return { user: { name: 'anon', anon: true } };
      }
      if (token !== secret) {
        throw new Error('invalid token');
      }
      return { user: { name: 'authed' } };
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

  return { server, sqlitePath, port, secret };
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
  console.log(`[hub] Maude Hub listening on ${scheme}://0.0.0.0:${port}`);
  console.log(`[hub] SQLite at ${sqlitePath}`);
  if (secret === '') {
    console.warn('[hub] HUB_SECRET unset — running in permissive dev mode. Do NOT expose to the internet.');
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

// Auto-start only when invoked directly (`node src/server.mjs` or the bundled
// dist/hub.bundle.mjs). Tests import { createHub } and drive the lifecycle
// themselves.
const invokedAsMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedAsMain) {
  await runAsMain();
}
