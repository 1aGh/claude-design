/**
 * @file       tool-palette.tsx — Phase 4.1 floating tool selector
 * @scope      plugins/design/dev-server/tool-palette.tsx
 * @purpose    Bottom-left floating panel mirroring DCZoomToolbar styling.
 *             Renders one button per tool registered via ToolProvider's
 *             `tools` prop (V/H/C ship by default; Phase 5 plugs in more).
 *             Stays outside `.dc-world` so it doesn't pan/zoom with the world.
 */

import { useEffect, useState } from "react";

import { useToolMode } from "./use-tool-mode.tsx";

// ─────────────────────────────────────────────────────────────────────────────
// Styles — injected once per iframe via the same pattern canvas-lib uses for
// .dc-mm / .dc-zoom-tb. Hairline border + hard-edged mono buttons; active tool
// gets the DS accent. CSS variables fall back to sensible defaults so the
// palette drops into any DS.

const PALETTE_CSS = `
.dc-tool-palette {
  position: absolute;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: stretch;
  background: rgba(255,255,255,0.94);
  border: 1px solid rgba(0,0,0,0.12);
  border-radius: 6px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: rgba(40,30,20,0.85);
  z-index: 6;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  user-select: none;
}
.dc-tool-palette button {
  appearance: none;
  background: transparent;
  border: 0;
  border-right: 1px solid rgba(0,0,0,0.08);
  padding: 7px 12px;
  font: inherit;
  color: inherit;
  cursor: pointer;
  min-width: 40px;
  text-align: center;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dc-tool-palette button:last-child { border-right: 0; }
.dc-tool-palette button:hover { background: rgba(0,0,0,0.04); }
.dc-tool-palette button:focus-visible {
  outline: 2px solid var(--accent, #d63b1f);
  outline-offset: -2px;
}
.dc-tool-palette button[aria-pressed="true"] {
  background: var(--accent, #d63b1f);
  color: var(--accent-fg, #fff);
}
.dc-tool-palette .dc-tp-kbd {
  font-size: 10px;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}
.dc-tool-palette button[aria-pressed="true"] .dc-tp-kbd { opacity: 0.85; }
`.trim();

function ensurePaletteStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("dc-tool-palette-css")) return;
  const s = document.createElement("style");
  s.id = "dc-tool-palette-css";
  s.textContent = PALETTE_CSS;
  document.head.appendChild(s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component

export function ToolPalette() {
  ensurePaletteStyles();
  const { tool, setTool, tools } = useToolMode();
  // Avoid SSR/hydration drift — render after first client paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="dc-tool-palette" role="toolbar" aria-label="Canvas tools">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={`${t.label} tool (${t.shortcut})`}
          aria-pressed={tool === t.id}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => setTool(t.id)}
        >
          <span>{t.label}</span>
          <span className="dc-tp-kbd">{t.shortcut}</span>
        </button>
      ))}
    </div>
  );
}
ToolPalette.displayName = "ToolPalette";
