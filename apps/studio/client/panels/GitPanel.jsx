// Phase 27 (epic E2) Task 6 — the in-Maude git-awareness panel.
//
// Built 1:1 from the approved `.design/ui/GitPanel.tsx` mock (Changes panel ·
// Save a version · Publish + Get-latest nudge · Nothing-to-save · Publish-
// rejected), wired to live git state. Vocabulary is load-bearing and NEVER leaks
// git jargon: Save version (commit) · Publish (push) · Get latest (pull) ·
// History (log) · Unsaved (dirty M/A/D/U) · Draft (branch). Renders in the
// shell's right dock (st-rpanel), driven by the `git-status` WS broadcast.

import { useEffect, useMemo, useRef, useState } from 'react';

import { baseName, buildUnits, supportLabel } from './git-grouping.js';

const KIND_OF = { modified: 'M', added: 'A', deleted: 'D', untracked: 'U' };
const KIND_TITLE = { M: 'Modified', A: 'Added', D: 'Deleted', U: 'Untracked' };

function Icon({ name, size = 16, className }) {
  const p = {
    save: (
      <>
        <path d="M3 3h8l2 2v8H3z" />
        <polyline points="5 3 5 6 10 6" />
        <rect x="5.5" y="9" width="5" height="3.5" />
      </>
    ),
    publish: (
      <>
        <line x1="8" y1="13" x2="8" y2="3.5" />
        <polyline points="4.5 7 8 3.5 11.5 7" />
        <polyline points="3 12.8 3 13.6 13 13.6 13 12.8" />
      </>
    ),
    download: (
      <>
        <line x1="8" y1="2.5" x2="8" y2="10" />
        <polyline points="4.5 7 8 10.5 11.5 7" />
        <polyline points="3 12.8 3 13.6 13 13.6 13 12.8" />
      </>
    ),
    history: (
      <>
        <path d="M3.2 8a5 5 0 1 1 1.4 3.5" />
        <polyline points="3.2 11.4 3.2 8 6.6 8" />
        <polyline points="8 5.5 8 8 10 9.3" />
      </>
    ),
    undo: (
      <>
        <path d="M5.5 6H10a3.4 3.4 0 0 1 0 6.8H6.2" />
        <polyline points="5.5 3.6 3 6 5.5 8.4" />
      </>
    ),
    diff: (
      <>
        <rect x="2.5" y="3" width="4.5" height="10" rx="1" />
        <rect x="9" y="3" width="4.5" height="10" rx="1" />
      </>
    ),
    file: (
      <>
        <path d="M4 2h5l3 3v9H4z" />
        <polyline points="9 2 9 5 12 5" />
      </>
    ),
    folder: <path d="M2 4.5h4l1.3 1.5H14V13H2z" />,
    check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
    chevron: <polyline points="6 4 10 8 6 12" />,
  }[name];
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
    >
      {p}
    </svg>
  );
}

function Badge({ kind }) {
  return (
    <span
      className="gp-badge"
      data-kind={kind}
      title={`${KIND_TITLE[kind]} — unsaved`}
      aria-label={`${KIND_TITLE[kind]}, unsaved`}
    >
      {kind}
    </span>
  );
}

/** A checkbox that can show the indeterminate ("some") state — React has no
 *  prop for it, so it's set on the DOM node via a ref. */
function TriCheck({ state, onChange, ariaLabel }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="gp-check"
      checked={state === 'all'}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  );
}

function timeAgo(iso) {
  try {
    const t = new Date(iso).getTime();
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d} days ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return '';
  }
}

export default function GitPanel({
  status,
  project,
  width,
  resizing,
  onClose,
  onCommit,
  onDiscard,
  onPublish,
  onGetLatest,
  loadLog,
  onOpenCanvas,
  onOpenDiff,
  activeCanvas, // repo-relative path of the open canvas/specimen, or null
  onPreviewVersion, // (sha) => open the active canvas at that saved version
  designRel = '.design', // for canvas → annotation-slug matching (grouping)
  // Web studio: awareness only. Keep the changed-files list, Diff and History,
  // but drop every working-tree action (Save / Publish / Get latest / discard /
  // checkboxes) — the developer commits and pushes from their terminal
  // (DDR-119). Native app keeps the full plain-words cycle.
  readOnly = false,
}) {
  const [tab, setTab] = useState('changes');
  const [message, setMessage] = useState('');
  const [unchecked, setUnchecked] = useState(() => new Set()); // default = all checked
  const [expanded, setExpanded] = useState(() => new Set()); // unit keys with supporting files shown
  const [busy, setBusy] = useState(null);
  const [banner, setBanner] = useState(null); // { variant, title?, text }
  const [log, setLog] = useState(null);
  const [logLoading, setLogLoading] = useState(false);
  // The path the loaded `log` covers: a canvas path → per-file history (its
  // versions are click-to-preview), '' → repo-wide read-only list. `undefined`
  // = nothing loaded yet. (phase-27.1)
  const [logScope, setLogScope] = useState(undefined);
  const selectAllRef = useRef(null);

  // History is scoped to the open canvas/specimen so each row previews THAT
  // file at that saved version (the resolved "what does a commit row show?"
  // ambiguity). With nothing open, fall back to the repo-wide read-only list.
  const previewable = !!(activeCanvas && onPreviewVersion);
  const historyScope = activeCanvas || '';
  const activeName = activeCanvas ? baseName(activeCanvas) : '';

  const files = status?.files ?? [];
  const fileKey = files.map((f) => `${f.path}:${f.status}`).join('|');

  useEffect(() => {
    setUnchecked((prev) => {
      const present = new Set(files.map((f) => f.path));
      const next = new Set();
      for (const p of prev) if (present.has(p)) next.add(p);
      return next.size === prev.size ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey]);

  const checkedPaths = useMemo(
    () => files.map((f) => f.path).filter((p) => !unchecked.has(p)),
    [files, unchecked]
  );

  const { canvasUnits, otherUnits } = useMemo(
    () => buildUnits(files, designRel),
    [files, designRel]
  );
  // Both section headers only when both kinds are present (a lone "Canvases"
  // header over an all-canvas list is noise).
  const showSectionHeads = canvasUnits.length > 0 && otherUnits.length > 0;

  // A unit's aggregate check state across all its members (canvas + sidecars).
  const unitState = (u) => {
    const members = [u.primary, ...u.supporting];
    const on = members.filter((m) => !unchecked.has(m.path)).length;
    return on === 0 ? 'none' : on === members.length ? 'all' : 'some';
  };
  const toggleUnit = (u) => {
    const members = [u.primary, ...u.supporting].map((m) => m.path);
    const allOn = unitState(u) === 'all';
    setUnchecked((prev) => {
      const next = new Set(prev);
      for (const p of members) {
        if (allOn) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  };
  const toggleExpand = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // One canvas (or loose file) + its collapsed supporting files. The unit
  // checkbox is the single control — a canvas and its sidecars Save as one unit
  // (DDR-112); supporting files render read-only when expanded, for transparency.
  const renderUnit = (u) => {
    const f = u.primary;
    const st = unitState(u);
    const hasKids = u.supporting.length > 0;
    const isOpen = expanded.has(u.key);
    const name = baseName(f.path);
    const memberPaths = [f, ...u.supporting].map((m) => m.path);
    return (
      <div className="gp-unit" key={u.key}>
        <div className={'gp-file gp-unit-hd' + (!readOnly && st !== 'none' ? ' is-checked' : '')}>
          {!readOnly && (
            <TriCheck
              state={st}
              ariaLabel={`Include ${name}${hasKids ? ' and its supporting files' : ''} in this version`}
              onChange={() => toggleUnit(u)}
            />
          )}
          <Badge kind={KIND_OF[f.status]} />
          <button
            type="button"
            className="gp-file-text"
            title={f.path}
            onClick={() => onOpenCanvas?.(f.path)}
          >
            <span className="gp-file-name">{name}</span>
            <span className="gp-file-path">
              {hasKids ? `${f.path} · +${u.supporting.length} supporting` : f.path}
            </span>
          </button>
          {hasKids && (
            <button
              type="button"
              className={'gp-disclose' + (isOpen ? ' is-open' : '')}
              aria-expanded={isOpen}
              aria-label={
                isOpen ? `Hide supporting files for ${name}` : `Show supporting files for ${name}`
              }
              onClick={() => toggleExpand(u.key)}
            >
              <Icon name="chevron" size={14} />
            </button>
          )}
          {u.kind === 'canvas' && (
            <button
              type="button"
              className="gp-discard"
              title="Compare before / after"
              aria-label={`Compare ${name}`}
              onClick={() => onOpenDiff?.(f.path)}
            >
              <Icon name="diff" size={14} />
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              className="gp-discard"
              title={hasKids ? 'Discard this canvas and its supporting files' : 'Discard this change'}
              aria-label={`Discard changes to ${name}`}
              onClick={async () => {
                const msg = hasKids
                  ? `Discard your changes to “${name}” and its supporting files? This can't be undone.`
                  : `Discard your changes to “${name}”? This can't be undone.`;
                if (!window.confirm(msg)) return;
                await run('discard', () => onDiscard(memberPaths));
              }}
            >
              <Icon name="undo" size={14} />
            </button>
          )}
        </div>
        {hasKids && isOpen && (
          <div className="gp-support" role="group" aria-label={`Supporting files for ${name}`}>
            {u.supporting.map((s) => (
              <div className="gp-support-row" key={s.path} title={s.path}>
                <Badge kind={KIND_OF[s.status]} />
                <span className="gp-support-text">
                  <span className="gp-file-name">{supportLabel(s.path)}</span>
                  <span className="gp-file-path">{s.path}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Select-all checkbox: indeterminate when partial (set via ref — no React prop).
  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate =
        checkedPaths.length > 0 && checkedPaths.length < files.length;
  }, [checkedPaths.length, files.length]);

  async function run(kind, fn, ok) {
    setBusy(kind);
    setBanner(null);
    try {
      const res = (await fn()) || {};
      if (res.ok) {
        if (ok) setBanner(ok);
        // Save version / Publish / Get latest change the commit log — invalidate the
        // scope-cached History so it re-fetches (the scope itself didn't change, so
        // the load-on-scope-change effect wouldn't otherwise pick up the new commit).
        setLogScope(undefined);
        return res;
      }
      if (res.authRequired)
        setBanner({
          variant: 'info',
          text: res.error || 'Sign in with GitHub to publish — coming soon.',
        });
      else if (res.conflict)
        // A push conflict (non-fast-forward) prompts a Get-latest; a Get-latest
        // CONTENT conflict instead opens the DiffView resolver (onGetLatest sets
        // it), so the banner just points there — never the publish copy, and no
        // Get-latest button (that would loop).
        setBanner(
          kind === 'getLatest'
            ? {
                variant: 'info',
                title: 'You both changed this',
                text: 'Pick what to keep in the window that just opened.',
              }
            : {
                variant: 'warn',
                title: "Publish didn't go through",
                text: 'The shared project moved on while you were working. Get the latest, then publish yours on top.',
                getLatest: true,
              }
        );
      else setBanner({ variant: 'error', text: res.error || 'Something went wrong.' });
      return res;
    } finally {
      setBusy(null);
    }
  }

  function openHistory() {
    setTab('history');
  }

  // Load (or reload) History whenever it's the active tab and the scope changes
  // — e.g. the user opens a different canvas while History is showing, so the
  // listed versions always match the file the rows will preview.
  useEffect(() => {
    if (tab !== 'history') return;
    if (logScope === historyScope) return; // already current for this scope
    let cancelled = false;
    setLogLoading(true);
    (async () => {
      const entries = (await loadLog(historyScope || undefined)) || [];
      if (cancelled) return;
      setLog(entries);
      setLogScope(historyScope);
      setLogLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, historyScope, logScope, loadLog]);

  function toggleAll() {
    setUnchecked((prev) => (prev.size === 0 ? new Set(files.map((f) => f.path)) : new Set()));
  }

  const count = files.length;
  const branch = status?.branch || 'main';
  const unpushed = status?.unpushed || 0;
  const canSave = message.trim().length > 0 && checkedPaths.length > 0 && !busy;
  const notRepo = status && status.repo === false;
  const clean = count === 0;

  const publishBar = (
    <div className="gp-publishbar">
      <button
        type="button"
        className="btn btn--primary gp-publish"
        data-tour="publish"
        disabled={!!busy}
        onClick={() =>
          run('publish', onPublish, {
            variant: 'success',
            text: 'Published — your team can Get latest.',
          })
        }
      >
        <Icon name="publish" size={15} /> Publish changes
      </button>
      <span className="gp-hint" style={{ textAlign: 'center' }}>
        {unpushed > 0
          ? `Sends your ${unpushed} saved version${unpushed === 1 ? '' : 's'} to the shared project so the team can get them.`
          : 'Sends your saved versions to the shared project so the team can get them.'}
      </span>
    </div>
  );

  return (
    <aside
      className={'st-rpanel gp-panel' + (resizing ? ' is-resizing' : '')}
      style={width ? { width, flexBasis: width } : undefined}
      aria-label="Changes"
    >
      <div className="gp-head">
        <div className="gp-panel-hd">
          <span className="gp-panel-title">Changes</span>
          {count > 0 && <span className="gp-count">{count} unsaved</span>}
          <span className="gp-spacer" />
          <span className="gp-draft" title="Your project and shared draft">
            <Icon name="folder" size={12} />
            {project ? (
              <>
                <b>{project}</b>
                <span className="gp-sep">/</span>
              </>
            ) : null}
            {branch}
          </span>
          <button type="button" className="gp-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="gp-tabs" role="tablist" aria-label="Changes and history">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'changes'}
            className={'gp-tab' + (tab === 'changes' ? ' is-active' : '')}
            onClick={() => setTab('changes')}
          >
            Changes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={'gp-tab' + (tab === 'history' ? ' is-active' : '')}
            onClick={openHistory}
          >
            History
          </button>
        </div>
      </div>

      {banner && (
        <div className="gp-pad">
          <div className={`callout callout--${banner.variant}`} role="status" aria-live="polite">
            <div className="gp-callout-col">
              <span>
                {banner.title && (
                  <strong style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--fg-0)' }}>
                    {banner.title}
                  </strong>
                )}
                {banner.text}
              </span>
              {banner.getLatest && (
                <div className="gp-callout-actions">
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={!!busy}
                    onClick={() =>
                      run('getLatest', onGetLatest, {
                        variant: 'success',
                        text: 'Up to date with everyone.',
                      })
                    }
                  >
                    <Icon name="download" size={13} /> Get latest
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="gp-x"
              aria-label="Dismiss"
              onClick={() => setBanner(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {tab === 'changes' ? (
        notRepo ? (
          <div className="gp-empty">
            <span className="gp-empty-glyph">
              <Icon name="folder" size={24} />
            </span>
            <h3>Not versioned yet</h3>
            <p>Once this is a Maude project, your changes show up here to Save and Publish.</p>
          </div>
        ) : clean ? (
          unpushed > 0 ? (
            <>
              <div className="gp-empty">
                <span className="gp-empty-glyph gp-empty-glyph--publish">
                  <Icon name="publish" size={24} />
                </span>
                <h3>
                  {unpushed} version{unpushed === 1 ? '' : 's'} ready to publish
                </h3>
                <p>
                  Everything's saved, but your work isn't shared yet. Publish it so the team can Get
                  latest.
                </p>
                <button type="button" className="btn btn--ghost btn--sm" onClick={openHistory}>
                  <Icon name="history" size={14} /> View History
                </button>
              </div>
              {!readOnly && publishBar}
            </>
          ) : (
            <div className="gp-empty">
              <span className="gp-empty-glyph">
                <Icon name="check" size={26} />
              </span>
              <h3>Nothing to save</h3>
              <p>Every change is saved. When you edit a canvas, it shows up here.</p>
              {!readOnly && status?.remoteAhead ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  data-tour="pull"
                  disabled={!!busy}
                  onClick={() =>
                    run('getLatest', onGetLatest, {
                      variant: 'success',
                      text: 'Up to date with everyone.',
                    })
                  }
                >
                  <Icon name="download" size={14} /> Get latest
                </button>
              ) : (
                <button type="button" className="btn btn--ghost btn--sm" onClick={openHistory}>
                  <Icon name="history" size={14} /> View History
                </button>
              )}
            </div>
          )
        ) : (
          <>
            {!readOnly && status?.remoteAhead && (
              <div className="gp-pad">
                <div className="callout callout--info gp-nudge" role="status">
                  <span className="gp-dot-pulse" aria-hidden="true" />
                  <span className="gp-nudge-text">
                    <b>
                      {status.behind} new change{status.behind === 1 ? '' : 's'} from your team.
                    </b>{' '}
                    <span>Get the latest before you publish yours.</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={!!busy}
                    onClick={() =>
                      run('getLatest', onGetLatest, { variant: 'success', text: 'Up to date with everyone.' })
                    }
                  >
                    <Icon name="download" size={14} /> Get latest
                  </button>
                </div>
              </div>
            )}

            <div className="gp-list" role="group" aria-label="Unsaved changes">
              {showSectionHeads && canvasUnits.length > 0 && (
                <div className="gp-group-hd">
                  Canvases
                  <span className="gp-group-count">· {canvasUnits.length}</span>
                </div>
              )}
              {canvasUnits.map(renderUnit)}
              {otherUnits.length > 0 && (
                <>
                  {showSectionHeads && (
                    <div className="gp-group-hd">
                      Other files
                      <span className="gp-group-count">· {otherUnits.length}</span>
                    </div>
                  )}
                  {otherUnits.map(renderUnit)}
                </>
              )}
            </div>

            {!readOnly && (
            <div className="gp-compose">
              <label className="gp-selectall">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="gp-check"
                  checked={checkedPaths.length === files.length && files.length > 0}
                  onChange={toggleAll}
                  aria-label="Select all changed files"
                />
                {checkedPaths.length} of {count} selected
              </label>
              <textarea
                className="gp-msg"
                placeholder="Describe what changed in this version…"
                aria-label="Describe what changed in this version"
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="gp-compose-actions">
                <button
                  type="button"
                  className="btn btn--primary gp-save"
                  data-tour="save-local"
                  disabled={!canSave}
                  aria-disabled={!canSave}
                  onClick={async () => {
                    const r = await run('save', () => onCommit(message.trim(), checkedPaths), {
                      variant: 'success',
                      text: 'Version saved.',
                    });
                    if (r?.ok) setMessage('');
                  }}
                >
                  <Icon name="save" size={15} /> Save version
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={!message.trim() || !!busy}
                  title="Save every change"
                  onClick={async () => {
                    const r = await run('saveAll', () => onCommit(message.trim(), undefined), {
                      variant: 'success',
                      text: 'Version saved.',
                    });
                    if (r?.ok) setMessage('');
                  }}
                >
                  Save all
                </button>
              </div>
              {!canSave && (
                <span className="gp-hint">
                  Type a message and pick at least one file to save a version.
                </span>
              )}
            </div>
            )}

            {!readOnly && publishBar}
            {readOnly && (
              <p className="gp-hint gp-ro-hint">
                Save and publish your work from your terminal — this view is read-only.
              </p>
            )}
          </>
        )
      ) : (
        <div
          className="gp-history"
          role="list"
          aria-label={previewable ? `Saved versions of ${activeName}` : 'Version history'}
        >
          {previewable && (
            <p className="gp-history-scope">
              Saved versions of <b>{activeName}</b> — pick one to preview.
            </p>
          )}
          {logLoading ? (
            <div className="gp-empty">
              <p>Loading history…</p>
            </div>
          ) : !log || log.length === 0 ? (
            <div className="gp-empty">
              <span className="gp-empty-glyph">
                <Icon name="history" size={24} />
              </span>
              <h3>No saved versions yet</h3>
              <p>
                {previewable
                  ? `Save a version of ${activeName} and it'll show up here.`
                  : "Save a version and it'll show up here."}
              </p>
            </div>
          ) : (
            log.map((c) => {
              const body = (
                <>
                  <span className="gp-version-rail">
                    <span className="gp-version-node" />
                  </span>
                  <span className="gp-version-body">
                    <span className="gp-version-msg">{c.message || '(no message)'}</span>
                    <span className="gp-version-meta">
                      {c.author} · {c.sha.slice(0, 7)}
                    </span>
                  </span>
                  <span className="gp-version-when">{timeAgo(c.date)}</span>
                </>
              );
              return previewable ? (
                <button
                  type="button"
                  className="gp-version gp-version--clickable"
                  key={c.sha}
                  onClick={() => onPreviewVersion(c.sha)}
                  title={`Preview ${activeName} at this saved version`}
                >
                  {body}
                  <span className="gp-version-cue" aria-hidden="true">
                    <Icon name="diff" size={13} /> Preview
                  </span>
                </button>
              ) : (
                <div className="gp-version" role="listitem" key={c.sha}>
                  {body}
                </div>
              );
            })
          )}
          {!previewable && log && log.length > 0 && (
            <p className="gp-history-hint">Open a canvas to preview a saved version.</p>
          )}
        </div>
      )}
    </aside>
  );
}
