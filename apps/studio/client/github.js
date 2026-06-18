// client/github.js — thin bridge from the React client to (a) the Tauri shell's
// GitHub commands and (b) the dev-server's /_api/github/* endpoints. Phase 28 (E3).
//
// Sign-in / sign-out / keychain live in the Tauri shell (oauth.rs / keychain.rs),
// reached via `window.__TAURI__` (withGlobalTauri). The profile + create-repo +
// invite + repos go through the dev-server endpoints (which read the token from
// the loopback bridge). In a plain browser (no Tauri) `isNativeApp()` is false and
// the IdentityBar shows the "open the desktop app" state instead of sign-in.

export function isNativeApp() {
  return typeof window !== 'undefined' && !!window.__TAURI__;
}

function tauri() {
  const t = typeof window !== 'undefined' ? window.__TAURI__ : null;
  if (!t) throw new Error('GitHub sign-in is only available in the Maude desktop app.');
  return t;
}

/** Invoke a Tauri command (throws outside the app). */
export function invoke(cmd, args) {
  return tauri().core.invoke(cmd, args);
}

/** Subscribe to a Tauri event; resolves to an async unlisten fn. */
export function listen(event, handler) {
  return tauri().event.listen(event, (e) => handler(e.payload));
}

// ── Tauri shell commands ──────────────────────────────────────────────────────
/** Run the device flow; resolves to the login (public handle) on success. */
export const signIn = () => invoke('github_sign_in');
export const signOut = () => invoke('github_sign_out');
/** Whether a token is in the keychain (boolean). Safe to call on launch. */
export const isSignedIn = () => invoke('github_is_signed_in');
export const openVerification = () =>
  invoke('github_open_verification', { url: 'https://github.com/login/device' });
/** Show the device code as soon as the shell has it. Returns an unlisten promise. */
export const onDeviceCode = (cb) => listen('github://device-code', cb);

// ── dev-server endpoints ────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(path, { ...opts, headers });
  } catch {
    return { ok: false, status: 0, json: { error: 'Maude isn’t reachable right now.' } };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

export const fetchIdentity = () => api('/_api/github/identity');
export const listRepos = () => api('/_api/github/repos');
export const createRepo = (body) => api('/_api/github/create-repo', { method: 'POST', body: JSON.stringify(body) });
export const invite = (username) => api('/_api/github/invite', { method: 'POST', body: JSON.stringify({ username }) });
export const cloneRepo = (body) => api('/_api/github/clone', { method: 'POST', body: JSON.stringify(body) });

// ── Tauri shell commands for "pull a local copy" ────────────────────────────────
/** Native folder picker → chosen parent dir, or null if cancelled. */
export const pickDirectory = () => invoke('pick_directory');
/** Switch the app to a local project folder (the freshly cloned copy). */
export const openLocalProject = (path) => invoke('open_local_project', { path });
