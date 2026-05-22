// Phase 6.5 T5 — HTML adapter contract tests.

import { describe, expect, test } from 'bun:test';

import { run } from '../../exporters/html.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('html adapter — contract', () => {
  test('empty targets → zero-byte ZIP placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe('application/zip');
    expect(r.body.byteLength).toBe(0);
    expect(r.filename.endsWith('.zip')).toBe(true);
  });

  test('file-tree targets → throws', async () => {
    await expect(
      run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)
    ).rejects.toThrow(/element targets/i);
  });
});
