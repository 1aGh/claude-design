// export-assemble.test.ts — DDR-231: the in-cell half of the pptx browser
// lane. assemblePngDeck composes client-captured PNG bytes into a deck with
// PptxGenJS — pure JS over pure data (the zip containment class), so it must
// work with no browser, no filesystem inputs, no tenant checkout.

import { describe, expect, test } from 'bun:test';

import { assemblePngDeck } from '../exporters/pptx.ts';

// 1×1 transparent PNG.
const PNG_1PX = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
);

describe('assemblePngDeck — bytes in, deck out', () => {
  test('two PNGs become a two-slide .pptx (zip container with per-slide parts)', async () => {
    const body = await assemblePngDeck([PNG_1PX, PNG_1PX], 3);
    // .pptx IS a zip — PK\x03\x04 magic.
    expect(body[0]).toBe(0x50);
    expect(body[1]).toBe(0x4b);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(body);
    expect(zip.file('ppt/slides/slide1.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide2.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide3.xml')).toBeFalsy();
  });

  test('non-PNG bytes are refused, not composed into a corrupt deck', async () => {
    await expect(assemblePngDeck([new TextEncoder().encode('<svg/>')], 3)).rejects.toThrow(
      /not a PNG/
    );
  });

  test('a \\x89PNG prefix on non-PNG bytes is caught by the full 8-byte signature (L3)', async () => {
    // First 4 bytes match the old check, bytes 4-7 do not.
    const fake = new Uint8Array(24);
    fake.set([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00], 0);
    await expect(assemblePngDeck([fake], 3)).rejects.toThrow(/not a PNG/);
  });

  test('an implausible IHDR dimension is refused, not fed to the geometry math (F3)', async () => {
    // Valid 8-byte sig + IHDR claiming 0x7fffffff × 0x7fffffff.
    const bomb = new Uint8Array(24);
    bomb.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const dv = new DataView(bomb.buffer);
    dv.setUint32(16, 0x7fffffff);
    dv.setUint32(20, 0x7fffffff);
    await expect(assemblePngDeck([bomb], 3)).rejects.toThrow(/implausible PNG dimensions/);
  });
});
