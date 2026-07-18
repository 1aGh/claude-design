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

import { type ReactNode, useEffect, useRef } from 'react';
import { resolveSelectionEl } from './dom-selection.ts';
import { isElementDragActive } from './drag-state.ts';
import {
  type AlignAxisMode,
  computeAlign,
  computeDistribute,
  computeTidyGrid,
  type KeyedRect,
  type MovedRect,
  type SpacingAxis,
} from './equal-spacing-detector.ts';
import { type Selection, useSelectionSet } from './use-selection-set.tsx';

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
  display: inline-flex;
  align-items: center;
  transition: background-color 80ms linear;
}
.dc-elem-ctx-tb button:hover:not(:disabled) {
  background: color-mix(in oklab, var(--maude-hud-accent, #d63b1f) 8%, transparent);
}
.dc-elem-ctx-tb button:disabled {
  cursor: default;
  opacity: 0.4;
}
.dc-elem-ctx-tb .dc-elem-ctx-count {
  padding: 4px 8px 4px 10px;
  color: var(--maude-chrome-fg-1, rgba(40,30,20,0.7));
  border-right: 1px solid var(--maude-chrome-border, rgba(0,0,0,0.08));
  margin-right: 2px;
  font-variant-numeric: tabular-nums;
}
.dc-elem-ctx-tb .dc-elem-ctx-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dc-elem-ctx-tb .dc-elem-ctx-divider {
  width: 1px;
  align-self: stretch;
  background: var(--maude-chrome-border, rgba(0,0,0,0.10));
  margin: 0 4px;
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

interface AlignTarget {
  sel: Selection;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve every selection to its current world-space box, gated on
 * absolute/fixed positioning — align/distribute/tidy-up write `left`/`top`,
 * which is only meaningful for out-of-flow elements. This lane still never does
 * an IMPLICIT convert-to-absolute-on-drag (see the Stage-D dogfood notes); the
 * EXPLICIT context-menu "Convert children to absolute position" (feature-4 T8,
 * DDR-188) is the opt-in path to flatten a flow layout first. Returns `null`
 * (all-or-nothing) if any selection
 * doesn't resolve, or isn't out-of-flow, or has a non-numeric `left`/`top`
 * (e.g. positioned via `right`/`bottom` instead — a known v1 limit).
 */
function resolveAlignTargets(sels: Selection[]): AlignTarget[] | null {
  const out: AlignTarget[] = [];
  for (const sel of sels) {
    const node = resolveSelectionEl(document, sel);
    if (!node) return null;
    const cs = getComputedStyle(node as HTMLElement);
    if (cs.position !== 'absolute' && cs.position !== 'fixed') return null;
    const left = Number.parseFloat(cs.left);
    const top = Number.parseFloat(cs.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    out.push({
      sel,
      x: left,
      y: top,
      w: (node as HTMLElement).offsetWidth,
      h: (node as HTMLElement).offsetHeight,
    });
  }
  return out;
}

/** Post one `reposition-request` per moved rect — the same message shape +
 *  write lane (`repositionElement` → `/_api/edit-css` ×2, per-prop undo) an
 *  in-canvas element drag already posts. No new endpoint, no new trust
 *  boundary; Cmd+Z steps back one element at a time (same N-step precedent
 *  as Task L4's paste-style). */
function commitMoves(targets: AlignTarget[], moved: MovedRect[]): void {
  for (const m of moved) {
    const t = targets[Number(m.key)];
    if (!t?.sel.id) continue;
    try {
      window.parent.postMessage(
        {
          dgn: 'reposition-request',
          id: t.sel.id,
          left: m.x,
          top: m.y,
          beforeLeft: Math.round(t.x),
          beforeTop: Math.round(t.y),
          idIndex: t.sel.index ?? 0,
        },
        '*'
      );
    } catch {
      /* detached / cross-origin */
    }
  }
}

function toKeyedRects(targets: AlignTarget[]): KeyedRect[] {
  return targets.map((t, i) => ({ key: String(i), x: t.x, y: t.y, w: t.w, h: t.h }));
}

function CtxIconButton({
  label,
  title,
  onClick,
  disabled,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" title={title} aria-label={label} onClick={onClick} disabled={disabled}>
      <span className="dc-elem-ctx-icon" aria-hidden="true">
        {children}
      </span>
    </button>
  );
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
      // Dogfood 2026-07-07 — "hrozně zavaší ten toolbar" during a reorder drag:
      // the floating pill has nothing useful to say mid-drag anyway (Inspect /
      // Copy CSS / Copy ID on an element that's about to move), and its own
      // per-frame resolveSelectionEl + getBoundingClientRect work was
      // compounding with the drag's own DOM churn + the resize/spacing
      // overlays' rAF loops. Hide it for the duration, like Figma/Webflow do.
      if (isElementDragActive()) {
        div.style.display = 'none';
        div.setAttribute('data-on', 'false');
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
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

  // Task L5 — align (≥2) / distribute (≥3) / tidy-up (≥2) for a multi-element
  // selection. Button enablement is count-gated (matching MultiArtboardToolbar's
  // G7 cluster); the absolute/fixed-positioning eligibility check happens lazily
  // on click via `resolveAlignTargets` (a silent no-op otherwise, rather than a
  // per-frame DOM scan just to grey out a button).
  const alignOk = count >= 2;
  const distributeOk = count >= 3;

  const runAlign = (mode: AlignAxisMode) => {
    const targets = resolveAlignTargets(elementSelections);
    if (!targets) return;
    commitMoves(targets, computeAlign(toKeyedRects(targets), mode));
  };
  const runDistribute = (axis: SpacingAxis) => {
    const targets = resolveAlignTargets(elementSelections);
    if (!targets) return;
    commitMoves(targets, computeDistribute(toKeyedRects(targets), axis));
  };
  const runTidyUp = () => {
    const targets = resolveAlignTargets(elementSelections);
    if (!targets) return;
    commitMoves(targets, computeTidyGrid(toKeyedRects(targets)));
  };

  return (
    <div ref={ref} className="dc-elem-ctx-tb" role="toolbar" aria-label="Element actions">
      <span className="dc-elem-ctx-count">{count === 1 ? '1 element' : `${count} elements`}</span>
      <button
        type="button"
        title="Inspect — open the right panel (Inspect / Layers / CSS)"
        onClick={() => {
          // Phase 12 — open the shell's Inspector on the current selection.
          try {
            window.parent.postMessage({ dgn: 'open-inspector' }, '*');
          } catch {
            /* detached / cross-origin */
          }
        }}
      >
        Inspect
      </button>
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
      {alignOk && (
        <>
          <span className="dc-elem-ctx-divider" aria-hidden="true" />
          <CtxIconButton label="Align left" title="Align left" onClick={() => runAlign('left')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="0.5" y1="0.5" x2="0.5" y2="13.5" stroke="currentColor" />
              <rect x="1" y="2" width="7" height="3" fill="currentColor" />
              <rect x="1" y="9" width="11" height="3" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton
            label="Align center horizontally"
            title="Align center (horizontal)"
            onClick={() => runAlign('center-x')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="7" y1="0.5" x2="7" y2="13.5" stroke="currentColor" />
              <rect x="3.5" y="2" width="7" height="3" fill="currentColor" />
              <rect x="1.5" y="9" width="11" height="3" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton label="Align right" title="Align right" onClick={() => runAlign('right')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="13.5" y1="0.5" x2="13.5" y2="13.5" stroke="currentColor" />
              <rect x="6" y="2" width="7" height="3" fill="currentColor" />
              <rect x="2" y="9" width="11" height="3" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton label="Align top" title="Align top" onClick={() => runAlign('top')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="0.5" y1="0.5" x2="13.5" y2="0.5" stroke="currentColor" />
              <rect x="2" y="1" width="3" height="7" fill="currentColor" />
              <rect x="9" y="1" width="3" height="11" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton
            label="Align center vertically"
            title="Align center (vertical)"
            onClick={() => runAlign('center-y')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="0.5" y1="7" x2="13.5" y2="7" stroke="currentColor" />
              <rect x="2" y="3.5" width="3" height="7" fill="currentColor" />
              <rect x="9" y="1.5" width="3" height="11" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton
            label="Align bottom"
            title="Align bottom"
            onClick={() => runAlign('bottom')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="0.5" y1="13.5" x2="13.5" y2="13.5" stroke="currentColor" />
              <rect x="2" y="6" width="3" height="7" fill="currentColor" />
              <rect x="9" y="2" width="3" height="11" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <span className="dc-elem-ctx-divider" aria-hidden="true" />
          <CtxIconButton
            label="Distribute horizontally"
            title={
              distributeOk
                ? 'Distribute horizontally — equal gaps between elements'
                : 'Select at least 3 elements to distribute'
            }
            disabled={!distributeOk}
            onClick={() => runDistribute('x')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="0.5" y="3" width="3" height="8" fill="currentColor" />
              <rect x="5.5" y="3" width="3" height="8" fill="currentColor" />
              <rect x="10.5" y="3" width="3" height="8" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton
            label="Distribute vertically"
            title={
              distributeOk
                ? 'Distribute vertically — equal gaps between elements'
                : 'Select at least 3 elements to distribute'
            }
            disabled={!distributeOk}
            onClick={() => runDistribute('y')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="3" y="0.5" width="8" height="3" fill="currentColor" />
              <rect x="3" y="5.5" width="8" height="3" fill="currentColor" />
              <rect x="3" y="10.5" width="8" height="3" fill="currentColor" />
            </svg>
          </CtxIconButton>
          <CtxIconButton
            label="Tidy up into a grid"
            title="Tidy up — snap into a clean grid"
            onClick={runTidyUp}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="5.5" height="5.5" fill="currentColor" />
              <rect x="8" y="0.5" width="5.5" height="5.5" fill="currentColor" />
              <rect x="0.5" y="8" width="5.5" height="5.5" fill="currentColor" />
              <rect x="8" y="8" width="5.5" height="5.5" fill="currentColor" />
            </svg>
          </CtxIconButton>
        </>
      )}
    </div>
  );
}
