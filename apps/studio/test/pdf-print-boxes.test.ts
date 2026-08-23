// feature-2-print-artboards T5 — the load-bearing golden gate: MediaBox ⊇
// BleedBox ⊇ TrimBox with exact expected pt values, plus marks presence.
// Exercises pdf-lib directly (no Playwright/Chromium needed — box-setting
// and mark-drawing are pure pdf-lib API calls); the page size mirrors what
// Chromium's page.pdf() would actually produce for an artboard authored via
// resolvePrintArtboard (96dpi CSS px → pt, same ratio as mm → pt).

import { describe, expect, test } from 'bun:test';
import { PDFDocument } from 'pdf-lib';

import { readArtboardPrintProp } from '../canvas-edit.ts';
import {
  applyPageFit,
  applyPrintBoxesAndMarks,
  artboardIdFromCssPath,
  type PdfPrintOptions,
  parsePageFit,
  parsePdfPrintOptions,
  resolvePdfDeviceScale,
} from '../exporters/pdf.ts';
import { requiredSlugPt } from '../print/marks.ts';
import {
  getPaperPreset,
  mmToPt,
  pxToPt,
  resolvePrintArtboard,
  trimSizeMm,
} from '../print/units.ts';

const NO_MARKS: PdfPrintOptions = {
  marks: { crop: false, registration: false, colorBars: false, pageInfo: false },
};

describe('pdf.ts — artboardIdFromCssPath', () => {
  test('extracts the id from the artboard-by-id selector shape', () => {
    expect(artboardIdFromCssPath('[data-dc-screen="home"]')).toBe('home');
  });

  test('a descendant / :first-of-type selector yields null', () => {
    expect(artboardIdFromCssPath('.some .descendant')).toBeNull();
    expect(artboardIdFromCssPath('[data-dc-screen]:first-of-type')).toBeNull();
    expect(artboardIdFromCssPath('[data-dc-screen]')).toBeNull();
  });
});

describe('pdf.ts — parsePdfPrintOptions', () => {
  test('absent/malformed → null (print post-pass off)', () => {
    expect(parsePdfPrintOptions(undefined)).toBeNull();
    expect(parsePdfPrintOptions(null)).toBeNull();
    expect(parsePdfPrintOptions('nope')).toBeNull();
    expect(parsePdfPrintOptions([1, 2])).toBeNull();
  });

  test('valid shape passes through with marks defaulting false', () => {
    expect(parsePdfPrintOptions({})).toEqual({
      includeBleed: undefined,
      marks: { crop: false, registration: false, colorBars: false, pageInfo: false },
    });
  });

  test('marks flags coerce to strict booleans (non-true → false)', () => {
    expect(parsePdfPrintOptions({ marks: { crop: 'yes', registration: 1 } })).toEqual({
      includeBleed: undefined,
      marks: { crop: false, registration: false, colorBars: false, pageInfo: false },
    });
    expect(parsePdfPrintOptions({ marks: { crop: true, registration: true } })).toEqual({
      includeBleed: undefined,
      marks: { crop: true, registration: true, colorBars: false, pageInfo: false },
    });
  });

  test('includeBleed passes through only when a strict boolean', () => {
    expect(parsePdfPrintOptions({ includeBleed: false })?.includeBleed).toBe(false);
    expect(parsePdfPrintOptions({ includeBleed: 'false' })?.includeBleed).toBeUndefined();
  });
});

describe('pdf.ts — parsePageFit', () => {
  test('a known paper id passes through', () => {
    expect(parsePageFit('a4')).toBe('a4');
    expect(parsePageFit('letter')).toBe('letter');
  });

  test('unknown id / non-string → null', () => {
    expect(parsePageFit('not-a-paper')).toBeNull();
    expect(parsePageFit(42)).toBeNull();
    expect(parsePageFit(undefined)).toBeNull();
  });
});

// Dogfood follow-up (2026-07-16) — a "vector PDF" still embeds raster
// content (dropped photos, large-format art) as a bitmap whose density is
// set by the capturing context's deviceScaleFactor; `dpi` controls that.
describe('pdf.ts — resolvePdfDeviceScale (raster-content density, dogfood follow-up)', () => {
  test("no dpi → 1× (today's unchanged default — NOT png.ts's 2× default)", () => {
    expect(resolvePdfDeviceScale({})).toBe(1);
  });

  test('dpi=300 → 3.125× (300/96)', () => {
    expect(resolvePdfDeviceScale({ dpi: 300 })).toBeCloseTo(300 / 96, 10);
  });

  test('dpi=600 → 6.25×', () => {
    expect(resolvePdfDeviceScale({ dpi: 600 })).toBeCloseTo(600 / 96, 10);
  });

  test("a bare `scale` option (PNG's legacy field) is ignored — PDF has no scale concept", () => {
    expect(resolvePdfDeviceScale({ scale: 3 })).toBe(1);
  });
});

describe('pdf-print-boxes — GOLDEN: A4 + 3mm bleed, no marks', () => {
  test('MediaBox === BleedBox (full page); TrimBox insets by bleedPt exactly', async () => {
    const resolved = resolvePrintArtboard({ paper: 'a4', bleedMm: 3 });
    const pageWidthPt = pxToPt(resolved.widthPx);
    const pageHeightPt = pxToPt(resolved.heightPx);

    const doc = await PDFDocument.create();
    const page = doc.addPage([pageWidthPt, pageHeightPt]);
    applyPrintBoxesAndMarks(page, 3, NO_MARKS);

    const bleedPt = mmToPt(3);
    const media = page.getMediaBox();
    const bleed = page.getBleedBox();
    const trim = page.getTrimBox();

    // No marks requested → no slug → MediaBox is exactly the bleed box.
    expect(media.x).toBeCloseTo(0, 6);
    expect(media.y).toBeCloseTo(0, 6);
    expect(media.width).toBeCloseTo(pageWidthPt, 6);
    expect(media.height).toBeCloseTo(pageHeightPt, 6);

    expect(bleed.x).toBeCloseTo(0, 6);
    expect(bleed.y).toBeCloseTo(0, 6);
    expect(bleed.width).toBeCloseTo(pageWidthPt, 6);
    expect(bleed.height).toBeCloseTo(pageHeightPt, 6);

    expect(trim.x).toBeCloseTo(bleedPt, 6);
    expect(trim.y).toBeCloseTo(bleedPt, 6);
    expect(trim.width).toBeCloseTo(pageWidthPt - 2 * bleedPt, 6);
    expect(trim.height).toBeCloseTo(pageHeightPt - 2 * bleedPt, 6);

    // The load-bearing nesting invariant, independent of the exact numbers above.
    expect(media.x).toBeLessThanOrEqual(bleed.x);
    expect(media.y).toBeLessThanOrEqual(bleed.y);
    expect(media.x + media.width).toBeGreaterThanOrEqual(bleed.x + bleed.width);
    expect(bleed.x).toBeLessThanOrEqual(trim.x);
    expect(bleed.y).toBeLessThanOrEqual(trim.y);
    expect(bleed.x + bleed.width).toBeGreaterThanOrEqual(trim.x + trim.width);
  });
});

describe('pdf-print-boxes — GOLDEN: A4 + 3mm bleed + crop + registration marks', () => {
  test('MediaBox enlarges by the exact required slug, negative origin, content-box unmoved', async () => {
    const resolved = resolvePrintArtboard({ paper: 'a4', bleedMm: 3 });
    const pageWidthPt = pxToPt(resolved.widthPx);
    const pageHeightPt = pxToPt(resolved.heightPx);

    const doc = await PDFDocument.create();
    const page = doc.addPage([pageWidthPt, pageHeightPt]);
    const printOpts: PdfPrintOptions = {
      marks: { crop: true, registration: true, colorBars: false, pageInfo: false },
    };
    applyPrintBoxesAndMarks(page, 3, printOpts);

    const bleedPt = mmToPt(3);
    const slugPt = requiredSlugPt({ crop: true, registration: true });
    const media = page.getMediaBox();
    const bleed = page.getBleedBox();
    const trim = page.getTrimBox();

    // Exact expected pt values — the golden assertion.
    expect(media.x).toBeCloseTo(-slugPt, 6);
    expect(media.y).toBeCloseTo(-slugPt, 6);
    expect(media.width).toBeCloseTo(pageWidthPt + 2 * slugPt, 6);
    expect(media.height).toBeCloseTo(pageHeightPt + 2 * slugPt, 6);
    // MediaBox's negative origin is the marks slug ONLY — bleed box content
    // coordinates are untouched (still start at the page's own (0,0)).
    expect(bleed.x).toBeCloseTo(0, 6);
    expect(bleed.y).toBeCloseTo(0, 6);
    expect(bleed.width).toBeCloseTo(pageWidthPt, 6);
    expect(bleed.height).toBeCloseTo(pageHeightPt, 6);
    expect(trim.x).toBeCloseTo(bleedPt, 6);
    expect(trim.y).toBeCloseTo(bleedPt, 6);
    expect(trim.width).toBeCloseTo(pageWidthPt - 2 * bleedPt, 6);
    expect(trim.height).toBeCloseTo(pageHeightPt - 2 * bleedPt, 6);

    // MediaBox ⊇ BleedBox ⊇ TrimBox, strictly (marks slug > 0 here).
    expect(media.x).toBeLessThan(bleed.x);
    expect(media.width + media.x).toBeGreaterThan(bleed.width + bleed.x);
    expect(bleed.x).toBeLessThan(trim.x);
    expect(bleed.width + bleed.x).toBeGreaterThan(trim.width + trim.x);
  });

  test('marks present as vector ops — saved PDF is measurably larger with marks than without', async () => {
    const resolved = resolvePrintArtboard({ paper: 'a4', bleedMm: 3 });
    const pageWidthPt = pxToPt(resolved.widthPx);
    const pageHeightPt = pxToPt(resolved.heightPx);

    const withoutMarks = await PDFDocument.create();
    applyPrintBoxesAndMarks(withoutMarks.addPage([pageWidthPt, pageHeightPt]), 3, NO_MARKS);
    const withoutBytes = await withoutMarks.save();

    const withMarks = await PDFDocument.create();
    applyPrintBoxesAndMarks(withMarks.addPage([pageWidthPt, pageHeightPt]), 3, {
      marks: { crop: true, registration: true, colorBars: false, pageInfo: false },
    });
    const withBytes = await withMarks.save();

    // 8 crop-mark line segments + 4 registration circles (each an approximated
    // bezier ellipse) + 8 crosshair segments is a non-trivial amount of vector
    // content — the byte-size delta is a reliable proxy without depending on
    // pdf-lib's internal (and version-specific) content-stream compression
    // format for a literal operator-string grep.
    expect(withBytes.byteLength).toBeGreaterThan(withoutBytes.byteLength);
  });
});

describe('pdf-print-boxes — includeBleed:false crops the bleed strip out', () => {
  test('MediaBox/BleedBox collapse onto TrimBox (degenerate but valid nesting)', async () => {
    const resolved = resolvePrintArtboard({ paper: 'a4', bleedMm: 3 });
    const pageWidthPt = pxToPt(resolved.widthPx);
    const pageHeightPt = pxToPt(resolved.heightPx);
    const bleedPt = mmToPt(3);

    const doc = await PDFDocument.create();
    const page = doc.addPage([pageWidthPt, pageHeightPt]);
    applyPrintBoxesAndMarks(page, 3, { ...NO_MARKS, includeBleed: false });

    const media = page.getMediaBox();
    const bleed = page.getBleedBox();
    const trim = page.getTrimBox();

    expect(media.x).toBeCloseTo(bleedPt, 6);
    expect(media.y).toBeCloseTo(bleedPt, 6);
    expect(media.width).toBeCloseTo(pageWidthPt - 2 * bleedPt, 6);
    expect(bleed.x).toBeCloseTo(trim.x, 6);
    expect(bleed.width).toBeCloseTo(trim.width, 6);
  });
});

// RCA issue-pdf-print-export-marks-missing — the shape that shipped broken:
// two `kind="print"` artboards sharing one `print` spec via a top-level const
// (AlligatorsAcko.tsx's actual authoring pattern), not a repeated inline
// literal per artboard. The multi-page loop in exporters/pdf.ts `run()`
// re-resolves readArtboardPrintProp independently per written page (keyed by
// the artboard's own data-dc-screen id — see safeArtboardFilename), so
// asserting it resolves per-artboard-id here is the load-bearing regression
// guard: both pages must get the SAME resolved geometry, not just page 1.
describe('readArtboardPrintProp — shared const print spec resolves for every page (multi-page correlation)', () => {
  const canvas = [
    'const A1_PRINT = { paper: "a1", orientation: "portrait", bleedMm: 3 } as const;',
    'export default function Demo() {',
    '  return (',
    '    <DesignCanvas>',
    '      <DCArtboard id="acko-front" label="A" kind="print" width={816} height={1146} print={A1_PRINT as any}>',
    '        <div>front</div>',
    '      </DCArtboard>',
    '      <DCArtboard id="acko-back" label="B" kind="print" width={816} height={1146} print={A1_PRINT as any}>',
    '        <div>back</div>',
    '      </DCArtboard>',
    '    </DesignCanvas>',
    '  );',
    '}',
  ].join('\n');

  test('both artboard ids resolve to the same non-null print geometry, driving non-degenerate boxes+marks on each page', async () => {
    const front = readArtboardPrintProp('/abs/AlligatorsAcko.tsx', canvas, 'acko-front');
    const back = readArtboardPrintProp('/abs/AlligatorsAcko.tsx', canvas, 'acko-back');
    expect(front).toEqual({ paper: 'a1', orientation: 'portrait', bleedMm: 3 });
    expect(back).toEqual(front);

    const printOpts: PdfPrintOptions = {
      marks: { crop: true, registration: true, colorBars: false, pageInfo: false },
    };
    for (const printProp of [front, back]) {
      if (!printProp) throw new Error('expected a resolved print prop');
      const bleedMm = typeof printProp.bleedMm === 'number' ? printProp.bleedMm : 0;
      const resolved = resolvePrintArtboard({ paper: printProp.paper as string, bleedMm });
      const pageWidthPt = pxToPt(resolved.widthPx);
      const pageHeightPt = pxToPt(resolved.heightPx);
      const doc = await PDFDocument.create();
      const page = doc.addPage([pageWidthPt, pageHeightPt]);
      applyPrintBoxesAndMarks(page, bleedMm, printOpts);
      const media = page.getMediaBox();
      const trim = page.getTrimBox();
      // Non-degenerate: TrimBox strictly inside MediaBox on every side — the
      // exact thing that silently failed to happen when printProp was null.
      expect(media.width).toBeGreaterThan(trim.width);
      expect(media.height).toBeGreaterThan(trim.height);
    }
  });
});

describe('pdf-print-boxes — applyPageFit (non-print artboard scale-to-paper)', () => {
  test('the resulting page is sized to the target paper, content preserved', async () => {
    const doc = await PDFDocument.create();
    // A wide, non-print-sized artboard (e.g. a 1440×1024 digital screen at 96dpi).
    const origWidthPt = pxToPt(1440);
    const origHeightPt = pxToPt(1024);
    doc.addPage([origWidthPt, origHeightPt]);
    expect(doc.getPageCount()).toBe(1);

    await applyPageFit(doc, 0, 'a4');

    expect(doc.getPageCount()).toBe(1); // swapped in place, not appended
    const page = doc.getPage(0);
    // Expected size mirrors applyPageFit's OWN derivation (mmToPt of the
    // preset's raw mm dims via trimSizeMm) — NOT a px-rounded roundtrip via
    // resolvePrintArtboard, which would introduce a spurious sub-pt mismatch.
    const preset = getPaperPreset('a4');
    if (!preset) throw new Error('a4 preset missing');
    const { widthMm, heightMm } = trimSizeMm(preset, 'portrait');
    const { width, height } = page.getSize();
    expect(width).toBeCloseTo(mmToPt(widthMm), 6);
    expect(height).toBeCloseTo(mmToPt(heightMm), 6);
  });

  test('unknown paper id is a no-op (never throws, never mutates)', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    await applyPageFit(doc, 0, 'not-a-paper');
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: 100, height: 100 });
  });
});

// DDR-232 follow-up — the WORKER-lane print gap. pdf.ts read the artboard's
// `print` prop from the canvas source ON DISK; the render worker holds no
// checkout (DDR-230 §1), so every cloud print PDF silently came back with no
// BleedBox/TrimBox and no marks — the fall-through was "not a print artboard".
// The cell now resolves every print artboard's prop up front
// (readAllArtboardPrintProps) and ships it in the job as `options.printProps`.
describe('readAllArtboardPrintProps — what the cell ships to the worker', () => {
  const SRC = `import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";
export default function C() {
  return (
    <DesignCanvas>
      <DCSection id="s" title="t">
        <DCArtboard id="screen" width={400} height={300}><div/></DCArtboard>
        <DCArtboard id="flyer" kind="print" print={{ paper: "a6", bleedMm: 3 }} width={397} height={559}><div/></DCArtboard>
        <DCArtboard id="poster" kind="print" print={{ paper: "a3" }} width={1123} height={1587}><div/></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
`;
  test('collects every print artboard by id and skips screen artboards', async () => {
    const { readAllArtboardPrintProps } = await import('../canvas-edit.ts');
    const props = readAllArtboardPrintProps('/x/c.tsx', SRC);
    expect(Object.keys(props).sort()).toEqual(['flyer', 'poster']);
    expect(props.flyer).toEqual({ paper: 'a6', bleedMm: 3 });
    expect(props.poster).toEqual({ paper: 'a3' });
  });
  test('an unparsable canvas contributes nothing rather than throwing', async () => {
    const { readAllArtboardPrintProps } = await import('../canvas-edit.ts');
    expect(readAllArtboardPrintProps('/x/c.tsx', 'export default <<<')).toEqual({});
  });
});
