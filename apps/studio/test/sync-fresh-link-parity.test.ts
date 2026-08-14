// THE ACCEPTANCE GATE — feature-sync-file-plane.
//
// The RCA's shape, made a test: a fresh link delivered 79/79 canvases and
// lost 103 files, because sync's unit was a canvas and everything else had no
// lane. The user-visible contract this feature ships is "what's in the folder
// syncs": a fresh, EMPTY design root linked to a project ends up
// FILE-FOR-FILE equal to the source — minus exactly `config.json` (the trust
// anchors) and Maude runtime state, which must never travel.
//
// The hub half is REAL: the actual `handleFilesRoute` / `handleProjectFileRoute`
// handlers (apps/hub/src/file-manifest.mjs) mounted on a real `node:http`
// server over a real source tree. Token VERIFICATION is injected (the same
// `verify` seam the documents-route harness uses — the sqlite token store is
// a native module bun cannot open); the real store is exercised by the hub's
// own node suite. The peer half is the real `pullFiles`. What is SIMULATED is
// plane A: the canvas body and its named sidecars are pre-written on the peer
// the way the Yjs canvas lanes deliver them — that transport has its own
// suite (sync-runtime, two-client-sync); this test's subject is everything
// plane A does NOT carry, and the disjointness between the two.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

import {
  type Dirent,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { handleFilesRoute, handleProjectFileRoute } from '../../hub/src/file-manifest.mjs';
// `matchesScope` is pure; the token STORE itself is native sqlite the bun
// runtime cannot open, so verification is injected below (the same `verify`
// seam the documents-route harness uses).
import { matchesScope } from '../../hub/src/tokens.mjs';
import { isRuntimeStateRel } from '../sync/file-membership.ts';
import { pullFiles } from '../sync/file-pull.ts';

const TOKEN = 'parity-peer-token';
const verify = (t: string) => (t === TOKEN ? { scope: '*', label: 'peer' } : null);

const CANVAS_GROUPS = [{ path: 'ui' }, { path: 'system' }];

/** The RCA fixture: one canvas plus every file class the fresh link lost. */
function seedSource(root: string): void {
  mkdirSync(path.join(root, 'ui'), { recursive: true });
  mkdirSync(path.join(root, 'system/ds/preview'), { recursive: true });
  mkdirSync(path.join(root, 'system/ds/assets/logos'), { recursive: true });
  mkdirSync(path.join(root, 'assets'), { recursive: true });
  mkdirSync(path.join(root, '_history/junk'), { recursive: true });
  writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ canvasGroups: CANVAS_GROUPS, linkedHub: { url: 'http://x', syncFiles: true } })
  );
  // Plane A's cargo — the canvas and its named sidecars.
  writeFileSync(path.join(root, 'ui/welcome.tsx'), 'export default () => null');
  writeFileSync(path.join(root, 'ui/welcome.meta.json'), '{"title":"Welcome"}');
  writeFileSync(path.join(root, 'system/ds/preview/specimen.tsx'), 'export default 1');
  writeFileSync(path.join(root, 'system/ds/preview/specimen.css'), '.spec{}');
  // Plane B's cargo — the 103-file gap's representatives.
  writeFileSync(path.join(root, 'system/ds/brand.css'), ':root { --bg-0: #fff }');
  writeFileSync(path.join(root, 'system/ds/README.md'), '# the design system');
  writeFileSync(path.join(root, 'system/ds/preview/_layout.css'), '.layout{}');
  writeFileSync(path.join(root, 'system/ds/preview/_brand-css.ts'), 'import "./x.css"');
  writeFileSync(path.join(root, 'system/ds/assets/logos/logo.svg'), '<svg/>');
  writeFileSync(path.join(root, 'assets/c0fa9c7f.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  // What must NEVER travel.
  writeFileSync(path.join(root, '_history/junk/old.tsx'), 'stale');
  writeFileSync(path.join(root, '_server.json'), '{"pid":1}');
}

/** Plane A's delivery, simulated: what the canvas CRDT lanes put on a fresh
 *  peer (body + named sidecars), byte-identical to the source. */
function deliverPlaneA(source: string, peer: string): void {
  for (const rel of [
    'ui/welcome.tsx',
    'ui/welcome.meta.json',
    'system/ds/preview/specimen.tsx',
    'system/ds/preview/specimen.css',
  ]) {
    mkdirSync(path.dirname(path.join(peer, rel)), { recursive: true });
    writeFileSync(path.join(peer, rel), readFileSync(path.join(source, rel)));
  }
}

/** Every file in a tree, designRoot-relative, sorted. */
function walkTree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  };
  walk(root, '');
  return out.sort();
}

/** The parity domain: everything except the trust anchors + runtime state. */
function syncableSet(root: string): string[] {
  return walkTree(root).filter((rel) => rel !== 'config.json' && !isRuntimeStateRel(rel));
}

let sourceRoot: string;
let server: Server;
let hubUrl: string;

beforeAll(async () => {
  sourceRoot = mkdtempSync(path.join(tmpdir(), 'maude-parity-src-'));
  seedSource(sourceRoot);

  // The REAL hub handlers on a real socket — encoding, headers and streaming
  // all take the same path production takes.
  server = createServer((req, res) => {
    const pathname = (req.url ?? '').split('?')[0] ?? '';
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim() || null;
    if (pathname === '/api/files') {
      handleFilesRoute({
        path: pathname,
        method: req.method ?? 'GET',
        bearer,
        verify,
        matchesScope,
        designRoot: sourceRoot,
        respondJson: (status: number, payload: unknown) => {
          const body = JSON.stringify(payload);
          res.writeHead(status, { 'Content-Type': 'application/json' }).end(body);
        },
      });
      return;
    }
    void handleProjectFileRoute({
      request: req,
      response: res,
      pathname,
      method: req.method ?? 'GET',
      dataDir: '/nonexistent', // unused — `verify` is injected
      secret: '',
      verify,
      designRoot: sourceRoot,
      matchesScope,
    }).then((handled: boolean) => {
      if (!handled) res.writeHead(404).end('not found');
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address();
  hubUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(sourceRoot, { recursive: true, force: true });
});

const silent = { log: () => {}, warn: () => {} };

describe('fresh-link parity — the whole project arrives', () => {
  test('an empty peer converges to file-for-file equality minus config + runtime state', async () => {
    const peerRoot = mkdtempSync(path.join(tmpdir(), 'maude-parity-peer-'));
    try {
      deliverPlaneA(sourceRoot, peerRoot);
      const result = await pullFiles({
        designRoot: peerRoot,
        hubUrl,
        token: () => TOKEN,
        canvasGroups: CANVAS_GROUPS,
        allowCodeModules: true, // an owner's fresh link
        log: silent,
      });
      expect(result.failed).toEqual([]);
      expect(result.dropped).toEqual([]);

      // THE acceptance assertion: the RCA's `diff -rq`, as a set + bytes.
      const want = syncableSet(sourceRoot);
      expect(syncableSet(peerRoot)).toEqual(want);
      for (const rel of want) {
        expect(readFileSync(path.join(peerRoot, rel))).toEqual(
          readFileSync(path.join(sourceRoot, rel))
        );
      }

      // …and the excluded set is EXCLUDED, not merely equal.
      const arrived = walkTree(peerRoot);
      expect(arrived.includes('config.json')).toBe(false);
      expect(arrived.some((rel) => rel.startsWith('_history/'))).toBe(false);
      expect(arrived.includes('_server.json')).toBe(false);

      // A second pass is the steady state: everything skips, nothing moves.
      const again = await pullFiles({
        designRoot: peerRoot,
        hubUrl,
        token: () => TOKEN,
        canvasGroups: CANVAS_GROUPS,
        allowCodeModules: true,
        log: silent,
      });
      expect(again.pulled).toEqual([]);
      expect(again.skipped).toBe(result.pulled.length);
      expect(again.conflicts).toEqual([]);
    } finally {
      rmSync(peerRoot, { recursive: true, force: true });
    }
  });

  test('without the owner gate the same link arrives minus code modules only', async () => {
    const peerRoot = mkdtempSync(path.join(tmpdir(), 'maude-parity-member-'));
    try {
      deliverPlaneA(sourceRoot, peerRoot);
      const result = await pullFiles({
        designRoot: peerRoot,
        hubUrl,
        token: () => TOKEN,
        canvasGroups: CANVAS_GROUPS,
        allowCodeModules: false, // a member's fresh link
        log: silent,
      });
      const want = syncableSet(sourceRoot).filter(
        (rel) => rel !== 'system/ds/preview/_brand-css.ts'
      );
      expect(syncableSet(peerRoot)).toEqual(want);
      expect(result.dropped.map((d) => d.rel)).toEqual(['system/ds/preview/_brand-css.ts']);
    } finally {
      rmSync(peerRoot, { recursive: true, force: true });
    }
  });

  test('the wire itself never offers a canvas body — disjointness holds end-to-end', async () => {
    const res = await fetch(`${hubUrl}/api/files`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    const body = (await res.json()) as { files: { path: string; class: string }[] };
    const offered = body.files.map((f) => f.path);
    for (const owned of [
      'ui/welcome.tsx',
      'ui/welcome.meta.json',
      'system/ds/preview/specimen.tsx',
      'system/ds/preview/specimen.css',
    ]) {
      expect(offered.includes(owned)).toBe(false);
    }
    for (const never of ['config.json', '_server.json', '_history/junk/old.tsx']) {
      expect(offered.includes(never)).toBe(false);
    }
    // …and refusing to SERVE them outright, even when asked by name.
    for (const refused of ['config.json', 'ui/welcome.tsx', '_server.json']) {
      const read = await fetch(`${hubUrl}/_project-file/${encodeURIComponent(refused)}`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      expect(read.status).toBe(404);
    }
  });
});
