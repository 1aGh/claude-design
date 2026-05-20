/**
 * @file       use-annotations-visibility.tsx — Phase 5.1 visibility store
 * @scope      plugins/design/dev-server/use-annotations-visibility.tsx
 * @purpose    Tiny boolean store shared by AnnotationsLayer (render gate),
 *             ToolPalette (presentation toggle button), and the menubar
 *             bridge (`view-annotations` postMessage handler in
 *             AnnotationsLayer). Mounted by CanvasShell so the layer + its
 *             siblings under CanvasRouter all consume the same value.
 */

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface AnnotationsVisibilityValue {
  visible: boolean;
  setVisible: (v: boolean) => void;
  toggle: () => void;
}

const AnnotationsVisibilityContext = createContext<AnnotationsVisibilityValue | null>(null);

export function AnnotationsVisibilityProvider({
  children,
  initial = true,
}: {
  children: ReactNode;
  initial?: boolean;
}) {
  const [visible, setVisible] = useState<boolean>(initial);
  const toggle = useCallback(() => setVisible((v) => !v), []);
  const value = useMemo<AnnotationsVisibilityValue>(
    () => ({ visible, setVisible, toggle }),
    [visible, toggle]
  );
  return (
    <AnnotationsVisibilityContext.Provider value={value}>
      {children}
    </AnnotationsVisibilityContext.Provider>
  );
}

export function useAnnotationsVisibility(): AnnotationsVisibilityValue | null {
  return useContext(AnnotationsVisibilityContext);
}
