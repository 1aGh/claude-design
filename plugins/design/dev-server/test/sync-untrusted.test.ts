// T4.5 (DDR-054 §3 F3) — untrusted-marker for sync-written files. Verifies the
// `_untrusted/INDEX.json` marker + the managed `.claudeignore` block: written
// for the syncable set, cleared when empty, stale entries dropped on re-write,
// and user-authored `.claudeignore` content outside the block preserved.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import type { Context } from '../context.ts';
import type { CanvasDescriptor } from '../sync/index.ts';
import { clearUntrustedMarkers, writeUntrustedMarkers } from '../sync/untrusted.ts';

let repoRoot: string;
let designRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'untrusted-'));
  designRoot = join(repoRoot, '.design');
  mkdirSync(designRoot, { recursive: true });
});
afterEach(() => {
  /* tmpdir — left for the OS to reap */
});

function ctxOf(): Context {
  return { paths: { repoRoot, designRoot } } as unknown as Context;
}

function desc(slug: string, body: string): CanvasDescriptor {
  return {
    slug,
    html: join(designRoot, body),
    comments: join(designRoot, '_comments', `${slug}.json`),
    annotations: join(designRoot, `${slug}.annotations.svg`),
    meta: join(designRoot, body.replace(/\.(tsx|html)$/i, '.meta.json')),
    css: join(designRoot, body.replace(/\.(tsx|html)$/i, '.css')),
  };
}

const HUB = 'https://hub.example.com';

describe('writeUntrustedMarkers — T4.5', () => {
  test('writes INDEX.json + a managed .claudeignore block for the synced set', () => {
    const ctx = ctxOf();
    writeUntrustedMarkers(ctx, [desc('ui-a', 'ui/a.tsx')], HUB);

    const indexAbs = join(designRoot, '_untrusted', 'INDEX.json');
    expect(existsSync(indexAbs)).toBe(true);
    const index = JSON.parse(readFileSync(indexAbs, 'utf8'));
    expect(index.hubUrl).toBe(HUB);
    expect(index.canvases[0].slug).toBe('ui-a');
    expect(index.canvases[0].body).toBe('.design/ui/a.tsx');
    expect(index.canvases[0].meta).toBe('.design/ui/a.meta.json'); // Gap 2: meta is untrusted too
    expect(index.canvases[0].css).toBe('.design/ui/a.css'); // Gap 3: css too
    expect(index.note.toLowerCase()).toContain('untrusted');

    const ci = readFileSync(join(repoRoot, '.claudeignore'), 'utf8');
    expect(ci).toContain('maude:sync-untrusted begin');
    expect(ci).toContain('.design/ui/a.tsx');
    expect(ci).toContain('.design/ui-a.annotations.svg');
    expect(ci).toContain('.design/ui/a.meta.json');
    expect(ci).toContain('.design/ui/a.css');
    expect(ci).toContain('maude:sync-untrusted end');
  });

  test('re-write with a smaller set drops the stale entry', () => {
    const ctx = ctxOf();
    writeUntrustedMarkers(ctx, [desc('ui-a', 'ui/a.tsx'), desc('ui-b', 'ui/b.tsx')], HUB);
    writeUntrustedMarkers(ctx, [desc('ui-a', 'ui/a.tsx')], HUB);
    const ci = readFileSync(join(repoRoot, '.claudeignore'), 'utf8');
    expect(ci).toContain('.design/ui/a.tsx');
    expect(ci).not.toContain('.design/ui/b.tsx');
    // Only one managed block (no accumulation).
    expect(ci.match(/maude:sync-untrusted begin/g)?.length).toBe(1);
  });

  test('empty set clears INDEX.json + the .claudeignore block', () => {
    const ctx = ctxOf();
    writeUntrustedMarkers(ctx, [desc('ui-a', 'ui/a.tsx')], HUB);
    writeUntrustedMarkers(ctx, [], HUB);
    expect(existsSync(join(designRoot, '_untrusted', 'INDEX.json'))).toBe(false);
    // .claudeignore had only our block → removed entirely.
    expect(existsSync(join(repoRoot, '.claudeignore'))).toBe(false);
  });

  test('preserves user-authored .claudeignore content outside the block', () => {
    writeFileSync(join(repoRoot, '.claudeignore'), 'secrets/\n*.key\n');
    const ctx = ctxOf();
    writeUntrustedMarkers(ctx, [desc('ui-a', 'ui/a.tsx')], HUB);
    let ci = readFileSync(join(repoRoot, '.claudeignore'), 'utf8');
    expect(ci).toContain('secrets/');
    expect(ci).toContain('*.key');
    expect(ci).toContain('.design/ui/a.tsx');
    // Clearing leaves the user content intact.
    clearUntrustedMarkers(ctx);
    ci = readFileSync(join(repoRoot, '.claudeignore'), 'utf8');
    expect(ci).toContain('secrets/');
    expect(ci).not.toContain('.design/ui/a.tsx');
    expect(ci).not.toContain('maude:sync-untrusted');
  });
});
