// FigJam v3 — model schema extension: data-group-ids / data-author /
// data-start-bind / data-end-bind. Three load-bearing assertions:
//   1. the new fixture round-trips BYTE-IDENTICAL (parse → re-serialize),
//   2. legacy strokes (no new fields) serialize WITHOUT any new attribute
//      (the Phase-24 canary holds — covered again here from the model side),
//   3. the sanitizer passes the new data-* attrs through (it denylists only
//      on*/style/href) and poisoned bind values are rejected on parse.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import {
  type AnchorHost,
  type ArrowStroke,
  convertShapeKind,
  type PolygonStroke,
  type RectStroke,
  type StickyStroke,
  type Stroke,
  shapeKindOf,
  strokeBBox,
  strokeHitTest,
  strokesToSvg,
  svgToStrokes,
  type TextStroke,
} from '../annotations-model.ts';
import { sanitizeAnnotationSvg } from '../api.ts';

beforeAll(() => {
  GlobalRegistrator.register();
});
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const FIXTURE_URL = new URL('./fixtures/figjam-v3-groups-bindings.svg', import.meta.url);

describe('figjam-v3 fixture canary', () => {
  test('round-trips byte-identical (groups + nested groups + binds + author)', async () => {
    const fixture = await Bun.file(FIXTURE_URL).text();
    expect(strokesToSvg(svgToStrokes(fixture))).toBe(fixture);
  });

  test('round-trips byte-identical THROUGH the sanitizer', async () => {
    const fixture = await Bun.file(FIXTURE_URL).text();
    expect(sanitizeAnnotationSvg(fixture)).toBe(fixture);
  });

  test('parse recovers the new fields exactly', async () => {
    const strokes = svgToStrokes(await Bun.file(FIXTURE_URL).text());
    const rect = strokes.find((s) => s.id === 's_aaa1') as RectStroke;
    expect(rect.groupIds).toEqual(['g_team1']);
    const sticky = strokes.find((s) => s.id === 's_aaa2') as StickyStroke;
    expect(sticky.groupIds).toEqual(['g_inner', 'g_team1']); // deepest→shallowest order kept
    const arrow = strokes.find((s) => s.id === 's_aaa3') as ArrowStroke;
    expect(arrow.startBind).toEqual({ hostId: 's_aaa1', nx: 1, ny: 0.5 }); // auto
    expect(arrow.endBind).toEqual({ hostId: 's_aaa2', nx: 0, ny: 0.5, pinned: true });
    const note = strokes.find((s) => s.id === 's_aaa4') as TextStroke;
    expect(note.author).toBe('ai');
    // The ellipse carries rotation but none of the other new fields.
    const ell = strokes.find((s) => s.id === 's_aaa5') as Stroke;
    expect(ell.rotation).toBe(15);
    expect('groupIds' in ell).toBe(false);
    expect('author' in ell).toBe(false);
  });
});

describe('serialize-only-non-default invariant for the v3 fields', () => {
  test('a legacy stroke set emits NO v3 attribute', () => {
    const strokes: Stroke[] = [
      { id: 's_1', tool: 'rect', color: '#1f1f1f', width: 3, x: 0, y: 0, w: 10, h: 10 },
      { id: 's_2', tool: 'arrow', color: '#1f1f1f', width: 3, x1: 0, y1: 0, x2: 9, y2: 0 },
    ];
    const svg = strokesToSvg(strokes);
    expect(svg).not.toContain('data-group-ids');
    expect(svg).not.toContain('data-author');
    expect(svg).not.toContain('data-start-bind');
    expect(svg).not.toContain('data-end-bind');
  });

  test('empty groupIds array serializes as no attribute', () => {
    const svg = strokesToSvg([
      {
        id: 's_1',
        tool: 'rect',
        color: '#1f1f1f',
        width: 3,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        groupIds: [],
      },
    ]);
    expect(svg).not.toContain('data-group-ids');
  });
});

describe('poisoned input hardening', () => {
  test('malformed / out-of-range bind values are rejected on parse', () => {
    const bad = [
      'data-start-bind="onlyhost"',
      'data-start-bind="h 2 0.5"', // nx out of [0..1]
      'data-start-bind="h NaN 0.5"',
      'data-start-bind="h 0.5 -1"',
    ];
    for (const attr of bad) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><g data-id="s_x" data-tool="arrow" stroke="#1f1f1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none" ${attr}><line x1="0" y1="0" x2="9" y2="0"/><polyline points="1,1 9,0 1,-1" fill="#1f1f1f"/></g></svg>`;
      const arrow = svgToStrokes(svg).find((s) => s.tool === 'arrow') as ArrowStroke;
      expect(arrow).toBeDefined();
      expect(arrow.startBind).toBeUndefined();
    }
  });

  test('data-author only honours the literal "ai"', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><rect data-id="s_x" data-tool="rect" stroke="#1f1f1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none" x="0" y="0" width="10" height="10" data-author="evil"/></svg>`;
    const rect = svgToStrokes(svg)[0] as RectStroke;
    expect('author' in rect).toBe(false);
  });

  test('sanitizer still strips handlers glued next to the new attrs', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect data-tool="rect" data-group-ids="g_1" onload="alert(1)" x="0" y="0" width="10" height="10"/></svg>`;
    const clean = sanitizeAnnotationSvg(svg);
    expect(clean).toContain('data-group-ids="g_1"');
    expect(clean).not.toContain('onload');
  });
});

describe('rotation (FigJam v3)', () => {
  test('serializes data-rot + presentational transform only when non-zero; round-trips', () => {
    const r: Stroke = {
      id: 's_r',
      tool: 'rect',
      color: '#1f1f1f',
      width: 3,
      x: 0,
      y: 0,
      w: 100,
      h: 50,
      rotation: 30,
    };
    const svg = strokesToSvg([r]);
    expect(svg).toContain('data-rot="30"');
    expect(svg).toContain('transform="rotate(30 50 25)"');
    const back = svgToStrokes(svg);
    expect((back[0] as RectStroke).rotation).toBe(30);
    expect(strokesToSvg(back)).toBe(svg);
    expect(strokesToSvg([{ ...r, rotation: 0 }])).not.toContain('data-rot');
    expect(sanitizeAnnotationSvg(svg)).toBe(svg);
  });

  test('hit-testing happens in the rotated frame', () => {
    // A wide flat bar rotated 90° stands upright: a probe above the original
    // top edge now hits; the original east tip is empty space.
    const bar: Stroke = {
      id: 's_b',
      tool: 'rect',
      color: '#000',
      width: 2,
      x: 0,
      y: 0,
      w: 100,
      h: 10,
      fill: '#fff',
      rotation: 90,
    };
    expect(strokeHitTest(bar, 50, -40, 2)).toBe(true);
    expect(strokeHitTest(bar, 95, 5, 2)).toBe(false);
  });

  test('pen/arrow/anchored text ignore rotation (no attr emitted)', () => {
    const pen: Stroke = {
      id: 's_p',
      tool: 'pen',
      color: '#000',
      width: 3,
      points: [
        [0, 0],
        [10, 10],
      ],
      rotation: 45,
    };
    expect(strokesToSvg([pen])).not.toContain('data-rot');
  });
});

describe('polygon anchored text (Wave G)', () => {
  const diamond: PolygonStroke = {
    id: 'poly1',
    tool: 'polygon',
    shape: 'diamond',
    color: '#1a1a1a',
    width: 2,
    x: 10,
    y: 20,
    w: 120,
    h: 80,
  };
  const label: TextStroke = {
    id: 'txt1',
    tool: 'text',
    color: '#1a1a1a',
    fontSize: 16,
    text: 'decision',
    anchorId: 'poly1',
  };

  test('anchored text inherits a polygon host bbox', () => {
    const anchors = new Map<string, AnchorHost>([[diamond.id, diamond]]);
    expect(strokeBBox(label, anchors)).toEqual({ x: 10, y: 20, w: 120, h: 80 });
  });

  test('serialize → parse round-trips the anchor binding', () => {
    const svg = strokesToSvg([diamond, label]);
    expect(svg).toContain('data-anchor-id="poly1"');
    const back = svgToStrokes(svg);
    const txt = back.find((s) => s.tool === 'text') as TextStroke;
    expect(txt.anchorId).toBe('poly1');
    expect(strokesToSvg(back)).toBe(svg);
  });
});

describe('shape-kind conversion (Wave H)', () => {
  const base: RectStroke = {
    id: 's_conv',
    tool: 'rect',
    color: '#3b82f6',
    width: 3,
    x: 10,
    y: 20,
    w: 100,
    h: 60,
    fill: '#e0ebfd',
    rotation: 30,
    groupIds: ['g_1'],
  };

  test('shapeKindOf maps every closed shape; null otherwise', () => {
    expect(shapeKindOf(base)).toBe('square');
    expect(shapeKindOf({ ...base, cornerRadius: 8 })).toBe('rounded');
    expect(
      shapeKindOf({ id: 'e', tool: 'ellipse', color: '#000', width: 2, cx: 0, cy: 0, rx: 5, ry: 5 })
    ).toBe('circle');
    expect(
      shapeKindOf({
        id: 'p',
        tool: 'polygon',
        shape: 'diamond',
        color: '#000',
        width: 2,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
      })
    ).toBe('diamond');
    expect(shapeKindOf({ id: 't', tool: 'text', color: '#000', fontSize: 14, text: 'x' })).toBe(
      null
    );
  });

  test('rect → circle preserves bbox, styling, rotation, groups, id', () => {
    const patch = convertShapeKind(base, 'circle');
    expect(patch).toMatchObject({ tool: 'ellipse', cx: 60, cy: 50, rx: 50, ry: 30 });
    const converted = { ...base, ...patch } as Stroke;
    // Styling + identity ride along via the merge; stale rect geometry cleared.
    expect(converted.id).toBe('s_conv');
    expect(converted.color).toBe('#3b82f6');
    expect((converted as { fill?: string | null }).fill).toBe('#e0ebfd');
    expect(converted.rotation).toBe(30);
    expect(converted.groupIds).toEqual(['g_1']);
    expect((converted as { x?: number }).x).toBeUndefined();
  });

  test('circle → diamond → square round-trips the bbox', () => {
    const circle = {
      id: 'e2',
      tool: 'ellipse',
      color: '#000',
      width: 2,
      cx: 60,
      cy: 50,
      rx: 50,
      ry: 30,
    } as Stroke;
    const toDiamond = { ...circle, ...convertShapeKind(circle, 'diamond') } as Stroke;
    expect(toDiamond).toMatchObject({
      tool: 'polygon',
      shape: 'diamond',
      x: 10,
      y: 20,
      w: 100,
      h: 60,
    });
    const toSquare = { ...toDiamond, ...convertShapeKind(toDiamond, 'square') } as Stroke;
    expect(toSquare).toMatchObject({ tool: 'rect', x: 10, y: 20, w: 100, h: 60, cornerRadius: 0 });
  });

  test('identity + non-shape conversions return null', () => {
    expect(convertShapeKind(base, 'square')).toBe(null);
    expect(
      convertShapeKind({ id: 't', tool: 'text', color: '#000', fontSize: 14, text: 'x' }, 'circle')
    ).toBe(null);
  });

  test('converted stroke serializes cleanly and round-trips', () => {
    const converted = { ...base, ...convertShapeKind(base, 'triangle') } as Stroke;
    const svg = strokesToSvg([converted]);
    expect(svg).toContain('data-shape="triangle"');
    expect(strokesToSvg(svgToStrokes(svg))).toBe(svg);
  });
});

describe('non-finite geometry hardening (Wave H — security F4)', () => {
  test('Infinity / NaN / non-numeric coords clamp to 0 on parse (no off-board spoof)', () => {
    // A poisoned/synced SVG carries x="1e999" (→ Infinity) and a non-numeric y.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><rect data-id="s_evil" data-tool="rect" stroke="#1f1f1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none" x="1e999" y="abc" width="100" height="50"/></svg>`;
    const rect = svgToStrokes(svg)[0] as RectStroke;
    expect(rect).toBeDefined();
    expect(Number.isFinite(rect.x)).toBe(true);
    expect(Number.isFinite(rect.y)).toBe(true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    // The bbox the AI reader + the renderer both consume is finite — they agree.
    const bb = strokeBBox(rect);
    expect(bb && Number.isFinite(bb.x) && Number.isFinite(bb.w)).toBe(true);
  });

  test('polygon with an Infinity vertex does not blow the bbox to Infinity', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><polygon data-id="s_p" data-tool="polygon" stroke="#1f1f1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none" data-shape="diamond" points="50,0 1e999,25 50,50 0,25"/></svg>`;
    const poly = svgToStrokes(svg)[0] as PolygonStroke;
    if (poly) {
      expect(Number.isFinite(poly.w)).toBe(true);
      expect(Number.isFinite(poly.x)).toBe(true);
    }
  });

  test('finite geometry is untouched (round-trip stays byte-identical)', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" data-mdcc-annotations="1"><rect data-id="s_ok" data-tool="rect" stroke="#1f1f1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill="none" x="12.5" y="-3" width="100" height="50"/></svg>`;
    expect(strokesToSvg(svgToStrokes(svg))).toBe(svg);
  });
});
