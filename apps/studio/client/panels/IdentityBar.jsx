// Phase 28 (epic E3) Task 6 — the GitHub identity bar (sidebar header).
//
// Built from the approved `.design/ui/GitHubIdentity.tsx` mock. Signed-out → the
// "Sign in with GitHub" button (device flow); during sign-in → the device-code
// modal (code + "open github.com" + waiting pulse); signed-in → avatar + login +
// an account menu that opens the CreateProject modal (New / Open / Share) and
// signs out. In a plain browser (no Tauri shell) it shows the "open the desktop
// app" note instead of sign-in. Vocabulary stays plain — never "OAuth"/"token".
//
// Self-contained on purpose: it owns the device-code modal AND the CreateProject
// overlay, so app.jsx mounts a single <IdentityBar /> with no prop threading.

import { useEffect, useRef, useState } from 'react';

import CreateProject from './CreateProject.jsx';
import {
  fetchIdentity,
  isNativeApp,
  isSignedIn,
  onDeviceCode,
  openVerification,
  signIn,
  signOut,
} from '../github.js';

function Icon({ name, size = 16 }) {
  const p = {
    'chevron-down': <polyline points="3.5 6 8 10.5 12.5 6" />,
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
    plus: (
      <>
        <line x1="8" y1="3" x2="8" y2="13" />
        <line x1="3" y1="8" x2="13" y2="8" />
      </>
    ),
    folder: <path d="M2 4.5h4l1.3 1.5H14V13H2z" />,
    invite: (
      <>
        <circle cx="6" cy="5.5" r="2.5" />
        <path d="M2 13.5a4 4 0 0 1 8 0" />
        <line x1="13" y1="5" x2="13" y2="9" />
        <line x1="11" y1="7" x2="15" y2="7" />
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
    <svg
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

function GitHubMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function initialsOf(identity) {
  const src = (identity?.name || identity?.login || '?').trim();
  const parts = src.split(/[\s_-]+/).filter(Boolean);
  const ini = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return ini.toUpperCase();
}

function Avatar({ identity, size = 22 }) {
  return (
    <span className="gi-avatar" style={{ width: size, height: size }}>
      {initialsOf(identity)}
    </span>
  );
}

export default function IdentityBar() {
  const native = isNativeApp();
  const [state, setState] = useState('loading'); // loading | out | in | browser
  const [identity, setIdentity] = useState(null);
  const [device, setDevice] = useState(null); // {user_code, verification_uri, expires_in}
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState(null); // null | 'new' | 'open' | 'share'
  const [copied, setCopied] = useState(false);
  const unlistenRef = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!native) {
      setState('browser');
      return;
    }
    (async () => {
      try {
        const signed = await isSignedIn();
        if (!alive) return;
        if (signed) {
          const r = await fetchIdentity();
          if (!alive) return;
          if (r.ok && r.json?.ok) {
            setIdentity({ login: r.json.login, name: r.json.name, avatar_url: r.json.avatar_url });
            setState('in');
          } else {
            setState('out');
          }
        } else {
          setState('out');
        }
      } catch {
        if (alive) setState('out');
      }
    })();
    return () => {
      alive = false;
      unlistenRef.current?.then?.((fn) => fn?.());
    };
  }, [native]);

  async function handleSignIn() {
    setError('');
    setSigning(true);
    setDevice(null);
    try {
      unlistenRef.current = onDeviceCode((payload) => setDevice(payload));
      const login = await signIn(); // resolves when authorized
      // Pull the full profile for the avatar/name.
      const r = await fetchIdentity();
      setIdentity(
        r.ok && r.json?.ok
          ? { login: r.json.login, name: r.json.name, avatar_url: r.json.avatar_url }
          : { login, name: null, avatar_url: null }
      );
      setState('in');
    } catch (e) {
      setError(String(e?.message || e || 'Sign-in didn’t finish. Please try again.'));
    } finally {
      setSigning(false);
      setDevice(null);
      unlistenRef.current?.then?.((fn) => fn?.());
      unlistenRef.current = null;
    }
  }

  async function handleSignOut() {
    setMenuOpen(false);
    try {
      await signOut();
    } catch {
      /* keychain delete is idempotent; ignore */
    }
    setIdentity(null);
    setState('out');
  }

  function copyCode() {
    if (!device?.user_code) return;
    navigator.clipboard?.writeText(device.user_code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  // ── render ───────────────────────────────────────────────────────────────
  let body;
  if (state === 'loading') {
    body = <div className="gi-idbar-hint">Checking your GitHub sign-in…</div>;
  } else if (state === 'browser') {
    body = (
      <div className="gi-idbar-note">
        <GitHubMark size={14} /> Open the Maude desktop app to sign in with GitHub.
      </div>
    );
  } else if (state === 'out') {
    body = (
      <>
        <button type="button" className="btn btn--primary gi-signin-btn" onClick={handleSignIn} disabled={signing}>
          <GitHubMark size={16} /> {signing ? 'Starting…' : 'Sign in with GitHub'}
        </button>
        <p className="gi-idbar-hint">Connect your account to publish changes and create projects.</p>
        {error && <p className="gi-idbar-err">{error}</p>}
      </>
    );
  } else {
    body = (
      <>
        <button
          type="button"
          className={'gi-account' + (menuOpen ? ' is-open' : '')}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Avatar identity={identity} />
          <span className="gi-account-tx">
            <span className="gi-account-name">{identity?.name || identity?.login}</span>
            <span className="gi-account-login">@{identity?.login}</span>
          </span>
          <span className="gi-account-caret">
            <Icon name="chevron-down" size={14} />
          </span>
        </button>
        {menuOpen && (
          <div className="gi-menu panel" role="menu" aria-label="GitHub account">
            <div className="gi-menu-hd">
              <Avatar identity={identity} size={34} />
              <span className="gi-menu-id">
                <span className="gi-account-name">{identity?.name || identity?.login}</span>
                <span className="gi-account-login">@{identity?.login} · connected</span>
              </span>
            </div>
            <button type="button" className="gi-menu-item" role="menuitem" onClick={() => { setMenuOpen(false); setView('new'); }}>
              <Icon name="plus" size={15} /> New project
            </button>
            <button type="button" className="gi-menu-item" role="menuitem" onClick={() => { setMenuOpen(false); setView('open'); }}>
              <Icon name="folder" size={15} /> Open a project
            </button>
            <button type="button" className="gi-menu-item" role="menuitem" onClick={() => { setMenuOpen(false); setView('share'); }}>
              <Icon name="invite" size={15} /> Share this project
            </button>
            <div className="gi-menu-sep" />
            <button type="button" className="gi-menu-item gi-menu-item--danger" role="menuitem" onClick={handleSignOut}>
              <Icon name="signout" size={15} /> Sign out
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="gi-idbar">
      {body}

      {device && (
        <div className="gi-modal" role="dialog" aria-modal="true" aria-label="Sign in with GitHub" onKeyDown={(e) => { if (e.key === 'Escape') setDevice(null); }}>
          <div className="gi-scrim" aria-hidden="true" onClick={() => setDevice(null)} />
          <div className="gi-modal-card panel">
            <div className="gi-dc-head">
              <span className="gi-dc-marks"><GitHubMark size={26} /></span>
              <h2>Sign in with GitHub</h2>
              <p>Maude opened GitHub in your browser. Enter this code to connect your account.</p>
            </div>
            <ol className="gi-dc-steps">
              <li>
                <span className="gi-dc-step-n">1</span>
                <span className="gi-dc-step-tx">
                  Go to <span className="gi-dc-url">{(device.verification_uri || 'github.com/login/device').replace(/^https?:\/\//, '')}</span>
                  <button type="button" className="btn btn--ghost btn--sm gi-dc-open" onClick={() => openVerification().catch(() => {})}>
                    <Icon name="external" size={14} /> Open it again
                  </button>
                </span>
              </li>
              <li>
                <span className="gi-dc-step-n">2</span>
                <span className="gi-dc-step-tx">Enter this code to connect Maude</span>
              </li>
            </ol>
            <div className="gi-code">
              <span className="gi-code-val">{device.user_code}</span>
              <button type="button" className="btn btn--ghost gi-code-copy" onClick={copyCode} aria-label="Copy the code">
                <Icon name="copy" size={15} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="gi-dc-status" aria-live="polite">
              <span className="gi-pulse" aria-hidden="true" />
              <span>Waiting for you to authorize in your browser…</span>
            </div>
            <div className="gi-modal-foot">
              <button type="button" className="btn btn--ghost" onClick={() => setDevice(null)}>
                Cancel
              </button>
              <span className="gi-dc-foot-note">Nothing is stored until you authorize.</span>
            </div>
          </div>
        </div>
      )}

      {view && <CreateProject view={view} identity={identity} onClose={() => setView(null)} />}
    </div>
  );
}
