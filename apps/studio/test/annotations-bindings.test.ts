// annotations-bindings — FigJam v3 connector binding (pure, DOM-free).
// Semantics: Excalidraw proximity bind + FigJam side/center magnets; bound
// endpoints derive from the host; deleting the host unbinds + freezes.

import { describe, expect, test } from 'bun:test';

import {
  anchorPoint,
  BIND_THRESHOLD_PX,
  bindCandidate,
  facingAnchor,
  isBindable,
  recomputeBoundArrows,
} from '../annotations-bindings.ts';
import type { ArrowStroke, RectStroke, Stroke, TextStroke } from '../annotations-model.ts';

function rect(id: string, x = 0, y = 0, w = 100, h = 80): RectStroke {
  return { id, tool: 'rect', color: '#1f1f1f', width: 3, x, y, w, h };
}
function arrow(id: string, extra: Partial<ArrowStroke> = {}): ArrowStroke {
  return { id, tool: 'arrow', color: '#1f1f1f', width: 3, x1: 0, y1: 0, x2: 50, y2: 0, ...extra };
}

describe('bindCandidate', () => {
  test('binds within the threshold and snaps to the nearest magnet', () => {
    const strokes: Stroke[] = [rect('host', 100, 100, 100, 100)];
    // Just right of the host's right edge, vertically centered → (1, 0.5).
    const bind = bindCandidate(205, 150, strokes, BIND_THRESHOLD_PX);
    expect(bind).toEqual({ hostId: 'host', nx: 1, ny: 0.5 });
    // Top-left corner region → (0, 0).
    expect(bindCandidate(98, 102, strokes, BIND_THRESHOLD_PX)).toEqual({
      hostId: 'host',
      nx: 0,
      ny: 0,
    });
  });

  test('misses outside the threshold; topmost host wins; exclusions respected', () => {
    const below = rect('below', 0, 0, 100, 100);
    const above = rect('above', 50, 50, 100, 100);
    const strokes: Stroke[] = [below, above];
    expect(bindCandidate(500, 500, strokes, BIND_THRESHOLD_PX)).toBeNull();
    expect(bindCandidate(75, 75, strokes, BIND_THRESHOLD_PX)?.hostId).toBe('above');
    expect(bindCandidate(75, 75, strokes, BIND_THRESHOLD_PX, new Set(['above']))?.hostId).toBe(
      'below'
    );
  });

  test('pen / arrow / link never host', () => {
    expect(isBindable(rect('r'))).toBe(true);
    expect(
      isBindable({ id: 'p', tool: 'pen', color: '#000', width: 2, points: [[0, 0]] } as Stroke)
    ).toBe(false);
    expect(
      isBindable({
        id: 'l',
        tool: 'link',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        url: 'https://x.test',
        title: 't',
        domain: 'x.test',
      } as Stroke)
    ).toBe(false);
  });
});

// DDR-216 D9 — the widening, and the three exclusions that keep it from
// regressing the NATIVE whiteboard. FigJam binds connectors to anything; on the
// only real board measured, 2/2 connectors had an endpoint Maude could not bind,
// so an imported connector degraded to a frozen line. Widening also closes a
// plain native gap (you could not attach an arrow to a text label or a section).
describe('isBindable widening — text + section (DDR-216 D9)', () => {
  const standaloneText = (over: Partial<TextStroke> = {}): TextStroke => ({
    id: 't',
    tool: 'text',
    color: '#1a1a1a',
    fontSize: 14,
    text: 'Archetyp',
    x: 0,
    y: 0,
    ...over,
  });

  const section = (id: string, x = 0, y = 0, w = 400, h = 300): Stroke =>
    ({ id, tool: 'section', x, y, w, h, label: 'Sekce', color: '#8b8b94' }) as Stroke;

  test('standalone text IS bindable, and hosts a real bind', () => {
    const label = standaloneText();
    expect(isBindable(label)).toBe(true);
    const bind = bindCandidate(1, 1, [label], BIND_THRESHOLD_PX);
    expect(bind?.hostId).toBe('t');
  });

  test('ANCHORED text is NOT bindable — its bbox is unresolvable here', () => {
    // `strokeBBox` returns null for anchored text without the anchors map, which
    // every caller in this module omits. Admitting it would mint a bind that can
    // never resolve — worse than not binding, because it never self-corrects.
    const anchored = standaloneText({ anchorId: 'some-shape' });
    expect(isBindable(anchored)).toBe(false);
    expect(bindCandidate(0, 0, [anchored], BIND_THRESHOLD_PX)).toBeNull();
  });

  test('oversized text is NOT offered — no board-wide bind magnet', () => {
    // A TextStroke has no stored w/h; strokeBBox synthesizes one from content,
    // so 5 000 chars on one line projects a ~38 500 px-wide invisible strip.
    const huge = standaloneText({ text: 'x'.repeat(5000) });
    expect(isBindable(huge)).toBe(false);
    // A rect under the cursor still wins, rather than the giant text stealing it.
    const r = rect('r', 0, 0, 100, 100);
    expect(bindCandidate(50, 50, [r, huge], BIND_THRESHOLD_PX)?.hostId).toBe('r');
  });

  test('a section binds on its BORDER, matching strokeHitTest', () => {
    const s = section('sec');
    expect(isBindable(s)).toBe(true);
    expect(bindCandidate(0, 150, [s], BIND_THRESHOLD_PX)?.hostId).toBe('sec');
  });

  test('a section does NOT swallow binds through its click-through interior', () => {
    // The natural gesture is to draw a section AROUND existing notes, which puts
    // it later in the array = topmost. Testing its raw bbox would make every
    // arrow drawn between two stickies inside it bind to the section instead.
    const inner = rect('inner', 100, 100, 60, 60);
    const s = section('sec', 0, 0, 400, 300);
    const strokes: Stroke[] = [inner, s]; // section topmost
    expect(bindCandidate(130, 130, strokes, BIND_THRESHOLD_PX)?.hostId).toBe('inner');
    // Deep interior with nothing under it binds to nothing, not to the section.
    expect(bindCandidate(300, 200, [s], BIND_THRESHOLD_PX)).toBeNull();
  });

  test('a bind whose anchorPoint cannot resolve is STRIPPED, not frozen-but-claimed', () => {
    // Fix 2: `applyEnd` used to `return` silently when anchorPoint was null,
    // which kept a bind that could never be honoured. Inert before the widening,
    // load-bearing after it.
    const ghost = standaloneText({ id: 'ghost', anchorId: 'gone' });
    const ar = arrow('ar', {
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
      startBind: { hostId: 'ghost', nx: 0.5, ny: 0.5 },
    });
    const out = recomputeBoundArrows([ghost, ar]);
    const a = out.find((s) => s.id === 'ar') as ArrowStroke;
    expect(a.startBind).toBeUndefined();
    expect([a.x1, a.y1]).toEqual([0, 0]); // endpoint frozen in place, honestly
  });

  test('a bound arrow follows a text host as it moves', () => {
    const label = standaloneText({ x: 0, y: 0 });
    const ar = arrow('ar', {
      x1: 0,
      y1: 0,
      x2: 300,
      y2: 300,
      startBind: { hostId: 't', nx: 0, ny: 0 },
    });
    const moved: Stroke[] = [{ ...label, x: 40, y: 60 }, ar];
    const out = recomputeBoundArrows(moved);
    const a = out.find((s) => s.id === 'ar') as ArrowStroke;
    // The exact bbox is content-derived; what matters is that it TRACKED.
    expect(a.startBind?.hostId).toBe('t');
    expect(a.x1).not.toBe(0);
  });
});

describe('anchorPoint / recomputeBoundArrows', () => {
  test('bound endpoints follow the host on move (translate → recompute)', () => {
    const host = rect('host', 0, 0, 100, 100);
    const ar = arrow('ar', {
      x1: 100,
      y1: 50,
      x2: 300,
      y2: 50,
      startBind: { hostId: 'host', nx: 1, ny: 0.5 },
    });
    const moved: Stroke[] = [{ ...host, x: 50, y: 20 }, ar];
    const out = recomputeBoundArrows(moved);
    const a = out.find((s) => s.id === 'ar') as ArrowStroke;
    expect([a.x1, a.y1]).toEqual([150, 70]);
    expect([a.x2, a.y2]).toEqual([300, 50]); // free end untouched
  });

  test('anchor stays proportional through a host resize', () => {
    const host = rect('host', 0, 0, 200, 100);
    expect(anchorPoint(host, 0.5, 1)).toEqual([100, 100]);
    expect(anchorPoint({ ...host, w: 400 }, 0.5, 1)).toEqual([200, 100]);
  });

  test('missing host → bind stripped, endpoint frozen (arrow survives)', () => {
    const ar = arrow('ar', {
      x1: 100,
      y1: 50,
      x2: 300,
      y2: 50,
      startBind: { hostId: 'gone', nx: 1, ny: 0.5 },
    });
    const out = recomputeBoundArrows([ar]);
    const a = out.find((s) => s.id === 'ar') as ArrowStroke;
    expect(a.startBind).toBeUndefined();
    expect([a.x1, a.y1]).toEqual([100, 50]);
  });

  test('referential no-op when every endpoint already sits at its anchor', () => {
    const host = rect('host', 0, 0, 100, 100);
    const ar = arrow('ar', {
      x1: 100,
      y1: 50,
      x2: 300,
      y2: 50,
      startBind: { hostId: 'host', nx: 1, ny: 0.5 },
    });
    const strokes: Stroke[] = [host, ar];
    expect(recomputeBoundArrows(strokes)).toBe(strokes);
  });
});

describe('facingAnchor (AI annotate / quick-create side pick)', () => {
  test('picks the side magnet facing the target', () => {
    const host = rect('h', 0, 0, 100, 100);
    expect(facingAnchor(host, 500, 50)).toEqual({ hostId: 'h', nx: 1, ny: 0.5 });
    expect(facingAnchor(host, -400, 50)).toEqual({ hostId: 'h', nx: 0, ny: 0.5 });
    expect(facingAnchor(host, 50, 900)).toEqual({ hostId: 'h', nx: 0.5, ny: 1 });
    expect(facingAnchor(host, 50, -900)).toEqual({ hostId: 'h', nx: 0.5, ny: 0 });
  });
});

describe('the text bind cap is PER AXIS, not an area product (review F8)', () => {
  test('a long single line at the font-size floor is NOT a bind host', () => {
    // The area cap it replaced was satisfiable by exactly this shape: 4 000
    // chars at fontSize 8 gives w ≈ 17 600 × h ≈ 9.6 — area 168 960, under a
    // 640×480 product — i.e. a 17 600 px-wide invisible magnet.
    const strip: TextStroke = {
      id: 'strip',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 8,
      text: 'x'.repeat(4000),
      x: 0,
      y: 0,
    };
    expect(isBindable(strip)).toBe(false);
    const r = rect('r', 100, 0, 100, 100);
    expect(bindCandidate(150, 50, [r, strip], BIND_THRESHOLD_PX)?.hostId).toBe('r');
  });

  test('an ordinary label is still a bind host', () => {
    const label: TextStroke = {
      id: 't',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'Archetyp',
      x: 0,
      y: 0,
    };
    expect(isBindable(label)).toBe(true);
  });
});
