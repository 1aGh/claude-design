// The DISK round-trip for an imported FigJam board: strokes → SVG → sanitize →
// re-parse. The parse side needs a DOMParser, which bun:test does not expose,
// so happy-dom is registered for THIS FILE ONLY (beforeAll/afterAll) — the same
// split `annotations-layer.test.ts` / `annotations-roundtrip.test.ts` already
// uses, so the rest of the suite keeps running DOM-free.
//
// Two properties are load-bearing and neither is covered by the DOM-free tests:
//
//  1. **The emitted file passes `sanitizeAnnotationSvg` without losing
//     content.** DDR-216 D6's annotation row requires the sanitizer to run
//     before write. If this translator ever emitted something outside the
//     element allowlist, the sanitizer would silently strip it and the import
//     would lose strokes with no error anywhere.
//  2. **Connector binds survive to disk and back.** "Always editable" (the
//     governing principle) is only true if an imported arrow is still a LIVE,
//     re-routable bind after a save/load cycle — not a frozen line.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import type { ArrowStroke, Stroke } from '../annotations-model.ts';
import { sanitizeAnnotationSvg, strokesToSvg, svgToStrokes } from '../annotations-model.ts';
import { toStrokes } from './to-strokes.ts';
import { normalizeDocument } from './types.ts';

beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

/** A small board carrying one of each round-trip-relevant shape. */
function board() {
  return {
    id: '0:0',
    name: 'Document',
    type: 'CANVAS',
    children: [
      {
        id: '1:2',
        name: 'Sekce vnější',
        type: 'SECTION',
        absoluteBoundingBox: box(-500, -500, 1200, 900),
      },
      {
        id: '1:8',
        name: 'Sticky',
        type: 'STICKY',
        absoluteBoundingBox: box(-400, -400, 240, 240),
        characters: 'Persona A',
      },
      {
        id: '2:17',
        name: 'Příliš žluťoučký — "test" / <b> & \'x\'',
        type: 'SHAPE_WITH_TEXT',
        shapeType: 'SQUARE',
        absoluteBoundingBox: box(0, 0, 200, 200),
        characters: 'Čtverec',
      },
      {
        id: '2:21',
        name: 'Ellipse',
        type: 'SHAPE_WITH_TEXT',
        shapeType: 'ELLIPSE',
        absoluteBoundingBox: box(300, 0, 200, 200),
      },
      {
        id: '2:50',
        name: 'Archetyp',
        type: 'TEXT',
        absoluteBoundingBox: box(0, 300, 120, 30),
        characters: 'Archetyp',
        style: { fontSize: 16 },
      },
      {
        id: '2:67',
        name: 'C1',
        type: 'CONNECTOR',
        absoluteBoundingBox: box(200, 100, 100, 10),
        connectorStart: { endpointNodeId: '2:17' },
        connectorEnd: { endpointNodeId: '2:21' },
        connectorEndCap: 'ARROW_LINES',
      },
      {
        id: '2:71',
        name: 'C2 → TEXT (the widening case)',
        type: 'CONNECTOR',
        absoluteBoundingBox: box(100, 250, 100, 10),
        connectorStart: { endpointNodeId: '2:21' },
        connectorEnd: { endpointNodeId: '2:50' },
        connectorEndCap: 'ARROW_LINES',
      },
    ],
  };
}

function translated() {
  const doc = normalizeDocument(board(), { fileKey: 'Em6NOwaOFTYV7NlQT4NK8l', surface: 'board' });
  return toStrokes(doc, { resetIds: true });
}

const kinds = (list: readonly Stroke[]) => list.map((s) => s.tool).sort();

describe('imported board → SVG → sanitize → re-parse', () => {
  test('the sanitizer loses nothing — every stroke survives', () => {
    const { strokes } = translated();
    const reparsed = svgToStrokes(sanitizeAnnotationSvg(strokesToSvg(strokes)));
    expect(reparsed.length).toBe(strokes.length);
    expect(kinds(reparsed)).toEqual(kinds(strokes));
  });

  test('connector binds survive — the arrow stays LIVE, not frozen', () => {
    const { strokes } = translated();
    const reparsed = svgToStrokes(sanitizeAnnotationSvg(strokesToSvg(strokes)));
    const boundOf = (list: readonly Stroke[]) =>
      (list.filter((s) => s.tool === 'arrow') as ArrowStroke[]).filter(
        (a) => a.startBind || a.endBind
      ).length;
    expect(boundOf(strokes)).toBeGreaterThan(0);
    expect(boundOf(reparsed)).toBe(boundOf(strokes));
  });

  test('the bind onto a TEXT host survives the round-trip (DDR-216 D9)', () => {
    const { strokes } = translated();
    const textStroke = strokes.find((s) => s.tool === 'text' && s.text === 'Archetyp');
    const reparsed = svgToStrokes(sanitizeAnnotationSvg(strokesToSvg(strokes)));
    const stillBound = (reparsed.filter((s) => s.tool === 'arrow') as ArrowStroke[]).some(
      (a) => a.endBind?.hostId === textStroke?.id || a.startBind?.hostId === textStroke?.id
    );
    expect(stillBound).toBe(true);
  });

  test('the hostile layer name never survives as markup', () => {
    const { strokes } = translated();
    const sanitized = sanitizeAnnotationSvg(strokesToSvg(strokes));
    expect(sanitized).not.toContain('<b>');
    expect(sanitized).not.toContain('<script');
    // …and no event handler or style attribute ever appears.
    expect(sanitized).not.toMatch(/\son[a-z]+=/i);
  });

  test('sticky geometry survives the round-trip un-normalised', () => {
    const { strokes } = translated();
    const reparsed = svgToStrokes(sanitizeAnnotationSvg(strokesToSvg(strokes)));
    const sticky = reparsed.find((s) => s.tool === 'sticky') as { w: number; h: number };
    expect([sticky.w, sticky.h]).toEqual([240, 240]);
  });
});
