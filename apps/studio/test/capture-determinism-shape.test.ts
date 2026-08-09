// Source-shape gates for capture determinism.
//
// These guard properties that only manifest in a browser under load, which CI
// has no way to run — `test/exporters/pw-launch.test.ts` says as much ("the
// launch path itself is integration-shape (needs a real browser)"), and
// `test/export-shim-multi-capture.test.ts` exists precisely because of it. So,
// in that same house style, the FIX SHAPE is asserted at the source level.
//
// Why these particular shapes: the plan's original premise was that frame-step
// capture is "deterministic by construction" — a doc comment in video-comp.tsx
// with nothing enforcing it. It was not true. A seek could fail silently, and
// the capture wait could give up on a wall-clock timer and screenshot a stale
// frame. Serially both were survivable; under any parallel capture neither is.
// If someone deletes these guards, the resulting bug is a valid-looking video
// with wrong frames — invisible to every other test we have.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STUDIO = join(import.meta.dir, '..');
const read = (rel: string) => readFileSync(join(STUDIO, rel), 'utf8');

describe('the seek bridge must not report a seek that did not happen', () => {
  const src = () => read('video-comp.tsx');

  test('no empty catch swallows a failed seekTo', () => {
    // The exact regression: `catch { /* comment only */ }` around the seek.
    const emptyCatch = /catch\s*\{\s*(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)?\s*\}/g;
    const body = src();
    const seekRegion = body.slice(
      body.indexOf('__maude_seek__ = async'),
      body.indexOf('Ordinary-artboard fallback')
    );
    expect(seekRegion.length).toBeGreaterThan(0);
    expect(seekRegion.match(emptyCatch)).toBeNull();
  });

  test('an unlanded seek throws rather than resolving', () => {
    expect(src()).toContain('refusing to report a seek that did not happen');
  });

  test('failures are counted where the shim can read them', () => {
    expect(src()).toContain('__maude_seek_failures__');
  });

  test('a cold Player still gets bounded retries — the fix is not "fail faster"', () => {
    expect(src()).toContain('SEEK_ATTEMPTS');
    expect(src()).toContain('seekEntryWithRetry');
  });
});

describe('the capture shim must refuse a capture built on stale frames', () => {
  test('it reads the in-page failure count and throws on any', () => {
    const shim = read('bin/_video-playwright.mjs');
    expect(shim).toContain('__maude_seek_failures__');
    expect(shim).toMatch(/seekFailures\s*>\s*0/);
    expect(shim).toContain('Refusing to encode');
  });

  test('the refusal happens BEFORE the encoded output is written', () => {
    const shim = read('bin/_video-playwright.mjs');
    const guardAt = shim.indexOf('seekFailures');
    const writeAt = shim.indexOf('writeFileSync(out, Buffer.from(enc.b64');
    expect(guardAt).toBeGreaterThan(0);
    expect(writeAt).toBeGreaterThan(0);
    // Ordering is the whole point — a check after the write ships the bad file.
    expect(guardAt).toBeLessThan(writeAt);
  });
});

describe('encoder guards (unit-shape — these run without a browser)', () => {
  const enc = () => read('exporters/video-encode-lib.ts');

  test('a mismatched frame is rejected, never silently resampled', () => {
    const src = enc();
    expect(src).toContain('refusing to resample');
    // The check must precede the draw, or the resample already happened.
    const guardAt = src.indexOf('refusing to resample');
    const drawAt = src.indexOf('vstate.ctx.drawImage(bmp, 0, 0');
    expect(guardAt).toBeGreaterThan(0);
    expect(guardAt).toBeLessThan(drawAt);
  });

  test("latencyMode is pinned to 'quality' — 'realtime' may drop frames", () => {
    expect(enc()).toContain("latencyMode: 'quality'");
  });

  test('the encoder canvas is NOT cleared between frames — pinned deliberately', () => {
    // Current behaviour: a transparent artboard ghosts the previous frame,
    // because nothing clears the canvas before drawImage. That is a real defect
    // for transparent comps, but changing it is a visual change to every export
    // and belongs in its own change with its own before/after. Pinned here so
    // the next person changes it ON PURPOSE rather than as a side effect.
    expect(enc()).not.toContain('clearRect');
  });
});

describe('bundle cache paths must be content-addressed', () => {
  test('no fixed-name temp bundle two servers could race on', () => {
    const src = read('exporters/_browser-bundles.ts');
    expect(src).toContain('writeHashedBundle');
    expect(src).not.toContain("'maude-video-encode-lib.mjs'");
    expect(src).not.toContain("'maude-video-render-lib.mjs'");
  });
});

describe('the video shim must guard its output size', () => {
  test('it calls assertRenderOutputSizeOk like the pdf shim does', () => {
    const shim = read('bin/_video-playwright.mjs');
    expect(shim).toContain("assertRenderOutputSizeOk(clip.width, clip.height, deviceScaleFactor, '_video-playwright')");
  });
});

describe('timing telemetry must not break the summary contract', () => {
  test('MAUDE_TIMING is filtered in _runtime.ts, not in an adapter', () => {
    const rt = read('exporters/_runtime.ts');
    expect(rt).toContain('TIMING_LINE');
    expect(rt).toContain('onTiming');
    // video.ts parses stdoutLines.at(-1) as its summary JSON — an unfiltered
    // trailing diagnostic line would break EVERY video export.
    const video = read('exporters/video.ts');
    expect(video).toContain('stdoutLines.at(-1)');
    expect(video).not.toContain('MAUDE_TIMING');
  });

  test('both capture paths emit it, so they are comparable', () => {
    const shim = read('bin/_video-playwright.mjs');
    expect(shim).toContain("path: 'frame-step'");
    expect(shim).toContain("path: 'renderer'");
    expect(shim).toContain('stageMs');
  });
});
