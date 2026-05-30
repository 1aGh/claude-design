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

import {
  FILL_PALETTE,
  STROKE_PALETTE,
  type Stroke,
  useStrokesStore,
} from './annotations-layer.tsx';
import {
  IconArrowBothHeads,
  IconArrowEndHead,
  IconArrowNone,
  IconArrowStartHead,
  IconCornerPill,
  IconCornerSoft,
  IconCornerSquare,
  IconDash,
  IconLetterA,
  IconLineThick,
  IconLineThin,
  IconTrash,
} from './canvas-icons.tsx';
import { useAnnotationSelectionOptional } from './use-annotation-selection.tsx';

// Phase 21 — the swatch palettes come from annotations-layer so the draw-time
// chrome and this per-selection toolbar share ONE hue family. STROKE mode shows
// saturated inks; FILL mode shows the index-paired light tints (FigJam: a
// saturated outline over a pale wash of the same hue). They're referenced
// INSIDE the component (render time) — never at module top-level — because
// annotations-layer ↔ this file form an import cycle and a top-level read would
// hit the TDZ before STROKE_PALETTE initializes.

// Phase 21 — dark "property bar" matching FigJam's selection toolbar. A
// near-black rounded pill that floats above the selection; swatches + icons sit
// on dark so colour reads true. Fixed dark values (not canvas tokens) so the
// bar looks identical on any canvas / DS.
const CTX_SURFACE = '#26262b';
const TOOLBAR_CSS = `
.dc-annot-ctx {
  position: fixed;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 2px;
  background: ${CTX_SURFACE};
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 5px 7px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.34), 0 2px 6px rgba(0,0,0,0.22);
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  user-select: none;
  pointer-events: auto;
}
/* Swatches sit in a tight touching band so the colour row reads as ONE
   control, not a loose ramp (graphic-critic blocker 1). 22px hit target. */
.dc-annot-ctx-swrow {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}
.dc-annot-ctx-sw {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.16);
  cursor: pointer;
  padding: 0;
  margin: 0;
  appearance: none;
  transition: transform 80ms ease;
}
.dc-annot-ctx-sw:hover { transform: scale(1.1); }
.dc-annot-ctx-sw[aria-pressed="true"] {
  box-shadow: 0 0 0 2px ${CTX_SURFACE}, 0 0 0 3px rgba(255,255,255,0.92);
  border-color: transparent;
}
.dc-annot-ctx-sw:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}
.dc-annot-ctx-fill--none {
  background: #3a3a40;
  position: relative;
}
.dc-annot-ctx-fill--none::after {
  content: "";
  position: absolute; inset: 4px;
  border-radius: 50%;
  background:
    linear-gradient(135deg, transparent 44%, rgba(255,255,255,0.55) 44%, rgba(255,255,255,0.55) 56%, transparent 56%);
}
.dc-annot-ctx-sep {
  width: 1px;
  height: 16px;
  align-self: center;
  background: rgba(255,255,255,0.09);
  margin: 0 4px;
}
/* Collapsed Stroke|Fill mode toggle (rect / ellipse selections). */
.dc-annot-ctx-mode {
  display: inline-flex;
  border-radius: 7px;
  overflow: hidden;
  background: rgba(255,255,255,0.07);
  padding: 2px;
  gap: 2px;
}
.dc-annot-ctx-mode-btn {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 5px;
  padding: 3px 9px;
  font: inherit;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  font-size: 11px;
  letter-spacing: 0.02em;
  line-height: 1;
}
.dc-annot-ctx-mode-btn[aria-pressed="true"] {
  background: rgba(255,255,255,0.16);
  color: #ffffff;
  font-weight: 600;
}
.dc-annot-ctx-mode-btn:not([aria-pressed="true"]):hover {
  color: rgba(255,255,255,0.9);
}
.dc-annot-ctx-mode-btn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: -1px;
}

/* Icon buttons — light glyph on dark, white-tint hover, white-tint active.
   26px to sit closer to the 20px swatch rhythm (graphic-critic blocker 2). */
.dc-annot-ctx-ibtn {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 7px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.78);
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: background-color 80ms linear, color 80ms linear;
}
.dc-annot-ctx-ibtn:hover {
  background: rgba(255,255,255,0.1);
  color: #ffffff;
}
.dc-annot-ctx-ibtn[aria-pressed="true"] {
  background: rgba(255,255,255,0.18);
  color: #ffffff;
}
.dc-annot-ctx-ibtn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: -2px;
}
.dc-annot-ctx-ibtn--danger { color: rgba(255,255,255,0.7); }
.dc-annot-ctx-ibtn--danger:hover {
  background: color-mix(in oklab, #ff5a4d 26%, transparent);
  color: #ffffff;
}
@media (prefers-reduced-motion: reduce) {
  .dc-annot-ctx-ibtn, .dc-annot-ctx-sw { transition: none; }
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
      return {
        color: false,
        fill: false,
        thickness: false,
        fontSize: false,
        cornerRadius: false,
        arrowDir: false,
        dash: false,
      };
    }
    const allFillable = selectedStrokes.every((s) => s.tool === 'rect' || s.tool === 'ellipse');
    // T20 — rect + ellipse now carry stroke weight too.
    const allThickness = selectedStrokes.every(
      (s) => s.tool === 'pen' || s.tool === 'arrow' || s.tool === 'rect' || s.tool === 'ellipse'
    );
    // Phase 21 — fontSize applies to text + sticky; cornerRadius to rect +
    // sticky; arrow direction + dash to arrows.
    const fontSizeApplicable = selectedStrokes.some(
      (s) => s.tool === 'text' || s.tool === 'sticky'
    );
    const allRectOrSticky = selectedStrokes.every((s) => s.tool === 'rect' || s.tool === 'sticky');
    const allArrow = selectedStrokes.every((s) => s.tool === 'arrow');
    return {
      color: true,
      fill: allFillable,
      thickness: allThickness,
      fontSize: fontSizeApplicable,
      cornerRadius: allRectOrSticky,
      arrowDir: allArrow,
      dash: allArrow,
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
        // Phase 21 — sticky carries fontSize too.
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { fontSize: sz } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  // Phase 21 — corner radius (rect + sticky).
  const setCornerRadius = useCallback(
    (r: number) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'rect' || s.tool === 'sticky') {
          store.updateStroke(s.id, { cornerRadius: r } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  // Phase 21 — arrow head direction (None / Start / End / Both).
  const setArrowDir = useCallback(
    (startHead: 'none' | 'triangle', endHead: 'none' | 'triangle') => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'arrow') {
          store.updateStroke(s.id, { startHead, endHead } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  // Phase 21 — arrow dash toggle.
  const setDashed = useCallback(
    (dashed: boolean) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'arrow') {
          store.updateStroke(s.id, { dashed } as Partial<Stroke>);
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
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'text' || s.tool === 'sticky' ? s.fontSize : undefined
        )
      )
    : undefined;
  // Phase 21 — uniform corner radius across rect/sticky (default per type: rect
  // sharp = 0, sticky soft = 8).
  const uniqRadius = caps.cornerRadius
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'rect'
            ? (s.cornerRadius ?? 0)
            : s.tool === 'sticky'
              ? (s.cornerRadius ?? 8)
              : undefined
        )
      )
    : undefined;
  // Phase 21 — uniform arrow head pair (default start none / end triangle).
  const uniqStartHead = caps.arrowDir
    ? uniformValue(
        selectedStrokes.map((s) => (s.tool === 'arrow' ? (s.startHead ?? 'none') : undefined))
      )
    : undefined;
  const uniqEndHead = caps.arrowDir
    ? uniformValue(
        selectedStrokes.map((s) => (s.tool === 'arrow' ? (s.endHead ?? 'triangle') : undefined))
      )
    : undefined;
  const uniqDashed = caps.dash
    ? uniformValue(
        selectedStrokes.map((s) => (s.tool === 'arrow' ? (s.dashed ?? false) : undefined))
      )
    : undefined;

  // T30 / G_S1 — when caps.fill is false we never enter fill mode. The
  // useEffect below could call setSwatchMode('stroke') but reading the
  // effective mode inline avoids an extra render cycle.
  const effectiveMode: SwatchMode = caps.fill ? swatchMode : 'stroke';
  const showPalette = effectiveMode === 'stroke' ? STROKE_PALETTE : FILL_PALETTE;
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
      <div className="dc-annot-ctx-swrow" role="radiogroup" aria-label="Color">
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
      </div>
      {caps.thickness && effectiveMode === 'stroke' ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Thin stroke"
            aria-pressed={uniqThickness === 3}
            title="Thin (3px)"
            onClick={() => setThickness(3)}
          >
            <IconLineThin />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Thick stroke"
            aria-pressed={uniqThickness === 6}
            title="Thick (6px)"
            onClick={() => setThickness(6)}
          >
            <IconLineThick />
          </button>
        </>
      ) : null}
      {caps.fontSize ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Small text"
            aria-pressed={uniqFontSize === 12}
            title="Small (12px)"
            onClick={() => setFontSize(12)}
          >
            <IconLetterA size={13} />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Medium text"
            aria-pressed={uniqFontSize === 14}
            title="Medium (14px)"
            onClick={() => setFontSize(14)}
          >
            <IconLetterA size={16} />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Large text"
            aria-pressed={uniqFontSize === 20}
            title="Large (20px)"
            onClick={() => setFontSize(20)}
          >
            <IconLetterA size={19} />
          </button>
        </>
      ) : null}
      {caps.cornerRadius ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Square corners"
            aria-pressed={uniqRadius === 0}
            title="Square corners"
            onClick={() => setCornerRadius(0)}
          >
            <IconCornerSquare />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Soft corners"
            aria-pressed={uniqRadius === 8}
            title="Soft corners"
            onClick={() => setCornerRadius(8)}
          >
            <IconCornerSoft />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Pill corners"
            aria-pressed={uniqRadius === 999}
            title="Pill corners"
            onClick={() => setCornerRadius(999)}
          >
            <IconCornerPill />
          </button>
        </>
      ) : null}
      {caps.arrowDir ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Line, no arrowheads"
            aria-pressed={uniqStartHead === 'none' && uniqEndHead === 'none'}
            title="Line (no heads)"
            onClick={() => setArrowDir('none', 'none')}
          >
            <IconArrowNone />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Arrowhead at start"
            aria-pressed={uniqStartHead === 'triangle' && uniqEndHead === 'none'}
            title="Head at start"
            onClick={() => setArrowDir('triangle', 'none')}
          >
            <IconArrowStartHead />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Arrowhead at end"
            aria-pressed={uniqStartHead === 'none' && uniqEndHead === 'triangle'}
            title="Head at end"
            onClick={() => setArrowDir('none', 'triangle')}
          >
            <IconArrowEndHead />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Arrowheads at both ends"
            aria-pressed={uniqStartHead === 'triangle' && uniqEndHead === 'triangle'}
            title="Heads at both ends"
            onClick={() => setArrowDir('triangle', 'triangle')}
          >
            <IconArrowBothHeads />
          </button>
        </>
      ) : null}
      {caps.dash ? (
        <>
          <div className="dc-annot-ctx-sep" />
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Dashed line"
            aria-pressed={uniqDashed === true}
            title="Dashed line"
            onClick={() => setDashed(!(uniqDashed === true))}
          >
            <IconDash />
          </button>
        </>
      ) : null}
      <div className="dc-annot-ctx-sep" />
      <button
        type="button"
        className="dc-annot-ctx-ibtn dc-annot-ctx-ibtn--danger"
        title="Delete (Backspace)"
        aria-label="Delete selected annotations"
        onClick={remove}
      >
        <IconTrash />
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
