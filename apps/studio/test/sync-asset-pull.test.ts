// The downward asset lane — see sync/asset-pull.ts.
//
// Regression cover for the reported "obrázky v annotations se nevykreslí":
// `<slug>.annotations.svg` synced, its `assets/<sha8>.png` did not, and the
// canvas rendered a broken-image glyph on every peer but the one that made it.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { pullAssets, referencedAssets } from '../sync/asset-pull.ts';

function project(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'maude-asset-pull-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return root;
}

const annotation = (name: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg"><image data-tool="image" href="assets/${name}"/></svg>`;

/** A hub that serves every asset as three bytes. */
const servingFetch = (seen: string[] = []) =>
  (async (url: string) => {
    seen.push(String(url));
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }) as unknown as typeof fetch;

describe('referencedAssets', () => {
  test('finds the image an annotation references', () => {
    const root = project({ 'ui-board.annotations.svg': annotation('c0fa9c7f.png') });
    expect(referencedAssets(root)).toEqual(['c0fa9c7f.png']);
  });

  test('reads canvas bodies and sidecars too, deduplicating', () => {
    const root = project({
      'ui-board.annotations.svg': annotation('a.png'),
      'ui/card.tsx': `<img src="assets/b.jpg" /><img src="assets/a.png" />`,
      'ui/card.css': `.x { background: url(assets/c.webp) }`,
    });
    expect(referencedAssets(root)).toEqual(['a.png', 'b.jpg', 'c.webp']);
  });

  test('refuses a reference that could place a file outside assets/', () => {
    // An annotation can itself have arrived from the hub, so a name found in
    // one is untrusted input.
    const root = project({
      'ui-board.annotations.svg': [
        '<svg>',
        '<image href="assets/../../etc/passwd"/>',
        '<image href="assets/ok.png"/>',
        '</svg>',
      ].join(''),
    });
    expect(referencedAssets(root)).toEqual(['ok.png']);
  });

  test('refuses an extension outside the asset allowlist', () => {
    const root = project({
      'ui/card.tsx': `"assets/payload.sh" "assets/x.tsx" "assets/real.png"`,
    });
    expect(referencedAssets(root)).toEqual(['real.png']);
  });

  test('ignores runtime directories — a trashed canvas wants nothing', () => {
    const root = project({
      '_trash/old-deleted-1/old.annotations.svg': annotation('ghost.png'),
      '_history/ui-board/1.tsx': `"assets/older.png"`,
      'ui-board.annotations.svg': annotation('live.png'),
    });
    expect(referencedAssets(root)).toEqual(['live.png']);
  });
});

describe('pullAssets', () => {
  const opts = (root: string, fetchImpl: typeof fetch) => ({
    designRoot: root,
    hubUrl: 'https://hub.example/',
    token: () => 'tok',
    fetchImpl,
    log: { log: () => {}, warn: () => {} },
  });

  test('fetches a referenced asset this machine does not have', async () => {
    const root = project({ 'ui-board.annotations.svg': annotation('c0fa9c7f.png') });
    const seen: string[] = [];
    const res = await pullAssets(opts(root, servingFetch(seen)));

    expect(res.pulled).toEqual(['c0fa9c7f.png']);
    expect(seen).toEqual(['https://hub.example/assets/c0fa9c7f.png']);
    expect(readFileSync(path.join(root, 'assets/c0fa9c7f.png'))).toEqual(Buffer.from([1, 2, 3]));
  });

  test('asks for nothing when every reference is already on disk', async () => {
    const root = project({
      'ui-board.annotations.svg': annotation('have.png'),
      'assets/have.png': 'bytes',
    });
    let called = 0;
    const counting = (async () => {
      called += 1;
      return new Response('x', { status: 200 });
    }) as unknown as typeof fetch;

    const res = await pullAssets(opts(root, counting));
    expect(called).toBe(0);
    expect(res.present).toBe(1);
    expect(res.pulled).toEqual([]);
  });

  test('is idempotent — a second pass costs no requests', async () => {
    const root = project({ 'ui-board.annotations.svg': annotation('x.png') });
    await pullAssets(opts(root, servingFetch()));
    const seen: string[] = [];
    const second = await pullAssets(opts(root, servingFetch(seen)));
    expect(seen).toEqual([]);
    expect(second.pulled).toEqual([]);
  });

  test('a 404 is recorded and retried, never fatal', async () => {
    // Ordinary: the peer that owns the bytes has not pushed them yet.
    const root = project({ 'ui-board.annotations.svg': annotation('later.png') });
    const missing = (async () => new Response('nope', { status: 404 })) as unknown as typeof fetch;
    const res = await pullAssets(opts(root, missing));
    expect(res.pulled).toEqual([]);
    expect(res.failed).toEqual([{ name: 'later.png', reason: 'HTTP 404' }]);
    expect(existsSync(path.join(root, 'assets/later.png'))).toBe(false);
  });

  test('a throwing hub is not fatal either', async () => {
    const root = project({ 'ui-board.annotations.svg': annotation('x.png') });
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const res = await pullAssets(opts(root, boom));
    expect(res.pulled).toEqual([]);
    expect(res.failed[0]?.reason).toBe('offline');
  });

  test('refuses an empty body rather than writing a zero-byte image', async () => {
    const root = project({ 'ui-board.annotations.svg': annotation('x.png') });
    const empty = (async () =>
      new Response(new Uint8Array([]), { status: 200 })) as unknown as typeof fetch;
    const res = await pullAssets(opts(root, empty));
    expect(res.pulled).toEqual([]);
    expect(existsSync(path.join(root, 'assets/x.png'))).toBe(false);
  });

  test('leaves no .part file behind on success', async () => {
    // The write is temp-then-rename so the dev server serving this very path
    // never reads a half-written image.
    const root = project({ 'ui-board.annotations.svg': annotation('x.png') });
    await pullAssets(opts(root, servingFetch()));
    expect(existsSync(path.join(root, 'assets/x.png.part'))).toBe(false);
  });
});
