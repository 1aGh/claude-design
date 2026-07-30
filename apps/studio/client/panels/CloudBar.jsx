// Cloud Phase 23 C3 — Maude Cloud in the sidebar footer.
//
// The same compact rail treatment as the GitHub IdentityBar directly below
// it, and deliberately the same `gi-*` chrome (one material, one dialog
// family). Differences that matter:
//
//   • Works in BOTH the desktop shell and a plain browser: the whole lane is
//     the dev-server's loopback `/_api/cloud/*` — no Tauri, no keychain, no
//     CORS. The credential never enters this JS; the server holds it.
//   • Sign-in is OUR device flow: the dashboard shows /activate, the person
//     types (or arrives with) the short code, this panel just polls.
//   • "Connect" attaches THIS project to the chosen cloud workspace — the
//     exact state `maude design link` writes, minus the terminal.

import { useEffect, useRef, useState } from 'react';

const api = async (path, init) => {
  const res = await fetch(path, init);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
};

function Spark({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z" />
    </svg>
  );
}

function Icon({ name, size = 15 }) {
  const p = {
    'chevron-up': <polyline points="3.5 10 8 5.5 12.5 10" />,
    external: (
      <>
        <path d="M6 3.5H3.2A.7.7 0 0 0 2.5 4.2v8.6a.7.7 0 0 0 .7.7h8.6a.7.7 0 0 0 .7-.7V10" />
        <line x1="8" y1="8" x2="13" y2="3" />
        <polyline points="9.5 3 13 3 13 6.5" />
      </>
    ),
    copy: (
      <>
        <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.2" />
        <path d="M3 10.5V3.2A.7.7 0 0 1 3.7 2.5H10" />
      </>
    ),
    link: (
      <>
        <path d="M6.5 9.5l3-3" />
        <path d="M7.5 4.5l1-1a2.47 2.47 0 0 1 3.5 3.5l-1 1" />
        <path d="M8.5 11.5l-1 1a2.47 2.47 0 0 1-3.5-3.5l1-1" />
      </>
    ),
    signout: (
      <>
        <path d="M6.5 13.5H3.2a.7.7 0 0 1-.7-.7V3.2a.7.7 0 0 1 .7-.7h3.3" />
        <line x1="13" y1="8" x2="6.5" y2="8" />
        <polyline points="10 5 13 8 10 11" />
      </>
    ),
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

export default function CloudBar() {
  const [state, setState] = useState('loading'); // loading | out | in
  const [email, setEmail] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [device, setDevice] = useState(null); // { userCode, verificationUrl, deviceCode }
  const [projects, setProjects] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const railRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    api('/_api/cloud/status').then((r) => {
      if (r.ok && r.json?.connected) {
        setEmail(r.json.email);
        setState('in');
      } else setState('out');
    });
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e) => {
      if (railRef.current && !railRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  async function startSignIn() {
    setError('');
    const r = await api('/_api/cloud/signin/start', { method: 'POST' });
    if (!r.ok || !r.json?.ok) {
      setError(r.json?.error || 'Maude Cloud could not be reached.');
      return;
    }
    setDevice(r.json);
    window.open(r.json.verificationUrl, '_blank', 'noopener');
    pollRef.current = setInterval(async () => {
      const p = await api('/_api/cloud/signin/poll', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceCode: r.json.deviceCode }),
      });
      if (p.json?.pending) return;
      clearInterval(pollRef.current);
      if (p.ok && p.json?.ok) {
        setEmail(p.json.email);
        setState('in');
        setDevice(null);
      } else {
        setDevice(null);
        setError(p.json?.error || 'The sign-in did not finish. Try again.');
      }
    }, (r.json.interval ?? 5) * 1000);
  }

  function cancelSignIn() {
    clearInterval(pollRef.current);
    setDevice(null);
  }

  async function openMenu() {
    const next = !menuOpen;
    setMenuOpen(next);
    if (next && projects === null) {
      const r = await api('/_api/cloud/projects');
      setProjects(r.ok && r.json?.ok ? r.json.projects : []);
      if (!r.ok && r.status === 401) {
        setMenuOpen(false);
        setState('out');
        setEmail(null);
      }
    }
  }

  async function connect(projectId) {
    setBusy(projectId);
    setNote('');
    setError('');
    const r = await api('/_api/cloud/attach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project: projectId }),
    });
    setBusy('');
    if (r.ok && r.json?.ok) {
      setNote(`Linked to ${projectId} — restart the studio server to start syncing.`);
    } else {
      setError(r.json?.error || 'The workspace could not be connected.');
    }
    setMenuOpen(false);
  }

  async function signOut() {
    setMenuOpen(false);
    await api('/_api/cloud/signout', { method: 'POST' });
    setEmail(null);
    setProjects(null);
    setState('out');
  }

  function copyCode() {
    if (!device?.userCode) return;
    navigator.clipboard?.writeText(device.userCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  if (state === 'loading') return null;

  return (
    <div className="gi-rail cb-rail" ref={railRef} data-testid="cloud-bar">
      {state === 'out' && (
        <>
          <button type="button" className="btn btn--ghost btn--sm gi-rail-signin" onClick={startSignIn} data-testid="cloud-signin">
            <Spark size={14} /> Sign in to Maude Cloud
          </button>
          {error && <span className="gi-rail-err" title={error}>{error}</span>}
        </>
      )}

      {state === 'in' && (
        <>
          <button
            type="button"
            className={'gi-rail-account' + (menuOpen ? ' is-open' : '')}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={openMenu}
            title={`Maude Cloud — ${email ?? 'connected'}`}
            data-testid="cloud-account"
          >
            <span className="gi-avatar gi-avatar--fallback" aria-hidden="true"><Spark size={14} /></span>
            <span className="gi-rail-login">{email ?? 'Maude Cloud'}</span>
            <span className="gi-rail-caret"><Icon name="chevron-up" size={13} /></span>
          </button>
          {note && <span className="gi-rail-hint" title={note}>{note}</span>}
          {error && <span className="gi-rail-err" title={error}>{error}</span>}
          {menuOpen && (
            <div className="gi-menu" role="menu" aria-label="Maude Cloud">
              <div className="gi-menu-hd">
                <span className="gi-avatar gi-avatar--fallback" aria-hidden="true"><Spark size={16} /></span>
                <span className="gi-menu-id">
                  <span className="gi-menu-name">Maude Cloud</span>
                  <span className="gi-menu-login">{email ?? 'connected'}</span>
                </span>
              </div>
              {projects === null && <div className="gi-menu-item" aria-disabled="true">Loading projects…</div>}
              {Array.isArray(projects) && projects.length === 0 && (
                <div className="gi-menu-item" aria-disabled="true">No projects yet — start one on the dashboard.</div>
              )}
              {Array.isArray(projects) &&
                projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="gi-menu-item"
                    role="menuitem"
                    disabled={busy === p.id}
                    onClick={() => connect(p.id)}
                    title={`Connect this project to ${p.url} (${p.role})`}
                    data-testid={`cloud-project-${p.id}`}
                  >
                    <Icon name="link" size={15} /> {busy === p.id ? 'Connecting…' : `Connect ${p.name || p.id}`}
                    <span className="gi-menu-login" style={{ marginLeft: 'auto' }}>{p.stateLabel}</span>
                  </button>
                ))}
              <div className="gi-menu-sep" />
              <button type="button" className="gi-menu-item" role="menuitem" onClick={() => window.open('https://cloud.maude.sh', '_blank', 'noopener')}>
                <Icon name="external" size={15} /> Open the dashboard
              </button>
              <button type="button" className="gi-menu-item gi-menu-item--danger" role="menuitem" onClick={signOut}>
                <Icon name="signout" size={15} /> Sign out
              </button>
            </div>
          )}
        </>
      )}

      {device && (
        <div className="gi-modal" role="dialog" aria-modal="true" aria-label="Sign in to Maude Cloud" onKeyDown={(e) => { if (e.key === 'Escape') cancelSignIn(); }}>
          <div className="gi-scrim" aria-hidden="true" onClick={cancelSignIn} />
          <div className="gi-dialog gi-dialog--code" data-testid="cloud-device-dialog">
            <div className="gi-dc-head">
              <span className="gi-dc-marks"><Spark size={26} /></span>
              <h2>Sign in to Maude Cloud</h2>
              <p>Maude opened your dashboard in the browser. Confirm this code there to connect.</p>
            </div>
            <div className="gi-code">
              <span className="gi-code-val" data-testid="cloud-user-code">{device.userCode}</span>
              <button type="button" className="btn btn--ghost gi-code-copy" onClick={copyCode} aria-label="Copy the code">
                <Icon name="copy" size={15} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="gi-dc-status" aria-live="polite">
              <span className="gi-pulse" aria-hidden="true" />
              <span>Waiting for you to confirm in the browser…</span>
            </div>
            <div className="gi-dc-foot">
              <button type="button" className="btn btn--ghost" onClick={cancelSignIn}>Cancel</button>
              <span className="gi-dc-foot-note">Nothing is stored until you confirm.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
