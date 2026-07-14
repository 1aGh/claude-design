// Local-file / SVG / PDF ingestion (DDR-167). Pure-function coverage first —
// the SVG allowlist sanitizer, pre-parse rejects, write-path containment, and
// the worker-isolated PDF page-count discovery. The browser-driven pieces
// (execution canary, PDF rasterization) are covered in
// import-asset-browser.test.ts (slower, spawns real agent-browser sessions).

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

import {
  assertPdfPageCap,
  assetName,
  containedAssetPath,
  getPdfPageCountIsolated,
  importRaster,
  readPdfCapped,
  readRasterCapped,
  sanitizeSvgAllowlist,
  sniffRasterKind,
  svgPreParseReject,
  writeContainedAsset,
} from '../bin/_import-asset.mjs';

function tmpDesignRoot() {
  const root = mkdtempSync(join(tmpdir(), 'maude-import-asset-'));
  mkdirSync(join(root, '.design'), { recursive: true });
  return root;
}

describe('svgPreParseReject', () => {
  test('accepts a plain, well-formed SVG', () => {
    expect(() =>
      svgPreParseReject('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')
    ).not.toThrow();
  });

  test('rejects oversized input', () => {
    const huge = `<svg xmlns="http://www.w3.org/2000/svg">${'x'.repeat(6 * 1024 * 1024)}</svg>`;
    expect(() => svgPreParseReject(huge)).toThrow(/cap/);
  });

  test('rejects DOCTYPE (XXE class)', () => {
    const xxe =
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>';
    expect(() => svgPreParseReject(xxe)).toThrow(/DOCTYPE/);
  });

  test('rejects a bare ENTITY declaration even without DOCTYPE wrapping', () => {
    expect(() =>
      svgPreParseReject('<!ENTITY x "y"><svg xmlns="http://www.w3.org/2000/svg"/>')
    ).toThrow(/DOCTYPE\/ENTITY/);
  });

  test('rejects a non-declaration processing instruction (xml-stylesheet)', () => {
    const xslt =
      '<?xml version="1.0"?><?xml-stylesheet type="text/xsl" href="https://evil.example/x.xsl"?><svg xmlns="http://www.w3.org/2000/svg"/>';
    expect(() => svgPreParseReject(xslt)).toThrow(/processing instruction/);
  });

  test('allows the single leading XML declaration itself', () => {
    expect(() =>
      svgPreParseReject(
        '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"/>'
      )
    ).not.toThrow();
  });

  test('rejects a non-UTF-8 declared encoding', () => {
    expect(() =>
      svgPreParseReject(
        '<?xml version="1.0" encoding="UTF-16"?><svg xmlns="http://www.w3.org/2000/svg"/>'
      )
    ).toThrow(/encoding/);
  });

  test('rejects content that does not look like SVG/XML', () => {
    expect(() => svgPreParseReject('<html><body>not svg</body></html>')).toThrow(/magic-byte/);
  });
});

describe('sanitizeSvgAllowlist', () => {
  test('strips <script> entirely', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>'
    );
    expect(out).not.toContain('script');
  });

  test('strips foreignObject and its HTML subtree', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>'
    );
    expect(out).not.toContain('foreignObject');
    expect(out).not.toContain('script');
  });

  test('strips every on* event-handler attribute', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" onclick="alert(2)" width="1" height="1"/></svg>'
    );
    expect(out).not.toContain('onload');
    expect(out).not.toContain('onclick');
  });

  test('drops an http(s) href on <use> but keeps the element', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/x.svg#y"/></svg>'
    );
    expect(out).toContain('<use');
    expect(out).not.toContain('evil.example');
  });

  test('drops a javascript: href', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/></svg>'
    );
    expect(out).not.toContain('javascript:');
  });

  test('drops xlink:href the same way as href (namespace-aware)', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="javascript:alert(1)"/></svg>'
    );
    expect(out).not.toContain('javascript:');
  });

  test('keeps a #fragment href', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><rect id="a"/></defs><use href="#a"/></svg>'
    );
    expect(out).toContain('href="#a"');
  });

  test('drops data:image/svg+xml href (nested-SVG reintroduction)', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>'
    );
    expect(out).not.toContain('data:image/svg+xml');
  });

  test('keeps a raster data: href on <image>', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA"/></svg>'
    );
    expect(out).toContain('data:image/png;base64,AAAA');
  });

  test('drops an http(s) FuncIRI on filter (not just href)', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect filter="url(https://evil.example/x.svg#f)" width="1" height="1"/></svg>'
    );
    expect(out).not.toContain('evil.example');
  });

  test('keeps a #fragment FuncIRI on clip-path/mask/filter/marker-*', () => {
    // SVGO minifies ids and may fold <rect> into <path> — assert the FuncIRI
    // survives as a same-document fragment reference, not the exact bytes.
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c"/></defs><rect clip-path="url(#c)" width="1" height="1"/></svg>'
    );
    expect(out).toMatch(/clip-path="url\(#[^"]+\)"/);
    expect(out).not.toContain('evil');
  });

  test('drops <style> elements and style= attributes entirely', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css);</style><rect style="fill:url(https://evil.example/x.svg)" width="1" height="1"/></svg>'
    );
    expect(out).not.toContain('style');
    expect(out).not.toContain('evil.example');
  });

  test('SMIL elements survive as tags but their functional attributes are stripped', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use id="u" href="#a"><animate attributeName="xlink:href" values="javascript:alert(1)" begin="0s" dur="1s"/></use></svg>'
    );
    expect(out).not.toContain('attributeName');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('begin=');
  });

  test('drops an unrecognized/foreign-namespace element at any depth', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><g><g><bogus xmlns="urn:evil">payload</bogus></g></g></svg>'
    );
    expect(out).not.toContain('bogus');
    expect(out).not.toContain('payload');
  });

  test('metadata/title/desc keep text but drop element children', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Acme<script>alert(1)</script></title></svg>'
    );
    expect(out).toContain('Acme');
    expect(out).not.toContain('script');
  });

  test('rejects malformed XML rather than passing through a parsererror element', () => {
    expect(() => sanitizeSvgAllowlist('<svg><rect')).toThrow(/parse/);
  });

  test('rejects a non-svg root element', () => {
    expect(() => sanitizeSvgAllowlist('<notsvg xmlns="http://www.w3.org/2000/svg"/>')).toThrow();
  });

  test('a real, clean logo-shaped SVG round-trips with its visible geometry intact', () => {
    const out = sanitizeSvgAllowlist(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="#4f46e5"/></svg>'
    );
    expect(out).toContain('path');
    expect(out).toContain('#4f46e5');
  });
});

describe('write-path containment (Decision 3)', () => {
  test('assetName is content-addressed and charset-contract-clean', () => {
    const name = assetName(Buffer.from('hello'), 'svg');
    expect(name).toMatch(/^[a-z0-9]{8}\.svg$/);
  });

  test('containedAssetPath resolves inside <root>/<designRoot>/assets', () => {
    const root = tmpDesignRoot();
    const { fileAbs } = containedAssetPath(root, '.design', 'aaaaaaaa.svg');
    expect(fileAbs.startsWith(join(root, '.design', 'assets'))).toBe(true);
  });

  test('writeContainedAsset writes and dedupes identical content', () => {
    const root = tmpDesignRoot();
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf8');
    const r1 = writeContainedAsset(root, '.design', bytes, 'svg');
    const r2 = writeContainedAsset(root, '.design', bytes, 'svg');
    expect(r1.name).toBe(r2.name);
    expect(existsSync(join(root, '.design', 'assets', r1.name))).toBe(true);
  });
});

describe('PDF: readPdfCapped (Decision 2, step 1)', () => {
  test('reads a real file within the cap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-pdf-fixture-'));
    const p = join(dir, 'x.pdf');
    writeFileSync(p, Buffer.from('%PDF-1.4 fixture'));
    const buf = readPdfCapped(p);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('rejects a file over the byte cap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-pdf-fixture-'));
    const p = join(dir, 'big.pdf');
    writeFileSync(p, Buffer.alloc(1024));
    expect(() => readPdfCapped(p, 100)).toThrow(/cap/);
  });

  test('rejects a nonexistent path', () => {
    expect(() => readPdfCapped('/no/such/file.pdf')).toThrow();
  });
});

describe('PDF: getPdfPageCountIsolated (Decision 2, step 2)', () => {
  test('returns the correct page count for a real multi-page PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.addPage([100, 100]);
    doc.addPage([100, 100]);
    const bytes = await doc.save();
    const count = await getPdfPageCountIsolated(Buffer.from(bytes));
    expect(count).toBe(3);
  });

  test('rejects malformed PDF bytes as a clean error, not a hang', async () => {
    await expect(getPdfPageCountIsolated(Buffer.from('not a pdf at all'))).rejects.toThrow(
      /unparseable|malformed/
    );
  });

  test('a real 1-page PDF passes the page cap', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    const bytes = await doc.save();
    const count = await getPdfPageCountIsolated(Buffer.from(bytes));
    expect(() => assertPdfPageCap(count)).not.toThrow();
  });
});

describe('assertPdfPageCap', () => {
  test('rejects a page count over the cap, naming the cap', () => {
    expect(() => assertPdfPageCap(21)).toThrow(/20/);
  });
  test('allows exactly the cap', () => {
    expect(() => assertPdfPageCap(20)).not.toThrow();
  });
});

// DDR-174 (T15) — local raster (PNG/JPEG) ingestion, the vision-reconstruction
// source-image intake path. No sanitize step (raster carries no markup
// surface) — containment + magic-byte re-sniff is the whole control.
describe('sniffRasterKind', () => {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

  test('recognizes a real PNG signature', () => {
    expect(sniffRasterKind(PNG_SIG)).toBe('png');
  });
  test('recognizes a real JPEG signature', () => {
    expect(sniffRasterKind(JPEG_SIG)).toBe('jpg');
  });
  test('rejects non-raster bytes regardless of extension', () => {
    expect(sniffRasterKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(null);
  });
  test('rejects a PDF signature (not a raster format)', () => {
    expect(sniffRasterKind(Buffer.from('%PDF-1.4'))).toBe(null);
  });
});

describe('readRasterCapped (DDR-174 Decision 4)', () => {
  test('reads a real file within the cap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    const p = join(dir, 'x.png');
    writeFileSync(p, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
    const buf = readRasterCapped(p);
    expect(buf.length).toBeGreaterThan(0);
  });

  test('rejects a file over the byte cap', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    const p = join(dir, 'big.png');
    writeFileSync(p, Buffer.alloc(1024));
    expect(() => readRasterCapped(p, 100)).toThrow(/cap/);
  });

  test('rejects a nonexistent path', () => {
    expect(() => readRasterCapped('/no/such/file.png')).toThrow();
  });

  test('rejects an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    const p = join(dir, 'empty.png');
    writeFileSync(p, Buffer.alloc(0));
    expect(() => readRasterCapped(p)).toThrow(/empty/);
  });
});

describe('importRaster (full pipeline)', () => {
  test('content-addresses a real PNG and writes it into assets/', () => {
    const root = tmpDesignRoot();
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    const p = join(dir, 'frame.png');
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    writeFileSync(p, bytes);
    const result = importRaster(p, { root, designRootRel: '.design' });
    expect(result.ext).toBe('png');
    expect(result.ref).toMatch(/^\/assets\/[a-f0-9]{8}\.png$/);
    expect(existsSync(join(root, '.design', 'assets', result.name))).toBe(true);
  });

  test('sniffs the REAL format even when the filename claims otherwise', () => {
    const root = tmpDesignRoot();
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    // A file named .png that is actually a JPEG — the write path must trust
    // the magic bytes, never the extension (mirrors the PDF-page re-sniff
    // discipline already used in importPdf above).
    const p = join(dir, 'lying.png');
    writeFileSync(p, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    const result = importRaster(p, { root, designRootRel: '.design' });
    expect(result.ext).toBe('jpg');
  });

  test('rejects a file with no recognized raster signature', () => {
    const root = tmpDesignRoot();
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    const p = join(dir, 'not-an-image.png');
    writeFileSync(p, Buffer.from('this is plain text, not an image'));
    expect(() => importRaster(p, { root, designRootRel: '.design' })).toThrow(
      /recognized raster image/
    );
  });

  test('dedupes identical raster content across two imports', () => {
    const root = tmpDesignRoot();
    const dir = mkdtempSync(join(tmpdir(), 'maude-import-raster-fixture-'));
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
    const p1 = join(dir, 'a.png');
    const p2 = join(dir, 'b.png');
    writeFileSync(p1, bytes);
    writeFileSync(p2, bytes);
    const r1 = importRaster(p1, { root, designRootRel: '.design' });
    const r2 = importRaster(p2, { root, designRootRel: '.design' });
    expect(r1.name).toBe(r2.name);
  });
});

describe('assetName accepts jpg alongside svg/png (DDR-174)', () => {
  test('a jpg-extension name passes the charset contract', () => {
    const name = assetName(Buffer.from('x'), 'jpg');
    expect(name).toMatch(/^[a-z0-9]{8}\.jpg$/);
  });
});
