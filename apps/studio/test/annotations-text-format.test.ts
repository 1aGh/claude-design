// annotations text-format polish — multi-line tspans, italic / underline,
// ordered + unordered lists, dashed shapes, and the highlighter pen. The PARSE
// side needs a DOMParser (happy-dom, registered per-file). The load-bearing
// assertions: every NEW field serializes ONLY when set (the byte-identical
// round-trip canary holds for legacy/unstyled strokes), and multi-line text
// reconstructs its `\n` from tspans (list markers stripped).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import {
  type EllipseStroke,
  listPrefixedBody,
  type PenStroke,
  type RectStroke,
  type StickyStroke,
  splitTextLines,
  stickyCornerPath,
  stripEditorMarkers,
  strokeBBox,
  strokesToSvg,
  svgToStrokes,
  type TextStroke,
} from '../annotations-layer.tsx';
import { sanitizeAnnotationSvg } from '../api.ts';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

/** Re-serialize a freshly-parsed SVG. Idempotency helper. */
function reparse(svg: string): string {
  return strokesToSvg(svgToStrokes(svg));
}

const baseStandalone: TextStroke = {
  id: 't1',
  tool: 'text',
  color: '#1f1f1f',
  fontSize: 14,
  text: 'one line',
  x: 40,
  y: 60,
};

// ─────────────────────────────────────────────────────────────────────────────
// Multi-line text (item 4a)

describe('text-format / multi-line tspans', () => {
  test('single-line text emits NO tspan and round-trips byte-identical', () => {
    const svg = strokesToSvg([baseStandalone]);
    expect(svg).not.toContain('<tspan');
    expect(reparse(svg)).toBe(svg);
  });

  test('standalone multi-line text emits one tspan per line and recovers \\n', () => {
    const multi: TextStroke = { ...baseStandalone, text: 'line one\nline two\nline three' };
    const svg = strokesToSvg([multi]);
    expect((svg.match(/<tspan/g) ?? []).length).toBe(3);
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.text).toBe('line one\nline two\nline three');
    expect(reparse(svg)).toBe(svg); // idempotent
  });

  test('anchored multi-line text round-trips its \\n', () => {
    const anchored: TextStroke = {
      id: 'ta',
      tool: 'text',
      color: '#1f1f1f',
      fontSize: 16,
      text: 'top\nbottom',
      anchorId: 'host-1',
    };
    const svg = strokesToSvg([anchored]);
    expect(svg).toContain('<tspan');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.anchorId).toBe('host-1');
    expect(parsed?.text).toBe('top\nbottom');
    expect(reparse(svg)).toBe(svg);
  });

  test('multi-line text survives the PUT-path sanitizer byte-intact (tspan allowlisted)', () => {
    const svg = strokesToSvg([{ ...baseStandalone, text: 'a\nb' }]);
    expect(sanitizeAnnotationSvg(svg)).toBe(svg);
    const [parsed] = svgToStrokes(sanitizeAnnotationSvg(svg)) as TextStroke[];
    expect(parsed?.text).toBe('a\nb');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Italic + underline (item 4b)

describe('text-format / italic + underline', () => {
  test('italic serializes font-style only when set; round-trips', () => {
    const plain = strokesToSvg([baseStandalone]);
    expect(plain).not.toContain('font-style');
    const svg = strokesToSvg([{ ...baseStandalone, italic: true }]);
    expect(svg).toContain('font-style="italic"');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.italic).toBe(true);
    expect(reparse(svg)).toBe(svg);
  });

  test('underline serializes text-decoration only when set; round-trips', () => {
    const svg = strokesToSvg([{ ...baseStandalone, underline: true }]);
    expect(svg).toContain('text-decoration="underline"');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.underline).toBe(true);
    expect(parsed?.strike).toBeUndefined();
    expect(reparse(svg)).toBe(svg);
  });

  test('strike + underline combine into one text-decoration (order stable)', () => {
    const svg = strokesToSvg([{ ...baseStandalone, strike: true, underline: true }]);
    expect(svg).toContain('text-decoration="line-through underline"');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.strike).toBe(true);
    expect(parsed?.underline).toBe(true);
    expect(reparse(svg)).toBe(svg);
  });

  test('strike-only stays byte-identical to the legacy line-through form', () => {
    const svg = strokesToSvg([{ ...baseStandalone, strike: true }]);
    expect(svg).toContain('text-decoration="line-through"');
    expect(svg).not.toContain('underline');
  });

  test('all four formats (bold+italic+strike+underline) combine + round-trip', () => {
    // The editors commit bold/italic/underline (Cmd+B/I/U) + strike together;
    // assert every flag serializes and survives the round-trip.
    const svg = strokesToSvg([
      { ...baseStandalone, bold: true, italic: true, strike: true, underline: true },
    ]);
    expect(svg).toContain('font-weight="700"');
    expect(svg).toContain('font-style="italic"');
    expect(svg).toContain('text-decoration="line-through underline"');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.bold).toBe(true);
    expect(parsed?.italic).toBe(true);
    expect(parsed?.strike).toBe(true);
    expect(parsed?.underline).toBe(true);
    expect(reparse(svg)).toBe(svg);
  });

  test('sticky italic + underline round-trip; a plain sticky gains no attrs', () => {
    const plain: StickyStroke = {
      id: 'st',
      tool: 'sticky',
      color: '#fce8a6',
      x: 0,
      y: 0,
      w: 200,
      h: 200,
      text: 'note',
      fontSize: 16,
    };
    expect(strokesToSvg([plain])).not.toContain('data-italic');
    const svg = strokesToSvg([{ ...plain, italic: true, underline: true }]);
    expect(svg).toContain('data-italic="1"');
    expect(svg).toContain('data-underline="1"');
    const [parsed] = svgToStrokes(svg) as StickyStroke[];
    expect(parsed?.italic).toBe(true);
    expect(parsed?.underline).toBe(true);
    expect(reparse(svg)).toBe(svg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lists (item 4c)

describe('text-format / ordered + unordered lists', () => {
  test('bullet list: data-list set, markers render-only, stored text clean', () => {
    const svg = strokesToSvg([{ ...baseStandalone, text: 'apple\npear', listType: 'bullet' }]);
    expect(svg).toContain('data-list="bullet"');
    expect(svg).toContain('• apple');
    expect(svg).toContain('• pear');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    // Stored text has NO marker — markers are presentation only.
    expect(parsed?.text).toBe('apple\npear');
    expect(parsed?.listType).toBe('bullet');
    expect(reparse(svg)).toBe(svg);
  });

  test('numbered list: per-line N. markers, re-numbered from stored text', () => {
    const svg = strokesToSvg([
      { ...baseStandalone, text: 'first\nsecond\nthird', listType: 'number' },
    ]);
    expect(svg).toContain('1. first');
    expect(svg).toContain('2. second');
    expect(svg).toContain('3. third');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.text).toBe('first\nsecond\nthird');
    expect(parsed?.listType).toBe('number');
    expect(reparse(svg)).toBe(svg);
  });

  test('a single-line list item still round-trips (forces a tspan)', () => {
    const svg = strokesToSvg([{ ...baseStandalone, text: 'solo', listType: 'bullet' }]);
    expect(svg).toContain('<tspan');
    expect(svg).toContain('• solo');
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.text).toBe('solo');
    expect(parsed?.listType).toBe('bullet');
    expect(reparse(svg)).toBe(svg);
  });

  test('a line that literally starts with the marker is not double-stripped', () => {
    const svg = strokesToSvg([{ ...baseStandalone, text: '• already', listType: 'bullet' }]);
    const [parsed] = svgToStrokes(svg) as TextStroke[];
    expect(parsed?.text).toBe('• already');
    expect(reparse(svg)).toBe(svg);
  });

  test('no list ⇒ no data-list attribute (canary)', () => {
    expect(strokesToSvg([baseStandalone])).not.toContain('data-list');
  });

  test('sticky list round-trips with markers render-only (body text stays raw)', () => {
    const svg = strokesToSvg([
      {
        id: 'sl',
        tool: 'sticky',
        color: '#fce8a6',
        x: 0,
        y: 0,
        w: 200,
        h: 200,
        text: 'buy milk\nbuy eggs',
        fontSize: 16,
        listType: 'bullet',
      },
    ]);
    expect(svg).toContain('data-list="bullet"');
    // The persisted sticky body <text> keeps RAW text (no marker).
    expect(svg).toContain('>buy milk\nbuy eggs<');
    const [parsed] = svgToStrokes(svg) as StickyStroke[];
    expect(parsed?.text).toBe('buy milk\nbuy eggs');
    expect(parsed?.listType).toBe('bullet');
    expect(reparse(svg)).toBe(svg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashed rect / ellipse (item 7)

describe('text-format / dashed shapes', () => {
  const rect: RectStroke = {
    id: 'r',
    tool: 'rect',
    color: '#1f1f1f',
    width: 2,
    x: 0,
    y: 0,
    w: 80,
    h: 60,
    fill: null,
  };
  const ellipse: EllipseStroke = {
    id: 'e',
    tool: 'ellipse',
    color: '#1f1f1f',
    width: 2,
    cx: 40,
    cy: 30,
    rx: 30,
    ry: 20,
    fill: null,
  };

  test('solid rect / ellipse emit no dash attr (canary)', () => {
    expect(strokesToSvg([rect])).not.toContain('data-dash');
    expect(strokesToSvg([ellipse])).not.toContain('data-dash');
    expect(reparse(strokesToSvg([rect]))).toBe(strokesToSvg([rect]));
    expect(reparse(strokesToSvg([ellipse]))).toBe(strokesToSvg([ellipse]));
  });

  test('dashed rect round-trips data-dash + stroke-dasharray', () => {
    const svg = strokesToSvg([{ ...rect, dashed: true }]);
    expect(svg).toContain('data-dash="1"');
    expect(svg).toContain('stroke-dasharray="6 4"');
    const [parsed] = svgToStrokes(svg) as RectStroke[];
    expect(parsed?.dashed).toBe(true);
    expect(reparse(svg)).toBe(svg);
  });

  test('dashed ellipse round-trips data-dash', () => {
    const svg = strokesToSvg([{ ...ellipse, dashed: true }]);
    expect(svg).toContain('data-dash="1"');
    const [parsed] = svgToStrokes(svg) as EllipseStroke[];
    expect(parsed?.dashed).toBe(true);
    expect(reparse(svg)).toBe(svg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Highlighter pen (item 8) — appended after Task 9.

describe('text-format / highlighter pen', () => {
  const pen: PenStroke = {
    id: 'p',
    tool: 'pen',
    color: '#1f1f1f',
    width: 3,
    points: [
      [0, 0],
      [10, 0],
    ],
  };

  test('a normal pen emits no data-highlighter (canary)', () => {
    const svg = strokesToSvg([pen]);
    expect(svg).not.toContain('data-highlighter');
    expect(reparse(svg)).toBe(svg);
  });

  test('a highlighter pen round-trips data-highlighter + wide translucent stroke', () => {
    const hl: PenStroke = { ...pen, highlighter: true, width: 16, color: '#ffe40066' };
    const svg = strokesToSvg([hl]);
    expect(svg).toContain('data-highlighter="1"');
    const [parsed] = svgToStrokes(svg) as PenStroke[];
    expect(parsed?.highlighter).toBe(true);
    expect(parsed?.width).toBe(16);
    expect(parsed?.color).toBe('#ffe40066');
    expect(reparse(svg)).toBe(svg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Render-contract helpers (item 1 sticky corner + item 4a bbox)

describe('text-format / sticky sharp-corner path (item 1)', () => {
  test('stickyCornerPath rounds TL/TR/BL and keeps the bottom-right SHARP', () => {
    const d = stickyCornerPath(0, 0, 100, 80, 8);
    // The BR corner is a straight L to the exact corner (no Q arc there): the
    // right edge drops to (100,80) then the bottom edge runs to the BL arc.
    expect(d).toContain('L100 80'); // sharp bottom-right corner vertex
    // Three rounded corners ⇒ exactly three quadratic arcs (TR, BL, TL).
    expect((d.match(/Q/g) ?? []).length).toBe(3);
    expect(d.endsWith('Z')).toBe(true);
  });

  test('radius clamps to half the smaller side (never self-overlaps)', () => {
    const d = stickyCornerPath(0, 0, 10, 200, 999);
    // r clamps to min(999, 5, 100) = 5; the first move starts at x = r = 5.
    expect(d.startsWith('M5 0')).toBe(true);
  });
});

describe('text-format / editor list markers (item 4c — show while editing)', () => {
  test('listPrefixedBody adds markers; stripEditorMarkers removes them (round-trip)', () => {
    expect(listPrefixedBody('a\nb', 'bullet')).toBe('• a\n• b');
    expect(listPrefixedBody('a\nb\nc', 'number')).toBe('1. a\n2. b\n3. c');
    expect(listPrefixedBody('a\nb', undefined)).toBe('a\nb');
    for (const list of ['bullet', 'number'] as const) {
      const raw = 'milk\neggs\nbread';
      // The editor shows markers; on commit they strip back to the raw text.
      expect(stripEditorMarkers(listPrefixedBody(raw, list), list)).toBe(raw);
    }
  });

  test('stripEditorMarkers removes a numbered prefix regardless of the typed number', () => {
    // A user who edits/reorders lines may leave stale numbers; strip is generic.
    expect(stripEditorMarkers('1. x\n5. y\nz', 'number')).toBe('x\ny\nz');
    expect(stripEditorMarkers('• keep\nno marker', 'bullet')).toBe('keep\nno marker');
    expect(stripEditorMarkers('untouched', undefined)).toBe('untouched');
  });
});

describe('text-format / multi-line bbox (item 4a)', () => {
  test('a standalone multi-line text bbox grows with line count', () => {
    const single = strokeBBox({
      id: 't',
      tool: 'text',
      color: '#000',
      fontSize: 20,
      text: 'one',
      x: 0,
      y: 0,
    });
    const triple = strokeBBox({
      id: 't',
      tool: 'text',
      color: '#000',
      fontSize: 20,
      text: 'one\ntwo\nthree',
      x: 0,
      y: 0,
    });
    expect(single?.h).toBeCloseTo(20 * 1.2, 4); // single-line keeps legacy height
    expect(triple?.h).toBeGreaterThan((single?.h ?? 0) * 2); // ~3 lines tall
    expect(splitTextLines('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
  });
});
