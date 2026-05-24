// Phase 6.5 T2 — PNG adapter unit tests.
//
// Skips the real `screenshot.sh` invocation — that path lands as a scenario
// under `.ai/scenarios/export-from-toolbar/` (T2 plan §Validate). Here we
// cover the contract-shape branches:
//   - empty target list → zero-byte placeholder
//   - file-tree-only targets → throws (PNG adapter rejects)

import { describe, expect, test } from 'bun:test';

import { run } from '../../exporters/png.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('png adapter — contract', () => {
  test('empty targets → zero-byte PNG placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe('image/png');
    expect(r.body.byteLength).toBe(0);
    expect(r.filename.endsWith('.png')).toBe(true);
  });

  test('file-tree targets → throws (PNG cannot render a project)', async () => {
    await expect(run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)).rejects.toThrow(
      /element targets/i
    );
  });
});
