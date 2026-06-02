/**
 * @file       use-tool-mode.tsx — Phase 4.1 tool-mode store
 * @scope      plugins/design/dev-server/use-tool-mode.tsx
 * @purpose    Context + hook for the active canvas tool. Wired into
 *             DesignCanvas. Phase 5 will
 *             register additional tools (pen, circle, arrow, eraser) via
 *             the same provider — the API is intentionally open.
 *
 * The router's `onTool` callback (input-router.tsx) writes into this store.
 * The ToolPalette + cursor sync read from it. Selecting a tool also mutates
 * `document.body.style.cursor` so the affordance matches across the iframe.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { TOOL_CURSORS } from './canvas-cursors.ts';
import type { Tool } from './input-router.tsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types

export interface ToolDescriptor {
  id: Tool;
  label: string;
  /** Letter-key shortcut shown in the palette tooltip. */
  shortcut: string;
  /** CSS cursor value applied to <body> when this tool is active. */
  cursor: string;
}

/**
 * Phase 24 — the six primitives the single Shape tool can draw. Maps onto the
 * stroke model: square/rounded → `rect` (cornerRadius 0 / 8); circle →
 * `ellipse`; diamond/triangle/triangle-down → `polygon`.
 */
export type ShapeKind = 'square' | 'rounded' | 'circle' | 'diamond' | 'triangle' | 'triangle-down';

// Phase 21 — every tool ships a custom 32×32 SVG cursor (canvas-cursors.ts)
// with a white outline halo so the glyph reads on any background. The native
// crosshair/text/cell were thin + tiny ("pen almost invisible"); these mirror
// the tool-palette icons. `move` keeps the system arrow on purpose.
export const DEFAULT_TOOLS: readonly ToolDescriptor[] = Object.freeze([
  { id: 'move', label: 'Move', shortcut: 'V', cursor: TOOL_CURSORS.move },
  { id: 'hand', label: 'Hand', shortcut: 'H', cursor: TOOL_CURSORS.hand },
  { id: 'comment', label: 'Comment', shortcut: 'C', cursor: TOOL_CURSORS.comment },
  { id: 'pen', label: 'Pen', shortcut: 'B', cursor: TOOL_CURSORS.pen },
  // Phase 24 — one Shape tool replaces the separate Rect (R) + Ellipse (O)
  // buttons; the primitive is chosen from the palette popover.
  { id: 'shape', label: 'Shape', shortcut: 'R', cursor: TOOL_CURSORS.shape },
  { id: 'sticky', label: 'Sticky', shortcut: 'N', cursor: TOOL_CURSORS.sticky },
  { id: 'arrow', label: 'Arrow', shortcut: 'A', cursor: TOOL_CURSORS.arrow },
  { id: 'text', label: 'Text', shortcut: 'T', cursor: TOOL_CURSORS.text },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', cursor: TOOL_CURSORS.eraser },
]);

interface ToolContextValue {
  tool: Tool;
  setTool: (t: Tool) => void;
  tools: readonly ToolDescriptor[];
  /** T19 — sticky-tool double-click lock. When `sticky.locked === true` AND
   *  `sticky.tool === tool`, draw tools stay armed after each shape commit
   *  (T18 auto-flip is suppressed). Single-click on any other tool clears
   *  sticky; Esc clears + flips to Move. */
  sticky: { tool: Tool | null; locked: boolean };
  toggleSticky: (t: Tool) => void;
  clearSticky: () => void;
  /** Phase 24 — the primitive the Shape tool will draw next. */
  shapeKind: ShapeKind;
  setShapeKind: (k: ShapeKind) => void;
}

const ToolContext = createContext<ToolContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider

export function ToolProvider({
  children,
  tools = DEFAULT_TOOLS,
  initial = 'move',
}: {
  children: ReactNode;
  tools?: readonly ToolDescriptor[];
  initial?: Tool;
}) {
  const [tool, setToolState] = useState<Tool>(initial);
  const [sticky, setSticky] = useState<{ tool: Tool | null; locked: boolean }>(() => ({
    tool: null,
    locked: false,
  }));
  const setTool = useCallback((t: Tool) => {
    setToolState(t);
    // Single-click on a different tool clears any sticky lock — sticky is
    // a per-tool flag, not global.
    setSticky((prev) => (prev.locked && prev.tool === t ? prev : { tool: null, locked: false }));
  }, []);
  const toggleSticky = useCallback((t: Tool) => {
    setSticky((prev) => {
      if (prev.locked && prev.tool === t) return { tool: null, locked: false };
      return { tool: t, locked: true };
    });
    setToolState(t);
  }, []);
  const clearSticky = useCallback(() => {
    setSticky({ tool: null, locked: false });
  }, []);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('square');

  // Cursor sync — applied inside the canvas (this hook runs in the canvas
  // context). The active tool's cursor is set on <body> AND forced across the
  // whole canvas working area via an `!important` rule, so the custom cursor
  // shows EVERYWHERE — including over artboard CONTENT, whose own `cursor:
  // pointer`/`text`/… would otherwise win (Phase 24, the "custom cursors in the
  // whole app" requirement; FigJam behaviour). Chrome that lives OUTSIDE
  // `.dc-world` (tool palette, context toolbar, resize handles) is intentionally
  // NOT matched, so its buttons/handles keep their affordance cursors. The
  // viewport-controller still owns the grab/grabbing swap during space-pan.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const desc = tools.find((t) => t.id === tool);
    if (!desc) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = desc.cursor;
    let styleEl = document.getElementById('dc-tool-cursor') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dc-tool-cursor';
      document.head.appendChild(styleEl);
    }
    // Truly GLOBAL inside the canvas document — `*` so it covers the empty grid
    // host, `.dc-world`, every artboard + its content, AND the floating chrome
    // (minimap, toolbar). The earlier `.dc-world`-scoped rule left the empty
    // canvas / minimap on their own cursors; the brief is "prostě všude". (Mirrors
    // the outer-shell `*` rule so both documents are uniformly covered.)
    styleEl.textContent = `* { cursor: ${desc.cursor} !important; }`;
    // Phase 24 — broadcast the active tool TOKEN to the OUTER app shell (this
    // hook runs in the canvas iframe) so the shell shows the same custom cursor
    // across the whole maude UI (sidebar / top bar). We send the tool *id*, NOT
    // the cursor string: the shell resolves it against its own trusted
    // TOOL_CURSORS copy (resolveToolCursor), so an untrusted synced canvas
    // (DDR-054) can only pick a known, always-visible glyph — it can't inject an
    // invisible/displaced cursor as a clickjacking aid (phase-24 ethical-hacker
    // Finding 2; DDR-067).
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ dgn: 'tool-cursor', tool }, '*');
      } catch {
        /* cross-origin parent rejected — shell keeps its default cursor */
      }
    }
    return () => {
      document.body.style.cursor = prev;
      const el = document.getElementById('dc-tool-cursor');
      if (el) el.textContent = '';
    };
  }, [tool, tools]);

  const value = useMemo<ToolContextValue>(
    () => ({ tool, setTool, tools, sticky, toggleSticky, clearSticky, shapeKind, setShapeKind }),
    [tool, setTool, tools, sticky, toggleSticky, clearSticky, shapeKind]
  );

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

/**
 * Mount a `ToolProvider` only when none exists above us. When the shell-owned
 * comment mount layer (canvas-comment-mount.tsx) already provides one,
 * `DesignCanvas` consumes that instance instead of double-mounting. The hook
 * is called unconditionally; only the returned tree branches (hook rules).
 */
export function MaybeToolProvider({ children }: { children: ReactNode }) {
  const outer = useContext(ToolContext);
  if (outer) return <>{children}</>;
  return <ToolProvider>{children}</ToolProvider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook

export function useToolMode(): ToolContextValue {
  const ctx = useContext(ToolContext);
  if (!ctx) {
    throw new Error('useToolMode must be used inside <ToolProvider>');
  }
  return ctx;
}

/**
 * Read-only variant — returns `null` when no provider mounted. Used by
 * components that can render outside a ToolProvider tree (the input
 * router's optional path).
 */
export function useToolModeOptional(): ToolContextValue | null {
  return useContext(ToolContext);
}
