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
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

export const DEFAULT_TOOLS: readonly ToolDescriptor[] = Object.freeze([
  { id: 'move', label: 'Move', shortcut: 'V', cursor: 'default' },
  { id: 'hand', label: 'Hand', shortcut: 'H', cursor: 'grab' },
  { id: 'comment', label: 'Comment', shortcut: 'C', cursor: 'crosshair' },
  // Phase 5 — draw / annotation tools. Cursors stay as `crosshair` for pen /
  // rect / arrow (the pen-tip glyph is reserved for the system text caret).
  // Eraser uses `cell` as the closest cross-browser substitute for a rubber
  // affordance (no native rubber cursor exists).
  { id: 'pen', label: 'Pen', shortcut: 'B', cursor: 'crosshair' },
  { id: 'rect', label: 'Rect', shortcut: 'R', cursor: 'crosshair' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', cursor: 'crosshair' },
  { id: 'arrow', label: 'Arrow', shortcut: 'A', cursor: 'crosshair' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', cursor: 'cell' },
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

  // Body cursor sync — applied to the canvas iframe's body (this hook runs
  // inside the iframe context). The viewport-controller still owns the
  // grabbing/grab cursor swap during space-pan; this only sets the resting
  // cursor for the active tool.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const desc = tools.find((t) => t.id === tool);
    if (!desc) return;
    const prev = document.body.style.cursor;
    document.body.style.cursor = desc.cursor;
    return () => {
      document.body.style.cursor = prev;
    };
  }, [tool, tools]);

  const value = useMemo<ToolContextValue>(
    () => ({ tool, setTool, tools, sticky, toggleSticky, clearSticky }),
    [tool, setTool, tools, sticky, toggleSticky, clearSticky]
  );

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
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
