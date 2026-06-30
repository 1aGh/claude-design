// Phase 29 (epic E4) Task 4 — the persistent project + draft switcher.
//
// REDESIGNED to match .design/ui/RepoBranchSwitcher.tsx: not a top header — a
// compact ONE-LINE dock at the BOTTOM of the sidebar (mounted directly above the
// IdentityBar avatar, so the two form one bottom dock — the gi-rail/gi-menu
// anatomy). The trigger reads "📁 <project> · <branch> ⌃" and opens ONE popup
// UPWARD with a Project section (recents + Open another folder…) and a Branch
// section (default branch / other branches / the merge-to-default CTA / New branch).
//
// Vocabulary contract (DDR-133 — git-native for this surface, superseding the
// DDR-110/119 plain-language layer for the developer persona): branches show their
// real names, main/master is "the default branch", the fold action is "Merge this
// branch → main". Project switch → open_local_project (Tauri) reloads the webview;
// branch switch → POST /_api/git/checkout then reload (the git-lifecycle HEAD-watcher
// flushes Yjs first — DDR-051, not duplicated here); "Merge → main" → POST
// /_api/git/fold; "Fetch remote branches" → POST /_api/git/fetch. The local branch
// list is re-asserted from disk on every popup open (DDR-133) so a flaky network never
// blanks it. Renders nothing until the project is a git repo. CSS in 3-shell-maude.css.

import { useEffect, useRef, useState } from 'react';

import { appRecentProjects, isNativeApp, openLocalProject, pickDirectory } from '../github.js';

const SHARED = new Set(['main', 'master']);

function Icon({ name, size = 16, className }) {
  const p = {
    check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
    'chevron-up': <polyline points="3.5 10 8 5.5 12.5 10" />,
    'chevron-down': <polyline points="3.5 6 8 10.5 12.5 6" />,
    'chevron-right': <polyline points="6 3.5 10.5 8 6 12.5" />,
    folder: <path d="M2 4.5h4l1.3 1.5H14V13H2z" />,
    'folder-open': (<><path d="M2 4.5h4l1.3 1.5H14" /><path d="M2 6h12.5l-1.4 7H3.4z" /></>),
    share: (<><circle cx="4" cy="8" r="1.6" /><circle cx="12" cy="4" r="1.6" /><circle cx="12" cy="12" r="1.6" /><line x1="5.4" y1="7.2" x2="10.6" y2="4.6" /><line x1="5.4" y1="8.8" x2="10.6" y2="11.4" /></>),
    draft: (<><path d="M3 11.5 11 3.5l1.5 1.5L4.5 13l-2 .5z" /><line x1="9.5" y1="5" x2="11" y2="6.5" /></>),
    // git-branch glyph — only the web read-only badge uses it (git vocab there).
    branch: (<><circle cx="4.5" cy="4" r="1.4" /><circle cx="4.5" cy="12" r="1.4" /><circle cx="11.5" cy="6.5" r="1.4" /><line x1="4.5" y1="5.4" x2="4.5" y2="10.6" /><path d="M4.5 8.6h2.6a3 3 0 0 0 3-1.6" /></>),
    plus: (<><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></>),
    // "lift this draft up into the Shared version" — the fold-back action.
    'arrow-up-to-line': (<><line x1="3.5" y1="3" x2="12.5" y2="3" /><line x1="8" y1="13" x2="8" y2="6" /><polyline points="5 8.5 8 5.5 11 8.5" /></>),
    // a teammate's draft that lives on the remote, not downloaded yet.
    cloud: <path d="M4.5 12h6a2.5 2.5 0 0 0 .3-5A3.5 3.5 0 0 0 4 6.4 2.8 2.8 0 0 0 4.5 12z" />,
    // refresh drafts — a circular arrow.
    refresh: (<><path d="M12.5 8a4.5 4.5 0 1 1-1.3-3.2" /><polyline points="12.8 2.5 12.8 5 10.3 5" /></>),
    spinner: <path d="M8 2.2a5.8 5.8 0 1 0 5.8 5.8" />,
  }[name];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

function basename(p) {
  return String(p).replace(/[/\\]+$/, '').split(/[/\\]/).pop() || String(p);
}
function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9._/-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
// Stable data-testid slug for a branch name (desktop-e2e targets testids, not classes).
function tid(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
// Plain "as of …" label for the last Refresh. Coarse on purpose — it's a freshness
// hint, not a clock. `at` is unix seconds; 0/falsey → no label.
function relativeTime(at) {
  if (!at) return '';
  const s = Math.max(0, Math.floor(Date.now() / 1000) - at);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
async function getJson(url) {
  const r = await fetch(url);
  return r.json();
}
async function postJson(url, body, opts = {}) {
  // A network-bound POST (Refresh) gets an abort timeout so a wedged server can't
  // leave the UI spinning forever — the caller surfaces a plain "timed out".
  const ctrl = opts.timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null;
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl?.signal });
    let json = null;
    try { json = await r.json(); } catch { /* no body */ }
    return { ok: r.ok, status: r.status, json };
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, status: 0, json: null, timedOut: true };
    return { ok: false, status: 0, json: null, error: String(e?.message || e) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function RepoBranchSwitcher({ project, liveBranch }) {
  const native = isNativeApp();
  const [status, setStatus] = useState(null); // { repo, branch }
  const [branches, setBranches] = useState([]);
  const [recents, setRecents] = useState([]);
  const [open, setOpen] = useState(false);
  const [newDraft, setNewDraft] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [foldConfirm, setFoldConfirm] = useState(false);
  const [folding, setFolding] = useState('');
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState('');
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0); // unix seconds of last Refresh
  const [downloading, setDownloading] = useState(false); // switching onto a remote-only draft
  const rootRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getJson('/_api/git/status');
        if (!alive) return;
        setStatus(s);
        // Branches drive the native dock's draft picker only — the web badge is
        // read-only, so skip the extra request there.
        if (s.repo && native) {
          const b = await getJson('/_api/git/branches');
          if (alive) setBranches(b.branches || []);
        }
      } catch { /* not a repo / offline */ }
    })();
    if (native) appRecentProjects().then((r) => alive && setRecents(r || [])).catch(() => {});
    return () => { alive = false; };
  }, [native]);

  // DDR-133: the local branch list is disk-only and instant — re-assert it every
  // time the popup opens (independent of any network Refresh), and clear a stale
  // error (e.g. a prior "Refresh timed out") so a flaky network can never leave the
  // dropdown looking empty or broken on the next open.
  useEffect(() => {
    if (!open || !native || !status?.repo) return;
    setErr('');
    reloadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open && !newDraft) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setNewDraft(false); setQuery(''); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, newDraft]);

  // Only meaningful for a versioned project (drafts need git).
  if (!status?.repo) return null;

  // Prefer the live branch from the git-status broadcast (kept current as the
  // dev runs `git checkout` in their terminal) over the one-shot mount fetch.
  const branch = liveBranch || status.branch || 'main';
  const onShared = SHARED.has(branch);
  const sharedName = branches.find((b) => SHARED.has(b.name))?.name || 'main';
  // Recents-first: the draft you last committed to floats to the top — far more
  // useful than alphabetical when a project has a long tail of backup/* branches.
  const byRecent = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || a.name.localeCompare(b.name);
  const q = query.trim().toLowerCase();
  const matchesQuery = (b) => !q || b.name.toLowerCase().includes(q);
  const allDrafts = branches.filter((b) => !SHARED.has(b.name)).sort(byRecent);
  const drafts = allDrafts.filter(matchesQuery);
  const otherDrafts = drafts.filter((b) => b.name !== branch);
  // The Shared version is "main"/"master" in git terms, so a search for "main"
  // should surface it even though it isn't a draft — match on the branch name OR
  // the user-facing label so it never reads as a phantom "no matches".
  const sharedMatchesQuery = !q || sharedName.toLowerCase().includes(q) || 'shared version'.includes(q);
  // Only surface the filter box once the list is long enough to warrant it.
  const showSearch = allDrafts.length > 6;
  const projectName = project || basename(recents[0] || 'Project');

  // Web studio (browser, CLI-launched inside a repo): the switcher is awareness
  // only. The developer owns the workspace from their terminal — switching repos
  // and branches happens there — so render a compact, read-only "📁 project ·
  // branch: X" badge in git vocab (not "draft"/"Shared version"), kept live by
  // the same git-status broadcast that drives the Changes panel. No actions: a
  // UI checkout would rewrite the dev's working tree under their hands and
  // collide with their editor (DDR-119 — native owns the workspace; web is a
  // repo-bound companion).
  if (!native) {
    return (
      <div className="rb-dock-wrap">
        <div className="rb-dock rb-dock--ro">
          <span
            className="rb-trigger rb-trigger--ro"
            title={`${projectName} · branch: ${branch} — switch branches in your terminal`}
          >
            <span className="rb-trigger-icon"><Icon name="folder" size={14} /></span>
            <span className="rb-trigger-proj">{projectName}</span>
            <span className="rb-trigger-sep" aria-hidden="true">·</span>
            <span className="rb-trigger-ver rb-trigger-ver--ro">
              <Icon name="branch" size={12} />
              <span className="rb-trigger-ver-name">branch: {branch}</span>
            </span>
          </span>
        </div>
      </div>
    );
  }

  // Re-read the local branch list from disk (no network — instant). The popup-open
  // effect and a successful fetch both call this so the list is always current.
  async function reloadBranches() {
    try { const b = await getJson('/_api/git/branches'); setBranches(b.branches || []); }
    catch { /* not a repo / offline — keep the prior list, never blank it */ }
  }

  async function switchDraft(name, where) {
    setOpen(false);
    if (name === branch) return;
    setSwitching(name);
    setDownloading(where === 'remote'); // a remote-only branch is downloaded on switch
    setErr('');
    const r = await postJson('/_api/git/checkout', { name });
    if (r.ok && r.json?.ok) window.location.reload();
    else { setErr(r.json?.error || 'Could not switch.'); setSwitching(''); setDownloading(false); }
  }

  // "Fetch remote branches" — fetch all remote heads so a teammate's new branch
  // surfaces, then re-read the list. Explicit gesture (never auto-run); token is
  // server-held. A failure surfaces as an in-popup notice (DDR-133) — it NEVER
  // clears the local list, which stays rendered from disk.
  async function refreshDrafts() {
    if (refreshing) return;
    setRefreshing(true); setErr('');
    const r = await postJson('/_api/git/fetch', {}, { timeoutMs: 45000 });
    if (r.ok && r.json?.ok) {
      if (r.json.fetchedAt) setFetchedAt(r.json.fetchedAt);
      await reloadBranches();
    } else if (r.timedOut || r.json?.timedOut) {
      setErr('Couldn’t reach the remote — your local branches are still listed above.');
    } else {
      setErr(r.status === 401 || r.json?.authRequired ? 'Sign in with GitHub to fetch remote branches.' : r.json?.error || 'Could not fetch remote branches.');
    }
    setRefreshing(false);
  }

  async function createDraft() {
    const name = slugify(draftName);
    if (!name) return;
    setBusy(true); setErr('');
    const r = await postJson('/_api/git/branch', { name });
    if (r.ok && r.json?.ok) window.location.reload();
    else { setErr(r.json?.error || 'Could not create the draft.'); setBusy(false); }
  }

  // "Add this draft to the Shared version" (Task 7) — merge + publish, then remove.
  async function foldDraft() {
    setFoldConfirm(false);
    setFolding(branch);
    setErr('');
    const r = await postJson('/_api/git/fold', { name: branch });
    if (r.ok && r.json?.ok) window.location.reload();
    else {
      setErr(r.status === 401 ? `Sign in with GitHub to merge into ${sharedName}.` : r.json?.error || 'Could not merge the branch.');
      setFolding('');
    }
  }

  async function switchRepo(path) {
    setOpen(false);
    if (!native) return;
    setSwitching(basename(path));
    try { await openLocalProject(path); }
    catch (e) { setErr(String(e?.message || e || 'Could not open that project.')); setSwitching(''); }
  }

  async function openAnother() {
    setOpen(false);
    if (!native) return;
    try {
      const dir = await pickDirectory();
      if (!dir) return;
      setSwitching(basename(dir));
      await openLocalProject(dir);
    } catch (e) { setErr(String(e?.message || e || 'Could not open that folder.')); setSwitching(''); }
  }

  const slug = slugify(draftName);
  const currentDraft = onShared ? null : branches.find((b) => b.current);

  // Search-miss (DDR-133, Task 4): a typed name that matches no LOCAL or already-
  // fetched remote branch offers an explicit remote search (the bounded fetch),
  // instead of a dead-end "nothing matches". The local list above stays rendered.
  const searchMissRow = (
    <>
      <div className="rb-pop-empty">No branch matches “{query.trim()}”.</div>
      <button type="button" className="rb-pop-item rb-pop-item--action" role="menuitem" onClick={refreshDrafts} disabled={refreshing}>
        <span className={'rb-pop-icon' + (refreshing ? ' rb-pop-icon--spin' : '')}><Icon name={refreshing ? 'spinner' : 'refresh'} size={14} /></span>
        <span className="rb-pop-tx"><span className="rb-pop-name">{refreshing ? 'Searching the remote…' : 'Search the remote for it'}</span></span>
      </button>
    </>
  );

  // One switchable draft row. A `remote`-only draft (a teammate's, or one pushed
  // from another machine) gets a cloud glyph + "not downloaded yet" — switching
  // downloads it (the service creates a local tracking branch).
  const draftRow = (b) => {
    const remote = b.where === 'remote';
    return (
      <button type="button" key={b.name} data-testid={`branch-row-${tid(b.name)}`} className="rb-pop-item" role="menuitem" onClick={() => switchDraft(b.name, b.where)}>
        <span className={'rb-pop-icon ' + (remote ? 'rb-pop-icon--remote' : 'rb-pop-icon--draft')}>
          <Icon name={remote ? 'cloud' : 'draft'} size={14} />
        </span>
        <span className="rb-pop-tx">
          <span className="rb-pop-name">{b.name}</span>
          {remote && <span className="rb-pop-sub">remote · not downloaded yet</span>}
        </span>
      </button>
    );
  };

  return (
    <div className="rb-dock-wrap">
      <div className="rb-dock" ref={rootRef}>
        {open && (
          <div className="rb-pop rb-pop--up" id="rb-switch-pop" role="menu" aria-label="Switch project or version" data-testid="repo-switcher-popup">
            {/* ── Project ── */}
            <div className="rb-pop-hd">Project</div>
            {native && recents.length > 0 ? (
              recents.map((p, i) => (
                <button type="button" key={p} className={'rb-pop-item' + (i === 0 ? ' is-current' : '')} role="menuitem" onClick={() => switchRepo(p)}>
                  <span className="rb-pop-icon"><Icon name="folder" size={14} /></span>
                  <span className="rb-pop-tx">
                    <span className="rb-pop-name">{basename(p)}</span>
                    <span className="rb-pop-sub">{p}</span>
                  </span>
                  {i === 0 ? <Icon name="check" size={14} className="rb-pop-check" /> : null}
                </button>
              ))
            ) : (
              <div className="rb-pop-sub" style={{ padding: 'var(--space-2) var(--space-3)' }}>{native ? 'No other recent projects.' : 'Open another project from the desktop app.'}</div>
            )}
            {native && (
              <button type="button" className="rb-pop-item rb-pop-item--action" role="menuitem" onClick={openAnother}>
                <span className="rb-pop-icon"><Icon name="folder-open" size={14} /></span>
                <span className="rb-pop-tx"><span className="rb-pop-name">Open another folder…</span></span>
              </button>
            )}

            <div className="rb-pop-sep" />
            <div className="rb-pop-hd">Branch</div>

            {onShared ? (
              <>
                <button type="button" data-testid={`branch-row-${tid(sharedName)}`} className="rb-pop-item is-current" role="menuitem" aria-current="true" onClick={() => switchDraft(sharedName)}>
                  <span className="rb-pop-icon rb-pop-icon--shared"><Icon name="share" size={14} /></span>
                  <span className="rb-pop-tx">
                    <span className="rb-pop-name">{sharedName}</span>
                    <span className="rb-pop-sub">default branch · what everyone sees</span>
                  </span>
                  <Icon name="check" size={14} className="rb-pop-check" />
                </button>
                {allDrafts.length > 0 && <div className="rb-pop-grouplabel">Other branches</div>}
                {showSearch && (
                  <div className="rb-search">
                    <input className="input rb-search-input" type="text" value={query} placeholder="Search branches…" aria-label="Search branches" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }} />
                  </div>
                )}
                {drafts.map(draftRow)}
                {showSearch && q && drafts.length === 0 && !sharedMatchesQuery && searchMissRow}
              </>
            ) : (
              <>
                {/* On a branch — it's the current row, and the one strong action is
                    merging it into the default branch (DDR-133 fold). */}
                <button type="button" className="rb-pop-item is-current" role="menuitem" aria-current="true">
                  <span className="rb-pop-icon rb-pop-icon--draft"><Icon name="draft" size={14} /></span>
                  <span className="rb-pop-tx">
                    <span className="rb-pop-name">{currentDraft?.name || branch}</span>
                    <span className="rb-pop-sub">your branch</span>
                  </span>
                  <Icon name="check" size={14} className="rb-pop-check" />
                </button>
                <button type="button" data-testid="switcher-merge" className="rb-fold" role="menuitem" onClick={() => { setOpen(false); setFoldConfirm(true); }}>
                  <span className="rb-fold-icon"><Icon name="arrow-up-to-line" size={15} /></span>
                  <span className="rb-fold-tx">
                    <span className="rb-fold-title">Merge this branch → {sharedName}</span>
                    <span className="rb-fold-sub">into the default branch everyone shares</span>
                  </span>
                </button>
                <div className="rb-pop-grouplabel">Switch branch</div>
                {showSearch && (
                  <div className="rb-search">
                    <input className="input rb-search-input" type="text" value={query} placeholder="Search branches…" aria-label="Search branches" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }} />
                  </div>
                )}
                {sharedMatchesQuery && (
                  <button type="button" data-testid={`branch-row-${tid(sharedName)}`} className="rb-pop-item" role="menuitem" onClick={() => switchDraft(sharedName)}>
                    <span className="rb-pop-icon rb-pop-icon--shared"><Icon name="share" size={14} /></span>
                    <span className="rb-pop-tx">
                      <span className="rb-pop-name">{sharedName}</span>
                      <span className="rb-pop-sub">default branch · what everyone sees</span>
                    </span>
                  </button>
                )}
                {otherDrafts.map(draftRow)}
                {showSearch && q && otherDrafts.length === 0 && !sharedMatchesQuery && searchMissRow}
              </>
            )}

            <button type="button" data-testid="switcher-fetch" className="rb-pop-item rb-pop-item--action" role="menuitem" onClick={refreshDrafts} disabled={refreshing}>
              <span className={'rb-pop-icon' + (refreshing ? ' rb-pop-icon--spin' : '')}><Icon name={refreshing ? 'spinner' : 'refresh'} size={14} /></span>
              <span className="rb-pop-tx">
                <span className="rb-pop-name">{refreshing ? 'Fetching…' : 'Fetch remote branches'}</span>
                <span className="rb-pop-sub">{fetchedAt ? `as of ${relativeTime(fetchedAt)}` : 'check the remote for new branches'}</span>
              </span>
            </button>

            {err && !switching && <div className="rb-pop-notice" role="alert">{err}</div>}

            <button type="button" data-testid="switcher-new-branch" className="rb-pop-item rb-pop-item--action" role="menuitem" onClick={() => { setOpen(false); setNewDraft(true); }}>
              <span className="rb-pop-icon"><Icon name="plus" size={14} /></span>
              <span className="rb-pop-tx">
                <span className="rb-pop-name">New branch</span>
                <span className="rb-pop-sub">a separate line of work off the current branch</span>
              </span>
            </button>
          </div>
        )}

        {newDraft && (
          <div className="rb-newdraft rb-newdraft--up">
            <label className="rb-newdraft-field">
              <span className="rb-newdraft-label">Name your branch</span>
              <input className="input rb-newdraft-input" data-testid="switcher-new-branch-input" type="text" value={draftName} placeholder="nav-redesign" aria-label="Branch name" autoFocus onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && slug) createDraft(); if (e.key === 'Escape') { setNewDraft(false); setDraftName(''); } }} />
              {slug && <span className="rb-pop-sub">Creates branch <b>{slug}</b></span>}
            </label>
            {err && <span className="rb-newdraft-err">{err}</span>}
            <div className="rb-newdraft-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setNewDraft(false); setDraftName(''); setErr(''); }} disabled={busy}>Cancel</button>
              <button type="button" data-testid="switcher-new-branch-create" className="btn btn--primary btn--sm" onClick={createDraft} disabled={busy || !slug}><Icon name="draft" size={13} /> {busy ? 'Creating…' : 'Create branch'}</button>
            </div>
            <p className="rb-newdraft-hint">A branch is your own line of work off the current branch. Merge it into {sharedName} when you're happy, or throw it away — nothing else changes.</p>
          </div>
        )}

        {switching ? (
          <div className="rb-switching" role="status" aria-live="polite">
            <Icon name="spinner" size={14} className="rb-spin" />
            <span>{folding ? <>Merging <b>{folding}</b> → {sharedName}…</> : downloading ? <>Downloading <b>{switching}</b>…</> : <>Opening <b>{switching}</b>…</>}</span>
          </div>
        ) : (
          <button type="button" data-testid="repo-switcher-trigger" className={'rb-trigger' + (open ? ' is-open' : '')} aria-expanded={open} aria-haspopup="menu" aria-controls="rb-switch-pop" onClick={() => { setOpen((v) => { if (v) setQuery(''); return !v; }); setNewDraft(false); }} title={`${projectName} · ${branch}`}>
            <span className="rb-trigger-icon"><Icon name="folder" size={14} /></span>
            <span className="rb-trigger-proj">{projectName}</span>
            <span className="rb-trigger-sep" aria-hidden="true">·</span>
            <span className={'rb-trigger-ver' + (onShared ? '' : ' is-draft')}>
              <Icon name={onShared ? 'share' : 'draft'} size={12} />
              <span className="rb-trigger-ver-name">{branch}</span>
            </span>
            <Icon name="chevron-up" size={13} className="rb-trigger-caret" />
          </button>
        )}
        {err && !open && !newDraft && !switching && <div className="rb-switcher-err" role="alert">{err}</div>}
      </div>

      {/* Merge-to-default confirm — the one modal in this surface. No 3-way merge UI. */}
      {foldConfirm && (
        <div className="rb-scrim" role="presentation" onClick={() => setFoldConfirm(false)}>
          <div className="rb-sheet" role="dialog" aria-modal="true" aria-labelledby="rb-sheet-title" aria-describedby="rb-sheet-body" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setFoldConfirm(false); }}>
            <span className="rb-sheet-icon"><Icon name="arrow-up-to-line" size={20} /></span>
            <h2 className="rb-sheet-title" id="rb-sheet-title">Merge this branch → {sharedName}</h2>
            <p className="rb-sheet-body" id="rb-sheet-body">Everything in <b>“{currentDraft?.name || branch}”</b> becomes part of <b>{sharedName}</b> — the default branch everyone shares.</p>
            <p className="rb-sheet-meta">Teammates pick it up the next time they Get latest, and this branch is then deleted. Nothing else changes.</p>
            {err && <p className="rb-newdraft-err">{err}</p>}
            <div className="rb-sheet-actions">
              <button type="button" className="btn btn--ghost" onClick={() => { setFoldConfirm(false); setErr(''); }}>Cancel</button>
              <button type="button" data-testid="switcher-merge-confirm" className="btn btn--primary" onClick={foldDraft}><Icon name="arrow-up-to-line" size={15} /> Merge → {sharedName}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
