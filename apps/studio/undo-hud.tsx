/**
 * @file       undo-hud.tsx — top-right toast announcing the last undo edit
 * @scope      plugins/design/dev-server/undo-hud.tsx
 * @purpose    Subscribes to `useUndoStack().lastLabel` + `.lastTick` and
 *             surfaces a 1.2 s aria-live toast so the user (and a screen
 *             reader) knows which edit just got pushed / undone / redone.
 *
 * a11y. The toast renders into `aria-live="polite"` so a screen reader
 * announces "Undo: move 3 artboards" without interrupting in-flight speech.
 * Pointer events are disabled — the HUD is informational only and must
 * never absorb clicks meant for the canvas behind it.
 */

import { useEffect, useState } from 'react';

import { useUndoStackOptional } from './use-undo-stack.tsx';

const HUD_CSS = `
.dc-undo-hud {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 7;
  pointer-events: none;
  padding: 6px 10px;
  background: var(--maude-chrome-bg-2, rgba(20, 20, 20, 0.85));
  color: var(--maude-chrome-fg-1, rgba(255, 255, 255, 0.85));
  border: 1px solid var(--maude-chrome-border, rgba(255, 255, 255, 0.08));
  border-radius: 6px;
  font: 11px var(--maude-chrome-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  letter-spacing: 0.02em;
  user-select: none;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity var(--dur-base, 200ms) linear, transform var(--dur-base, 200ms) ease-out;
}
.dc-undo-hud[data-visible="true"] {
  opacity: 1;
  transform: translateY(0);
  transition-duration: var(--dur-fast, 120ms);
}
@media (prefers-reduced-motion: reduce) {
  .dc-undo-hud {
    transition-duration: 1ms !important;
  }
}
`.trim();

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-undo-hud-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-undo-hud-css';
  s.textContent = HUD_CSS;
  document.head.appendChild(s);
}

/** Auto-dismiss timeout — matches the post-Wave-3 toast cadence. */
const DISMISS_MS = 1200;

export function UndoHud() {
  ensureStyles();
  const undo = useUndoStackOptional();
  const [visible, setVisible] = useState(false);

  // Bump visibility every time `lastTick` increments — same tick value means
  // the underlying state did NOT change (provider's no-op fallback returns
  // `lastTick: 0` constantly, so the HUD stays hidden when no provider).
  const tick = undo.lastTick;
  const label = undo.lastLabel;

  useEffect(() => {
    if (tick === 0 || !label) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [tick, label]);

  return (
    <div
      className="dc-undo-hud"
      // biome-ignore lint/a11y/useSemanticElements: <output> is form-scoped; this HUD is a global status overlay outside any form
      data-visible={visible ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {label ?? ''}
    </div>
  );
}
UndoHud.displayName = 'UndoHud';
