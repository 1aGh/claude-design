// Active-canvas state, selected-element tracking, and HTML injection
// (inspector overlay + canvas runtime). See plan Task 7 + DDR-007.

import path from 'node:path';
import type { Context } from './context.ts';

export interface SelectedElement {
  file: string;
  selector: string;
  tag: string;
  classes: string;
  text: string;
  dom_path: string[];
  bounds: { x: number; y: number; w: number; h: number } | null;
  html: string;
  ts: string;
  v: 1; // schema version — bumped to 2 in Phase 3.6 when migrating to data-cd-id paths
}

export interface ActiveState {
  active: string | null;
  open_tabs: string[];
  selected: SelectedElement | null;
  last_change: string | null;
  session_started: string;
  active_comments?: unknown[];
}

export interface Inspect {
  state: ActiveState;
  load(): Promise<void>;
  setActive(file: string): void;
  setOpenTabs(tabs: string[]): void;
  setSelected(sel: Omit<SelectedElement, 'ts' | 'v'> | null): void;
  save(): Promise<void>;
  injectInto(html: string): string;
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

  function setSelected(sel: Omit<SelectedElement, 'ts' | 'v'> | null) {
    if (sel && typeof sel === 'object') {
      state.selected = {
        file: typeof sel.file === 'string' ? sel.file : (state.active ?? ''),
        selector: String(sel.selector || ''),
        tag: String(sel.tag || ''),
        classes: String(sel.classes || ''),
        text: String(sel.text || '').slice(0, 240),
        dom_path: Array.isArray(sel.dom_path) ? sel.dom_path.slice(0, 16) : [],
        bounds: sel.bounds ?? null,
        html: String(sel.html || '').slice(0, 4000),
        ts: new Date().toISOString(),
        v: 1,
      };
    } else {
      state.selected = null;
    }
    state.last_change = new Date().toISOString();
    scheduleSave();
    ctx.bus.emit('selected', state.selected);
  }

  function injectInto(html: string): string {
    let out = stripLegacyRuntime(html);
    out = injectRuntime(out);
    out = injectInspector(out);
    return out;
  }

  return { state, load, setActive, setOpenTabs, setSelected, save, injectInto };
}

// ---------- Runtime + Inspector script injection ----------

const RUNTIME_INJECT = `
<!-- design-plugin canvas runtime (single source of truth, served by dev server) -->
<script type="text/babel" src="/_runtime/design-canvas.jsx" data-design-runtime="1"></script>
<script type="text/babel" src="/_runtime/tweaks-panel.jsx"  data-design-runtime="1"></script>
`;

function stripLegacyRuntime(html: string): string {
  return html
    .replace(/<script[^>]*src=["'][^"']*design-canvas\.jsx["'][^>]*><\/script>\s*/gi, '')
    .replace(/<script[^>]*src=["'][^"']*tweaks-panel\.jsx["'][^>]*><\/script>\s*/gi, '');
}

function injectRuntime(html: string): string {
  const bodyOpen = html.match(/<body[^>]*>/i);
  if (bodyOpen && bodyOpen.index !== undefined) {
    const idx = bodyOpen.index + bodyOpen[0].length;
    return html.slice(0, idx) + RUNTIME_INJECT + html.slice(idx);
  }
  const headClose = html.lastIndexOf('</head>');
  if (headClose !== -1) return html.slice(0, headClose) + RUNTIME_INJECT + html.slice(headClose);
  return RUNTIME_INJECT + html;
}

function injectInspector(html: string): string {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + INSPECTOR_SCRIPT;
  return html.slice(0, idx) + INSPECTOR_SCRIPT + html.slice(idx);
}

// Cmd+hover/click overlay injected into every served .html under designRoot.
// Posts selection events up to the parent frame via window.parent.postMessage.
// Mirror of server.mjs INSPECTOR_SCRIPT — kept verbatim so behaviour is identical.
const INSPECTOR_SCRIPT = `
<script>
(function() {
  if (window.__designInspectorAttached) return;
  window.__designInspectorAttached = true;
  var FILE = (function(){ try { return decodeURIComponent(location.pathname); } catch(e){ return location.pathname; } })().replace(/^\\//,'');

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.dgn-insp-hover { outline: 2px solid #00D4E4 !important; outline-offset: 1px !important; cursor: crosshair !important; }',
    '.dgn-insp-selected { outline: 2px solid #00D4E4 !important; outline-offset: 1px !important; box-shadow: 0 0 0 4px rgba(0,212,228,0.18) !important; }',
    '.dgn-insp-label { position: fixed; z-index: 2147483647; font: 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace; background: #00D4E4; color: #000; padding: 4px 8px; border-radius: 4px; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: translate(0, -110%); white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }',
    '.dgn-insp-label.warn { background: #ef4444; color: #fff; }',
    '.dgn-pin { position: absolute; top: 0; left: 0; z-index: 2147483646; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 999px 999px 999px 4px; background: #facc15; color: #1c1917; font: 600 11px/22px ui-sans-serif, system-ui, sans-serif; text-align: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4); transition: filter 120ms; transform-origin: bottom left; will-change: transform; }',
    '.dgn-pin:hover { filter: brightness(1.1); outline: 2px solid rgba(0,0,0,0.3); }',
    '.dgn-pin.resolved { background: #22c55e; color: #052e16; }',
    '.dgn-pin.focused { box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 2px #fff; outline: 2px solid #fff; }'
  ].join('\\n');
  document.documentElement.appendChild(styleEl);

  var label = document.createElement('div');
  label.className = 'dgn-insp-label';
  label.style.display = 'none';
  document.documentElement.appendChild(label);

  var pinLayer = document.createElement('div');
  pinLayer.id = 'dgn-pin-layer';
  pinLayer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
  document.documentElement.appendChild(pinLayer);

  var lastHover = null;
  var lastSelected = null;
  var modifierDown = false;
  var cKeyDown = false;
  var commentsCache = [];
  var focusedPinId = null;

  function isModifier(e) { return e.metaKey; }

  function shortText(el, max) {
    var t = (el.innerText || el.textContent || '').replace(/\\s+/g,' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  function realClasses(el) {
    return (el.getAttribute('class') || '').trim().split(/\\s+/)
      .filter(function(c) { return c && c.indexOf('dgn-') !== 0; });
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    var path = [];
    while (el && el.nodeType === 1 && path.length < 8) {
      var dscEl = el.getAttribute && el.getAttribute('data-dc-element');
      if (dscEl) { path.unshift('[data-dc-element="' + dscEl + '"]'); break; }
      var dscSc = el.getAttribute && el.getAttribute('data-dc-screen');
      if (dscSc) { path.unshift('[data-dc-screen="' + dscSc + '"]'); break; }
      var sel = el.nodeName.toLowerCase();
      if (el.id) { sel = '#' + el.id; path.unshift(sel); break; }
      var cls = realClasses(el).slice(0, 2);
      if (cls.length) sel += '.' + cls.join('.');
      var sib = 1, n = el;
      while ((n = n.previousElementSibling)) sib++;
      sel += ':nth-child(' + sib + ')';
      path.unshift(sel);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function domPath(el) {
    var hops = [];
    while (el && el.nodeType === 1 && hops.length < 8) {
      var label = el.nodeName.toLowerCase();
      var dEl = el.getAttribute && el.getAttribute('data-dc-element');
      var dSc = el.getAttribute && el.getAttribute('data-dc-screen');
      if (dEl) label += '[data-dc-element="' + dEl + '"]';
      else if (dSc) label += '[data-dc-screen="' + dSc + '"]';
      else if (el.id) label += '#' + el.id;
      var cls = realClasses(el).slice(0, 2);
      if (cls.length && !dEl && !dSc) label += '.' + cls.join('.');
      hops.unshift(label);
      el = el.parentElement;
    }
    return hops;
  }

  function elInfo(el) {
    var rect = el.getBoundingClientRect();
    return {
      file: FILE,
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      classes: realClasses(el).join(' '),
      text: shortText(el, 240),
      dom_path: domPath(el),
      bounds: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      html: (el.outerHTML || '').slice(0, 4000)
    };
  }

  function showLabel(text, x, y, warn) {
    label.style.display = '';
    label.style.left = (x + 12) + 'px';
    label.style.top = y + 'px';
    label.textContent = text;
    label.classList.toggle('warn', !!warn);
  }
  function hideLabel() { label.style.display = 'none'; }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Meta') modifierDown = true;
    if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey)) cKeyDown = true;
    if (e.key === 'Escape') {
      if (lastHover) lastHover.classList.remove('dgn-insp-hover');
      if (lastSelected) lastSelected.classList.remove('dgn-insp-selected');
      lastHover = null; lastSelected = null;
      hideLabel();
      try { window.parent.postMessage({ dgn: 'clear-select' }, '*'); } catch(e) {}
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey && !e.altKey) {
      if (lastSelected) {
        e.preventDefault();
        try { window.parent.postMessage({ dgn: 'comment-shortcut' }, '*'); } catch(e) {}
      }
    }
  }, true);
  document.addEventListener('keyup', function(e) {
    if (e.key === 'Meta') {
      modifierDown = false;
      if (lastHover) { lastHover.classList.remove('dgn-insp-hover'); lastHover = null; }
      hideLabel();
    }
    if (e.key === 'c' || e.key === 'C') cKeyDown = false;
  }, true);
  document.addEventListener('blur', function() {
    modifierDown = false;
    cKeyDown = false;
    if (lastHover) { lastHover.classList.remove('dgn-insp-hover'); lastHover = null; }
    hideLabel();
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (!isModifier(e)) {
      if (lastHover) { lastHover.classList.remove('dgn-insp-hover'); lastHover = null; }
      hideLabel();
      return;
    }
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === lastHover) return;
    if (el === label) return;
    if (lastHover) lastHover.classList.remove('dgn-insp-hover');
    lastHover = el;
    el.classList.add('dgn-insp-hover');
    var t = el.tagName.toLowerCase();
    var c = (el.getAttribute('class') || '').trim();
    showLabel(t + (c ? '.' + c.split(/\\s+/).slice(0,2).join('.') : ''), e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function(e) {
    if (!isModifier(e)) return;
    if (e.target && e.target.closest && e.target.closest('.dgn-pin')) return;
    e.preventDefault();
    e.stopPropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.classList.contains('dgn-pin')) return;
    if (lastSelected) lastSelected.classList.remove('dgn-insp-selected');
    lastSelected = el;
    el.classList.add('dgn-insp-selected');
    var info = elInfo(el);
    try { window.parent.postMessage({ dgn: 'select', selection: info }, '*'); } catch(err) {}
    var commentNow = e.shiftKey || cKeyDown;
    if (commentNow) {
      try { window.parent.postMessage({ dgn: 'comment-compose', selection: info }, '*'); } catch(err) {}
    }
    showLabel((commentNow ? 'comment: ' : 'selected: ') + info.tag + (info.classes ? '.' + info.classes.split(/\\s+/).slice(0,2).join('.') : ''), e.clientX, e.clientY);
    setTimeout(hideLabel, 1500);
  }, true);

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
    } else if (m.dgn === 'force-clear') {
      if (lastSelected) lastSelected.classList.remove('dgn-insp-selected');
      lastSelected = null;
    }
  });

  try { window.parent.postMessage({ dgn: 'loaded', file: FILE }, '*'); } catch(e) {}
})();
</script>
`;
