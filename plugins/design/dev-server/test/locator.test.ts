import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  canvasSlug,
  clearLocatorSlug,
  type LocatorMap,
  readLocator,
  readLocatorFile,
  writeLocator,
} from '../locator.ts';

function tmp(): { dir: string; locFile: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'mdcc-locator-'));
  const locFile = path.join(dir, '_locator.json');
  return { dir, locFile, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const entry = (canvas: string, line: number): LocatorMap[string] => ({
  canvas,
  line,
  col: 0,
  jsxPath: ['section'],
  componentName: 'X',
});

describe('canvasSlug', () => {
  test('strips designRoot prefix and file extension', () => {
    expect(canvasSlug('/proj/.design/ui/Docs Site.tsx', '/proj/.design')).toBe('ui/Docs Site');
  });

  test('handles nested paths', () => {
    expect(canvasSlug('/proj/.design/system/project/preview/btn.tsx', '/proj/.design')).toBe(
      'system/project/preview/btn'
    );
  });

  test('files without extension are returned as-is', () => {
    expect(canvasSlug('/proj/.design/ui/no-ext', '/proj/.design')).toBe('ui/no-ext');
  });
});

describe('readLocatorFile / readLocator', () => {
  test('returns empty object when the file does not exist', async () => {
    const t = tmp();
    try {
      expect(await readLocatorFile(t.locFile)).toEqual({});
      expect(await readLocator(t.locFile, 'ui/anything')).toBeNull();
    } finally {
      t.cleanup();
    }
  });

  test('treats malformed JSON as empty without throwing', async () => {
    const t = tmp();
    try {
      await Bun.write(t.locFile, '{ not valid');
      expect(await readLocatorFile(t.locFile)).toEqual({});
    } finally {
      t.cleanup();
    }
  });

  test('treats a top-level array as empty (defensive against bad shape)', async () => {
    const t = tmp();
    try {
      await Bun.write(t.locFile, '[]');
      expect(await readLocatorFile(t.locFile)).toEqual({});
    } finally {
      t.cleanup();
    }
  });
});

describe('writeLocator — roundtrip + atomicity', () => {
  test('round-trip a single slug', async () => {
    const t = tmp();
    try {
      const map: LocatorMap = { aaaaaaaa: entry('/c/X.tsx', 4) };
      await writeLocator(t.locFile, 'ui/X', map);
      const back = await readLocator(t.locFile, 'ui/X');
      expect(back).toEqual({ aaaaaaaa: entry('/c/X.tsx', 4) });
    } finally {
      t.cleanup();
    }
  });

  test('multiple slugs share the same _locator.json without trampling', async () => {
    const t = tmp();
    try {
      await writeLocator(t.locFile, 'ui/A', { aaaaaaaa: entry('/c/A.tsx', 1) });
      await writeLocator(t.locFile, 'ui/B', { bbbbbbbb: entry('/c/B.tsx', 2) });
      const file = await readLocatorFile(t.locFile);
      expect(Object.keys(file).sort()).toEqual(['ui/A', 'ui/B']);
      expect(file['ui/A']).toEqual({ aaaaaaaa: entry('/c/A.tsx', 1) });
      expect(file['ui/B']).toEqual({ bbbbbbbb: entry('/c/B.tsx', 2) });
    } finally {
      t.cleanup();
    }
  });

  test('updating an existing slug overwrites its map but leaves siblings intact', async () => {
    const t = tmp();
    try {
      await writeLocator(t.locFile, 'ui/A', { aaaaaaaa: entry('/c/A.tsx', 1) });
      await writeLocator(t.locFile, 'ui/B', { bbbbbbbb: entry('/c/B.tsx', 2) });
      await writeLocator(t.locFile, 'ui/A', { cccccccc: entry('/c/A.tsx', 9) });
      const file = await readLocatorFile(t.locFile);
      expect(file['ui/A']).toEqual({ cccccccc: entry('/c/A.tsx', 9) });
      expect(file['ui/B']).toEqual({ bbbbbbbb: entry('/c/B.tsx', 2) });
    } finally {
      t.cleanup();
    }
  });

  test('on-disk JSON is deterministic (sorted keys, trailing newline)', async () => {
    const t = tmp();
    try {
      const big: LocatorMap = {
        zzzzzzzz: entry('/c/X.tsx', 9),
        aaaaaaaa: entry('/c/X.tsx', 1),
        mmmmmmmm: entry('/c/X.tsx', 5),
      };
      await writeLocator(t.locFile, 'ui/X', big);
      const raw = await Bun.file(t.locFile).text();
      // top-level + nested keys should be sorted
      const aIdx = raw.indexOf('aaaaaaaa');
      const mIdx = raw.indexOf('mmmmmmmm');
      const zIdx = raw.indexOf('zzzzzzzz');
      expect(aIdx).toBeGreaterThan(-1);
      expect(aIdx).toBeLessThan(mIdx);
      expect(mIdx).toBeLessThan(zIdx);
      expect(raw.endsWith('\n')).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  test('concurrent writes against the same file do not corrupt JSON', async () => {
    const t = tmp();
    try {
      // Fire 20 writes in parallel, each against a distinct slug. The
      // per-path mutex must serialise them; the final file must contain all 20.
      const writes: Promise<void>[] = [];
      for (let i = 0; i < 20; i++) {
        const slug = `ui/slug-${String(i).padStart(2, '0')}`;
        const map: LocatorMap = {
          [`id${String(i).padStart(5, '0')}`]: entry(`/c/${slug}.tsx`, i + 1),
        };
        writes.push(writeLocator(t.locFile, slug, map));
      }
      await Promise.all(writes);
      const file = await readLocatorFile(t.locFile);
      expect(Object.keys(file).length).toBe(20);
      for (let i = 0; i < 20; i++) {
        const slug = `ui/slug-${String(i).padStart(2, '0')}`;
        expect(file[slug]).toBeDefined();
      }
    } finally {
      t.cleanup();
    }
  });

  test('concurrent writes against the SAME slug end up with the last writer winning, no partial state', async () => {
    const t = tmp();
    try {
      const writes: Promise<void>[] = [];
      // 10 writes to the same slug, each with a different singleton map.
      for (let i = 0; i < 10; i++) {
        const map: LocatorMap = { [`id-${i}`]: entry('/c/X.tsx', i) };
        writes.push(writeLocator(t.locFile, 'ui/X', map));
      }
      await Promise.all(writes);
      const back = await readLocator(t.locFile, 'ui/X');
      expect(back).not.toBeNull();
      // Each writer fully replaces the slug map, so the final state has exactly
      // one entry. Which entry won is implementation-defined (FIFO via mutex),
      // but the file shape is well-formed.
      expect(Object.keys(back as LocatorMap).length).toBe(1);
    } finally {
      t.cleanup();
    }
  });
});

describe('clearLocatorSlug', () => {
  test('removes one slug and leaves siblings', async () => {
    const t = tmp();
    try {
      await writeLocator(t.locFile, 'ui/A', { aaaaaaaa: entry('/c/A.tsx', 1) });
      await writeLocator(t.locFile, 'ui/B', { bbbbbbbb: entry('/c/B.tsx', 2) });
      await clearLocatorSlug(t.locFile, 'ui/A');
      const file = await readLocatorFile(t.locFile);
      expect(file['ui/A']).toBeUndefined();
      expect(file['ui/B']).toBeDefined();
    } finally {
      t.cleanup();
    }
  });

  test('is a no-op when slug missing', async () => {
    const t = tmp();
    try {
      await writeLocator(t.locFile, 'ui/A', { aaaaaaaa: entry('/c/A.tsx', 1) });
      await clearLocatorSlug(t.locFile, 'ui/Nope');
      const file = await readLocatorFile(t.locFile);
      expect(file['ui/A']).toBeDefined();
    } finally {
      t.cleanup();
    }
  });
});
