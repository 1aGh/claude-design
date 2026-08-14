// The file plane's downward half — what lands, what is refused, and what a
// conflict costs (never work, silently).

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { classifyProjectFile } from '../sync/file-membership.ts';
import { fetchFileManifest, pullFiles, type RemoteFileEntry } from '../sync/file-pull.ts';

const sha = (body: string): string => createHash('sha256').update(body).digest('hex');

interface FakeFile {
  body: string;
  mtimeMs?: number;
  /** Override the manifest's class hint (for disagreement tests). */
  class?: string;
}

/** A fake hub: one manifest, one file store, a request log. */
function makeHub(files: Record<string, FakeFile>) {
  const requests: string[] = [];
  const fetchImpl = (async (url: RequestInfo | URL) => {
    const u = String(url);
    requests.push(u);
    if (u.endsWith('/api/files')) {
      const list = Object.entries(files).map(([p, f]) => ({
        path: p,
        sha256: sha(f.body),
        size: Buffer.byteLength(f.body),
        mtimeMs: f.mtimeMs ?? 1_000_000,
        class: f.class ?? classifyProjectFile(p),
      }));
      return new Response(JSON.stringify({ files: list, count: list.length }), { status: 200 });
    }
    const m = u.match(/\/_project-file\/(.+)$/);
    if (m) {
      const rel = decodeURIComponent(m[1] ?? '');
      const f = files[rel];
      if (!f) return new Response('nf', { status: 404 });
      return new Response(f.body, { status: 200 });
    }
    return new Response('nf', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const silent = { log: () => {}, warn: () => {} };

function makeRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'maude-filepull-'));
}

function pull(
  designRoot: string,
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof pullFiles>[0]> = {}
) {
  return pullFiles({
    designRoot,
    hubUrl: 'http://hub.test',
    token: () => 'tok',
    allowCodeModules: false,
    fetchImpl,
    log: silent,
    ...overrides,
  });
}

describe('file-pull — the RCA gap closes', () => {
  test('a fresh empty root receives the whole miss-list shape', async () => {
    const root = makeRoot();
    try {
      const { fetchImpl } = makeHub({
        'system/ds/brand.css': { body: ':root{}' },
        'system/ds/README.md': { body: '# ds' },
        'system/ds/preview/_layout.css': { body: '.x{}' },
        'system/ds/assets/logos/logo.svg': { body: '<svg/>' },
        'assets/c0fa9c7f.png': { body: 'PNG' },
        'system/ds/EMPTY.md': { body: '' }, // an empty doc is a real file
      });
      const out = await pull(root, fetchImpl);
      expect(out.pulled.sort()).toEqual([
        'assets/c0fa9c7f.png',
        'system/ds/EMPTY.md',
        'system/ds/README.md',
        'system/ds/assets/logos/logo.svg',
        'system/ds/brand.css',
        'system/ds/preview/_layout.css',
      ]);
      expect(readFileSync(path.join(root, 'system/ds/brand.css'), 'utf8')).toBe(':root{}');
      expect(readFileSync(path.join(root, 'system/ds/EMPTY.md'), 'utf8')).toBe('');
      expect(out.failed).toEqual([]);
      expect(out.dropped).toEqual([]);
      // No half-written residue anywhere.
      expect(existsSync(path.join(root, 'system/ds/brand.css.part'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('code modules are dropped without the owner gate, and land with it', async () => {
    const root = makeRoot();
    try {
      const { fetchImpl } = makeHub({
        'system/ds/preview/_brand-css.ts': { body: 'export {}' },
      });
      const denied = await pull(root, fetchImpl);
      expect(denied.pulled).toEqual([]);
      expect(denied.dropped.length).toBe(1);
      expect(denied.dropped[0]?.reason).toMatch(/owner/);
      expect(existsSync(path.join(root, 'system/ds/preview/_brand-css.ts'))).toBe(false);

      const allowed = await pull(root, fetchImpl, { allowCodeModules: true });
      expect(allowed.pulled).toEqual(['system/ds/preview/_brand-css.ts']);
      expect(readFileSync(path.join(root, 'system/ds/preview/_brand-css.ts'), 'utf8')).toBe(
        'export {}'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('file-pull — the receiver re-validates every path', () => {
  test('a hostile manifest cannot land config, runtime state, or traversal', async () => {
    const root = makeRoot();
    try {
      const { fetchImpl, requests } = makeHub({
        'config.json': { body: '{"linkedHub":{"url":"http://evil"}}', class: 'companion-text' },
        '_server.json': { body: '{}', class: 'companion-text' },
        '_untrusted/INDEX.json': { body: '{}', class: 'companion-text' },
        '../escape.css': { body: 'x', class: 'companion-text' },
        '_history/old.css': { body: 'x', class: 'companion-text' },
      });
      const out = await pull(root, fetchImpl);
      expect(out.pulled).toEqual([]);
      expect(out.dropped.length).toBe(5);
      expect(existsSync(path.join(root, 'config.json'))).toBe(false);
      expect(existsSync(path.join(root, '_server.json'))).toBe(false);
      // Refused entries cost ZERO byte fetches — only the manifest request.
      expect(requests.filter((u) => u.includes('_project-file'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the hub's class field is a hint — disagreement drops the entry", async () => {
    const root = makeRoot();
    try {
      const { fetchImpl } = makeHub({
        'system/ds/brand.css': { body: ':root{}', class: 'inert-media' },
      });
      const out = await pull(root, fetchImpl);
      expect(out.pulled).toEqual([]);
      expect(out.dropped[0]?.reason).toMatch(/hub says 'inert-media'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a css that is a canvas sidecar HERE is refused, whatever the hub offers', async () => {
    const root = makeRoot();
    try {
      // This peer holds the canvas body, so its sibling css is the CRDT css
      // lane — plane B must not write it.
      mkdirSync(path.join(root, 'system/ds/preview'), { recursive: true });
      writeFileSync(path.join(root, 'system/ds/preview/specimen.tsx'), 'export default 1');
      const { fetchImpl } = makeHub({
        'system/ds/preview/specimen.css': { body: '.pwn{}', class: 'companion-text' },
      });
      const out = await pull(root, fetchImpl);
      expect(out.pulled).toEqual([]);
      expect(out.dropped[0]?.reason).toMatch(/canvas-owned/);
      expect(existsSync(path.join(root, 'system/ds/preview/specimen.css'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a body whose hash is not what the manifest promised never lands', async () => {
    const root = makeRoot();
    try {
      const { fetchImpl } = makeHub({
        'system/ds/brand.css': { body: ':root{}' },
      });
      // Serve DIFFERENT bytes than the manifest hashed (a racing write, or a
      // hub lying about content) — the landing is refused, retried next pass.
      const lying = (async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes('_project-file')) return new Response('EVIL');
        return fetchImpl(url);
      }) as typeof fetch;
      const out = await pull(root, lying);
      expect(out.pulled).toEqual([]);
      expect(out.failed[0]?.reason).toMatch(/hash mismatch/);
      expect(existsSync(path.join(root, 'system/ds/brand.css'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('file-pull — reconciliation', () => {
  test('an equal hash skips, costing no byte fetch (echo-guard by construction)', async () => {
    const root = makeRoot();
    try {
      mkdirSync(path.join(root, 'system/ds'), { recursive: true });
      writeFileSync(path.join(root, 'system/ds/brand.css'), ':root{}');
      const { fetchImpl, requests } = makeHub({
        'system/ds/brand.css': { body: ':root{}' },
      });
      const out = await pull(root, fetchImpl);
      expect(out.skipped).toBe(1);
      expect(out.pulled).toEqual([]);
      expect(requests.filter((u) => u.includes('_project-file'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a newer remote wins, and the losing local copy parks in _trash — never silent loss', async () => {
    const root = makeRoot();
    try {
      mkdirSync(path.join(root, 'system/ds'), { recursive: true });
      const abs = path.join(root, 'system/ds/brand.css');
      writeFileSync(abs, 'LOCAL');
      utimesSync(abs, new Date(1000), new Date(1000));
      const { fetchImpl } = makeHub({
        'system/ds/brand.css': { body: 'REMOTE', mtimeMs: 5_000_000 },
      });
      const out = await pull(root, fetchImpl, { now: () => 424242 });
      expect(out.pulled).toEqual(['system/ds/brand.css']);
      expect(readFileSync(abs, 'utf8')).toBe('REMOTE');
      expect(out.conflicts).toEqual([
        {
          rel: 'system/ds/brand.css',
          winner: 'hub',
          trashedTo: '_trash/system/ds/brand.css-conflict-424242',
        },
      ]);
      expect(
        readFileSync(path.join(root, '_trash/system/ds/brand.css-conflict-424242'), 'utf8')
      ).toBe('LOCAL');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('an older remote loses: the local copy stays, no bytes move', async () => {
    const root = makeRoot();
    try {
      mkdirSync(path.join(root, 'system/ds'), { recursive: true });
      const abs = path.join(root, 'system/ds/brand.css');
      writeFileSync(abs, 'LOCAL');
      // Local mtime is "now" (fresh write); the remote claims epoch-old.
      const { fetchImpl, requests } = makeHub({
        'system/ds/brand.css': { body: 'REMOTE', mtimeMs: 1 },
      });
      const out = await pull(root, fetchImpl);
      expect(out.pulled).toEqual([]);
      expect(readFileSync(abs, 'utf8')).toBe('LOCAL');
      expect(out.conflicts).toEqual([{ rel: 'system/ds/brand.css', winner: 'local' }]);
      expect(requests.filter((u) => u.includes('_project-file'))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('the per-pass cap is loud, and the remainder waits for the next pass', async () => {
    const root = makeRoot();
    try {
      const files: Record<string, FakeFile> = {};
      for (let i = 0; i < 205; i++)
        files[`docs/note-${String(i).padStart(3, '0')}.md`] = { body: `n${i}` };
      const { fetchImpl } = makeHub(files);
      const warns: string[] = [];
      const out = await pull(root, fetchImpl, {
        log: { log: () => {}, warn: (m: string) => warns.push(m) },
      });
      expect(out.pulled.length).toBe(200);
      expect(warns.some((w) => w.includes('205'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('fetchFileManifest — never fatal, always filtered', () => {
  test('an unreachable hub, a refusal, and junk all answer null', async () => {
    const down = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await fetchFileManifest('http://hub.test', 'tok', down)).toBe(null);
    const refusing = (async () => new Response('no', { status: 401 })) as typeof fetch;
    expect(await fetchFileManifest('http://hub.test', 'tok', refusing)).toBe(null);
    const junk = (async () => new Response('{"files": "nope"}')) as typeof fetch;
    expect(await fetchFileManifest('http://hub.test', 'tok', junk)).toBe(null);
  });

  test('malformed entries are filtered before anything reads them', async () => {
    const sneaky = (async () =>
      new Response(
        JSON.stringify({
          files: [
            { path: 'ok.md', sha256: sha('x'), size: 1, mtimeMs: 1, class: 'companion-text' },
            { path: '', sha256: sha('x'), size: 1, mtimeMs: 1 },
            { path: 'bad-sha.md', sha256: 'nope', size: 1, mtimeMs: 1 },
            { sha256: sha('x') },
            null,
            'string',
          ],
        })
      )) as typeof fetch;
    const entries = (await fetchFileManifest(
      'http://hub.test',
      'tok',
      sneaky
    )) as RemoteFileEntry[];
    expect(entries.map((e) => e.path)).toEqual(['ok.md']);
  });
});
