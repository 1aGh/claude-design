// annotations round-trip — Phase 21. The PARSE side of the schema (svgToStrokes)
// needs a DOMParser, which bun:test does not expose natively. We register
// happy-dom for THIS file only (beforeAll/afterAll) so the rest of the suite
// keeps running DOM-free; the existing annotations-layer.test.ts covers the
// write side (strokesToSvg) without a DOM.
//
// The load-bearing test here is the back-compat canary (Task 10): a hand-frozen
// pre-Phase-21 fixture must survive parse → re-serialize BYTE-IDENTICAL. Any
// "phantom default" (e.g. always emitting data-end-head="triangle") would bloat
// every legacy SVG on the first load→save cycle and this test would catch it.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import {
  type ArrowStroke,
  type RectStroke,
  type StickyStroke,
  type Stroke,
  type TextStroke,
  strokesToSvg,
  svgToStrokes,
} from '../annotations-layer.tsx';
import { sanitizeAnnotationSvg } from '../api.ts';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

/** Re-serialize a freshly-parsed SVG. Round-trip helper. */
function reparse(svg: string): string {
  return strokesToSvg(svgToStrokes(svg));
}

describe('annotations round-trip / back-compat canary (Task 10)', () => {
  test('a frozen pre-Phase-21 SVG round-trips BYTE-IDENTICAL', async () => {
    const fixture = await Bun.file(
      new URL('./fixtures/phase-20-annotations.svg', import.meta.url)
    ).text();
    // No trailing newline in the fixture; svgToStrokes trims its input but the
    // serializer never emits trailing whitespace, so raw === raw must hold.
    expect(fixture.endsWith('</svg>')).toBe(true);
    const roundTripped = reparse(fixture);
    expect(roundTripped).toBe(fixture);
  });

  test('parsing the fixture yields exactly the five legacy strokes', async () => {
    const fixture = await Bun.file(
      new URL('./fixtures/phase-20-annotations.svg', import.meta.url)
    ).text();
    const strokes = svgToStrokes(fixture);
    expect(strokes.map((s) => s.tool)).toEqual(['pen', 'rect', 'ellipse', 'arrow', 'text']);
    // The legacy rect must NOT pick up a phantom non-zero radius.
    const rect = strokes.find((s) => s.tool === 'rect') as RectStroke;
    expect(rect.cornerRadius ?? 0).toBe(0);
    // The legacy arrow must NOT pick up phantom head/dash overrides.
    const arrow = strokes.find((s) => s.tool === 'arrow') as ArrowStroke;
    expect(arrow.startHead).toBeUndefined();
    expect(arrow.endHead).toBeUndefined();
    expect(arrow.dashed).toBeUndefined();
    // The legacy text keeps its anchor.
    const text = strokes.find((s) => s.tool === 'text') as TextStroke;
    expect(text.anchorId).toBe('r1');
  });
});

describe('annotations round-trip / Phase-21 back-compat canary (Phase 24, Task 2)', () => {
  // A frozen Phase-21-era canvas — sticky + rounded rect + arrow-both-heads-
  // dashed. Phase 24 must round-trip it BYTE-IDENTICAL (the new polygon /
  // 6-head / line-type / bold-strike-align fields all serialize only for
  // non-default values, so a Phase-21 scene gains zero bytes).
  test('a frozen Phase-21 SVG round-trips BYTE-IDENTICAL', async () => {
    const fixture = await Bun.file(
      new URL('./fixtures/phase-21-annotations.svg', import.meta.url)
    ).text();
    expect(fixture.endsWith('</svg>')).toBe(true);
    expect(reparse(fixture)).toBe(fixture);
  });

  test('parsing the Phase-21 fixture keeps each shape free of phantom Phase-24 fields', async () => {
    const fixture = await Bun.file(
      new URL('./fixtures/phase-21-annotations.svg', import.meta.url)
    ).text();
    const strokes = svgToStrokes(fixture);
    expect(strokes.map((s) => s.tool)).toEqual(['sticky', 'rect', 'arrow']);
    const sticky = strokes.find((s) => s.tool === 'sticky') as StickyStroke;
    // No phantom bold/strike/align on a plain sticky.
    expect(sticky.bold).toBeUndefined();
    expect(sticky.strike).toBeUndefined();
    expect(sticky.align).toBeUndefined();
    expect(sticky.cornerRadius).toBe(8);
    const arrow = strokes.find((s) => s.tool === 'arrow') as ArrowStroke;
    expect(arrow.startHead).toBe('triangle');
    expect(arrow.endHead).toBeUndefined(); // triangle is the default → unset
    expect(arrow.dashed).toBe(true);
    expect(arrow.lineType).toBeUndefined(); // straight default → no phantom
  });
});

describe('annotations round-trip / sticky', () => {
  const sticky: StickyStroke = {
    id: 'st1',
    tool: 'sticky',
    color: '#ffe27a',
    x: 40,
    y: 50,
    w: 200,
    h: 160,
    text: 'approve copy?',
    fontSize: 14,
    cornerRadius: 8,
  };

  test('sticky survives serialize → parse with all fields intact', () => {
    const [parsed] = svgToStrokes(strokesToSvg([sticky])) as StickyStroke[];
    expect(parsed).toEqual(sticky);
  });

  test('sticky with multi-line text round-trips the newline', () => {
    const multi: StickyStroke = { ...sticky, text: 'line one\nline two' };
    const [parsed] = svgToStrokes(strokesToSvg([multi])) as StickyStroke[];
    expect(parsed?.text).toBe('line one\nline two');
  });

  test('sticky serialize→parse is idempotent', () => {
    const once = strokesToSvg([sticky]);
    expect(reparse(once)).toBe(once);
  });

  test('sticky never persists a foreignObject (sanitizer would strip it)', () => {
    expect(strokesToSvg([sticky])).not.toContain('foreignObject');
  });

  test('sticky SVG survives sanitizeAnnotationSvg byte-intact (PUT-path)', () => {
    // The persisted form passes through the DDR-060 F1 sanitizer on every PUT.
    // It uses only allowlisted elements (g/rect/text) and no denied attrs, so
    // it must come back unchanged — otherwise sticky text wouldn't persist.
    const svg = strokesToSvg([sticky]);
    expect(sanitizeAnnotationSvg(svg)).toBe(svg);
  });

  test('sticky body text still parses after a sanitize pass', () => {
    const svg = strokesToSvg([{ ...sticky, text: 'survive me' }]);
    const cleaned = sanitizeAnnotationSvg(svg);
    const [parsed] = svgToStrokes(cleaned) as StickyStroke[];
    expect(parsed?.text).toBe('survive me');
  });
});

describe('annotations round-trip / rect corner radius', () => {
  const base: RectStroke = {
    id: 'r',
    tool: 'rect',
    color: '#1d6cf0',
    width: 2,
    x: 0,
    y: 0,
    w: 50,
    h: 50,
    fill: null,
  };

  for (const r of [0, 8, 999]) {
    test(`cornerRadius ${r} round-trips`, () => {
      const [parsed] = svgToStrokes(strokesToSvg([{ ...base, cornerRadius: r }])) as RectStroke[];
      expect(parsed?.cornerRadius ?? 0).toBe(r);
    });
  }
});

describe('annotations round-trip / arrow heads + dash (4 dirs × 2 dash)', () => {
  const base: ArrowStroke = {
    id: 'a',
    tool: 'arrow',
    color: '#1a8f3e',
    width: 2,
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
  };

  // The four FigJam direction presets, expressed as (startHead, endHead) pairs.
  const dirs: Array<{
    name: string;
    startHead: 'none' | 'triangle';
    endHead: 'none' | 'triangle';
  }> = [
    { name: 'none (line)', startHead: 'none', endHead: 'none' },
    { name: 'start', startHead: 'triangle', endHead: 'none' },
    { name: 'end (default)', startHead: 'none', endHead: 'triangle' },
    { name: 'both', startHead: 'triangle', endHead: 'triangle' },
  ];

  for (const d of dirs) {
    for (const dashed of [false, true]) {
      test(`${d.name} + ${dashed ? 'dashed' : 'solid'} round-trips`, () => {
        const arrow: ArrowStroke = {
          ...base,
          startHead: d.startHead,
          endHead: d.endHead,
          dashed,
        };
        const svg = strokesToSvg([arrow]);
        const [parsed] = svgToStrokes(svg) as ArrowStroke[];
        // Normalize defaults: the parser leaves default values undefined.
        expect(parsed?.startHead ?? 'none').toBe(d.startHead);
        expect(parsed?.endHead ?? 'triangle').toBe(d.endHead);
        expect(parsed?.dashed ?? false).toBe(dashed);
        // And it is idempotent at the byte level.
        expect(reparse(svg)).toBe(svg);
      });
    }
  }
});

describe('annotations round-trip / standalone vs anchored text', () => {
  test('standalone text round-trips its world (x, y) and stays unanchored', () => {
    const t: TextStroke = {
      id: 't-std',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 20,
      text: 'side note',
      x: 120,
      y: 80,
    };
    const [parsed] = svgToStrokes(strokesToSvg([t])) as TextStroke[];
    expect(parsed?.anchorId).toBeUndefined();
    expect(parsed?.x).toBe(120);
    expect(parsed?.y).toBe(80);
    expect(parsed?.text).toBe('side note');
    expect(parsed?.fontSize).toBe(20);
  });

  test('anchored text round-trips its host id (back-compat)', () => {
    const t: TextStroke = {
      id: 't-anc',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'label',
      anchorId: 'r-host',
    };
    const [parsed] = svgToStrokes(strokesToSvg([t])) as TextStroke[];
    expect(parsed?.anchorId).toBe('r-host');
    expect(parsed?.x).toBeUndefined();
  });
});

describe('annotations round-trip / mixed scene idempotency', () => {
  test('a scene mixing every Phase 21 shape re-serializes identically', () => {
    const scene: Stroke[] = [
      {
        id: 'p',
        tool: 'pen',
        color: '#000',
        width: 3,
        points: [
          [0, 0],
          [5, 5],
        ],
      },
      {
        id: 'r',
        tool: 'rect',
        color: '#222',
        width: 2,
        x: 0,
        y: 0,
        w: 40,
        h: 40,
        fill: null,
        cornerRadius: 999,
      },
      {
        id: 'a',
        tool: 'arrow',
        color: '#111',
        width: 2,
        x1: 0,
        y1: 0,
        x2: 50,
        y2: 50,
        startHead: 'triangle',
        endHead: 'triangle',
        dashed: true,
      },
      {
        id: 'st',
        tool: 'sticky',
        color: '#ffd6e7',
        x: 10,
        y: 10,
        w: 200,
        h: 160,
        text: 'hi',
        fontSize: 14,
        cornerRadius: 8,
      },
      { id: 'tx', tool: 'text', color: '#000', fontSize: 14, text: 'free', x: 5, y: 6 },
    ];
    const svg = strokesToSvg(scene);
    expect(reparse(svg)).toBe(svg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — polygon, full arrowhead set + line-type, text/sticky bold/strike/
// align. Parse needs a DOMParser (registered via happy-dom above).

describe('annotations round-trip / Phase 24 polygon', () => {
  for (const shape of ['diamond', 'triangle', 'triangle-down'] as const) {
    test(`${shape} round-trips its bbox + shape + fill`, () => {
      const poly = {
        id: `pg-${shape}`,
        tool: 'polygon' as const,
        shape,
        color: '#e5484d',
        width: 3,
        x: 10,
        y: 20,
        w: 80,
        h: 60,
        fill: '#fbe0e1',
      };
      const svg = strokesToSvg([poly]);
      expect(svg).toContain(`data-shape="${shape}"`);
      const [parsed] = svgToStrokes(svg) as Array<typeof poly>;
      expect(parsed?.tool).toBe('polygon');
      expect(parsed?.shape).toBe(shape);
      expect(parsed?.x).toBeCloseTo(10, 4);
      expect(parsed?.y).toBeCloseTo(20, 4);
      expect(parsed?.w).toBeCloseTo(80, 4);
      expect(parsed?.h).toBeCloseTo(60, 4);
      expect(parsed?.fill).toBe('#fbe0e1');
      expect(reparse(svg)).toBe(svg); // idempotent
    });
  }

  test('dashed polygon round-trips the dash flag', () => {
    const svg = strokesToSvg([
      {
        id: 'pg',
        tool: 'polygon',
        shape: 'diamond',
        color: '#222',
        width: 2,
        x: 0,
        y: 0,
        w: 40,
        h: 40,
        dashed: true,
      },
    ]);
    expect(svg).toContain('data-dash="1"');
    const [parsed] = svgToStrokes(svg) as Array<{ dashed?: boolean }>;
    expect(parsed?.dashed).toBe(true);
  });
});

describe('annotations round-trip / Phase 24 full arrowhead set + line-type', () => {
  const heads: ArrowStroke['startHead'][] = [
    'none',
    'line',
    'triangle',
    'triangle-outline',
    'circle',
    'diamond',
  ];
  for (const start of heads) {
    for (const end of heads) {
      test(`heads start=${start} end=${end} round-trip`, () => {
        const arrow: ArrowStroke = {
          id: 'a',
          tool: 'arrow',
          color: '#1a8f3e',
          width: 3,
          x1: 0,
          y1: 0,
          x2: 100,
          y2: 20,
          startHead: start,
          endHead: end,
        };
        const svg = strokesToSvg([arrow]);
        const [parsed] = svgToStrokes(svg) as ArrowStroke[];
        expect(parsed?.startHead ?? 'none').toBe(start);
        expect(parsed?.endHead ?? 'triangle').toBe(end);
        expect(reparse(svg)).toBe(svg);
      });
    }
  }

  for (const lineType of ['straight', 'curved', 'elbow'] as const) {
    test(`lineType=${lineType} round-trips + endpoints recover from the shaft`, () => {
      const arrow: ArrowStroke = {
        id: 'a',
        tool: 'arrow',
        color: '#3b82f6',
        width: 2,
        x1: 12,
        y1: 8,
        x2: 90,
        y2: 64,
        lineType,
      };
      const svg = strokesToSvg([arrow]);
      const [parsed] = svgToStrokes(svg) as ArrowStroke[];
      expect(parsed?.lineType ?? 'straight').toBe(lineType);
      // Endpoints survive whether the shaft is a <line> or a <path>.
      expect(parsed?.x1).toBeCloseTo(12, 4);
      expect(parsed?.y1).toBeCloseTo(8, 4);
      expect(parsed?.x2).toBeCloseTo(90, 4);
      expect(parsed?.y2).toBeCloseTo(64, 4);
      expect(reparse(svg)).toBe(svg);
    });
  }
});

describe('annotations round-trip / Phase 24 text + sticky bold/strike/align', () => {
  for (const align of ['left', 'center', 'right'] as const) {
    test(`standalone text align=${align} + bold + strike round-trips`, () => {
      const t: TextStroke = {
        id: 't',
        tool: 'text',
        color: '#1a1a1a',
        fontSize: 36,
        text: 'huge',
        x: 10,
        y: 20,
        bold: true,
        strike: true,
        align,
      };
      const [parsed] = svgToStrokes(strokesToSvg([t])) as TextStroke[];
      expect(parsed?.bold).toBe(true);
      expect(parsed?.strike).toBe(true);
      // 'left' is the standalone default → serializer omits it → parser leaves undefined.
      expect(parsed?.align ?? 'left').toBe(align);
    });
  }

  test('anchored text default (centre, no bold/strike) stays byte-identical', () => {
    const t: TextStroke = {
      id: 't',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'x',
      anchorId: 'h',
    };
    const svg = strokesToSvg([t]);
    expect(svg).not.toContain('data-align');
    expect(svg).not.toContain('font-weight');
    expect(svg).not.toContain('text-decoration');
    expect(reparse(svg)).toBe(svg);
  });

  test('sticky bold/strike/align round-trips; a plain sticky gains no attrs', () => {
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
    const plainSvg = strokesToSvg([plain]);
    expect(plainSvg).not.toContain('data-bold');
    expect(plainSvg).not.toContain('data-align');
    const styled: StickyStroke = { ...plain, bold: true, strike: true, align: 'center' };
    const svg = strokesToSvg([styled]);
    expect(svg).toContain('data-bold="1"');
    expect(svg).toContain('data-strike="1"');
    expect(svg).toContain('data-align="center"');
    const [parsed] = svgToStrokes(svg) as StickyStroke[];
    expect(parsed?.bold).toBe(true);
    expect(parsed?.strike).toBe(true);
    expect(parsed?.align).toBe('center');
  });
});

describe('annotations round-trip / Phase 24 arrowhead parse-clamp (DDR-067 security)', () => {
  // A hub-pushed SVG with an out-of-vocabulary / poisoned data-*-head must be
  // REJECTED on parse (not cast through unchecked) so it can never reach the
  // serializer to attempt a quote-breakout.
  test('an out-of-vocab data-start-head is dropped, not cast through', () => {
    const dirty =
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
      '<g data-id="a" data-tool="arrow" stroke="#111" stroke-width="2" fill="none" ' +
      'data-start-head="t&quot;onload=&quot;alert(1)" data-end-head="evil">' +
      '<line x1="0" y1="0" x2="50" y2="0"/></g></svg>';
    const [parsed] = svgToStrokes(dirty) as ArrowStroke[];
    expect(parsed?.tool).toBe('arrow');
    expect(parsed?.startHead).toBeUndefined(); // poisoned → rejected
    expect(parsed?.endHead).toBeUndefined(); // 'evil' → rejected
    // Re-serializing the clamped stroke emits NO poisoned attribute.
    const reserialized = strokesToSvg(svgToStrokes(dirty));
    expect(reserialized).not.toContain('onload');
    expect(reserialized).not.toContain('evil');
  });

  test('a valid expanded head (circle/diamond) still round-trips', () => {
    const ok =
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1">' +
      '<g data-id="a" data-tool="arrow" stroke="#111" stroke-width="2" fill="none" data-start-head="circle" data-end-head="diamond">' +
      '<line x1="0" y1="0" x2="50" y2="0"/><polygon points="0,0 0,0 0,0" fill="#111"/><polygon points="0,0 0,0 0,0 0,0" fill="#111"/></g></svg>';
    const [parsed] = svgToStrokes(ok) as ArrowStroke[];
    expect(parsed?.startHead).toBe('circle');
    expect(parsed?.endHead).toBe('diamond');
  });
});
