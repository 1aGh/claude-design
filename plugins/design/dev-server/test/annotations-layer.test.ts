// annotations-layer — Phase 5 pure helpers (no DOM render).
//
// Covers: SVG round-trip (strokesToSvg + svgToStrokes), pen path serialization,
// arrow-head geometry, eraser hit-test across all three shapes.
//
// `svgToStrokes` reads via DOMParser; bun:test exposes one through happy-dom
// when imported transitively. We dodge that here by parsing the regex-friendly
// shapes directly and only exercising the parser in the integration test.

import { describe, expect, test } from 'bun:test';

import {
  type ArrowStroke,
  type EllipseStroke,
  type PenStroke,
  type RectStroke,
  type Stroke,
  type TextStroke,
  arrowHeadPoints,
  penPathD,
  rid,
  strokeHitTest,
  strokesShallowEqual,
  strokesToSvg,
} from '../annotations-layer.tsx';

describe('annotations-layer / penPathD', () => {
  test('empty points → empty string', () => {
    expect(penPathD([])).toBe('');
  });

  test('single point → M only', () => {
    expect(penPathD([[10, 20]])).toBe('M10 20');
  });

  test('multiple points → M then L per next', () => {
    expect(
      penPathD([
        [0, 0],
        [10, 10],
        [20, 5],
      ])
    ).toBe('M0 0 L10 10 L20 5');
  });
});

describe('annotations-layer / arrowHeadPoints', () => {
  test('horizontal arrow head is symmetric around the tip', () => {
    const pts = arrowHeadPoints(0, 0, 100, 0, 2);
    // "ax,ay x2,y2 bx,by" — y of the two wings symmetric across y=0
    const tokens = pts.split(' ');
    expect(tokens).toHaveLength(3);
    const [a, tip, b] = tokens.map((t) => t.split(',').map(Number));
    expect(tip).toEqual([100, 0]);
    expect(a?.[1]).toBeCloseTo(-(b?.[1] ?? 0), 4);
    // The wings sit BEFORE the tip on x.
    expect(a?.[0]).toBeLessThan(100);
    expect(b?.[0]).toBeLessThan(100);
  });

  test('zero-length arrow degenerates safely (no NaN)', () => {
    const pts = arrowHeadPoints(50, 50, 50, 50, 2);
    for (const t of pts.split(/[ ,]/)) {
      expect(Number.isFinite(Number(t))).toBe(true);
    }
  });
});

describe('annotations-layer / strokesToSvg', () => {
  test('empty list → self-closing svg shell', () => {
    expect(strokesToSvg([])).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"></svg>'
    );
  });

  test('pen stroke → <path data-tool="pen" d=...>', () => {
    const pen: PenStroke = {
      id: 'p1',
      tool: 'pen',
      color: '#d63b1f',
      width: 2,
      points: [
        [0, 0],
        [10, 10],
      ],
    };
    const svg = strokesToSvg([pen]);
    expect(svg).toContain('data-id="p1"');
    expect(svg).toContain('data-tool="pen"');
    expect(svg).toContain('d="M0 0 L10 10"');
    expect(svg).toContain('stroke="#d63b1f"');
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
  });

  test('rect with negative w/h is clamped to 0 in serialization', () => {
    const rect: RectStroke = {
      id: 'r1',
      tool: 'rect',
      color: '#1d6cf0',
      width: 2,
      x: 10,
      y: 10,
      w: -5,
      h: -8,
    };
    const svg = strokesToSvg([rect]);
    expect(svg).toContain('width="0"');
    expect(svg).toContain('height="0"');
  });

  test('arrow renders as <g> with <line> + <polyline> head', () => {
    const arrow: ArrowStroke = {
      id: 'a1',
      tool: 'arrow',
      color: '#1a8f3e',
      width: 2,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    const svg = strokesToSvg([arrow]);
    expect(svg).toContain('data-tool="arrow"');
    expect(svg).toContain('<line x1="0" y1="0" x2="100" y2="0"');
    expect(svg).toContain('<polyline points=');
  });

  test('color value is HTML-escaped on output (no tag injection)', () => {
    const pen: PenStroke = {
      id: 'p2',
      tool: 'pen',
      color: '"><script>',
      width: 2,
      points: [
        [0, 0],
        [1, 1],
      ],
    };
    const svg = strokesToSvg([pen]);
    // The `<` of <script> and the `"` that would close the attribute are
    // both escaped — those are the two chars that could break out of the
    // stroke="..." attribute. `>` is harmless inside an attribute value, so
    // we don't waste bytes encoding it.
    expect(svg).toContain('stroke="&quot;>&lt;script>"');
    // Belt-and-suspenders: no live <script tag survives anywhere in output.
    expect(svg).not.toMatch(/<script[\s>]/);
  });
});

describe('annotations-layer / strokeHitTest', () => {
  const pen: PenStroke = {
    id: 'p',
    tool: 'pen',
    color: '#000',
    width: 2,
    points: [
      [0, 0],
      [100, 0],
      [100, 100],
    ],
  };

  test('pen hit near the first segment', () => {
    expect(strokeHitTest(pen, 50, 2, 4)).toBe(true);
  });

  test('pen miss far from any segment', () => {
    expect(strokeHitTest(pen, 50, 50, 4)).toBe(false);
  });

  test('pen hit near the corner (transition between segments)', () => {
    expect(strokeHitTest(pen, 101, 50, 4)).toBe(true);
  });

  test('single-point pen stroke is hit-testable as a disk', () => {
    const dot: PenStroke = {
      id: 'd',
      tool: 'pen',
      color: '#000',
      width: 2,
      points: [[10, 10]],
    };
    expect(strokeHitTest(dot, 11, 11, 4)).toBe(true);
    expect(strokeHitTest(dot, 50, 50, 4)).toBe(false);
  });

  test('rect: hit on edge, miss in interior', () => {
    const r: RectStroke = {
      id: 'r',
      tool: 'rect',
      color: '#000',
      width: 2,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    };
    expect(strokeHitTest(r, 0, 50, 4)).toBe(true); // left edge
    expect(strokeHitTest(r, 100, 50, 4)).toBe(true); // right edge
    expect(strokeHitTest(r, 50, 100, 4)).toBe(true); // bottom edge
    expect(strokeHitTest(r, 50, 50, 4)).toBe(false); // interior
    expect(strokeHitTest(r, 500, 500, 4)).toBe(false); // far outside
  });

  test('arrow: hit near shaft, miss otherwise', () => {
    const a: ArrowStroke = {
      id: 'a',
      tool: 'arrow',
      color: '#000',
      width: 2,
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
    };
    expect(strokeHitTest(a, 50, 1, 4)).toBe(true);
    expect(strokeHitTest(a, 50, 50, 4)).toBe(false);
  });

  test('tolerance widens with stroke width', () => {
    const wide: PenStroke = {
      id: 'w',
      tool: 'pen',
      color: '#000',
      width: 20,
      points: [
        [0, 0],
        [100, 0],
      ],
    };
    // 8 world units away vertically, with tol=4 → would miss a thin stroke,
    // but here width 20 raises the floor.
    expect(strokeHitTest(wide, 50, 8, 4)).toBe(true);
  });
});

describe('annotations-layer / rid', () => {
  test('generates a string with the `s_` prefix', () => {
    const id = rid();
    expect(id.startsWith('s_')).toBe(true);
    expect(id.length).toBeGreaterThan(2);
  });

  test('subsequent calls are distinct', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(rid());
    expect(seen.size).toBe(50);
  });
});

describe('annotations-layer / Phase 5.1 ellipse + fill + text + thickness', () => {
  test('ellipse stroke → <ellipse data-tool="ellipse" cx= cy= rx= ry=>', () => {
    const e: EllipseStroke = {
      id: 'e1',
      tool: 'ellipse',
      color: '#7a4ad3',
      width: 2,
      cx: 50,
      cy: 60,
      rx: 30,
      ry: 20,
      fill: null,
    };
    const svg = strokesToSvg([e]);
    expect(svg).toContain('data-id="e1"');
    expect(svg).toContain('data-tool="ellipse"');
    expect(svg).toContain('cx="50"');
    expect(svg).toContain('cy="60"');
    expect(svg).toContain('rx="30"');
    expect(svg).toContain('ry="20"');
    expect(svg).toContain('fill="none"');
  });

  test('rect with fill is serialized with fill="..." (not none)', () => {
    const r: RectStroke = {
      id: 'r-fill',
      tool: 'rect',
      color: '#1d6cf0',
      width: 2,
      x: 0,
      y: 0,
      w: 50,
      h: 50,
      fill: '#fff4d6',
    };
    const svg = strokesToSvg([r]);
    expect(svg).toContain('fill="#fff4d6"');
    expect(svg).not.toContain('fill="none"');
  });

  test('ellipse with explicit fill survives serialization', () => {
    const e: EllipseStroke = {
      id: 'e-fill',
      tool: 'ellipse',
      color: '#1a8f3e',
      width: 2,
      cx: 100,
      cy: 100,
      rx: 40,
      ry: 25,
      fill: '#e6f4ea',
    };
    const svg = strokesToSvg([e]);
    expect(svg).toContain('fill="#e6f4ea"');
  });

  test('text stroke → <text data-tool="text" data-anchor-id= data-font-size=>', () => {
    const t: TextStroke = {
      id: 't1',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'needs padding',
      anchorId: 'r-host',
    };
    const svg = strokesToSvg([t]);
    expect(svg).toContain('data-tool="text"');
    expect(svg).toContain('data-anchor-id="r-host"');
    expect(svg).toContain('data-font-size="14"');
    expect(svg).toContain('>needs padding</text>');
  });

  test('text content is HTML-escaped (no tag injection)', () => {
    const t: TextStroke = {
      id: 't2',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: '<script>alert(1)</script>',
      anchorId: 'host',
    };
    const svg = strokesToSvg([t]);
    expect(svg).toContain('&lt;script>alert(1)&lt;/script>');
    expect(svg).not.toMatch(/<script[\s>]/);
  });

  test('pen thickness round-trips via stroke-width (thin=2 / thick=6)', () => {
    const thick: PenStroke = {
      id: 'pT',
      tool: 'pen',
      color: '#000',
      width: 6,
      points: [
        [0, 0],
        [10, 10],
      ],
    };
    const svg = strokesToSvg([thick]);
    expect(svg).toContain('stroke-width="6"');
  });

  test('ellipse hit-test: stroke band detection (no fill)', () => {
    const e: EllipseStroke = {
      id: 'e',
      tool: 'ellipse',
      color: '#000',
      width: 2,
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 50,
      fill: null,
    };
    // On the perimeter
    expect(strokeHitTest(e, 150, 100, 4)).toBe(true);
    // Inside (no fill) → miss
    expect(strokeHitTest(e, 100, 100, 4)).toBe(false);
    // Far outside → miss
    expect(strokeHitTest(e, 300, 300, 4)).toBe(false);
  });

  test('ellipse hit-test: filled ellipse hits inside', () => {
    const e: EllipseStroke = {
      id: 'e-fill',
      tool: 'ellipse',
      color: '#000',
      width: 2,
      cx: 100,
      cy: 100,
      rx: 50,
      ry: 50,
      fill: '#fff',
    };
    expect(strokeHitTest(e, 100, 100, 4)).toBe(true);
    expect(strokeHitTest(e, 300, 300, 4)).toBe(false);
  });
});

describe('annotations-layer / strokes round-trip is stable for arrays', () => {
  // We don't run svgToStrokes here (DOMParser is environment-bound under
  // bun:test). Instead we assert serialization is deterministic + stable so
  // the wire format doesn't drift across edits.
  const sample: Stroke[] = [
    {
      id: 'p1',
      tool: 'pen',
      color: '#000',
      width: 2,
      points: [
        [1, 2],
        [3, 4],
        [5, 6],
      ],
    },
    {
      id: 'r1',
      tool: 'rect',
      color: '#111',
      width: 2,
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    },
  ];

  test('identical input yields identical output (no randomness)', () => {
    expect(strokesToSvg(sample)).toBe(strokesToSvg(sample));
  });
});

describe('annotations-layer / strokesShallowEqual (drag no-op gate)', () => {
  const pen: PenStroke = {
    id: 'p',
    tool: 'pen',
    color: '#000',
    width: 2,
    points: [[0, 0]],
  };
  const rect: RectStroke = {
    id: 'r',
    tool: 'rect',
    color: '#000',
    width: 2,
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    fill: null,
  };

  test('same reference → true', () => {
    const arr = [pen, rect];
    expect(strokesShallowEqual(arr, arr)).toBe(true);
  });

  test('different references but same entries (same order) → true', () => {
    expect(strokesShallowEqual([pen, rect], [pen, rect])).toBe(true);
  });

  test('different entry reference at any slot → false', () => {
    const penClone: PenStroke = { ...pen };
    expect(strokesShallowEqual([pen, rect], [penClone, rect])).toBe(false);
  });

  test('different length → false', () => {
    expect(strokesShallowEqual([pen], [pen, rect])).toBe(false);
  });

  test('empty arrays → true', () => {
    expect(strokesShallowEqual([], [])).toBe(true);
  });
});
