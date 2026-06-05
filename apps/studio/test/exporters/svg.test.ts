// Phase 6.5 T4 — SVG adapter contract tests.
//
// Real Playwright walk is integration-shape (lands as scenario). Here we
// cover empty-input + file-tree-rejection.

import { describe, expect, test } from 'bun:test';

import { run } from '../../exporters/svg.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('svg adapter — contract', () => {
  test('empty targets → zero-byte SVG placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe('image/svg+xml');
    expect(r.body.byteLength).toBe(0);
    expect(r.filename.endsWith('.svg')).toBe(true);
  });

  test('file-tree targets → throws', async () => {
    await expect(run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)).rejects.toThrow(
      /element targets/i
    );
  });
});
