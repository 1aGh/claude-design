// Design plugin local browser — React UI.
// Bundled via Bun.build (DDR-009/012) — IIFE, tree-shaken, React 19 from npm.
// Renders: file tree, tabs, viewport (iframes), status bar, design-system view, comments.
// Universal — no project tokens needed; styling lives in client/styles/.

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { createRoot } from 'react-dom/client';

const SYSTEM_TAB = '__system__';
const THEME_STORE = 'mdcc-theme';

function readInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORE);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  // Match the data-theme attribute index.html ships with (dark).
  return 'dark';
}

// ---------- Utility ----------

function urlOf(p) {
  return '/' + p.split('/').map(encodeURIComponent).join('/');
}

function basename(p) {
  return p.split('/').pop();
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

function Tree({ node, activePath, onOpen, commentsByFile, depth = 0 }) {
  const dirs = Object.keys(node).filter(k => k !== '_files').sort();
  return (
    <Fragment>
      {dirs.map(d => (
        <details key={d} open={depth < 2}>
          <summary>{d}</summary>
          <Tree node={node[d]} activePath={activePath} onOpen={onOpen} commentsByFile={commentsByFile} depth={depth + 1} />
        </details>
      ))}
      {node._files && (
        <ul className="tree-files">
          {[...node._files].sort((a, b) => a.name.localeCompare(b.name)).map(f => {
            const oc = openCount(commentsByFile[f.path]);
            return (
              <li key={f.path}>
                <button
                  className={'tree-file' + (f.path === activePath ? ' active' : '')}
                  title={f.path + (oc ? ` — ${oc} open comment${oc === 1 ? '' : 's'}` : '')}
                  onClick={() => onOpen(f.path)}
                >
                  <span className="tf-name">{f.name}</span>
                  {oc > 0 && <span className="tf-badge">{oc}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Fragment>
  );
}

function Sidebar({ groups, activePath, onOpen, onOpenSystem, wsConnected, project, search, setSearch, commentsByFile }) {
  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups.map(g => ({ ...g, tree: filterTree(g.tree, search), filtered: !!search }));
  }, [groups, search]);

  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="brand-mark">{(project || 'D')[0].toUpperCase()}</div>
        <div className="brand-title">{project || 'Design'}</div>
        <div className={'brand-status' + (wsConnected ? ' connected' : '')} title={wsConnected ? 'WebSocket connected' : 'WebSocket disconnected'}/>
      </div>

      <button
        className={'system-link' + (activePath === SYSTEM_TAB ? ' active' : '')}
        onClick={onOpenSystem}
        title="View the project's design system on a single page"
      >
        <span className="sl-glyph">▦</span>
        <span className="sl-label">Design system</span>
        <span className="sl-arrow">→</span>
      </button>

      <div className="search">
        <Icon d="M21 21l-4.35-4.35 M11 19a8 8 0 100-16 8 8 0 000 16z" size={12} />
        <input
          type="text"
          placeholder="filter…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search ? (
          <button className="search-clear" onClick={() => setSearch('')} title="Clear (Esc)" aria-label="Clear search">×</button>
        ) : (
          <span className="search-kbd" aria-hidden="true">/</span>
        )}
      </div>

      <div className="tree">
        {filteredGroups.map(g => (
          <section className="tree-section" key={g.label}>
            <h2 className="tree-h2">
              {g.label}
              <span className="count">{g.paths.length}</span>
            </h2>
            {g.tree ? (
              <Tree node={g.tree} activePath={activePath} onOpen={onOpen} commentsByFile={commentsByFile} />
            ) : g.paths.length === 0 ? (
              <p className="tree-empty">No HTML in <code>{g.fullPath}</code>.</p>
            ) : search ? (
              <p className="tree-empty">No matches.</p>
            ) : null}
          </section>
        ))}
      </div>

      <Cheatsheet />
    </nav>
  );
}

function Cheatsheet() {
  return (
    <div className="cheatsheet">
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
  );
}

function Tabs({ tabs, activePath, onActivate, onClose }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <div
          key={t.path}
          className={'tab' + (t.path === activePath ? ' active' : '') + (t.path === SYSTEM_TAB ? ' tab-system' : '')}
          title={t.path === SYSTEM_TAB ? 'Design system overview' : t.path}
          onClick={e => {
            if (e.target.classList.contains('close')) {
              onClose(t.path);
              return;
            }
            onActivate(t.path);
          }}
        >
          <span className="name">{t.path === SYSTEM_TAB ? '▦ Design system' : basename(t.path)}</span>
          <button className="close" title="Close">×</button>
        </div>
      ))}
    </div>
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

function Viewport({ tabs, activePath, registerIframe, systemData, onOpenFromSystem }) {
  return (
    <div className="viewport">
      {tabs.length === 0 && (
        <div className="empty-state">
          <div className="big">No mock open</div>
          <div className="small">
            ← Click a <code>.html</code> file in the tree, or open the <strong>Design system</strong> view above it.
            <br /><br />
            Tabs work like in an editor — close with the × on each tab. <kbd>⌘R</kbd> reloads the active iframe.
            <br /><br />
            <strong>Element selection:</strong> hold <kbd>⌘</kbd> inside the canvas and hover. <kbd>⌘</kbd>+click selects, <kbd>⌘⇧</kbd>+click adds a comment.
            <br /><br />
            Active file, selection, and comments are tracked in <code>_active.json</code> + <code>_comments/</code> — Claude reads them when you run <code>/design</code>.
          </div>
        </div>
      )}
      {tabs.map(t => {
        if (t.path === SYSTEM_TAB) {
          return (
            <div key={t.path} className={'system-view' + (t.path === activePath ? ' active' : '')}>
              <SystemView data={systemData} onOpen={onOpenFromSystem} />
            </div>
          );
        }
        return (
          <iframe
            key={t.path}
            ref={el => registerIframe(t.path, el)}
            src={urlOf(t.path)}
            className={t.path === activePath ? 'active' : ''}
            data-path={t.path}
          />
        );
      })}
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
              <span className="rs-group-name">{basename(g.file)}</span>
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
  const [commentsByFile, setCommentsByFile] = useState({});      // { file: [Comment] }
  const [draft, setDraft] = useState(null);                       // { file, selector, dom_path, bounds, tag, classes, html, text }
  const [focusedCommentId, setFocusedCommentId] = useState(null);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [commentsFilter, setCommentsFilter] = useState('open');   // 'all' | 'open' | 'resolved'
  const [theme, setTheme] = useState(readInitialTheme);
  const wsRef = useRef(null);
  const iframesRef = useRef(new Map());

  // Sync theme to <html data-theme> + localStorage on every change.
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_STORE, theme);
    } catch {}
  }, [theme]);

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

  // ----- Tab management -----
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
      // / — focus search
      if (e.key === '/') {
        e.preventDefault();
        const inp = document.querySelector('.search input');
        if (inp) inp.focus();
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
  }, [reloadActive, selected, activePath, startDraftFromSelection, draft, focusedCommentId]);

  const registerIframe = useCallback((path, el) => {
    if (el) iframesRef.current.set(path, el);
  }, []);

  const activeFileComments = (activePath && activePath !== SYSTEM_TAB) ? (commentsByFile[activePath] || []) : [];
  const totalOpen = totalCounts(commentsByFile).open;

  return (
    <div className={'app' + (commentsPanelOpen ? ' with-rsidebar' : '')}>
      <Sidebar
        groups={groups}
        activePath={activePath}
        onOpen={openTab}
        onOpenSystem={openSystem}
        wsConnected={wsConnected}
        project={project}
        search={search}
        setSearch={setSearch}
        commentsByFile={commentsByFile}
      />
      <div className="main">
        <header className="header">
          <Tabs tabs={tabs} activePath={activePath} onActivate={setActivePath} onClose={closeTab} />
          <div className="actions">
            <button type="button" title="Re-scan disk for new HTML files" onClick={reloadTree}>
              <Icon d="M21 12a9 9 0 0 0-15-6.7L3 8 M3 4v4h4 M3 12a9 9 0 0 0 15 6.7L21 16 M21 20v-4h-4" size={12} />
              <span>tree</span>
            </button>
            <button type="button" title="Reload active iframe (⌘R)" onClick={reloadActive}>
              <Icon d="M21 12a9 9 0 0 0-15-6.7L3 8 M3 4v4h4 M3 12a9 9 0 0 0 15 6.7L21 16 M21 20v-4h-4" size={12} />
              <span>active</span>
            </button>
            <button
              type="button"
              className={'rs-toggle' + (commentsPanelOpen ? ' active' : '')}
              onClick={() => setCommentsPanelOpen(v => !v)}
              title="Toggle Comments panel (⌘⇧M)"
            >
              <Icon d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" size={12} />
              <span>comments</span>
              {totalOpen > 0 && <span className="rs-badge">{totalOpen}</span>}
            </button>
            <a className="icon-only" target="_blank" rel="noreferrer" href={activePath && activePath !== SYSTEM_TAB ? urlOf(activePath) : '#'} title="Open in system browser">
              <Icon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3" size={12} />
              <span>open</span>
            </a>
          </div>
        </header>
        <Viewport
          tabs={tabs}
          activePath={activePath}
          registerIframe={registerIframe}
          systemData={systemData}
          onOpenFromSystem={openTab}
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
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
