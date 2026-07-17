// _pw-launch.test.mjs — the pure, security-relevant helpers shared by the
// multi-artboard export shims (_png/_pdf-playwright.mjs). Regression coverage
// for the arbitrary-file-write finding fixed in the print-artboards dogfood
// pass (DDR-182 addendum): a `data-dc-screen` id is DDR-054 untrusted canvas
// content, and used to be trusted verbatim as a `path.join` segment.

import { describe, expect, test } from 'bun:test';
import { assertRenderOutputSizeOk, safeArtboardFilename } from './_pw-launch.mjs';

describe('safeArtboardFilename', () => {
  test('passes a well-formed id through unchanged', () => {
    expect(safeArtboardFilename('ak-alpha', 0, 'pdf')).toBe('ak-alpha.pdf');
    expect(safeArtboardFilename('Beta_2', 3, 'png')).toBe('Beta_2.png');
  });

  test('falls back to the positional name for a path-traversal id', () => {
    expect(safeArtboardFilename('../../../../tmp/pwned', 2, 'pdf')).toBe('artboard-3.pdf');
    expect(safeArtboardFilename('/etc/passwd', 0, 'png')).toBe('artboard-1.png');
    expect(safeArtboardFilename('..', 1, 'pdf')).toBe('artboard-2.pdf');
  });

  test('falls back for null/undefined/empty/non-string ids', () => {
    expect(safeArtboardFilename(null, 0, 'pdf')).toBe('artboard-1.pdf');
    expect(safeArtboardFilename(undefined, 4, 'png')).toBe('artboard-5.png');
    expect(safeArtboardFilename('', 1, 'pdf')).toBe('artboard-2.pdf');
  });

  test('falls back for an id starting with a digit or containing unsafe chars', () => {
    expect(safeArtboardFilename('1abc', 0, 'pdf')).toBe('artboard-1.pdf');
    expect(safeArtboardFilename('a/b', 0, 'pdf')).toBe('artboard-1.pdf');
    expect(safeArtboardFilename('a b', 0, 'pdf')).toBe('artboard-1.pdf');
  });

  test('falls back for an id over the 64-char cap', () => {
    expect(safeArtboardFilename(`a${'x'.repeat(64)}`, 0, 'pdf')).toBe('artboard-1.pdf');
  });
});

describe('assertRenderOutputSizeOk', () => {
  test('does not exit for a reasonable A4-at-300dpi request', () => {
    const origExit = process.exit;
    let exited = false;
    process.exit = () => {
      exited = true;
    };
    try {
      assertRenderOutputSizeOk(818, 1146, 3.125, '_test');
    } finally {
      process.exit = origExit;
    }
    expect(exited).toBe(false);
  });

  test('exits when the requested output exceeds the max side guard', () => {
    const origExit = process.exit;
    const origError = console.error;
    let exitCode;
    process.exit = (code) => {
      exitCode = code;
      throw new Error('exit'); // stop the (test-only) function from continuing past exit
    };
    console.error = () => {};
    try {
      expect(() => assertRenderOutputSizeOk(20000, 20000, 1, '_test')).toThrow();
    } finally {
      process.exit = origExit;
      console.error = origError;
    }
    expect(exitCode).toBe(1);
  });

  test('exits when the requested output exceeds the byte-size guard even under the side cap', () => {
    const origExit = process.exit;
    const origError = console.error;
    let exitCode;
    process.exit = (code) => {
      exitCode = code;
      throw new Error('exit');
    };
    console.error = () => {};
    try {
      // 15000×15000 stays under the 16000px side cap but blows the ~600MB estimate.
      expect(() => assertRenderOutputSizeOk(15000, 15000, 1, '_test')).toThrow();
    } finally {
      process.exit = origExit;
      console.error = origError;
    }
    expect(exitCode).toBe(1);
  });
});
