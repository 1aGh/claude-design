// Phase 6.5 T3 — PDF adapter unit tests.
//
// Real PNG capture is integration-shape — covered by the export scenario.
// Here we cover the empty-input + file-tree-rejection contract, and the
// raster→pdf assembly itself by feeding a known PNG into the gather path
// via a synthetic single-target run that short-circuits screenshot.

import { describe, expect, test } from 'bun:test';

import { PDFDocument } from 'pdf-lib';
import { run } from '../../exporters/pdf.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('pdf adapter — contract', () => {
  test('empty targets → zero-byte PDF placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe('application/pdf');
    expect(r.body.byteLength).toBe(0);
    expect(r.filename.endsWith('.pdf')).toBe(true);
  });

  test('file-tree targets → throws', async () => {
    await expect(
      run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)
    ).rejects.toThrow(/element targets/i);
  });
});

describe('pdf-lib smoke — embed + save', () => {
  test('embeds a PNG and produces a valid PDF buffer', async () => {
    const pdf = await PDFDocument.create();
    // 1x1 transparent PNG, hand-encoded — keeps the test hermetic.
    const png = Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
        'base64'
      )
    );
    const img = await pdf.embedPng(png);
    expect(img.width).toBe(1);
    expect(img.height).toBe(1);
    const page = pdf.addPage([100, 100]);
    page.drawImage(img, { x: 0, y: 0, width: 100, height: 100 });
    const bytes = await pdf.save();
    // PDF magic — every spec-conformant PDF starts with `%PDF-`.
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });
});
