// Phase 28 (epic E3) Task 6 — start / open / share a project.
//
// Built from the approved `.design/ui/CreateProject.tsx` mock, opened from the
// IdentityBar account menu. Three views:
//   • new   — name + Private(default)/Public + description → POST create-repo
//             (sets origin on the local project; you then Publish to share).
//   • open  — your projects (GET repos) + paste-a-link. Cloning a project into a
//             fresh window is the in-app project switcher (phase-29); here we list
//             + link out honestly rather than fake a switch.
//   • share — invite a teammate by GitHub username → POST invite.
// Vocabulary stays plain — "project" not "repository", "Invite", "people".

import { useEffect, useState } from 'react';

import { createRepo, invite, listRepos } from '../github.js';

function Icon({ name, size = 16 }) {
  const p = {
    lock: (
      <>
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
        <path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
      </>
    ),
    globe: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M2.5 8h11M8 2.5c1.7 1.5 2.6 3.5 2.6 5.5S9.7 12.5 8 13.5C6.3 12 5.4 10 5.4 8S6.3 3.5 8 2.5z" />
      </>
    ),
    x: (
      <>
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
        <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
      </>
    ),
    check: <polyline points="3 8.2 6.4 11.5 13 4.2" />,
    plus: (
      <>
        <line x1="8" y1="3" x2="8" y2="13" />
        <line x1="3" y1="8" x2="13" y2="8" />
      </>
    ),
    invite: (
      <>
        <circle cx="6" cy="5.5" r="2.5" />
        <path d="M2 13.5a4 4 0 0 1 8 0" />
        <line x1="13" y1="5" x2="13" y2="9" />
        <line x1="11" y1="7" x2="15" y2="7" />
      </>
    ),
    external: (
      <>
        <path d="M6 3.5H3.2A.7.7 0 0 0 2.5 4.2v8.6a.7.7 0 0 0 .7.7h8.6a.7.7 0 0 0 .7-.7V10" />
        <line x1="8" y1="8" x2="13" y2="3" />
        <polyline points="9.5 3 13 3 13 6.5" />
      </>
    ),
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

const TITLES = {
  new: ['Create a new project', 'A private project on GitHub, set up for you.'],
  open: ['Open a project', 'Your projects, or paste a link someone shared.'],
  share: ['Share this project', 'Invite a teammate by their GitHub username.'],
};

export default function CreateProject({ view, identity, onClose }) {
  const [title, sub] = TITLES[view] || TITLES.new;
  return (
    <div className="cp-modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="cp-scrim" aria-hidden="true" onClick={onClose} />
      <div className="cp-modal-card panel">
        <div className="cp-modal-hd">
          <span className="cp-modal-titles">
            <h2>{title}</h2>
            <p>{sub}</p>
          </span>
          <button type="button" className="btn btn--icon" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>
        {view === 'new' && <NewView identity={identity} onClose={onClose} />}
        {view === 'open' && <OpenView />}
        {view === 'share' && <ShareView onClose={onClose} />}
      </div>
    </div>
  );
}

function NewView({ identity, onClose }) {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null); // the created repo

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const owner = identity?.login || 'you';

  async function submit() {
    setErr('');
    setBusy(true);
    const r = await createRepo({ name, private: isPrivate, description: desc });
    setBusy(false);
    if (r.ok && r.json?.ok) setDone(r.json.repo);
    else setErr(r.json?.error || 'Couldn’t create the project. Try again.');
  }

  if (done) {
    return (
      <>
        <div className="cp-body">
          <div className="callout callout--success cp-invited">
            <span style={{ color: 'var(--status-success)', flex: '0 0 auto' }}><Icon name="check" /></span>
            <span>
              <b style={{ color: 'var(--fg-0)' }}>Created “{done.full_name}”.</b> Your project is on GitHub and this
              workspace now points at it — <b>Publish</b> your work (Changes panel) to share it.
            </span>
          </div>
          <div className="cp-foot-note" style={{ padding: '0 var(--space-1)' }}>
            <Icon name="external" size={13} /> {done.html_url.replace(/^https?:\/\//, '')}
          </div>
        </div>
        <div className="cp-foot">
          <span className="cp-spacer" />
          <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cp-body">
        <label className="cp-field">
          <span className="cp-field-label">Project name</span>
          <input className="input cp-input" type="text" value={name} placeholder="Acme Rebrand" aria-label="Project name" onChange={(e) => setName(e.target.value)} autoFocus />
          {slug && <span className="cp-field-help">Creates <b>github.com/{owner}/{slug}</b></span>}
        </label>
        <div className="cp-field">
          <span className="cp-field-label">Who can see it</span>
          <div className="seg cp-seg" role="group" aria-label="Project visibility">
            <button type="button" aria-pressed={isPrivate} onClick={() => setIsPrivate(true)}><Icon name="lock" size={14} /> Private</button>
            <button type="button" aria-pressed={!isPrivate} onClick={() => setIsPrivate(false)}><Icon name="globe" size={14} /> Public</button>
          </div>
          <span className="cp-field-help">{isPrivate ? 'Only you and people you invite. The safe default.' : 'Anyone on the internet can see this project.'}</span>
        </div>
        <label className="cp-field">
          <span className="cp-field-label">Description <span className="cp-optional">optional</span></span>
          <textarea className="textarea cp-textarea" rows={2} value={desc} placeholder="What is this project for?" aria-label="Project description" onChange={(e) => setDesc(e.target.value)} />
        </label>
        {err && <div className="callout callout--error"><span style={{ color: 'var(--status-error)', flex: '0 0 auto' }}><Icon name="x" /></span><span>{err}</span></div>}
      </div>
      <div className="cp-foot">
        <span className="cp-spacer" />
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn--primary" onClick={submit} disabled={busy || !slug}>
          <Icon name="plus" size={15} /> {busy ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </>
  );
}

function OpenView() {
  const [repos, setRepos] = useState(null); // null=loading, []=empty
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      const r = await listRepos();
      if (r.ok && r.json?.ok) setRepos(r.json.repos || []);
      else { setErr(r.json?.error || 'Couldn’t load your projects.'); setRepos([]); }
    })();
  }, []);
  return (
    <>
      <div className="cp-body cp-body--list">
        {err && <div className="callout callout--error"><span>{err}</span></div>}
        {repos === null && <div className="cp-field-help">Loading your projects…</div>}
        {repos && repos.length === 0 && !err && <div className="cp-field-help">No projects yet — create one to get started.</div>}
        {repos && repos.length > 0 && (
          <div className="cp-repolist" role="group" aria-label="Your projects">
            {repos.map((r) => (
              <a key={r.full_name} className="cp-repo" href={r.html_url} target="_blank" rel="noreferrer">
                <Icon name={r.private ? 'lock' : 'globe'} size={14} />
                <span className="cp-repo-tx">
                  <span className="cp-repo-name">{r.name}</span>
                  <span className="cp-repo-meta">{r.owner} · updated {new Date(r.updated_at).toLocaleDateString()}</span>
                </span>
                <Icon name="external" size={15} />
              </a>
            ))}
          </div>
        )}
        <div className="cp-field-help" style={{ paddingTop: 'var(--space-2)' }}>
          Opening a shared project in its own window arrives with the project switcher. For now, this lists the
          projects you can reach on GitHub.
        </div>
      </div>
    </>
  );
}

function ShareView({ onClose }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [invited, setInvited] = useState(null);

  async function submit() {
    setErr('');
    setBusy(true);
    const r = await invite(username);
    setBusy(false);
    if (r.ok && r.json?.ok) setInvited(r.json.username);
    else setErr(r.json?.error || 'Couldn’t send the invite. Try again.');
  }

  return (
    <>
      <div className="cp-body">
        <div className="cp-invite">
          <span className="cp-invite-at" aria-hidden="true">@</span>
          <input className="input cp-invite-input" type="text" value={username} placeholder="github-username" aria-label="GitHub username to invite" onChange={(e) => setUsername(e.target.value)} autoFocus />
          <button type="button" className="btn btn--primary cp-invite-btn" onClick={submit} disabled={busy || !username.trim()}>
            <Icon name="invite" size={15} /> {busy ? 'Inviting…' : 'Invite'}
          </button>
        </div>
        {invited && (
          <div className="callout callout--success cp-invited">
            <span style={{ color: 'var(--status-success)', flex: '0 0 auto' }}><Icon name="check" /></span>
            <span><b style={{ color: 'var(--fg-0)' }}>Invited @{invited}.</b> They’ll get a GitHub email and can open this project once they accept.</span>
          </div>
        )}
        {err && <div className="callout callout--error"><span style={{ color: 'var(--status-error)', flex: '0 0 auto' }}><Icon name="x" /></span><span>{err}</span></div>}
      </div>
      <div className="cp-foot">
        <span className="cp-spacer" />
        <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
      </div>
    </>
  );
}
