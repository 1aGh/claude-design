// Phase 6.5 T6b — PPTX adapter contract.
//
// dom-to-pptx runs inside playwright + the headless browser; real conversion
// is integration-shape (covered by the export scenario). Here we cover empty
// targets + file-tree rejection so the API surface stays guarded.

import { describe, expect, test } from 'bun:test';

import { run } from '../../exporters/pptx.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('pptx adapter — contract', () => {
  test('empty targets → zero-byte PPTX placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    expect(r.body.byteLength).toBe(0);
  });

  test('file-tree targets → throws', async () => {
    await expect(run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)).rejects.toThrow(
      /element targets/i
    );
  });
});
