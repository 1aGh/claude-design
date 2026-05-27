// Phase 9 Task 1 acceptance smoke: hub boots; two HocuspocusProvider clients
// connect to the same documentName; mutation on A converges on B.
//
// Runs under `node --test`. Hub is Node-only at runtime — Hocuspocus' crossws
// adapter rejects Bun/Deno, and @hocuspocus/extension-sqlite uses
// better-sqlite3 which isn't Bun-compatible (Bun#4290). This is the bundling
// boundary line: `bun build.ts` bundles fine (it never runs the code),
// `bun test` does not.

import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { createHub } from '../src/server.mjs';

const PORT = Number.parseInt(process.env.HUB_TEST_PORT ?? '14391', 10);
const DOC_NAME = 'projects/test/canvases/screen';

let hub;
let dataDir;

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'maude-hub-test-'));
  const built = createHub({ port: PORT, dataDir, secret: '', verbose: false });
  hub = built.server;
  await hub.listen();
});

afterEach(async () => {
  if (hub) await hub.destroy();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

test('two providers on the same documentName converge on a Y.Text mutation', async () => {
  const docA = new Y.Doc();
  const docB = new Y.Doc();

  const providerA = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: DOC_NAME,
    token: 'dev',
    document: docA,
    connect: true,
  });
  const providerB = new HocuspocusProvider({
    url: `ws://127.0.0.1:${PORT}`,
    name: DOC_NAME,
    token: 'dev',
    document: docB,
    connect: true,
  });

  await Promise.all([
    new Promise((res) => providerA.on('synced', () => res())),
    new Promise((res) => providerB.on('synced', () => res())),
  ]);

  docA.getText('content').insert(0, 'hello from A');

  const start = Date.now();
  let observed = '';
  while (Date.now() - start < 3000) {
    observed = docB.getText('content').toString();
    if (observed === 'hello from A') break;
    await new Promise((r) => setTimeout(r, 25));
  }

  providerA.destroy();
  providerB.destroy();

  assert.equal(observed, 'hello from A');
});
