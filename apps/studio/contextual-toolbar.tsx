/**
 * @file       contextual-toolbar.tsx — T30 (Wave 3)
 * @scope      apps/studio/contextual-toolbar.tsx
 * @purpose    Selection-anchored floating chrome for ELEMENT selections
 *             (cd-id entries in the selection set). Mirrors the
 *             MultiArtboardToolbar pattern but scopes to user content inside
 *             artboards. Actions surface the existing right-click handlers
 *             one click closer:
 *
 *               • Copy CSS path
 *               • Copy data-cd-id
 *               • Add comment
 *
 *             Hides when:
 *               - no selection,
 *               - selection contains only artboards (MultiArtboardToolbar
 *                 covers that),
 *               - selection contains only annotations (their own toolbar
 *                 fires from `annotations-context-toolbar.tsx`).
 *
 *             Anchored 14 px above the element selection union bbox; flips
 *             below when bbox top is < 60 px from the viewport edge — same
 *             contract as MultiArtboardToolbar so the two never collide.
 *
 *             Selection-change tweens are NOT animated here in v1; the
 *             instant reposition is acceptable given the toolbar fades in
 *             only when stickily relevant. A future polish wave can add
 *             the 180 ms position tween per the plan note.
 */

import { useEffect, useRef } from 'react';

import { resolveSelectionEl } from './dom-selection.ts';
import { useSelectionSet } from './use-selection-set.tsx';

const CTX_TOOLBAR_CSS = `
.dc-elem-ctx-tb {
  position: fixed;
  pointer-events: auto;
  z-index: 6;
  display: none;
  align-items: stretch;
  gap: 2px;
  padding: 4px;
  background: var(--maude-chrome-bg-0, #ffffff);
  border: 1px solid var(--maude-chrome-fg-0, #1c1917);
  border-radius: 8px;
  box-shadow: 0 6px 24px var(--maude-chrome-shadow, color-mix(in oklab, #1c1917 10%, transparent));
  font-family: var(--maude-chrome-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--maude-chrome-fg-0, #1a1a1a);
  user-select: none;
  opacity: 0;
  transition: opacity 100ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dc-elem-ctx-tb[data-on="true"] {
  opacity: 1;
}
.dc-elem-ctx-tb button {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 4px 10px;
  font: inherit;
  cursor: pointer;
  color: inherit;
  transition: background-color 80ms linear;
}
.dc-elem-ctx-tb button:hover {
  background: color-mix(in oklab, var(--maude-hud-accent, #d63b1f) 8%, transparent);
}
.dc-elem-ctx-tb .dc-elem-ctx-count {
  padding: 4px 8px 4px 10px;
  color: var(--maude-chrome-fg-1, rgba(40,30,20,0.7));
  border-right: 1px solid var(--maude-chrome-border, rgba(0,0,0,0.08));
  margin-right: 2px;
  font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
  .dc-elem-ctx-tb, .dc-elem-ctx-tb button { transition: none; }
}
`.trim();

function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dc-elem-ctx-tb-css')) return;
  const s = document.createElement('style');
  s.id = 'dc-elem-ctx-tb-css';
  s.textContent = CTX_TOOLBAR_CSS;
  document.head.appendChild(s);
}

function copyText(text: string): void {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  void navigator.clipboard.writeText(text).catch(() => {
    /* clipboard blocked */
  });
}

function openComposerForSelection(
  sel: { id?: string; selector: string },
  anchorEl: Element | null
): void {
  if (typeof document === 'undefined') return;
  // Anchor near the top-right of the targeted element so the composer drops
  // into a clear area next to it. Matches the comment-tool click affordance
  // post-G4 (cursor-anchored composer).
  let clientX = 0;
  let clientY = 0;
  if (anchorEl) {
    const r = (anchorEl as HTMLElement).getBoundingClientRect();
    clientX = r.right - 8;
    clientY = r.top + r.height / 2;
  }
  try {
    document.dispatchEvent(
      new CustomEvent('cm:open-composer', {
        detail: { selection: sel, clientX, clientY },
      })
    );
  } catch {
    /* CustomEvent unsupported — fall through */
  }
  // Back-compat parent post for legacy mocks.
  if (typeof window !== 'undefined') {
    try {
      window.parent.postMessage({ dgn: 'comment-compose', selection: sel }, '*');
    } catch {
      /* parent detached */
    }
  }
}

export function ContextualToolbar() {
  ensureStyles();
  const { selected } = useSelectionSet();
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Element selections = entries with `id` (data-cd-id) set. Pure artboard
  // selections (artboardId-only, no id) and empty sets fall through.
  const elementSelections = selected.filter((s) => !!s.id);
  const visible = elementSelections.length > 0;

  useEffect(() => {
    const div = ref.current;
    if (!div) return;
    if (!visible) {
      div.style.display = 'none';
      div.setAttribute('data-on', 'false');
      return;
    }
    const tick = () => {
      rafRef.current = null;
      let xMin = Number.POSITIVE_INFINITY;
      let yMin = Number.POSITIVE_INFINITY;
      let xMax = Number.NEGATIVE_INFINITY;
      let yMax = Number.NEGATIVE_INFINITY;
      let any = false;
      for (const sel of elementSelections) {
        const node = resolveSelectionEl(document, sel);
        if (!node) continue;
        const r = (node as HTMLElement).getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        any = true;
        if (r.left < xMin) xMin = r.left;
        if (r.top < yMin) yMin = r.top;
        if (r.right > xMax) xMax = r.right;
        if (r.bottom > yMax) yMax = r.bottom;
      }
      if (!any) {
        div.style.display = 'none';
        div.setAttribute('data-on', 'false');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      div.style.display = 'flex';
      const tw = div.offsetWidth || 0;
      const centerX = (xMin + xMax) / 2;
      const top = yMin;
      const gap = 14;
      let anchorY = top - div.offsetHeight - gap;
      if (anchorY < 60) anchorY = yMax + gap;
      div.style.left = `${Math.round(centerX - tw / 2)}px`;
      div.style.top = `${Math.round(anchorY)}px`;
      div.setAttribute('data-on', 'true');
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, elementSelections]);

  if (!visible) {
    return <div ref={ref} className="dc-elem-ctx-tb" aria-hidden="true" />;
  }

  // For multi-selection, Copy actions operate on the FIRST element — same
  // convention as the right-click menu (single-target). Future polish: a
  // mini-menu that lets the user pick which selection's CSS to copy.
  const primary = elementSelections[0];
  const count = elementSelections.length;

  return (
    <div ref={ref} className="dc-elem-ctx-tb" role="toolbar" aria-label="Element actions">
      <span className="dc-elem-ctx-count">{count === 1 ? '1 element' : `${count} elements`}</span>
      <button
        type="button"
        title="Copy CSS selector"
        onClick={() => primary && copyText(primary.selector)}
      >
        Copy CSS
      </button>
      <button
        type="button"
        title="Copy data-cd-id"
        disabled={!primary?.id}
        onClick={() => primary?.id && copyText(primary.id)}
      >
        Copy ID
      </button>
      <button
        type="button"
        title="Add comment on this element"
        onClick={() => {
          if (!primary) return;
          const node = resolveSelectionEl(document, primary);
          openComposerForSelection(primary, node);
        }}
      >
        Comment
      </button>
    </div>
  );
}
