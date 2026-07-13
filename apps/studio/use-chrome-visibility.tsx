/**
 * @file       use-chrome-visibility.tsx — canvas-chrome visibility store
 * @scope      apps/studio/use-chrome-visibility.tsx
 * @purpose    Tiny store shared by the in-canvas floating chrome — DCMiniMap +
 *             DCZoomToolbar (canvas-lib), ToolPalette, and AnnotationsLayer —
 *             so the dev-server menubar can hide/show the minimap and zoom
 *             controls, and drive a non-destructive "Presentation Mode" that
 *             overlays-hides ALL chrome (minimap, zoom, tool palette,
 *             annotations) without mutating the user's individual toggles.
 *             Mounted by CanvasShell (next to AnnotationsVisibilityProvider) so
 *             the user canvas (which renders the minimap/zoom) AND its overlay
 *             siblings under CanvasRouter all consume the same value. Updated
 *             by the `dgn:'view-chrome'` postMessage handler in CanvasRouter.
 *
 *             `present` is a master overlay-hide that supersedes `minimap`/
 *             `zoom`: while it is on, every chrome consumer renders nothing,
 *             and exiting restores whatever the individual toggles were.
 */

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

export interface ChromeVisibilityState {
  /** Floating world mini-map (DCMiniMap). */
  minimap: boolean;
  /** Bottom zoom pill (DCZoomToolbar). */
  zoom: boolean;
  /** Presentation Mode — hides ALL chrome regardless of the two above. */
  present: boolean;
}

export interface ChromeVisibilityValue extends ChromeVisibilityState {
  /** Merge a partial patch (only the provided keys change). */
  setChrome: (patch: Partial<ChromeVisibilityState>) => void;
}

const ChromeVisibilityContext = createContext<ChromeVisibilityValue | null>(null);

export function ChromeVisibilityProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Partial<ChromeVisibilityState>;
}) {
  // Defaults MUST match the app-shell's own default view-prefs (app.jsx
  // MINIMAP_STORE / ZOOMCTL_STORE both default false) — otherwise a freshly
  // loaded canvas shows the minimap/zoom before (or instead of, when the seed
  // races the early inline-script `dgn:'loaded'`) the shell's OFF state is
  // applied, so a user with both toggled off still sees them. `present` is a
  // transient overlay, never persisted, so it stays false.
  const [state, setState] = useState<ChromeVisibilityState>({
    minimap: initial?.minimap ?? false,
    zoom: initial?.zoom ?? false,
    present: initial?.present ?? false,
  });
  const setChrome = useCallback((patch: Partial<ChromeVisibilityState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);
  const value = useMemo<ChromeVisibilityValue>(() => ({ ...state, setChrome }), [state, setChrome]);
  return (
    <ChromeVisibilityContext.Provider value={value}>{children}</ChromeVisibilityContext.Provider>
  );
}

/**
 * Returns the chrome-visibility value, or null when rendered outside a
 * provider (e.g. a bare DS specimen). Consumers treat null as "all visible"
 * so the default behaviour is unchanged.
 */
export function useChromeVisibility(): ChromeVisibilityValue | null {
  return useContext(ChromeVisibilityContext);
}
