// Active-canvas state, selected-element tracking, and HTML injection
// (inspector overlay + canvas runtime). See plan Task 7 + DDR-007.

import path from 'node:path';
import type { Context } from './context.ts';

export interface SelectedElement {
  file: string;
  /** CSS-selector path (v1 anchor). Always present for backwards-compat + legacy HTML canvases. */
  selector: string;
  tag: string;
  classes: string;
  text: string;
  dom_path: string[];
  bounds: { x: number; y: number; w: number; h: number } | null;
  html: string;
  ts: string;
  /**
   * Schema version. v2 = TSX canvas with a `data-cd-id` anchor at click target
   * (or any ancestor — script walks via `closest()`); v1 = no `data-cd-id`
   * anywhere (legacy `.html` canvases, or click on shell chrome of a TSX
   * canvas). Readers must accept both during the grace window.
   */
  v: 1 | 2;
  /** Stable per-element id from canvas-pipeline two-pass transform. Present only when v === 2. */
  id?: string;
  /**
   * Canvas slug — POSIX, extension-less, relative to designRoot. Matches
   * `_locator.json` top-level keys. Present only when v === 2. The inspector
   * derives it server-side from `file` (stripping `<designRoot>/` prefix + `.tsx`).
   */
  canvas?: string;
}

/**
 * Phase 4.1: `selected` widens from `SelectedElement | null` to
 * `SelectedElement | SelectedElement[] | null` for multi-select via canvas-shell
 * input router. Readers must accept all three shapes. Writer below emits a
 * single object when cardinality is 1 (back-compat with `/design:edit` +
 * downstream tools that read the legacy shape) and an array for N > 1.
 */
export type SelectedValue = SelectedElement | SelectedElement[] | null;

export interface ActiveState {
  active: string | null;
  open_tabs: string[];
  selected: SelectedValue;
  last_change: string | null;
  session_started: string;
  active_comments?: unknown[];
}

type SetSelectedInput =
  | Omit<SelectedElement, 'ts' | 'v' | 'canvas'>
  | Array<Omit<SelectedElement, 'ts' | 'v' | 'canvas'>>
  | null;

export interface Inspect {
  state: ActiveState;
  load(): Promise<void>;
  setActive(file: string): void;
  setOpenTabs(tabs: string[]): void;
  setSelected(sel: SetSelectedInput): void;
  save(): Promise<void>;
  injectInspector(html: string): string;
}

const NEW = (): ActiveState => ({
  active: null,
  open_tabs: [],
  selected: null,
  last_change: null,
  session_started: new Date().toISOString(),
});

export function createInspect(
  ctx: Context,
  loadActiveComments: (file: string) => Promise<unknown[]>
): Inspect {
  const state: ActiveState = NEW();
  let saveQueued = false;

  async function save() {
    saveQueued = false;
    try {
      // Bun.write creates parent dirs automatically — no .keep poke needed.
      let active_comments: unknown[] = [];
      if (state.active) {
        try {
          active_comments = await loadActiveComments(state.active);
        } catch {
          /* ignore */
        }
      }
      const enriched = { ...state, active_comments };
      await Bun.write(ctx.paths.activeFile, JSON.stringify(enriched, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('  warn: failed to save _active.json:', msg);
    }
  }

  function scheduleSave() {
    if (saveQueued) return;
    saveQueued = true;
    queueMicrotask(save);
  }

  async function load() {
    try {
      const raw = await Bun.file(ctx.paths.activeFile).text();
      const prev = JSON.parse(raw);
      Object.assign(state, prev, { session_started: new Date().toISOString() });
    } catch {
      // first boot
    }
  }

  function setActive(file: string) {
    if (typeof file !== 'string') return;
    if (state.active === file) return;
    state.active = file || null;
    state.selected = null;
    state.last_change = new Date().toISOString();
    scheduleSave();
    ctx.bus.emit('active', state.active);
  }

  function setOpenTabs(tabs: string[]) {
    if (!Array.isArray(tabs)) return;
    state.open_tabs = tabs.filter((t): t is string => typeof t === 'string');
    state.last_change = new Date().toISOString();
    scheduleSave();
  }

  function enrich(sel: Omit<SelectedElement, 'ts' | 'v' | 'canvas'>): SelectedElement {
    const file = typeof sel.file === 'string' ? sel.file : (state.active ?? '');
    const id = typeof sel.id === 'string' && sel.id ? sel.id : undefined;
    const v: 1 | 2 = id ? 2 : 1;
    return {
      file,
      selector: String(sel.selector || ''),
      tag: String(sel.tag || ''),
      classes: String(sel.classes || ''),
      text: String(sel.text || '').slice(0, 240),
      dom_path: Array.isArray(sel.dom_path) ? sel.dom_path.slice(0, 16) : [],
      bounds: sel.bounds ?? null,
      html: String(sel.html || '').slice(0, 4000),
      ts: new Date().toISOString(),
      v,
      ...(id ? { id, canvas: deriveCanvasSlug(file) } : {}),
    };
  }

  function setSelected(sel: SetSelectedInput) {
    if (sel == null) {
      state.selected = null;
    } else if (Array.isArray(sel)) {
      const enriched = sel
        .filter(
          (s): s is Omit<SelectedElement, 'ts' | 'v' | 'canvas'> => !!s && typeof s === 'object'
        )
        .map(enrich);
      // Writer back-compat: collapse single-entry array to a bare object so
      // legacy readers (`/design:edit`, handoff tooling) keep working without
      // schema awareness. N>1 stays as an array.
      if (enriched.length === 0) state.selected = null;
      else if (enriched.length === 1) state.selected = enriched[0] ?? null;
      else state.selected = enriched;
    } else if (typeof sel === 'object') {
      state.selected = enrich(sel);
    } else {
      state.selected = null;
    }
    state.last_change = new Date().toISOString();
    scheduleSave();
    ctx.bus.emit('selected', state.selected);
  }

  /**
   * Canvas slug for v2 selections. Mirrors `canvasSlug()` from locator.ts but
   * accepts a designRoot-relative `file` path (which is what the iframe reports)
   * rather than an absolute one. Strips a leading `<designRoot-relative>/` if
   * present and strips the final extension.
   */
  function deriveCanvasSlug(file: string): string {
    let s = (file || '').replace(/^\/+/, '');
    // Strip a leading designRoot prefix if it's part of the file path. The
    // iframe's pathname includes the design root (e.g. `.design/ui/Foo.tsx`);
    // locator.ts strips it via path.relative — mirror that here.
    const dr = ctx.paths.designRel.replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
    if (dr && s.startsWith(`${dr}/`)) s = s.slice(dr.length + 1);
    const dot = s.lastIndexOf('.');
    return dot > 0 ? s.slice(0, dot) : s;
  }

  return {
    state,
    load,
    setActive,
    setOpenTabs,
    setSelected,
    save,
    injectInspector,
  };
}

// ---------- Inspector script injection ----------

function injectInspector(html: string): string {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + INSPECTOR_SCRIPT;
  return html.slice(0, idx) + INSPECTOR_SCRIPT + html.slice(idx);
}

// Comment-pin rendering overlay injected into every served HTML page under
// designRoot. Pin layer is the ONLY responsibility — hover/click selection is
// owned by canvas-shell.tsx (TSX canvases) and isn't applicable to legacy
// `.html` mocks since the broader migration to TSX. Pin layer keeps working
// in both, because pins are positioned by selector and updated via the
// `comments-set` postMessage channel from the shell.
const INSPECTOR_SCRIPT = `
<script>
(function() {
  if (window.__designInspectorAttached) return;
  window.__designInspectorAttached = true;

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.dgn-pin { position: absolute; top: 0; left: 0; z-index: 2147483646; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 999px 999px 999px 4px; background: #facc15; color: #1c1917; font: 600 11px/22px var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); text-align: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4); transition: filter 120ms; transform-origin: bottom left; will-change: transform; }',
    '.dgn-pin:hover { filter: brightness(1.1); outline: 2px solid rgba(0,0,0,0.3); }',
    '.dgn-pin.resolved { background: #22c55e; color: #052e16; }',
    '.dgn-pin.focused { box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 2px #fff; outline: 2px solid #fff; }',
    /* Phase 13 / DDR-029 — canvas activity overlay. Single injection point so the
       canvas iframe stays self-contained. Scoped with html ... so canvas-page
       stylesheets can't clobber it. The "editing" motion is a light scan beam
       (Phase 13.3) sweeping the whole artboard top→bottom — transform-only
       (compositor), unmounts when the file goes idle (infinite-with-control,
       flow:motion-rules §5); reduced-motion drops the beam to a static rim. The
       rim border + glow are static boundary chrome. */
    'html .dc-activity-rim { position: absolute; pointer-events: none; box-sizing: border-box; border: 2.5px solid var(--mdcc-activity, hsl(210 90% 58%)); border-radius: 5px; z-index: 6; opacity: 1; transition: opacity 200ms ease-out; }',
    'html .dc-activity-rim[data-fading="true"] { opacity: 0; }',
    'html .dc-activity-rim::after { content: ""; position: absolute; inset: -1px; border-radius: 6px; box-shadow: 0 0 0 1px var(--mdcc-activity, hsl(210 90% 58%)), 0 0 16px 2px var(--mdcc-activity, hsl(210 90% 58%)); opacity: 0.55; pointer-events: none; will-change: opacity; animation: dc-activity-glow var(--mdcc-activity-scan-ms, 2200ms) ease-in-out infinite; }',
    'html .dc-activity-badge { position: absolute; top: 4px; right: 4px; z-index: 2; padding: 2px 8px; border-radius: 4px; background: var(--mdcc-activity, hsl(210 90% 58%)); color: #fff; font: 600 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.45); }',
    /* Phase 13.3 — the AGENT BORDER is the primary "editing" indicator: a clear
       2.5px border in the agent color with a softly pulsing glow (::after,
       opacity-only, compositor). Clipping lives on the wash (not the rim) so the
       outward glow is not clipped. The dc-activity-scan wash is ONE full-artboard
       wave: a single gradient with a SHARP bottom edge (full agent color) fading
       up to transparent at the top (height = artboard). Its sharp edge enters at
       the top and the whole wave travels straight down and off past the bottom
       edge (translateY -100% → 100%), then the next wave enters from the top in a
       loop. transform-only; linear so it flows at a steady pace. */
    'html .dc-activity-scan { position: absolute; inset: 0; overflow: hidden; border-radius: 4px; pointer-events: none; z-index: 1; }',
    'html .dc-activity-scan::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 135%; will-change: transform; background: linear-gradient(to top, color-mix(in oklab, var(--mdcc-activity, hsl(210 90% 58%)) 20%, transparent) 0%, transparent 100%); animation: dc-activity-wave var(--mdcc-activity-scan-ms, 3800ms) linear infinite; }',
    '@keyframes dc-activity-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.85; } }',
    '@keyframes dc-activity-wave { from { transform: translateY(-100%); } to { transform: translateY(100%); } }',
    '@media (prefers-reduced-motion: reduce) { html .dc-activity-rim { transition: none; } html .dc-activity-rim::after { animation: none; opacity: 0.55; } html .dc-activity-scan { display: none; } }',
    /* Phase 13.1 / DDR-077 — "holding last good render" toast, shown when an
       agent edit produced a broken intermediate (build/render error) and the
       canvas is held instead of flashing white. Amber = warn, distinct from the
       blue activity rim. pointer-events:none so it never blocks the canvas. */
    'html .dc-hmr-holding { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483646; pointer-events: none; max-width: 90vw; padding: 6px 12px; border-radius: 6px; background: hsl(38 92% 50% / 0.96); color: #1c1207; font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 10px rgba(0,0,0,0.45); }'
  ].join('\\n');
  document.documentElement.appendChild(styleEl);

  var pinLayer = document.createElement('div');
  pinLayer.id = 'dgn-pin-layer';
  pinLayer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
  document.documentElement.appendChild(pinLayer);

  var commentsCache = [];
  var focusedPinId = null;

  var pinNodes = [];
  var rafToken = null;

  function buildPinNodes() {
    pinLayer.innerHTML = '';
    pinNodes = [];
    var withSelector = commentsCache.filter(function(c) { return c && c.selector; });
    withSelector.forEach(function(c, i) {
      var target = null;
      try { target = document.querySelector(c.selector); } catch (e) {}
      var pin = document.createElement('button');
      pin.className = 'dgn-pin' + (c.status === 'resolved' ? ' resolved' : '') + (c.id === focusedPinId ? ' focused' : '');
      pin.textContent = String(i + 1);
      pin.title = (c.text || '').slice(0, 200);
      pin.style.pointerEvents = 'auto';
      pin.style.left = '0px';
      pin.style.top = '0px';
      pin.dataset.id = c.id;
      pin.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        focusedPinId = c.id;
        try { window.parent.postMessage({ dgn: 'comment-click', id: c.id }, '*'); } catch (e) {}
        buildPinNodes();
      });
      pinLayer.appendChild(pin);
      pinNodes.push({ el: pin, comment: c, target: target });
    });
    placePins();
  }

  function placePins() {
    if (!pinNodes.length) return;
    for (var i = 0; i < pinNodes.length; i++) {
      var node = pinNodes[i];
      var x, y, hidden = false;
      if (!node.target || !node.target.isConnected) {
        try { node.target = document.querySelector(node.comment.selector); } catch (e) {}
      }
      if (node.target) {
        var r = node.target.getBoundingClientRect();
        x = r.left + window.scrollX - 8;
        y = r.top + window.scrollY - 8;
        if (r.width === 0 && r.height === 0) hidden = true;
      } else if (node.comment.bounds) {
        x = node.comment.bounds.x - 8;
        y = node.comment.bounds.y - 8;
      } else {
        hidden = true;
      }
      if (hidden) {
        node.el.style.display = 'none';
      } else {
        node.el.style.display = '';
        var scale = (node.comment.id === focusedPinId) ? 1.2 : 1;
        node.el.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px) scale(' + scale + ')';
      }
    }
  }

  function tick() {
    rafToken = null;
    placePins();
    if (pinNodes.length) rafToken = requestAnimationFrame(tick);
  }
  function startTick() {
    if (rafToken == null && pinNodes.length) rafToken = requestAnimationFrame(tick);
  }

  function schedulePins() { buildPinNodes(); startTick(); }

  window.addEventListener('resize', placePins);
  document.addEventListener('scroll', placePins, { passive: true, capture: true });
  document.addEventListener('wheel',  function() { startTick(); }, { passive: true, capture: true });
  document.addEventListener('pointermove', function(e) { if (e.buttons) startTick(); }, { passive: true, capture: true });
  document.addEventListener('keyup', function() { startTick(); }, true);
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function(){ startTick(); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['style', 'class'], childList: true });
  }

  window.addEventListener('message', function(e) {
    var m = e.data;
    if (!m || typeof m !== 'object' || !m.dgn) return;
    if (m.dgn === 'comments-set' && Array.isArray(m.comments)) {
      commentsCache = m.comments;
      schedulePins();
    } else if (m.dgn === 'comment-focus') {
      focusedPinId = m.id || null;
      pinNodes.forEach(function(node) {
        node.el.classList.toggle('focused', node.comment.id === focusedPinId);
      });
      placePins();
      startTick();
      var c = commentsCache.find(function(x){ return x && x.id === m.id; });
      if (c && c.selector) {
        try {
          var t = document.querySelector(c.selector);
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }
    }
    /* force-clear is now consumed by canvas-shell.tsx — the inspector
       overlay has no per-element selection state to clear anymore. */
  });

  try {
    var p = location.pathname;
    var file;
    if (p === '/_canvas-shell.html' || p === '/_canvas-shell') {
      var qs = new URLSearchParams(location.search);
      var canvas = qs.get('canvas') || '';
      var designRel = (qs.get('designRel') || '.design').replace(/^\\/+|\\/+$/g, '');
      file = designRel + '/' + canvas;
    } else {
      file = decodeURIComponent(p).replace(/^\\//, '');
    }
    window.parent.postMessage({ dgn: 'loaded', file: file }, '*');
  } catch (e) {}
})();
</script>
`;
