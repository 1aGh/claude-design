// export-browser-lane.test.ts — DDR-231 lane-resolution matrix for the client
// half of the hybrid export lanes (client/export-lane.js). Fail-first: red
// before the browser lane existed (the module didn't).

import { describe, expect, test } from 'bun:test';

import {
  BROWSER_CAPTURE_FORMATS,
  browserCaptureEligible,
  captureScale,
  sanitizeCapturedItem,
} from '../client/export-lane.js';

describe('browserCaptureEligible — who captures where', () => {
  const base = { format: 'png', scope: 'artboard', artboardId: 'board-1' };

  test('desktop/local NEVER routes through the browser bridge (playwright spine owns it)', () => {
    expect(browserCaptureEligible({ ...base, exportLane: 'local' })).toBe(false);
    expect(browserCaptureEligible({ ...base, exportLane: undefined })).toBe(false);
  });

  test('a workspace WITH a render service still prefers the browser for png/svg artboard', () => {
    expect(browserCaptureEligible({ ...base, exportLane: 'remote' })).toBe(true);
    expect(browserCaptureEligible({ ...base, exportLane: 'remote', format: 'svg' })).toBe(true);
  });

  test('a workspace WITHOUT a render service gets png/svg artboard too (the DDR-231 win)', () => {
    expect(browserCaptureEligible({ ...base, exportLane: 'none' })).toBe(true);
  });

  test('video formats stay on the jobs lane (Canva/Kapwing pattern — full-CSS fidelity)', () => {
    for (const format of ['mp4', 'webm', 'gif', 'pdf', 'html', 'zip', 'canva']) {
      expect(browserCaptureEligible({ ...base, exportLane: 'remote', format })).toBe(false);
    }
  });

  test('the pptx deck rides the browser lane on its (only) canvas-as-separate scope', () => {
    const deck = { format: 'pptx', scope: 'canvas-as-separate' };
    expect(browserCaptureEligible({ ...deck, exportLane: 'remote' })).toBe(true);
    expect(browserCaptureEligible({ ...deck, exportLane: 'none' })).toBe(true);
    expect(browserCaptureEligible({ ...deck, exportLane: 'local' })).toBe(false);
    expect(
      browserCaptureEligible({ format: 'pptx', scope: 'artboard', exportLane: 'remote' })
    ).toBe(false);
  });

  test('non-artboard scopes stay on the jobs lane (v1: capture what you are looking at)', () => {
    for (const scope of ['selection', 'canvas-as-separate', 'project-raw']) {
      expect(browserCaptureEligible({ ...base, exportLane: 'remote', scope })).toBe(false);
    }
  });

  test('no known artboard → no browser capture (the bridge selects by id)', () => {
    expect(browserCaptureEligible({ ...base, exportLane: 'remote', artboardId: null })).toBe(false);
  });

  test('the format set matches what canvas-lib can actually produce', () => {
    expect([...BROWSER_CAPTURE_FORMATS].sort()).toEqual(['png', 'svg']);
  });
});

describe('sanitizeCapturedItem — the untrusted-reply neutralizer', () => {
  test('a forged HTML blob named .png lands as an inert png (RFD/XSS neutralized)', () => {
    const evil = {
      name: 'invoice.png',
      blob: new Blob(['<script>alert(1)</script>'], { type: 'text/html' }),
    };
    const safe = sanitizeCapturedItem(evil, 'png');
    expect(safe.name).toBe('invoice.png');
    expect(safe.blob.type).toBe('image/png');
  });

  test('a path-traversal / control-char name is stripped to a safe basename', () => {
    const evil = { name: '../../etc/passwd\r\n.png', blob: new Blob(['x']) };
    const safe = sanitizeCapturedItem(evil, 'png');
    expect(safe.name).not.toContain('/');
    expect(safe.name).not.toContain('..');
    expect(safe.name.endsWith('.png')).toBe(true);
  });

  test('svg keeps its extension + MIME; empty/dot-only names fall back', () => {
    expect(
      sanitizeCapturedItem({ name: 'board.svg', blob: new Blob(['<svg/>']) }, 'svg').name
    ).toBe('board.svg');
    const fb = sanitizeCapturedItem({ name: '...', blob: new Blob(['x']) }, 'svg');
    expect(fb.name).toBe('artboard.svg');
    expect(fb.blob.type).toBe('image/svg+xml');
  });
});

describe('captureScale — dpi folds over scale, clamped to the raster guard window', () => {
  test('scale multiplier passes through', () => {
    expect(captureScale({ scale: 2 })).toBe(2);
  });
  test('dpi wins over scale (mirrors exporters/png.ts resolveDeviceScale)', () => {
    expect(captureScale({ dpi: 300, scale: 2 })).toBe(300 / 96);
  });
  test('clamped to [1, 8]', () => {
    expect(captureScale({ dpi: 1200 })).toBe(8);
    expect(captureScale({ scale: 0 })).toBe(1);
    expect(captureScale()).toBe(1);
  });
});
