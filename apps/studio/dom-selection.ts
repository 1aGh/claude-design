/**
 * @file       dom-selection.ts — selection-from-DOM helpers (leaf module)
 * @scope      apps/studio/dom-selection.ts
 * @purpose    Pure DOM → Selection builders shared by the canvas chrome
 *             (canvas-shell.tsx) and the shell-owned comment mount layer
 *             (canvas-comment-mount.tsx). Lives in its own leaf module — no
 *             React, no canvas-lib import — so both consumers can lift the
 *             same `hoverTargetToSelection` / `deriveFile` logic without a
 *             cycle and without bundling the heavy DesignCanvas tree into the
 *             lite comment mount.
 */

import type { HoverTarget } from './input-router.tsx';
import type { Selection } from './use-selection-set.tsx';

/**
 * Canvas file path for the current page. Under the mount harness the page is
 * `/_canvas-shell.html?canvas=<rel>&designRel=<root>`; for legacy `.html`
 * mocks it's the served file path itself.
 */
export function deriveFile(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const p = window.location.pathname;
    if (p === '/_canvas-shell.html' || p === '/_canvas-shell') {
      const qs = new URLSearchParams(window.location.search);
      const canvas = qs.get('canvas') ?? '';
      const designRel = (qs.get('designRel') ?? '.design').replace(/^\/+|\/+$/g, '');
      return canvas ? `${designRel}/${canvas}` : undefined;
    }
    return decodeURIComponent(p).replace(/^\//, '');
  } catch {
    return undefined;
  }
}

export function realClasses(el: Element | null): string {
  if (!el) return '';
  return (el.getAttribute('class') ?? '')
    .trim()
    .split(/\s+/)
    .filter((c) => c && !c.startsWith('dgn-') && !c.startsWith('dc-cv-'))
    .join(' ');
}

export function shortText(el: Element | null, max: number): string {
  if (!el) return '';
  const t = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function cssPath(el: Element | null): string {
  if (!el) return '';
  const path: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && path.length < 8) {
    const dscEl = cur.getAttribute?.('data-dc-element');
    if (dscEl) {
      path.unshift(`[data-dc-element="${dscEl}"]`);
      break;
    }
    const dscSc = cur.getAttribute?.('data-dc-screen');
    if (dscSc) {
      path.unshift(`[data-dc-screen="${dscSc}"]`);
      break;
    }
    let sel = cur.nodeName.toLowerCase();
    if (cur.id) {
      sel = `#${cur.id}`;
      path.unshift(sel);
      break;
    }
    const cls = realClasses(cur).split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) sel += `.${cls.join('.')}`;
    let sib = 1;
    let n: Element | null = cur.previousElementSibling;
    while (n) {
      sib++;
      n = n.previousElementSibling;
    }
    sel += `:nth-child(${sib})`;
    path.unshift(sel);
    cur = cur.parentElement;
  }
  return path.join(' > ');
}

export function domPath(el: Element | null): string[] {
  const hops: string[] = [];
  let cur = el;
  while (cur && cur.nodeType === 1 && hops.length < 8) {
    let label = cur.nodeName.toLowerCase();
    const dEl = cur.getAttribute?.('data-dc-element');
    const dSc = cur.getAttribute?.('data-dc-screen');
    if (dEl) label += `[data-dc-element="${dEl}"]`;
    else if (dSc) label += `[data-dc-screen="${dSc}"]`;
    else if (cur.id) label += `#${cur.id}`;
    const cls = realClasses(cur).split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length && !dEl && !dSc) label += `.${cls.join('.')}`;
    hops.unshift(label);
    cur = cur.parentElement;
  }
  return hops;
}

export function cssEscape(s: string): string {
  // Minimal CSS.escape polyfill — only handles chars actually present in
  // pipeline-stamped IDs (alphanumerics + `-` + `_`).
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/**
 * Build the wire-shape `Selection` for a resolved hover target. `file`
 * defaults to `deriveFile()`; the comment mount layer passes it explicitly
 * so all three consumers (router, overlay, mount) agree on the same key.
 */
/**
 * The artboard-scoped data-cd-id selector. A component shared across artboards
 * carries the SAME data-cd-id in each, so a bare `[data-cd-id="…"]` resolves
 * (via querySelector) to the FIRST artboard. Prefixing the hit's artboard makes
 * the anchor per-instance. Shared by EVERY selector builder + resolver so they
 * can't drift (the original fix only patched one of ~8 sites).
 */
export function scopedCdSelector(cdId: string, artboardId?: string | null): string {
  return artboardId
    ? `[data-dc-screen="${artboardId}"] [data-cd-id="${cdId}"]`
    : `[data-cd-id="${cdId}"]`;
}

/**
 * Resolve a stored Selection to its live element, artboard-scoped. Prefers the
 * id+artboardId scoped selector (the robust path), then the stored `selector`
 * (already scoped for recent selections; a legacy fallback for old comments).
 * Every halo / pin / toolbar / spacing-handle resolver routes through this so a
 * shared component anchors to the instance the user actually clicked.
 */
export function resolveSelectionEl(
  doc: Document,
  sel: { id?: string | null; selector?: string | null; artboardId?: string | null }
): Element | null {
  if (sel.id) {
    try {
      const el = doc.querySelector(scopedCdSelector(sel.id, sel.artboardId));
      if (el) return el;
    } catch {
      /* malformed selector — fall through */
    }
  }
  if (sel.selector) {
    try {
      return doc.querySelector(sel.selector);
    } catch {
      /* malformed selector */
    }
  }
  return null;
}

export function hoverTargetToSelection(target: HoverTarget, file?: string): Selection {
  const el = target.el;
  const rect =
    el && (el as HTMLElement).getBoundingClientRect
      ? (el as HTMLElement).getBoundingClientRect()
      : null;
  // `cdId` is the hit element's OWN data-cd-id (deep mode); resolver never
  // climbs to an ancestor. Falls back to cssPath of the hit when no stable
  // anchor exists.
  const cdId = target.cdId;
  // Selector resolution order:
  //   1. data-cd-id anchor — stable pipeline-stamped id (preferred). SCOPED by
  //      the hit's artboard (`[data-dc-screen=…] [data-cd-id=…]`) — a component
  //      shared across artboards carries the SAME data-cd-id in each, so an
  //      unscoped `[data-cd-id]` selector resolves (via querySelector) to the
  //      FIRST artboard's instance and the pin/select lands on the wrong board.
  //      Prefixing the artboard makes the anchor per-instance.
  //   2. data-dc-screen — chrome click promoted to whole-artboard select
  //      (T24.5 G8 multi-artboard gesture).
  //   3. cssPath of the hit — last-resort path string.
  const selector = cdId
    ? scopedCdSelector(cdId, target.artboardId)
    : target.artboardId
      ? `[data-dc-screen="${target.artboardId}"]`
      : cssPath(el);
  return {
    file: file ?? deriveFile(),
    id: cdId ?? undefined,
    selector,
    artboardId: target.artboardId,
    tag: el?.tagName.toLowerCase() ?? '',
    classes: realClasses(el),
    text: shortText(el, 240),
    dom_path: domPath(el),
    bounds: rect
      ? {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        }
      : null,
    html: el ? (el.outerHTML ?? '').slice(0, 4000) : '',
  };
}
