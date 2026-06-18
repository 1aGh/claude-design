// Phase 27 (epic E2) Task 6 — the in-Maude git-awareness panel.
//
// Built 1:1 from the approved `.design/ui/GitPanel.tsx` mock (Changes panel ·
// Save a version · Publish + Get-latest nudge · Nothing-to-save · Publish-
// rejected), wired to live git state. Vocabulary is load-bearing and NEVER leaks
// git jargon: Save version (commit) · Publish (push) · Get latest (pull) ·
// History (log) · Unsaved (dirty M/A/D/U) · Draft (branch). Renders in the
// shell's right dock (st-rpanel), driven by the `git-status` WS broadcast.

import { useEffect, useMemo, useRef, useState } from 'react';

const KIND_OF = { modified: 'M', added: 'A', deleted: 'D', untracked: 'U' };
const KIND_TITLE = { M: 'Modified', A: 'Added', D: 'Deleted', U: 'Untracked' };
const GROUP_ORDER = ['M', 'A', 'D', 'U'];

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

function baseName(p) {
  const s = p.split('/').pop() || p;
  return s.replace(/\.(tsx|html|meta\.json|css|svg|json)$/i, '');
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
}) {
  const [tab, setTab] = useState('changes');
  const [message, setMessage] = useState('');
  const [unchecked, setUnchecked] = useState(() => new Set()); // default = all checked
  const [busy, setBusy] = useState(null);
  const [banner, setBanner] = useState(null); // { variant, title?, text }
  const [log, setLog] = useState(null);
  const [logLoading, setLogLoading] = useState(false);
  const selectAllRef = useRef(null);

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

  const groups = useMemo(() => {
    const by = { M: [], A: [], D: [], U: [] };
    for (const f of files) by[KIND_OF[f.status]]?.push(f);
    return GROUP_ORDER.map((k) => ({ kind: k, items: by[k] })).filter((g) => g.items.length);
  }, [files]);

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
        return res;
      }
      if (res.authRequired)
        setBanner({
          variant: 'info',
          text: res.error || 'Sign in with GitHub to publish — coming soon.',
        });
      else if (res.conflict)
        setBanner({
          variant: 'warn',
          title: "Publish didn't go through",
          text: 'The shared project moved on while you were working. Get the latest, then publish yours on top.',
          getLatest: true,
        });
      else setBanner({ variant: 'error', text: res.error || 'Something went wrong.' });
      return res;
    } finally {
      setBusy(null);
    }
  }

  async function openHistory() {
    setTab('history');
    if (log || logLoading) return;
    setLogLoading(true);
    try {
      setLog((await loadLog()) || []);
    } finally {
      setLogLoading(false);
    }
  }

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
              {publishBar}
            </>
          ) : (
            <div className="gp-empty">
              <span className="gp-empty-glyph">
                <Icon name="check" size={26} />
              </span>
              <h3>Nothing to save</h3>
              <p>Every change is saved. When you edit a canvas, it shows up here.</p>
              {status?.remoteAhead ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
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
            {status?.remoteAhead && (
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
              {groups.map((g) => (
                <div key={g.kind}>
                  <div className="gp-group-hd">
                    <Badge kind={g.kind} />
                    {KIND_TITLE[g.kind]}
                    <span className="gp-group-count">· {g.items.length}</span>
                  </div>
                  {g.items.map((f) => {
                    const checked = !unchecked.has(f.path);
                    return (
                      <div className={'gp-file' + (checked ? ' is-checked' : '')} key={f.path}>
                        <input
                          type="checkbox"
                          className="gp-check"
                          checked={checked}
                          aria-label={`Include ${baseName(f.path)} in this version`}
                          onChange={() =>
                            setUnchecked((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(f.path);
                              else next.delete(f.path);
                              return next;
                            })
                          }
                        />
                        <Badge kind={KIND_OF[f.status]} />
                        <button
                          type="button"
                          className="gp-file-text"
                          title={f.path}
                          onClick={() => onOpenCanvas?.(f.path)}
                        >
                          <span className="gp-file-name">{baseName(f.path)}</span>
                          <span className="gp-file-path">{f.path}</span>
                        </button>
                        <button
                          type="button"
                          className="gp-discard"
                          title="Compare before / after"
                          aria-label={`Compare ${baseName(f.path)}`}
                          onClick={() => onOpenDiff?.(f.path)}
                        >
                          <Icon name="diff" size={14} />
                        </button>
                        <button
                          type="button"
                          className="gp-discard"
                          title="Discard this change"
                          aria-label={`Discard changes to ${baseName(f.path)}`}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Discard your changes to “${baseName(f.path)}”? This can't be undone.`
                              )
                            )
                              return;
                            await run('discard', () => onDiscard([f.path]));
                          }}
                        >
                          <Icon name="undo" size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

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

            {publishBar}
          </>
        )
      ) : (
        <div className="gp-history" role="list" aria-label="Version history">
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
              <p>Save a version and it'll show up here.</p>
            </div>
          ) : (
            log.map((c) => (
              <div className="gp-version" role="listitem" key={c.sha}>
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
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
