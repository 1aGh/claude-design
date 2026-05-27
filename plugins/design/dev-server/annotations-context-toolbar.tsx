/**
 * @file       annotations-context-toolbar.tsx — Phase 5.1 per-selection toolbar
 * @scope      plugins/design/dev-server/annotations-context-toolbar.tsx
 * @purpose    FigJam-style floating chrome anchored above the currently
 *             selected annotation strokes. Reads `useAnnotationSelection` +
 *             `useStrokesStore`; mutations dispatch through the store so the
 *             debounced save kicks in automatically.
 *
 * Positioning:
 *   - Compute the union bbox in screen coords by calling
 *     `getBoundingClientRect` on each selected stroke's rendered SVG node
 *     (the SVG sits inside `.dc-world` so the rect already reflects the
 *     world's CSS zoom + translate).
 *   - Anchor 8 px above the bbox. Fall back to BELOW if there's no headroom.
 *
 * Field visibility — intersect across selection per the plan:
 *   - color, delete: always
 *   - fill: only when every stroke is rect or ellipse
 *   - thickness: only when every stroke is pen or arrow
 *   - font-size: only when at least one stroke is text (and the rest are its host)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Stroke, useStrokesStore } from './annotations-layer.tsx';
import { useAnnotationSelectionOptional } from './use-annotation-selection.tsx';

// G6 — FigJam-style 11-color palette. Same colors for both stroke and fill
// so the swatch row identity stays consistent when the user flips the
// Stroke|Fill mode toggle (only the target attribute changes, not the
// visual vocabulary).
const PALETTE = [
  '#1E1E1E', // black
  '#757575', // gray
  '#E03E3E', // red
  '#F26B3F', // orange
  '#F2C744', // yellow
  '#4CAF50', // green
  '#14B8A6', // teal
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#FFFFFF', // white
] as const;

const FILL_PALETTE = PALETTE;

const TOOLBAR_CSS = `
.dc-annot-ctx {
  position: fixed;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--u-bg-0, var(--bg-0, rgba(255,255,255,0.98)));
  border: 1px solid var(--u-fg-0, #1c1917);
  border-radius: 8px;
  padding: 6px 8px;
  box-shadow: 0 6px 24px color-mix(in oklab, var(--u-fg-0, #1c1917) 10%, transparent);
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--u-fg-0, var(--fg-0, #1a1a1a));
  user-select: none;
  pointer-events: auto;
}
.dc-annot-ctx-sw {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.12);
  cursor: pointer;
  padding: 0;
  appearance: none;
}
.dc-annot-ctx-sw[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--maude-hud-accent, #d63b1f);
  border-color: transparent;
}
.dc-annot-ctx-fill--none {
  background: #fff;
  position: relative;
}
.dc-annot-ctx-fill--none::after {
  content: "";
  position: absolute; inset: 2px;
  background:
    linear-gradient(135deg, transparent 47%, #d63b1f 47%, #d63b1f 53%, transparent 53%);
}
.dc-annot-ctx-sep {
  width: 1px;
  align-self: stretch;
  background: rgba(0,0,0,0.10);
  margin: 0 2px;
}
.dc-annot-ctx-btn {
  appearance: none;
  background: transparent;
  border: 1px solid var(--u-fg-0, rgba(0,0,0,0.6));
  border-radius: 0;
  padding: 3px 8px;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.dc-annot-ctx-btn[aria-pressed="true"] {
  background: var(--maude-hud-accent, #d63b1f);
  color: var(--maude-hud-accent-fg, #fff);
  border-color: transparent;
}
.dc-annot-ctx-btn:hover { background: rgba(0,0,0,0.04); }
.dc-annot-ctx-btn--danger { color: #b3271a; }
.dc-annot-ctx-btn--danger:hover { background: rgba(214,59,31,0.08); }

/* T30 / G_S1 — collapsed Stroke|Fill mode toggle. Shown only when the
   selection supports both stroke + fill (rect / ellipse). When the toggle is
   present the swatch row beneath shows ONE palette at a time. */
.dc-annot-ctx-mode {
  display: inline-flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.18);
}
.dc-annot-ctx-mode-btn {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 3px 8px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  font-size: 11px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  line-height: 1;
}
.dc-annot-ctx-mode-btn[aria-pressed="true"] {
  background: color-mix(in oklab, var(--maude-hud-accent, #d63b1f) 14%, transparent);
  color: var(--maude-hud-accent, #d63b1f);
  font-weight: 600;
}
.dc-annot-ctx-mode-btn:not([aria-pressed="true"]):hover {
  background: rgba(0,0,0,0.04);
}
/* Trailing overflow Delete — quiet by default, expressive on hover.
   Keyboard Backspace remains the primary delete affordance. */
.dc-annot-ctx-overflow {
  margin-left: auto;
}
`.trim();

function ensureToolbarStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-annot-ctx-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-annot-ctx-css';
  s.textContent = TOOLBAR_CSS;
  document.head.appendChild(s);
}

function unionRect(rects: DOMRect[]): { x: number; y: number; w: number; h: number } | null {
  if (rects.length === 0) return null;
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.width === 0 && r.height === 0) continue;
    if (r.left < xMin) xMin = r.left;
    if (r.top < yMin) yMin = r.top;
    if (r.right > xMax) xMax = r.right;
    if (r.bottom > yMax) yMax = r.bottom;
  }
  if (!Number.isFinite(xMin)) return null;
  return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
}

type SwatchMode = 'stroke' | 'fill';

export function AnnotationContextToolbar() {
  ensureToolbarStyles();
  const annotSel = useAnnotationSelectionOptional();
  const store = useStrokesStore();
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [, force] = useState({});
  // T30 / G_S1 — collapsed Stroke|Fill toggle state. Defaults to 'stroke';
  // auto-reverts to 'stroke' whenever caps.fill is false so the toggle
  // can't get stranded on a hidden mode after the selection changes type.
  const [swatchMode, setSwatchMode] = useState<SwatchMode>('stroke');

  const selectedStrokes = useMemo<Stroke[]>(() => {
    if (!annotSel || !store) return [];
    const map = new Map(store.strokes.map((s) => [s.id, s]));
    const out: Stroke[] = [];
    for (const id of annotSel.selectedIds) {
      const s = map.get(id);
      if (s) out.push(s);
    }
    return out;
  }, [annotSel, store]);

  // Capabilities — intersection across selected types.
  const caps = useMemo(() => {
    if (selectedStrokes.length === 0) {
      return { color: false, fill: false, thickness: false, fontSize: false };
    }
    const allFillable = selectedStrokes.every((s) => s.tool === 'rect' || s.tool === 'ellipse');
    // T20 — rect + ellipse now carry stroke weight too.
    const allThickness = selectedStrokes.every(
      (s) => s.tool === 'pen' || s.tool === 'arrow' || s.tool === 'rect' || s.tool === 'ellipse'
    );
    const anyText = selectedStrokes.some((s) => s.tool === 'text');
    return {
      color: true,
      fill: allFillable,
      thickness: allThickness,
      fontSize: anyText,
    };
  }, [selectedStrokes]);

  // Position tracker — uses rAF to follow pan/zoom while the toolbar is up.
  useEffect(() => {
    if (selectedStrokes.length === 0) return;
    const tick = () => {
      rafRef.current = null;
      const el = ref.current;
      if (!el) return;
      const rects: DOMRect[] = [];
      for (const s of selectedStrokes) {
        const node = document.querySelector(`[data-id="${cssEscape(s.id)}"]`);
        if (node) rects.push(node.getBoundingClientRect());
      }
      const u = unionRect(rects);
      if (!u) {
        el.style.display = 'none';
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      el.style.display = 'flex';
      // Lay out off-screen first so the size is real, then position.
      const tbW = el.offsetWidth || 280;
      const tbH = el.offsetHeight || 36;
      const margin = 8;
      let top = u.y - tbH - margin;
      if (top < 8) top = u.y + u.h + margin;
      let left = u.x + (u.w - tbW) / 2;
      const winW = typeof window !== 'undefined' ? window.innerWidth : tbW + 16;
      if (left < 8) left = 8;
      if (left + tbW > winW - 8) left = winW - tbW - 8;
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [selectedStrokes]);

  // Force a re-render when the strokes themselves mutate (the position rAF
  // already follows the bbox; this ensures the active-state of the swatches
  // reflects the current color/fill/thickness without a full app re-render).
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedStrokes is the trigger; force is a setState identity.
  useEffect(() => {
    force({});
  }, [selectedStrokes]);

  const setColor = useCallback(
    (c: string) => {
      if (!store) return;
      for (const s of selectedStrokes) store.updateStroke(s.id, { color: c });
    },
    [store, selectedStrokes]
  );
  const setFill = useCallback(
    (f: string | null) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'rect' || s.tool === 'ellipse') {
          store.updateStroke(s.id, { fill: f } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const setThickness = useCallback(
    (w: number) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        // T20 — rect + ellipse now carry stroke weight.
        if (s.tool === 'pen' || s.tool === 'arrow' || s.tool === 'rect' || s.tool === 'ellipse') {
          store.updateStroke(s.id, { width: w } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const setFontSize = useCallback(
    (sz: number) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text') {
          store.updateStroke(s.id, { fontSize: sz } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const remove = useCallback(() => {
    if (!annotSel || !store) return;
    store.deleteStrokes(annotSel.selectedIds);
    annotSel.clear();
  }, [annotSel, store]);

  if (!annotSel || !store || selectedStrokes.length === 0) return null;

  // Active values for swatch highlighting — when uniform across selection.
  const uniqColor = uniformValue(selectedStrokes.map((s) => s.color));
  const uniqFill = caps.fill
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'rect' || s.tool === 'ellipse' ? (s.fill ?? null) : undefined
        )
      )
    : undefined;
  const uniqThickness = caps.thickness
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'pen' || s.tool === 'arrow' || s.tool === 'rect' || s.tool === 'ellipse'
            ? s.width
            : undefined
        )
      )
    : undefined;
  const uniqFontSize = caps.fontSize
    ? uniformValue(selectedStrokes.map((s) => (s.tool === 'text' ? s.fontSize : undefined)))
    : undefined;

  // T30 / G_S1 — when caps.fill is false we never enter fill mode. The
  // useEffect below could call setSwatchMode('stroke') but reading the
  // effective mode inline avoids an extra render cycle.
  const effectiveMode: SwatchMode = caps.fill ? swatchMode : 'stroke';
  const showPalette = effectiveMode === 'stroke' ? PALETTE : FILL_PALETTE;
  const onSwatchClick =
    effectiveMode === 'stroke' ? (c: string) => setColor(c) : (c: string) => setFill(c);
  const activeValue = effectiveMode === 'stroke' ? uniqColor : (uniqFill ?? null);

  return (
    <div
      ref={ref}
      className="dc-annot-ctx"
      role="toolbar"
      aria-label="Annotation properties"
      style={{ display: 'flex', top: -9999, left: -9999 }}
    >
      {caps.fill ? (
        <>
          <div className="dc-annot-ctx-mode" role="radiogroup" aria-label="Swatch target">
            <button
              type="button"
              className="dc-annot-ctx-mode-btn"
              aria-pressed={effectiveMode === 'stroke'}
              onClick={() => setSwatchMode('stroke')}
            >
              Stroke
            </button>
            <button
              type="button"
              className="dc-annot-ctx-mode-btn"
              aria-pressed={effectiveMode === 'fill'}
              onClick={() => setSwatchMode('fill')}
            >
              Fill
            </button>
          </div>
          <div className="dc-annot-ctx-sep" />
        </>
      ) : null}
      {effectiveMode === 'fill' ? (
        <button
          type="button"
          className="dc-annot-ctx-sw dc-annot-ctx-fill--none"
          aria-label="No fill"
          aria-pressed={uniqFill == null}
          title="No fill"
          onClick={() => setFill(null)}
        />
      ) : null}
      {showPalette.map((c) => (
        <button
          key={c}
          type="button"
          className="dc-annot-ctx-sw"
          aria-label={`${effectiveMode === 'stroke' ? 'Color' : 'Fill'} ${c}`}
          aria-pressed={activeValue === c}
          title={`${effectiveMode === 'stroke' ? 'Color' : 'Fill'} ${c}`}
          style={{ background: c }}
          onClick={() => onSwatchClick(c)}
        />
      ))}
      {caps.thickness && effectiveMode === 'stroke' ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-btn"
            aria-pressed={uniqThickness === 3}
            title="Thin (3px)"
            onClick={() => setThickness(3)}
          >
            Thin
          </button>
          <button
            type="button"
            className="dc-annot-ctx-btn"
            aria-pressed={uniqThickness === 6}
            title="Thick (6px)"
            onClick={() => setThickness(6)}
          >
            Thick
          </button>
        </>
      ) : null}
      {caps.fontSize ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-btn"
            aria-pressed={uniqFontSize === 12}
            title="Small (12px)"
            onClick={() => setFontSize(12)}
          >
            S
          </button>
          <button
            type="button"
            className="dc-annot-ctx-btn"
            aria-pressed={uniqFontSize === 14}
            title="Medium (14px)"
            onClick={() => setFontSize(14)}
          >
            M
          </button>
          <button
            type="button"
            className="dc-annot-ctx-btn"
            aria-pressed={uniqFontSize === 20}
            title="Large (20px)"
            onClick={() => setFontSize(20)}
          >
            L
          </button>
        </>
      ) : null}
      <button
        type="button"
        className="dc-annot-ctx-btn dc-annot-ctx-btn--danger dc-annot-ctx-overflow"
        title="Delete (Backspace)"
        aria-label="Delete selected annotations"
        onClick={remove}
      >
        Delete
      </button>
    </div>
  );
}
AnnotationContextToolbar.displayName = 'AnnotationContextToolbar';

function uniformValue<T>(values: (T | undefined)[]): T | undefined {
  const filtered = values.filter((v) => v !== undefined) as T[];
  if (filtered.length === 0) return undefined;
  const first = filtered[0];
  return filtered.every((v) => v === first) ? first : undefined;
}

function cssEscape(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
