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

  test('only bindable tools host (no text/pen/arrow/link)', () => {
    const label: TextStroke = {
      id: 't',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'x',
      x: 0,
      y: 0,
    };
    expect(isBindable(label)).toBe(false);
    expect(bindCandidate(0, 0, [label], BIND_THRESHOLD_PX)).toBeNull();
    expect(isBindable(rect('r'))).toBe(true);
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
