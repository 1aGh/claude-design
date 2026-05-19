// Design plugin local browser — React UI.
// Bundled via Bun.build (DDR-009/012) — IIFE, tree-shaken, React 19 from npm.
// Renders: file tree, tabs, viewport (iframes), status bar, design-system view, comments.
// Universal — no project tokens needed; styling lives in client/styles/.

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { createRoot } from 'react-dom/client';

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
  } catch { return fallback; }
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

function urlOf(p) {
  return '/' + p.split('/').map(encodeURIComponent).join('/');
}

// Iframe src for a canvas path. TSX canvases go through _canvas-shell.html so
// the bundled React 19 runtime + importmap can mount the default export. HTML
// canvases keep the legacy "serve the file with inspector + Babel injected"
// path. Phase 3.6 contract; the path argument is repo-root-relative
// (e.g. ".design/ui/Foo.tsx").
function canvasUrl(p, cfg) {
  if (!p.endsWith('.tsx')) return urlOf(p);
  const designRel = (cfg?.designRel || '.design').replace(/^\/+|\/+$/g, '');
  // Path under designRoot.
  let rel = p;
  if (rel.startsWith(designRel + '/')) rel = rel.slice(designRel.length + 1);
  // Pass `rel` to URLSearchParams RAW — it does encoding once. Pre-encoding
  // with encodeURIComponent then handing to URLSearchParams produced
  // `Docs%2520Site.tsx` (the `%` of `%20` got re-encoded as `%25`) and broke
  // every UI canvas with a space in its filename.
  const params = new URLSearchParams();
  params.set('canvas', rel);
  params.set('designRel', designRel);
  // Resolve tokens path. Prefer the first designSystem's tokensCssRel — that's
  // the project's authoritative tokens file (e.g. `system/project/colors_and_type.css`).
  // The top-level cfg.tokensCssRel is the legacy default (`system/colors_and_type.css`)
  // and points to a file that usually doesn't exist in DS-bootstrapped projects.
  const ds0 = cfg?.designSystems?.[0];
  const tokens = ds0?.tokensCssRel || cfg?.tokensCssRel;
  if (tokens) params.set('tokens', tokens);
  if (cfg?.componentsCssRel) params.set('components', cfg.componentsCssRel);
  // Specimen detection: anything under `system/<ds>/preview/` gets the layout
  // chrome CSS so its `.specimen-hd` / `_layout.css`-baked treatment renders.
  const specMatch = rel.match(/^system\/([^/]+)\/preview\//);
  if (specMatch) {
    const ds = specMatch[1];
    params.set('layout', `system/${ds}/preview/_layout.css`);
    if (!cfg?.componentsCssRel) {
      params.set('components', `system/${ds}/preview/_components.css`);
    }
  } else if (ds0?.path) {
    // UI canvas — load the project DS's `_components.css` so the dc-canvas /
    // dc-section / dc-artboard chrome (and any DS classes the canvas reuses)
    // renders correctly.
    if (!cfg?.componentsCssRel) {
      params.set('components', `${ds0.path}/preview/_components.css`);
    }
  }
  return `/_canvas-shell.html?${params.toString()}`;
}

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
    const stripped = p.startsWith(stripPrefix) ? p.slice(stripPrefix.length).replace(/^\/+/, '') : p;
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
  const dirs = Object.keys(node).filter(k => k !== '_files');
  for (const d of dirs) {
    const filtered = filterTree(node[d], query);
    if (filtered) { out[d] = filtered; any = true; }
  }
  if (node._files) {
    const files = node._files.filter(f =>
      f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
    if (files.length) { out._files = files; any = true; }
  }
  return any ? out : null;
}

function openCount(comments) {
  return (comments || []).filter(c => c.status !== 'resolved').length;
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
  let all = 0, open = 0, resolved = 0;
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d={d} />
    </svg>
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
        className="tp-row dir"
        style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
        onClick={() => setOpen(v => !v)}
      >
        <span className="glyph" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="name">{name}</span>
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
        className={'tp-row ds-folder' + (active ? ' sel' : '')}
        style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
        role="treeitem"
        aria-expanded={open}
      >
        <button
          type="button"
          className="ds-folder-chev"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Collapse design system' : 'Expand design system'}
          title={open ? 'Collapse' : 'Expand'}
        >
          <span className="glyph" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
        <button
          type="button"
          className="ds-folder-open"
          onClick={() => onOpenSystem(dsName)}
          aria-label={`Open ${dsName} design system view`}
          title="Open the design system view"
        >
          <span className="name">{name}</span>
        </button>
      </div>
      {open && children}
    </Fragment>
  );
}

function FileRow({ file, activePath, onOpen, openCount: oc, depth, kind, sidecar }) {
  const isSel = file.path === activePath;
  const isCanvas = CANVAS_EXT_RE.test(file.name);
  // Non-canvas rows (PROJECT *.md, RUNTIME _active.json, ...) are display-only —
  // clicking them doesn't open an iframe; we leave the click as no-op + cursor
  // hint via `aria-disabled`.
  const inert = !isCanvas;
  const label = isCanvas ? displayName(file.name) : file.name;
  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={isSel}
      aria-disabled={inert ? 'true' : undefined}
      tabIndex={isSel ? 0 : -1}
      className={'tp-row' + (isSel ? ' sel' : '') + (kind === 'runtime' ? ' muted' : '') + (sidecar ? ' sidecar' : '')}
      style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
      title={file.path + (oc ? ` — ${oc} open` : (inert ? ' (file index only)' : ''))}
      onClick={() => { if (!inert) onOpen(file.path); }}
    >
      <span className="glyph" aria-hidden="true">{isSel ? '▸' : '·'}</span>
      <span className="name">{label}</span>
      {oc > 0 && <span className="badge">{oc}</span>}
    </button>
  );
}

function CanvasRow({ primary, sidecars, depth, kind, activePath, onOpen, openCount: oc, showHidden, forceOpen }) {
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
        className={'tp-row canvas-row' + (isSel ? ' sel' : '')}
        style={{ paddingLeft: TREE_INDENT_BASE + depth * TREE_INDENT_STEP + 'px' }}
        title={primary.path}
        onClick={(e) => {
          // Click the chevron region → toggle disclosure. Click anywhere else → open canvas.
          if (e.target.closest('.canvas-chev')) {
            setOpenState((v) => !v);
            return;
          }
          onOpen(primary.path);
        }}
      >
        <span
          className="glyph canvas-chev"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            setOpenState((v) => !v);
          }}
        >
          {open ? '▾' : '▸'}
        </span>
        <span className="name">{displayName(primary.name)}</span>
        {oc > 0 && <span className="badge">{oc}</span>}
      </button>
      {open && sidecars.map((sc) => (
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

function Tree({ node, activePath, onOpen, commentsByFile, depth = 1, kind, showHidden, search, dsFolders, onOpenSystem }) {
  const dirs = Object.keys(node).filter(k => k !== '_files').sort();
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
        const forceOpen = hasSearch && entry.sidecars.some((sc) => {
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
            openCount={openCount(commentsByFile[entry.primary.path])}
            depth={depth}
            kind={kind}
            showHidden={showHidden}
            forceOpen={forceOpen}
          />
        );
      })}
      {showHidden && orphans.map((entry) => (
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
      {dirs.map(d => {
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
            onOpenSystem={onOpenSystem}
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
              active={activePath === SYSTEM_TAB}
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
  project:  { title: 'PROJECT',                pillFromCount: false },
  // Design-system group: pill shows the number of DSes (one row per DS folder
  // inside). Computed in Sidebar from `g.dsFolders.length`.
  ds:       { title: 'DESIGN SYSTEM',          pillFromDsCount: true },
  canvas:   { title: 'UI CANVASES',            pillFromCount: true },
  runtime:  { title: 'RUNTIME · GITIGNORED',   pillFromCount: true },
};

function sectionMetaFor(g) {
  if (g.kind === 'project') return SECTION_META.project;
  if (g.kind === 'runtime') return SECTION_META.runtime;
  // canvas-kind groups: "Design system" → ds, anything else → canvas label
  if (g.label === 'Design system') return SECTION_META.ds;
  if (g.label === 'UI kit')        return SECTION_META.canvas;
  return { title: g.label.toUpperCase(), pillFromCount: true };
}

function Sidebar({ groups, activePath, onOpen, onOpenSystem, wsConnected, search, setSearch, commentsByFile, showHidden, sectionsExpanded, onToggleSection }) {
  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups.map(g => ({ ...g, tree: filterTree(g.tree, search), filtered: !!search }));
  }, [groups, search]);

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
    for (const g of filteredGroups) for (const p of g.paths || []) if (CANVAS_EXT_RE.test(p)) total++;
    return total;
  }, [filteredGroups]);

  return (
    <nav className="sidebar">
      <div className="tree-panel-hd">
        <span>FILES</span>
        <span className="ct" title={wsConnected ? 'live · file index synced' : 'reconnecting…'}>
          <span className={'live-dot' + (wsConnected ? ' connected' : '')} aria-hidden="true" />
          {htmlShown} / {htmlCount}
        </span>
      </div>

      <div className="tree-panel-search">
        <Icon d="M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z" size={12} />
        <input
          type="search"
          placeholder="filter (⌘F)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Filter files"
        />
        {search ? (
          <button className="search-clear" onClick={() => setSearch('')} title="Clear (Esc)" aria-label="Clear search">×</button>
        ) : (
          <span className="search-kbd" aria-hidden="true">/</span>
        )}
      </div>

      <div className="tree-panel-body" role="tree" aria-label="Project file tree">
        {filteredGroups.map(g => {
          // Hide gitignored runtime / orphan-only project sections by default.
          // Active search overrides — if the user typed a query, they want hits
          // wherever they live.
          if (!showHidden && !search && g.kind === 'runtime') return null;
          const meta = sectionMetaFor(g);
          // Counter pill counts canvases only — sidecars + orphans inflate the
          // raw `paths.length` and the FILES header already filters this way.
          const canvasCount = (g.paths || []).filter((p) => CANVAS_EXT_RE.test(p)).length;
          const pill = meta.pill
            || (meta.pillFromDsCount ? String(g.dsFolders?.length || 0) : null)
            || (meta.pillFromCount ? String(canvasCount || g.paths?.length || 0) : null);
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
          const chev = sectionOpen ? '▾' : '▸';
          return (
            <Fragment key={g.label}>
              <button
                type="button"
                className="tp-section-hd clickable section-toggle"
                onClick={() => onToggleSection(g.label, defaultOpen)}
                aria-expanded={sectionOpen}
                title={sectionOpen ? 'Collapse section' : 'Expand section'}
              >
                <span className="chev" aria-hidden="true">{chev}</span>
                <span className="section-label">{meta.title}</span>
                {pill && <span className="pill">{pill}</span>}
              </button>
              {sectionOpen && (hasItems ? (
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
                  onOpenSystem={isDs ? onOpenSystem : undefined}
                />
              ) : (
                <div className="tp-empty">
                  {search ? 'No matches.' : 'Empty.'}
                </div>
              ))}
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}

// Help modal — hosts the cheatsheet that used to live in the left sidebar.
// Triggered from the menubar's Help item. Esc + backdrop click close it.
function HelpModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="help-modal-backdrop"
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-modal-title">
        <header className="help-modal-hd">
          <span className="title" id="help-modal-title">Help · shortcuts &amp; commands</span>
          <span className="sku">MDCC-DEV-SRV / v{MDCC_VERSION}</span>
          <button type="button" className="help-modal-close" aria-label="Close (Esc)" onClick={onClose}>×</button>
        </header>
        <div className="help-modal-body">
          <details open>
            <summary>Element selection</summary>
        <ul>
          <li><kbd>⌘</kbd> + hover <span>highlight</span></li>
          <li><kbd>⌘</kbd> + click <span>select</span></li>
          <li><kbd>⌘C</kbd> + click <span>select + comment</span></li>
          <li><kbd>⌘⇧</kbd> + click <span>select + comment (alt)</span></li>
          <li><kbd>⌘C</kbd> after select <span>comment selected</span></li>
          <li><kbd>Esc</kbd> in canvas <span>clear</span></li>
        </ul>
      </details>
      <details>
        <summary>Tabs &amp; canvas</summary>
        <ul>
          <li>click in tree <span>open tab</span></li>
          <li><kbd>×</kbd> on tab <span>close tab</span></li>
          <li><kbd>⌘R</kbd> <span>reload iframe</span></li>
          <li><kbd>/</kbd> <span>focus search</span></li>
          <li><kbd>⌘⇧M</kbd> <span>toggle comments panel</span></li>
        </ul>
      </details>
      <details>
        <summary>Slash commands</summary>
        <ul className="cmds">
          <li><code>/design:edit "<i>feedback</i>"</code><span>edit + 4-iter multi-axis loop</span></li>
          <li><code>/design:edit "<i>…</i>" --perfect</code><span>8-iter polish (4.5/5 aspiration)</span></li>
          <li><code>/design:edit "<i>…</i>" --no-critic</code><span>raw edit, skip loop</span></li>
          <li><code>/design:edit "<i>…</i>" --opt-out=<i>scope</i></code><span>override DS scope (palette/aesthetic/full)</span></li>
          <li><code>/design:new "<i>Name</i>" "<i>brief</i>"</code><span>scaffold canvas</span></li>
          <li><code>/design:new "<i>…</i>" --opt-out=aesthetic</code><span>scaffold off-system canvas (gradients/radii/type free)</span></li>
          <li><code>/design:critic</code><span>review panel (routed)</span></li>
          <li><code>/design:critic --all</code><span>10-critic sweep</span></li>
          <li><code>/design:critic --agent signature-moment-critic</code><span>aspiration axis only</span></li>
          <li><code>/design:rollback</code><span>undo last edit</span></li>
          <li><code>/design:screenshot</code><span>capture canvas</span></li>
          <li><code>/design:setup-docs</code><span>refresh README + INDEX</span></li>
          <li><code>/design:handoff</code><span>migrate to apps/</span></li>
        </ul>
      </details>
      <details>
        <summary>Opt-out scope</summary>
        <ul>
          <li><strong>palette</strong> <span>default — tokens + rootClass kept; local namespace overrides colors only. DS aesthetic still enforced.</span></li>
          <li><strong>aesthetic</strong> <span>palette + gradients/off-ladder radii/alt type/decorative SVG flags allowed.</span></li>
          <li><strong>full</strong> <span>DS treated as advisory. Type/radii/aesthetic up to canvas.</span></li>
          <li><em>A11y enforced at every scope</em> <span>contrast, focus, semantics, motion, touch targets — never relaxed.</span></li>
          <li>Persisted on canvas's <code>.meta.json</code> <code>opt_out_scope</code> field — subsequent <code>/design:edit</code> iterations inherit.</li>
          <li>Inferred from brief ("modern", "vibrant", "off-system") with one-shot AskUserQuestion before iter-1 critics fire.</li>
        </ul>
      </details>
      <details>
        <summary>Auto-critic loop</summary>
        <ul>
          <li><strong>Default</strong> <span>4 iter · aspiration ≥ 4.0 · stable-but-bland exit</span></li>
          <li><strong>--perfect</strong> <span>8 iter · aspiration ≥ 4.5 · broader divergence tolerance</span></li>
          <li><strong>--perfect --all</strong> <span>every critic incl. aspiration · portfolio-grade</span></li>
          <li>Exit: <code>solid</code> · <code>stable-but-bland</code> · <code>max-reached</code> · <code>divergent</code></li>
          <li><em>stable-but-bland</em> = correctness clean, aspiration plateau — surface for review with lowest 2 axes named</li>
          <li>When <code>opt_out_scope ∈ &#123;aesthetic, full&#125;</code>: iter-1 checkpoint fires — pick (a) run loop, (b) skip auto-loop and review iter 1, (c) a11y-only check.</li>
        </ul>
      </details>
      <details>
        <summary>Pin-to-element flow</summary>
        <ol>
          <li>Open canvas tab</li>
          <li><kbd>⌘</kbd>+click element</li>
          <li>Status bar shows ● selector</li>
          <li>Run <code>/design:edit "<i>change just this</i>"</code></li>
          <li>Reload iframe (<kbd>⌘R</kbd>)</li>
        </ol>
      </details>
          <details>
            <summary>Comments</summary>
            <ol>
              <li><kbd>⌘</kbd>+click element, then <kbd>⌘C</kbd> <span>or ⌘⇧+click</span></li>
              <li>Numbered pin appears on canvas</li>
              <li><kbd>⌘⇧M</kbd> <span>opens panel — All / Open / Resolved</span></li>
              <li>Click row in panel <span>jumps to that file + pin</span></li>
              <li>Claude reads <code>_comments/&lt;slug&gt;.json</code> on next <code>/design</code></li>
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

function ViewDropdown({ panels, onToggle, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onDocClick(e) {
      if (!e.target.closest('.mb-dropdown, .mb-menu')) onClose();
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDocClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDocClick);
    };
  }, [onClose]);

  return (
    <div className="mb-dropdown" role="menu" aria-label="View" style={{ left: '146px' }}>
      <div className="mb-dd-hd">Panels</div>
      {panels.map(p => (
        <button
          key={p.id}
          type="button"
          role="menuitem"
          className={'mb-dd-item' + (p.checked ? ' active' : '')}
          aria-disabled={p.disabled ? 'true' : undefined}
          onClick={() => { if (!p.disabled) { onToggle(p.id); onClose(); } }}
        >
          <span className="lbl">
            <span className="check">{p.checked ? '✓' : ''}</span>
            <span>{p.label}</span>
          </span>
          {p.phase
            ? <span className="phase-tag">{p.phase}</span>
            : <span className="shortcut">{p.shortcut || ''}</span>}
        </button>
      ))}
      <div className="mb-dd-sep" />
      <div className="mb-dd-hd">Zoom</div>
      {[
        { label: 'Zoom In',       shortcut: '⌘ +' },
        { label: 'Zoom Out',      shortcut: '⌘ −' },
        { label: 'Fit to Screen', shortcut: '⌘ 0' },
        { label: 'Actual Size · 100 %', shortcut: '⌥ ⌘ 0' },
      ].map(z => (
        <button
          key={z.label}
          type="button"
          role="menuitem"
          className="mb-dd-item"
          aria-disabled="true"
        >
          <span className="lbl"><span className="check" /><span>{z.label}</span></span>
          <span className="phase-tag">Phase 4</span>
        </button>
      ))}
    </div>
  );
}

function Menubar({ activePath, project, tabsCount, openMenu, setOpenMenu, commentsPanelOpen, onToggleComments, onOpenSystem, sidebarOpen, onToggleSidebar, showHidden, onToggleShowHidden, onOpenHelp }) {
  const isSystem = activePath === SYSTEM_TAB;
  const stamp = isSystem ? 'SYSTEM' : (activePath ? 'CANVAS' : 'IDLE');
  const fileLabel = isSystem
    ? <b>design system</b>
    : (activePath ? <>{activePath.split('/').slice(0, -1).join('/')}/<b>{displayName(basename(activePath))}</b></> : <span style={{ color: 'var(--u-fg-3)' }}>no canvas open</span>);

  const panels = [
    { id: 'tree',     label: 'Project Tree',         shortcut: 'T',     checked: sidebarOpen,        disabled: false },
    { id: 'comments', label: 'Comments Sidebar',     shortcut: '⌘ ⇧ M', checked: commentsPanelOpen,  disabled: false },
    { id: 'hidden',   label: 'Show hidden files',    shortcut: 'H',     checked: showHidden,         disabled: false },
    { id: 'layers',     label: 'Layers Panel',       phase: 'Phase 12', disabled: true },
    { id: 'inspector',  label: 'Inspector',          phase: 'Phase 12', disabled: true },
    { id: 'annotate',   label: 'Annotations',        phase: 'Phase 5',  disabled: true },
    { id: 'present',    label: 'Presentation Mode',  phase: 'Phase 6',  disabled: true },
  ];

  function onMenuClick(key) {
    if (key === 'view') {
      setOpenMenu(openMenu === key ? null : key);
    } else if (key === 'help') {
      setOpenMenu(null);
      onOpenHelp();
    }
  }

  return (
    <header className="mb" role="menubar" aria-label="Application menubar">
      <span className="mb-brand">
        <span className="dot" aria-hidden="true" />
        <span>mdcc</span>
      </span>
      <nav className="mb-menus" aria-label="Application menus">
        {MENU_NAMES.map(name => {
          const key = name.toLowerCase();
          const interactive = key === 'view' || key === 'help';
          const open = openMenu === key;
          return (
            <button
              key={key}
              type="button"
              className="mb-menu"
              role="menuitem"
              aria-haspopup={key === 'view' ? 'menu' : undefined}
              aria-expanded={key === 'view' ? open : undefined}
              aria-disabled={interactive ? undefined : 'true'}
              title={interactive ? '' : 'Coming in a later phase'}
              onClick={() => onMenuClick(key)}
            >
              {name}
            </button>
          );
        })}
      </nav>
      {openMenu === 'view' && (
        <ViewDropdown
          panels={panels}
          onToggle={id => {
            if (id === 'tree') onToggleSidebar();
            else if (id === 'comments') onToggleComments();
            else if (id === 'hidden') onToggleShowHidden();
          }}
          onClose={() => setOpenMenu(null)}
        />
      )}
      <div className="mb-spacer" />
      <div className="mb-status">
        <span className="cv-stamp">{stamp}</span>
        <span className="file" title={activePath || ''}>{fileLabel}</span>
        <span className="sep" />
        <span><span className="accent-dot">●</span> <b>{tabsCount}</b> ARTBOARDS</span>
        <span className="sep" />
        <span title="Pan/zoom in Phase 4">ZOOM <b>100%</b></span>
        <span className="sep" />
        <span className="ok"><b>{project || 'MDCC'}</b></span>
      </div>
    </header>
  );
}

function ThemeToggle({ theme, onToggle }) {
  // Show the icon of the theme you'll switch TO — clearer affordance than current state.
  // Sun + Moon paths are condensed Lucide-style (single-path so the existing <Icon> works).
  const sun = 'M12 7a5 5 0 100 10 5 5 0 000-10z M12 3v1 M12 20v1 M21 12h-1 M4 12H3 M16.95 7.05l-.71.71 M7.05 16.95l-.71.71 M16.95 16.95l-.71-.71 M7.05 7.05l-.71-.71';
  const moon = 'M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z';
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
    >
      <Icon d={theme === 'dark' ? sun : moon} size={14} />
      <span className="theme-toggle-label">{next}</span>
    </button>
  );
}

function Wordmark({ project, port, version }) {
  return (
    <div className="wm" aria-label="mdcc design server">
      <span className="wm-glyph">mdcc-design-server</span>
      <span className="wm-sub">
        <span>CANVAS · {(project || 'MDCC').toUpperCase()}</span>
        <span className="wm-sep">/</span>
        <b>v{version}</b>
        <span className="wm-sep">/</span>
        <span>localhost:{port || '4399'}</span>
      </span>
    </div>
  );
}

function SelectionHalo({ rect }) {
  // Accent 2 px outline + 4 corner ticks around the active iframe (the artboard
  // frame). In Phase 4 T1 the halo lives inside `.vp-world` and is positioned
  // at the active iframe's world coords so it scales with the world transform
  // T2 introduces. Element-level (sub-iframe) overlay waits on T7's world-coord
  // projection out of CSS px space.
  const style = rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined;
  return <div className="sel-halo" aria-hidden="true" style={style}><i /></div>;
}

// Default grid: 3 columns × 1280 × 820 artboards, 80 px gutters, alphabetical.
// Phase 4 T1 computes this in the client; T5 hands authority to the server's
// `/_api/layout/<slug>` synth + persistence.
const VP_GRID = { cols: 3, w: 1280, h: 820, gutter: 80, x0: 60, y0: 260 };

function computeDefaultGrid(tabs) {
  const layout = new Map();
  const paths = tabs.map(t => t.path).filter(p => p !== SYSTEM_TAB).sort();
  for (let i = 0; i < paths.length; i++) {
    const col = i % VP_GRID.cols;
    const row = Math.floor(i / VP_GRID.cols);
    layout.set(paths[i], {
      x: VP_GRID.x0 + col * (VP_GRID.w + VP_GRID.gutter),
      y: VP_GRID.y0 + row * (VP_GRID.h + VP_GRID.gutter),
      w: VP_GRID.w,
      h: VP_GRID.h,
    });
  }
  return layout;
}

// Fit-to-screen world transform. bbox = union of artboard rects only (the
// in-world Wordmark is intentionally outside the bbox so a single open canvas
// can fill the panel; Wordmark becomes a pan-to-find detail at full zoom-out).
// Phase 4 T1 = fit IS the canvas state; T2's controller treats Cmd+0 as
// "re-invoke this same compute" after a user pan/zoom dirties it.
const VP_FIT_PAD = 24;

function computeFit(layout, viewportEl) {
  if (!layout || layout.size === 0 || !viewportEl) return null;
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const r of layout.values()) {
    if (r.x < xMin) xMin = r.x;
    if (r.y < yMin) yMin = r.y;
    if (r.x + r.w > xMax) xMax = r.x + r.w;
    if (r.y + r.h > yMax) yMax = r.y + r.h;
  }
  const bw = xMax - xMin;
  const bh = yMax - yMin;
  const vw = viewportEl.clientWidth;
  const vh = viewportEl.clientHeight;
  if (!vw || !vh || bw <= 0 || bh <= 0) return null;
  const zoom = Math.min((vw - VP_FIT_PAD * 2) / bw, (vh - VP_FIT_PAD * 2) / bh, 1.0);
  // Translate so the bbox is centered in the viewport. transform-origin is 0,0
  // so we offset by -bbox_origin*zoom to bring the bbox into view, then add the
  // centering margin.
  const x = (vw - bw * zoom) / 2 - xMin * zoom;
  const y = (vh - bh * zoom) / 2 - yMin * zoom;
  return { x, y, zoom };
}

function Viewport({ tabs, activePath, registerIframe, systemData, onOpenFromSystem, project, selected, cfg }) {
  const port = typeof window !== 'undefined' ? window.location.port : '';
  const hasArtboards = tabs.some(t => t.path !== SYSTEM_TAB);
  const hasSystemTab = tabs.some(t => t.path === SYSTEM_TAB);
  const layout = hasArtboards ? computeDefaultGrid(tabs) : null;
  const showHalo = selected && activePath && activePath !== SYSTEM_TAB && layout && layout.has(activePath);
  const haloRect = showHalo ? layout.get(activePath) : null;
  const viewportRef = useRef(null);
  const [fit, setFit] = useState(null);
  const tabsKey = tabs.map(t => t.path).join('|');
  useLayoutEffect(() => {
    if (!hasArtboards || !viewportRef.current) { setFit(null); return; }
    const measure = () => setFit(computeFit(layout, viewportRef.current));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsKey, hasArtboards]);
  const worldStyle = fit
    ? { transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.zoom})` }
    : { visibility: 'hidden' };
  return (
    <div className="viewport" ref={viewportRef}>
      {!hasArtboards && (
        <>
          <Wordmark project={project} port={port} version={MDCC_VERSION} />
          <div className="empty-state">
            <div className="big">No mock open</div>
            <div className="small">
              ← Click a <code>.tsx</code> (or legacy <code>.html</code>) file in the tree, or open the <strong>Design system</strong> view above it.
              <br /><br />
              Tabs work like in an editor — close with the × on each tab. <kbd>⌘R</kbd> reloads the active iframe.
              <br /><br />
              <strong>Element selection:</strong> hold <kbd>⌘</kbd> inside the canvas and hover. <kbd>⌘</kbd>+click selects, <kbd>⌘⇧</kbd>+click adds a comment.
              <br /><br />
              Active file, selection, and comments are tracked in <code>_active.json</code> + <code>_comments/</code> — Claude reads them when you run <code>/design</code>.
            </div>
          </div>
        </>
      )}
      {hasArtboards && (
        <div className="vp-world" style={worldStyle}>
          <Wordmark project={project} port={port} version={MDCC_VERSION} />
          {tabs.map(t => {
            if (t.path === SYSTEM_TAB) return null;
            const r = layout.get(t.path);
            return (
              <iframe
                key={t.path}
                ref={el => registerIframe(t.path, el)}
                src={canvasUrl(t.path, cfg)}
                className={t.path === activePath ? 'active' : ''}
                data-path={t.path}
                style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
              />
            );
          })}
          {showHalo && <SelectionHalo rect={haloRect} />}
        </div>
      )}
      {hasSystemTab && (
        <div className={'system-view' + (activePath === SYSTEM_TAB ? ' active' : '')}>
          <SystemView data={systemData} onOpen={onOpenFromSystem} />
        </div>
      )}
    </div>
  );
}

// ---------- SystemView ----------

const TOKEN_NAMES = [
  '--bg-0', '--bg-1', '--bg-2', '--bg-3', '--bg-4',
  '--fg-0', '--fg-1', '--fg-2', '--fg-3',
  '--accent', '--accent-hover', '--accent-active', '--accent-fg', '--accent-tint',
  '--status-success', '--status-warn', '--status-error', '--status-info',
  '--border-subtle', '--border-default', '--border-strong',
];
const TYPE_STEPS = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'];

function readTokens(names) {
  if (typeof window === 'undefined') return names.map(name => ({ name, value: '' }));
  const cs = getComputedStyle(document.documentElement);
  return names.map(name => ({ name, value: cs.getPropertyValue(name).trim() }));
}

function TokenLadder() {
  const [tokens, setTokens] = useState(() => readTokens(TOKEN_NAMES));
  useEffect(() => {
    setTokens(readTokens(TOKEN_NAMES));
    const obs = new MutationObserver(() => setTokens(readTokens(TOKEN_NAMES)));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return (
    <section className="sv-section sv-section-tokens">
      <h2>tokens · surfaces & ink<span className="sv-h-num">{tokens.length}</span></h2>
      <div className="sv-tokens-ladder">
        {tokens.map(t => (
          <div className="sv-tok-cell" key={t.name}>
            <div className="sv-tok-swatch" style={{ background: `var(${t.name})` }} />
            <div className="sv-tok-meta">
              <code className="sv-tok-name">{t.name}</code>
              <span className="sv-tok-value">{t.value || '—'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TypeLadder() {
  return (
    <section className="sv-section sv-section-type">
      <h2>type · 8-step ladder<span className="sv-h-num">{TYPE_STEPS.length}</span></h2>
      <div className="sv-type-list">
        {TYPE_STEPS.map(s => (
          <div className="sv-type-row" key={s}>
            <code className="sv-type-tok">--type-{s}</code>
            <span className="sv-type-sample" style={{ fontSize: `var(--type-${s})`, lineHeight: `var(--lh-${s})` }}>
              The catalog is the system.
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SystemView({ data, onOpen }) {
  if (!data) {
    return <div className="sv-empty"><p>Loading design system…</p></div>;
  }
  const { previewGallery, uiKitsGallery, systemDir } = data;
  const empty = (!previewGallery || !previewGallery.length) && (!uiKitsGallery || !uiKitsGallery.length);

  return (
    <div className="sv">
      <header className="sv-header">
        <span className="sv-sku">MDCC-DSN/01</span>
        <span className="sv-title">design system view</span>
        <span className="sv-loc"><code>{systemDir}</code></span>
      </header>

      <TokenLadder />
      <TypeLadder />

      {empty ? (
        <div className="sv-empty">
          <p>No <code>preview/</code> or <code>ui_kits/</code> folders found under <code>{systemDir}</code>.</p>
        </div>
      ) : (
        <>
          <Gallery title="preview" items={previewGallery} onOpen={onOpen} kind="preview" />
          <Gallery title="ui kits"  items={uiKitsGallery}  onOpen={onOpen} kind="ui_kits" />
        </>
      )}
    </div>
  );
}

function Gallery({ title, items, onOpen, kind }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="sv-section">
      <h2>{title} <span className="sv-count">{items.length}</span></h2>
      <div className={'sv-previews sv-previews-' + kind}>
        {items.map(p => (
          <article key={p.path} className="sv-preview-card" onClick={() => onOpen(p.path)}>
            <div className="sv-preview-frame">
              <iframe src={urlOf(p.path)} title={p.label} scrolling="no" />
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

function CommentBar({ activePath, selected, comments, focusedId, draft, setDraft, onSubmit, onCancel, onResolve, onReopen, onDelete, onFocusPin }) {
  if (!activePath) return null;
  const focused = focusedId ? comments.find(c => c.id === focusedId) : null;
  const openComments = (comments || []).filter(c => c.status !== 'resolved');
  return (
    <div className="comment-bar">
      {draft && draft.file === activePath && (
        <div className="composer">
          <div className="composer-head">
            <span className="cb-label">Comment on</span>
            <code className="composer-selector" title={(draft.dom_path || []).join(' > ')}>{draft.selector || '(canvas)'}</code>
          </div>
          <textarea
            autoFocus
            className="composer-textarea"
            value={draft.text}
            placeholder="What should change here? (⌘↵ save · Esc cancel)"
            onChange={e => setDraft({ ...draft, text: e.target.value })}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmit(); }
              else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }}
            rows={4}
          />
          <div className="composer-actions">
            <button className="cb-secondary" onClick={onCancel}>Cancel</button>
            <button className="cb-primary" disabled={!draft.text.trim()} onClick={onSubmit}>Save · ⌘↵</button>
          </div>
        </div>
      )}

      {focused && (
        <div className="cb-row focused">
          <span className="cb-pinno">#{(comments || []).filter(c => c.selector).findIndex(c => c.id === focused.id) + 1}</span>
          <span className="cb-text">{focused.text}</span>
          <span className="cb-target" title={focused.dom_path ? focused.dom_path.join(' > ') : ''}>
            <code>{focused.selector || '—'}</code>
          </span>
          {focused.status === 'resolved'
            ? <button className="cb-secondary" onClick={() => onReopen(focused.id)}>Reopen</button>
            : <button className="cb-primary" onClick={() => onResolve(focused.id)}>✓ Resolve</button>}
          <button className="cb-secondary" onClick={() => onDelete(focused.id)}>Delete</button>
        </div>
      )}

      {!draft && !focused && openComments.length > 0 && (
        <div className="cb-row strip">
          <span className="cb-label">{openComments.length} open comment{openComments.length === 1 ? '' : 's'}</span>
          <div className="cb-pin-strip">
            {openComments.slice(0, 12).map((c, i) => (
              <button key={c.id} className="cb-pin-chip" title={c.text} onClick={() => onFocusPin(c.id)}>
                {i + 1}
              </button>
            ))}
            {openComments.length > 12 && <span className="cb-more">+{openComments.length - 12}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBarSlot({ label, children, className = '' }) {
  return (
    <span className={'sb-slot ' + className} role="group" aria-label={label}>
      {children}
    </span>
  );
}

function StatusBar({ activePath, selected, wsConnected, openCount, theme, onToggleTheme, onClearSelected, onAddComment, hasDraft }) {
  const isSystem = activePath === SYSTEM_TAB;
  const text = selected && selected.selector
    ? selected.selector + (selected.text ? ` — "${selected.text.slice(0, 60)}"` : '')
    : '';
  const title = selected && selected.dom_path ? selected.dom_path.join(' > ') : (selected ? selected.selector : '');
  return (
    <div className="statusbar" role="contentinfo">
      <StatusBarSlot label="Active file" className="sb-active">
        <span className="sb-key">active</span>
        <span className="sb-file" title={activePath || ''}>
          {isSystem ? '▦ design system' : (activePath || '—')}
        </span>
      </StatusBarSlot>

      {selected && selected.selector && !isSystem && (
        <StatusBarSlot label="Selected element" className="sb-selected">
          <span className="sb-dot" aria-hidden="true">●</span>
          <span className="sb-sel-text" title={title}>{text}</span>
          {!hasDraft && (
            <button type="button" className="sb-add-comment" onClick={onAddComment} title="Add comment on selected element (⌘⇧+click in canvas)">+ comment</button>
          )}
          <button type="button" className="sb-clear-sel" onClick={onClearSelected} title="Clear (Esc inside iframe)" aria-label="Clear selection">×</button>
        </StatusBarSlot>
      )}

      <StatusBarSlot label="Open comments" className="sb-unread">
        <span className="sb-key">comments</span>
        <span className="sb-count">{openCount}</span>
      </StatusBarSlot>

      <StatusBarSlot label="Connection" className="sb-live">
        <span className={'sb-live-dot' + (wsConnected ? ' connected' : '')} aria-hidden="true" />
        <span className="sb-key">{wsConnected ? 'live' : 'reconnecting'}</span>
      </StatusBarSlot>

      <span className="sb-spacer" />

      <StatusBarSlot label="Theme" className="sb-theme">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </StatusBarSlot>
    </div>
  );
}

// ---------- Right sidebar — Comments panel ----------

function CommentsPanel({ commentsByFile, filter, setFilter, activePath, focusedId, onJump, onResolve, onReopen, onDelete }) {
  const counts = totalCounts(commentsByFile);
  // Build groups: [{ file, comments: filtered }]
  const files = Object.keys(commentsByFile || {}).sort();
  const groups = [];
  for (const f of files) {
    const all = commentsByFile[f] || [];
    const filtered = all.filter(c => {
      if (filter === 'open') return c.status !== 'resolved';
      if (filter === 'resolved') return c.status === 'resolved';
      return true;
    });
    if (filtered.length === 0) continue;
    // Number is fixed by all-list order so it matches pin numbers (which are based on position in the array of selector-having comments)
    const numberedAll = all.filter(c => c.selector);
    groups.push({
      file: f,
      comments: filtered.map(c => ({
        ...c,
        n: numberedAll.findIndex(x => x.id === c.id) + 1,
      })),
    });
  }

  return (
    <aside className="rsidebar">
      <div className="rsidebar-header">
        <h2>
          <span>Comments</span>
          <span className="total">{counts.all}</span>
        </h2>
        <div className="rsidebar-filters" role="tablist">
          <button
            className={'rsidebar-filter' + (filter === 'all' ? ' active' : '')}
            role="tab" aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
          >All <span className="fc">{counts.all}</span></button>
          <button
            className={'rsidebar-filter' + (filter === 'open' ? ' active' : '')}
            role="tab" aria-selected={filter === 'open'}
            onClick={() => setFilter('open')}
          >Open <span className="fc">{counts.open}</span></button>
          <button
            className={'rsidebar-filter' + (filter === 'resolved' ? ' active' : '')}
            role="tab" aria-selected={filter === 'resolved'}
            onClick={() => setFilter('resolved')}
          >Resolved <span className="fc">{counts.resolved}</span></button>
        </div>
      </div>
      <div className="rsidebar-body">
        {groups.length === 0 ? (
          <div className="rsidebar-empty">
            <p>No comments {filter !== 'all' ? `with status “${filter}”` : 'yet'}.</p>
            <p style={{ marginTop: 12 }}>Open a canvas, hold <kbd>⌘</kbd> and click an element, then press <kbd>C</kbd> — or hold <kbd>⌘⇧</kbd> and click directly.</p>
          </div>
        ) : groups.map(g => (
          <div key={g.file} className="rs-group">
            <button
              className="rs-group-h"
              onClick={() => onJump(g.file, null)}
              title={g.file}
            >
              <span className="rs-group-name">{displayName(basename(g.file))}</span>
              <span className="rs-group-count">{g.comments.length}</span>
            </button>
            {g.comments.map(c => (
              <div
                key={c.id}
                className={'rs-comment' + (c.status === 'resolved' ? ' resolved' : '') + (c.id === focusedId ? ' active-pin' : '')}
                onClick={() => onJump(g.file, c.id)}
              >
                <div className="rs-comment-head">
                  <span className="rs-num">{c.n || '·'}</span>
                  <span className="rs-time">{timeAgo(c.created)}</span>
                </div>
                <div className="rs-comment-text">{c.text}</div>
                <div className="rs-comment-foot">
                  <code title={(c.dom_path || []).join(' > ')}>{c.selector || '—'}</code>
                  <div className="rs-comment-actions">
                    {c.status === 'resolved'
                      ? <button className="rs-act" onClick={e => { e.stopPropagation(); onReopen(c.id); }}>↺</button>
                      : <button className="rs-act" onClick={e => { e.stopPropagation(); onResolve(c.id); }}>✓</button>}
                    <button className="rs-act danger" onClick={e => { e.stopPropagation(); onDelete(c.id); }}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
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
        setCfg({
          designRel,
          tokensCssRel: data.tokensCssRel,
          // Pass through designSystems so canvasUrl can resolve the right
          // tokens/components paths per-DS. Top-level tokensCssRel is the
          // legacy default; designSystems[0].tokensCssRel is the project's
          // authoritative value (post DS-bootstrap).
          designSystems: data.designSystems,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [commentsByFile, setCommentsByFile] = useState({});      // { file: [Comment] }
  const [draft, setDraft] = useState(null);                       // { file, selector, dom_path, bounds, tag, classes, html, text }
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [commentsFilter, setCommentsFilter] = useState('open');   // 'all' | 'open' | 'resolved'
  const [theme, setTheme] = useState(readInitialTheme);
  const [openMenu, setOpenMenu] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => readBoolStore(SIDEBAR_STORE, true));
  const [showHidden, setShowHidden] = useState(() => readBoolStore(SHOW_HIDDEN_STORE, false));
  const [sectionsExpanded, setSectionsExpanded] = useState(() => readJsonStore(SECTIONS_STORE, {}));
  const [helpOpen, setHelpOpen] = useState(false);
  const wsRef = useRef(null);
  const iframesRef = useRef(new Map());

  // Sync theme to <html data-theme> + localStorage on every change.
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_STORE, theme);
    } catch {}
  }, [theme]);

  // Persist sidebar / hidden-files / DS-body toggles. Mirror theme pattern.
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_STORE, sidebarOpen ? '1' : '0'); } catch {}
  }, [sidebarOpen]);
  useEffect(() => {
    try { localStorage.setItem(SHOW_HIDDEN_STORE, showHidden ? '1' : '0'); } catch {}
  }, [showHidden]);
  useEffect(() => {
    try { localStorage.setItem(SECTIONS_STORE, JSON.stringify(sectionsExpanded)); } catch {}
  }, [sectionsExpanded]);

  const toggleSection = useCallback((label, defaultOpen) => {
    setSectionsExpanded(prev => {
      const cur = prev[label];
      const isOpen = cur === undefined ? defaultOpen : cur;
      return { ...prev, [label]: !isOpen };
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // ----- Tree -----
  const loadTree = useCallback(async () => {
    try {
      const r = await fetch('/_index-data');
      const data = await r.json();
      setProject(data.project || 'Design');
      const built = data.groups.map(g => ({
        ...g,
        tree: buildTree(g.paths, g.stripPrefix),
      }));
      setGroups(built);
    } catch (e) {
      console.error('failed to load tree', e);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // ----- System data (lazy) -----
  const loadSystemData = useCallback(async () => {
    try {
      const r = await fetch('/_system-data');
      const data = await r.json();
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

  useEffect(() => { loadAllComments(); }, [loadAllComments]);

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
      ws.addEventListener('message', e => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === 'snapshot' && m.state) {
            setSelected(m.state.selected);
          } else if (m.type === 'selected') {
            setSelected(m.selected);
          } else if (m.type === 'comments' && typeof m.file === 'string') {
            setCommentsByFile(prev => ({ ...prev, [m.file]: m.comments || [] }));
          }
        } catch {}
      });
    }
    connect();
    return () => wsRef.current && wsRef.current.close();
  }, []);

  function wsSend(obj) {
    const ws = wsRef.current;
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch {}
  }

  // ----- Tab management (single-canvas) -----
  // Single-canvas model: opening a file REPLACES the active one (no tab strip).
  // Phase 4 T1: multi-tab. If the path is already open, just activate it;
  // otherwise append. Existing iframes stay mounted so the infinite-canvas
  // plane can render them side-by-side without reload churn. Tab close path
  // (`closeTab`) handles iframe cleanup.
  const openTab = useCallback((path) => {
    setTabs(prev => prev.find(t => t.path === path) ? prev : [...prev, { path }]);
    setActivePath(path);
    setFocusedCommentId(null);
    setDraft(null);
  }, []);

  const openSystem = useCallback(() => {
    if (!systemData) loadSystemData();
    openTab(SYSTEM_TAB);
  }, [systemData, loadSystemData, openTab]);

  useEffect(() => {
    wsSend({ type: 'tabs', tabs: tabs.map(t => t.path).filter(p => p !== SYSTEM_TAB) });
  }, [tabs]);

  useEffect(() => {
    if (activePath && activePath !== SYSTEM_TAB) wsSend({ type: 'active', file: activePath });
    else if (activePath === SYSTEM_TAB) wsSend({ type: 'active', file: '' });
    else wsSend({ type: 'active', file: '' });
  }, [activePath]);

  const closeTab = useCallback((path) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.path === path);
      if (idx < 0) return prev;
      const next = prev.filter(t => t.path !== path);
      if (path === activePath) {
        if (next.length === 0) setActivePath(null);
        else setActivePath(next[Math.max(0, idx - 1)].path);
      }
      return next;
    });
    iframesRef.current.delete(path);
  }, [activePath]);

  const reloadActive = useCallback(() => {
    if (!activePath || activePath === SYSTEM_TAB) {
      if (activePath === SYSTEM_TAB) loadSystemData();
      return;
    }
    const el = iframesRef.current.get(activePath);
    if (el) el.src = el.src;
  }, [activePath, loadSystemData]);

  const reloadTree = useCallback(() => loadTree(), [loadTree]);

  const clearSelected = useCallback(() => {
    wsSend({ type: 'clear-select' });
    setSelected(null);
    if (activePath && activePath !== SYSTEM_TAB) {
      const el = iframesRef.current.get(activePath);
      if (el && el.contentWindow) {
        try { el.contentWindow.postMessage({ dgn: 'force-clear' }, '*'); } catch {}
      }
    }
  }, [activePath]);

  // ----- Push comments to iframe whenever they change for active file -----
  useEffect(() => {
    if (!activePath || activePath === SYSTEM_TAB) return;
    const el = iframesRef.current.get(activePath);
    if (!el || !el.contentWindow) return;
    const list = commentsByFile[activePath] || [];
    try { el.contentWindow.postMessage({ dgn: 'comments-set', comments: list }, '*'); } catch {}
  }, [activePath, commentsByFile]);

  // ----- Comment composer helpers -----
  // Declared BEFORE the inbound-message useEffect that references them — under
  // ES build (no var-style hoisting) these are real TDZ violations otherwise.
  const startDraftFor = useCallback((sel) => {
    const file = (sel && sel.file) || activePath;
    if (!file || file === SYSTEM_TAB) return;
    setDraft({
      file,
      selector: sel?.selector || '',
      dom_path: sel?.dom_path || [],
      tag: sel?.tag || '',
      classes: sel?.classes || '',
      bounds: sel?.bounds || null,
      html: sel?.html || '',
      text: '',
    });
    setFocusedCommentId(null);
  }, [activePath]);

  const startDraftFromSelection = useCallback(() => {
    if (!selected || !selected.selector) return;
    startDraftFor(selected);
  }, [selected, startDraftFor]);

  // ----- Inbound messages from iframes -----
  useEffect(() => {
    function onMessage(e) {
      const m = e.data;
      if (!m || typeof m !== 'object' || !m.dgn) return;
      if (m.dgn === 'select' && m.selection) {
        wsSend({ type: 'select', selection: m.selection });
        setSelected(m.selection);
      } else if (m.dgn === 'clear-select') {
        wsSend({ type: 'clear-select' });
        setSelected(null);
      } else if (m.dgn === 'comment-compose' && m.selection) {
        // Cmd+Shift+click in iframe → start composer for that element
        startDraftFor(m.selection);
      } else if (m.dgn === 'comment-shortcut') {
        // Cmd+C inside iframe (parent's window keydown can't fire while
        // iframe has focus). Use current `selected` state.
        startDraftFromSelection();
      } else if (m.dgn === 'comment-click' && m.id) {
        setFocusedCommentId(m.id);
      } else if (m.dgn === 'loaded' && m.file) {
        // iframe finished loading — push current comments + carry over focused pin if any
        const list = commentsByFile[m.file] || [];
        const el = [...iframesRef.current.entries()].find(([k]) => k === m.file)?.[1];
        if (el && el.contentWindow) {
          try { el.contentWindow.postMessage({ dgn: 'comments-set', comments: list }, '*'); } catch {}
          if (focusedCommentId && list.some(c => c.id === focusedCommentId)) {
            try { el.contentWindow.postMessage({ dgn: 'comment-focus', id: focusedCommentId }, '*'); } catch {}
          }
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [commentsByFile, focusedCommentId, startDraftFromSelection, startDraftFor]);

  const submitDraft = useCallback(() => {
    if (!draft || !draft.text.trim()) return;
    wsSend({ type: 'comments-add', payload: {
      file: draft.file,
      selector: draft.selector,
      dom_path: draft.dom_path,
      tag: draft.tag,
      classes: draft.classes,
      bounds: draft.bounds,
      html_excerpt: draft.html,
      text: draft.text.trim(),
    }});
    setDraft(null);
  }, [draft]);

  const cancelDraft = useCallback(() => setDraft(null), []);

  const resolveComment = useCallback((id) => {
    wsSend({ type: 'comments-patch', id, patch: { status: 'resolved' } });
  }, []);
  const reopenComment = useCallback((id) => {
    wsSend({ type: 'comments-patch', id, patch: { status: 'open' } });
  }, []);
  const deleteComment = useCallback((id) => {
    wsSend({ type: 'comments-delete', id });
    setFocusedCommentId(prev => (prev === id ? null : prev));
  }, []);

  const focusPinFromBar = useCallback((id) => {
    setFocusedCommentId(id);
    if (activePath && activePath !== SYSTEM_TAB) {
      const el = iframesRef.current.get(activePath);
      if (el && el.contentWindow) {
        try { el.contentWindow.postMessage({ dgn: 'comment-focus', id }, '*'); } catch {}
      }
    }
  }, [activePath]);

  // Jump from right-sidebar list to a comment: open file tab if needed, focus pin.
  // The iframe may be freshly mounted; the loaded handler also re-sends focus if focusedCommentId matches.
  const jumpToComment = useCallback((file, id) => {
    if (file && file !== activePath) {
      setTabs(prev => prev.find(t => t.path === file) ? prev : [...prev, { path: file }]);
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
        try { el.contentWindow.postMessage({ dgn: 'comment-focus', id }, '*'); } catch {}
      }
    };
    send();
    setTimeout(send, 200);
  }, [activePath]);

  // ----- Keyboard shortcuts (no Cmd+W — let browser close the tab) -----
  useEffect(() => {
    function onKey(e) {
      const meta = e.metaKey || e.ctrlKey;
      const inEditable = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;

      // Cmd+R — reload active iframe (override browser reload)
      if (meta && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        reloadActive();
        return;
      }
      // Cmd+Shift+M / Ctrl+Shift+M — toggle right "Comments" panel
      if (meta && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setCommentsPanelOpen(v => !v);
        return;
      }
      // Cmd+C / Ctrl+C — comment on currently selected element (overrides system copy when something is selected)
      if (meta && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (selected && selected.selector && activePath && activePath !== SYSTEM_TAB && !inEditable) {
          e.preventDefault();
          startDraftFromSelection();
          return;
        }
        // No selection — fall through so browser's normal copy still works
      }
      if (inEditable) return;
      // / — focus search (or ⌘F per CV-08 placeholder hint)
      if (e.key === '/') {
        e.preventDefault();
        const inp = document.querySelector('.tree-panel-search input');
        if (inp) inp.focus();
        return;
      }
      if (meta && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        if (!sidebarOpen) setSidebarOpen(true);
        setTimeout(() => {
          const inp = document.querySelector('.tree-panel-search input');
          if (inp) inp.focus();
        }, 0);
        return;
      }
      // T — toggle Project Tree (sidebar)
      if (e.key === 't' || e.key === 'T') {
        if (e.shiftKey || meta) return;
        e.preventDefault();
        setSidebarOpen(v => !v);
        return;
      }
      // H — toggle show-hidden (sidecars + project/runtime orphans)
      if (e.key === 'h' || e.key === 'H') {
        if (e.shiftKey || meta) return;
        e.preventDefault();
        setShowHidden(v => !v);
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
      // ? or F1 — open Help modal
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      // Esc — close composer (in addition to its own textarea handler) or clear focused pin
      if (e.key === 'Escape') {
        if (draft) { setDraft(null); return; }
        if (focusedCommentId) { setFocusedCommentId(null); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reloadActive, selected, activePath, startDraftFromSelection, draft, focusedCommentId, sidebarOpen, openSystem, closeTab]);

  const registerIframe = useCallback((path, el) => {
    if (el) iframesRef.current.set(path, el);
  }, []);

  const activeFileComments = (activePath && activePath !== SYSTEM_TAB) ? (commentsByFile[activePath] || []) : [];
  const totalOpen = totalCounts(commentsByFile).open;

  return (
    <div className={'app' + (commentsPanelOpen ? ' with-rsidebar' : '') + (sidebarOpen ? '' : ' no-sidebar')}>
      <Sidebar
        groups={groups}
        activePath={activePath}
        onOpen={openTab}
        onOpenSystem={openSystem}
        wsConnected={wsConnected}
        search={search}
        setSearch={setSearch}
        commentsByFile={commentsByFile}
        showHidden={showHidden}
        sectionsExpanded={sectionsExpanded}
        onToggleSection={toggleSection}
      />
      <div className="main">
        <Menubar
          activePath={activePath}
          project={project}
          tabsCount={tabs.length}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          commentsPanelOpen={commentsPanelOpen}
          onToggleComments={() => setCommentsPanelOpen(v => !v)}
          onOpenSystem={openSystem}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          showHidden={showHidden}
          onToggleShowHidden={() => setShowHidden(v => !v)}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <Viewport
          tabs={tabs}
          activePath={activePath}
          registerIframe={registerIframe}
          systemData={systemData}
          onOpenFromSystem={openTab}
          project={project}
          selected={selected}
          cfg={cfg}
        />
        {activePath && activePath !== SYSTEM_TAB && (
          <CommentBar
            activePath={activePath}
            selected={selected}
            comments={activeFileComments}
            focusedId={focusedCommentId}
            draft={draft && draft.file === activePath ? draft : null}
            setDraft={setDraft}
            onSubmit={submitDraft}
            onCancel={cancelDraft}
            onResolve={resolveComment}
            onReopen={reopenComment}
            onDelete={deleteComment}
            onFocusPin={focusPinFromBar}
          />
        )}
        <StatusBar
          activePath={activePath}
          selected={selected}
          wsConnected={wsConnected}
          openCount={totalOpen}
          theme={theme}
          onToggleTheme={toggleTheme}
          onClearSelected={clearSelected}
          onAddComment={startDraftFromSelection}
          hasDraft={!!(draft && draft.file === activePath)}
        />
      </div>
      {commentsPanelOpen && (
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
      )}
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
