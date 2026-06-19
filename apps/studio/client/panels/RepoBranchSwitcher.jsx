// Phase 29 (epic E4) Task 4 — the persistent project + draft switcher.
//
// REDESIGNED to match .design/ui/RepoBranchSwitcher.tsx: not a top header — a
// compact ONE-LINE dock at the BOTTOM of the sidebar (mounted directly above the
// IdentityBar avatar, so the two form one bottom dock — the gi-rail/gi-menu
// anatomy). The trigger reads "📁 <project> · <version> ⌃" and opens ONE popup
// UPWARD with a Project section (recents + Open another folder…) and a Version
// section (Shared version / drafts / the fold-back CTA / New draft).
//
// Vocabulary contract: a git branch is a "draft", main/master is the "Shared
// version" — no branch/checkout/main/merge jargon. Project switch → open_local_project
// (Tauri) reloads the webview; draft switch → POST /_api/git/checkout then reload
// (the git-lifecycle HEAD-watcher flushes Yjs first — DDR-051, not duplicated here);
// "Add this draft to the Shared version" → POST /_api/git/fold. Renders nothing
// until the project is a git repo. CSS (rb-*) in 3-shell-maude.css.

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
    plus: (<><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></>),
    // "lift this draft up into the Shared version" — the fold-back action.
    'arrow-up-to-line': (<><line x1="3.5" y1="3" x2="12.5" y2="3" /><line x1="8" y1="13" x2="8" y2="6" /><polyline points="5 8.5 8 5.5 11 8.5" /></>),
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
async function getJson(url) {
  const r = await fetch(url);
  return r.json();
}
async function postJson(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json = null;
  try { json = await r.json(); } catch { /* no body */ }
  return { ok: r.ok, status: r.status, json };
}

export default function RepoBranchSwitcher({ project }) {
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
  const rootRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getJson('/_api/git/status');
        if (!alive) return;
        setStatus(s);
        if (s.repo) {
          const b = await getJson('/_api/git/branches');
          if (alive) setBranches(b.branches || []);
        }
      } catch { /* not a repo / offline */ }
    })();
    if (native) appRecentProjects().then((r) => alive && setRecents(r || [])).catch(() => {});
    return () => { alive = false; };
  }, [native]);

  useEffect(() => {
    if (!open && !newDraft) return undefined;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) { setOpen(false); setNewDraft(false); } };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, newDraft]);

  // Only meaningful for a versioned project (drafts need git).
  if (!status?.repo) return null;

  const branch = status.branch || 'main';
  const onShared = SHARED.has(branch);
  const sharedName = branches.find((b) => SHARED.has(b.name))?.name || 'main';
  const drafts = branches.filter((b) => !SHARED.has(b.name));
  const otherDrafts = drafts.filter((b) => b.name !== branch);
  const projectName = project || basename(recents[0] || 'Project');

  async function switchDraft(name) {
    setOpen(false);
    if (name === branch) return;
    setSwitching(name === sharedName ? 'the shared version' : name);
    setErr('');
    const r = await postJson('/_api/git/checkout', { name });
    if (r.ok && r.json?.ok) window.location.reload();
    else { setErr(r.json?.error || 'Could not switch.'); setSwitching(''); }
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
      setErr(r.status === 401 ? 'Sign in with GitHub to publish the Shared version.' : r.json?.error || 'Could not add the draft.');
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

  return (
    <div className="rb-dock-wrap">
      <div className="rb-dock" ref={rootRef}>
        {open && (
          <div className="rb-pop rb-pop--up" id="rb-switch-pop" role="menu" aria-label="Switch project or version">
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
            <div className="rb-pop-hd">Version</div>

            {onShared ? (
              <>
                <button type="button" className="rb-pop-item is-current" role="menuitem" aria-current="true" onClick={() => switchDraft(sharedName)}>
                  <span className="rb-pop-icon rb-pop-icon--shared"><Icon name="share" size={14} /></span>
                  <span className="rb-pop-tx">
                    <span className="rb-pop-name">Shared version</span>
                    <span className="rb-pop-sub">what everyone sees</span>
                  </span>
                  <Icon name="check" size={14} className="rb-pop-check" />
                </button>
                {drafts.length > 0 && <div className="rb-pop-grouplabel">Drafts</div>}
                {drafts.map((b) => (
                  <button type="button" key={b.name} className="rb-pop-item" role="menuitem" onClick={() => switchDraft(b.name)}>
                    <span className="rb-pop-icon rb-pop-icon--draft"><Icon name="draft" size={14} /></span>
                    <span className="rb-pop-tx"><span className="rb-pop-name">{b.name}</span></span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {/* On a draft — it's the current row, and the one strong action is
                    folding it back into the Shared version (Task 7). */}
                <button type="button" className="rb-pop-item is-current" role="menuitem" aria-current="true">
                  <span className="rb-pop-icon rb-pop-icon--draft"><Icon name="draft" size={14} /></span>
                  <span className="rb-pop-tx">
                    <span className="rb-pop-name">{currentDraft?.name || branch}</span>
                    <span className="rb-pop-sub">your draft</span>
                  </span>
                  <Icon name="check" size={14} className="rb-pop-check" />
                </button>
                <button type="button" className="rb-fold" role="menuitem" onClick={() => { setOpen(false); setFoldConfirm(true); }}>
                  <span className="rb-fold-icon"><Icon name="arrow-up-to-line" size={15} /></span>
                  <span className="rb-fold-tx">
                    <span className="rb-fold-title">Add this draft to the Shared version</span>
                    <span className="rb-fold-sub">make it the version everyone works from</span>
                  </span>
                </button>
                <div className="rb-pop-grouplabel">Switch to</div>
                <button type="button" className="rb-pop-item" role="menuitem" onClick={() => switchDraft(sharedName)}>
                  <span className="rb-pop-icon rb-pop-icon--shared"><Icon name="share" size={14} /></span>
                  <span className="rb-pop-tx">
                    <span className="rb-pop-name">Shared version</span>
                    <span className="rb-pop-sub">what everyone sees</span>
                  </span>
                </button>
                {otherDrafts.map((b) => (
                  <button type="button" key={b.name} className="rb-pop-item" role="menuitem" onClick={() => switchDraft(b.name)}>
                    <span className="rb-pop-icon rb-pop-icon--draft"><Icon name="draft" size={14} /></span>
                    <span className="rb-pop-tx"><span className="rb-pop-name">{b.name}</span></span>
                  </button>
                ))}
              </>
            )}

            <button type="button" className="rb-pop-item rb-pop-item--action" role="menuitem" onClick={() => { setOpen(false); setNewDraft(true); }}>
              <span className="rb-pop-icon"><Icon name="plus" size={14} /></span>
              <span className="rb-pop-tx">
                <span className="rb-pop-name">New draft</span>
                <span className="rb-pop-sub">a separate line of work, just yours for now</span>
              </span>
            </button>
          </div>
        )}

        {newDraft && (
          <div className="rb-newdraft rb-newdraft--up">
            <label className="rb-newdraft-field">
              <span className="rb-newdraft-label">Name your draft</span>
              <input className="input rb-newdraft-input" type="text" value={draftName} placeholder="Nav redesign" aria-label="Draft name" autoFocus onChange={(e) => setDraftName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && slug) createDraft(); if (e.key === 'Escape') { setNewDraft(false); setDraftName(''); } }} />
              {slug && <span className="rb-pop-sub">Creates a draft called <b>{slug}</b></span>}
            </label>
            {err && <span className="rb-newdraft-err">{err}</span>}
            <div className="rb-newdraft-actions">
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setNewDraft(false); setDraftName(''); setErr(''); }} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn--primary btn--sm" onClick={createDraft} disabled={busy || !slug}><Icon name="draft" size={13} /> {busy ? 'Creating…' : 'Create draft'}</button>
            </div>
            <p className="rb-newdraft-hint">A draft is your own copy to try things in. Add it to the Shared version when you're happy, or throw it away — nothing else changes.</p>
          </div>
        )}

        {switching ? (
          <div className="rb-switching" role="status" aria-live="polite">
            <Icon name="spinner" size={14} className="rb-spin" />
            <span>{folding ? <>Adding <b>{folding}</b> to the Shared version…</> : <>Opening <b>{switching}</b>…</>}</span>
          </div>
        ) : (
          <button type="button" className={'rb-trigger' + (open ? ' is-open' : '')} aria-expanded={open} aria-haspopup="menu" aria-controls="rb-switch-pop" onClick={() => { setOpen((v) => !v); setNewDraft(false); }} title={`${projectName} · ${onShared ? 'Shared version' : branch}`}>
            <span className="rb-trigger-icon"><Icon name="folder" size={14} /></span>
            <span className="rb-trigger-proj">{projectName}</span>
            <span className="rb-trigger-sep" aria-hidden="true">·</span>
            <span className={'rb-trigger-ver' + (onShared ? '' : ' is-draft')}>
              <Icon name={onShared ? 'share' : 'draft'} size={12} />
              <span className="rb-trigger-ver-name">{onShared ? 'Shared version' : branch}</span>
            </span>
            <Icon name="chevron-up" size={13} className="rb-trigger-caret" />
          </button>
        )}
        {err && !newDraft && !switching && <div className="rb-switcher-err" role="alert">{err}</div>}
      </div>

      {/* Fold-back confirm — the one modal in this surface. Plain words, no merge UI. */}
      {foldConfirm && (
        <div className="rb-scrim" role="presentation" onClick={() => setFoldConfirm(false)}>
          <div className="rb-sheet" role="dialog" aria-modal="true" aria-labelledby="rb-sheet-title" aria-describedby="rb-sheet-body" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setFoldConfirm(false); }}>
            <span className="rb-sheet-icon"><Icon name="arrow-up-to-line" size={20} /></span>
            <h2 className="rb-sheet-title" id="rb-sheet-title">Add this draft to the Shared version</h2>
            <p className="rb-sheet-body" id="rb-sheet-body">Everything in <b>“{currentDraft?.name || branch}”</b> will become part of the Shared version everyone sees.</p>
            <p className="rb-sheet-meta">Everyone else picks it up the next time they Pull changes, and this draft is then removed. Nothing else changes.</p>
            {err && <p className="rb-newdraft-err">{err}</p>}
            <div className="rb-sheet-actions">
              <button type="button" className="btn btn--ghost" onClick={() => { setFoldConfirm(false); setErr(''); }}>Cancel</button>
              <button type="button" className="btn btn--primary" onClick={foldDraft}><Icon name="arrow-up-to-line" size={15} /> Add to the Shared version</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
