// Phase 6.5 T6c — Canva handoff adapter + prompt artifact tests.
//
// Real browser walk is integration. Here we cover the pure markdown builder
// + the empty/file-tree branches.

import { describe, expect, test } from 'bun:test';

import { buildHandoffMarkdown } from '../../exporters/canva-handoff-prompt.ts';
import { run } from '../../exporters/canva.ts';

const CTX = {
  designRoot: '/tmp/.design',
  repoRoot: '/tmp',
  serverOrigin: 'http://localhost:0',
};

describe('canva-handoff-prompt — buildHandoffMarkdown', () => {
  test('emits a self-contained markdown with all three sections', () => {
    const md = buildHandoffMarkdown({
      pptxFilename: 'home.pptx',
      absolutePath: '/Users/dev/Downloads/home.pptx',
      canvasSlug: 'home',
      artboardCount: 5,
      artboardTitles: ['Hero', 'Pricing', 'FAQ', 'Footer A', 'Footer B'],
    });
    expect(md).toContain('# Canva handoff — home');
    expect(md).toContain('**5** artboards');
    expect(md).toContain('## Option A — drag-drop');
    expect(md).toContain('## Option B — automate via your Canva MCP');
    // Prompt block present, slot-filled.
    expect(md).toContain('```text');
    expect(md).toContain('/Users/dev/Downloads/home.pptx');
    expect(md).toContain('Slides expected: 5');
    expect(md).toContain('## Fidelity caveats');
    // Hero through Footer B listed.
    expect(md).toContain('1. Hero');
    expect(md).toContain('5. Footer B');
  });

  test('singular-vs-plural copy switches at count=1', () => {
    const md = buildHandoffMarkdown({
      pptxFilename: 'solo.pptx',
      absolutePath: '<your-unzip-location>/solo.pptx',
      canvasSlug: 'solo',
      artboardCount: 1,
    });
    expect(md).toContain('**1** artboard ');
    expect(md).toContain('1 Canva page on import');
  });
});

describe('canva adapter — contract', () => {
  test('empty targets → zero-byte ZIP placeholder', async () => {
    const r = await run([], {}, CTX);
    expect(r.contentType).toBe('application/zip');
    expect(r.body.byteLength).toBe(0);
  });

  test('file-tree targets → throws', async () => {
    await expect(
      run([{ kind: 'file-tree', paths: ['ui/Home.tsx'] }], {}, CTX)
    ).rejects.toThrow(/element targets/i);
  });
});
