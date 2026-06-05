/**
 * @file       annotations-context-toolbar.tsx — Phase 5.1 per-selection toolbar
 * @scope      apps/studio/annotations-context-toolbar.tsx
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

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type ArrowHead,
  type ArrowLineType,
  FILL_PALETTE,
  type ListType,
  STICKY_PALETTE,
  STROKE_PALETTE,
  type Stroke,
  type TextAlign,
  useStrokesStore,
} from './annotations-layer.tsx';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowheadCircle,
  IconArrowheadDiamond,
  IconArrowheadLine,
  IconArrowheadTriangle,
  IconArrowheadTriangleOutline,
  IconArrowNone,
  IconBold,
  IconChevronDown,
  IconCornerPill,
  IconCornerSoft,
  IconCornerSquare,
  IconDash,
  IconItalic,
  IconLineCurved,
  IconLineElbow,
  IconLineStraight,
  IconLineThick,
  IconLineThin,
  IconLink,
  IconListBullet,
  IconListOrdered,
  IconStrike,
  IconTrash,
  IconUnderline,
} from './canvas-icons.tsx';
import { useAnnotationSelectionOptional } from './use-annotation-selection.tsx';
import { isHttpUrl, linkDomain } from './use-canvas-media-drop.tsx';

// Phase 24 — arrowhead + line-type option metadata (icon + label per value),
// driving the per-end head dropdowns + the line-type dropdown.
const HEAD_ICON: Record<ArrowHead, (p: { size?: number }) => ReactNode> = {
  none: IconArrowNone,
  line: IconArrowheadLine,
  triangle: IconArrowheadTriangle,
  'triangle-outline': IconArrowheadTriangleOutline,
  circle: IconArrowheadCircle,
  diamond: IconArrowheadDiamond,
};
const HEAD_OPTIONS: ReadonlyArray<{ value: ArrowHead; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'line', label: 'Line' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'triangle-outline', label: 'Triangle (outline)' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
];
const LINETYPE_ICON: Record<ArrowLineType, (p: { size?: number }) => ReactNode> = {
  straight: IconLineStraight,
  curved: IconLineCurved,
  elbow: IconLineElbow,
};
const LINETYPE_OPTIONS: ReadonlyArray<{ value: ArrowLineType; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'curved', label: 'Curved' },
  { value: 'elbow', label: 'Elbow' },
];
// Phase 24 — text alignment (text + sticky) + named font-size presets.
const ALIGN_ICON: Record<TextAlign, (p: { size?: number }) => ReactNode> = {
  left: IconAlignLeft,
  center: IconAlignCenter,
  right: IconAlignRight,
};
const ALIGN_OPTIONS: ReadonlyArray<{ value: TextAlign; label: string }> = [
  { value: 'left', label: 'Align left' },
  { value: 'center', label: 'Align center' },
  { value: 'right', label: 'Align right' },
];
const FONT_SIZE_PRESETS: ReadonlyArray<{ px: number; label: string }> = [
  { px: 12, label: 'Small' },
  { px: 16, label: 'Medium' },
  { px: 24, label: 'Large' },
  { px: 36, label: 'Extra large' },
  { px: 64, label: 'Huge' },
];
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 200;

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
/* Phase 23 — media (image alt / link url) inline text field inside the dark
   property bar. */
.dc-annot-ctx-field {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
}
.dc-annot-ctx-field label { color: rgba(255,255,255,0.6); font-size: 11px; }
.dc-annot-ctx-input {
  width: 220px;
  max-width: 44vw;
  padding: 4px 7px;
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 6px;
  background: rgba(255,255,255,0.06);
  color: #fff;
  font: inherit;
  font-size: 12px;
}
.dc-annot-ctx-input::placeholder { color: rgba(255,255,255,0.4); }
.dc-annot-ctx-input:focus-visible { outline: 2px solid #ffffff; outline-offset: -1px; }
/* Phase 24 — icon dropdown (arrowhead / line-type / text-align). The wrapper
   anchors the menu directly above the trigger. */
.dc-annot-ctx-dd { position: relative; display: inline-flex; }
.dc-annot-ctx-dd-trigger { padding-right: 9px; }
.dc-annot-ctx-dd-caret {
  position: absolute;
  right: 1px;
  bottom: 2px;
  display: inline-flex;
  opacity: 0.5;
  pointer-events: none;
}
.dc-annot-ctx-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1px;
  padding: 4px;
  background: ${CTX_SURFACE};
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.24);
  z-index: 9;
}
.dc-annot-ctx-menu button[aria-checked="true"] {
  background: rgba(255,255,255,0.18);
  color: #ffffff;
}
/* Font-size dropdown — wider trigger showing the current px + a vertical menu
   of named presets and a numeric input. */
.dc-annot-ctx-fs-trigger {
  width: auto;
  min-width: 30px;
  padding: 0 14px 0 7px;
  font-variant-numeric: tabular-nums;
}
.dc-annot-ctx-fs-val { font-size: 12px; }
.dc-annot-ctx-fs-menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
  min-width: 132px;
  background: ${CTX_SURFACE};
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 9px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.24);
  z-index: 9;
}
.dc-annot-ctx-fs-item {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 5px 8px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font: inherit;
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
}
.dc-annot-ctx-fs-item:hover { background: rgba(255,255,255,0.1); }
.dc-annot-ctx-fs-item[aria-checked="true"] { background: rgba(255,255,255,0.18); color: #fff; }
.dc-annot-ctx-fs-px { opacity: 0.5; font-variant-numeric: tabular-nums; }
.dc-annot-ctx-fs-input {
  margin-top: 3px;
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 6px;
  padding: 4px 8px;
  color: #fff;
  font: inherit;
  font-size: 12px;
}
.dc-annot-ctx-fs-input:focus-visible { outline: 2px solid #fff; outline-offset: -1px; }
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
    // Phase 24 — the corner-radius control is rect-only now. Stickies have a
    // fixed soft radius (no switch); the sticky-color swatch row is handled
    // separately below.
    const allRect = selectedStrokes.every((s) => s.tool === 'rect');
    const allArrow = selectedStrokes.every((s) => s.tool === 'arrow');
    // Dash now applies to arrows AND every outlined shape (rect / ellipse /
    // polygon) — item 7. Heads + line-type (arrowDir) stay arrow-only.
    const allDashable = selectedStrokes.every(
      (s) => s.tool === 'arrow' || s.tool === 'rect' || s.tool === 'ellipse' || s.tool === 'polygon'
    );
    return {
      color: true,
      fill: allFillable,
      thickness: allThickness,
      fontSize: fontSizeApplicable,
      cornerRadius: allRect,
      arrowDir: allArrow,
      dash: allDashable,
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
  // Phase 24 — bold / strike / align on text + sticky bodies.
  const setBold = useCallback(
    (bold: boolean) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { bold } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const setStrike = useCallback(
    (strike: boolean) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { strike } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  // Italic / underline / list (items 4b + 4c) — same text + sticky fan-out.
  const setItalic = useCallback(
    (italic: boolean) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { italic } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const setUnderline = useCallback(
    (underline: boolean) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { underline } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const setListType = useCallback(
    (listType: ListType | undefined) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { listType } as Partial<Stroke>);
        }
      }
    },
    [store, selectedStrokes]
  );
  const setAlign = useCallback(
    (align: TextAlign) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'text' || s.tool === 'sticky') {
          store.updateStroke(s.id, { align } as Partial<Stroke>);
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
  // Phase 24 — per-end arrowhead + line-type (replaces the 4 fixed direction
  // presets with two head dropdowns + a routing dropdown).
  const setStartHead = useCallback(
    (startHead: ArrowHead) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'arrow') store.updateStroke(s.id, { startHead } as Partial<Stroke>);
      }
    },
    [store, selectedStrokes]
  );
  const setEndHead = useCallback(
    (endHead: ArrowHead) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'arrow') store.updateStroke(s.id, { endHead } as Partial<Stroke>);
      }
    },
    [store, selectedStrokes]
  );
  const setLineType = useCallback(
    (lineType: ArrowLineType) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (s.tool === 'arrow') store.updateStroke(s.id, { lineType } as Partial<Stroke>);
      }
    },
    [store, selectedStrokes]
  );
  // Dash toggle — arrow + rect / ellipse / polygon (item 7).
  const setDashed = useCallback(
    (dashed: boolean) => {
      if (!store) return;
      for (const s of selectedStrokes) {
        if (
          s.tool === 'arrow' ||
          s.tool === 'rect' ||
          s.tool === 'ellipse' ||
          s.tool === 'polygon'
        ) {
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

  // ── Phase 23 — dedicated panel for a single image / link selection. ─────────
  // Image / link carry no color / fill / thickness, so the generic swatch bar is
  // meaningless for them; render a focused panel instead (image alt for a11y;
  // link url/title + Open). Uncontrolled fields keyed by id commit ONCE on
  // blur/Enter (no per-keystroke undo spam). Multi-select / mixed selections
  // fall through to the generic bar below.
  const soleMedia =
    selectedStrokes.length === 1 &&
    (selectedStrokes[0]?.tool === 'image' || selectedStrokes[0]?.tool === 'link')
      ? selectedStrokes[0]
      : null;
  if (soleMedia?.tool === 'image') {
    const img = soleMedia;
    const commitAlt = (value: string) => {
      const next = value.trim();
      if ((img.alt ?? '') !== next) {
        store.updateStroke(img.id, { alt: next || undefined } as Partial<Stroke>);
      }
    };
    return (
      <div
        ref={ref}
        className="dc-annot-ctx"
        role="toolbar"
        aria-label="Image properties"
        style={{ display: 'flex', top: -9999, left: -9999 }}
      >
        <div className="dc-annot-ctx-field">
          <label htmlFor="dc-img-alt">Alt</label>
          <input
            id="dc-img-alt"
            key={img.id}
            className="dc-annot-ctx-input"
            type="text"
            defaultValue={img.alt ?? ''}
            placeholder="Describe this image (alt text)"
            aria-label="Image alt text"
            onBlur={(e) => commitAlt(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </div>
        <div className="dc-annot-ctx-sep" />
        <button
          type="button"
          className="dc-annot-ctx-ibtn dc-annot-ctx-ibtn--danger"
          aria-label="Delete image"
          title="Delete"
          onClick={remove}
        >
          <IconTrash />
        </button>
      </div>
    );
  }
  if (soleMedia?.tool === 'link') {
    const link = soleMedia;
    const commitUrl = (value: string) => {
      const next = value.trim();
      if (isHttpUrl(next) && next !== link.url) {
        store.updateStroke(link.id, { url: next, domain: linkDomain(next) } as Partial<Stroke>);
      }
    };
    const commitTitle = (value: string) => {
      const next = value.trim();
      if (next !== link.title) store.updateStroke(link.id, { title: next } as Partial<Stroke>);
    };
    const openLink = () => {
      if (isHttpUrl(link.url)) window.open(link.url, '_blank', 'noopener,noreferrer');
    };
    return (
      <div
        ref={ref}
        className="dc-annot-ctx"
        role="toolbar"
        aria-label="Link properties"
        style={{ display: 'flex', top: -9999, left: -9999 }}
      >
        <button
          type="button"
          className="dc-annot-ctx-ibtn"
          aria-label={`Open ${link.domain || 'link'} in a new tab`}
          title="Open link"
          onClick={openLink}
        >
          <IconLink />
        </button>
        <div className="dc-annot-ctx-sep" />
        <div className="dc-annot-ctx-field">
          <input
            key={`${link.id}-url`}
            className="dc-annot-ctx-input"
            type="url"
            inputMode="url"
            defaultValue={link.url}
            placeholder="https://…"
            aria-label="Link URL"
            onBlur={(e) => commitUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
          <input
            key={`${link.id}-title`}
            className="dc-annot-ctx-input"
            type="text"
            defaultValue={link.title}
            placeholder="Title"
            aria-label="Link title"
            onBlur={(e) => commitTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </div>
        <div className="dc-annot-ctx-sep" />
        <button
          type="button"
          className="dc-annot-ctx-ibtn dc-annot-ctx-ibtn--danger"
          aria-label="Delete link"
          title="Delete"
          onClick={remove}
        >
          <IconTrash />
        </button>
      </div>
    );
  }

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
  // Phase 24 — uniform bold / strike / align across the text-bearing selection.
  // Align default differs per kind: anchored text = centre, standalone + sticky
  // = left (matches the serializer defaults so the active-state reads true).
  const uniqBold = caps.fontSize
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'text' || s.tool === 'sticky' ? !!s.bold : undefined
        )
      )
    : undefined;
  const uniqStrike = caps.fontSize
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'text' || s.tool === 'sticky' ? !!s.strike : undefined
        )
      )
    : undefined;
  const uniqItalic = caps.fontSize
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'text' || s.tool === 'sticky' ? !!s.italic : undefined
        )
      )
    : undefined;
  const uniqUnderline = caps.fontSize
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'text' || s.tool === 'sticky' ? !!s.underline : undefined
        )
      )
    : undefined;
  // List type — undefined when no list (the active-state for the two list
  // toggles reads off this; both off ⇒ no list).
  const uniqListType = caps.fontSize
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'text' || s.tool === 'sticky' ? (s.listType ?? 'none') : undefined
        )
      )
    : undefined;
  const uniqAlign = caps.fontSize
    ? uniformValue(
        selectedStrokes.map((s) => {
          if (s.tool === 'sticky') return s.align ?? 'left';
          if (s.tool === 'text') return s.align ?? (s.anchorId ? 'center' : 'left');
          return undefined;
        })
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
  const uniqLineType = caps.arrowDir
    ? uniformValue(
        selectedStrokes.map((s) => (s.tool === 'arrow' ? (s.lineType ?? 'straight') : undefined))
      )
    : undefined;
  const uniqDashed = caps.dash
    ? uniformValue(
        selectedStrokes.map((s) =>
          s.tool === 'arrow' || s.tool === 'rect' || s.tool === 'ellipse' || s.tool === 'polygon'
            ? (s.dashed ?? false)
            : undefined
        )
      )
    : undefined;

  // T30 / G_S1 — when caps.fill is false we never enter fill mode. The
  // useEffect below could call setSwatchMode('stroke') but reading the
  // effective mode inline avoids an extra render cycle.
  const effectiveMode: SwatchMode = caps.fill ? swatchMode : 'stroke';
  // Phase 24 — a sticky selection picks its PAPER TINT, not stroke ink. The
  // pre-Phase-24 toolbar showed STROKE_PALETTE for stickies (a latent bug):
  // sticky has no stroke, so its swatch must paint the muted STICKY_PALETTE and
  // write to `color` (the paper tint). No Stroke|Fill toggle for sticky
  // (caps.fill is already false).
  const allSticky = selectedStrokes.every((s) => s.tool === 'sticky');
  const showPalette = allSticky
    ? STICKY_PALETTE
    : effectiveMode === 'stroke'
      ? STROKE_PALETTE
      : FILL_PALETTE;
  const onSwatchClick =
    !allSticky && effectiveMode === 'fill' ? (c: string) => setFill(c) : (c: string) => setColor(c);
  const activeValue = allSticky || effectiveMode === 'stroke' ? uniqColor : (uniqFill ?? null);
  const swatchKind = allSticky ? 'Sticky color' : effectiveMode === 'stroke' ? 'Color' : 'Fill';

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
            aria-label={`${swatchKind} ${c}`}
            aria-pressed={activeValue === c}
            title={`${swatchKind} ${c}`}
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
          <FontSizeDropdown value={uniqFontSize} onPick={setFontSize} />
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Bold"
            aria-pressed={uniqBold === true}
            title="Bold"
            onClick={() => setBold(!(uniqBold === true))}
          >
            <IconBold />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Italic"
            aria-pressed={uniqItalic === true}
            title="Italic"
            onClick={() => setItalic(!(uniqItalic === true))}
          >
            <IconItalic />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Strikethrough"
            aria-pressed={uniqStrike === true}
            title="Strikethrough"
            onClick={() => setStrike(!(uniqStrike === true))}
          >
            <IconStrike />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Underline"
            aria-pressed={uniqUnderline === true}
            title="Underline"
            onClick={() => setUnderline(!(uniqUnderline === true))}
          >
            <IconUnderline />
          </button>
          <IconDropdown
            ariaLabel="Text alignment"
            value={uniqAlign ?? 'left'}
            options={ALIGN_OPTIONS}
            renderIcon={(v) => {
              const I = ALIGN_ICON[v as TextAlign];
              return I ? <I size={16} /> : null;
            }}
            onPick={(v) => setAlign(v as TextAlign)}
          />
          {/* List style — two mutually-exclusive toggles; click-again clears. */}
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Bulleted list"
            aria-pressed={uniqListType === 'bullet'}
            title="Bulleted list"
            onClick={() => setListType(uniqListType === 'bullet' ? undefined : 'bullet')}
          >
            <IconListBullet />
          </button>
          <button
            type="button"
            className="dc-annot-ctx-ibtn"
            aria-label="Numbered list"
            aria-pressed={uniqListType === 'number'}
            title="Numbered list"
            onClick={() => setListType(uniqListType === 'number' ? undefined : 'number')}
          >
            <IconListOrdered />
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
          <IconDropdown
            ariaLabel="Start arrowhead"
            value={uniqStartHead ?? 'none'}
            options={HEAD_OPTIONS}
            renderIcon={(v) => {
              const I = HEAD_ICON[v as ArrowHead];
              return I ? <I size={16} /> : null;
            }}
            onPick={(v) => setStartHead(v as ArrowHead)}
          />
          <IconDropdown
            ariaLabel="End arrowhead"
            value={uniqEndHead ?? 'triangle'}
            options={HEAD_OPTIONS}
            renderIcon={(v) => {
              const I = HEAD_ICON[v as ArrowHead];
              return I ? <I size={16} /> : null;
            }}
            onPick={(v) => setEndHead(v as ArrowHead)}
          />
          <IconDropdown
            ariaLabel="Line type"
            value={uniqLineType ?? 'straight'}
            options={LINETYPE_OPTIONS}
            renderIcon={(v) => {
              const I = LINETYPE_ICON[v as ArrowLineType];
              return I ? <I size={16} /> : null;
            }}
            onPick={(v) => setLineType(v as ArrowLineType)}
          />
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

/**
 * Phase 24 — a compact icon dropdown for the context toolbar (arrowhead per
 * end, line-type). Trigger shows the current value's icon + a caret; the menu
 * is a single row of icon-only radio items. Closes on outside-pointerdown or
 * Escape. Reuses the existing `.dc-annot-ctx-ibtn` button styling.
 */
function IconDropdown({
  ariaLabel,
  value,
  options,
  renderIcon,
  onPick,
}: {
  ariaLabel: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  renderIcon: (v: string) => ReactNode;
  onPick: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="dc-annot-ctx-dd">
      <button
        type="button"
        className="dc-annot-ctx-ibtn dc-annot-ctx-dd-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${current?.label ?? value}`}
        title={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        {renderIcon(value)}
        <span className="dc-annot-ctx-dd-caret" aria-hidden="true">
          <IconChevronDown size={8} />
        </span>
      </button>
      {open ? (
        <div className="dc-annot-ctx-menu" role="menu" aria-label={ariaLabel}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              aria-label={o.label}
              title={o.label}
              className="dc-annot-ctx-ibtn"
              onClick={() => {
                onPick(o.value);
                setOpen(false);
              }}
            >
              {renderIcon(o.value)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Phase 24 — font-size control: named presets (Small → Huge) + a numeric input
 * for an arbitrary px value (clamped 8–200, applied on Enter / blur). The
 * trigger shows the current size, or "—" when the selection is mixed.
 */
function FontSizeDropdown({
  value,
  onPick,
}: {
  value: number | undefined;
  onPick: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const applyInput = (raw: string) => {
    const n = Math.round(Number(raw));
    if (Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) onPick(n);
  };
  return (
    <div ref={ref} className="dc-annot-ctx-dd">
      <button
        type="button"
        className="dc-annot-ctx-ibtn dc-annot-ctx-fs-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Font size: ${value != null ? `${value} pixels` : 'mixed'}`}
        title="Font size"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="dc-annot-ctx-fs-val">{value != null ? value : '—'}</span>
        <span className="dc-annot-ctx-dd-caret" aria-hidden="true">
          <IconChevronDown size={8} />
        </span>
      </button>
      {open ? (
        <div className="dc-annot-ctx-fs-menu" role="menu" aria-label="Font size">
          {FONT_SIZE_PRESETS.map((p) => (
            <button
              key={p.px}
              type="button"
              role="menuitemradio"
              aria-checked={value === p.px}
              className="dc-annot-ctx-fs-item"
              onClick={() => {
                onPick(p.px);
                setOpen(false);
              }}
            >
              <span>{p.label}</span>
              <span className="dc-annot-ctx-fs-px">{p.px}</span>
            </button>
          ))}
          <input
            key={value ?? 'mixed'}
            className="dc-annot-ctx-fs-input"
            type="number"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            defaultValue={value ?? ''}
            aria-label="Custom font size in pixels"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyInput((e.target as HTMLInputElement).value);
                setOpen(false);
              }
            }}
            onBlur={(e) => applyInput(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}

function uniformValue<T>(values: (T | undefined)[]): T | undefined {
  const filtered = values.filter((v) => v !== undefined) as T[];
  if (filtered.length === 0) return undefined;
  const first = filtered[0];
  return filtered.every((v) => v === first) ? first : undefined;
}

function cssEscape(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
