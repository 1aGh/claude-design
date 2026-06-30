// Design plugin local browser — React UI.
// Bundled via Bun.build (DDR-009/012) — IIFE, tree-shaken, React 19 from npm.
// Renders: file tree, tabs, viewport (iframes), status bar, design-system view, comments.
// Universal — no project tokens needed; styling lives in client/styles/.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

// Trusted tool→cursor resolver (shares the single TOOL_CURSORS source with the
// canvas runtime). canvas-cursors.ts is dependency-free (a type-only Tool
// import that Bun erases), so this pulls only string constants into the client
// bundle — no React, no input-router. See the tool-cursor handler below.
import { resolveToolCursor } from '../canvas-cursors.ts';
import { canvasUrl } from './canvas-url.js';
import ChatPanel from './panels/ChatPanel.jsx';
import DiffView from './panels/DiffView.jsx';
import GitPanel from './panels/GitPanel.jsx';
import IdentityBar from './panels/IdentityBar.jsx';
import OnboardingWizard from './panels/OnboardingWizard.jsx';
import { ReadinessDialog } from './panels/ReadinessList.jsx';
import RepoBranchSwitcher from './panels/RepoBranchSwitcher.jsx';
import { appIsFirstRun, isNativeApp, onUpdateReady, restartToUpdate } from './github.js';
import { COLLAB_TOUR } from './tour/collab-tour.js';
import { TourOverlay } from './tour/overlay.jsx';
import { USAGE_TOUR } from './tour/usage-tour.js';
import { useWhatsNew, WhatsNewPanel, WhatsNewToast } from './whats-new.jsx';

const USAGE_TOUR_STORE = 'mdcc-usage-tour-seen';
// Phase 29 (E4) — the collab "rychlý kurz" is offered once after onboarding.
const COLLAB_TOUR_STORE = 'mdcc-collab-tour-seen';

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
  megaphone: (
    <>
      <path d="M2 6.7 11 4v8L2 9.3z" />
      <path d="M11 5.2a2.4 2.4 0 0 1 0 5.6" />
      <path d="M4.3 9.5v2.3a1.2 1.2 0 0 0 2.4 0v-1.7" />
    </>
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
  // Layer-type glyphs (Phase 12.3 W3.1) — one mark per LayerNode `type`.
  box: <rect x="3" y="3" width="10" height="10" rx="1.2" />,
  type: (
    <>
      <polyline points="4 4 12 4" />
      <line x1="8" y1="4" x2="8" y2="12" />
    </>
  ),
  button: (
    <>
      <rect x="2.5" y="5" width="11" height="6" rx="3" />
      <line x1="6" y1="8" x2="10" y2="8" />
    </>
  ),
  input: (
    <>
      <rect x="2.5" y="5" width="11" height="6" rx="1.2" />
      <line x1="5" y1="8" x2="5" y2="8" />
    </>
  ),
  link: (
    <>
      <path d="M6.5 9.5a2.5 2.5 0 0 1 0-3.5l1.5-1.5a2.5 2.5 0 0 1 3.5 3.5l-1 1" />
      <path d="M9.5 6.5a2.5 2.5 0 0 1 0 3.5l-1.5 1.5a2.5 2.5 0 0 1-3.5-3.5l1-1" />
    </>
  ),
  list: (
    <>
      <line x1="6" y1="4.5" x2="13" y2="4.5" />
      <line x1="6" y1="8" x2="13" y2="8" />
      <line x1="6" y1="11.5" x2="13" y2="11.5" />
      <circle cx="3.2" cy="4.5" r="0.8" fill="currentColor" />
      <circle cx="3.2" cy="8" r="0.8" fill="currentColor" />
      <circle cx="3.2" cy="11.5" r="0.8" fill="currentColor" />
    </>
  ),
  eye: (
    <>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  eyedropper: (
    <>
      <path d="M11 2.6a1.7 1.7 0 0 1 2.4 2.4l-1.2 1.2-2.4-2.4z" />
      <path d="M9.5 4.6 4 10.1V12h1.9l5.5-5.5" />
    </>
  ),
  // Figma-style property prefix glyphs (#2) — small marks INSIDE numeric fields.
  'p-corner': <path d="M3.5 12.5V7a3.5 3.5 0 0 1 3.5-3.5h5.5" />,
  'p-opacity': (
    <>
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
      <path d="M3 8h10M8 3v10" strokeWidth="0.9" opacity="0.55" />
    </>
  ),
  'p-lineheight': (
    <>
      <line x1="6.5" y1="4" x2="13" y2="4" />
      <line x1="6.5" y1="8" x2="13" y2="8" />
      <line x1="6.5" y1="12" x2="13" y2="12" />
      <path d="M3.2 4.6 3.2 11.4M2 6 3.2 4.5 4.4 6M2 10 3.2 11.5 4.4 10" />
    </>
  ),
  'p-letterspacing': (
    <>
      <path d="M3 4v8M13 4v8" />
      <path d="M6 11.5 8 5l2 6.5M6.7 9.3h2.6" strokeWidth="1.1" />
    </>
  ),
  'p-gap': (
    <>
      <rect x="2" y="4.5" width="3.6" height="7" rx="0.6" />
      <rect x="10.4" y="4.5" width="3.6" height="7" rx="0.6" />
      <path d="M6.8 8h2.4M7.4 6.9 6.4 8l1 1.1M8.6 6.9 9.6 8l-1 1.1" strokeWidth="1" />
    </>
  ),
  'p-border': <rect x="3" y="3" width="10" height="10" rx="1" />,
  'p-size': (
    <>
      <path d="M3 13 6.6 3l3.6 10" />
      <path d="M4.3 9.6h4.6" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M6.3 4A6.7 6.7 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a12 12 0 0 1-2 2.4M4.4 5.3A12 12 0 0 0 1.5 8S4 12.5 8 12.5a6.5 6.5 0 0 0 2.1-.35" />
      <line x1="2.5" y1="2.5" x2="13.5" y2="13.5" />
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
  // lucide `rotate-cw`, scaled from the 24px source into our 16px viewBox.
  reload: (
    <>
      <path d="M14 8a6 6 0 1 1-2-4.47L14 5.33" />
      <path d="M14 2v3.33h-3.33" />
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
  share: (
    <>
      <circle cx="4" cy="8" r="1.9" />
      <circle cx="11.6" cy="3.6" r="1.9" />
      <circle cx="11.6" cy="12.4" r="1.9" />
      <line x1="5.7" y1="7" x2="9.9" y2="4.6" />
      <line x1="5.7" y1="9" x2="9.9" y2="11.4" />
    </>
  ),
  pen: (
    <>
      <path d="M3 13l.8-3L10.6 3.2a1.1 1.1 0 0 1 1.6 0l.6.6a1.1 1.1 0 0 1 0 1.6L6 12.2z" />
      <line x1="9.6" y1="4.2" x2="11.8" y2="6.4" />
    </>
  ),
  square: <rect x="3.5" y="3.5" width="9" height="9" rx="1" />,
};

// ⌘K command palette — the mockup's signature surface, wired to real shell
// actions (theme, system view, comments, reload, help, what's new, new board).
// Scoped to shell-doable actions only — in-canvas export lives in the iframe.
function CommandPalette({ open, onClose, actions }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);
  // Keep the keyboard-active row visible while arrowing through a scrolled list.
  useEffect(() => {
    listRef.current
      ?.querySelector('.st-pal-item.is-active')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);
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
        <div className="st-pal-list" ref={listRef}>
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
function StAvatar({ initials, hue, title, pulse }) {
  // Hue rides a custom property so CSS can mix it into the surface (DS avatar
  // recipe: tinted bg + hue border + fg-0 text — solid fill + white text broke
  // the accent-fg contrast rule and washed out in light theme). `pulse` plays
  // the DS motion-presence role (scale+opacity ring) — the AI agent's "live"
  // tell while it's editing.
  return (
    <span
      className={'st-avatar' + (pulse ? ' is-pulsing' : '')}
      style={{ '--av-hue': hue }}
      data-tip={title}
      aria-label={title}
    >
      {initials}
    </span>
  );
}

function Kbd({ children }) {
  return <span className="kbd">{children}</span>;
}

// ───────── Resizable panel grip (DS components-resize-panels contract) ─────────
//
// 8px hit area on a 1px seam; grip dots + accent surface on hover/focus/drag;
// pointer drag (with capture, so moves keep arriving over the iframe), arrow-key
// nudge (8px, ⇧=24px), Home/End to min/max, double-click resets to default.
// Width persists per panel in localStorage.

function usePanelSize(storeKey, { min, max, def }) {
  const clamp = useCallback((v) => Math.min(max, Math.max(min, v)), [min, max]);
  const [w, setWRaw] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(storeKey) || '', 10);
      return Number.isFinite(v) ? clamp(v) : def;
    } catch {
      return def;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storeKey, String(w));
    } catch {}
  }, [storeKey, w]);
  const setW = useCallback(
    (next) => setWRaw((prev) => clamp(typeof next === 'function' ? next(prev) : next)),
    [clamp]
  );
  return { w, setW, min, max, def };
}

function PanelGrip({ label, size, onPointerDown, active, dir = 'ltr' }) {
  const { w, setW, min, max, def } = size;
  // `dir` is grip-relative: 'ltr' (left panel) → ArrowRight widens; 'rtl'
  // (right dock) → ArrowRight narrows, since the seam moves toward the panel.
  const grow = dir === 'rtl' ? -1 : 1;
  return (
    <div
      className={'st-grip' + (active ? ' is-active' : '')}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(w)}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setW(def)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 24 : 8;
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setW((v) => v + step * grow);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setW((v) => v - step * grow);
        } else if (e.key === 'Home') {
          e.preventDefault();
          setW(min);
        } else if (e.key === 'End') {
          e.preventDefault();
          setW(max);
        }
      }}
    >
      <svg className="st-grip-dots" viewBox="0 0 6 18" aria-hidden="true">
        <circle cx="3" cy="3" r="1.1" fill="currentColor" />
        <circle cx="3" cy="9" r="1.1" fill="currentColor" />
        <circle cx="3" cy="15" r="1.1" fill="currentColor" />
      </svg>
    </div>
  );
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
          <StIcon name="chevron-right" className={'st-chev' + (open ? ' is-open' : '')} size={13} />
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
          <StIcon name="chevron-right" className={'st-chev' + (open ? ' is-open' : '')} size={13} />
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

function FileRow({ file, activePath, onOpen, onDelete, openCount: oc, depth, kind, sidecar, dirty }) {
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
  // Stable hook for the desktop E2E harness (data-testid convention — see the
  // `desktop-e2e` skill): canvas rows only, slug derived from the relative path
  // (e.g. `ui/Smoke.tsx` → `canvas-row-ui-smoke`).
  const testId = isCanvas
    ? 'canvas-row-' +
      file.path
        .replace(/^\.[^/]+\//, '') // strip the leading designRoot dot-folder (.design/)
        .replace(CANVAS_EXT_RE, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .toLowerCase()
        .replace(/^-+|-+$/g, '')
    : undefined;
  const row = (
    <button
      type="button"
      role="treeitem"
      data-testid={testId}
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
      {dirty && (
        <span className="st-git-badge" data-kind={dirty} title={`Unsaved (${dirty})`} aria-label={`Unsaved, ${dirty}`}>
          {dirty}
        </span>
      )}
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
  dirtyByPath,
}) {
  const dirty = dirtyByPath?.get(primary.path);
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
        dirty={dirty}
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
          <StIcon name="chevron-right" className={'st-chev' + (open ? ' is-open' : '')} size={13} />
        </span>
        <span className="st-row-name">{displayName(primary.name)}</span>
        {dirty && (
          <span className="st-git-badge" data-kind={dirty} title={`Unsaved (${dirty})`} aria-label={`Unsaved, ${dirty}`}>
            {dirty}
          </span>
        )}
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
  dirtyByPath,
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
            dirtyByPath={dirtyByPath}
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
            dirtyByPath={dirtyByPath}
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
  onRefresh,
  refreshing,
  collapsed,
  onCollapse,
  width,
  resizing,
  dirtyByPath,
  project,
  gitBranch,
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
    <nav
      className={'st-sidebar' + (collapsed ? ' is-collapsed' : '') + (resizing ? ' is-resizing' : '')}
      style={collapsed || !width ? undefined : { width, flexBasis: width }}
      aria-label="Files"
      data-tour="sidebar"
    >
      <div className="st-sb-hd">
        <span className="st-sb-title">Files</span>
        <div className="st-sb-hd-actions">
          <button
            type="button"
            className="st-iconbtn"
            data-tip="New blank brief board"
            aria-label="New blank brief board"
            aria-expanded={creating}
            onClick={() => {
              setNewErr('');
              setCreating((v) => !v);
            }}
          >
            <StIcon name="plus" size={15} />
          </button>
          {onRefresh && (
            <button
              type="button"
              className={'st-iconbtn st-refresh' + (refreshing ? ' is-spinning' : '')}
              data-tip="Refresh files · ⇧⌘R"
              aria-label="Refresh files"
              aria-busy={refreshing || undefined}
              disabled={refreshing}
              onClick={() => onRefresh()}
            >
              <StIcon name="reload" size={15} />
            </button>
          )}
          <span
            className="st-live"
            data-tip={wsConnected ? 'live · file index synced' : 'reconnecting…'}
          >
            <span className={'st-live-dot' + (wsConnected ? ' is-connected' : '')} aria-hidden="true" />
            {htmlShown} / {htmlCount}
          </span>
          {onCollapse && (
            <button
              type="button"
              className="st-iconbtn"
              aria-label="Collapse sidebar"
              data-tip="Collapse sidebar · T"
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
            data-tip="Create · Enter"
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
            onKeyDown={(e) => {
              // Esc — clear the filter first; a second Esc leaves the field.
              if (e.key === 'Escape') {
                e.preventDefault();
                if (search) setSearch('');
                else e.currentTarget.blur();
              }
            }}
            aria-label="Filter files"
          />
          {search ? (
            <button
              className="st-search-clear"
              onClick={() => setSearch('')}
              data-tip="Clear · Esc"
              aria-label="Clear search"
            >
              ×
            </button>
          ) : (
            <Kbd>/</Kbd>
          )}
        </div>
      </div>

      <div className="st-tree" role="tree" aria-label="Project file tree" data-testid="canvas-list">
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
                <StIcon name="chevron-right" className={'st-chev' + (sectionOpen ? ' is-open' : '')} size={13} />
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
                    dirtyByPath={dirtyByPath}
                  />
                ) : (
                  <div className="st-tree-empty">{search ? 'No matches.' : 'Empty.'}</div>
                ))}
            </div>
          );
        })}
      </div>
      {/* Phase 29 (E4) — the project + draft switcher: a compact one-line dock that
          opens UPWARD, sitting directly above the GitHub identity avatar so the two
          form one bottom dock. Renders nothing until the project is a git repo. */}
      <RepoBranchSwitcher project={project} liveBranch={gitBranch} />
      {/* Phase 28 (E3) — GitHub identity as a compact avatar docked at the BOTTOM:
          sign in, connected account + New/Pull/Share, sign out. Self-contained
          (owns its device-code + CreateProject dialogs). Renders nothing in browser. */}
      <IdentityBar />
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
          <span className="sku">MAUDE-DEV-SRV / v{MDCC_VERSION}</span>
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
            <summary>Canvas &amp; panels</summary>
            <ul>
              <li>
                click in tree <span>open canvas (replaces the active one)</span>
              </li>
              <li>
                File ▸ Close canvas <span>clear the stage</span>
              </li>
              <li>
                <kbd>⌘R</kbd> <span>reload canvas</span>
              </li>
              <li>
                <kbd>/</kbd> <span>focus search</span>
              </li>
              <li>
                <kbd>⌘⇧M</kbd> <span>comments panel</span>
              </li>
              <li>
                <kbd>⌘⇧I</kbd> <span>inspector</span>
              </li>
              <li>
                <kbd>?</kbd> <span>keyboard-shortcuts cheat sheet</span>
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
              <li>Open a canvas</li>
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

// ───────── Keyboard-shortcuts overlay (DS components-shortcuts-overlay) ─────
//
// The ? cheat-sheet: dim scrim, shared panel material, four dense mono-headed
// columns, Esc chip in the footer. REAL bindings only — every row here is
// wired in the shell handler, the canvas input-router, or canvas-lib's
// viewport controller. Scope chips mark the rows that need canvas focus.

const SHORTCUT_GROUPS = [
  {
    id: 'canvas',
    label: 'Canvas',
    items: [
      { label: 'Command palette', kbd: '⌘ K' },
      { label: 'New brief board', kbd: 'N' },
      { label: 'Export…', kbd: '⇧ ⌘ E' },
      { label: 'Handoff to production', kbd: '⇧ ⌘ H' },
      { label: 'Reload canvas', kbd: '⌘ R' },
      { label: 'Search files', kbd: '/', alt: '⌘ F' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools · canvas focus',
    items: [
      { label: 'Move · Hand · Comment', kbd: 'V', alt: 'H / C' },
      { label: 'Pen · Highlighter · Eraser', kbd: 'B', alt: 'I / E' },
      { label: 'Shape · Arrow', kbd: 'R', alt: 'A' },
      { label: 'Sticky · Text · Section', kbd: 'N', alt: 'T / ⇧S' },
      { label: 'Undo / redo', kbd: '⌘ Z', alt: '⇧ ⌘ Z' },
    ],
  },
  {
    id: 'selection',
    label: 'Selection & zoom',
    items: [
      { label: 'Select element', kbd: '⌘ click' },
      { label: 'Add to selection', kbd: '⌘ ⇧ click' },
      { label: 'Preview deepest', kbd: '⌘ hover' },
      { label: 'Deselect · close menu', kbd: 'Esc' },
      { label: 'Zoom in / out', kbd: '⌘ +', alt: '⌘ −' },
      { label: 'Fit · actual size', kbd: '⌘ 0', alt: '⌘ 1' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { label: 'Project tree', kbd: 'T' },
      { label: 'Design system view', kbd: 'S' },
      { label: 'Inspector', kbd: '⌘ ⇧ I' },
      { label: 'Comments sidebar', kbd: '⌘ ⇧ M' },
      { label: 'Annotations', kbd: '⇧ P' },
      { label: 'Hidden files', kbd: 'H' },
      { label: 'This cheat sheet · help', kbd: '?', alt: 'F1' },
    ],
  },
];

function ShortcutCombo({ kbd, alt }) {
  const combo = (s, key) => (
    <span className="so-combo" key={key}>
      {s.split(' ').map((k, i) => (
        <Kbd key={`${k}-${i}`}>{k}</Kbd>
      ))}
    </span>
  );
  return (
    <span className="so-combos">
      {combo(kbd, 'main')}
      {alt
        ? alt.split(' / ').map((a) => (
            <Fragment key={a}>
              <span className="so-or">/</span>
              {combo(a, a)}
            </Fragment>
          ))
        : null}
    </span>
  );
}

function ShortcutsOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const bindings = SHORTCUT_GROUPS.reduce((n, g) => n + g.items.length, 0);
  return (
    <div
      className="st-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="so-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="so-overlay-hd">
          <span className="so-title">Keyboard shortcuts</span>
          <span className="so-trigger">
            press <Kbd>?</Kbd> to open
          </span>
        </div>
        <div className="so-columns">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.id} className={'so-section so-section--' + g.id}>
              <h3 className="so-section-hd">{g.label}</h3>
              <dl className="so-list">
                {g.items.map((it) => (
                  <div key={it.label} className="so-pair">
                    <dt>{it.label}</dt>
                    <dd>
                      <ShortcutCombo kbd={it.kbd} alt={it.alt} />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="so-overlay-ft">
          <span>
            close with <Kbd>Esc</Kbd>
          </span>
          <span className="so-count">
            {bindings} bindings · {SHORTCUT_GROUPS.length} groups
          </span>
        </div>
      </div>
    </div>
  );
}

// ───────── Menubar (CV-01/CV-08 top chrome) ─────────
//
// Replaces the legacy `.header` action-button toolbar. Mirrors the shared
// Menubar component from .design/ui/Canvas Viewport.html — brand · menus ·
// status. View dropdown is wired to the panels + zoom that exist today;
// Presentation Mode stays phase-tagged until it ships.

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

function ViewDropdown({ panels, onToggle, onClose, onZoom, hasCanvas }) {
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
          {p.phase ? (
            <span className="st-dd-phase">{p.phase}</span>
          ) : p.shortcut ? (
            <Kbd>{p.shortcut}</Kbd>
          ) : null}
        </button>
      ))}
      <div className="st-dd-sep" />
      <div className="st-dd-hd">Zoom</div>
      {[
        { op: 'in', label: 'Zoom In', shortcut: '⌘ +' },
        { op: 'out', label: 'Zoom Out', shortcut: '⌘ −' },
        { op: 'fit', label: 'Fit to Screen', shortcut: '⌘ 0' },
        { op: 'actual', label: 'Actual Size · 100 %', shortcut: '⌘ 1' },
      ].map((z) => (
        <button
          key={z.label}
          type="button"
          role="menuitem"
          className="st-dd-item"
          aria-disabled={hasCanvas ? undefined : 'true'}
          onClick={() => {
            if (!hasCanvas) return;
            onZoom?.(z.op);
            onClose();
          }}
        >
          <span className="st-dd-lead">
            <span className="st-dd-check" />
            <span>{z.label}</span>
          </span>
          <Kbd>{z.shortcut}</Kbd>
        </button>
      ))}
    </div>
  );
}

// Help dropdown — cheat sheet · deep help · tour · what's new.
// Shared menubar dropdown — File / Edit / Selection / Tools / Help all render
// the identical {id,label,shortcut,sep?,disabled?} list over the same button
// skeleton, differing only in aria-label, left offset, and an optional header.
// (ViewDropdown stays separate — its checkbox/phase/zoom-op rows genuinely
// diverge.) Per the /flow:done simplifier pass — collapsed 5 near-dupes.
function DropdownMenu({ label, left, header, items, onAction, onClose }) {
  useDropdownClose(onClose);
  return (
    <div className="st-dropdown" role="menu" aria-label={label} style={{ left }}>
      {header ? <div className="st-dd-hd">{header}</div> : null}
      {items.map((it, i) =>
        it.sep ? (
          <div key={'s' + i} className="st-dd-sep" />
        ) : (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            className="st-dd-item"
            aria-disabled={it.disabled ? 'true' : undefined}
            onClick={() => {
              if (it.disabled) return;
              onAction(it.id);
              onClose();
            }}
          >
            <span className="st-dd-lead">
              <span className="st-dd-check" />
              <span>{it.label}</span>
            </span>
            {it.shortcut ? <Kbd>{it.shortcut}</Kbd> : null}
          </button>
        )
      )}
    </div>
  );
}

function HelpDropdown({ onAction, onClose }) {
  return (
    <DropdownMenu
      label="Help"
      left={320}
      onAction={onAction}
      onClose={onClose}
      items={[
        { id: 'shortcuts', label: 'Keyboard shortcuts', shortcut: '?' },
        { id: 'help', label: 'Help · commands & flows', shortcut: 'F1' },
        { sep: true },
        { id: 'tour', label: 'Take the tour' },
        // The collab "how sharing works" course teaches the plain-words Save →
        // Publish → Pull cycle — a non-technical, native-app concern. A web-studio
        // dev already knows git, so it's hidden there (DDR-119).
        ...(isNativeApp() ? [{ id: 'collab-tour', label: 'How sharing works' }] : []),
        ...(isNativeApp() ? [{ id: 'readiness', label: 'Check AI editing readiness…' }] : []),
        { id: 'whatsnew', label: "What's new" },
      ]}
    />
  );
}

function SelectionDropdown({ onAction, onClose }) {
  return (
    <DropdownMenu
      label="Selection"
      left={214}
      onAction={onAction}
      onClose={onClose}
      items={[
        { id: 'deselect-all', label: 'Deselect all', shortcut: 'Esc' },
        { id: 'select-all-annotations', label: 'Select all annotations', shortcut: '⌘ ⇧ A' },
      ]}
    />
  );
}

function ToolsDropdown({ onAction, onClose }) {
  // Mirrors DEFAULT_TOOLS in apps/studio/use-tool-mode.tsx — kept in sync by
  // hand because the menubar lives in the dev-server shell (no shared bundle
  // with the canvas iframes).
  return (
    <DropdownMenu
      label="Tools"
      left={290}
      header="Tool palette"
      onAction={onAction}
      onClose={onClose}
      items={[
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
      ]}
    />
  );
}

// Plan C follow-up — File + Edit menus, previously inert. Both dispatch to real
// shell flows (File) or the in-canvas undo stack / selection bridges (Edit).
function FileDropdown({ onAction, onClose, hasCanvas }) {
  return (
    <DropdownMenu
      label="File"
      left={40}
      onAction={onAction}
      onClose={onClose}
      items={[
        // Bare N — the browser reserves ⌘N (New Window) and never delivers it.
        { id: 'new', label: 'New canvas…', shortcut: 'N' },
        { id: 'export', label: 'Export…', shortcut: '⇧⌘E' },
        { id: 'handoff', label: 'Handoff to production', shortcut: '⇧⌘H' },
        { sep: true },
        { id: 'reload', label: 'Reload canvas', shortcut: '⌘R', disabled: !hasCanvas },
        { id: 'close', label: 'Close canvas', disabled: !hasCanvas },
      ]}
    />
  );
}

function EditDropdown({ onAction, onClose }) {
  return (
    <DropdownMenu
      label="Edit"
      left={90}
      onAction={onAction}
      onClose={onClose}
      items={[
        { id: 'undo', label: 'Undo', shortcut: '⌘Z' },
        { id: 'redo', label: 'Redo', shortcut: '⇧⌘Z' },
        { sep: true },
        { id: 'deselect-all', label: 'Deselect all', shortcut: 'Esc' },
        { id: 'select-all-annotations', label: 'Select all annotations', shortcut: '⇧⌘A' },
      ]}
    />
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
  changesOpen,
  changesCount,
  onToggleChanges,
  onOpenSystem,
  sidebarOpen,
  onToggleSidebar,
  showHidden,
  onToggleShowHidden,
  onOpenHelp,
  onOpenShortcuts,
  onStartTour,
  onStartCollabTour,
  annotationsVisible,
  onToggleAnnotations,
  minimapVisible,
  onToggleMinimap,
  zoomCtlVisible,
  onToggleZoomCtl,
  presentMode,
  onTogglePresent,
  postToActiveCanvas,
  onOpenWhatsNew,
  onOpenReadiness,
  whatsNewCount,
  artboardCount = 0,
  presence = null,
  inspectorOpen,
  inspectorTab,
  onToggleInspector,
  onOpenLayers,
  assistantOpen,
  onToggleAssistant,
  assistantBusy,
  assistantUnseen,
  onNewCanvas,
  onOpenExport,
  onReload,
  onCloseCanvas,
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
      id: 'changes',
      label: changesCount > 0 ? `Changes · ${changesCount} unsaved` : 'Changes',
      shortcut: '⌘ ⇧ G',
      checked: changesOpen,
      disabled: false,
    },
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
    {
      id: 'layers',
      label: 'Layers',
      shortcut: '',
      checked: inspectorOpen && inspectorTab === 'layers',
      disabled: false,
    },
    {
      id: 'inspector',
      label: 'Inspector',
      shortcut: '⌘ ⇧ I',
      checked: inspectorOpen,
      disabled: false,
    },
    // Phase 31 (DDR-123) — native-only ACP chat sidepanel.
    ...(isNativeApp()
      ? [
          {
            id: 'assistant',
            label: 'Assistant',
            shortcut: '⌘ ⇧ A',
            checked: assistantOpen,
            disabled: false,
          },
        ]
      : []),
    {
      id: 'annotate',
      label: 'Annotations',
      shortcut: '⇧ P',
      checked: annotationsVisible,
      disabled: false,
    },
    {
      id: 'minimap',
      label: 'Minimap',
      shortcut: '',
      checked: minimapVisible,
      disabled: !activePath || isSystem,
    },
    {
      id: 'zoomctl',
      label: 'Zoom controls',
      shortcut: '',
      checked: zoomCtlVisible,
      disabled: !activePath || isSystem,
    },
    {
      id: 'present',
      label: 'Presentation Mode',
      shortcut: '',
      checked: presentMode,
      disabled: !activePath || isSystem,
    },
  ];

  const DROPDOWN_MENUS = ['file', 'edit', 'view', 'selection', 'tools', 'help'];
  function onMenuClick(key) {
    if (DROPDOWN_MENUS.includes(key)) {
      setOpenMenu(openMenu === key ? null : key);
    }
  }

  // Keyboard menubar (native-menu parity): while a dropdown is open, ↑/↓ rove
  // its items, ←/→ switch to the adjacent menu, Home/End jump, Esc returns
  // focus to the trigger (useDropdownClose handles the close itself).
  useEffect(() => {
    if (!openMenu || !DROPDOWN_MENUS.includes(openMenu)) return;
    // Move focus into the menu so ↑/↓ work immediately after a click.
    const t = setTimeout(() => {
      document
        .querySelector('.st-dropdown [role="menuitem"]:not([aria-disabled="true"])')
        ?.focus();
    }, 0);
    function onKey(e) {
      const items = [
        ...document.querySelectorAll('.st-dropdown [role="menuitem"]:not([aria-disabled="true"])'),
      ];
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const cur = DROPDOWN_MENUS.indexOf(openMenu);
        setOpenMenu(DROPDOWN_MENUS[(cur + dir + DROPDOWN_MENUS.length) % DROPDOWN_MENUS.length]);
      } else if (e.key === 'Escape') {
        document.querySelector('.st-menu[aria-expanded="true"]')?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu, setOpenMenu]);

  return (
    <header className="st-menubar" role="menubar" aria-label="Application menubar">
      <span className="st-brand" data-tour="brand">
        <span className="st-brand-mark">
          <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" aria-hidden="true"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" fill="currentColor" /></svg>
        </span>
        <span className="st-brand-name">maude</span>
      </span>
      <nav className="st-menus" aria-label="Application menus" data-tour="menus">
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
          hasCanvas={!!activePath}
          onAction={(id) => {
            if (id === 'new') onNewCanvas?.();
            else if (id === 'export') onOpenExport?.('export');
            else if (id === 'handoff') onOpenExport?.('handoff');
            else if (id === 'reload') onReload?.();
            else if (id === 'close') onCloseCanvas?.();
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
            else if (id === 'changes') onToggleChanges();
            else if (id === 'comments') onToggleComments();
            else if (id === 'hidden') onToggleShowHidden();
            else if (id === 'annotate') onToggleAnnotations();
            else if (id === 'inspector') onToggleInspector();
            else if (id === 'assistant') onToggleAssistant?.();
            else if (id === 'layers') onOpenLayers?.();
            else if (id === 'minimap') onToggleMinimap?.();
            else if (id === 'zoomctl') onToggleZoomCtl?.();
            else if (id === 'present') onTogglePresent?.();
          }}
          onZoom={(op) => postToActiveCanvas({ dgn: 'zoom', op })}
          hasCanvas={!!activePath && !isSystem}
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
      {openMenu === 'help' && (
        <HelpDropdown
          onAction={(id) => {
            if (id === 'shortcuts') onOpenShortcuts?.();
            else if (id === 'help') onOpenHelp?.();
            else if (id === 'tour') onStartTour?.();
            else if (id === 'collab-tour') onStartCollabTour?.();
            else if (id === 'readiness') onOpenReadiness?.();
            else if (id === 'whatsnew') onOpenWhatsNew?.();
          }}
          onClose={() => setOpenMenu(null)}
        />
      )}
      <div className="st-mb-right" data-tour="status">
        {presence ? <div className="st-presence">{presence}</div> : null}
        {isNativeApp() && (
          <button
            type="button"
            className="st-assistant"
            data-active={assistantOpen ? 'true' : 'false'}
            data-busy={assistantBusy ? 'true' : 'false'}
            data-unseen={assistantUnseen ? 'true' : 'false'}
            aria-label={`Assistant${assistantBusy ? ' — working' : assistantUnseen ? ' — new reply' : ''}`}
            data-tip="Assistant  ⌘⇧A"
            onClick={onToggleAssistant}
          >
            <StIcon name="sparkle" size={15} />
          </button>
        )}
        <button
          type="button"
          className="st-whatsnew"
          data-tour="whatsnew"
          data-unseen={whatsNewCount > 0 ? 'true' : 'false'}
          aria-label={`What's new${whatsNewCount > 0 ? ` — ${whatsNewCount} unseen` : ''}`}
          data-tip="What's new"
          onClick={onOpenWhatsNew}
        >
          <StIcon name="megaphone" size={15} />
        </button>
        <span className="st-stamp">{stamp}</span>
        <span className="st-mb-file" title={activePath || ''}>
          {fileLabel}
        </span>
        <span className="st-mb-sep" />
        <span className="st-mb-count" data-tip="Artboards in the open canvas">
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
  loadingPath,
  onIframeLoad,
}) {
  return (
    <div className="viewport st-stage" data-tour="viewport">
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
            Opening a file replaces the active canvas. <Kbd>⌘R</Kbd> reloads it; File ▸ Close
            canvas clears the stage.
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
            data-testid={t.path === activePath ? 'canvas-frame' : undefined}
            onLoad={() => onIframeLoad?.(t.path)}
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
      {loadingPath && loadingPath === activePath && (
        // DS skeletons recipe — calm .skel pulse while the canvas-shell compiles
        // the TSX. Cleared by the iframe's dgn:'loaded' message (or the onLoad
        // fallback timer for legacy .html canvases that never post it).
        <div className="st-canvas-loading" aria-hidden="true">
          <div className="st-skel-card">
            <div className="st-skel-cap st-mono">compiling canvas…</div>
            <span className="skel st-skel-thumb" />
            <span className="skel st-skel-line" style={{ width: '72%' }} />
            <span className="skel st-skel-line" style={{ width: '46%' }} />
          </div>
        </div>
      )}
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
        <span className="sv-sku">MAUDE-DSN/01</span>
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
  changesCount = 0,
  unpushed = 0,
  changesOpen = false,
  onOpenChanges,
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

      {/* Selection is meaningless without an open canvas — a stale _active.json
          selection used to leave a ghost SELECTED chip on the empty shell. */}
      {activePath && selected && selected.selector && !isSystem && (
        <span className="st-sb-slot st-sb-sel" role="group" aria-label="Selected element">
          <span className="lbl">selected</span>
          <span className="val" title={title}>
            {text}
          </span>
          <button
            type="button"
            className="st-sb-sel-clear"
            onClick={onClearSelected}
            data-tip="Clear · Esc inside iframe"
            data-tip-pos="top"
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

      {/* Phase 28 — changes count, click to open the Changes panel (⌘⇧G). */}
      {onOpenChanges && (
        <button
          type="button"
          className={
            'st-sb-slot st-sb-changes' +
            (changesOpen ? ' is-open' : '') +
            (changesCount > 0 ? ' has-changes' : unpushed > 0 ? ' has-unpushed' : '')
          }
          onClick={onOpenChanges}
          data-testid="open-changes"
          data-tip="Open Changes · ⌘⇧G"
          data-tip-pos="top"
          aria-label="Open Changes panel"
          aria-pressed={changesOpen}
        >
          <span className="st-sb-changes-dot" aria-hidden="true" />
          <span className="lbl">changes</span>
          <span className="val">
            {changesCount > 0
              ? `${changesCount} unsaved`
              : unpushed > 0
                ? `${unpushed} to publish`
                : 'all saved'}
          </span>
        </button>
      )}

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
        data-tip={`Switch to ${nextTheme} theme`}
        data-tip-pos="top"
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
  width,
  resizing,
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
    <aside
      className={'st-rpanel' + (resizing ? ' is-resizing' : '')}
      style={width ? { width, flexBasis: width } : undefined}
      aria-label="Comments"
    >
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
// Phase 32 (Task 1) — auto-update notice. Shown after the shell has downloaded +
// staged a newer build in the background. Non-blocking: "Restart now" applies it,
// "Later" dismisses (the next focus/4h check re-stages and re-surfaces it).
function UpdateBanner({ update, onDismiss }) {
  const [restarting, setRestarting] = useState(false);
  if (!update) return null;
  const ver = update.version ? ` (v${update.version})` : '';
  return (
    <div role="status" aria-live="polite" className="st-banner st-banner--info">
      <span className="st-banner-dot" aria-hidden="true" />
      <span>Maude updated{ver} · restart to apply</span>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={restarting}
        onClick={() => {
          setRestarting(true);
          restartToUpdate().catch(() => setRestarting(false));
        }}
      >
        {restarting ? 'Restarting…' : 'Restart now'}
      </button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
        Later
      </button>
    </div>
  );
}

function SyncBanner({ status }) {
  // Plan C follow-up — the banner overlapped the menubar and wasn't dismissable.
  // Dismissal is keyed on the connection state, so a transition (reconnect flash,
  // escalation to offline-long) re-surfaces it; a stable state stays hidden.
  const [dismissedKey, setDismissedKey] = useState(null);
  if (!status || status.linked === false) return null;
  // DDR-060 / 9.1-D — the "linked but 0 syncable" state is surfaced in the
  // status bar (sb-sync slot), NOT as a floating banner. This component owns
  // the transient offline / reconnect-flash banner (Task 8) plus the DDR-102
  // rejected-docs chip and divergence-resolution toast.
  if (status.notSyncable) return null;
  const { state, queuedOps, flash, conflicts } = status;
  const showFlash = flash === 'synced';
  const offline = state === 'offline' || state === 'offline-long';
  // DDR-102 — per-doc rollup + the latest divergence notice (additive fields;
  // an old payload without them renders exactly the pre-DDR-102 banner).
  const rejected = status.docs?.rejected ?? 0;
  const lastDiverged = Array.isArray(conflicts)
    ? [...conflicts].reverse().find((c) => c.kind === 'cold-start-diverged')
    : null;
  if (!offline && !showFlash && !lastDiverged && rejected === 0) return null;

  // One banner at a time — priority: reconnect flash > offline > divergence
  // toast > rejected chip. Dismissal is keyed per state so a new event
  // (another conflict, a changed rejected count) re-surfaces it.
  let variant;
  let text;
  let dismissKey;
  if (showFlash) {
    variant = 'success';
    text = 'Synced with hub';
    dismissKey = `${state}:flash`;
  } else if (offline) {
    const conflictNote =
      conflicts && conflicts.length > 0 ? ` (${conflicts.length} conflict notice(s))` : '';
    if (state === 'offline-long') {
      variant = 'error';
      text = `Long offline — ${queuedOps} edit(s) queued. Consider \`git commit && git push\` as backup.${conflictNote}`;
    } else {
      variant = 'warn';
      text = `Working offline · ${queuedOps} edit(s) queued · will sync when the hub reconnects.${conflictNote}`;
    }
    dismissKey = `${state}:offline`;
  } else if (lastDiverged) {
    // DDR-102 fail-closed: a snapshotFailed conflict means the hub-wins overwrite
    // was REFUSED (local kept) because _history couldn't be written — surface it
    // as an error, not a routine "kept newest" notice.
    if (lastDiverged.snapshotFailed) {
      variant = 'error';
      text = `Diverged on ${lastDiverged.slug}: kept local — the history snapshot FAILED, so the overwrite was refused. Check disk space / .design/_history write access.`;
    } else {
      variant = 'warn';
      text = `Diverged on ${lastDiverged.slug}: kept the ${
        lastDiverged.winner === 'local' ? 'local (newer)' : 'hub'
      } version — the other is snapshotted in history → /design:rollback ${lastDiverged.slug}`;
    }
    dismissKey = `diverged:${lastDiverged.slug}:${lastDiverged.at}`;
  } else {
    variant = 'warn';
    text = `${rejected} canvas(es) not syncing — the hub rejected auth. Details: maude design status`;
    dismissKey = `rejected:${rejected}`;
  }
  if (dismissedKey === dismissKey) return null;

  return (
    <div role="status" aria-live="polite" className={`st-banner st-banner--${variant}`}>
      <span className="st-banner-dot" aria-hidden="true" />
      <span>{text}</span>
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

// ---------- CSS knobs (Phase 12.2, DDR-104) — interactive panel ----------
//
// Hybrid vocabulary (friendly collapsible section headers + CSS-named rows),
// per-field DS-token quick-pick, nested box-model widget, per-corner radius,
// per-row provenance (token-bound / raw-override / inherited), per-field save
// state, and two escape hatches: custom CSS property (via /_api/edit-css) +
// custom HTML attribute (via /_api/edit-attr). Each knob pre-fills from the
// AUTHORED inline value (`el.authored`); the resolved `computed` value is a
// faint placeholder only (NOT editable — the v1 UX bug). Ported from the
// critic-approved + user-iterated `.design/ui/Studio.tsx` spec.

const CSS_DISPLAYS = ['block', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline', 'none'];
const CSS_FLEX_DIR = ['row', 'row-reverse', 'column', 'column-reverse'];
const CSS_ALIGN = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'];
const CSS_JUSTIFY = [
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly',
];
const CSS_WEIGHTS = ['300', '400', '500', '600', '700', '800'];
const CSS_FONTS = [
  'inherit',
  'system-ui',
  'sans-serif',
  'serif',
  'monospace',
  'Inter',
  'Inter Tight',
  'JetBrains Mono',
];
const CSS_BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'];
const CSS_UNITS = ['px', 'rem', 'em', '%', 'vw', 'vh', 'auto'];
// Properties whose bare-number value is unitless — never append a unit suffix.
const CSS_UNITLESS = new Set(['line-height', 'opacity', 'font-weight', 'z-index', 'flex-grow', 'flex-shrink', 'order']);
// #2 — Figma-style property prefix inside numeric fields: a small glyph (icon) or
// a mono letter (t). Only where it reads cleanly; selects/colours keep their own.
const PROP_LEAD = {
  'font-size': { icon: 'p-size' },
  'line-height': { icon: 'p-lineheight' },
  'letter-spacing': { icon: 'p-letterspacing' },
  gap: { icon: 'p-gap' },
  width: { t: 'W' },
  height: { t: 'H' },
  'max-width': { t: 'W' },
  'border-radius': { icon: 'p-corner' },
  'border-width': { icon: 'p-border' },
  opacity: { icon: 'p-opacity' },
};
const CSS_ALIGN_OPTS = ['left', 'center', 'right', 'justify'];

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

// ---- Colour math for the HSV picker (#6 — Figma-style colour control) ----
const clamp01 = (n) => Math.min(1, Math.max(0, n));
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
function rgbToHsv({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
function hsvToRgb({ h, s, v }) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// Round bare px to whole numbers for the placeholder hint; pass other values through.
function cssHint(v) {
  if (!v) return '';
  const m = /^(-?\d*\.?\d+)px$/.exec(v);
  return m ? `${Math.round(Number.parseFloat(m[1]))}px` : v;
}

// Split "16px" → { n:"16", unit:"px" }; "auto"→{n:"",unit:"auto"}; var()/raw → {n:raw,unit:""}.
function cssSplitUnit(v) {
  if (!v) return { n: '', unit: 'px' };
  const t = v.trim();
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em|%|vw|vh)?$/.exec(t);
  if (m) return { n: m[1], unit: m[2] || 'px' };
  if (t === 'auto') return { n: '', unit: 'auto' };
  return { n: t, unit: '' };
}

// Phase 12.2/12.3 — the WS `selected` echo is the server's projection
// (SelectedElement) and LACKS the client-only DOM fields the CSS knobs pre-fill
// from (`authored` / `computed` inline style + `customStyles` / `attrs` — all
// captured in the iframe, never round-tripped through the server). When the echo
// is for the SAME element we already hold locally, preserve those fields instead
// of clobbering them to empty (else the server round-trip wipes the custom-CSS /
// custom-attr rows + computed readout right after selection).
function mergeSelClientFields(incoming, prev) {
  if (!incoming || Array.isArray(incoming) || Array.isArray(prev) || !prev) return incoming;
  if (!incoming.id || incoming.id !== prev.id) return incoming;
  return {
    ...incoming,
    authored: incoming.authored ?? prev.authored,
    computed: incoming.computed ?? prev.computed,
    customStyles: incoming.customStyles ?? prev.customStyles,
    attrs: incoming.attrs ?? prev.attrs,
  };
}

// Resolve the active canvas's DS tokens CSS path (mirrors canvas-url.js / DDR-093):
// the canvas's declared DS wins, else designSystems[0], else the legacy default.
function cssTokensRelFor(file, cfg) {
  const ds0 = cfg?.designSystems?.[0];
  const name = file ? cfg?.canvasDesignSystems?.[file] : null;
  const ds = (name && cfg?.designSystems?.find((d) => d.name === name)) || ds0;
  return ds?.tokensCssRel || cfg?.tokensCssRel || ds0?.tokensCssRel || '';
}

// The active canvas's DS NAME (mirrors cssTokensRelFor's resolution order).
function activeDsNameFor(file, cfg) {
  const byCanvas = file ? cfg?.canvasDesignSystems?.[file] : null;
  return byCanvas || cfg?.defaultDesignSystem || cfg?.designSystems?.[0]?.name || null;
}

// Parse a DS tokens CSS body → token names grouped by family + a name→value map
// (resolving one level of var() aliasing so the popover renders real swatches +
// values). Phase 12.3 (W2.1/W3 multi-DS).
function parseTokensCss(css) {
  const raw = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/gi)) {
    if (!(m[1] in raw)) raw[m[1]] = m[2].trim();
  }
  const vals = {};
  for (const name of Object.keys(raw)) {
    const v = raw[name];
    const ref = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(v);
    vals[name] = ref && raw[ref[1]] ? raw[ref[1]] : v;
  }
  const names = Object.keys(raw);
  const g = (re) => names.filter((n) => re.test(n));
  // Colours detected by VALUE, not name — so EVERY colour token a DS defines is
  // offered (the name-prefix list dropped many). A token is a colour if its
  // resolved value reads as one. (#3 — "see all tokens the DS has".)
  const isColor = (v) =>
    /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|color\()/i.test(v) ||
    /^(transparent|currentcolor|white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|cyan|magenta|teal|navy|maroon|olive|lime|aqua|silver|gold)$/i.test(
      v
    );
  return {
    color: names.filter((n) => isColor(vals[n])),
    space: g(/^--space-/),
    radius: g(/^--radius-/),
    type: g(/^--type-/),
    shadow: g(/^--shadow-/),
    lh: g(/^--lh-/),
    vals,
  };
}

// Fetch + parse the tokens CSS of EVERY design system in the config (main
// origin), so the token popover can offer tokens grouped per DS (W3 multi-DS
// feedback). The active canvas's DS is ordered first. Returns
// `[{ name, color, space, radius, type, shadow, lh, vals }]`.
function useAllDsTokens(cfg, designRel, activeName) {
  const list = cfg?.designSystems || [];
  // A stable key so the effect only re-fetches when the DS set / paths change.
  const sig = list.map((d) => `${d.name}:${d.tokensCssRel}`).join('|');
  const [byDs, setByDs] = useState([]);
  useEffect(() => {
    if (!list.length) return undefined;
    let cancelled = false;
    Promise.all(
      list.map(async (ds) => {
        if (!ds.tokensCssRel) return null;
        try {
          const r = await fetch(`/${designRel}/${ds.tokensCssRel}`);
          const css = r.ok ? await r.text() : '';
          return { name: ds.name, ...parseTokensCss(css) };
        } catch {
          return null;
        }
      })
    ).then((res) => {
      if (cancelled) return;
      const got = res.filter(Boolean);
      // Active DS first, rest in config order.
      got.sort((a, b) => (a.name === activeName ? -1 : b.name === activeName ? 1 : 0));
      setByDs(got);
    });
    return () => {
      cancelled = true;
    };
  }, [sig, designRel, activeName]);
  return byDs;
}

// Phase 12.3 (#4) — the "Custom" tab of the colour popover: a normal colour
// input (native OS picker via a large swatch) + a hex/value text field. Applies
// LIVE as you adjust (onApply), so the canvas previews while the picker is open.
// #6 — the unified colour picker (Custom tab). A real HSV control: a
// saturation/value square + a hue slider + a hex field + an eyedropper — the
// Figma model. Replaces BOTH the old native <input type="color"> on the swatch
// AND the simple hex field, so colours have ONE popover (Custom · Variables).
// `seed` is the resolved current colour (hex). Drag updates the picker UI live;
// commits on pointer-up (one source write per drag); the hex field commits on
// blur/Enter.
function ColorPicker({ seed, onApply }) {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(seed || '#000000')));
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const svRef = useRef(null);
  const hueRef = useRef(null);
  // Reseed when the selection's colour changes (but not while the user drags).
  const seedRef = useRef(seed);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reseed on seed change only.
  useEffect(() => {
    if (seed && seed !== seedRef.current) {
      seedRef.current = seed;
      setHsv(rgbToHsv(hexToRgb(seed)));
    }
  }, [seed]);
  const hex = rgbToHex(hsvToRgb(hsv));

  const dragSV = (e) => {
    e.preventDefault();
    const r = svRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = hsvRef.current.h;
    const move = (ev) => {
      setHsv({
        h,
        s: clamp01((ev.clientX - r.left) / r.width),
        v: clamp01(1 - (ev.clientY - r.top) / r.height),
      });
    };
    move(e);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      onApply(rgbToHex(hsvToRgb(hsvRef.current)));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  const dragHue = (e) => {
    e.preventDefault();
    const r = hueRef.current?.getBoundingClientRect();
    if (!r) return;
    const { s, v } = hsvRef.current;
    const move = (ev) => {
      setHsv({ h: clamp01((ev.clientX - r.left) / r.width) * 360, s, v });
    };
    move(e);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      onApply(rgbToHex(hsvToRgb(hsvRef.current)));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  const eyedrop = async () => {
    try {
      // EyeDropper is Chromium-only; guarded.
      const ED = window.EyeDropper;
      if (!ED) return;
      const res = await new ED().open();
      if (res?.sRGBHex) {
        setHsv(rgbToHsv(hexToRgb(res.sRGBHex)));
        onApply(res.sRGBHex);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="st-cp-cpick">
      <button
        type="button"
        ref={svRef}
        className="st-cp-cpick-sv"
        aria-label="saturation and value"
        style={{ background: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={dragSV}
      >
        <span className="st-cp-cpick-svwhite" />
        <span className="st-cp-cpick-svblack" />
        <span
          className="st-cp-cpick-knob"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
        />
      </button>
      <div className="st-cp-cpick-controls">
        {window.EyeDropper ? (
          <button
            type="button"
            className="st-cp-cpick-eye"
            aria-label="pick from screen"
            title="eyedropper"
            onClick={eyedrop}
          >
            <StIcon name="eyedropper" size={14} />
          </button>
        ) : null}
        <button
          type="button"
          ref={hueRef}
          className="st-cp-cpick-hue"
          aria-label="hue"
          onPointerDown={dragHue}
        >
          <span className="st-cp-cpick-huethumb" style={{ left: `${(hsv.h / 360) * 100}%` }} />
        </button>
      </div>
      <input
        className="st-cp-fin"
        type="text"
        value={hex}
        aria-label="hex value"
        onChange={(e) => {
          const v = e.target.value;
          if (/^#?[0-9a-f]{6}$/i.test(v)) setHsv(rgbToHsv(hexToRgb(v)));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onApply(e.currentTarget.value);
        }}
        onBlur={(e) => onApply(e.currentTarget.value)}
      />
    </div>
  );
}

// Phase 12.3 (W2.1) — token picker as a Figma-style popover instead of a native
// <select>. `kind='color'` renders a swatch grid (resolved DS color values);
// `kind='value'` a variable list (pretty name + resolved value, à la Figma's
// variable picker). Picking commits `var(--token)`. Portals to <body> +
// fixed-positions from the trigger rect so the panel's overflow never clips it.
function TokenPopover({ kind, groups, current, onPick, label, swatchBg, seedHex, activeDs }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  // Phase 12.3 (#4) — colour popover gets two tabs: a normal colour input
  // (Custom) + the DS variables swatch list (Variables). Token-able non-colour
  // popovers stay single-mode.
  const [mode, setMode] = useState('custom');
  const [query, setQuery] = useState('');
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const bound = typeof current === 'string' && /var\(\s*--/.test(current);
  const isOn = (n) => current === `var(${n})`;
  const pretty = (n) => n.replace(/^--/, '').replace(/-/g, ' ');
  const gs = groups || [];
  const total = gs.reduce((s, g) => s + (g.names?.length || 0), 0);
  const showDsHeaders = gs.length > 1; // group by DS only when there's >1
  // Search filter over the token name + resolved value, per group.
  const q = query.trim().toLowerCase();
  const filteredGs = !q
    ? gs
    : gs
        .map((g) => ({
          ...g,
          names: (g.names || []).filter(
            (n) =>
              pretty(n).toLowerCase().includes(q) ||
              n.toLowerCase().includes(q) ||
              (g.vals?.[n] || '').toLowerCase().includes(q)
          ),
        }))
        .filter((g) => g.names.length);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 224;
      const MAXH = 300;
      let left = Math.min(r.right - W, window.innerWidth - W - 8);
      if (left < 8) left = 8;
      const below = window.innerHeight - r.bottom;
      const top = below > MAXH + 8 ? r.bottom + 4 : Math.max(8, r.top - MAXH - 4);
      setPos({ left, top, width: W, maxHeight: MAXH });
    };
    place();
    const onDoc = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const dismiss = () => setOpen(false);
    // The popover is fixed-positioned from the trigger rect, so a scroll of the
    // PANEL detaches it → dismiss. But scrolling INSIDE the popover (its own
    // overflow list) must NOT close it (the user couldn't scroll the variables).
    const onScroll = (e) => {
      if (popRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Pick a token. #3 — apply CORRECTLY across design systems: a token from the
  // canvas's OWN active DS commits `var(--token)` (round-trips + resolves right);
  // a token from ANOTHER DS commits its RESOLVED value (literal), because
  // `var(--token)` would resolve against the canvas's DS scope and paint the WRONG
  // colour. So what you click is always what's applied ("natvrdo").
  // SECURITY (ethical-hacker A3) — a cross-DS token value is committed as a
  // LITERAL, and its source is a (possibly hub-pushed, untrusted) tokens CSS.
  // A colour-shaped value can still smuggle a fetch primitive (e.g.
  // `rgb(1 2 3) url(//x)` passes the colour sniff). Refuse to write a literal
  // carrying url()/image-set()/expression()/@import — fall back to var(), which
  // resolves against the CANVAS's own DS (never the attacker's value).
  const UNSAFE_TOKEN_VALUE = /url\(|image-set\(|cross-fade\(|element\(|expression\(|@import|javascript:/i;
  const pickFrom = (ds, n, resolved) => {
    if (activeDs && ds && ds !== activeDs && resolved && !UNSAFE_TOKEN_VALUE.test(resolved)) {
      onPick(resolved);
    } else {
      onPick(`var(${n})`);
    }
    setOpen(false);
  };
  // Custom colour / hex applies LIVE without closing, so the user can keep
  // tweaking; the popover dismisses on outside-click / Esc like everything else.
  const applyRaw = (v) => {
    const val = (v || '').trim();
    if (val) onPick(val);
  };
  // A search field over the token list (name + value). Auto-focuses so the user
  // can type straight away.
  const searchBar = (
    <div className="st-cp-pop-search">
      <StIcon name="search" size={12} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search variables"
        aria-label="search variables"
        // biome-ignore lint/a11y/noAutofocus: focusing the search on open is the intent.
        autoFocus
      />
    </div>
  );
  // #2 — colour Variables as a scannable LIST (swatch · name · value), per DS.
  const swatchList = (grps) =>
    grps.map((g) => (
      <div className="st-cp-pop-group" key={g.ds}>
        {showDsHeaders ? <div className="st-cp-pop-ds">{g.ds}</div> : null}
        <div className="st-cp-pop-list">
          {g.names.map((n) => (
            <button
              key={`${g.ds}:${n}`}
              type="button"
              className={`st-cp-pop-row st-cp-pop-crow${isOn(n) ? ' is-on' : ''}`}
              onClick={() => pickFrom(g.ds, n, g.vals?.[n])}
            >
              <span
                className="st-cp-pop-cswatch"
                style={{ background: g.vals?.[n] || 'transparent' }}
                aria-hidden="true"
              />
              <span className="st-cp-pop-name">{pretty(n)}</span>
              <span className="st-cp-pop-val">{g.vals?.[n] || ''}</span>
            </button>
          ))}
        </div>
      </div>
    ));
  // The value-token list (non-colour), per DS.
  const valueList = (grps) =>
    grps.map((g) => (
      <div className="st-cp-pop-group" key={g.ds}>
        {showDsHeaders ? <div className="st-cp-pop-ds">{g.ds}</div> : null}
        <div className="st-cp-pop-list">
          {g.names.map((n) => (
            <button
              key={`${g.ds}:${n}`}
              type="button"
              className={`st-cp-pop-row${isOn(n) ? ' is-on' : ''}`}
              onClick={() => pickFrom(g.ds, n, g.vals?.[n])}
            >
              <span className="st-cp-pop-name">{pretty(n)}</span>
              <span className="st-cp-pop-val">{g.vals?.[n] || ''}</span>
            </button>
          ))}
        </div>
      </div>
    ));
  const noMatch = <div className="st-cp-pop-empty">No match</div>;

  return (
    <>
      {swatchBg !== undefined ? (
        // Colour rows: the swatch IS the trigger — one popover, no separate native
        // OS picker + ◇ (the "two popovers" the user flagged). Shows the current
        // colour; bound-to-token gets the accent ring.
        <button
          type="button"
          ref={btnRef}
          className={`st-cp-swatch st-cp-swatch--mini st-cp-swatch--trigger${bound ? ' is-bound' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label || 'pick a colour'}
          title={current || 'pick a colour'}
          onClick={() => setOpen((v) => !v)}
        >
          <span style={{ position: 'absolute', inset: 0, background: swatchBg || 'transparent' }} />
        </button>
      ) : (
        <button
          type="button"
          ref={btnRef}
          className={`st-cp-tokbtn${bound ? ' is-bound' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label || 'pick a design token'}
          title="design tokens"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="st-cp-tokbtn-glyph" aria-hidden="true" />
        </button>
      )}
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              // Portalled to <body> (outside the App's `.maude` div), so it must
              // re-establish the maude token scope itself — otherwise var(--bg-*)
              // resolves to the legacy :root project palette (the cream popover bug).
              className="maude st-cp-pop"
              data-theme={
                (typeof document !== 'undefined' &&
                  document.documentElement.getAttribute('data-theme')) ||
                'dark'
              }
              role="dialog"
              aria-label={label || 'design tokens'}
              style={{
                left: pos.left,
                top: pos.top,
                width: pos.width,
                maxHeight: pos.maxHeight,
              }}
            >
              {kind === 'color' ? (
                <>
                  <div className="st-cp-poptabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'custom'}
                      className={`st-cp-poptab${mode === 'custom' ? ' is-active' : ''}`}
                      onClick={() => setMode('custom')}
                    >
                      Custom
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'vars'}
                      className={`st-cp-poptab${mode === 'vars' ? ' is-active' : ''}`}
                      onClick={() => setMode('vars')}
                    >
                      Variables
                    </button>
                  </div>
                  {mode === 'custom' ? (
                    <ColorPicker seed={seedHex || cssColorToHex(current) || '#000000'} onApply={applyRaw} />
                  ) : !total ? (
                    <div className="st-cp-pop-empty">No color tokens</div>
                  ) : (
                    <>
                      {searchBar}
                      {filteredGs.length ? swatchList(filteredGs) : noMatch}
                    </>
                  )}
                </>
              ) : !total ? (
                <div className="st-cp-pop-empty">No tokens for this property</div>
              ) : (
                <>
                  {searchBar}
                  {filteredGs.length ? valueList(filteredGs) : noMatch}
                </>
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function CssKnobs({ el, cfg, onOptimistic, onRecordEdit, onUndoRedo }) {
  const editable = !!el.id;
  const computed = el.computed || {};
  // Phase 12.3 — optimistic local overlay over the selection's authored / custom
  // / attr maps. With the redundant-reload suppression (the flicker fix), an edit
  // no longer triggers a reselect that would re-post fresh `authored` values — so
  // the panel must reflect its own commits immediately or it shows the stale
  // pre-edit value until the user re-selects. Each commit/reset writes here;
  // `null` marks a removed key. Cleared when a different element is selected.
  const [overlay, setOverlay] = useState({ a: {}, c: {}, t: {} });
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear only on element change.
  useEffect(() => {
    setOverlay({ a: {}, c: {}, t: {} });
  }, [el.id]);
  const mergeOverlay = (base, ov) => {
    const out = { ...(base || {}) };
    for (const [k, v] of Object.entries(ov)) {
      if (v === null) delete out[k];
      else out[k] = v;
    }
    return out;
  };
  const authored = mergeOverlay(el.authored, overlay.a);
  const customStyles = mergeOverlay(el.customStyles, overlay.c);
  const attrs = mergeOverlay(el.attrs, overlay.t);
  const setA = (prop, v) => setOverlay((o) => ({ ...o, a: { ...o.a, [prop]: v } }));
  const setC = (prop, v) => setOverlay((o) => ({ ...o, c: { ...o.c, [prop]: v } }));
  const setT = (attr, v) => setOverlay((o) => ({ ...o, t: { ...o.t, [attr]: v } }));
  // Token CSS is served from the MAIN origin at the repo-relative path, i.e.
  // WITH the designRoot prefix (`/.design/system/<ds>/colors_and_type.css`) —
  // `tokensCssRel` from config is DS-root-relative (no `.design/`), so prepend it.
  const _designRel = (cfg?.designRel || cfg?.designRoot || '.design').replace(/^\/+|\/+$/g, '');
  const _activeDs = activeDsNameFor(el.file, cfg);
  // W3 — tokens from EVERY configured DS, active one first, so the popover can
  // offer them grouped per design system.
  const allDs = useAllDsTokens(cfg, _designRel, _activeDs);
  // Build per-DS popover groups for one token family (color/space/radius/…).
  const tokenGroups = (familyKey) =>
    allDs
      .map((d) => ({ ds: d.name, names: d[familyKey] || [], vals: d.vals }))
      .filter((g) => g.names.length);
  const [status, setStatus] = useState({});
  const [open, setOpen] = useState({
    Layout: true,
    Typography: true,
    Spacing: true,
    Size: true,
    Appearance: true,
    Advanced: false,
  });
  const [split, setSplit] = useState(false);

  // Phase 12.3 — auto-expand Advanced when the selected element carries custom
  // CSS props / HTML attrs, so a just-added (or pre-existing) custom value is
  // visible without hunting for the disclosure. Keyed on el.id so it re-runs per
  // selection (CssKnobs persists across selections — the el prop changes).
  const hasCustom =
    Object.keys(customStyles).length > 0 || Object.keys(attrs).length > 0;
  useEffect(() => {
    if (hasCustom) setOpen((o) => (o.Advanced ? o : { ...o, Advanced: true }));
  }, [el.id, hasCustom]);

  async function post(url, payload, key) {
    setStatus((s) => ({ ...s, [key]: 'saving' }));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      setStatus((s) => ({
        ...s,
        [key]: !res.ok || !j.ok ? `err:${(j && j.error) || `HTTP ${res.status}`}` : 'saved',
      }));
    } catch (err) {
      setStatus((s) => ({ ...s, [key]: `err:${err && err.message ? err.message : String(err)}` }));
    }
  }
  // Optimistic preview: nudge the live element so the change shows before the
  // edit → HMR reload lands. `value` null = remove (reset path). No-op when the
  // selection has no stable id (can't be resolved in the canvas).
  const optimistic = (prop, value) => {
    if (!onOptimistic || !el.id) return;
    onOptimistic({
      id: el.id,
      artboardId: el.artboardId ?? null,
      index: el.index ?? 0,
      prop,
      value,
    });
  };
  // Record an inline edit onto the canvas undo stack (Cmd+Z). The edit has
  // already POSTed `/_api/edit-*`; the canvas iframe APPENDS the record (no
  // re-run). `before`/`after` null = the prop/attr was/becomes unset.
  const record = (op, key, before, after) => {
    onRecordEdit?.({
      op,
      canvas: el.file,
      id: el.id,
      key,
      before: before == null || before === '' ? null : before,
      after: after == null || after === '' ? null : after,
    });
  };
  const commit = (property, raw) => {
    const value = (raw || '').trim();
    if (!editable || !value) return;
    const before = authored[property] ?? null;
    if (value === (before ?? '').trim()) return; // no-op
    optimistic(property, value);
    setA(property, value); // reflect in the panel immediately (no reload → no reselect)
    post('/_api/edit-css', { canvas: el.file, id: el.id, property, value }, property);
    record('css', property, before, value);
  };
  // A custom CSS property (Advanced) — same write, but the panel surfaces it from
  // the customStyles map, so overlay THERE.
  const commitCustom = (property, raw) => {
    const value = (raw || '').trim();
    const prop = property.trim();
    if (!editable || !prop || !value) return;
    const before = customStyles[prop] ?? null;
    optimistic(prop, value);
    setC(prop, value);
    post('/_api/edit-css', { canvas: el.file, id: el.id, property: prop, value }, prop);
    record('css', prop, before, value);
  };
  const commitAttr = (attr, raw) => {
    const a = (attr || '').trim();
    const value = (raw || '').trim();
    if (!editable || !a || !value) return;
    const before = attrs[a] ?? null;
    setT(a, value);
    post('/_api/edit-attr', { canvas: el.file, id: el.id, attr: a, value }, `@${a}`);
    record('attr', a, before, value);
  };
  // Phase 12.3 — reset (remove the inline prop / attr → back to class/inherited).
  const reset = (property) => {
    if (!editable) return;
    const before = authored[property] ?? null;
    optimistic(property, null);
    setA(property, null);
    post('/_api/edit-css', { canvas: el.file, id: el.id, property, reset: true }, property);
    record('css', property, before, null);
  };
  const resetCustom = (property) => {
    if (!editable) return;
    const before = customStyles[property] ?? null;
    optimistic(property, null);
    setC(property, null);
    post('/_api/edit-css', { canvas: el.file, id: el.id, property, reset: true }, property);
    record('css', property, before, null);
  };
  const resetAttr = (attr) => {
    if (!editable) return;
    const before = attrs[attr] ?? null;
    setT(attr, null);
    post('/_api/edit-attr', { canvas: el.file, id: el.id, attr, reset: true }, `@${attr}`);
    record('attr', attr, before, null);
  };
  // Cmd+Z / Cmd+Shift+Z (or Cmd+Y) inside the inspector forwards to the canvas
  // undo stack — Figma-parity: a property field reverts the last DOCUMENT edit,
  // not field text. Without this, an edit committed with focus still in the
  // inspector couldn't be undone (the iframe's own keydown never sees the key).
  const onKnobKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'z') {
      e.preventDefault();
      onUndoRedo?.(e.shiftKey ? 'redo' : 'undo');
    } else if (k === 'y') {
      e.preventDefault();
      onUndoRedo?.('redo');
    }
  };
  // Phase 12.3 (W2.2) — Figma/Webflow scrub: drag a number field horizontally to
  // change its value. Live preview via optimistic apply on every move (no source
  // write); commits ONCE on release. A pointer that doesn't pass a 3px threshold
  // is a normal click (focus to type). `opts.step` modifiers: shift = ×10, alt =
  // ×0.1. `opts.sides` enables Webflow box-model modifiers: alt = symmetric pair,
  // alt+shift = all four (else just this side). `opts.min` clamps (default 0).
  const makeScrub = (prop, opts = {}) => (e) => {
    if (e.button !== 0) return;
    const input = e.currentTarget;
    const startX = e.clientX;
    const baseN =
      Number.parseFloat(
        cssSplitUnit(authored[prop] ?? cssHint(computed[prop]) ?? '0').n || '0'
      ) || 0;
    const unit = opts.unitless
      ? ''
      : opts.unit || cssSplitUnit(authored[prop] ?? '').unit || 'px';
    const min = opts.min ?? 0;
    const fmt = (n) => (opts.unitless ? `${n}` : `${n}${unit}`);
    const sidesFor = (ev) => {
      if (!opts.sides) return [prop];
      if (ev.altKey && ev.shiftKey) return opts.sides.all;
      if (ev.altKey) return opts.sides.pair;
      return [prop];
    };
    let scrubbing = false;
    let last = baseN;
    const move = (ev) => {
      const dx = ev.clientX - startX;
      if (!scrubbing && Math.abs(dx) < 3) return;
      if (!scrubbing) {
        scrubbing = true;
        document.body.classList.add('st-scrubbing');
      }
      ev.preventDefault();
      const granular = opts.sides ? 1 : ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
      last = Math.round((baseN + dx * granular) * 100) / 100;
      if (last < min) last = min;
      const sides = sidesFor(ev);
      // Live-update the dragged field AND, for a box-model multi-side scrub, the
      // sibling box inputs so the whole pair / four-up move shows in the panel —
      // not just the one being dragged (W2.2 feedback).
      if (input) input.value = String(last);
      if (opts.sides && sides.length > 1) {
        const box = input?.closest('.st-cp-box');
        for (const p of sides) {
          if (p === prop) continue;
          const sib = box?.querySelector(`.st-cp-boxv[aria-label="${p}"]`);
          if (sib) sib.value = String(last);
        }
      }
      for (const p of sides) optimistic(p, fmt(last));
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (!scrubbing) return;
      document.body.classList.remove('st-scrubbing');
      for (const p of sidesFor(ev)) commit(p, fmt(last));
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  const provOf = (prop) => {
    const v = authored[prop];
    if (!v) return 'inherit';
    return /var\(\s*--/.test(v) ? 'bound' : 'raw';
  };

  if (!editable) {
    return (
      <div className="st-cp">
        <div className="st-cp-id">
          <span className="st-cp-idtag">{el.tag || 'element'}</span>
        </div>
        <div className="st-css-disabled">
          This selection has no stable element id (a legacy canvas, or a non-element target). Edit
          it with <code>/design:edit</code>.
        </div>
      </div>
    );
  }

  const PROVLABEL = { bound: 'token-bound', raw: 'raw override', inherit: 'inherited' };
  const prov = (p) => (
    <span className={`st-cp-prov st-cp-prov--${p}`} role="img" aria-label={PROVLABEL[p]} />
  );

  // Phase 12.3 (#4) — the LEADING dot carries it all: provenance (shape) + save
  // status (a success/error/saving glow) + reset (double-click an authored row).
  // No trailing ✓/⟲ that shift the input rightward (the user's gripe). A tooltip
  // hints the double-click-to-reset.
  const provDot = (prop, provKind) => {
    const k = provKind ?? provOf(prop);
    const s = status[prop];
    const errMsg = typeof s === 'string' && s.startsWith('err:') ? s.slice(4) : '';
    const stCls = errMsg ? ' is-err' : s === 'saved' ? ' is-saved' : s === 'saving' ? ' is-saving' : '';
    const canReset = !!authored[prop];
    const tip = errMsg
      ? `error: ${errMsg}`
      : canReset
        ? `${PROVLABEL[k]} · double-click to reset`
        : PROVLABEL[k];
    return (
      <button
        type="button"
        className={`st-cp-prov st-cp-prov--${k}${stCls}${canReset ? ' is-resettable' : ''}`}
        aria-label={tip}
        title={tip}
        tabIndex={canReset ? 0 : -1}
        onDoubleClick={canReset ? () => reset(prop) : undefined}
        onKeyDown={
          canReset
            ? (e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  reset(prop);
                }
              }
            : undefined
        }
      />
    );
  };

  const row = (prop, control, provKind) => {
    // #1 bigger-bet — scannable diff: a fully-unset single-prop row is dimmed so
    // the handful of overridden rows pop (Webflow/Framer model). Composite rows
    // (border — they pass an explicit provKind) are never dimmed.
    const unset = provKind === undefined && !authored[prop];
    return (
      <div className={`st-cp-row${unset ? ' is-unset' : ''}`} key={prop}>
        {provDot(prop, provKind)}
        <label className="st-cp-label" title={prop}>
          {prop}
        </label>
        <div className="st-cp-ctl">{control}</div>
      </div>
    );
  };

  // Props each section owns — drives the per-section "reset section" affordance.
  const SECTION_PROPS = {
    Layout: ['display', 'flex-direction', 'align-items', 'justify-content', 'gap'],
    Typography: [
      'font-family',
      'color',
      'font-size',
      'font-weight',
      'line-height',
      'letter-spacing',
      'text-align',
    ],
    Spacing: [
      'margin-top',
      'margin-right',
      'margin-bottom',
      'margin-left',
      'padding-top',
      'padding-right',
      'padding-bottom',
      'padding-left',
    ],
    Size: ['width', 'height', 'max-width'],
    Appearance: [
      'background-color',
      'border-radius',
      'border-top-left-radius',
      'border-top-right-radius',
      'border-bottom-left-radius',
      'border-bottom-right-radius',
      'border-width',
      'border-style',
      'border-color',
      'box-shadow',
      'opacity',
    ],
  };
  const resetSection = (name) => {
    (SECTION_PROPS[name] || []).forEach((p) => {
      if (authored[p]) reset(p);
    });
  };

  const sec = (name, body) => {
    const dirty = (SECTION_PROPS[name] || []).some((p) => authored[p]);
    return (
      <section className="st-cp-sec" key={name}>
        <div className="st-cp-sechd-row">
          <button
            type="button"
            className="st-cp-sechd"
            aria-expanded={!!open[name]}
            onClick={() => setOpen((o) => ({ ...o, [name]: !o[name] }))}
          >
            <span className="st-cp-caret" aria-hidden="true">
              {open[name] ? '▾' : '▸'}
            </span>
            {name}
          </button>
          {dirty ? (
            <button
              type="button"
              className="st-cp-secreset"
              aria-label={`reset ${name} section to original`}
              title={`reset ${name}`}
              onClick={() => resetSection(name)}
            >
              ⟲
            </button>
          ) : null}
        </div>
        {open[name] ? body : null}
      </section>
    );
  };

  // native <select> committing a CSS value directly
  const csel = (prop, list) => (
    <select
      className="st-cp-nsel"
      aria-label={prop}
      value={list.includes(authored[prop]) ? authored[prop] : ''}
      onChange={(e) => commit(prop, e.target.value)}
    >
      <option value="" disabled>
        {cssHint(computed[prop]) || '—'}
      </option>
      {list.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );

  // token quick-pick — Figma-style POPOVER (W2.1) listing the DS variables for
  // this property (name + resolved value), grouped per design system (W3);
  // picking writes var(--token). `familyKey` selects the token family.
  const tok = (prop, familyKey) => {
    const groups = tokenGroups(familyKey);
    return groups.length ? (
      <TokenPopover
        kind="value"
        groups={groups}
        current={authored[prop]}
        activeDs={_activeDs}
        onPick={(v) => commit(prop, v)}
        label={`${prop} design token`}
      />
    ) : null;
  };

  // free text input — raw value or var(--token), commits on blur/Enter
  const text = (prop) => (
    <input
      className="st-cp-fin"
      key={`${prop}:${authored[prop] ?? ''}`}
      aria-label={prop}
      defaultValue={authored[prop] ?? ''}
      placeholder={cssHint(computed[prop]) || '—'}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onBlur={(e) => commit(prop, e.currentTarget.value)}
    />
  );

  // number + steppers + unit-select (+ optional token quick-pick after)
  const num = (prop, tokenList, opts = {}) => {
    const cur = cssSplitUnit(authored[prop] ?? '');
    // Unitless CSS properties — a bare number must commit WITHOUT a unit suffix
    // (line-height: 1.5px ≠ 1.5 — knob-smoke finding, 2026-06-12).
    const unitless = CSS_UNITLESS.has(prop);
    const unit = unitless ? '' : cur.unit && cur.unit !== 'auto' ? cur.unit : 'px';
    const bump = (d) => {
      const base = Number.parseFloat(cur.n || cssHint(computed[prop]) || '0') || 0;
      commit(prop, `${Math.round((base + d) * 100) / 100}${unit}`);
    };
    const lead = PROP_LEAD[prop];
    return (
      <>
        <div className="st-cp-num">
          {lead ? (
            <span className="st-cp-numlead" aria-hidden="true">
              {lead.t ? lead.t : <StIcon name={lead.icon} size={12} />}
            </span>
          ) : null}
          <input
            className="st-cp-numin st-cp-scrub"
            key={`${prop}:${authored[prop] ?? ''}`}
            aria-label={prop}
            defaultValue={cur.unit && cur.unit !== '' ? cur.n : (authored[prop] ?? '')}
            placeholder={cssHint(computed[prop]) || '—'}
            onPointerDown={makeScrub(prop, { unitless, unit, min: opts.min })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            onBlur={(e) => {
              const raw = e.currentTarget.value.trim();
              if (!raw) return;
              commit(prop, /[a-z%(]/i.test(raw) ? raw : `${raw}${unit}`);
            }}
          />
          <span className="st-cp-step">
            <button
              type="button"
              className="st-cp-stepb"
              tabIndex={-1}
              aria-label={`increase ${prop}`}
              onClick={() => bump(1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="st-cp-stepb"
              tabIndex={-1}
              aria-label={`decrease ${prop}`}
              onClick={() => bump(-1)}
            >
              ▼
            </button>
          </span>
          {unitless ? null : (
          <select
            className="st-cp-unitsel"
            aria-label={`${prop} unit`}
            value={cur.unit || 'px'}
            onChange={(e) =>
              commit(prop, e.target.value === 'auto' ? 'auto' : `${cur.n || '0'}${e.target.value}`)
            }
          >
            {CSS_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          )}
        </div>
        {tok(prop, tokenList)}
      </>
    );
  };

  // color swatch (native picker → hex) + raw text + token quick-pick
  const color = (prop) => {
    // ONE colour control: the swatch is the trigger for a single popover with a
    // full HSV picker (Custom) + the DS swatches (Variables). No separate native
    // OS picker (#6 — was two popovers doing the same thing).
    const resolved = computed[prop] || authored[prop] || '';
    return (
      <>
        <TokenPopover
          kind="color"
          groups={tokenGroups('color')}
          current={authored[prop]}
          activeDs={_activeDs}
          swatchBg={resolved}
          seedHex={cssColorToHex(computed[prop] || authored[prop]) || '#000000'}
          onPick={(v) => commit(prop, v)}
          label={`${prop} colour`}
        />
        {text(prop)}
      </>
    );
  };

  // a box-model side input (margin/padding longhand). Phase 12.3 — Webflow-style:
  // always shows the RESOLVED value (0 instead of blank) and a faint `is-zero`
  // styling for an unset/zero side. Edits the single side (the old "link all
  // sides" toggle was removed — DDR-104 Phase 12.3 W1.5).
  const side = (prop, group) => {
    const a = authored[prop];
    const shown =
      a != null && a !== ''
        ? cssSplitUnit(a).n || a
        : cssSplitUnit(cssHint(computed[prop]) ?? '').n || '0';
    const isZero = !a || a === '0' || a === '0px' || a === 'auto';
    // Webflow scrub modifiers — alt = symmetric pair (block for top/bottom,
    // inline for left/right), alt+shift = all four.
    const edge = prop.split('-').pop();
    const pair =
      edge === 'top' || edge === 'bottom'
        ? [`${group}-top`, `${group}-bottom`]
        : [`${group}-left`, `${group}-right`];
    const all = [`${group}-top`, `${group}-right`, `${group}-bottom`, `${group}-left`];
    return (
      <input
        className={`st-cp-boxv st-cp-scrub st-cp-boxv--${group[0]}${prop.split('-').pop()[0]}${
          isZero ? ' is-zero' : ''
        }`}
        key={`${prop}:${a ?? ''}`}
        aria-label={prop}
        defaultValue={shown}
        title="drag to scrub · alt = symmetric · alt+shift = all sides"
        onPointerDown={makeScrub(prop, { sides: { pair, all } })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim();
          if (!raw) return;
          const val = /[a-z%]/i.test(raw) ? raw : `${raw}px`;
          commit(prop, val);
        }}
      />
    );
  };

  const corner = (label, prop) => (
    <label className="st-cp-cornerf">
      <span>{label}</span>
      <input
        key={`${prop}:${authored[prop] ?? ''}`}
        aria-label={prop}
        defaultValue={cssSplitUnit(authored[prop] ?? '').n || ''}
        placeholder={cssHint(computed[prop]) || '0'}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim();
          if (raw) commit(prop, /[a-z%]/i.test(raw) ? raw : `${raw}px`);
        }}
      />
    </label>
  );

  // Phase 12.3 — authored inline props with no curated row + custom HTML attrs,
  // surfaced in Advanced so the user can see/edit/remove what they added.
  const customStyleRows = Object.entries(customStyles);
  const attrRows = Object.entries(attrs);

  return (
    <div className="st-cp" key={el.id} data-tour="css-panel" onKeyDown={onKnobKeyDown}>
      <div className="st-cp-id">
        <span className="st-cp-idtag">
          {el.tag || 'element'}
          {el.classes ? <span className="st-cp-idcls">.{el.classes.split(/\s+/)[0]}</span> : null}
        </span>
        <span className="st-cp-idmeta">inline style</span>
      </div>

      {sec(
        'Layout',
        <>
          {row('display', csel('display', CSS_DISPLAYS))}
          {row('flex-direction', csel('flex-direction', CSS_FLEX_DIR))}
          {row('align-items', csel('align-items', CSS_ALIGN))}
          {row('justify-content', csel('justify-content', CSS_JUSTIFY))}
          {row('gap', num('gap', 'space'))}
        </>
      )}

      {sec(
        'Typography',
        <>
          {row('font-family', csel('font-family', CSS_FONTS))}
          {row('color', color('color'))}
          {row('font-size', num('font-size', 'type'))}
          {row('font-weight', csel('font-weight', CSS_WEIGHTS))}
          {row('line-height', num('line-height', 'lh'))}
          {row('letter-spacing', num('letter-spacing', null, { min: -Infinity }))}
          {row(
            'text-align',
            <div className="st-cp-seg" role="group" aria-label="text-align">
              {CSS_ALIGN_OPTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`st-cp-segbtn${(authored['text-align'] || computed['text-align']) === a ? ' is-active' : ''}`}
                  aria-label={`align ${a}`}
                  aria-pressed={(authored['text-align'] || computed['text-align']) === a}
                  onClick={() => commit('text-align', a)}
                >
                  <span className={`st-cp-bars st-cp-bars--${a === 'justify' ? 'just' : a}`} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {sec(
        'Spacing',
        <>
          <div className="st-cp-box" aria-label="margin and padding">
            <span className="st-cp-boxtag st-cp-boxtag--m">
              {prov(provOf('margin-top'))}margin
            </span>
            {side('margin-top', 'margin')}
            {side('margin-right', 'margin')}
            {side('margin-bottom', 'margin')}
            {side('margin-left', 'margin')}
            <div className="st-cp-boxpad">
              <span className="st-cp-boxtag st-cp-boxtag--p">
                {prov(provOf('padding-top'))}padding
              </span>
              {side('padding-top', 'padding')}
              {side('padding-right', 'padding')}
              {side('padding-bottom', 'padding')}
              {side('padding-left', 'padding')}
              <div className="st-cp-boxcore">
                {Math.round(el.bounds?.w || 0)} × {Math.round(el.bounds?.h || 0)}
              </div>
            </div>
          </div>
        </>
      )}

      {sec(
        'Size',
        <>
          {row('width', num('width'))}
          {row('height', num('height'))}
          {row('max-width', num('max-width'))}
        </>
      )}

      {sec(
        'Appearance',
        <>
          {row('background-color', color('background-color'))}
          <div className="st-cp-row">
            {prov(provOf('border-radius'))}
            <label className="st-cp-label" title="border-radius">
              border-radius
            </label>
            <div className="st-cp-ctl">
              {num('border-radius', 'radius')}
              <button
                type="button"
                className={`st-cp-split${split ? ' is-on' : ''}`}
                aria-pressed={split}
                aria-label="set each corner separately"
                title="set each corner separately"
                onClick={() => setSplit((v) => !v)}
              />
            </div>
          </div>
          {split ? (
            <div className="st-cp-corners" aria-label="per-corner radius">
              {corner('TL', 'border-top-left-radius')}
              {corner('TR', 'border-top-right-radius')}
              {corner('BL', 'border-bottom-left-radius')}
              {corner('BR', 'border-bottom-right-radius')}
            </div>
          ) : null}
          {row(
            'border',
            <div className="st-cp-border">
              {num('border-width')}
              <select
                className="st-cp-nsel st-cp-nsel--mini"
                aria-label="border-style"
                value={CSS_BORDER_STYLES.includes(authored['border-style']) ? authored['border-style'] : ''}
                onChange={(e) => commit('border-style', e.target.value)}
              >
                <option value="" disabled>
                  style
                </option>
                {CSS_BORDER_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <TokenPopover
                kind="color"
                groups={tokenGroups('color')}
                current={authored['border-color']}
                activeDs={_activeDs}
                swatchBg={computed['border-color'] || authored['border-color'] || ''}
                seedHex={
                  cssColorToHex(computed['border-color'] || authored['border-color']) || '#000000'
                }
                onPick={(v) => commit('border-color', v)}
                label="border colour"
              />
            </div>,
            provOf('border-width')
          )}
          {row('box-shadow', tok('box-shadow', 'shadow') || text('box-shadow'))}
          {row(
            'opacity',
            <div className="st-cp-num">
              <span className="st-cp-numlead" aria-hidden="true">
                <StIcon name="p-opacity" size={12} />
              </span>
              <input
                className="st-cp-numin"
                key={`opacity:${authored.opacity ?? ''}`}
                aria-label="opacity"
                defaultValue={authored.opacity ?? ''}
                placeholder={cssHint(computed.opacity) || '1'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => commit('opacity', e.currentTarget.value)}
              />
            </div>
          )}
        </>
      )}

      {/* #5 — the idle/saved status now lives in each row's leading dot (a glow),
          so the panel no longer carries a confusing standing 'written to source'
          line. Only a hard ERROR surfaces here, with the failing property. */}
      {(() => {
        const err = Object.entries(status).find(
          ([, s]) => typeof s === 'string' && s.startsWith('err:')
        );
        return err ? (
          <div className="st-cp-save is-err" role="status">
            <StIcon name="x" size={12} />
            {err[0]}: {err[1].slice(4)}
          </div>
        ) : null;
      })()}

      {sec(
        'Advanced',
        <div className="st-cp-advbody">
          {customStyleRows.length ? (
            <>
              <div className="st-cp-advgrp">Custom CSS properties</div>
              {customStyleRows.map(([p, v]) => (
                <div className="st-cp-kv" key={`cs:${p}`}>
                  <input
                    className="st-cp-fin st-cp-fin--ro"
                    readOnly
                    value={p}
                    aria-label={`custom property ${p} name`}
                  />
                  <input
                    className="st-cp-fin"
                    key={`cs:${p}:${v}`}
                    defaultValue={v}
                    aria-label={`${p} value`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => commitCustom(p, e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    className="st-cp-kvx"
                    aria-label={`remove ${p}`}
                    title="remove"
                    onClick={() => resetCustom(p)}
                  >
                    <StIcon name="x" size={11} />
                  </button>
                </div>
              ))}
            </>
          ) : null}
          <div className="st-cp-advgrp">Add CSS property</div>
          <RawKnob commit={commitCustom} />
          <div className="st-cp-note">applied as-is — not token-bound</div>
          {attrRows.length ? (
            <>
              <div className="st-cp-advgrp">Custom HTML attributes</div>
              {attrRows.map(([a, v]) => (
                <div className="st-cp-kv" key={`at:${a}`}>
                  <input
                    className="st-cp-fin st-cp-fin--ro"
                    readOnly
                    value={a}
                    aria-label={`attribute ${a} name`}
                  />
                  <input
                    className="st-cp-fin"
                    key={`at:${a}:${v}`}
                    defaultValue={v}
                    aria-label={`${a} value`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={(e) => commitAttr(a, e.currentTarget.value)}
                  />
                  <button
                    type="button"
                    className="st-cp-kvx"
                    aria-label={`remove ${a}`}
                    title="remove"
                    onClick={() => resetAttr(a)}
                  >
                    <StIcon name="x" size={11} />
                  </button>
                </div>
              ))}
            </>
          ) : null}
          <div className="st-cp-advgrp">Add HTML attribute</div>
          <AttrKnob commit={commitAttr} />
        </div>
      )}

      <div className="st-cp-legend">
        <span>
          <i className="st-cp-prov st-cp-prov--bound" aria-hidden="true" />
          token
        </span>
        <span>
          <i className="st-cp-prov st-cp-prov--raw" aria-hidden="true" />
          override
        </span>
        <span>
          <i className="st-cp-prov st-cp-prov--inherit" aria-hidden="true" />
          inherited
        </span>
      </div>
    </div>
  );
}

// Custom CSS property hatch — writes an arbitrary `property: value` to inline style.
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
    <div className="st-cp-kv">
      <input
        className="st-cp-fin"
        aria-label="custom property name"
        placeholder="property"
        value={prop}
        onChange={(e) => setProp(e.target.value)}
      />
      <input
        className="st-cp-fin"
        aria-label="custom property value"
        placeholder="value"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        onBlur={submit}
      />
    </div>
  );
}

// Custom HTML attribute hatch — writes a plain JSX attribute (data-*, aria-*, …).
function AttrKnob({ commit }) {
  const [attr, setAttr] = useState('');
  const [val, setVal] = useState('');
  const submit = () => {
    if (attr.trim() && val.trim()) {
      commit(attr.trim(), val);
      setAttr('');
      setVal('');
    }
  };
  return (
    <div className="st-cp-kv">
      <input
        className="st-cp-fin"
        aria-label="custom attribute name"
        placeholder="data-…"
        value={attr}
        onChange={(e) => setAttr(e.target.value)}
      />
      <input
        className="st-cp-fin"
        aria-label="custom attribute value"
        placeholder="value"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        onBlur={submit}
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
// ---------- Layers tree row (Phase 12 Task 4) ----------
// Phase 12.3 (W3.1) — map a LayerNode `type` (classified in canvas-shell) to a
// type-distinct icon, matching the Studio.tsx layers design.
const LAYER_TYPE_ICON = {
  button: 'button',
  heading: 'type',
  text: 'type',
  input: 'input',
  form: 'input',
  image: 'image',
  link: 'link',
  list: 'list',
  nav: 'layers',
  box: 'box',
};

function LayerRow({
  node,
  depth,
  selectedId,
  collapsed,
  hidden,
  onToggle,
  onSelect,
  onHover,
  onToggleVisibility,
}) {
  const key = `${node.id}:${node.index}`;
  const hasKids = node.children && node.children.length > 0;
  const isCollapsed = collapsed.has(key);
  const isSel = node.id === selectedId;
  const isHidden = hidden?.has(key);
  return (
    <>
      <div
        className={
          'st-layer st-layer--row' + (isSel ? ' is-sel' : '') + (isHidden ? ' is-hidden' : '')
        }
        style={{ paddingLeft: 6 + depth * 14 }}
        role="treeitem"
        aria-selected={isSel}
        aria-expanded={hasKids ? !isCollapsed : undefined}
        tabIndex={0}
        title={`${node.tag} · ${node.type}`}
        onClick={() => onSelect(node)}
        onMouseEnter={() => onHover(node)}
        onMouseLeave={() => onHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node);
          }
        }}
      >
        {hasKids ? (
          <button
            type="button"
            className="st-layer-caret"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(key);
            }}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="st-layer-caret" aria-hidden="true" />
        )}
        <StIcon name={LAYER_TYPE_ICON[node.type] || 'box'} size={12} className="st-layer-ticon" />
        <span className="st-layer-label">{node.label}</span>
        <span className="st-layer-type">{node.type}</span>
        {onToggleVisibility ? (
          <button
            type="button"
            className="st-layer-eye"
            aria-label={isHidden ? `Show ${node.label}` : `Hide ${node.label}`}
            aria-pressed={isHidden}
            title={isHidden ? 'Show' : 'Hide'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(node);
            }}
          >
            <StIcon name={isHidden ? 'eye-off' : 'eye'} size={13} />
          </button>
        ) : null}
      </div>
      {hasKids && !isCollapsed
        ? node.children.map((c) => (
            <LayerRow
              key={`${c.id}:${c.index}`}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              collapsed={collapsed}
              hidden={hidden}
              onToggle={onToggle}
              onSelect={onSelect}
              onHover={onHover}
              onToggleVisibility={onToggleVisibility}
            />
          ))
        : null}
    </>
  );
}

// Phase 12.3 — live computed readout for the Inspect tab (replaces the stale
// "lands with the live CSS bridge (Phase 12)" callout — that bridge shipped).
// Reads the resolved values the selection already carries (dom-selection
// styleMapsFor → el.computed). Read-only; the CSS tab is where you edit.
function InspectComputed({ el }) {
  const c = el?.computed || {};
  const a = el?.authored || {};
  // Prefer the authored token name (var(--accent) → "--accent") as the label;
  // fall back to the resolved value. The swatch always shows the RESOLVED color.
  const valueLabel = (prop) => {
    const av = a[prop];
    if (av && /var\(\s*--/.test(av)) return av.replace(/^var\(\s*|\s*\)$/g, '');
    return c[prop] || av || '';
  };
  const colorRow = (lbl, prop) => {
    const resolved = c[prop] || a[prop];
    if (!resolved) return null;
    return (
      <div className="st-insp-row" key={lbl}>
        <span className="st-insp-label">{lbl}</span>
        <div className="st-swatch-row">
          <span className="st-insp-swatch" style={{ background: resolved }} aria-hidden="true" />
          <span className="st-mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>
            {valueLabel(prop)}
          </span>
        </div>
      </div>
    );
  };
  const hasRadius = c['border-radius'] && c['border-radius'] !== '0px';
  const radiusN = hasRadius ? cssSplitUnit(c['border-radius']).n || c['border-radius'] : null;
  const font =
    c['font-size'] || c['font-weight']
      ? [c['font-size'], c['font-weight']].filter(Boolean).join(' / ')
      : null;
  const anyType = c['background-color'] || c.color || hasRadius || font;
  if (!anyType) return null;
  return (
    <>
      {hasRadius ? (
        <div className="st-insp-row">
          <span className="st-insp-label">Radius</span>
          <div className="st-insp-fields">
            <span className="st-fmini" style={{ flex: '0 0 auto', maxWidth: 84 }}>
              <span className="st-mtag">r</span>
              <input value={radiusN} readOnly aria-label="border radius" />
            </span>
            <span className="st-insp-unit">px</span>
          </div>
        </div>
      ) : null}
      {colorRow('Fill', 'background-color')}
      {colorRow('Text', 'color')}
      {font ? (
        <div className="st-insp-row">
          <span className="st-insp-label">Font</span>
          <div className="st-insp-fields">
            <span className="st-mono" style={{ fontSize: 11, color: 'var(--fg-0)' }}>{font}</span>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InspectorPanel({
  selected,
  onClose,
  layersTree,
  onSelectLayer,
  onHoverLayer,
  cfg,
  onOptimistic,
  onRecordEdit,
  onUndoRedo,
  tab: tabProp,
  onTabChange,
  width,
  resizing,
}) {
  // Tab is controllable from the parent (the guided tour drives it to 'css' /
  // 'layers' so a spotlight step lands on a real row) but falls back to local
  // state for normal use. A user click both updates local state and notifies the
  // parent, so the two stay in lockstep whichever owns it.
  const [tabState, setTabState] = useState('inspect');
  const tab = tabProp ?? tabState;
  const setTab = (t) => {
    setTabState(t);
    onTabChange?.(t);
  };
  const [collapsed, setCollapsed] = useState(() => new Set());
  // Phase 12.3 (W3.1) — per-layer visibility toggle. Live-only (display:none via
  // the optimistic apply bus); not persisted to source. Keyed by `${id}:${index}`.
  const [hiddenLayers, setHiddenLayers] = useState(() => new Set());
  const toggleCollapse = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleVisibility = (node) => {
    const key = `${node.id}:${node.index}`;
    const willHide = !hiddenLayers.has(key);
    onOptimistic?.({
      id: node.id,
      artboardId: layersTree?.artboardId ?? null,
      index: node.index,
      prop: 'display',
      value: willHide ? 'none' : null,
    });
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (willHide) next.add(key);
      else next.delete(key);
      return next;
    });
  };
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
    <aside
      className={'st-rpanel' + (resizing ? ' is-resizing' : '')}
      style={width ? { width, flexBasis: width } : undefined}
      aria-label="Inspector"
      data-tour="inspector"
    >
      <div className="st-rp-tabs" data-tour="inspector-tabs">
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
            {/* <p> wrapper — st-rp-empty is a flex column, bare text nodes +
                kbd would stack as stretched flex items. */}
            <p>
              Hold <Kbd>⌘</Kbd> inside the canvas and click an element to inspect it.
            </p>
          </div>
        ) : tab === 'inspect' ? (
          <>
            <div className="st-rp-hd">{el.selector || el.tag || 'element'}</div>
            <div className="st-insp-row">
              <span className="st-insp-label">Pos</span>
              <div className="st-insp-fields">
                <span className="st-fmini">
                  <span className="st-mtag">X</span>
                  <input value={b ? Math.round(b.x) : '—'} readOnly aria-label="x position" />
                </span>
                <span className="st-fmini">
                  <span className="st-mtag">Y</span>
                  <input value={b ? Math.round(b.y) : '—'} readOnly aria-label="y position" />
                </span>
              </div>
            </div>
            <div className="st-insp-row">
              <span className="st-insp-label">Size</span>
              <div className="st-insp-fields">
                <span className="st-fmini">
                  <span className="st-mtag">W</span>
                  <input value={b ? Math.round(b.w) : '—'} readOnly aria-label="width" />
                </span>
                <span className="st-fmini">
                  <span className="st-mtag">H</span>
                  <input value={b ? Math.round(b.h) : '—'} readOnly aria-label="height" />
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
            <InspectComputed el={el} />
          </>
        ) : tab === 'layers' ? (
          <>
            <div className="st-rp-hd">Layers{layersTree?.nodes?.length ? '' : ' · ancestry'}</div>
            {layersTree?.nodes?.length ? (
              <div role="tree" aria-label="Artboard layers">
                {layersTree.nodes.map((n) => (
                  <LayerRow
                    key={`${n.id}:${n.index}`}
                    node={n}
                    depth={0}
                    selectedId={el.id}
                    collapsed={collapsed}
                    hidden={hiddenLayers}
                    onToggle={toggleCollapse}
                    onSelect={(node) => onSelectLayer?.(node)}
                    onHover={(node) => onHoverLayer?.(node)}
                    onToggleVisibility={toggleVisibility}
                  />
                ))}
              </div>
            ) : Array.isArray(el.dom_path) && el.dom_path.length ? (
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
              <div className="st-rp-empty">
                Select an element (⌘-click in the canvas) to see its layer tree.
              </div>
            )}
          </>
        ) : (
          <CssKnobs
            el={el}
            cfg={cfg}
            onOptimistic={onOptimistic}
            onRecordEdit={onRecordEdit}
            onUndoRedo={onUndoRedo}
          />
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
  // Phase 12.3 — latest selection, readable from the (stale-closure) onMessage
  // handler so an HMR reload (triggered by a CSS/attr edit) can re-select the
  // same element and restore the in-canvas halo the remount dropped.
  const selectedRef = useRef(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  // Phase 12 Task 4 — Layers tree for the active artboard (posted by canvas-shell).
  const [layersTree, setLayersTree] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  // Phase 8 Task 7 — git lifecycle reload prompt. Server has already flushed
  // every dirty Y.Doc to disk by the time this state populates, so accepting
  // the reload is data-loss-safe (DDR-051 §3).
  const [gitLifecycle, setGitLifecycle] = useState(null);
  // Phase 9 Task 8 — hub-down offline mode banner. Driven by the 'sync:status'
  // WS message the linked-mode sync runtime emits. null in solo mode.
  const [syncStatus, setSyncStatus] = useState(null);
  // Phase 27 (E2) — in-UI git layer. `gitStatus` is the live dirty-state the
  // server broadcasts on `git-status`; `changesOpen` toggles the Changes panel;
  // `diffTarget` opens the before/after DiffView ({ file, conflict }).
  const [gitStatus, setGitStatus] = useState(null);
  // Phase 28 (E3) — remote ahead/behind ("Get latest" nudge). Kept in its OWN
  // slice, NOT folded into `gitStatus`, because the `git-status` WS broadcast
  // (line ~5791) replaces `gitStatus` on every dirty-state change and carries
  // only LOCAL status — merging remote-ahead into it would be clobbered on the
  // next keystroke. The probe is a real network `git fetch` (server-side, token
  // from the keychain bridge), so it runs on a slow cadence — mount, a periodic
  // tick, and after each git action — never on the per-edit WS path.
  const [remoteSync, setRemoteSync] = useState(null); // { remoteAhead, behind } | null
  const [changesOpen, setChangesOpen] = useState(false);
  const [diffTarget, setDiffTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [systemData, setSystemData] = useState(null);
  // Canvas-compile skeleton (single-canvas model → one path at a time).
  const [loadingPath, setLoadingPath] = useState(null);
  const loadFallbackTimer = useRef(null);
  // Resizable side panels (DS components-resize-panels) + the active drag side.
  const sbSize = usePanelSize('maude-sb-w', { min: 200, max: 420, def: 252 });
  const rpSize = usePanelSize('maude-rp-w', { min: 260, max: 480, def: 304 });
  const [dragSide, setDragSide] = useState(null); // 'sb' | 'rp' | null
  const bodyRef = useRef(null);

  // Pointer drag for the panel grips — window listeners while dragging (the
  // grip also pointer-captures, and `.st-body.is-resizing iframe` drops pointer
  // events so the canvas iframe can't swallow the move stream mid-drag).
  useEffect(() => {
    if (!dragSide) return;
    const onMove = (e) => {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (dragSide === 'sb') sbSize.setW(e.clientX - rect.left);
      else rpSize.setW(rect.right - e.clientX);
    };
    const onUp = () => setDragSide(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragSide, sbSize.setW, rpSize.setW]);

  // Loading-skeleton lifecycle: dgn:'loaded' clears it instantly (TSX canvases);
  // the iframe load event arms a short fallback for legacy .html canvases that
  // never post it; a hard cap guards against a canvas that dies mid-compile.
  const onIframeLoad = useCallback((path) => {
    clearTimeout(loadFallbackTimer.current);
    loadFallbackTimer.current = setTimeout(() => {
      setLoadingPath((p) => (p === path ? null : p));
    }, 2500);
  }, []);
  useEffect(() => {
    if (!loadingPath) return;
    const cap = setTimeout(() => setLoadingPath(null), 15000);
    return () => clearTimeout(cap);
  }, [loadingPath]);
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
  // Phase 27 (E2) — seed the git dirty-state on mount; live updates arrive over
  // the `git-status` WS broadcast (Task 5). Solo/non-git projects → repo:false.
  useEffect(() => {
    let cancelled = false;
    fetch('/_api/git/status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data) setGitStatus(data);
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
  const [readinessOpen, setReadinessOpen] = useState(false);
  // ? cheat-sheet (DS components-shortcuts-overlay) — separate from the deep
  // Help modal (F1), which keeps commands & flows.
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // T5/T6 (Plan C) — shell-level export/handoff dialog + inspector panel state.
  // The palette (T4) drives them; the dialog (T5) + panel (T6) consume them.
  const [exportDialog, setExportDialog] = useState(null); // null | { mode: 'export'|'handoff', scope? }
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Phase 31 (DDR-123) — the native ACP chat sidepanel (right dock, native-only).
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantUnseen, setAssistantUnseen] = useState(false);
  const assistantOpenRef = useRef(assistantOpen);
  useEffect(() => {
    assistantOpenRef.current = assistantOpen;
    if (assistantOpen) {
      setAssistantUnseen(false); // opening clears the unseen badge
      // Ask for notification permission on a real user gesture (panel open).
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      } catch {
        /* notifications unavailable */
      }
    }
  }, [assistantOpen]);
  // ChatPanel owns one connection PER CHAT (so chats run in parallel in the
  // background) and reports up here: `onBusyChange` for the menubar pulse, and
  // `onFinished` when any chat's turn ends — badge + notify if you weren't looking.
  const handleAssistantFinished = useCallback(() => {
    if (!assistantOpenRef.current || document.hidden) {
      setAssistantUnseen(true);
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Claude finished', { body: 'Your assistant turn is ready in Maude.' });
        }
      } catch {
        /* best-effort — the in-app badge is the reliable signal */
      }
    }
  }, []);
  // Inspector tab is lifted so View ▸ Layers can open the panel ON the Layers
  // tab (the menu item sat disabled as "Phase 12" long after the tab shipped).
  const [inspectorTab, setInspectorTab] = useState('inspect');
  // The right dock holds exactly ONE panel (Changes / Inspector / Comments) at
  // a time — opening any panel REPLACES whatever was there. These two helpers
  // are the single source of that invariant; every open/toggle path routes
  // through them. (Before, the three booleans were flipped independently across
  // ~13 call sites and only some closed their siblings, so a panel opened via a
  // path that left a sibling `true` rendered *behind* it under the fixed
  // precedence — looking like the new panel "overlapped" the old one.)
  const openRightPanel = useCallback((which) => {
    setChangesOpen(which === 'changes');
    setInspectorOpen(which === 'inspector');
    setCommentsPanelOpen(which === 'comments');
    setAssistantOpen(which === 'assistant');
  }, []);
  // Functional updates so this is stale-closure-safe inside the keydown /
  // postMessage listeners; opening always clears the sibling panels.
  const toggleRightPanel = useCallback((which) => {
    if (which === 'inspector') {
      setInspectorOpen((v) => {
        if (!v) {
          setChangesOpen(false);
          setCommentsPanelOpen(false);
          setAssistantOpen(false);
        }
        return !v;
      });
    } else if (which === 'comments') {
      setCommentsPanelOpen((v) => {
        if (!v) {
          setChangesOpen(false);
          setInspectorOpen(false);
          setAssistantOpen(false);
        }
        return !v;
      });
    } else if (which === 'changes') {
      setChangesOpen((v) => {
        if (!v) {
          setInspectorOpen(false);
          setCommentsPanelOpen(false);
          setAssistantOpen(false);
        }
        return !v;
      });
    } else if (which === 'assistant') {
      setAssistantOpen((v) => {
        if (!v) {
          setChangesOpen(false);
          setInspectorOpen(false);
          setCommentsPanelOpen(false);
        }
        return !v;
      });
    }
  }, []);
  const whatsNew = useWhatsNew(MDCC_VERSION);
  // Phase 29 (E4) — first-run onboarding wizard. The native shell boots a minimal
  // "welcome" project on first launch; we ask it whether this is a first run and, if
  // so, show the wizard OVER the (empty) canvas browser. Completing any door switches
  // the sidecar to a real project (the webview reloads → first-run is then false).
  const [firstRun, setFirstRun] = useState(false);
  // Offer the collab "rychlý kurz" once, AFTER onboarding (native app, not first run,
  // not yet seen). A returning user who already took it isn't re-nudged.
  const [collabNudge, setCollabNudge] = useState(false);
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let alive = true;
    appIsFirstRun()
      .then((v) => {
        if (!alive) return;
        setFirstRun(!!v);
        if (!v && !readBoolStore(COLLAB_TOUR_STORE, false)) setCollabNudge(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const markCollabSeen = useCallback(() => {
    setCollabNudge(false);
    try {
      localStorage.setItem(COLLAB_TOUR_STORE, '1');
    } catch {}
  }, []);
  // Phase 32 (Task 1) — auto-update. The native shell downloads + stages a newer
  // build in the background and emits `update-ready`; we surface a non-blocking
  // banner. Native-only (the web studio is updated by its own deploy).
  const [updateReady, setUpdateReady] = useState(null);
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    let un;
    onUpdateReady((p) => setUpdateReady(p && typeof p === 'object' ? p : {}))
      .then((fn) => {
        un = fn;
      })
      .catch(() => {});
    return () => {
      try {
        un?.();
      } catch {}
    };
  }, []);
  const [tourSteps, setTourSteps] = useState(null);
  const [usageNudge, setUsageNudge] = useState(() => !readBoolStore(USAGE_TOUR_STORE, false));
  const startTour = useCallback((steps) => {
    setTourSteps(Array.isArray(steps) && steps.length ? steps : null);
  }, []);
  // Guided-tour bus — the overlay calls setup() before each step to put the shell
  // into the state the step spotlights: open a canvas, open the Inspector, switch
  // its tab. The canvas iframe is cross-origin (DDR-054) so the tour can't select
  // an element for the user; requireSelection steps instead wait for a real
  // ⌘-click. Plain object (the overlay refs it), so per-render churn is harmless.
  const tourBus = {
    setup: (step) => {
      if (!step) return;
      if ((step.canvas || step.requireSelection) && tabs.length === 0) {
        setSidebarOpen(true);
        setTimeout(() => {
          try {
            document.querySelector('.st-sidebar [role="treeitem"]')?.click();
          } catch {}
        }, 80);
      }
      if (step.inspector || step.tab || step.requireSelection) openRightPanel('inspector');
      if (step.tab) setInspectorTab(step.tab);
      // Phase 29 (E4) collab tour — open the Changes panel so the Save / Publish /
      // Get-latest controls the action steps spotlight actually exist to anchor on.
      if (step.changes) openRightPanel('changes');
    },
  };
  const markUsageSeen = useCallback(() => {
    setUsageNudge(false);
    try {
      localStorage.setItem(USAGE_TOUR_STORE, '1');
    } catch {}
  }, []);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  // Canvas-chrome visibility (View menu). minimap + zoom-controls are
  // persistent prefs broadcast to every open canvas iframe; presentMode is a
  // non-destructive "hide ALL chrome + shell, artboards only" overlay with an
  // Esc / floating-pill escape hatch back to the chrome.
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [zoomCtlVisible, setZoomCtlVisible] = useState(true);
  const [presentMode, setPresentMode] = useState(false);
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

  // Chrome visibility (minimap / zoom-controls / Presentation Mode) applies to
  // EVERY open canvas iframe, not just the active one — broadcast to all. A
  // freshly-loaded iframe is seeded from the dgn:'loaded' handler below.
  const broadcastChrome = useCallback((patch) => {
    for (const el of iframesRef.current.values()) {
      try {
        el.contentWindow.postMessage({ dgn: 'view-chrome', ...patch }, '*');
      } catch {}
    }
  }, []);
  const toggleMinimap = useCallback(() => {
    setMinimapVisible((v) => {
      const next = !v;
      broadcastChrome({ minimap: next });
      return next;
    });
  }, [broadcastChrome]);
  const toggleZoomCtl = useCallback(() => {
    setZoomCtlVisible((v) => {
      const next = !v;
      broadcastChrome({ zoom: next });
      return next;
    });
  }, [broadcastChrome]);
  const togglePresent = useCallback(() => {
    setPresentMode((v) => {
      const next = !v;
      broadcastChrome({ present: next });
      return next;
    });
  }, [broadcastChrome]);
  const exitPresent = useCallback(() => {
    setPresentMode(false);
    broadcastChrome({ present: false });
  }, [broadcastChrome]);

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
            setSelected((prev) => mergeSelClientFields(m.state.selected, prev));
          } else if (m.type === 'selected') {
            setSelected((prev) => mergeSelClientFields(m.selected, prev));
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
          } else if (m.type === 'canvas-list-update') {
            // Phase 30 — a canvas was created/deleted on THIS dev-server; re-read
            // the branch-scoped tree so other open tabs reflect it without a
            // reload. Cross-machine peers get a new canvas via git "Get latest".
            loadTree();
          } else if (m.type === 'acp-focus') {
            // Phase 31 (DDR-123) — `/design:chat` from the terminal asked us to
            // surface the native ACP chat sidepanel. Native-only (the panel
            // doesn't exist on the web surface).
            if (isNativeApp()) openRightPanel('assistant');
          } else if (m.type === 'git-status' && m.payload) {
            // Phase 27 (E2) Task 5 — live dirty-state. Updates the Changes-panel
            // count + tree M/A/D badges reactively, no polling.
            setGitStatus(m.payload);
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
    // loadTree is a stable useCallback([]); listed so the canvas-list-update
    // handler always calls the live reference.
  }, [loadTree]);

  function wsSend(obj) {
    const ws = wsRef.current;
    try {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    } catch {}
  }

  // ----- Phase 27 (E2) — git actions -----
  // All write actions POST same-origin (the dev-server's sameOriginWrite + the
  // dual-allowlist gate them main-origin only). After a mutation we refresh
  // status optimistically; the `git-status` WS broadcast also lands shortly.
  const refreshGitStatus = useCallback(async () => {
    try {
      const r = await fetch('/_api/git/status');
      if (r.ok) setGitStatus(await r.json());
    } catch {}
  }, []);

  // Phase 28 (E3) — probe the tracking remote so the Changes panel can surface
  // the "Get latest" nudge (GitPanel reads `status.remoteAhead` / `status.behind`).
  // `?remote=1` is what makes the server do the `git fetch` + ahead/behind count;
  // without it the status is local-only and the nudge never fires. Network call —
  // call sparingly (mount / interval / post-action), never on the WS hot path.
  const refreshRemoteSync = useCallback(async () => {
    try {
      const r = await fetch('/_api/git/status?remote=1');
      if (!r.ok) return;
      const data = await r.json();
      if (data && data.repo !== false)
        setRemoteSync({ remoteAhead: !!data.remoteAhead, behind: data.behind || 0 });
    } catch {}
  }, []);

  const gitPostJson = useCallback(async (path, body) => {
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, ...data };
    } catch (e) {
      return { ok: false, error: 'Network error — is the project still open?' };
    }
  }, []);

  const gitCommit = useCallback(
    async (message, files) => {
      const res = await gitPostJson('/_api/git/commit', { message, files });
      if (res.ok) await refreshGitStatus();
      return res;
    },
    [gitPostJson, refreshGitStatus]
  );

  const gitDiscard = useCallback(
    async (files) => {
      const res = await gitPostJson('/_api/git/discard', { files });
      if (res.ok) await refreshGitStatus();
      return res;
    },
    [gitPostJson, refreshGitStatus]
  );

  const gitPublish = useCallback(async () => {
    const res = await gitPostJson('/_api/git/push', {});
    // Refresh so the "N versions ready to publish" count clears to 0 after a
    // successful push (the server advanced the local remote-tracking ref), and
    // re-probe the remote so a stale "Get latest" nudge clears.
    if (res.ok) {
      await refreshGitStatus();
      refreshRemoteSync();
    }
    return res;
  }, [gitPostJson, refreshGitStatus, refreshRemoteSync]);

  const gitGetLatest = useCallback(async () => {
    const res = await gitPostJson('/_api/git/pull', {});
    // On success the remote is merged in — clear the nudge by re-probing.
    if (res.ok) {
      await refreshGitStatus();
      refreshRemoteSync();
    }
    // A true content conflict → open the visual resolver on the first file.
    if (res.conflict && Array.isArray(res.files) && res.files.length) {
      setDiffTarget({ file: res.files[0], conflict: true });
    }
    return res;
  }, [gitPostJson, refreshGitStatus, refreshRemoteSync]);

  // Phase 28 (E3) — finish a Get-latest conflict from the DiffView resolver.
  // `choice` is 'mine' | 'theirs' | 'both'; the server completes the two-parent
  // merge commit (and, for 'both', writes our version as a "(mine)" copy).
  const gitResolveConflict = useCallback(
    async (choice) => {
      const res = await gitPostJson('/_api/git/resolve', { choice });
      if (res.ok) {
        await refreshGitStatus();
        refreshRemoteSync();
      }
      return res;
    },
    [gitPostJson, refreshGitStatus, refreshRemoteSync]
  );

  // `path` (optional) scopes History to one canvas — the per-file version list
  // behind the History click-to-preview + DiffView "Saved version" picker
  // (phase-27.1). Omit for the repo-wide log.
  const gitLoadLog = useCallback(async (path) => {
    try {
      const qs = '/_api/git/log?limit=40' + (path ? `&path=${encodeURIComponent(path)}` : '');
      const r = await fetch(qs);
      if (!r.ok) return [];
      const data = await r.json();
      return data.entries || [];
    } catch {
      return [];
    }
  }, []);

  // Repo-relative path → M/A/D/U badge for the tree (paths match: both the tree
  // and gitStatus use `.design/ui/Foo.tsx`). Keyed off gitStatus so it updates
  // live with the WS broadcast.
  const dirtyByPath = useMemo(() => {
    const KIND = { modified: 'M', added: 'A', deleted: 'D', untracked: 'U' };
    const m = new Map();
    for (const f of gitStatus?.files || []) m.set(f.path, KIND[f.status]);
    return m;
  }, [gitStatus]);
  const unsavedCount = gitStatus?.files?.length || 0;

  // Phase 28 (E3) — keep remote ahead/behind fresh so the "Get latest" nudge
  // surfaces on its own: probe once a repo is known, again whenever the Changes
  // panel opens, and on a slow 60 s tick WHILE the panel is open (a teammate's
  // publish then shows up without the user first attempting their own publish).
  // Declared after `refreshRemoteSync` to avoid a temporal-dead-zone on the dep.
  useEffect(() => {
    if (gitStatus?.repo === false) return; // solo / non-git project — no remote
    refreshRemoteSync();
    if (!changesOpen) return; // only keep polling while the panel is visible
    const id = setInterval(refreshRemoteSync, 60000);
    return () => clearInterval(id);
  }, [gitStatus?.repo, changesOpen, refreshRemoteSync]);

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
    // Canvas-compile skeleton — cleared by the iframe's dgn:'loaded' message,
    // the onLoad fallback timer (legacy .html), or a hard 15s cap.
    if (path !== SYSTEM_TAB) setLoadingPath(path);
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
      setLoadingPath((p) => (p === path ? null : p));
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

  // User-facing tree refresh with a visible spin. The header button and ⌘⇧R call
  // this so the reload icon spins for at least one beat — even when /_index-data
  // returns instantly — so the action registers visually ("something is
  // happening"). The min-duration race keeps the spin from flashing for one
  // frame on a fast read; the ref guard ignores re-entrant clicks. The passive
  // focus backstop below uses the plain reloadTree (no icon to animate).
  const [treeRefreshing, setTreeRefreshing] = useState(false);
  const treeRefreshingRef = useRef(false);
  const refreshTree = useCallback(async () => {
    if (treeRefreshingRef.current) return;
    treeRefreshingRef.current = true;
    setTreeRefreshing(true);
    try {
      await Promise.all([loadTree(), new Promise((r) => setTimeout(r, 550))]);
    } finally {
      treeRefreshingRef.current = false;
      setTreeRefreshing(false);
    }
  }, [loadTree]);

  // Backstop for the desktop sidecar: re-list the tree whenever the window
  // regains focus. The fs-watch → canvas-list-update auto-refresh can drop
  // events in a `bun --compile` standalone binary (recursive fs.watch is
  // unreliable there) and across a sidecar respawn / WS reconnect, leaving a
  // stale tree after a canvas was created from the ACP chat or a terminal.
  // `/_index-data` is a cheap read and people tab away to the agent and back, so
  // this turns "switch projects to force a refresh" into "just come back to the
  // window". Debounced so a rapid blur/focus burst coalesces to one re-read.
  useEffect(() => {
    let t = null;
    const onFocus = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        reloadTree();
      }, 150);
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      if (t) clearTimeout(t);
    };
  }, [reloadTree]);

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
  // Presentation Mode hides comment pins: post an empty list while present
  // (re-posting the real list on exit, since this effect re-runs on the flag).
  useEffect(() => {
    if (!activePath || activePath === SYSTEM_TAB) return;
    const el = iframesRef.current.get(activePath);
    if (!el || !el.contentWindow) return;
    const list = presentMode ? [] : commentsByFile[activePath] || [];
    try {
      el.contentWindow.postMessage({ dgn: 'comments-set', comments: list }, '*');
    } catch {}
  }, [activePath, commentsByFile, presentMode]);

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
        // Phase 12 (DDR-103) — inline text edit committed in the canvas. POST to
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
      } else if (m.dgn === 'apply-edit' && m.id && (m.op === 'css' || m.op === 'text' || m.op === 'attr')) {
        // Inline-edit undo/redo (DDR-103/104 follow-up). The canvas iframe's
        // `edit-source` command can't call the main-origin-only `/_api/edit-*`
        // routes (DDR-054), so it asks us to re-apply the before/after value.
        // `value` null = reset (remove the inline prop / attr). For CSS we also
        // optimistically repaint so the revert shows before the HMR reload.
        const op = m.op;
        const value = typeof m.value === 'string' ? m.value : null;
        let url;
        let body;
        if (op === 'css') {
          url = '/_api/edit-css';
          body =
            value == null
              ? { canvas: m.canvas, id: m.id, property: m.key, reset: true }
              : { canvas: m.canvas, id: m.id, property: m.key, value };
          applyOptimisticStyle({ id: m.id, prop: m.key, value });
        } else if (op === 'attr') {
          url = '/_api/edit-attr';
          body =
            value == null
              ? { canvas: m.canvas, id: m.id, attr: m.key, reset: true }
              : { canvas: m.canvas, id: m.id, attr: m.key, value };
        } else {
          url = '/_api/edit-text';
          body = { canvas: m.canvas, id: m.id, text: value ?? '' };
        }
        editApplyChainRef.current = editApplyChainRef.current
          .catch(() => {})
          .then(() =>
            fetch(url, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            })
              .then((r) => r.json().catch(() => ({})))
              .then((j) => {
                if (!j.ok) console.warn('[apply-edit]', op, j.error || 'failed');
              })
              .catch(() => {})
          );
      } else if (m.dgn === 'layers-tree') {
        // Phase 12 Task 4 — browsable layers tree for the active artboard.
        setLayersTree({ artboardId: m.artboardId, nodes: Array.isArray(m.tree) ? m.tree : [] });
      } else if (m.dgn === 'open-inspector') {
        // Phase 12 — context-menu "Inspect" / tool-palette Inspect opens the right panel.
        openRightPanel('inspector');
      } else if (m.dgn === 'present-enter') {
        // Canvas tool-palette "Presentation mode" button — Present Mode is a
        // shell-level state (hides the menubar / sidebar / panels), so the
        // canvas requests it here and the shell flips it on + broadcasts
        // dgn:'view-chrome' back to every iframe. Enter-only (the palette is
        // hidden while presenting); exit is Esc or the floating pill. The
        // inbound origin gate above (DDR-054) already authenticates the canvas.
        // Hardening (phase-28 audit F-2): honor it ONLY from the ACTIVE canvas
        // (a background tab's untrusted canvas must not flip the foreground),
        // and NEVER while a modal dialog is open — present mode hides Sidebar-
        // descendant modals (OAuth device-code / Share-invite), so an untrusted
        // canvas could otherwise blank an in-flight confirmation.
        const activeWin = activePath ? iframesRef.current.get(activePath)?.contentWindow : null;
        const modalOpen = !!document.querySelector('[role="dialog"][aria-modal="true"]');
        if (e.source === activeWin && !modalOpen && !presentMode) {
          setPresentMode(true);
          broadcastChrome({ present: true });
        }
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
      } else if (m.dgn === 'shell-shortcut') {
        // Same forwarding lane for the other shell chords (inspect.ts) — so
        // ⌘R / ⌘⇧I / ⌘⇧M / ⌘⇧E / ⌘⇧H behave identically wherever focus is.
        if (m.id === 'reload') reloadActive();
        else if (m.id === 'inspector') toggleRightPanel('inspector');
        else if (m.id === 'assistant' && isNativeApp()) toggleRightPanel('assistant');
        else if (m.id === 'comments') toggleRightPanel('comments');
        else if (m.id === 'export') setExportDialog({ mode: 'export' });
        else if (m.id === 'handoff') setExportDialog({ mode: 'handoff' });
      } else if (m.dgn === 'open-export') {
        // Plan C — the in-canvas toolbar / context menu route here so they open
        // the SAME shell Export dialog as the menubar (one look, all settings).
        // Carry the context-menu's scope hint (e.g. "Export selection").
        setExportDialog({
          mode: 'export',
          scope: m.detail && typeof m.detail.scope === 'string' ? m.detail.scope : undefined,
        });
      } else if (m.dgn === 'loaded' && m.file) {
        // iframe finished loading — drop the compile skeleton, push current
        // comments + carry over focused pin if any
        setLoadingPath((p) => (p === m.file ? null : p));
        // Presentation Mode suppresses comment pins (same gate as the push
        // effect above), so a canvas opened while presenting starts pin-free.
        const list = presentMode ? [] : commentsByFile[m.file] || [];
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
          // Seed the just-loaded canvas with the current chrome-visibility
          // state (minimap / zoom-controls toggles + Presentation Mode) so a
          // canvas opened after a toggle starts in the right state.
          try {
            el.contentWindow.postMessage(
              { dgn: 'view-chrome', minimap: minimapVisible, zoom: zoomCtlVisible, present: presentMode },
              '*'
            );
          } catch {}
          if (focusedCommentId && list.some((c) => c.id === focusedCommentId)) {
            try {
              el.contentWindow.postMessage({ dgn: 'comment-focus', id: focusedCommentId }, '*');
            } catch {}
          }
          // Phase 12.3 (W1.1) — an edit-css/edit-attr commit triggers the file
          // watcher's HMR reload, which remounts the canvas and drops the
          // in-canvas selection halo. Re-select the same element by its stable
          // data-cd-id so the user keeps focus on what they're editing. The
          // canvas-shell `select-by-id` handler re-emits select-set, which keeps
          // the Inspector panel + halo in sync. Guarded to the active file.
          const sel = selectedRef.current;
          if (sel && sel.id && sel.file === m.file) {
            try {
              el.contentWindow.postMessage(
                {
                  dgn: 'select-by-id',
                  id: sel.id,
                  artboardId: sel.artboardId ?? null,
                  index: sel.index ?? 0,
                },
                '*'
              );
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
  }, [
    commentsByFile,
    focusedCommentId,
    cfg,
    theme,
    reloadActive,
    presentMode,
    minimapVisible,
    zoomCtlVisible,
    broadcastChrome,
    activePath,
  ]);

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

  // Phase 12.3 (W1.1) — optimistic inline-style preview. The CSS panel calls this
  // on commit so the selected element updates instantly in the canvas before the
  // edit-css → HMR reload lands. `value` null = the reset path (remove the prop).
  const applyOptimisticStyle = useCallback(
    (payload) => {
      if (!activePath || activePath === SYSTEM_TAB) return;
      const el = iframesRef.current.get(activePath);
      if (el && el.contentWindow) {
        try {
          el.contentWindow.postMessage({ dgn: 'apply-style', ...payload }, '*');
        } catch {}
      }
    },
    [activePath]
  );

  // Inline-edit undo (DDR-103/104 follow-up). The inspector calls this after it
  // POSTs `/_api/edit-css` / `/_api/edit-attr`, so the canvas iframe records the
  // edit on its undo stack and Cmd+Z can invert it. The iframe gates this to
  // parent-origin posts (DDR-054). See `commands/edit-source-command.ts`.
  const recordSourceEdit = useCallback(
    (payload) => {
      if (!activePath || activePath === SYSTEM_TAB || !payload) return;
      const el = iframesRef.current.get(activePath);
      if (el && el.contentWindow) {
        try {
          el.contentWindow.postMessage({ dgn: 'record-edit', payload }, '*');
        } catch {}
      }
    },
    [activePath]
  );

  // Serializes `apply-edit` source writes from canvas undo/redo so a rapid
  // multi-Cmd+Z on the same property lands on disk in dispatch order (the
  // iframe sink is fire-and-forget, so without this the POSTs could race).
  const editApplyChainRef = useRef(Promise.resolve());

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

      // Esc exits Presentation Mode first — it's the primary way back to the
      // chrome (the menubar is hidden while presenting). Highest priority so it
      // wins over the focused-pin / deselect Esc handlers below, and fires even
      // when focus is inside the canvas iframe.
      if (presentMode && e.key === 'Escape') {
        e.preventDefault();
        exitPresent();
        return;
      }

      // Cmd+K / Ctrl+K — toggle the command palette (works even in inputs).
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Cmd+Z / Cmd+Shift+Z / Cmd+Y — forward to the active canvas's undo stack
      // when focus is in the shell chrome (not a text field, not the canvas
      // iframe). Inside the canvas iframe the canvas owns Cmd+Z; inside an editable
      // field native undo wins (the inspector's CssKnobs forwards on its own). This
      // makes inspector CSS / inline text / attr edits undoable from anywhere.
      if (meta && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y' || e.key === 'Y')) {
        if (!inEditable && !inCanvasIframe && activePath && activePath !== SYSTEM_TAB) {
          e.preventDefault();
          const redo = e.key === 'y' || e.key === 'Y' || e.shiftKey;
          postToActiveCanvas({ dgn: redo ? 'redo' : 'undo' });
          return;
        }
      }
      // Cmd+Shift+R — refresh the FILES tree (re-read /_index-data). The fs-watch
      // → canvas-list-update auto-refresh can miss events in the compiled desktop
      // sidecar (recursive fs.watch is unreliable in a bun --compile binary), and
      // ⌘R is taken by canvas-iframe reload, so this is the manual escape hatch.
      if (meta && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        refreshTree();
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
        toggleRightPanel('comments');
        return;
      }
      // Cmd+Shift+G — toggle the Changes (git) panel. Opening it closes the
      // other right-dock panels (one panel at a time).
      if (meta && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        toggleRightPanel('changes');
        return;
      }
      // Cmd+Shift+I — toggle Inspector. Was bare "I", which collided with the
      // canvas highlighter tool (same letter, different action by focus).
      if (meta && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        toggleRightPanel('inspector');
        return;
      }
      // Phase 31 (DDR-123) — Cmd+Shift+A opens the native ACP chat sidepanel.
      if (meta && e.shiftKey && (e.key === 'a' || e.key === 'A') && isNativeApp()) {
        e.preventDefault();
        toggleRightPanel('assistant');
        return;
      }
      // Cmd+Shift+E / Cmd+Shift+H — the File-menu chords, previously
      // advertised but never bound.
      if (meta && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setExportDialog({ mode: 'export' });
        return;
      }
      if (meta && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setExportDialog({ mode: 'handoff' });
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
      // N — open the new-brief-board composer (replaces the advertised ⌘N,
      // which the browser reserves for New Window and never delivers).
      if ((e.key === 'n' || e.key === 'N') && !meta && !e.shiftKey) {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(
          () => document.querySelector('[aria-label="New blank brief board"]')?.click(),
          60
        );
        return;
      }
      // ? — keyboard-shortcuts cheat sheet (DS shortcuts overlay)
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      // F1 — the full Help modal (commands & flows)
      if (e.key === 'F1') {
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
    refreshTree,
    selected,
    activePath,
    focusedCommentId,
    sidebarOpen,
    openSystem,
    closeTab,
    clearActiveCanvasSelection,
    presentMode,
    exitPresent,
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
        kbd: 'N',
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
        run: () => toggleRightPanel('comments'),
      },
      {
        id: 'inspector',
        group: 'View',
        label: 'Open inspector',
        icon: 'sliders',
        kbd: '⌘⇧I',
        run: () => openRightPanel('inspector'),
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
        id: 'shortcuts',
        group: 'Help',
        label: 'Keyboard shortcuts',
        icon: 'help',
        kbd: '?',
        run: () => setShortcutsOpen(true),
      },
      {
        id: 'help',
        group: 'Help',
        label: 'Help · commands & flows',
        icon: 'help',
        kbd: 'F1',
        run: () => setHelpOpen(true),
      },
    ],
    [openSystem, toggleTheme, reloadActive, whatsNew]
  );

  return (
    <div
      className={'maude' + (presentMode ? ' is-present' : '')}
      data-theme={theme}
      onContextMenu={onShellContextMenu}
    >
      {firstRun && <OnboardingWizard />}
      <UpdateBanner update={updateReady} onDismiss={() => setUpdateReady(null)} />
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
          onToggleComments={() => toggleRightPanel('comments')}
          changesOpen={changesOpen}
          changesCount={unsavedCount}
          onToggleChanges={() => toggleRightPanel('changes')}
          onOpenSystem={openSystem}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          showHidden={showHidden}
          onToggleShowHidden={() => setShowHidden((v) => !v)}
          onOpenHelp={() => setHelpOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onStartTour={() => startTour(USAGE_TOUR)}
          onStartCollabTour={() => startTour(COLLAB_TOUR)}
          annotationsVisible={annotationsVisible}
          onToggleAnnotations={toggleAnnotations}
          minimapVisible={minimapVisible}
          onToggleMinimap={toggleMinimap}
          zoomCtlVisible={zoomCtlVisible}
          onToggleZoomCtl={toggleZoomCtl}
          presentMode={presentMode}
          onTogglePresent={togglePresent}
          postToActiveCanvas={postToActiveCanvas}
          onOpenReadiness={() => setReadinessOpen(true)}
          onOpenWhatsNew={whatsNew.openPanel}
          whatsNewCount={whatsNew.unseen.length}
          artboardCount={activeArtboards}
          inspectorOpen={inspectorOpen}
          inspectorTab={inspectorTab}
          onToggleInspector={() => toggleRightPanel('inspector')}
          assistantOpen={assistantOpen}
          onToggleAssistant={() => toggleRightPanel('assistant')}
          assistantBusy={assistantBusy}
          assistantUnseen={assistantUnseen}
          onOpenLayers={() => {
            // Toggle: already open on Layers → close; otherwise open on Layers
            // (clearing the sibling panels — one dock slot).
            if (inspectorOpen && inspectorTab === 'layers') {
              setInspectorOpen(false);
            } else {
              setInspectorTab('layers');
              openRightPanel('inspector');
            }
          }}
          onNewCanvas={() => {
            setSidebarOpen(true);
            setTimeout(
              () => document.querySelector('[aria-label="New blank brief board"]')?.click(),
              60
            );
          }}
          onOpenExport={(mode) => setExportDialog({ mode })}
          onReload={reloadActive}
          onCloseCanvas={() => activePath && closeTab(activePath)}
          presence={
            <>
              <StAvatar
                initials={initialsOf(gitUser || 'you')}
                hue="var(--accent)"
                title={gitUser ? `${gitUser} (you)` : 'You'}
              />
              {agentActive && (
                <StAvatar
                  initials="C"
                  hue="var(--presence-agent)"
                  title="Claude · editing"
                  pulse
                />
              )}
            </>
          }
        />
        <div className={'st-body' + (dragSide ? ' is-resizing' : '')} ref={bodyRef}>
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
            onRefresh={refreshTree}
            refreshing={treeRefreshing}
            collapsed={!sidebarOpen}
            onCollapse={() => setSidebarOpen(false)}
            width={sbSize.w}
            resizing={dragSide === 'sb'}
            dirtyByPath={dirtyByPath}
            project={project}
            gitBranch={gitStatus?.branch}
          />
          {sidebarOpen && (
            <PanelGrip
              label="Resize files panel"
              size={sbSize}
              active={dragSide === 'sb'}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setDragSide('sb');
              }}
            />
          )}
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
              loadingPath={loadingPath}
              onIframeLoad={onIframeLoad}
            />
          </div>
          {(inspectorOpen || commentsPanelOpen || changesOpen || assistantOpen) && (
            <PanelGrip
              label="Resize side panel"
              dir="rtl"
              size={rpSize}
              active={dragSide === 'rp'}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setDragSide('rp');
              }}
            />
          )}
          {/* Right dock — one panel at a time. Changes (E2) takes precedence,
              then Inspector (T6), then the comments panel. */}
          {changesOpen ? (
            <GitPanel
              status={
                gitStatus && remoteSync ? { ...gitStatus, ...remoteSync } : gitStatus
              }
              project={project}
              readOnly={!isNativeApp()}
              width={rpSize.w}
              resizing={dragSide === 'rp'}
              onClose={() => setChangesOpen(false)}
              onCommit={gitCommit}
              onDiscard={gitDiscard}
              onPublish={gitPublish}
              onGetLatest={gitGetLatest}
              loadLog={gitLoadLog}
              onOpenCanvas={(p) => openTab(p)}
              onOpenDiff={(file) => setDiffTarget({ file, beforeSha: 'HEAD', conflict: false })}
              activeCanvas={
                activePath && activePath !== SYSTEM_TAB && /\.(tsx|html)$/i.test(activePath)
                  ? activePath
                  : null
              }
              onPreviewVersion={(sha) =>
                setDiffTarget({ file: activePath, beforeSha: sha, conflict: false })
              }
              designRel={(cfg?.designRel || cfg?.designRoot || '.design').replace(/^\/+|\/+$/g, '')}
            />
          ) : inspectorOpen ? (
            <InspectorPanel
              selected={selected}
              cfg={cfg}
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onClose={() => setInspectorOpen(false)}
              onOptimistic={applyOptimisticStyle}
              onRecordEdit={recordSourceEdit}
              onUndoRedo={(dir) => postToActiveCanvas({ dgn: dir })}
              layersTree={layersTree}
              onSelectLayer={(n) =>
                postToActiveCanvas({
                  dgn: 'select-by-id',
                  id: n.id,
                  artboardId: layersTree?.artboardId,
                  index: n.index,
                })
              }
              onHoverLayer={(n) =>
                postToActiveCanvas({
                  dgn: 'highlight',
                  id: n ? n.id : null,
                  artboardId: layersTree?.artboardId,
                  index: n ? n.index : 0,
                })
              }
              width={rpSize.w}
              resizing={dragSide === 'rp'}
            />
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
              width={rpSize.w}
              resizing={dragSide === 'rp'}
            />
          ) : null}
          {/* Phase 31 (DDR-123) — the ACP chat panel stays MOUNTED (display:none
              when inactive) so the chat keeps streaming + its history survives a
              switch to Changes/Inspector/Comments. Native-only. */}
          {isNativeApp() && (
            <ChatPanel
              hidden={!assistantOpen}
              activeCanvas={
                activePath && activePath !== SYSTEM_TAB && /\.(tsx|html)$/i.test(activePath)
                  ? activePath
                  : null
              }
              width={rpSize.w}
              resizing={dragSide === 'rp'}
              onClose={() => setAssistantOpen(false)}
              onBusyChange={setAssistantBusy}
              onFinished={handleAssistantFinished}
            />
          )}
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
          changesCount={unsavedCount}
          unpushed={gitStatus?.unpushed || 0}
          changesOpen={changesOpen}
          onOpenChanges={gitStatus?.repo ? () => setChangesOpen(true) : undefined}
        />
      </div>
      {presentMode && (
        <button
          type="button"
          className="st-present-exit"
          onClick={exitPresent}
          aria-label="Exit presentation mode"
          title="Exit presentation mode (Esc)"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>Exit presentation</span>
          <kbd className="st-present-exit-kbd">Esc</kbd>
        </button>
      )}
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
      {diffTarget && (
        <DiffView
          target={diffTarget}
          cfg={cfg}
          loadLog={gitLoadLog}
          onClose={() => setDiffTarget(null)}
          onRestore={async (file) => {
            const res = await gitDiscard([file]);
            if (res?.ok) setDiffTarget(null);
            else window.alert(res?.error || 'Could not restore that version. Try again.');
          }}
          onResolve={async (choice) => {
            // phase-28 (E3): apply the chosen side via /_api/git/resolve, which
            // completes the two-parent merge commit (and for "both" saves our
            // version as a "(mine)" copy — zero loss). Close on success; keep the
            // resolver open with the error otherwise.
            const res = await gitResolveConflict(choice);
            if (res.ok) {
              setDiffTarget(null);
            } else {
              window.alert(res.error || 'Could not finish the merge. Get the latest again, then retry.');
            }
          }}
        />
      )}
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartTour={() => {
          setHelpOpen(false);
          startTour(USAGE_TOUR);
        }}
      />
      <WhatsNewPanel wn={whatsNew} onStartTour={startTour} />
      <ReadinessDialog open={readinessOpen} onClose={() => setReadinessOpen(false)} />
      {usageNudge && !tourSteps && !collabNudge && (
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
      {/* Phase 29 (E4) — the collab "rychlý kurz", offered once after onboarding. */}
      {collabNudge && !tourSteps && (
        <div className="mdcc-tour-nudge" role="status" aria-live="polite">
          <div className="mdcc-tour-nudge__body">
            New to working with a team? See how saving &amp; sharing works — 60 seconds.
          </div>
          <button
            type="button"
            className="mdcc-tour-nudge__cta"
            onClick={() => {
              markCollabSeen();
              startTour(COLLAB_TOUR);
            }}
          >
            Start
          </button>
          <button
            type="button"
            className="mdcc-tour-nudge__skip"
            aria-label="Dismiss"
            onClick={markCollabSeen}
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
        bus={tourBus}
        hasSelection={!!selected}
        hasCanvas={tabs.length > 0}
      />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
