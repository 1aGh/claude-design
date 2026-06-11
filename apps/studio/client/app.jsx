// Design plugin local browser — React UI.
// Bundled via Bun.build (DDR-009/012) — IIFE, tree-shaken, React 19 from npm.
// Renders: file tree, tabs, viewport (iframes), status bar, design-system view, comments.
// Universal — no project tokens needed; styling lives in client/styles/.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Trusted tool→cursor resolver (shares the single TOOL_CURSORS source with the
// canvas runtime). canvas-cursors.ts is dependency-free (a type-only Tool
// import that Bun erases), so this pulls only string constants into the client
// bundle — no React, no input-router. See the tool-cursor handler below.
import { resolveToolCursor } from '../canvas-cursors.ts';
import { canvasUrl } from './canvas-url.js';
import { TourOverlay } from './tour/overlay.jsx';
import { USAGE_TOUR } from './tour/usage-tour.js';
import { useWhatsNew, WhatsNewPanel, WhatsNewToast } from './whats-new.jsx';

const USAGE_TOUR_STORE = 'mdcc-usage-tour-seen';

const SYSTEM_TAB = '__system__';
const THEME_STORE = 'mdcc-theme';
const SHOW_HIDDEN_STORE = 'mdcc-show-hidden';
const SECTIONS_STORE = 'mdcc-sections-expanded';
const SIDEBAR_STORE = 'mdcc-sidebar-open';
const CANVAS_EXT_RE = /\.(tsx|html?)$/i;
// Bun's `define` substitutes this at build time (see build.ts); falls back when
// the bundle is consumed in a context that hasn't run the build.
const MDCC_VERSION = typeof __MDCC_VERSION__ !== 'undefined' ? __MDCC_VERSION__ : 'dev';

function readInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORE);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  // Match the data-theme attribute index.html ships with (dark).
  return 'dark';
}

function readBoolStore(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {}
  return fallback;
}

function readJsonStore(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

// Section default-open: working sections (project + non-DS canvas groups)
// open; meta sections (DS + runtime) collapsed. Users can override per-section
// via the chevron; overrides persist in localStorage.
function sectionDefaultOpen(g) {
  if (g.kind === 'runtime') return false;
  if (g.label === 'Design system') return false;
  return true;
}

// ---------- Utility ----------

// Iframe src for a canvas path. TSX canvases go through _canvas-shell.html so
// the bundled React 19 runtime + importmap can mount the default export. HTML
// canvases keep the legacy "serve the file with inspector + Babel injected"
// path. Phase 3.6 contract; the path argument is repo-root-relative
// (e.g. ".design/ui/Foo.tsx"). Pure resolver extracted to ./canvas-url.js so
// the token-resolution branches are unit-testable without a DOM (DDR-093).

function basename(p) {
  return p.split('/').pop();
}

// Strip canvas extensions for display. `Canvas Viewport.tsx` → `Canvas Viewport`.
// Sidecars (`.meta.json`, `.css`, `.registry.json`) keep their extensions so
// the file type stays unambiguous.
function displayName(name) {
  return name.replace(CANVAS_EXT_RE, '');
}

// Primary base = name with the canvas extension stripped. `Canvas Viewport.tsx`
// → `Canvas Viewport`. A sidecar belongs to that primary when its name starts
// with `<base>.` — so `Canvas Viewport.meta.json` and `Canvas Viewport.css`
// both nest under `Canvas Viewport.tsx`. Naïve single-extension stripping
// breaks for multi-dot sidecars like `*.meta.json`.
function canvasBase(name) {
  return name.replace(CANVAS_EXT_RE, '');
}

// Group flat file list into { primary: canvas, sidecars: [...] }. Sidecars
// share the primary base + `.` prefix and don't themselves match the canvas
// extension regex. Orphans (no canvas peer at this dir level) come back as
// `{ primary: orphan, sidecars: [], orphan: true }` so the caller can gate
// them on `showHidden`.
function groupBySidecar(files) {
  // Pass 1 — claim primaries; prefer .tsx over .html on tie.
  const primaryByBase = new Map();
  for (const f of files) {
    if (!CANVAS_EXT_RE.test(f.name)) continue;
    const base = canvasBase(f.name);
    if (!primaryByBase.has(base) || /\.tsx$/i.test(f.name)) primaryByBase.set(base, f);
  }
  // Pass 2 — match non-canvas files to the longest primary base they prefix.
  const sidecarsByBase = new Map();
  const orphans = [];
  for (const f of files) {
    if (CANVAS_EXT_RE.test(f.name)) continue;
    let matched = null;
    for (const base of primaryByBase.keys()) {
      if (f.name === base) continue;
      if (f.name.startsWith(`${base}.`)) {
        if (!matched || base.length > matched.length) matched = base;
      }
    }
    if (matched) {
      const list = sidecarsByBase.get(matched) || [];
      list.push(f);
      sidecarsByBase.set(matched, list);
    } else {
      orphans.push(f);
    }
  }
  const canvases = [];
  for (const [base, primary] of primaryByBase) {
    const sidecars = (sidecarsByBase.get(base) || []).sort((a, b) => a.name.localeCompare(b.name));
    canvases.push({ primary, sidecars, orphan: false });
  }
  canvases.sort((a, b) => a.primary.name.localeCompare(b.primary.name));
  orphans.sort((a, b) => a.name.localeCompare(b.name));
  return {
    canvases,
    orphans: orphans.map((f) => ({ primary: f, sidecars: [], orphan: true })),
  };
}

function buildTree(paths, stripPrefix) {
  const root = {};
  for (const p of paths) {
    const stripped = p.startsWith(stripPrefix)
      ? p.slice(stripPrefix.length).replace(/^\/+/, '')
      : p;
    const parts = stripped.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        node._files = node._files || [];
        node._files.push({ name: key, path: p });
      } else {
        node[key] = node[key] || {};
        node = node[key];
      }
    }
  }
  return root;
}

function filterTree(node, query) {
  if (!query) return node;
  const q = query.toLowerCase();
  const out = {};
  let any = false;
  const dirs = Object.keys(node).filter((k) => k !== '_files');
  for (const d of dirs) {
    const filtered = filterTree(node[d], query);
    if (filtered) {
      out[d] = filtered;
      any = true;
    }
  }
  if (node._files) {
    const files = node._files.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
    if (files.length) {
      out._files = files;
      any = true;
    }
  }
  return any ? out : null;
}

function openCount(comments) {
  return (comments || []).filter((c) => c.status !== 'resolved').length;
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  if (d < 7) return d + 'd';
  return new Date(iso).toLocaleDateString();
}

function totalCounts(commentsByFile) {
  let all = 0,
    open = 0,
    resolved = 0;
  for (const list of Object.values(commentsByFile || {})) {
    for (const c of list || []) {
      all++;
      if (c.status === 'resolved') resolved++;
      else open++;
    }
  }
  return { all, open, resolved };
}

// ---------- Components ----------

function Icon({ d, size = 14, color }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      <path d={d} />
    </svg>
  );
}

// ───── maude DS icon set (Plan B) ─────
// Thin-stroke (1.4) 16×16 geometric glyphs lifted from .design/ui/Studio.tsx —
// the icon vocabulary the ported `.st-*` chrome composes with. Distinct from the
// legacy 24×24 single-path `Icon` above (kept for not-yet-ported chrome). Grown
// per slice; this slice (menubar/statusbar) needs sparkle/check/sun/moon plus a
// few the sidebar + panels reuse later.
const STICONS = {
  'chevron-down': <polyline points="3.5 6 8 10.5 12.5 6" />,
  'chevron-right': <polyline points="6 3.5 10.5 8 6 12.5" />,
  file: (
    <>
      <path d="M4 2h5l3 3v9H4z" />
      <polyline points="9 2 9 5 12 5" />
    </>
  ),
  folder: <path d="M2 4.5h4l1.3 1.5H14V13H2z" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <line x1="10" y1="10" x2="13.5" y2="13.5" />
    </>
  ),
  plus: (
    <>
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </>
  ),
  check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
  x: (
    <>
      <line x1="4.3" y1="4.3" x2="11.7" y2="11.7" />
      <line x1="11.7" y1="4.3" x2="4.3" y2="11.7" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <line x1="8" y1="1.5" x2="8" y2="3" />
      <line x1="8" y1="13" x2="8" y2="14.5" />
      <line x1="1.5" y1="8" x2="3" y2="8" />
      <line x1="13" y1="8" x2="14.5" y2="8" />
      <line x1="3.4" y1="3.4" x2="4.4" y2="4.4" />
      <line x1="11.6" y1="11.6" x2="12.6" y2="12.6" />
      <line x1="12.6" y1="3.4" x2="11.6" y2="4.4" />
      <line x1="4.4" y1="11.6" x2="3.4" y2="12.6" />
    </>
  ),
  moon: <path d="M12.5 9.6A5 5 0 1 1 7 3a4 4 0 0 0 5.5 6.6z" />,
  sparkle: (
    <path d="M8 1.8l1.4 4.8L14 8l-4.6 1.4L8 14.2l-1.4-4.8L2 8l4.6-1.4z" fill="currentColor" stroke="none" />
  ),
  'panel-left': (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <line x1="6.4" y1="3" x2="6.4" y2="13" />
    </>
  ),
  resolve: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <polyline points="5.4 8 7.2 9.9 10.6 6" />
    </>
  ),
  reopen: (
    <>
      <path d="M3.2 8a5 5 0 1 1 1.4 3.5" />
      <polyline points="3.2 11.4 3.2 8 6.6 8" />
    </>
  ),
  layers: (
    <>
      <polygon points="8 2.2 13.8 5.5 8 8.8 2.2 5.5" />
      <polyline points="2.2 9 8 12.3 13.8 9" />
    </>
  ),
  sliders: (
    <>
      <line x1="3" y1="5" x2="13" y2="5" />
      <circle cx="6" cy="5" r="1.7" fill="currentColor" />
      <line x1="3" y1="11" x2="13" y2="11" />
      <circle cx="10" cy="11" r="1.7" fill="currentColor" />
    </>
  ),
  code: (
    <>
      <polyline points="6 5 3 8 6 11" />
      <polyline points="10 5 13 8 10 11" />
    </>
  ),
  download: (
    <>
      <line x1="8" y1="2.5" x2="8" y2="10" />
      <polyline points="4.5 7 8 10.5 11.5 7" />
      <polyline points="3 12.8 3 13.6 13 13.6 13 12.8" />
    </>
  ),
  reload: (
    <>
      <path d="M3.2 8a5 5 0 1 1 1.4 3.5" />
      <polyline points="3.2 11.4 3.2 8 6.6 8" />
    </>
  ),
  help: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.3 6.2a1.8 1.8 0 1 1 2.3 1.9c-.5.2-.6.5-.6 1v.3" />
      <line x1="8" y1="11.4" x2="8" y2="11.5" />
    </>
  ),
  // Export-format glyphs (Plan C) — one distinct mark per format card.
  image: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.3" r="1.1" />
      <path d="M3 12l3-2.8 2.2 1.8 2.4-3L13.5 12" />
    </>
  ),
  vector: (
    <>
      <path d="M3.6 11.2C6 5 10 5 12.4 11.2" />
      <rect x="1.7" y="9.8" width="2.6" height="2.6" rx="0.4" />
      <rect x="11.7" y="9.8" width="2.6" height="2.6" rx="0.4" />
      <rect x="6.7" y="2.6" width="2.6" height="2.6" rx="0.4" />
    </>
  ),
  presentation: (
    <>
      <rect x="2.5" y="3" width="11" height="7.4" rx="1" />
      <line x1="8" y1="10.4" x2="8" y2="13" />
      <line x1="5.6" y1="13.4" x2="10.4" y2="13.4" />
    </>
  ),
  archive: (
    <>
      <rect x="2.5" y="3" width="11" height="3" rx="0.8" />
      <path d="M3.6 6v6.2a1 1 0 0 0 1 1h6.8a1 1 0 0 0 1-1V6" />
      <line x1="6.6" y1="8.8" x2="9.4" y2="8.8" />
    </>
  ),
  external: (
    <>
      <path d="M11 8.5V12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h3.5" />
      <polyline points="9.5 3 13 3 13 6.5" />
      <line x1="13" y1="3" x2="7.6" y2="8.4" />
    </>
  ),
};

// ⌘K command palette — the mockup's signature surface, wired to real shell
// actions (theme, system view, comments, reload, help, what's new, new board).
// Scoped to shell-doable actions only — in-canvas export lives in the iframe.
function CommandPalette({ open, onClose, actions }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        (a.group && a.group.toLowerCase().includes(needle))
    );
  }, [q, actions]);
  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);
  if (!open) return null;
  const run = (a) => {
    onClose();
    a.run();
  };
  return (
    <div
      className="st-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="st-pal-search">
          <StIcon name="search" size={18} />
          <input
            // biome-ignore lint/a11y/noAutofocus: command palette opens on an explicit ⌘K.
            autoFocus
            placeholder="Type a command or search…"
            value={q}
            aria-label="Command search"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered[active]) run(filtered[active]);
              }
            }}
          />
          <Kbd>⌘K</Kbd>
        </div>
        <div className="st-pal-list">
          {filtered.length === 0 ? (
            <div className="st-pal-empty">No matching command.</div>
          ) : (
            filtered.map((a, i) => {
              // Emit a group header when the group changes (flat list → grouped
              // display; keyboard nav still indexes across the whole array).
              const header =
                a.group && (i === 0 || filtered[i - 1].group !== a.group) ? (
                  <div className="st-pal-group" key={'g-' + a.group}>
                    {a.group}
                  </div>
                ) : null;
              return (
                <Fragment key={a.id}>
                  {header}
                  <button
                    type="button"
                    className={'st-pal-item' + (i === active ? ' is-active' : '')}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(a)}
                  >
                    <span className="st-pal-icon">
                      <StIcon name={a.icon} size={15} />
                    </span>
                    <span className="st-pal-label">{a.label}</span>
                    {a.kbd ? (
                      <span className="st-pal-kbd">
                        <Kbd>{a.kbd}</Kbd>
                      </span>
                    ) : null}
                  </button>
                </Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StIcon({ name, size = 16, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      {STICONS[name]}
    </svg>
  );
}

// P3 (Plan C) — menubar presence avatar (matches `.design/ui/Studio.tsx` Avatar).
// Up to two uppercase glyphs from a name; falls back to "?" for empties.
function initialsOf(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '?';
  // Single-token names (e.g. a git username "1aGh") → first two chars, so the
  // avatar reads as initials rather than a lone count badge.
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase() || '?';
}
function StAvatar({ initials, hue, title }) {
  return (
    <span className="st-avatar" style={{ background: hue }} title={title} aria-label={title}>
      {initials}
    </span>
  );
}

function Kbd({ children }) {
  return <span className="kbd">{children}</span>;
}

// T5 (Plan C) — shell-level Export & Handoff dialog (maude `.st-dialog`), per
// `.design/ui/Studio.tsx` HandoffBoard. Wired to the privileged main-origin
// `POST /_api/export` (7 real formats × scopes). The shadcn card is HANDOFF —
// a privileged disk-write kept off HTTP routes (DDR-054), so it surfaces the
// `/design:handoff` command instead. PPTX/Canva kept reachable (no silent cap).
const EXPORT_CARDS = [
  { id: 'png', label: 'PNG', sub: 'raster · 2×', icon: 'image', format: 'png', options: { scale: 2 } },
  { id: 'pdf', label: 'PDF', sub: 'vector · print', icon: 'file', format: 'pdf' },
  { id: 'svg', label: 'SVG', sub: 'per artboard', icon: 'vector', format: 'svg' },
  { id: 'html', label: 'HTML', sub: 'self-contained', icon: 'code', format: 'html' },
  { id: 'pptx', label: 'PPTX', sub: 'slides', icon: 'presentation', format: 'pptx' },
  { id: 'canva', label: 'Canva', sub: 'handoff bundle', icon: 'external', format: 'canva' },
  { id: 'zip', label: 'ZIP', sub: 'project bundle', icon: 'archive', format: 'zip' },
  { id: 'shadcn', label: 'AI handoff', sub: 'production drop', icon: 'sparkle', handoff: true },
];

// Mirrors export-dialog.tsx (the in-canvas dialog) so both entry points offer
// the same settings. Scope validity + PNG scale presets are ported verbatim.
const EXPORT_SCOPE_LABELS = {
  selection: 'Current selection',
  artboard: 'Active artboard',
  'canvas-as-separate': 'Canvas · artboards separate',
  'project-raw': 'Whole project (raw)',
};
const EXPORT_VALID_SCOPES = {
  png: ['selection', 'artboard', 'canvas-as-separate'],
  pdf: ['selection', 'artboard', 'canvas-as-separate'],
  svg: ['selection', 'artboard', 'canvas-as-separate'],
  html: ['artboard', 'canvas-as-separate'],
  pptx: ['canvas-as-separate'],
  canva: ['canvas-as-separate'],
  zip: ['project-raw'],
};
const PNG_SCALES = [
  { value: 1, label: '1× (native)' },
  { value: 2, label: '2× (retina)' },
  { value: 3, label: '3× (max)' },
];

function ExportDialog({ mode, initialScope, activePath, onClose }) {
  const [sel, setSel] = useState(mode === 'handoff' ? 'shadcn' : 'png');
  const [scope, setScope] = useState(
    initialScope && EXPORT_SCOPE_LABELS[initialScope] ? initialScope : 'artboard'
  );
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { ok, msg }
  const [recent, setRecent] = useState([]);
  const card = EXPORT_CARDS.find((c) => c.id === sel) || EXPORT_CARDS[0];
  const validScopes = card.handoff ? [] : EXPORT_VALID_SCOPES[card.format] || ['artboard'];

  // Keep the scope valid for the chosen format (pptx/zip etc. only allow a
  // subset) — mirrors VALID_SCOPES_PER_FORMAT in the in-canvas dialog.
  useEffect(() => {
    if (validScopes.length && !validScopes.includes(scope)) setScope(validScopes[0]);
  }, [validScopes, scope]);

  const loadRecent = useCallback(() => {
    fetch('/_api/export-history')
      .then((r) => r.json())
      .then((d) => setRecent(Array.isArray(d?.history) ? d.history.slice(0, 6) : []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function doExport() {
    if (card.handoff) {
      const p = activePath && activePath !== SYSTEM_TAB ? activePath : '<canvas>.tsx';
      const cmd = `/design:handoff ${p}`;
      try {
        await navigator.clipboard?.writeText(cmd);
      } catch {}
      setStatus({ ok: true, msg: `Copied: ${cmd} — run it in Claude Code.` });
      return;
    }
    setBusy(true);
    setStatus(null);
    const options = card.format === 'png' ? { scale } : {};
    try {
      const r = await fetch('/_api/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: card.format, scope, options }),
      });
      if (!r.ok) {
        setStatus({ ok: false, msg: (await r.text()) || `Export failed (${r.status})` });
        setBusy(false);
        return;
      }
      const disp = r.headers.get('Content-Disposition') || '';
      const fn = /filename="([^"]+)"/.exec(disp);
      const filename = (fn && fn[1]) || `export.${card.format}`;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus({ ok: true, msg: `Exported ${filename}` });
      loadRecent();
    } catch (err) {
      setStatus({ ok: false, msg: err && err.message ? err.message : String(err) });
    }
    setBusy(false);
  }

  return (
    <div
      className="st-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="st-dialog" role="dialog" aria-modal="true" aria-label="Export and handoff">
        <div className="st-dialog-hd">
          <span className="st-dialog-title">Export &amp; handoff</span>
          <button type="button" className="st-iconbtn" aria-label="Close" onClick={onClose}>
            <StIcon name="x" size={15} />
          </button>
        </div>
        <div className="st-dialog-bd">
          <div className="st-rp-hd">
            {activePath && activePath !== SYSTEM_TAB
              ? `Format · ${displayName(basename(activePath))}`
              : 'Format'}
          </div>
          <div className="st-fmt-grid">
            {EXPORT_CARDS.map((c) => (
              <button
                type="button"
                key={c.id}
                className={'st-fmt' + (c.id === sel ? ' is-on' : '')}
                onClick={() => {
                  setSel(c.id);
                  setStatus(null);
                }}
              >
                <StIcon name={c.icon} size={16} />
                <span className="st-fmt-name">{c.label}</span>
                <span className="st-fmt-sub">{c.sub}</span>
              </button>
            ))}
          </div>
          {!card.handoff && (
            <div className="st-dialog-row">
              <label className="st-dialog-lbl" htmlFor="st-export-scope">
                Scope
              </label>
              <select
                id="st-export-scope"
                className="st-select"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                {validScopes.map((s) => (
                  <option key={s} value={s}>
                    {EXPORT_SCOPE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!card.handoff && card.format === 'png' && (
            <div className="st-dialog-row">
              <label className="st-dialog-lbl" htmlFor="st-export-size">
                Size
              </label>
              <select
                id="st-export-size"
                className="st-select"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              >
                {PNG_SCALES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!card.handoff && card.format === 'png' && (
            <div className="st-mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              Resolution multiplier — {scale}× ≈ {1440 * scale}×{900 * scale} for a 1440×900 artboard.
            </div>
          )}
          {card.handoff && (
            <div className="callout callout--info" style={{ fontSize: 12 }}>
              Hands the active canvas off to production. Copies{' '}
              <span className="st-mono">/design:handoff &lt;path&gt;</span> — run it in Claude Code to
              emit a ready-to-drop production component next to the canvas.
            </div>
          )}
          {status && (
            <div
              className={'callout ' + (status.ok ? 'callout--success' : 'callout--error')}
              style={{ fontSize: 12 }}
            >
              {status.msg}
            </div>
          )}
          {recent.length > 0 && (
            <div className="st-export-recent">
              <div className="st-rp-hd">Recent</div>
              {recent.map((h, i) => (
                <div className="st-export-recent-row" key={i}>
                  <span>
                    {String(h.format || '').toUpperCase()} ·{' '}
                    {EXPORT_SCOPE_LABELS[h.scope] || h.scope}
                  </span>
                  <span className="st-mono">{h.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="st-dialog-ft">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={doExport}>
            <StIcon name="download" size={14} />
            {card.handoff
              ? 'Copy handoff command'
              : busy
                ? 'Exporting…'
                : `Export ${card.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ───── Tree (CV-08 spec) ─────
// File rows use `.tp-row` with optional .dir / .sel / .star / .modified
// modifiers + a leading `.glyph` (▾ open dir, ▸ closed dir / selected file,
// · file). Section headers use `.tp-section-hd` with a `.pill` counter.
// The flat-row model (vs the old nested <details>) mirrors the mock and
// keeps padding-left under explicit control per depth level.

const TREE_INDENT_BASE = 12;
const TREE_INDENT_STEP = 16;

function DirRow({ name, depth, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Fragment>
      <button
        type="button"
        role="treeitem"
        aria-expanded={open}
        tabIndex={-1}
        className="st-row"
        style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="st-row-glyph">
          <StIcon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
        </span>
        <span className="st-row-name">{name}</span>
      </button>
      {open && children}
    </Fragment>
  );
}

// DsFolderRow — a per-DS folder inside the DESIGN SYSTEM section.
// Split target: chevron toggles disclosure of the folder's contents; clicking
// the folder name opens the SystemView focused on that DS (single SystemView
// for now; the dsName is plumbed through so a future per-DS view can use it).
function DsFolderRow({ name, dsName, depth, defaultOpen, active, onOpenSystem, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Fragment>
      <div
        className={'st-row st-ds-folder' + (active ? ' is-sel' : '')}
        style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
        role="treeitem"
        aria-expanded={open}
      >
        <button
          type="button"
          className="st-ds-chev"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse design system' : 'Expand design system'}
          title={open ? 'Collapse' : 'Expand'}
        >
          <StIcon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
        </button>
        <button
          type="button"
          className="st-ds-open"
          onClick={() => onOpenSystem(dsName)}
          aria-label={`Open ${dsName} design system view`}
          title="Open the design system view"
        >
          <span className="st-row-glyph">
            <StIcon name="folder" size={13} />
          </span>
          <span className="st-row-name">{name}</span>
        </button>
      </div>
      {open && children}
    </Fragment>
  );
}

function FileRow({ file, activePath, onOpen, onDelete, openCount: oc, depth, kind, sidecar }) {
  const isSel = file.path === activePath;
  const isCanvas = CANVAS_EXT_RE.test(file.name);
  // Non-canvas rows (PROJECT *.md, RUNTIME _active.json, ...) are display-only —
  // clicking them doesn't open an iframe; we leave the click as no-op + cursor
  // hint via `aria-disabled`.
  const inert = !isCanvas;
  const label = isCanvas ? displayName(file.name) : file.name;
  // Delete only real canvases in a deletable group (onDelete is undefined for the
  // DS group + runtime files); the server enforces the rest.
  const canDelete = isCanvas && typeof onDelete === 'function' && kind !== 'runtime';
  const row = (
    <button
      type="button"
      role="treeitem"
      aria-selected={isSel}
      aria-disabled={inert ? 'true' : undefined}
      tabIndex={isSel ? 0 : -1}
      className={
        'st-row' + (isSel ? ' is-sel' : '') + (kind === 'runtime' ? ' is-muted' : '')
      }
      style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
      title={file.path + (oc ? ` — ${oc} open` : inert ? ' (file index only)' : '')}
      onClick={() => {
        if (!inert) onOpen(file.path);
      }}
    >
      <span className="st-row-glyph">
        <StIcon name="file" size={13} />
      </span>
      <span className="st-row-name">{label}</span>
      {oc > 0 && <span className="st-row-badge">{oc}</span>}
    </button>
  );
  if (!canDelete) return row;
  // A sibling delete button (can't nest a button in the row button). The wrapper
  // is presentational so the treeitem stays the tree's child for a11y.
  return (
    <div className="st-row-wrap" role="none">
      {row}
      <button
        type="button"
        className="st-row-del"
        title={`Delete ${label}`}
        aria-label={`Delete canvas ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(file.path, label);
        }}
      >
        <Icon d="M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 11v6 M14 11v6" size={12} />
      </button>
    </div>
  );
}

function CanvasRow({
  primary,
  sidecars,
  depth,
  kind,
  activePath,
  onOpen,
  onDelete,
  openCount: oc,
  showHidden,
  forceOpen,
}) {
  const hasSidecars = sidecars.length > 0;
  const [openState, setOpenState] = useState(false);
  // Sidecars are only revealed when the user opts in via `showHidden` — the
  // chevron itself only appears in that mode. When `forceOpen` is true (search
  // match in a sidecar), override local state so the user sees the hit.
  const open = forceOpen || openState;
  const isSel = primary.path === activePath;
  const showChevron = hasSidecars && showHidden;
  if (!showChevron) {
    return (
      <FileRow
        file={primary}
        activePath={activePath}
        onOpen={onOpen}
        onDelete={onDelete}
        openCount={oc}
        depth={depth}
        kind={kind}
      />
    );
  }
  return (
    <Fragment>
      <button
        type="button"
        role="treeitem"
        aria-selected={isSel}
        aria-expanded={open}
        tabIndex={isSel ? 0 : -1}
        className={'st-row st-canvas-row' + (isSel ? ' is-sel' : '')}
        style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
        title={primary.path}
        onClick={(e) => {
          // Click the chevron region → toggle disclosure. Click anywhere else → open canvas.
          if (e.target.closest('.st-canvas-chev')) {
            setOpenState((v) => !v);
            return;
          }
          onOpen(primary.path);
        }}
      >
        <span
          className="st-row-glyph st-canvas-chev"
          onClick={(e) => {
            e.stopPropagation();
            setOpenState((v) => !v);
          }}
        >
          <StIcon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
        </span>
        <span className="st-row-name">{displayName(primary.name)}</span>
        {oc > 0 && <span className="st-row-badge">{oc}</span>}
      </button>
      {open &&
        sidecars.map((sc) => (
          <FileRow
            key={sc.path}
            file={sc}
            activePath={activePath}
            onOpen={onOpen}
            openCount={0}
            depth={depth + 1}
            kind={kind}
            sidecar
          />
        ))}
    </Fragment>
  );
}

function Tree({
  node,
  activePath,
  onOpen,
  commentsByFile,
  depth = 1,
  kind,
  showHidden,
  search,
  dsFolders,
  activeDsName,
  onOpenSystem,
  onDelete,
}) {
  const dirs = Object.keys(node)
    .filter((k) => k !== '_files')
    .sort();
  const files = node._files || [];
  // VS Code-style sidecar grouping. Canvas (`.tsx`/`.html`) becomes the primary
  // row; same-basename non-canvas files (`.meta.json`, `.css`, …) collapse
  // under it. Orphans surface only when `showHidden` is on.
  const { canvases, orphans } = useMemo(() => groupBySidecar(files), [files]);
  const hasSearch = !!(search && search.trim());
  // DS-folder lookup: only meaningful at the top level of a DS group. The
  // server emits `dsFolders: [{name, folder}, ...]` so the client knows which
  // dir at depth=1 corresponds to a DS root (click → open SystemView).
  const dsFolderByName = useMemo(() => {
    if (!dsFolders || depth !== 1) return null;
    const m = new Map();
    for (const f of dsFolders) m.set(f.folder, f);
    return m;
  }, [dsFolders, depth]);
  return (
    <Fragment>
      {canvases.map((entry) => {
        const forceOpen =
          hasSearch &&
          entry.sidecars.some((sc) => {
            const q = search.toLowerCase();
            return sc.name.toLowerCase().includes(q) || sc.path.toLowerCase().includes(q);
          });
        return (
          <CanvasRow
            key={entry.primary.path}
            primary={entry.primary}
            sidecars={entry.sidecars}
            activePath={activePath}
            onOpen={onOpen}
            onDelete={onDelete}
            openCount={openCount(commentsByFile[entry.primary.path])}
            depth={depth}
            kind={kind}
            showHidden={showHidden}
            forceOpen={forceOpen}
          />
        );
      })}
      {showHidden &&
        orphans.map((entry) => (
          <FileRow
            key={entry.primary.path}
            file={entry.primary}
            activePath={activePath}
            onOpen={onOpen}
            openCount={openCount(commentsByFile[entry.primary.path])}
            depth={depth}
            kind={kind}
          />
        ))}
      {/* orphans are sidecars/loose files — no canvas to delete, so no onDelete */}
      {dirs.map((d) => {
        const dsMatch = dsFolderByName?.get(d);
        const childTree = (
          <Tree
            node={node[d]}
            activePath={activePath}
            onOpen={onOpen}
            commentsByFile={commentsByFile}
            depth={depth + 1}
            kind={kind}
            showHidden={showHidden}
            search={search}
            activeDsName={activeDsName}
            onOpenSystem={onOpenSystem}
            onDelete={onDelete}
          />
        );
        if (dsMatch && onOpenSystem) {
          return (
            <DsFolderRow
              key={d}
              name={d}
              dsName={dsMatch.name}
              depth={depth}
              defaultOpen={true}
              active={activePath === SYSTEM_TAB && dsMatch.name === activeDsName}
              onOpenSystem={onOpenSystem}
            >
              {childTree}
            </DsFolderRow>
          );
        }
        return (
          <DirRow key={d} name={d} depth={depth} defaultOpen={true}>
            {childTree}
          </DirRow>
        );
      })}
    </Fragment>
  );
}

// CV-08 section labels — title + optional SKU pill. The pill carries
// project / DS identity; the mock keeps these tight (1 line). Labels are
// keyed by the server-provided `kind` (PROJECT / DS / UI / RUNTIME).
const SECTION_META = {
  project: { title: 'PROJECT', pillFromCount: false },
  // Design-system group: pill shows the number of DSes (one row per DS folder
  // inside). Computed in Sidebar from `g.dsFolders.length`.
  ds: { title: 'DESIGN SYSTEM', pillFromDsCount: true },
  canvas: { title: 'UI CANVASES', pillFromCount: true },
  runtime: { title: 'RUNTIME · GITIGNORED', pillFromCount: true },
};

function sectionMetaFor(g) {
  if (g.kind === 'project') return SECTION_META.project;
  if (g.kind === 'runtime') return SECTION_META.runtime;
  // canvas-kind groups: "Design system" → ds, anything else → canvas label
  if (g.label === 'Design system') return SECTION_META.ds;
  if (g.label === 'UI kit') return SECTION_META.canvas;
  return { title: g.label.toUpperCase(), pillFromCount: true };
}

function Sidebar({
  groups,
  activePath,
  activeDsName,
  onOpen,
  onOpenSystem,
  wsConnected,
  search,
  setSearch,
  commentsByFile,
  showHidden,
  sectionsExpanded,
  onToggleSection,
  onNewBoard,
  onDeleteBoard,
  collapsed,
  onCollapse,
}) {
  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups.map((g) => ({ ...g, tree: filterTree(g.tree, search), filtered: !!search }));
  }, [groups, search]);

  // Phase 22 — inline "new brief board" composer in the tree header. Click +,
  // type a name, Enter to create (Esc cancels). The board opens active so it's
  // ready to annotate; generation (ingest) still goes through /design:new.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newErr, setNewErr] = useState('');
  const [newBusy, setNewBusy] = useState(false);

  const submitNewBoard = useCallback(async () => {
    const name = newName.trim();
    if (!name || newBusy) return;
    setNewBusy(true);
    setNewErr('');
    const res = await onNewBoard(name);
    setNewBusy(false);
    if (res?.ok) {
      setCreating(false);
      setNewName('');
    } else {
      setNewErr(res?.error || 'could not create board');
    }
  }, [newName, newBusy, onNewBoard]);

  // Mock uses `42 / 42` — total openable canvases, not every listed file.
  // We count canvas files (TSX Phase 3.6+ default, HTML legacy) so the counter
  // matches "canvases you can mount".
  const htmlCount = useMemo(() => {
    let total = 0;
    for (const g of groups) for (const p of g.paths || []) if (CANVAS_EXT_RE.test(p)) total++;
    return total;
  }, [groups]);
  const htmlShown = useMemo(() => {
    let total = 0;
    for (const g of filteredGroups)
      for (const p of g.paths || []) if (CANVAS_EXT_RE.test(p)) total++;
    return total;
  }, [filteredGroups]);

  return (
    <nav className={'st-sidebar' + (collapsed ? ' is-collapsed' : '')} aria-label="Files">
      <div className="st-sb-hd">
        <span className="st-sb-title">Files</span>
        <div className="st-sb-hd-actions">
          <button
            type="button"
            className="st-iconbtn"
            title="New blank brief board"
            aria-label="New blank brief board"
            aria-expanded={creating}
            onClick={() => {
              setNewErr('');
              setCreating((v) => !v);
            }}
          >
            <StIcon name="plus" size={15} />
          </button>
          <span className="st-live" title={wsConnected ? 'live · file index synced' : 'reconnecting…'}>
            <span className={'st-live-dot' + (wsConnected ? ' is-connected' : '')} aria-hidden="true" />
            {htmlShown} / {htmlCount}
          </span>
          {onCollapse && (
            <button
              type="button"
              className="st-iconbtn"
              aria-label="Collapse sidebar"
              title="Collapse sidebar (T)"
              onClick={onCollapse}
            >
              <StIcon name="panel-left" size={15} />
            </button>
          )}
        </div>
      </div>

      {creating ? (
        <div className="st-newboard">
          <input
            type="text"
            // biome-ignore lint/a11y/noAutofocus: deliberate — the composer opens on an explicit click.
            autoFocus
            placeholder="brief board name…"
            value={newName}
            maxLength={60}
            disabled={newBusy}
            aria-label="New brief board name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitNewBoard();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setCreating(false);
                setNewName('');
                setNewErr('');
              }
            }}
          />
          <button
            type="button"
            className="st-newboard-go"
            disabled={newBusy || !newName.trim()}
            title="Create (Enter)"
            aria-label="Create brief board"
            onClick={submitNewBoard}
          >
            {newBusy ? '…' : '↵'}
          </button>
        </div>
      ) : null}
      {newErr ? (
        <div className="st-newboard-err" role="alert">
          {newErr}
        </div>
      ) : null}

      <div className="st-search">
        <div className="st-search-box">
          <StIcon name="search" size={13} />
          <input
            type="search"
            placeholder="Search canvases…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Filter files"
          />
          {search ? (
            <button
              className="st-search-clear"
              onClick={() => setSearch('')}
              title="Clear (Esc)"
              aria-label="Clear search"
            >
              ×
            </button>
          ) : (
            <Kbd>/</Kbd>
          )}
        </div>
      </div>

      <div className="st-tree" role="tree" aria-label="Project file tree">
        {filteredGroups.map((g) => {
          // Hide gitignored runtime / orphan-only project sections by default.
          // Active search overrides — if the user typed a query, they want hits
          // wherever they live.
          if (!showHidden && !search && g.kind === 'runtime') return null;
          const meta = sectionMetaFor(g);
          // Counter pill counts canvases only — sidecars + orphans inflate the
          // raw `paths.length` and the FILES header already filters this way.
          const canvasCount = (g.paths || []).filter((p) => CANVAS_EXT_RE.test(p)).length;
          const pill =
            meta.pill ||
            (meta.pillFromDsCount ? String(g.dsFolders?.length || 0) : null) ||
            (meta.pillFromCount ? String(canvasCount || g.paths?.length || 0) : null);
          const hasItems = g.tree && Object.keys(g.tree).length > 0;
          const isDs = g.label === 'Design system';
          const isProject = g.kind === 'project';
          // Project section: when showHidden is off, every row inside is an
          // orphan (.md / .json / .css) → empty body. Skip the header in that
          // case so the sidebar doesn't show "PROJECT" with nothing under it.
          if (!showHidden && !search && isProject && canvasCount === 0) return null;
          const defaultOpen = sectionDefaultOpen(g);
          const explicit = sectionsExpanded[g.label];
          // Active search forces every section open so hits aren't hidden.
          const sectionOpen = !!search || (explicit === undefined ? defaultOpen : explicit);
          return (
            <div className="st-tree-section" key={g.label}>
              <button
                type="button"
                className="st-tree-sec-hd"
                onClick={() => onToggleSection(g.label, defaultOpen)}
                aria-expanded={sectionOpen}
                title={sectionOpen ? 'Collapse section' : 'Expand section'}
              >
                <StIcon name={sectionOpen ? 'chevron-down' : 'chevron-right'} size={13} />
                <span className="st-sec-name">{meta.title}</span>
                {pill && <span className="st-pill">{pill}</span>}
              </button>
              {sectionOpen &&
                (hasItems ? (
                  <Tree
                    node={g.tree}
                    activePath={activePath}
                    onOpen={onOpen}
                    commentsByFile={commentsByFile}
                    depth={1}
                    kind={g.kind}
                    showHidden={showHidden}
                    search={search}
                    dsFolders={g.dsFolders}
                    activeDsName={activeDsName}
                    onOpenSystem={isDs ? onOpenSystem : undefined}
                    onDelete={isDs ? undefined : onDeleteBoard}
                  />
                ) : (
                  <div className="st-tree-empty">{search ? 'No matches.' : 'Empty.'}</div>
                ))}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// Collapsed rail — a thin strip shown when the sidebar is collapsed, with a
// re-open affordance + quick search/files shortcuts (mockup CollapsedRail).
function CollapsedRail({ shown, onExpand, onSearch }) {
  return (
    <div className={'st-rail' + (shown ? ' is-shown' : '')}>
      <div className="st-rail-inner">
        <button type="button" className="st-iconbtn" aria-label="Expand sidebar" title="Expand sidebar (T)" onClick={onExpand}>
          <StIcon name="panel-left" size={15} />
        </button>
        <button type="button" className="st-iconbtn" aria-label="Search" title="Search (/)" onClick={onSearch}>
          <StIcon name="search" size={15} />
        </button>
        <button type="button" className="st-iconbtn" aria-label="Files" title="Files" onClick={onExpand}>
          <StIcon name="folder" size={15} />
        </button>
      </div>
    </div>
  );
}

// Help modal — hosts the cheatsheet that used to live in the left sidebar.
// Triggered from the menubar's Help item. Esc + backdrop click close it.
function HelpModal({ open, onClose, onStartTour }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="help-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        <header className="help-modal-hd">
          <span className="title" id="help-modal-title">
            Help · shortcuts &amp; commands
          </span>
          <span className="sku">MDCC-DEV-SRV / v{MDCC_VERSION}</span>
          {onStartTour && (
            <button
              type="button"
              className="mdcc-tour__back"
              style={{ marginLeft: 'auto' }}
              onClick={onStartTour}
            >
              ▶ Take the tour
            </button>
          )}
          <button
            type="button"
            className="help-modal-close"
            aria-label="Close (Esc)"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="help-modal-body">
          <details open>
            <summary>Canvas selection &amp; tools</summary>
            <ul>
              <li>
                <kbd>V</kbd> <span>move tool — Cmd+click to select, Cmd+Shift to multi</span>
              </li>
              <li>
                <kbd>H</kbd> <span>hand tool — bare drag pans (no Space needed)</span>
              </li>
              <li>
                <kbd>C</kbd> <span>comment tool — hover paints, click drops a pin</span>
              </li>
              <li>
                <kbd>⌘</kbd> + hover <span>preview deepest element under cursor</span>
              </li>
              <li>
                <kbd>⌘</kbd> + click <span>select that element (replace)</span>
              </li>
              <li>
                <kbd>⌘⇧</kbd> + click <span>add deepest to selection (multi)</span>
              </li>
              <li>
                right-click <span>context menu (Copy CSS / Fit / Reset...)</span>
              </li>
              <li>
                <kbd>Esc</kbd> in canvas <span>clear selection + close menu</span>
              </li>
            </ul>
          </details>
          <details>
            <summary>Annotation tools</summary>
            <ul>
              <li>
                <kbd>B</kbd> <span>pen — freehand stroke</span>
              </li>
              <li>
                <kbd>R</kbd> <span>rectangle — drag to define corners</span>
              </li>
              <li>
                <kbd>O</kbd> <span>ellipse — drag from center outward</span>
              </li>
              <li>
                <kbd>A</kbd> <span>arrow — drag tail → tip</span>
              </li>
              <li>
                <kbd>E</kbd> <span>eraser — click or drag over strokes to remove</span>
              </li>
              <li>
                <kbd>V</kbd> + click stroke <span>select annotation (Shift+click to multi)</span>
              </li>
              <li>
                <kbd>V</kbd> + drag empty <span>marquee-select strokes that overlap</span>
              </li>
              <li>
                double-click rect/ellipse <span>add text inside the shape</span>
              </li>
              <li>
                arrow keys <span>nudge selected annotation 1 unit (Shift = 10)</span>
              </li>
              <li>
                <kbd>Backspace</kbd> <span>delete selected annotations</span>
              </li>
              <li>
                <kbd>⇧P</kbd> <span>presentation — hide annotations for clean screenshot</span>
              </li>
            </ul>
          </details>
          <details>
            <summary>Tabs &amp; canvas</summary>
            <ul>
              <li>
                click in tree <span>open tab</span>
              </li>
              <li>
                <kbd>×</kbd> on tab <span>close tab</span>
              </li>
              <li>
                <kbd>⌘R</kbd> <span>reload iframe</span>
              </li>
              <li>
                <kbd>/</kbd> <span>focus search</span>
              </li>
              <li>
                <kbd>⌘⇧M</kbd> <span>toggle comments panel</span>
              </li>
            </ul>
          </details>
          <details>
            <summary>Slash commands</summary>
            <ul className="cmds">
              <li>
                <code>
                  /design:edit "<i>feedback</i>"
                </code>
                <span>edit + 4-iter multi-axis loop</span>
              </li>
              <li>
                <code>
                  /design:edit "<i>…</i>" --perfect
                </code>
                <span>8-iter polish (4.5/5 aspiration)</span>
              </li>
              <li>
                <code>
                  /design:edit "<i>…</i>" --no-critic
                </code>
                <span>raw edit, skip loop</span>
              </li>
              <li>
                <code>
                  /design:edit "<i>…</i>" --opt-out=<i>scope</i>
                </code>
                <span>override DS scope (palette/aesthetic/full)</span>
              </li>
              <li>
                <code>
                  /design:new "<i>Name</i>" "<i>brief</i>"
                </code>
                <span>scaffold canvas</span>
              </li>
              <li>
                <code>
                  /design:new "<i>…</i>" --opt-out=aesthetic
                </code>
                <span>scaffold off-system canvas (gradients/radii/type free)</span>
              </li>
              <li>
                <code>/design:critic</code>
                <span>review panel (routed)</span>
              </li>
              <li>
                <code>/design:critic --all</code>
                <span>10-critic sweep</span>
              </li>
              <li>
                <code>/design:critic --agent signature-moment-critic</code>
                <span>aspiration axis only</span>
              </li>
              <li>
                <code>/design:rollback</code>
                <span>undo last edit</span>
              </li>
              <li>
                <code>/design:screenshot</code>
                <span>capture canvas</span>
              </li>
              <li>
                <code>/design:setup-docs</code>
                <span>refresh README + INDEX</span>
              </li>
              <li>
                <code>/design:handoff</code>
                <span>migrate to apps/</span>
              </li>
            </ul>
          </details>
          <details>
            <summary>Opt-out scope</summary>
            <ul>
              <li>
                <strong>palette</strong>{' '}
                <span>
                  default — tokens + rootClass kept; local namespace overrides colors only. DS
                  aesthetic still enforced.
                </span>
              </li>
              <li>
                <strong>aesthetic</strong>{' '}
                <span>
                  palette + gradients/off-ladder radii/alt type/decorative SVG flags allowed.
                </span>
              </li>
              <li>
                <strong>full</strong>{' '}
                <span>DS treated as advisory. Type/radii/aesthetic up to canvas.</span>
              </li>
              <li>
                <em>A11y enforced at every scope</em>{' '}
                <span>contrast, focus, semantics, motion, touch targets — never relaxed.</span>
              </li>
              <li>
                Persisted on canvas's <code>.meta.json</code> <code>opt_out_scope</code> field —
                subsequent <code>/design:edit</code> iterations inherit.
              </li>
              <li>
                Inferred from brief ("modern", "vibrant", "off-system") with one-shot
                AskUserQuestion before iter-1 critics fire.
              </li>
            </ul>
          </details>
          <details>
            <summary>Auto-critic loop</summary>
            <ul>
              <li>
                <strong>Default</strong>{' '}
                <span>4 iter · aspiration ≥ 4.0 · stable-but-bland exit</span>
              </li>
              <li>
                <strong>--perfect</strong>{' '}
                <span>8 iter · aspiration ≥ 4.5 · broader divergence tolerance</span>
              </li>
              <li>
                <strong>--perfect --all</strong>{' '}
                <span>every critic incl. aspiration · portfolio-grade</span>
              </li>
              <li>
                Exit: <code>solid</code> · <code>stable-but-bland</code> · <code>max-reached</code>{' '}
                · <code>divergent</code>
              </li>
              <li>
                <em>stable-but-bland</em> = correctness clean, aspiration plateau — surface for
                review with lowest 2 axes named
              </li>
              <li>
                When <code>opt_out_scope ∈ &#123;aesthetic, full&#125;</code>: iter-1 checkpoint
                fires — pick (a) run loop, (b) skip auto-loop and review iter 1, (c) a11y-only
                check.
              </li>
            </ul>
          </details>
          <details>
            <summary>Pin-to-element flow</summary>
            <ol>
              <li>Open canvas tab</li>
              <li>
                <kbd>⌘</kbd>+click element
              </li>
              <li>Status bar shows ● selector</li>
              <li>
                Run{' '}
                <code>
                  /design:edit "<i>change just this</i>"
                </code>
              </li>
              <li>
                Reload iframe (<kbd>⌘R</kbd>)
              </li>
            </ol>
          </details>
          <details>
            <summary>Comments</summary>
            <ol>
              <li>
                <kbd>⌘</kbd>+click element, then <kbd>⌘C</kbd> <span>or ⌘⇧+click</span>
              </li>
              <li>Numbered pin appears on canvas</li>
              <li>
                <kbd>⌘⇧M</kbd> <span>opens panel — All / Open / Resolved</span>
              </li>
              <li>
                Click row in panel <span>jumps to that file + pin</span>
              </li>
              <li>
                Claude reads <code>_comments/&lt;slug&gt;.json</code> on next <code>/design</code>
              </li>
            </ol>
          </details>
        </div>
      </div>
    </div>
  );
}

// ───────── Menubar (CV-01/CV-08 top chrome) ─────────
//
// Replaces the legacy `.header` action-button toolbar. Mirrors the shared
// Menubar component from .design/ui/Canvas Viewport.html — brand · menus ·
// status. View dropdown is wired to the only toggleable panel today (the
// Comments sidebar); the rest is inert with a phase-tag explaining when it
// lands.

const MENU_NAMES = ['File', 'Edit', 'View', 'Selection', 'Tools', 'Help'];

// Shared close-on-Esc / outside-click effect for the menubar dropdowns.
function useDropdownClose(onClose) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onDocClick(e) {
      if (!e.target.closest('.st-dropdown, .st-menu')) onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDocClick);
    };
  }, [onClose]);
}

function ViewDropdown({ panels, onToggle, onClose }) {
  useDropdownClose(onClose);
  return (
    <div className="st-dropdown" role="menu" aria-label="View" style={{ left: 152 }}>
      <div className="st-dd-hd">Panels</div>
      {panels.map((p) => (
        <button
          key={p.id}
          type="button"
          role="menuitem"
          className={'st-dd-item' + (p.checked ? ' is-on' : '')}
          aria-disabled={p.disabled ? 'true' : undefined}
          onClick={() => {
            if (!p.disabled) {
              onToggle(p.id);
              onClose();
            }
          }}
        >
          <span className="st-dd-lead">
            <span className="st-dd-check">{p.checked ? <StIcon name="check" size={13} /> : null}</span>
            <span>{p.label}</span>
          </span>
          {p.phase ? <span className="st-dd-phase">{p.phase}</span> : <Kbd>{p.shortcut || ''}</Kbd>}
        </button>
      ))}
      <div className="st-dd-sep" />
      <div className="st-dd-hd">Zoom</div>
      {[
        { label: 'Zoom In', shortcut: '⌘ +' },
        { label: 'Zoom Out', shortcut: '⌘ −' },
        { label: 'Fit to Screen', shortcut: '⌘ 0' },
        { label: 'Actual Size · 100 %', shortcut: '⌥ ⌘ 0' },
      ].map((z) => (
        <button key={z.label} type="button" role="menuitem" className="st-dd-item" aria-disabled="true">
          <span className="st-dd-lead">
            <span className="st-dd-check" />
            <span>{z.label}</span>
          </span>
          <span className="st-dd-phase">Phase 4</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5.1 — Selection + Tools dropdowns (mirror ViewDropdown shape).

function SelectionDropdown({ onAction, onClose }) {
  useDropdownClose(onClose);
  const items = [
    { id: 'deselect-all', label: 'Deselect all', shortcut: 'Esc' },
    { id: 'select-all-annotations', label: 'Select all annotations', shortcut: '⌘ ⇧ A' },
  ];
  return (
    <div className="st-dropdown" role="menu" aria-label="Selection" style={{ left: 214 }}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className="st-dd-item"
          onClick={() => {
            onAction(it.id);
            onClose();
          }}
        >
          <span className="st-dd-lead">
            <span className="st-dd-check" />
            <span>{it.label}</span>
          </span>
          <Kbd>{it.shortcut}</Kbd>
        </button>
      ))}
    </div>
  );
}

function ToolsDropdown({ onAction, onClose }) {
  useDropdownClose(onClose);
  // Mirrors DEFAULT_TOOLS in apps/studio/use-tool-mode.tsx —
  // kept in sync by hand because the menubar lives in the dev-server shell
  // (no shared bundle with the canvas iframes).
  const tools = [
    { id: 'move', label: 'Move', shortcut: 'V' },
    { id: 'hand', label: 'Hand', shortcut: 'H' },
    { id: 'comment', label: 'Comment', shortcut: 'C' },
    { id: 'pen', label: 'Pen', shortcut: 'B' },
    { id: 'rect', label: 'Rect', shortcut: 'R' },
    { id: 'ellipse', label: 'Ellipse', shortcut: 'O' },
    { id: 'sticky', label: 'Sticky', shortcut: 'N' },
    { id: 'arrow', label: 'Arrow', shortcut: 'A' },
    { id: 'text', label: 'Text', shortcut: 'T' },
    { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  ];
  return (
    <div className="st-dropdown" role="menu" aria-label="Tools" style={{ left: 290 }}>
      <div className="st-dd-hd">Tool palette</div>
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          role="menuitem"
          className="st-dd-item"
          onClick={() => {
            onAction(t.id);
            onClose();
          }}
        >
          <span className="st-dd-lead">
            <span className="st-dd-check" />
            <span>{t.label}</span>
          </span>
          <Kbd>{t.shortcut}</Kbd>
        </button>
      ))}
    </div>
  );
}

// Plan C follow-up — File + Edit menus, previously inert. Both dispatch to real
// shell flows (File) or the in-canvas undo stack / selection bridges (Edit).
function FileDropdown({ onAction, onClose }) {
  useDropdownClose(onClose);
  const items = [
    { id: 'new', label: 'New canvas…', shortcut: '⌘N' },
    { id: 'export', label: 'Export…', shortcut: '⇧⌘E' },
    { id: 'handoff', label: 'Handoff to production', shortcut: '⇧⌘H' },
    { sep: true },
    { id: 'reload', label: 'Reload canvas', shortcut: '⌘R' },
  ];
  return (
    <div className="st-dropdown" role="menu" aria-label="File" style={{ left: 40 }}>
      {items.map((it, i) =>
        it.sep ? (
          <div key={'s' + i} className="st-dd-sep" />
        ) : (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            className="st-dd-item"
            onClick={() => {
              onAction(it.id);
              onClose();
            }}
          >
            <span className="st-dd-lead">
              <span className="st-dd-check" />
              <span>{it.label}</span>
            </span>
            <Kbd>{it.shortcut}</Kbd>
          </button>
        )
      )}
    </div>
  );
}

function EditDropdown({ onAction, onClose }) {
  useDropdownClose(onClose);
  const items = [
    { id: 'undo', label: 'Undo', shortcut: '⌘Z' },
    { id: 'redo', label: 'Redo', shortcut: '⇧⌘Z' },
    { sep: true },
    { id: 'deselect-all', label: 'Deselect all', shortcut: 'Esc' },
    { id: 'select-all-annotations', label: 'Select all annotations', shortcut: '⇧⌘A' },
  ];
  return (
    <div className="st-dropdown" role="menu" aria-label="Edit" style={{ left: 90 }}>
      {items.map((it, i) =>
        it.sep ? (
          <div key={'s' + i} className="st-dd-sep" />
        ) : (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            className="st-dd-item"
            onClick={() => {
              onAction(it.id);
              onClose();
            }}
          >
            <span className="st-dd-lead">
              <span className="st-dd-check" />
              <span>{it.label}</span>
            </span>
            <Kbd>{it.shortcut}</Kbd>
          </button>
        )
      )}
    </div>
  );
}

function Menubar({
  activePath,
  project,
  tabsCount,
  openMenu,
  setOpenMenu,
  commentsPanelOpen,
  onToggleComments,
  onOpenSystem,
  sidebarOpen,
  onToggleSidebar,
  showHidden,
  onToggleShowHidden,
  onOpenHelp,
  annotationsVisible,
  onToggleAnnotations,
  postToActiveCanvas,
  onOpenWhatsNew,
  whatsNewCount,
  artboardCount = 0,
  presence = null,
  inspectorOpen,
  onToggleInspector,
  onNewCanvas,
  onOpenExport,
  onReload,
}) {
  const isSystem = activePath === SYSTEM_TAB;
  const stamp = isSystem ? 'SYSTEM' : activePath ? 'CANVAS' : 'IDLE';
  const fileLabel = isSystem ? (
    <b>design system</b>
  ) : activePath ? (
    <>
      {activePath.split('/').slice(0, -1).join('/')}/<b>{displayName(basename(activePath))}</b>
    </>
  ) : (
    <span style={{ color: 'var(--u-fg-3)' }}>no canvas open</span>
  );

  const panels = [
    { id: 'tree', label: 'Project Tree', shortcut: 'T', checked: sidebarOpen, disabled: false },
    {
      id: 'comments',
      label: 'Comments Sidebar',
      shortcut: '⌘ ⇧ M',
      checked: commentsPanelOpen,
      disabled: false,
    },
    {
      id: 'hidden',
      label: 'Show hidden files',
      shortcut: 'H',
      checked: showHidden,
      disabled: false,
    },
    { id: 'layers', label: 'Layers Panel', phase: 'Phase 12', disabled: true },
    { id: 'inspector', label: 'Inspector', shortcut: 'I', checked: inspectorOpen, disabled: false },
    {
      id: 'annotate',
      label: 'Annotations',
      shortcut: '⇧ P',
      checked: annotationsVisible,
      disabled: false,
    },
    { id: 'present', label: 'Presentation Mode', phase: 'Phase 6', disabled: true },
  ];

  const DROPDOWN_MENUS = ['file', 'edit', 'view', 'selection', 'tools'];
  function onMenuClick(key) {
    if (DROPDOWN_MENUS.includes(key)) {
      setOpenMenu(openMenu === key ? null : key);
    } else if (key === 'help') {
      setOpenMenu(null);
      onOpenHelp();
    }
  }

  return (
    <header className="st-menubar" role="menubar" aria-label="Application menubar">
      <span className="st-brand">
        <span className="st-brand-mark">
          <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" aria-hidden="true"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="currentColor" /></svg>
        </span>
        <span className="st-brand-name">maude</span>
      </span>
      <nav className="st-menus" aria-label="Application menus">
        {MENU_NAMES.map((name) => {
          const key = name.toLowerCase();
          const hasDropdown = DROPDOWN_MENUS.includes(key);
          const interactive = hasDropdown || key === 'help';
          const open = openMenu === key;
          return (
            <button
              key={key}
              type="button"
              className="st-menu"
              role="menuitem"
              data-tour={key === 'help' ? 'help' : undefined}
              aria-haspopup={hasDropdown ? 'menu' : undefined}
              aria-expanded={hasDropdown ? open : undefined}
              onClick={() => onMenuClick(key)}
              // F4 — once any menu is open, hovering another trigger switches to
              // it (base-ui menubar behavior). Only among dropdown menus.
              onMouseEnter={() => {
                if (openMenu !== null && hasDropdown) setOpenMenu(key);
              }}
            >
              {name}
            </button>
          );
        })}
      </nav>
      {openMenu === 'file' && (
        <FileDropdown
          onAction={(id) => {
            if (id === 'new') onNewCanvas?.();
            else if (id === 'export') onOpenExport?.('export');
            else if (id === 'handoff') onOpenExport?.('handoff');
            else if (id === 'reload') onReload?.();
          }}
          onClose={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'edit' && (
        <EditDropdown
          onAction={(id) => {
            if (id === 'undo') postToActiveCanvas({ dgn: 'undo' });
            else if (id === 'redo') postToActiveCanvas({ dgn: 'redo' });
            else if (id === 'deselect-all') postToActiveCanvas({ dgn: 'selection-clear' });
            else if (id === 'select-all-annotations')
              postToActiveCanvas({ dgn: 'annotation-select-all' });
          }}
          onClose={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'view' && (
        <ViewDropdown
          panels={panels}
          onToggle={(id) => {
            if (id === 'tree') onToggleSidebar();
            else if (id === 'comments') onToggleComments();
            else if (id === 'hidden') onToggleShowHidden();
            else if (id === 'annotate') onToggleAnnotations();
            else if (id === 'inspector') onToggleInspector();
          }}
          onClose={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'selection' && (
        <SelectionDropdown
          onAction={(id) => {
            if (id === 'deselect-all') postToActiveCanvas({ dgn: 'selection-clear' });
            else if (id === 'select-all-annotations')
              postToActiveCanvas({ dgn: 'annotation-select-all' });
          }}
          onClose={() => setOpenMenu(null)}
        />
      )}
      {openMenu === 'tools' && (
        <ToolsDropdown
          onAction={(tool) => postToActiveCanvas({ dgn: 'tool-set', tool })}
          onClose={() => setOpenMenu(null)}
        />
      )}
      <div className="st-mb-right">
        {presence ? <div className="st-presence">{presence}</div> : null}
        <button
          type="button"
          className="st-whatsnew"
          data-unseen={whatsNewCount > 0 ? 'true' : 'false'}
          aria-label={`What's new${whatsNewCount > 0 ? ` — ${whatsNewCount} unseen` : ''}`}
          title="What's new"
          onClick={onOpenWhatsNew}
        >
          <StIcon name="sparkle" size={15} />
        </button>
        <span className="st-stamp">{stamp}</span>
        <span className="st-mb-file" title={activePath || ''}>
          {fileLabel}
        </span>
        <span className="st-mb-sep" />
        <span className="st-mb-count" title="Artboards in the open canvas">
          <span className="st-dot" style={{ background: 'var(--accent)' }} />
          {artboardCount} ARTBOARDS
        </span>
        <span className="st-mb-sep" />
        <span className="st-mb-proj">{project || 'maude'}</span>
      </div>
    </header>
  );
}

function Viewport({
  tabs,
  activePath,
  registerIframe,
  systemData,
  onOpenFromSystem,
  onSelectDs,
  project,
  cfg,
}) {
  return (
    <div className="viewport st-stage">
      {tabs.length === 0 && (
        <div className="st-empty">
          <div className="st-empty-brand">
            <span className="st-brand-mark">
              <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" aria-hidden="true"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="currentColor" /></svg>
            </span>
            <span className="st-empty-wm">maude</span>
            <span className="st-empty-sub st-mono">
              CANVAS · {(project || 'MAUDE').toUpperCase()} / v{MDCC_VERSION} /
              localhost:{typeof window !== 'undefined' ? window.location.port : '4399'}
            </span>
          </div>
          <div className="st-empty-title">No canvas open</div>
          <div className="st-empty-body">
            ← Click a <code>.tsx</code> (or legacy <code>.html</code>) file in the tree, or open the{' '}
            <strong>Design system</strong> view above it.
            <br />
            <br />
            Tabs work like in an editor — close with the × on each tab. <Kbd>⌘R</Kbd> reloads the
            active iframe.
            <br />
            <br />
            <strong>Element selection:</strong> hold <Kbd>⌘</Kbd> inside the canvas and hover for a
            preview, click to select. <Kbd>⌘⇧</Kbd>+click adds to a multi-selection. <Kbd>V</Kbd>
            /<Kbd>H</Kbd>/<Kbd>C</Kbd> swap tool; right-click opens the context menu.
            <br />
            <br />
            Active file, selection, and comments are tracked in <code>_active.json</code> +{' '}
            <code>_comments/</code> — Claude reads them when you run <code>/design</code>.
          </div>
        </div>
      )}
      {tabs.map((t) => {
        if (t.path === SYSTEM_TAB) {
          return (
            <div key={t.path} className={'system-view' + (t.path === activePath ? ' active' : '')}>
              <SystemView
                data={systemData}
                onOpen={onOpenFromSystem}
                cfg={cfg}
                onSelectDs={onSelectDs}
              />
            </div>
          );
        }
        return (
          <iframe
            key={t.path}
            ref={(el) => registerIframe(t.path, el)}
            src={canvasUrl(t.path, cfg)}
            className={t.path === activePath ? 'active' : ''}
            data-path={t.path}
            // T2 (9.1-A) — only sandbox + delegate clipboard when the canvas is
            // served cross-origin (canvasOrigin present = the split is on). In
            // the default same-origin mode these attrs are omitted so behavior
            // is identical to pre-9.1. allow-same-origin gives the cross-origin
            // frame its OWN origin (own WS/fetch/storage), NOT the parent's.
            {...(cfg?.canvasOrigin
              ? { sandbox: 'allow-scripts allow-same-origin', allow: 'clipboard-write' }
              : {})}
          />
        );
      })}
    </div>
  );
}

// ---------- SystemView ----------
//
// DDR-048 — the System view renders the USER's design-system tokens. It does
// NOT read from `document.documentElement` (that would surface the dev-server
// shell's amber-rust chrome theme from styles/1-tokens.css, which is NOT a
// user template) and it does NOT assume any canonical token-name contract.
// Whatever the user's `colors_and_type.css` declared — names, values, theme
// blocks — is what shows up here.

// Order kinds match the typical reading flow of a tokens file. Unknown kinds
// fall through to `other` so a custom token group still renders, just last.
const TOKEN_GROUP_ORDER = [
  'color',
  'space',
  'radius',
  'shadow',
  'leading',
  'weight',
  'motion',
  'font',
  'other',
];
const TOKEN_GROUP_LABELS = {
  color: 'colors',
  space: 'spacing',
  radius: 'radii',
  shadow: 'shadows',
  leading: 'leading',
  weight: 'weights',
  motion: 'motion',
  font: 'font stacks',
  other: 'other',
};

function isSwatchKind(kind) {
  return kind === 'color';
}

function TokenLadder({ tokens, tokenGroups, tokensPath }) {
  if (!tokens || tokens.length === 0) {
    return (
      <section className="sv-section sv-section-tokens">
        <h2>
          tokens<span className="sv-h-num">0</span>
        </h2>
        <div className="sv-empty">
          <p>
            No tokens parsed from{' '}
            {tokensPath ? <code>{tokensPath}</code> : 'the configured tokens file'}. Does the file
            exist and contain CSS custom properties (<code>--name: value;</code>)?
          </p>
        </div>
      </section>
    );
  }

  const groups = tokenGroups || {};
  const kinds = Array.from(new Set([...TOKEN_GROUP_ORDER, ...Object.keys(groups)])).filter(
    (k) => groups[k]?.length
  );

  return (
    <>
      {kinds.map((kind) => {
        const list = groups[kind];
        const swatch = isSwatchKind(kind);
        return (
          <section className={'sv-section sv-section-tokens sv-section-' + kind} key={kind}>
            <h2>
              tokens · {TOKEN_GROUP_LABELS[kind] || kind}
              <span className="sv-h-num">{list.length}</span>
            </h2>
            <div className="sv-tokens-ladder">
              {list.map((t) => (
                <div className="sv-tok-cell" key={t.name + '|' + t.value}>
                  {swatch ? (
                    <div className="sv-tok-swatch" style={{ background: t.value }} />
                  ) : null}
                  <div className="sv-tok-meta">
                    <code className="sv-tok-name">{t.name}</code>
                    <span className="sv-tok-value">{t.value || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

// Find a leading partner by name suffix: --fs-base → --lh-base, --type-xl → --lh-xl.
// Returns null when no convention match exists; caller omits the lineHeight style.
function findLeadingFor(typeToken, leadingTokens) {
  const m = typeToken.name.match(/^--(?:type|fs|text)-(.+)$/);
  if (!m) return null;
  const suffix = m[1];
  return (
    (leadingTokens || []).find(
      (t) => /^--(?:lh|leading|line-height)-/.test(t.name) && t.name.endsWith('-' + suffix)
    )?.value ?? null
  );
}

// Best-effort sample font: prefer body / sans / display tokens, fall back to
// the first font-kind token, fall back to system-ui. Avoids the shell's
// Berkeley Mono leaking into user-facing previews.
function sampleFontFamily(fontTokens) {
  if (!fontTokens?.length) return undefined;
  const prefer = ['body', 'sans', 'display', 'text', 'family'];
  for (const tag of prefer) {
    const hit = fontTokens.find((t) => t.name.includes(tag));
    if (hit) return hit.value;
  }
  return fontTokens[0].value;
}

function TypeLadder({ tokenGroups }) {
  const typeTokens = tokenGroups?.fontsize || [];
  if (typeTokens.length === 0) return null;
  const leadingTokens = tokenGroups?.leading || [];
  const sampleFont = sampleFontFamily(tokenGroups?.font);

  return (
    <section className="sv-section sv-section-type">
      <h2>
        type · ladder<span className="sv-h-num">{typeTokens.length}</span>
      </h2>
      <div className="sv-type-list">
        {typeTokens.map((t) => {
          const lh = findLeadingFor(t, leadingTokens);
          const style = { fontSize: t.value };
          if (lh) style.lineHeight = lh;
          if (sampleFont) style.fontFamily = sampleFont;
          return (
            <div className="sv-type-row" key={t.name}>
              <code className="sv-type-tok">{t.name}</code>
              <span className="sv-type-sample" style={style}>
                The catalog is the system.
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SystemView({ data, onOpen, cfg, onSelectDs }) {
  if (!data) {
    return (
      <div className="sv-empty">
        <p>Loading design system…</p>
      </div>
    );
  }
  const {
    previewGallery,
    uiKitsGallery,
    systemDir,
    tokens,
    tokenGroups,
    tokensPath,
    ds,
    availableDesignSystems,
  } = data;
  const empty =
    (!previewGallery || !previewGallery.length) && (!uiKitsGallery || !uiKitsGallery.length);
  const hasPicker = Array.isArray(availableDesignSystems) && availableDesignSystems.length > 1;
  const selectedName = ds?.name ?? availableDesignSystems?.[0]?.name ?? '';

  return (
    <div className="sv">
      <header className="sv-header">
        <span className="sv-sku">MDCC-DSN/01</span>
        <span className="sv-title">design system view</span>
        {hasPicker ? (
          <label className="sv-ds-picker">
            <span className="sv-ds-picker-label">DS</span>
            <select value={selectedName} onChange={(e) => onSelectDs && onSelectDs(e.target.value)}>
              {availableDesignSystems.map((d) => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <span className="sv-loc">
          <code>{systemDir}</code>
        </span>
      </header>

      {ds?.description ? <p className="sv-ds-description">{ds.description}</p> : null}

      <TokenLadder tokens={tokens} tokenGroups={tokenGroups} tokensPath={tokensPath} />
      <TypeLadder tokenGroups={tokenGroups} />

      {empty ? (
        <div className="sv-empty">
          <p>
            No <code>preview/</code> or <code>ui_kits/</code> folders found under{' '}
            <code>{systemDir}</code>.
          </p>
        </div>
      ) : (
        <>
          <Gallery
            title="preview"
            items={previewGallery}
            onOpen={onOpen}
            kind="preview"
            cfg={cfg}
          />
          <Gallery title="ui kits" items={uiKitsGallery} onOpen={onOpen} kind="ui_kits" cfg={cfg} />
        </>
      )}
    </div>
  );
}

function Gallery({ title, items, onOpen, kind, cfg }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="sv-section">
      <h2>
        {title} <span className="sv-count">{items.length}</span>
      </h2>
      <div className={'sv-previews sv-previews-' + kind}>
        {items.map((p) => (
          <article key={p.path} className="sv-preview-card" onClick={() => onOpen(p.path)}>
            <div className="sv-preview-frame">
              <iframe
                src={canvasUrl(p.path, cfg, { thumbnail: true })}
                title={p.label}
                scrolling="no"
                {...(cfg?.canvasOrigin ? { sandbox: 'allow-scripts allow-same-origin' } : {})}
              />
            </div>
            <div className="sv-preview-foot">
              <strong>{p.label}</strong>
              <code>{p.path}</code>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------- Comment composer / viewer ----------

function StatusBar({
  activePath,
  selected,
  wsConnected,
  openCount,
  theme,
  onToggleTheme,
  onClearSelected,
  syncStatus,
}) {
  const isSystem = activePath === SYSTEM_TAB;
  const text =
    selected && selected.selector
      ? selected.selector + (selected.text ? ` — "${selected.text.slice(0, 60)}"` : '')
      : '';
  const title =
    selected && selected.dom_path
      ? selected.dom_path.join(' > ')
      : selected
        ? selected.selector
        : '';
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  // P5 (Plan C) — always-on hub-sync slot. `/_sync-status` returns one of three
  // shapes: solo `{linked:false}` (hide), DDR-060 `{notSyncable,tsxCount,reason}`
  // (linked but 0 syncable), or the connection-state machine `{state,queuedOps,
  // flash,…}` (the common linked case the old notSyncable-only guard never
  // showed — the "hub sync se neukazuje" bug). Map each to a label + dot tone.
  const syncSlot = (() => {
    if (!syncStatus || syncStatus.linked === false) return null;
    if (syncStatus.notSyncable) {
      return {
        online: false,
        label: `0 syncable${syncStatus.tsxCount > 0 ? ` · ${syncStatus.tsxCount} tsx` : ''}`,
        title: syncStatus.reason || 'Linked to a hub, but no canvases are syncable.',
      };
    }
    const q = syncStatus.queuedOps ?? 0;
    const synced = syncStatus.state === 'online' || syncStatus.flash === 'synced';
    if (synced) {
      return {
        online: true,
        label: q > 0 ? `${q} ↑` : 'synced',
        title: q > 0 ? `${q} edit(s) queued to push` : 'All changes synced to the hub',
      };
    }
    return {
      online: false,
      label: `${q} ↑`,
      title:
        syncStatus.state === 'connecting'
          ? 'Connecting to the hub…'
          : 'Offline — edits queued, will sync when the hub reconnects',
    };
  })();

  return (
    <footer className="st-statusbar" role="contentinfo">
      <span className="st-sb-slot st-sb-active" role="group" aria-label="Active file">
        <span className="lead" aria-hidden="true" />
        <span className="lbl">active</span>
        <span className="val" title={activePath || ''}>
          {isSystem ? '▦ design system' : activePath || '—'}
        </span>
      </span>

      {selected && selected.selector && !isSystem && (
        <span className="st-sb-slot st-sb-sel" role="group" aria-label="Selected element">
          <span className="lbl">selected</span>
          <span className="val" title={title}>
            {text}
          </span>
          <button
            type="button"
            className="st-sb-sel-clear"
            onClick={onClearSelected}
            title="Clear (Esc inside iframe)"
            aria-label="Clear selection"
          >
            ×
          </button>
        </span>
      )}

      <span className="st-sb-slot" role="group" aria-label="Open comments">
        <span className="lbl">comments</span>
        <span className="val">{openCount} open</span>
      </span>

      <span className="st-sb-spacer" />

      <span className="st-sb-slot" role="group" aria-label="Connection">
        <span className={'st-live-dot' + (wsConnected ? ' is-connected' : '')} aria-hidden="true" />
        <span className="lbl">{wsConnected ? 'live' : 'reconnecting'}</span>
      </span>

      {/* P5 (Plan C) — always-on hub-sync slot (was notSyncable-only per DDR-060
          / 9.1-D). Now also surfaces the connection-state machine's queued/synced
          counter for the common linked case. Solo projects render nothing. */}
      {syncSlot && (
        <span className="st-sb-slot st-sb-sync" role="group" aria-label="Hub sync">
          <span
            className={'st-sb-sync-dot' + (syncSlot.online ? ' is-online' : '')}
            aria-hidden="true"
          />
          <span className="lbl">hub sync</span>
          <span className="val" title={syncSlot.title}>
            {syncSlot.label}
          </span>
        </span>
      )}

      <button
        type="button"
        className="st-sb-theme"
        onClick={onToggleTheme}
        title={`Switch to ${nextTheme} theme`}
        aria-label={`Switch to ${nextTheme} theme`}
      >
        <StIcon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
        {nextTheme}
      </button>
    </footer>
  );
}

// ---------- Right sidebar — Comments panel ----------

function CommentsPanel({
  commentsByFile,
  filter,
  setFilter,
  activePath,
  focusedId,
  onJump,
  onResolve,
  onReopen,
  onDelete,
}) {
  const counts = totalCounts(commentsByFile);
  // Build groups: [{ file, comments: filtered }]
  const files = Object.keys(commentsByFile || {}).sort();
  const groups = [];
  for (const f of files) {
    const all = commentsByFile[f] || [];
    const filtered = all.filter((c) => {
      if (filter === 'open') return c.status !== 'resolved';
      if (filter === 'resolved') return c.status === 'resolved';
      return true;
    });
    if (filtered.length === 0) continue;
    // Number is fixed by all-list order so it matches pin numbers (which are based on position in the array of selector-having comments)
    const numberedAll = all.filter((c) => c.selector);
    groups.push({
      file: f,
      comments: filtered.map((c) => ({
        ...c,
        n: numberedAll.findIndex((x) => x.id === c.id) + 1,
      })),
    });
  }

  return (
    <aside className="st-rpanel" aria-label="Comments">
      <div className="st-rp-tabs st-rp-tabs--filters">
        <div className="st-cm-filters" role="tablist">
          <button
            type="button"
            className={'st-cm-filter' + (filter === 'all' ? ' is-active' : '')}
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All · {counts.all}
          </button>
          <button
            type="button"
            className={'st-cm-filter' + (filter === 'open' ? ' is-active' : '')}
            role="tab"
            aria-selected={filter === 'open'}
            onClick={() => setFilter('open')}
          >
            Open · {counts.open}
          </button>
          <button
            type="button"
            className={'st-cm-filter' + (filter === 'resolved' ? ' is-active' : '')}
            role="tab"
            aria-selected={filter === 'resolved'}
            onClick={() => setFilter('resolved')}
          >
            Resolved · {counts.resolved}
          </button>
        </div>
      </div>
      <div className="st-rp-body" style={{ gap: 'var(--space-4)' }}>
        {groups.length === 0 ? (
          <div className="st-rp-empty">
            <p>No comments {filter !== 'all' ? `with status “${filter}”` : 'yet'}.</p>
            <p>
              Open a canvas, hold <Kbd>⌘</Kbd> and click an element, then press <Kbd>C</Kbd> — or
              hold <Kbd>⌘⇧</Kbd> and click directly.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <Fragment key={g.file}>
              <button
                type="button"
                className="st-cm-group-hd"
                onClick={() => onJump(g.file, null)}
                title={g.file}
              >
                <span>{displayName(basename(g.file))}</span>
                <span className="st-mono">{g.comments.length}</span>
              </button>
              {g.comments.map((c) => (
                <div
                  key={c.id}
                  className={
                    'st-comment' +
                    (c.status === 'resolved' ? ' is-resolved' : '') +
                    (c.id === focusedId ? ' is-active' : '')
                  }
                  onClick={() => onJump(g.file, c.id)}
                >
                  <div className="st-comment-hd">
                    <span className="st-pin st-pin--inline">{c.n || '·'}</span>
                    <span className="st-comment-time">{timeAgo(c.created)}</span>
                  </div>
                  <div className="st-comment-txt">{c.text}</div>
                  <div className="st-comment-foot">
                    <span className="st-comment-sel" title={(c.dom_path || []).join(' > ')}>
                      {c.selector || '—'}
                    </span>
                    <span className="st-mini-act">
                      {c.status === 'resolved' ? (
                        <button
                          type="button"
                          className="st-iconbtn"
                          aria-label="Reopen"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReopen(c.id);
                          }}
                        >
                          <StIcon name="reopen" size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="st-iconbtn"
                          aria-label="Resolve"
                          onClick={(e) => {
                            e.stopPropagation();
                            onResolve(c.id);
                          }}
                        >
                          <StIcon name="resolve" size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="st-iconbtn"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                      >
                        <StIcon name="x" size={14} />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </Fragment>
          ))
        )}
      </div>
    </aside>
  );
}

// ---------- Sync banner (Phase 9 Task 8 — hub-down offline mode) ----------

// Renders nothing when online with no flash (the common case). Yellow strip
// while offline (with queued-edit count), red when offline > 24h, green flash
// for 3s right after a reconnect. Driven entirely by the 'sync:status' payload
// the dev-server's linked-mode sync runtime broadcasts.
function SyncBanner({ status }) {
  // Plan C follow-up — the banner overlapped the menubar and wasn't dismissable.
  // Dismissal is keyed on the connection state, so a transition (reconnect flash,
  // escalation to offline-long) re-surfaces it; a stable state stays hidden.
  const [dismissedKey, setDismissedKey] = useState(null);
  if (!status || status.linked === false) return null;
  // DDR-060 / 9.1-D — the "linked but 0 syncable" state is surfaced in the
  // status bar (sb-sync slot), NOT as a floating banner. This component owns
  // only the transient offline / reconnect-flash banner (Task 8).
  if (status.notSyncable) return null;
  const { state, queuedOps, flash, conflicts } = status;
  const showFlash = flash === 'synced';
  const offline = state === 'offline' || state === 'offline-long';
  if (!offline && !showFlash) return null;
  const dismissKey = `${state}:${showFlash ? 'flash' : 'offline'}`;
  if (dismissedKey === dismissKey) return null;

  let variant;
  let text;
  if (showFlash) {
    variant = 'success';
    text = 'Synced with hub';
  } else if (state === 'offline-long') {
    variant = 'error';
    text = `Long offline — ${queuedOps} edit(s) queued. Consider \`git commit && git push\` as backup.`;
  } else {
    variant = 'warn';
    text = `Working offline · ${queuedOps} edit(s) queued · will sync when the hub reconnects.`;
  }
  const conflictNote =
    conflicts && conflicts.length > 0 ? ` (${conflicts.length} conflict notice(s))` : '';

  return (
    <div role="status" aria-live="polite" className={`st-banner st-banner--${variant}`}>
      <span className="st-banner-dot" aria-hidden="true" />
      <span>
        {text}
        {conflictNote}
      </span>
      <button
        type="button"
        className="st-banner-close"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={() => setDismissedKey(dismissKey)}
      >
        ×
      </button>
    </div>
  );
}

// ---------- CSS knobs (Phase 12.2, DDR-101) ----------
//
// Webflow-style grouped editor for the selected element's INLINE style. Each
// knob pre-fills from the AUTHORED inline value (`el.authored` — what the source
// `style={{}}` sets; blank when unset), with the resolved `computed` value shown
// only as a faint placeholder hint (NOT the editable value — that was the v1 UX
// bug). Commit (blur / Enter) POSTs to the main-origin-only `/_api/edit-css`,
// which merges one key into the inline `style={{}}` in the source `.tsx` (via
// editAttribute); the file-watcher HMR then reloads the canvas. Token values
// (e.g. `var(--accent)`) keep edits on-system.
const CSS_KNOB_GROUPS = [
  { label: 'Layout', props: [['display', 'Display'], ['gap', 'Gap']] },
  { label: 'Spacing', props: [['padding', 'Padding'], ['margin', 'Margin']] },
  { label: 'Size', props: [['width', 'Width'], ['height', 'Height'], ['max-width', 'Max W']] },
  {
    label: 'Typography',
    props: [
      ['font-size', 'Size'],
      ['font-weight', 'Weight'],
      ['line-height', 'Leading'],
      ['letter-spacing', 'Tracking'],
      ['text-align', 'Align'],
      ['color', 'Color'],
    ],
  },
  {
    label: 'Appearance',
    props: [
      ['background-color', 'Fill'],
      ['border-radius', 'Radius'],
      ['opacity', 'Opacity'],
    ],
  },
];
const CSS_COLOR_PROPS = new Set(['color', 'background-color']);

let _cssColorCtx = null;
// Normalize any CSS color string to #rrggbb for the native color input via a
// throwaway canvas fillStyle round-trip (parses rgb/hsl/named). Unparseable
// values (some oklch) fall back to '' → picker defaults to #000000; the swatch
// still shows the true color string regardless.
function cssColorToHex(c) {
  if (!c) return '';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  try {
    if (!_cssColorCtx) _cssColorCtx = document.createElement('canvas').getContext('2d');
    if (!_cssColorCtx) return '';
    _cssColorCtx.fillStyle = '#000000';
    _cssColorCtx.fillStyle = c;
    const v = _cssColorCtx.fillStyle;
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
    }
  } catch {
    /* canvas unavailable */
  }
  return '';
}

// Round bare px to whole numbers for the placeholder hint; pass other values through.
function cssHint(v) {
  if (!v) return '';
  const m = /^(-?\d*\.?\d+)px$/.exec(v);
  return m ? `${Math.round(Number.parseFloat(m[1]))}px` : v;
}

function CssKnobs({ el }) {
  const editable = !!el.id;
  const [status, setStatus] = useState(null);
  const authored = el.authored || {};
  const computed = el.computed || {};

  async function commit(property, rawValue) {
    const value = (rawValue || '').trim();
    if (!editable || !value) return;
    if (value === (authored[property] ?? '').trim()) return; // no-op
    setStatus({ property, kind: 'saving' });
    try {
      const res = await fetch('/_api/edit-css', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ canvas: el.file, id: el.id, property, value }),
      });
      const j = await res.json().catch(() => ({}));
      setStatus(
        !res.ok || !j.ok
          ? { property, kind: 'error', msg: (j && j.error) || `HTTP ${res.status}` }
          : { property, kind: 'saved' }
      );
    } catch (err) {
      setStatus({ property, kind: 'error', msg: err && err.message ? err.message : String(err) });
    }
  }

  if (!editable) {
    return (
      <div className="st-css-panel">
        <div className="st-rp-hd">CSS</div>
        <div className="st-css-disabled">
          This selection has no stable element id (a legacy canvas, or a non-element target). Edit
          it with <code>/design:edit</code>.
        </div>
      </div>
    );
  }

  const textRow = (cssProp, label) => (
    <div className="st-css-row" key={cssProp}>
      <label className="st-css-label" htmlFor={`css-${cssProp}`}>
        {label}
      </label>
      <div className="st-css-control">
        <input
          id={`css-${cssProp}`}
          className="st-css-input"
          aria-label={cssProp}
          defaultValue={authored[cssProp] ?? ''}
          placeholder={cssHint(computed[cssProp]) || '—'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={(e) => commit(cssProp, e.currentTarget.value)}
        />
      </div>
    </div>
  );

  const colorRow = (cssProp, label) => {
    const shown = authored[cssProp] || computed[cssProp] || '';
    return (
      <div className="st-css-row" key={cssProp}>
        <label className="st-css-label" htmlFor={`css-${cssProp}`}>
          {label}
        </label>
        <div className="st-css-control">
          <span className="st-css-swatch" title={shown || 'no color set'}>
            <span style={{ background: shown || 'transparent' }} />
            <input
              type="color"
              aria-label={`${cssProp} swatch`}
              defaultValue={cssColorToHex(shown) || '#000000'}
              onBlur={(e) => commit(cssProp, e.currentTarget.value)}
            />
          </span>
          <input
            id={`css-${cssProp}`}
            className="st-css-input"
            aria-label={cssProp}
            defaultValue={authored[cssProp] ?? ''}
            placeholder={cssHint(computed[cssProp]) || '—'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={(e) => commit(cssProp, e.currentTarget.value)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="st-css-panel" key={el.id}>
      <div className="st-css-title">
        {el.tag || 'element'}
        {el.classes ? `.${el.classes.split(/\s+/)[0]}` : ''}
      </div>
      {CSS_KNOB_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="st-css-group">{g.label}</div>
          {g.props.map(([cssProp, label]) =>
            CSS_COLOR_PROPS.has(cssProp) ? colorRow(cssProp, label) : textRow(cssProp, label)
          )}
        </div>
      ))}
      <div className="st-css-group">Custom</div>
      <RawKnob commit={commit} />
      <div className={`st-css-status${status ? ` is-${status.kind}` : ''}`}>
        {status?.kind === 'error'
          ? `${status.property}: ${status.msg}`
          : status?.kind === 'saved'
            ? '✓ written to source'
            : ''}
      </div>
      <div className="st-css-help">
        Edits the element's inline <code>style</code> in the source <code>.tsx</code> on blur or
        Enter. Use a token like <code>var(--accent)</code> to stay on-system.
      </div>
    </div>
  );
}

function RawKnob({ commit }) {
  const [prop, setProp] = useState('');
  const [val, setVal] = useState('');
  const submit = () => {
    if (prop.trim() && val.trim()) {
      commit(prop.trim(), val);
      setProp('');
      setVal('');
    }
  };
  return (
    <div className="st-css-row">
      <input
        className="st-css-input"
        aria-label="custom property"
        placeholder="property"
        value={prop}
        onChange={(e) => setProp(e.target.value)}
      />
      <input
        className="st-css-input"
        aria-label="custom value"
        placeholder="value"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
    </div>
  );
}

// ---------- Inspector panel (display-only) ----------
//
// T6 (Plan C) — right-dock Inspect / Layers / CSS tabs per `.design/ui/Studio.tsx`
// InspectorPanel. DISPLAY-ONLY: reads the live `selected` payload from the
// inspector bridge (`bounds`, `tag`, `classes`, `dom_path`, `html`). The
// mockup's live-CSS-knob WRITEBACK is Phase 12 (needs a canvas-origin write
// bridge, DDR-054) — the CSS tab shows markup read-only + keeps that callout, so
// it never implies functionality it lacks (the exact reason DDR-096 deferred it).
function InspectorPanel({ selected, onClose }) {
  const [tab, setTab] = useState('inspect');
  // `selected` may be a single element, an array (multi-select), or null.
  const el = Array.isArray(selected) ? selected[0] : selected;
  const tabBtn = (id, label, icon) => (
    <button
      type="button"
      className={'st-rp-tab' + (tab === id ? ' is-active' : '')}
      onClick={() => setTab(id)}
    >
      <StIcon name={icon} size={14} />
      {label}
    </button>
  );
  const b = el?.bounds || null;
  return (
    <aside className="st-rpanel" aria-label="Inspector">
      <div className="st-rp-tabs">
        {tabBtn('inspect', 'Inspect', 'sliders')}
        {tabBtn('layers', 'Layers', 'layers')}
        {tabBtn('css', 'CSS', 'code')}
        <button
          type="button"
          className="st-iconbtn"
          aria-label="Close inspector"
          style={{ marginLeft: 'auto' }}
          onClick={onClose}
        >
          <StIcon name="x" size={14} />
        </button>
      </div>
      <div className="st-rp-body">
        {!el ? (
          <div className="st-rp-empty">
            Hold <Kbd>⌘</Kbd> inside the canvas and click an element to inspect it.
          </div>
        ) : tab === 'inspect' ? (
          <>
            <div className="st-rp-hd">{el.selector || el.tag || 'element'}</div>
            <div className="st-insp-row">
              <span className="st-insp-label">Pos</span>
              <div className="st-insp-fields">
                <span className="st-field-lead">
                  <span className="k">X</span>
                  <input className="st-field" value={b ? Math.round(b.x) : '—'} readOnly />
                </span>
                <span className="st-field-lead">
                  <span className="k">Y</span>
                  <input className="st-field" value={b ? Math.round(b.y) : '—'} readOnly />
                </span>
              </div>
            </div>
            <div className="st-insp-row">
              <span className="st-insp-label">Size</span>
              <div className="st-insp-fields">
                <span className="st-field-lead">
                  <span className="k">W</span>
                  <input className="st-field" value={b ? Math.round(b.w) : '—'} readOnly />
                </span>
                <span className="st-field-lead">
                  <span className="k">H</span>
                  <input className="st-field" value={b ? Math.round(b.h) : '—'} readOnly />
                </span>
              </div>
            </div>
            <div className="st-insp-row">
              <span className="st-insp-label">Tag</span>
              <div className="st-insp-fields">
                <span className="st-mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>
                  {el.tag || '—'}
                </span>
              </div>
            </div>
            {el.classes ? (
              <div className="st-insp-row">
                <span className="st-insp-label">Class</span>
                <div className="st-insp-fields">
                  <span className="st-mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>
                    {el.classes}
                  </span>
                </div>
              </div>
            ) : null}
            <div className="callout callout--info" style={{ fontSize: 12 }}>
              Computed fill / radius / type readout lands with the live CSS bridge (Phase 12).
            </div>
          </>
        ) : tab === 'layers' ? (
          <>
            <div className="st-rp-hd">Layers · ancestry</div>
            {Array.isArray(el.dom_path) && el.dom_path.length ? (
              el.dom_path.map((node, i) => (
                <div
                  key={i}
                  className={'st-layer' + (i === el.dom_path.length - 1 ? ' is-sel' : '')}
                  style={{ paddingLeft: 8 + i * 12 }}
                >
                  <StIcon name="square" size={13} />
                  {node}
                </div>
              ))
            ) : (
              <div className="st-rp-empty">No ancestry path for this selection.</div>
            )}
          </>
        ) : (
          <CssKnobs el={el} />
        )}
      </div>
    </aside>
  );
}

// ---------- App ----------

function App() {
  const [groups, setGroups] = useState([]);
  const [project, setProject] = useState('Design');
  const [tabs, setTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [selected, setSelected] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  // Phase 8 Task 7 — git lifecycle reload prompt. Server has already flushed
  // every dirty Y.Doc to disk by the time this state populates, so accepting
  // the reload is data-loss-safe (DDR-051 §3).
  const [gitLifecycle, setGitLifecycle] = useState(null);
  // Phase 9 Task 8 — hub-down offline mode banner. Driven by the 'sync:status'
  // WS message the linked-mode sync runtime emits. null in solo mode.
  const [syncStatus, setSyncStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [systemData, setSystemData] = useState(null);
  // Loaded once at boot from /_config — informs canvasUrl() so TSX iframes
  // can pass the right ?designRel + ?tokens query to the canvas mount shell.
  const [cfg, setCfg] = useState({ designRel: '.design' });
  useEffect(() => {
    let cancelled = false;
    fetch('/_config')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const designRel = (data.designRoot || '.design').replace(/^\/+|\/+$/g, '');
        // Functional merge — the `/_config` and `/_index-data` fetches race, and
        // the latter contributes `canvasDesignSystems` (DDR-093). A full-replace
        // here would clobber that map if it resolved second.
        setCfg((prev) => ({
          ...prev,
          designRel,
          tokensCssRel: data.tokensCssRel,
          // Pass through designSystems so canvasUrl can resolve the right
          // tokens/components paths per-DS. Top-level tokensCssRel is the
          // legacy default; designSystems[0].tokensCssRel is the project's
          // authoritative value (post DS-bootstrap).
          designSystems: data.designSystems,
          // T2 (9.1-A) — segregated canvas-content origin. canvasUrl() prepends
          // it so iframes load cross-origin (hub-pushed JSX is then walled off
          // from the main origin's /_api). Absent on older servers → relative
          // URL fallback keeps same-origin behavior.
          canvasOrigin: data.canvasOrigin,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  // Backfill the sync banner on mount from /_sync-status. The 'sync:status' WS
  // broadcast is one-shot for the zero-syncable case (DDR-060 / 9.1-D), so a
  // tab that connects after boot would otherwise miss it. {linked:false} (solo)
  // leaves the banner null.
  useEffect(() => {
    let cancelled = false;
    fetch('/_sync-status')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data || data.linked === false) return;
        setSyncStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [commentsByFile, setCommentsByFile] = useState({}); // { file: [Comment] }
  // Phase 6 — the in-iframe composer owns drafting; the shell no longer holds
  // a `draft` state. Mutations route through postMessage → WS instead.
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [commentsFilter, setCommentsFilter] = useState('open'); // 'all' | 'open' | 'resolved'
  const [theme, setTheme] = useState(readInitialTheme);
  const [openMenu, setOpenMenu] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => readBoolStore(SIDEBAR_STORE, true));
  const [showHidden, setShowHidden] = useState(() => readBoolStore(SHOW_HIDDEN_STORE, false));
  const [sectionsExpanded, setSectionsExpanded] = useState(() => readJsonStore(SECTIONS_STORE, {}));
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // T5/T6 (Plan C) — shell-level export/handoff dialog + inspector panel state.
  // The palette (T4) drives them; the dialog (T5) + panel (T6) consume them.
  const [exportDialog, setExportDialog] = useState(null); // null | { mode: 'export'|'handoff', scope? }
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const whatsNew = useWhatsNew(MDCC_VERSION);
  const [tourSteps, setTourSteps] = useState(null);
  const [usageNudge, setUsageNudge] = useState(() => !readBoolStore(USAGE_TOUR_STORE, false));
  const startTour = useCallback((steps) => {
    setTourSteps(Array.isArray(steps) && steps.length ? steps : null);
  }, []);
  const markUsageSeen = useCallback(() => {
    setUsageNudge(false);
    try {
      localStorage.setItem(USAGE_TOUR_STORE, '1');
    } catch {}
  }, []);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  // P2/P3 (Plan C) — top-bar live state. (Zoom lives in the canvas toolbar pill,
  // so the top bar no longer mirrors it.)
  //   activeArtboards — real artboard count of the open canvas, read from its
  //                   `<canvas>.meta.json` sidecar (shell-side, no iframe dep).
  //   gitUser       — local user (name/initials) for the menubar presence avatar.
  //   agentActive   — transient flag set on `ai-activity`, cleared after idle, so
  //                   the menubar shows a live agent avatar while Claude edits.
  const [activeArtboards, setActiveArtboards] = useState(0);
  const [gitUser, setGitUser] = useState(null);
  const [agentActive, setAgentActive] = useState(false);
  const agentIdleRef = useRef(null);
  const wsRef = useRef(null);
  const iframesRef = useRef(new Map());

  // Phase 5.1 — postMessage bridge from menubar dropdowns to the canvas iframe.
  // The canvas-shell listens for these `dgn:*` messages and dispatches into the
  // matching local provider (annotations visibility / both selection stores /
  // tool mode). Mirrors the existing `force-clear` / `select-clear` channel.
  const postToActiveCanvas = useCallback(
    (payload) => {
      const el = activePath ? iframesRef.current.get(activePath) : null;
      if (!el || !el.contentWindow) return;
      try {
        el.contentWindow.postMessage(payload, '*');
      } catch {}
    },
    [activePath]
  );

  const toggleAnnotations = useCallback(() => {
    setAnnotationsVisible((v) => {
      const next = !v;
      const el = activePath ? iframesRef.current.get(activePath) : null;
      if (el && el.contentWindow) {
        try {
          el.contentWindow.postMessage({ dgn: 'view-annotations', visible: next }, '*');
        } catch {}
      }
      return next;
    });
  }, [activePath]);

  // P3 (Plan C) — local git user for the menubar presence avatar. One-shot.
  useEffect(() => {
    let cancelled = false;
    fetch('/_api/git-user')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const n = d && typeof d.name === 'string' ? d.name.trim() : '';
        if (n) setGitUser(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // P2 (Plan C) — when the active canvas changes, read its real artboard count
  // from the `<canvas>.meta.json` sidecar (shell-side, no iframe dep).
  useEffect(() => {
    if (!activePath || activePath === SYSTEM_TAB) {
      setActiveArtboards(0);
      return;
    }
    let cancelled = false;
    fetch('/_api/canvas-meta?file=' + encodeURIComponent(activePath))
      .then((r) => r.json())
      .then((meta) => {
        if (cancelled) return;
        const n = Array.isArray(meta?.artboards) ? meta.artboards.length : 0;
        setActiveArtboards(n);
      })
      .catch(() => {
        if (!cancelled) setActiveArtboards(0);
      });
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  // Sync theme to <html data-theme> + localStorage on every change.
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_STORE, theme);
    } catch {}
    // System-review D9 — the canvas-shell chrome (workspace plane, floating
    // toolbar, minimap, zoom HUD, halos) follows the Maude theme. Broadcast to
    // EVERY open canvas iframe (not just activePath — several may be open); the
    // iframe's canvas-shell sets `data-maude-theme` and re-themes its floating
    // chrome via the --maude-chrome-* family. Artboards keep their DS theme.
    // Mirrors the git-lifecycle broadcast-to-all loop below. On the initial
    // mount run iframesRef is empty (no canvas open yet) — a freshly-loaded
    // iframe instead gets the current theme from the `dgn:'loaded'` handler.
    for (const el of iframesRef.current.values()) {
      try {
        el.contentWindow.postMessage({ dgn: 'theme', theme }, '*');
      } catch {}
    }
  }, [theme]);

  // Persist sidebar / hidden-files / DS-body toggles. Mirror theme pattern.
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORE, sidebarOpen ? '1' : '0');
    } catch {}
  }, [sidebarOpen]);
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_HIDDEN_STORE, showHidden ? '1' : '0');
    } catch {}
  }, [showHidden]);
  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_STORE, JSON.stringify(sectionsExpanded));
    } catch {}
  }, [sectionsExpanded]);

  const toggleSection = useCallback((label, defaultOpen) => {
    setSectionsExpanded((prev) => {
      const cur = prev[label];
      const isOpen = cur === undefined ? defaultOpen : cur;
      return { ...prev, [label]: !isOpen };
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // ----- Tree -----
  const loadTree = useCallback(async () => {
    try {
      const r = await fetch('/_index-data');
      const data = await r.json();
      setProject(data.project || 'Design');
      const built = data.groups.map((g) => ({
        ...g,
        tree: buildTree(g.paths, g.stripPrefix),
      }));
      setGroups(built);
      // DDR-093 — fold the server-resolved per-canvas DS map into cfg so
      // canvasUrl() injects each UI canvas's OWN design-system tokens instead of
      // always designSystems[0]. Functional merge to coexist with the /_config
      // fetch (either may land first). `?? {}` keeps older servers (no map) on
      // the ds0 fallback. Re-runs on every tree reload, so adding/retargeting a
      // canvas refreshes the map.
      setCfg((prev) => ({ ...prev, canvasDesignSystems: data.canvasDesignSystems ?? {} }));
    } catch (e) {
      console.error('failed to load tree', e);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  // ----- System data (lazy) -----
  // `dsName` scopes to a single design-system entry (DDR-048). The initial
  // call is unscoped — server returns `availableDesignSystems[]` + a default
  // — so the picker can render without a probe round-trip. Subsequent calls
  // (e.g. picker change) pass the chosen DS name and we replace systemData
  // wholesale (tokens + previews + ds metadata all shift together).
  const loadSystemData = useCallback(async (dsName) => {
    try {
      const url = dsName ? `/_system-data?ds=${encodeURIComponent(dsName)}` : '/_system-data';
      const r = await fetch(url);
      if (!r.ok) {
        console.error('failed to load system-data', r.status);
        return;
      }
      const data = await r.json();
      // If the initial unscoped fetch has a defaultDesignSystem but no `ds`
      // attached (multi-DS project), kick off a scoped fetch so the visible
      // tokens + previews match the default DS, not the union root scan.
      if (!dsName && data?.defaultDesignSystem && !data.ds) {
        setSystemData(data);
        const r2 = await fetch(`/_system-data?ds=${encodeURIComponent(data.defaultDesignSystem)}`);
        if (r2.ok) setSystemData(await r2.json());
        return;
      }
      setSystemData(data);
    } catch (e) {
      console.error('failed to load system-data', e);
    }
  }, []);

  // ----- Comments — initial load of all files -----
  const loadAllComments = useCallback(async () => {
    try {
      const r = await fetch('/_comments-all');
      const data = await r.json();
      setCommentsByFile(data || {});
    } catch (e) {
      console.error('failed to load comments', e);
    }
  }, []);

  useEffect(() => {
    loadAllComments();
  }, [loadAllComments]);

  // ----- WebSocket -----
  useEffect(() => {
    function connect() {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(proto + '//' + location.host + '/_ws');
      wsRef.current = ws;
      ws.addEventListener('open', () => setWsConnected(true));
      ws.addEventListener('close', () => {
        setWsConnected(false);
        setTimeout(connect, 1000);
      });
      ws.addEventListener('error', () => {});
      ws.addEventListener('message', (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'snapshot' && m.state) {
            setSelected(m.state.selected);
          } else if (m.type === 'selected') {
            setSelected(m.selected);
          } else if (m.type === 'comments' && typeof m.file === 'string') {
            setCommentsByFile((prev) => ({ ...prev, [m.file]: m.comments || [] }));
          } else if (m.type === 'ai-activity' && typeof m.file === 'string') {
            // P3 (Plan C) — surface live agent activity as a menubar presence
            // avatar. Set the flag and (re)arm an idle timer so the avatar
            // fades once Claude stops editing.
            setAgentActive(true);
            if (agentIdleRef.current) clearTimeout(agentIdleRef.current);
            agentIdleRef.current = setTimeout(() => setAgentActive(false), 8000);
            // Phase 8 Task 4 — relay to every open iframe; each canvas's
            // AiBanner filters by its own file path. Lightweight broadcast
            // (one envelope per change, not per iframe count).
            for (const el of iframesRef.current.values()) {
              try {
                el.contentWindow.postMessage(
                  { dgn: 'ai-activity', file: m.file, entry: m.entry },
                  '*'
                );
              } catch {}
            }
          } else if (m.type === 'sync:status' && m.payload) {
            // Phase 9 Task 8 — hub connection state for the offline banner.
            setSyncStatus(m.payload);
          } else if (m.type === 'git-lifecycle' && m.payload) {
            // Phase 8 Task 7 — branch switch / pull mid-session. Server has
            // already flushed every dirty Y.Doc to JSON; just prompt the user.
            // Single confirm covers all open iframes — reload reseeds them all.
            setGitLifecycle(m.payload);
            // Also relay to iframes so canvas-level "Reload?" UI (if any)
            // can react. Outer banner is the primary prompt.
            for (const el of iframesRef.current.values()) {
              try {
                el.contentWindow.postMessage({ dgn: 'git-lifecycle', payload: m.payload }, '*');
              } catch {}
            }
          }
        } catch {}
      });
    }
    connect();
    return () => wsRef.current && wsRef.current.close();
  }, []);

  function wsSend(obj) {
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    } catch {}
  }

  // ----- Tab management (single-canvas) -----
  // Single-canvas model: opening a file REPLACES the active one (no tab strip).
  // The `tabs` state stays as a 0-or-1 array so the rest of the plumbing
  // (iframesRef, comments push, WS `tabs` message) doesn't need refactoring.
  // ARTBOARDS slot in the menubar reads `tabs.length` and reports 0 or 1.
  const openTab = useCallback((path) => {
    setTabs((prev) => {
      // Drop the previously-open iframe so we don't leak DOM nodes.
      for (const t of prev) if (t.path !== path) iframesRef.current.delete(t.path);
      return [{ path }];
    });
    setActivePath(path);
    setFocusedCommentId(null);
  }, []);

  const openSystem = useCallback(
    (dsName) => {
      // DsFolderRow passes the clicked DS name → scope the System view to it so
      // each folder shows its own tokens + previews. The no-arg callers (menubar,
      // keyboard reopen) only load default data on first open.
      const ds = typeof dsName === 'string' ? dsName : undefined;
      if (ds) loadSystemData(ds);
      else if (!systemData) loadSystemData();
      openTab(SYSTEM_TAB);
    },
    [systemData, loadSystemData, openTab]
  );

  useEffect(() => {
    wsSend({ type: 'tabs', tabs: tabs.map((t) => t.path).filter((p) => p !== SYSTEM_TAB) });
  }, [tabs]);

  useEffect(() => {
    if (activePath && activePath !== SYSTEM_TAB) wsSend({ type: 'active', file: activePath });
    else if (activePath === SYSTEM_TAB) wsSend({ type: 'active', file: '' });
    else wsSend({ type: 'active', file: '' });
  }, [activePath]);

  const closeTab = useCallback(
    (path) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.path === path);
        if (idx < 0) return prev;
        const next = prev.filter((t) => t.path !== path);
        if (path === activePath) {
          if (next.length === 0) setActivePath(null);
          else setActivePath(next[Math.max(0, idx - 1)].path);
        }
        return next;
      });
      iframesRef.current.delete(path);
    },
    [activePath]
  );

  const reloadActive = useCallback(() => {
    if (!activePath || activePath === SYSTEM_TAB) {
      if (activePath === SYSTEM_TAB) loadSystemData();
      return;
    }
    const el = iframesRef.current.get(activePath);
    if (el) el.src = el.src;
  }, [activePath, loadSystemData]);

  const reloadTree = useCallback(() => loadTree(), [loadTree]);

  // Phase 22 — create a blank brief board from the tree header. POSTs to the
  // main-origin-only /_api/canvas (the untrusted canvas iframe can't reach it),
  // then refreshes the tree and opens the new board so it's immediately the
  // active canvas to annotate. Returns {ok} | {ok:false,error} so the Sidebar
  // can surface a validation/duplicate message inline.
  const createBoard = useCallback(
    async (name) => {
      try {
        const r = await fetch('/_api/canvas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, kind: 'brief-board' }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) return { ok: false, error: j.error || `create failed (${r.status})` };
        await loadTree();
        openTab(j.file);
        return { ok: true, file: j.file };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'network error' };
      }
    },
    [loadTree, openTab]
  );

  // Phase 22 — soft-delete a canvas from the file tree. Confirms (destructive),
  // DELETEs to the main-origin-only endpoint, refreshes the tree, and resets the
  // active tab if the deleted canvas was open. The server moves the whole sidecar
  // set to .design/_trash/ — recoverable locally.
  const deleteBoard = useCallback(
    async (filePath, label) => {
      const ok = window.confirm(
        `Move “${label}” to trash?\n\nIts annotations, history and comments move with it. ` +
          `You can restore it from .design/_trash/.`
      );
      if (!ok) return;
      try {
        const r = await fetch(`/_api/canvas?file=${encodeURIComponent(filePath)}`, {
          method: 'DELETE',
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          window.alert(`Could not delete: ${j.error || `error ${r.status}`}`);
          return;
        }
        await loadTree();
        if (activePath === filePath) {
          setTabs([]);
          setActivePath(null);
        }
      } catch (e) {
        window.alert(`Delete failed: ${e instanceof Error ? e.message : 'network error'}`);
      }
    },
    [loadTree, activePath]
  );

  const clearSelected = useCallback(() => {
    wsSend({ type: 'clear-select' });
    setSelected(null);
    if (activePath && activePath !== SYSTEM_TAB) {
      const el = iframesRef.current.get(activePath);
      if (el && el.contentWindow) {
        try {
          el.contentWindow.postMessage({ dgn: 'force-clear' }, '*');
        } catch {}
      }
    }
  }, [activePath]);

  // ----- Push comments to iframe whenever they change for active file -----
  useEffect(() => {
    if (!activePath || activePath === SYSTEM_TAB) return;
    const el = iframesRef.current.get(activePath);
    if (!el || !el.contentWindow) return;
    const list = commentsByFile[activePath] || [];
    try {
      el.contentWindow.postMessage({ dgn: 'comments-set', comments: list }, '*');
    } catch {}
  }, [activePath, commentsByFile]);

  // ----- Inbound messages from iframes -----
  useEffect(() => {
    function onMessage(e) {
      // Cross-origin hardening (DDR-054): only accept dgn control messages from
      // the canvas-content origin — the split origin when on, else our own origin
      // for the same-origin iframe. Drops spoofed messages from any other window.
      // The handlers below relay to inert stores (comments / selection — the
      // "safe to sync" set), so the blast radius was small, but unchecked inbound
      // postMessage is a confused-deputy seam the F1 hardening should close.
      const expectedOrigin = cfg?.canvasOrigin || window.location.origin;
      if (e.origin !== expectedOrigin) return;
      const m = e.data;
      if (!m || typeof m !== 'object' || !m.dgn) return;
      if (m.dgn === 'tool-cursor') {
        // Phase 24 — show the active canvas tool's cursor across the WHOLE app
        // shell (sidebar, top bar, everything) so the custom cursor is visible
        // everywhere in maude, not just inside the canvas iframe. The canvas
        // sends only a tool TOKEN; we resolve it to a cursor string from our own
        // trusted map (resolveToolCursor) and apply THAT — never a raw
        // canvas-supplied value. A malicious synced canvas (DDR-054) can thus
        // only pick a known, always-visible glyph; it cannot inject an
        // invisible/displaced SVG cursor as a clickjacking aid over the un-CSP'd
        // shell (phase-24 ethical-hacker Finding 2; DDR-067).
        const cursor = resolveToolCursor(m.tool);
        if (cursor) {
          document.body.style.cursor = cursor;
          let el = document.getElementById('dc-app-cursor');
          if (!el) {
            el = document.createElement('style');
            el.id = 'dc-app-cursor';
            document.head.appendChild(el);
          }
          el.textContent = `* { cursor: ${cursor} !important; }`;
        }
        return;
      }
      if (m.dgn === 'select' && m.selection) {
        wsSend({ type: 'select', selection: m.selection });
        setSelected(m.selection);
      } else if (m.dgn === 'select-set') {
        // Canvas multi-select. Payload shape:
        //   null              → empty selection
        //   Selection         → length-1 (back-compat with legacy single-element shape)
        //   Selection[]       → N > 1
        // For shell purposes we track the focused entry (head of array, or
        // the bare object) — comments + halo only act on one element at a
        // time today. Multi-target editing is an explicit Phase-4.1 non-goal.
        const payload = m.selection;
        if (payload == null) {
          wsSend({ type: 'clear-select' });
          setSelected(null);
        } else if (Array.isArray(payload)) {
          const head = payload[0] ?? null;
          if (head) wsSend({ type: 'select', selection: head });
          setSelected(head);
        } else {
          wsSend({ type: 'select', selection: payload });
          setSelected(payload);
        }
      } else if (m.dgn === 'clear-select') {
        wsSend({ type: 'clear-select' });
        setSelected(null);
      } else if (m.dgn === 'edit-text' && m.id) {
        // Phase 12 (DDR-101) — inline text edit committed in the canvas. POST to
        // the main-origin-only /_api/edit-text → editText writes the escaped
        // JSXText to source; the file-watcher HMR reload then shows the new text.
        // A refusal (mixed/expression content) is logged, not fatal.
        fetch('/_api/edit-text', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ canvas: m.file, id: m.id, text: m.text ?? '' }),
        })
          .then((r) => r.json().catch(() => ({})))
          .then((j) => {
            if (!j.ok) console.warn('[edit-text]', j.error || 'failed');
          })
          .catch(() => {});
      } else if (m.dgn === 'comment-compose' && m.selection) {
        // Phase 6 — the iframe overlay owns the composer surface now. The
        // shell just mirrors `selected` so the StatusBar / sidebar still
        // reflect the target, and skips the legacy `startDraftFor` path that
        // opened the shell-side composer. Legacy `.html` mocks (no
        // canvas-shell mount) fall through to the same path; they lose the
        // shell composer in this phase. Acceptable per Phase 6 scope.
        setSelected(m.selection);
      } else if (m.dgn === 'comment-submit' && m.payload && typeof m.payload.text === 'string') {
        // Phase 6 — iframe overlay finished composing. Relay through the
        // existing WS `comments-add` channel; server-side persistence +
        // broadcast back are identical to the legacy shell-composer flow.
        const p = m.payload;
        const txt = String(p.text).trim();
        if (txt) {
          wsSend({
            type: 'comments-add',
            payload: {
              file: p.file,
              selector: p.selector,
              index: p.index,
              dom_path: p.dom_path,
              tag: p.tag,
              classes: p.classes,
              bounds: p.bounds,
              html_excerpt: p.html_excerpt,
              text: txt,
            },
          });
        }
      } else if (m.dgn === 'comment-patch' && m.id && m.patch && typeof m.patch === 'object') {
        // Phase 6 — thread popover routes resolve / reopen through here.
        wsSend({ type: 'comments-patch', id: m.id, patch: m.patch });
      } else if (m.dgn === 'comment-delete' && m.id) {
        wsSend({ type: 'comments-delete', id: m.id });
        setFocusedCommentId((prev) => (prev === m.id ? null : prev));
      } else if (m.dgn === 'comment-click' && m.id) {
        setFocusedCommentId(m.id);
      } else if (m.dgn === 'artboards' && typeof m.count === 'number') {
        // P2 (Plan C) — optional iframe-reported artboard count; overrides the
        // meta.json-derived seed when the canvas knows better. Clamp.
        const n = Math.round(m.count);
        if (Number.isFinite(n) && n >= 0 && n <= 999) setActiveArtboards(n);
      } else if (m.dgn === 'toggle-palette') {
        // ⌘K pressed while focus was inside the canvas iframe — the injected
        // inspector forwards the chord here since the iframe's keydown never
        // reaches the shell's window listener. Mirror that handler's toggle.
        setPaletteOpen((v) => !v);
      } else if (m.dgn === 'open-export') {
        // Plan C — the in-canvas toolbar / context menu route here so they open
        // the SAME shell Export dialog as the menubar (one look, all settings).
        // Carry the context-menu's scope hint (e.g. "Export selection").
        setExportDialog({
          mode: 'export',
          scope: m.detail && typeof m.detail.scope === 'string' ? m.detail.scope : undefined,
        });
      } else if (m.dgn === 'loaded' && m.file) {
        // iframe finished loading — push current comments + carry over focused pin if any
        const list = commentsByFile[m.file] || [];
        const el = [...iframesRef.current.entries()].find(([k]) => k === m.file)?.[1];
        if (el && el.contentWindow) {
          try {
            el.contentWindow.postMessage({ dgn: 'comments-set', comments: list }, '*');
          } catch {}
          // System-review D9 — seed the just-loaded canvas with the current
          // chrome theme so a canvas opened AFTER a theme toggle starts
          // correct (no flash from the dark default).
          try {
            el.contentWindow.postMessage({ dgn: 'theme', theme }, '*');
          } catch {}
          if (focusedCommentId && list.some((c) => c.id === focusedCommentId)) {
            try {
              el.contentWindow.postMessage({ dgn: 'comment-focus', id: focusedCommentId }, '*');
            } catch {}
          }
        }
      } else if (m.dgn === 'export-request' && m.id && m.payload) {
        // The export dialog renders inside the canvas iframe (canvas origin),
        // but /_api/export is a privileged MAIN-origin endpoint deliberately
        // kept off the canvas allowlist (DDR-060). A direct in-iframe fetch
        // therefore 403s ("Forbidden (canvas origin)"). Bridge it: run the
        // export here on the trusted main origin, stream the download, and
        // report status back to the iframe. Origin is already validated
        // (e.origin === expectedOrigin) above, so only the real canvas iframe
        // can ask — this is NOT a generic fetch proxy.
        void runBridgedExport(e.source, m.id, m.payload);
      } else if (m.dgn === 'export-history-request' && m.id) {
        // Same bridge for the dialog's Recent tab (/_api/export-history is
        // also main-origin-only).
        void runBridgedHistory(e.source, m.id);
      }
    }
    // Reply target for the export bridge: the canvas iframe's own origin.
    const replyOrigin = cfg?.canvasOrigin || window.location.origin;
    async function runBridgedExport(source, id, payload) {
      const reply = (msg) => {
        try {
          if (source) source.postMessage({ dgn: 'export-result', id, ...msg }, replyOrigin);
        } catch {}
      };
      try {
        const r = await fetch('/_api/export', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          reply({ ok: false, error: (await r.text()) || String(r.status) });
          return;
        }
        const disp = r.headers.get('Content-Disposition') || '';
        const fn = /filename="([^"]+)"/.exec(disp);
        const filename = (fn && fn[1]) || 'export';
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        reply({ ok: true, filename });
      } catch (err) {
        reply({ ok: false, error: err && err.message ? err.message : String(err) });
      }
    }
    async function runBridgedHistory(source, id) {
      let history = [];
      try {
        const r = await fetch('/_api/export-history');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data.history)) history = data.history;
        }
      } catch {
        /* best-effort — empty list */
      }
      try {
        if (source) source.postMessage({ dgn: 'export-history-result', id, history }, replyOrigin);
      } catch {}
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [commentsByFile, focusedCommentId, cfg, theme]);

  // Tell the active canvas iframe to drop any persistent selection (canvas
  // SelectionSet) — used when the comment composer closes via submit /
  // cancel / Esc. canvas-shell listens for `force-clear` on the window
  // message channel and calls selSet.clear().
  const clearActiveCanvasSelection = useCallback(() => {
    if (!activePath || activePath === SYSTEM_TAB) return;
    const el = iframesRef.current.get(activePath);
    if (el && el.contentWindow) {
      try {
        el.contentWindow.postMessage({ dgn: 'force-clear' }, '*');
      } catch {}
    }
  }, [activePath]);

  const resolveComment = useCallback((id) => {
    wsSend({ type: 'comments-patch', id, patch: { status: 'resolved' } });
  }, []);
  const reopenComment = useCallback((id) => {
    wsSend({ type: 'comments-patch', id, patch: { status: 'open' } });
  }, []);
  const deleteComment = useCallback((id) => {
    wsSend({ type: 'comments-delete', id });
    setFocusedCommentId((prev) => (prev === id ? null : prev));
  }, []);

  // Jump from right-sidebar list to a comment: open file tab if needed, focus pin.
  // The iframe may be freshly mounted; the loaded handler also re-sends focus if focusedCommentId matches.
  const jumpToComment = useCallback(
    (file, id) => {
      if (file && file !== activePath) {
        setTabs((prev) => (prev.find((t) => t.path === file) ? prev : [...prev, { path: file }]));
        setActivePath(file);
      }
      if (id == null) {
        setFocusedCommentId(null);
        return;
      }
      setFocusedCommentId(id);
      // Try sending focus immediately (existing iframe) and again after a short delay (newly opened tab).
      const send = () => {
        const el = iframesRef.current.get(file);
        if (el && el.contentWindow) {
          try {
            el.contentWindow.postMessage({ dgn: 'comment-focus', id }, '*');
          } catch {}
        }
      };
      send();
      setTimeout(send, 200);
    },
    [activePath]
  );

  // ----- Keyboard shortcuts (no Cmd+W — let browser close the tab) -----
  useEffect(() => {
    function onKey(e) {
      const meta = e.metaKey || e.ctrlKey;
      const inEditable =
        ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
        document.activeElement?.isContentEditable;
      // Phase 4.1: shell-side letter shortcuts (H/T/S) must not double-fire
      // inside a focused canvas iframe — the canvas input router owns those
      // letters as tool-mode keys (V/H/C). Cmd-modified shortcuts (⌘R, ⌘⇧M,
      // ⌘F) still fire regardless of focus, mirroring browser convention.
      const inCanvasIframe = document.activeElement?.tagName === 'IFRAME';

      // Cmd+K / Ctrl+K — toggle the command palette (works even in inputs).
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Cmd+R — reload active iframe (override browser reload)
      if (meta && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        reloadActive();
        return;
      }
      // Cmd+Shift+M / Ctrl+Shift+M — toggle right "Comments" panel
      if (meta && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setCommentsPanelOpen((v) => !v);
        return;
      }
      // Cmd+C / Ctrl+C — Phase 4.1 removed the shell-side comment-drop chord.
      // Canvas comment-drop is the `C` tool letter (press C in the canvas,
      // then click the element) or right-click "Add comment". Cmd+C now
      // reverts to native browser copy.
      if (meta && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (
          selected &&
          selected.selector &&
          activePath &&
          activePath !== SYSTEM_TAB &&
          !inEditable &&
          console &&
          console.warn
        ) {
          console.warn(
            'Cmd+C comment-drop deprecated — press C inside the canvas to enter Comment tool, then click the element.'
          );
        }
        // Fall through to native copy.
      }
      if (inEditable) return;
      // / — focus search (or ⌘F per CV-08 placeholder hint)
      if (e.key === '/') {
        e.preventDefault();
        const inp = document.querySelector('.st-search input');
        if (inp) inp.focus();
        return;
      }
      if (meta && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        if (!sidebarOpen) setSidebarOpen(true);
        setTimeout(() => {
          const inp = document.querySelector('.st-search input');
          if (inp) inp.focus();
        }, 0);
        return;
      }
      // T / H / S are bare-letter shell shortcuts. When focus is inside a
      // canvas iframe, the canvas input router claims V/H/C — bail out
      // here so the canvas owns the key and the sidebar/system view don't
      // double-fire on focused-canvas keypresses.
      if (inCanvasIframe) {
        // Esc still bubbles below (composer / focused-pin clear).
        if (e.key !== 'Escape') return;
      }
      // T — toggle Project Tree (sidebar)
      if (e.key === 't' || e.key === 'T') {
        if (e.shiftKey || meta) return;
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }
      // H — toggle show-hidden (sidecars + project/runtime orphans)
      if (e.key === 'h' || e.key === 'H') {
        if (e.shiftKey || meta) return;
        e.preventDefault();
        setShowHidden((v) => !v);
        return;
      }
      // S — toggle Design system view
      if ((e.key === 's' || e.key === 'S') && !meta && !e.shiftKey) {
        e.preventDefault();
        if (activePath === SYSTEM_TAB) {
          closeTab(SYSTEM_TAB);
        } else {
          openSystem();
        }
        return;
      }
      // I — toggle Inspector panel (T6, Plan C)
      if ((e.key === 'i' || e.key === 'I') && !meta && !e.shiftKey) {
        e.preventDefault();
        setInspectorOpen((v) => !v);
        return;
      }
      // ? or F1 — open Help modal
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      // Esc — clear focused pin. The in-place composer (Phase 6) and thread
      // popover handle their own Esc inside the iframe.
      if (e.key === 'Escape') {
        if (focusedCommentId) {
          setFocusedCommentId(null);
          return;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    reloadActive,
    selected,
    activePath,
    focusedCommentId,
    sidebarOpen,
    openSystem,
    closeTab,
    clearActiveCanvasSelection,
  ]);

  const registerIframe = useCallback((path, el) => {
    if (el) iframesRef.current.set(path, el);
  }, []);

  const totalOpen = totalCounts(commentsByFile).open;

  // Suppress the native browser context menu across the shell — the canvas
  // input-router already handles right-click inside the canvas host, but
  // sidebar / menubar / statusbar / floating chrome would otherwise leak the
  // native menu on top of our `.dc-context-menu` (or alone, outside canvas).
  // Editable fields (search box, future text inputs) keep the native menu so
  // copy/paste still works.
  const onShellContextMenu = useCallback((e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }
    e.preventDefault();
  }, []);

  // ⌘K palette actions — shell-doable only (in-canvas export lives in the iframe).
  // T4 (Plan C) — grouped command set per `.design/ui/Studio.tsx` AB-D.
  // `group` drives the section headers; the list stays a flat array so keyboard
  // nav indexes straight across groups.
  const paletteActions = useMemo(
    () => [
      // ── Canvas ──────────────────────────────────────────────────────────
      {
        id: 'new',
        group: 'Canvas',
        label: 'New canvas…',
        icon: 'plus',
        kbd: '⌘N',
        run: () => {
          setSidebarOpen(true);
          setTimeout(
            () => document.querySelector('[aria-label="New blank brief board"]')?.click(),
            60
          );
        },
      },
      {
        id: 'export',
        group: 'Canvas',
        label: 'Export…',
        icon: 'download',
        kbd: '⇧⌘E',
        run: () => setExportDialog({ mode: 'export' }),
      },
      {
        id: 'handoff',
        group: 'Canvas',
        label: 'Handoff to production',
        icon: 'share',
        kbd: '⇧⌘H',
        run: () => setExportDialog({ mode: 'handoff' }),
      },
      // ── View ────────────────────────────────────────────────────────────
      {
        id: 'system',
        group: 'View',
        label: 'Open design system view',
        icon: 'sliders',
        kbd: 'S',
        run: () => openSystem(),
      },
      {
        id: 'comments',
        group: 'View',
        label: 'Toggle comments panel',
        icon: 'resolve',
        kbd: '⌘⇧M',
        run: () => setCommentsPanelOpen((v) => !v),
      },
      {
        id: 'inspector',
        group: 'View',
        label: 'Open inspector',
        icon: 'sliders',
        kbd: 'I',
        run: () => setInspectorOpen(true),
      },
      {
        id: 'reload',
        group: 'View',
        label: 'Reload active canvas',
        icon: 'reload',
        kbd: '⌘R',
        run: () => reloadActive(),
      },
      // ── Tools ───────────────────────────────────────────────────────────
      {
        id: 'draw',
        group: 'Tools',
        label: 'Draw a mark with the SVG agent',
        icon: 'pen',
        run: () => {
          // The shell can't invoke Claude — surface the command for the user to
          // paste into Claude Code (clipboard is the honest, useful affordance).
          try {
            navigator.clipboard?.writeText('/design:draw ');
          } catch {}
        },
      },
      {
        id: 'theme',
        group: 'Tools',
        label: 'Toggle light / dark theme',
        icon: 'sun',
        run: () => toggleTheme(),
      },
      // ── Help ────────────────────────────────────────────────────────────
      {
        id: 'whatsnew',
        group: 'Help',
        label: "What's new in maude",
        icon: 'sparkle',
        run: () => whatsNew.openPanel(),
      },
      {
        id: 'help',
        group: 'Help',
        label: 'Help · shortcuts & commands',
        icon: 'help',
        kbd: '?',
        run: () => setHelpOpen(true),
      },
    ],
    [openSystem, toggleTheme, reloadActive, whatsNew]
  );

  return (
    <div className="maude" data-theme={theme} onContextMenu={onShellContextMenu}>
      <SyncBanner status={syncStatus} />
      {!usageNudge && !tourSteps && <WhatsNewToast wn={whatsNew} />}
      {gitLifecycle && (
        <div role="status" aria-live="polite" className="st-banner st-banner--info">
          <span className="st-banner-dot" aria-hidden="true" />
          <span>Repo state changed — reload to sync?</span>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              try {
                window.location.reload();
              } catch {}
            }}
          >
            Reload
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setGitLifecycle(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div className="st-shell">
        <Menubar
          activePath={activePath}
          project={project}
          tabsCount={tabs.length}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          commentsPanelOpen={commentsPanelOpen}
          onToggleComments={() => setCommentsPanelOpen((v) => !v)}
          onOpenSystem={openSystem}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          showHidden={showHidden}
          onToggleShowHidden={() => setShowHidden((v) => !v)}
          onOpenHelp={() => setHelpOpen(true)}
          annotationsVisible={annotationsVisible}
          onToggleAnnotations={toggleAnnotations}
          postToActiveCanvas={postToActiveCanvas}
          onOpenWhatsNew={whatsNew.openPanel}
          whatsNewCount={whatsNew.unseen.length}
          artboardCount={activeArtboards}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((v) => !v)}
          onNewCanvas={() => {
            setSidebarOpen(true);
            setTimeout(
              () => document.querySelector('[aria-label="New blank brief board"]')?.click(),
              60
            );
          }}
          onOpenExport={(mode) => setExportDialog({ mode })}
          onReload={reloadActive}
          presence={
            <>
              <StAvatar
                initials={initialsOf(gitUser || 'you')}
                hue="var(--accent)"
                title={gitUser ? `${gitUser} (you)` : 'You'}
              />
              {agentActive && (
                <StAvatar initials="C" hue="var(--presence-agent)" title="Claude · editing" />
              )}
            </>
          }
        />
        <div className="st-body">
          <CollapsedRail
            shown={!sidebarOpen}
            onExpand={() => setSidebarOpen(true)}
            onSearch={() => {
              setSidebarOpen(true);
              setTimeout(() => document.querySelector('.st-search input')?.focus(), 60);
            }}
          />
          <Sidebar
            groups={groups}
            activePath={activePath}
            activeDsName={activePath === SYSTEM_TAB ? (systemData?.ds?.name ?? null) : null}
            onOpen={openTab}
            onOpenSystem={openSystem}
            wsConnected={wsConnected}
            search={search}
            setSearch={setSearch}
            commentsByFile={commentsByFile}
            showHidden={showHidden}
            sectionsExpanded={sectionsExpanded}
            onToggleSection={toggleSection}
            onNewBoard={createBoard}
            onDeleteBoard={deleteBoard}
            collapsed={!sidebarOpen}
            onCollapse={() => setSidebarOpen(false)}
          />
          <div className="main">
            <Viewport
              tabs={tabs}
              activePath={activePath}
              registerIframe={registerIframe}
              systemData={systemData}
              onOpenFromSystem={openTab}
              onSelectDs={loadSystemData}
              project={project}
              cfg={cfg}
            />
          </div>
          {/* Right dock — one panel at a time. Inspector takes precedence when
              open (T6); else the comments panel. */}
          {inspectorOpen ? (
            <InspectorPanel selected={selected} onClose={() => setInspectorOpen(false)} />
          ) : commentsPanelOpen ? (
            <CommentsPanel
              commentsByFile={commentsByFile}
              filter={commentsFilter}
              setFilter={setCommentsFilter}
              activePath={activePath}
              focusedId={focusedCommentId}
              onJump={jumpToComment}
              onResolve={resolveComment}
              onReopen={reopenComment}
              onDelete={deleteComment}
            />
          ) : null}
        </div>
        <StatusBar
          activePath={activePath}
          selected={selected}
          wsConnected={wsConnected}
          openCount={totalOpen}
          theme={theme}
          onToggleTheme={toggleTheme}
          onClearSelected={clearSelected}
          syncStatus={syncStatus}
        />
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
      {exportDialog && (
        <ExportDialog
          mode={exportDialog.mode}
          initialScope={exportDialog.scope}
          activePath={activePath}
          onClose={() => setExportDialog(null)}
        />
      )}
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={() => {
          setHelpOpen(false);
          startTour(USAGE_TOUR);
        }}
      />
      <WhatsNewPanel wn={whatsNew} onStartTour={startTour} />
      {usageNudge && !tourSteps && (
        <div className="mdcc-tour-nudge" role="status" aria-live="polite">
          <div className="mdcc-tour-nudge__body">
            New here? Take a 60-second tour of the canvas browser.
          </div>
          <button
            type="button"
            className="mdcc-tour-nudge__cta"
            onClick={() => {
              markUsageSeen();
              startTour(USAGE_TOUR);
            }}
          >
            Start
          </button>
          <button
            type="button"
            className="mdcc-tour-nudge__skip"
            aria-label="Dismiss"
            onClick={markUsageSeen}
          >
            ×
          </button>
        </div>
      )}
      <TourOverlay
        steps={tourSteps ?? []}
        open={!!tourSteps}
        onClose={() => setTourSteps(null)}
        onComplete={markUsageSeen}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
