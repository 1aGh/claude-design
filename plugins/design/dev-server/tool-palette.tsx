/**
 * @file       tool-palette.tsx — Phase 5.1 centered icon toolbar
 * @scope      plugins/design/dev-server/tool-palette.tsx
 * @purpose    Bottom-center floating chrome — navigate (V/H/C), draw
 *             (B/R/O/A/E), and zoom in one shell. Adopts the dev-server
 *             menubar's visual language (8 px radius, soft shadow, hairline
 *             border) so canvas chrome and app chrome read as one product.
 *
 *             The zoom popover lazy-mounts on demand and groups Fit / Reset
 *             / Zoom In / Zoom Out from `useViewportControllerContext`. The
 *             presentation toggle posts upstream so the dev-server's
 *             `view-annotations` state stays in sync.
 */

import { useEffect, useRef, useState } from 'react';

import { IconChevronDown, IconPresentation, TOOL_ICONS } from './canvas-icons.tsx';
import { useViewportControllerContext } from './canvas-lib.tsx';
import { useAnnotationsVisibility } from './use-annotations-visibility.tsx';
import { useToolMode } from './use-tool-mode.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Styles — pulled from menubar tokens (`.mb` family). Centered bottom toolbar,
// 32 × 32 buttons with iconography. Grouped pill segments separated by 1 px
// dividers — visual cue that nav / draw / view-controls are distinct kinds.

// DDR-046 — floating chrome ambient shadow + 8 px radius (NOT brutalist).
// Active-tool state: 14% tint bg + 2px accent underbar + accent fg, replacing
// the previous full-accent flood (too loud at 32 × 32 in a quiet chrome).
const PALETTE_CSS = `
.dc-tool-palette {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: stretch;
  background: var(--u-bg-0, var(--bg-0, #ffffff));
  border: 1px solid var(--u-fg-0, #1c1917);
  border-radius: 8px;
  box-shadow: 0 6px 24px color-mix(in oklab, var(--u-fg-0, #1c1917) 10%, transparent);
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  color: var(--u-fg-0, var(--fg-0, #1a1a1a));
  z-index: 6;
  user-select: none;
  /* Intentionally NO overflow:hidden — the zoom popover (.dc-tp-popover) is
     a position:absolute child anchored above the toolbar; clipping the
     parent would hide it. */
}
.dc-tool-palette .dc-tp-group {
  display: flex;
  align-items: stretch;
  padding: 4px;
  gap: 2px;
}
.dc-tool-palette .dc-tp-sep {
  width: 1px;
  background: var(--u-border-subtle, rgba(0,0,0,0.08));
  margin: 6px 0;
}
.dc-tool-palette button {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 0;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-1, rgba(40,30,20,0.75));
  cursor: pointer;
  position: relative;
  transition: background-color 80ms linear, color 80ms linear;
}
.dc-tool-palette button:hover {
  background: color-mix(in oklab, var(--accent, #d63b1f) 8%, transparent);
  color: var(--fg-0, #1a1a1a);
}
.dc-tool-palette button:focus-visible {
  outline: 2px solid var(--accent, #d63b1f);
  outline-offset: -2px;
}
/* DDR-046 — Active tool: tinted background + accent underbar + accent text.
   The underbar is rendered via ::after so the visual stays inside the 6 px
   radius without leaking past the button edge. */
.dc-tool-palette button[aria-pressed="true"] {
  background: color-mix(in oklab, var(--accent, #d63b1f) 14%, transparent);
  color: var(--accent, #d63b1f);
}
.dc-tool-palette button[aria-pressed="true"]::after {
  content: "";
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 2px;
  height: 2px;
  background: var(--accent, #d63b1f);
  border-radius: 1px;
}
.dc-tool-palette .dc-tp-zoom {
  min-width: 56px;
  padding: 0 8px;
  font-variant-numeric: tabular-nums;
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  letter-spacing: 0.04em;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.dc-tool-palette .dc-tp-zoom svg { opacity: 0.6; }
.dc-tp-popover {
  position: absolute;
  right: 4px;
  bottom: 44px;
  background: var(--u-bg-0, var(--bg-0, #ffffff));
  border: 1px solid var(--u-fg-0, #1c1917);
  border-radius: 8px;
  box-shadow: 0 6px 24px color-mix(in oklab, var(--u-fg-0, #1c1917) 10%, transparent);
  display: flex;
  flex-direction: column;
  padding: 4px;
  min-width: 160px;
  z-index: 7;
  font-family: var(--u-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
}
.dc-tp-popover button {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 6px 10px;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}
.dc-tp-popover button:hover { background: rgba(0,0,0,0.04); }
.dc-tp-popover .dc-tp-kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  opacity: 0.55;
}
`.trim();

function ensurePaletteStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-tool-palette-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-tool-palette-css';
  s.textContent = PALETTE_CSS;
  document.head.appendChild(s);
}

const NAV_TOOLS = ['move', 'hand', 'comment'] as const;
const DRAW_TOOLS = ['pen', 'rect', 'ellipse', 'arrow', 'eraser'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component

export function ToolPalette() {
  ensurePaletteStyles();
  const { tool, setTool, tools } = useToolMode();
  const controller = useViewportControllerContext();
  const visibilityCtx = useAnnotationsVisibility();
  const [mounted, setMounted] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!zoomOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setZoomOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [zoomOpen]);

  if (!mounted) return null;

  const byId = new Map(tools.map((t) => [t.id, t]));
  const navList = NAV_TOOLS.map((id) => byId.get(id)).filter(Boolean);
  const drawList = DRAW_TOOLS.map((id) => byId.get(id)).filter(Boolean);
  const pct = controller ? Math.round(controller.viewport.zoom * 100) : 100;
  const annotationsHidden = visibilityCtx ? !visibilityCtx.visible : false;

  const renderToolButton = (id: string, label: string, shortcut: string) => {
    const Icon = TOOL_ICONS[id];
    return (
      <button
        key={id}
        type="button"
        aria-label={`${label} (${shortcut})`}
        aria-pressed={tool === id}
        title={`${label} (${shortcut})`}
        onClick={() => setTool(id as never)}
      >
        {Icon ? <Icon /> : <span style={{ fontSize: 11 }}>{shortcut}</span>}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="dc-tool-palette" role="toolbar" aria-label="Canvas tools">
      <div className="dc-tp-group">
        {navList.map((t) => (t ? renderToolButton(t.id, t.label, t.shortcut) : null))}
      </div>
      <div className="dc-tp-sep" />
      <div className="dc-tp-group">
        {drawList.map((t) => (t ? renderToolButton(t.id, t.label, t.shortcut) : null))}
      </div>
      <div className="dc-tp-sep" />
      <div className="dc-tp-group">
        <button
          type="button"
          aria-label="Export (⌘E)"
          title="Export (⌘E)"
          onClick={() => {
            // Phase 6.5 T9 — dispatch the same custom event the context-menu
            // uses; the dialog provider opens with the default scope.
            try {
              window.dispatchEvent(new CustomEvent('maude:open-export', { detail: {} }));
            } catch {
              /* ignore — non-window environments */
            }
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
            ⬇
          </span>
        </button>
        <button
          type="button"
          aria-label={
            annotationsHidden ? 'Show annotations (Shift+P)' : 'Hide annotations (Shift+P)'
          }
          aria-pressed={annotationsHidden}
          title="Presentation (Shift+P)"
          onClick={() => visibilityCtx?.setVisible(!visibilityCtx.visible)}
        >
          <IconPresentation />
        </button>
        <button
          type="button"
          className="dc-tp-zoom"
          aria-label={`Zoom ${pct}%, open zoom menu`}
          aria-expanded={zoomOpen}
          title={`Zoom ${pct}%`}
          onClick={() => setZoomOpen((o) => !o)}
        >
          <span>{pct}%</span>
          <IconChevronDown size={12} />
        </button>
      </div>
      {zoomOpen && controller ? (
        <div className="dc-tp-popover" role="menu" aria-label="Zoom">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.zoomIn();
              setZoomOpen(false);
            }}
          >
            <span>Zoom In</span>
            <span className="dc-tp-kbd">⌘ +</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.zoomOut();
              setZoomOpen(false);
            }}
          >
            <span>Zoom Out</span>
            <span className="dc-tp-kbd">⌘ −</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.fit();
              setZoomOpen(false);
            }}
          >
            <span>Fit to Screen</span>
            <span className="dc-tp-kbd">⌘ 0</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.reset();
              setZoomOpen(false);
            }}
          >
            <span>Actual Size 100%</span>
            <span className="dc-tp-kbd">⌘ 1</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
ToolPalette.displayName = 'ToolPalette';
