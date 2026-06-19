// Studio Hub admin — vanilla JS, no framework.
//
// State machine:
//   ?key=<bootstrap>     → "bootstrap" view (one-time claim)
//   localStorage secret  → "dash" view (sidebar-nav app-shell)
//   neither              → "onboard" view (paste HUB_SECRET)
//
// The authed "dash" view is a sidebar-nav app-shell with six panes
// (overview / peers / tokens / canvases / activity / settings) switched
// client-side; the 5s poll refreshes the live data behind them.

const LS_KEY = 'maude-hub-secret';
const $ = (id) => document.getElementById(id);

// Resolve the admin API base from where THIS page is served so the UI works
// mounted at the root (/admin) AND behind a path-stripping reverse proxy that
// rewrites e.g. /hub/admin → /admin. Trailing slash tolerated (defensive).
const API_BASE = `${location.pathname.replace(/\/+$/, '')}/api`;

const state = {
  secret: localStorage.getItem(LS_KEY) || '',
  bootstrapKey: new URLSearchParams(location.search).get('key') || '',
  hubIdentity: null, // { publicUrl, version, hostFingerprint }
  refreshTimer: 0,
  view: 'overview',
  settingsLoaded: false,
};

// DDR-053 §7: strip ?key= from the URL immediately on load so a failed
// bootstrap POST or accidental tab refresh doesn't leak the key into the
// browser's address bar / session history.
if (state.bootstrapKey) {
  history.replaceState({}, '', location.pathname);
}

function showOnly(id) {
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== id;
}

function showAuthState(authenticated) {
  $('auth-state').hidden = !authenticated;
}

async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (state.secret) headers.set('Authorization', `Bearer ${state.secret}`);
  if (opts.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    state.secret = '';
    localStorage.removeItem(LS_KEY);
    render();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ------------------------------------------------------------ formatters

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatUptimeShort(ms) {
  const s = Math.round(ms / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function formatBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// Deterministic swatch index from a name (0–5). The colour is applied via a
// `.avatar--N` CSS class, NOT an inline style — the admin CSP `style-src 'self'`
// drops inline styles, which would leave avatars uncoloured.
function swatchIndex(name) {
  const s = String(name || 'anon');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 6;
}
function avatar(name) {
  const n = String(name || 'anon');
  return `<span class="avatar avatar--${swatchIndex(n)}" aria-hidden="true">${escapeHtml(n[0] || '?')}</span>`;
}

// -------------------------------- render ----------------------------------

function render() {
  if (state.bootstrapKey && !state.secret) {
    showOnly('bootstrap');
    showAuthState(false);
    void loadIdentityForBootstrapView();
    return;
  }
  if (!state.secret) {
    showOnly('onboard');
    showAuthState(false);
    return;
  }
  showOnly('dash');
  showAuthState(true);
  refresh();
  if (!state.settingsLoaded) void loadSettings();
}

// DDR-053 §7: surface the hub's identity (publicUrl + fingerprint) on the
// bootstrap screen so the operator can confirm they're claiming the hub they
// intended — defeats the phishing-claim-link conditioning attack (F6).
async function loadIdentityForBootstrapView() {
  if (state.hubIdentity) return; // memoize
  try {
    const res = await fetch(`${API_BASE}/identity`);
    if (!res.ok) return;
    state.hubIdentity = await res.json();
    const slot = $('bootstrap-identity');
    if (slot) {
      slot.innerHTML = `\
<div class="fp-row"><span class="fp-k">Claiming</span><span class="fp-v">${escapeHtml(state.hubIdentity.publicUrl)}</span></div>\
<div class="fp-row"><span class="fp-k">Fingerprint</span><span class="fp-v fp-hash">${escapeHtml(state.hubIdentity.hostFingerprint)}</span></div>\
${state.hubIdentity.version ? `<div class="fp-row"><span class="fp-k">Version</span><span class="fp-v">${escapeHtml(state.hubIdentity.version)}</span></div>` : ''}`;
    }
  } catch {
    /* identity is informational — UI still functional without it */
  }
}

async function refresh() {
  try {
    const [status, tokens, peers, canvases, activity] = await Promise.all([
      api('/status'),
      api('/tokens'),
      api('/peers'),
      api('/canvases'),
      api('/activity'),
    ]);
    renderStatus(status, peers);
    renderTokens(tokens, peers.peers);
    renderPeers(peers);
    renderPeersOverview(peers);
    renderCanvases(canvases);
    renderActivity(activity);
    updateCounts(peers, tokens, canvases, status);
    applySearch();
  } catch (err) {
    if (err.message !== 'Unauthorized') console.warn('[hub-admin] refresh failed:', err.message);
  }
}

function renderStatus(s, peers) {
  $('s-uptime').textContent = formatDuration(s.uptimeMs);
  $('s-version').textContent = s.version;
  $('s-port').textContent = s.port;
  $('s-data').textContent = s.dataDir;
  $('s-tokens').textContent = `${s.tokenCount} (${s.authMode})`;
  $('s-peers').textContent = peers.peers.length;
}

function updateCounts(peers, tokens, canvases, status) {
  const np = peers.peers.length;
  const nt = tokens.tokens.length;
  const nc = canvases.canvases.length;
  $('nav-count-peers').textContent = np ? String(np) : '';
  $('nav-count-tokens').textContent = nt ? String(nt) : '';
  $('nav-count-canvases').textContent = nc ? String(nc) : '';
  $('stat-peers').textContent = np;
  $('stat-tokens').textContent = nt;
  $('stat-canvases').textContent = nc;
  $('stat-uptime').textContent = formatUptimeShort(status.uptimeMs);
}

// Scope chip — hub-wide (wildcard) vs a label-scoped prefix.
function scopeChip(scope) {
  if (!scope || scope === '*') return '<span class="scope scope--wide">hub-wide</span>';
  return `<span class="scope">${escapeHtml(scope)}</span>`;
}

// Live-session count per token label (peers that authed with it).
function sessionsByLabel(peers) {
  const m = new Map();
  for (const peer of peers) m.set(peer.user, (m.get(peer.user) ?? 0) + 1);
  return m;
}

function sessionsCell(n) {
  return n
    ? `<span class="sessions"><span class="sdot" aria-hidden="true"></span> ${n}</span>`
    : '<span class="sessions is-zero"><span class="sdot" aria-hidden="true"></span> 0</span>';
}

function renderTokens(t, peers) {
  const rows = t.tokens;
  const tbody = $('tokens-rows');
  if (!rows.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="6">No tokens yet.</td></tr>';
    return;
  }
  const sessions = sessionsByLabel(peers);
  tbody.innerHTML = rows
    .map((r) => {
      const lbl = escapeHtml(r.label);
      return (
        `<tr><td><span class="user">${avatar(r.label)} ${lbl}${r.dev ? ' <code>dev</code>' : ''}</span></td>` +
        `<td>${scopeChip(r.scope)}</td>` +
        `<td class="td-num">${escapeHtml(formatTime(r.createdAt))}</td>` +
        `<td class="td-num">${escapeHtml(formatTime(r.lastUsedAt))}</td>` +
        `<td>${sessionsCell(sessions.get(r.label) ?? 0)}</td>` +
        `<td class="td-act">` +
        `<button class="btn btn--ghost btn--sm" data-rotate="${lbl}"><svg class="ic" aria-hidden="true"><use href="#i-rotate"/></svg> Rotate</button> ` +
        `<button class="btn btn--danger btn--sm" data-delete="${lbl}" aria-label="Delete token ${lbl}"><svg class="ic" aria-hidden="true"><use href="#i-trash"/></svg></button>` +
        `</td></tr>`
      );
    })
    .join('');
  for (const btn of tbody.querySelectorAll('button[data-rotate]')) {
    btn.addEventListener('click', () => rotate(btn.dataset.rotate));
  }
  for (const btn of tbody.querySelectorAll('button[data-delete]')) {
    btn.addEventListener('click', () => deleteToken(btn.dataset.delete));
  }
}

// Full Peers table — Canvas · User · Scope · Connected · Kick.
function renderPeers(p) {
  const tbody = $('peers-rows');
  if (!p.peers.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="5">No peers connected.</td></tr>';
    return;
  }
  tbody.innerHTML = p.peers
    .map(
      (peer) =>
        `<tr><td class="td-doc">${escapeHtml(peer.documentName)}</td>` +
        `<td><span class="user">${avatar(peer.user || 'anon')} ${escapeHtml(peer.user || 'anon')}</span></td>` +
        `<td>${scopeChip(peer.scope)}</td>` +
        `<td class="td-num">${escapeHtml(formatTime(peer.connectedAt))}</td>` +
        `<td class="td-act"><button class="btn btn--danger btn--sm" data-kick="${escapeHtml(peer.socketId)}"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg> Kick</button></td></tr>`
    )
    .join('');
  for (const btn of tbody.querySelectorAll('button[data-kick]')) {
    btn.addEventListener('click', () => kickPeer(btn.dataset.kick));
  }
}

// Compact Connected-peers widget on the Overview — Canvas · User · Connected.
function renderPeersOverview(p) {
  const tbody = $('ov-peers-rows');
  if (!tbody) return;
  if (!p.peers.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="3">No peers connected.</td></tr>';
    return;
  }
  tbody.innerHTML = p.peers
    .slice(0, 8)
    .map(
      (peer) =>
        `<tr><td class="td-doc">${escapeHtml(peer.documentName)}</td>` +
        `<td><span class="user">${avatar(peer.user || 'anon')} ${escapeHtml(peer.user || 'anon')}</span></td>` +
        `<td class="td-num">${escapeHtml(formatTime(peer.connectedAt))}</td></tr>`
    )
    .join('');
}

function renderCanvases(c) {
  const tbody = $('canvases-rows');
  const rows = c.canvases || [];
  // Frame the list as ONE project's canvases (the hub's real identity) — the
  // hub has no repo/branch concept, so a single-context line is the honest
  // realignment, not a fabricated repo/branch grouping. The hub name is set on
  // .nav-brand-name by loadSettings; textContent round-trips it safely (no XSS).
  const ctx = $('canvases-context');
  if (ctx) {
    const hub = (document.querySelector('.nav-brand-name')?.textContent || '').trim();
    const n = rows.length;
    ctx.textContent = `${hub ? `${hub} · ` : ''}${n} synced canvas${n === 1 ? '' : 'es'} — every connected peer shares this one project.`;
  }
  if (!rows.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="3">No canvases synced yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map((r) => {
      const sessions = r.peers
        ? `<span class="sessions"><span class="sdot" aria-hidden="true"></span> ${r.peers}</span>`
        : '<span class="sessions is-zero"><span class="sdot" aria-hidden="true"></span> 0</span>';
      return (
        `<tr><td class="td-doc">${escapeHtml(r.name)}</td>` +
        `<td class="td-num">${escapeHtml(formatBytes(r.bytes))}</td>` +
        `<td>${sessions}</td></tr>`
      );
    })
    .join('');
}

const FEED_DOT = {
  join: 'is-join',
  leave: 'is-leave',
  agent: 'is-agent',
  token: 'is-token',
  warn: 'is-warn',
};
const FEED_EMPTY =
  '<div class="feed-row"><span class="feed-rail"><span class="feed-dot" aria-hidden="true"></span></span><span class="feed-body">No activity yet.</span><span class="feed-time"></span></div>';

function feedRows(rows) {
  return rows
    .map((e) => {
      const dot = FEED_DOT[e.type] || '';
      return (
        `<div class="feed-row"><span class="feed-rail"><span class="feed-dot ${dot}" aria-hidden="true"></span></span>` +
        `<span class="feed-body">${activityBody(e)}</span>` +
        `<span class="feed-time">${escapeHtml(formatTime(e.at))}</span></div>`
      );
    })
    .join('');
}

// Renders BOTH the full Activity pane and the compact Overview widget (top 6).
function renderActivity(a) {
  const rows = a.activity || [];
  const full = $('activity-feed');
  if (full) full.innerHTML = rows.length ? feedRows(rows) : FEED_EMPTY;
  const ov = $('ov-activity-feed');
  if (ov) ov.innerHTML = rows.length ? feedRows(rows.slice(0, 6)) : FEED_EMPTY;
}

function activityBody(e) {
  const user = `<b>${escapeHtml(e.user)}</b>`;
  const doc = escapeHtml(e.doc);
  if (e.type === 'join') return `${user} joined <code>${doc}</code>`;
  if (e.type === 'leave') return `${user} left <code>${doc}</code>`;
  // token / warn / agent: doc carries the human-readable summary.
  return `${user} · ${doc}`;
}

// -------------------------------- settings --------------------------------

async function loadSettings() {
  try {
    const s = await api('/settings');
    state.settingsLoaded = true;
    $('set-name').value = s.name || '';
    $('set-desc').value = s.description || '';
    $('set-url').textContent = s.publicUrl || '—';
    $('set-transport').textContent = s.transport || '—';
    $('set-storage').textContent = s.dataDir || '—';
    // Brand chrome reflects the operator-chosen name.
    const nameEl = document.querySelector('.nav-brand-name');
    if (nameEl && s.name) nameEl.textContent = s.name;
    if (s.publicUrl) {
      try {
        $('nav-hub-url').textContent = new URL(s.publicUrl).host;
        $('crumb-root').textContent = new URL(s.publicUrl).host;
      } catch {
        /* leave defaults */
      }
    }
  } catch (err) {
    if (err.message !== 'Unauthorized')
      console.warn('[hub-admin] settings load failed:', err.message);
  }
}

// -------------------------------- nav -------------------------------------

const VIEW_TITLES = {
  overview: 'Overview',
  peers: 'Peers',
  tokens: 'Access tokens',
  canvases: 'Synced canvases',
  activity: 'Activity',
  settings: 'Settings',
};

function setView(name) {
  if (!VIEW_TITLES[name]) name = 'overview';
  state.view = name;
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== `view-${name}`;
  for (const item of document.querySelectorAll('.nav-item')) {
    if (item.dataset.view === name) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  $('view-title').textContent = VIEW_TITLES[name];
  if (name === 'settings') void loadSettings();
  applySearch();
}

// Filter the active pane's table rows by the search box text (simple, local).
function applySearch() {
  const q = ($('search')?.value || '').trim().toLowerCase();
  const pane = $(`view-${state.view}`);
  if (!pane) return;
  for (const tr of pane.querySelectorAll('tbody tr')) {
    if (tr.classList.contains('empty')) continue;
    tr.hidden = q ? !tr.textContent.toLowerCase().includes(q) : false;
  }
}

// -------------------------------- actions ---------------------------------

async function generateInvite(label, wildcard) {
  // wildcard === true → scope '*' (authorizes every canvas, needed for sync).
  // Otherwise omit scope so the hub defaults it to the label (DDR-053).
  const body = wildcard ? { label, scope: '*' } : { label };
  const data = await api('/token', { method: 'POST', body: JSON.stringify(body) });
  showInvite(data, label);
  await refresh();
}

async function rotate(label) {
  if (
    !confirm(
      `Rotate token "${label}"? The old value stops working immediately. Peers will need the new token to reconnect.`
    )
  )
    return;
  const data = await api('/token/rotate', { method: 'POST', body: JSON.stringify({ label }) });
  showInvite(data, label);
  await refresh();
}

async function deleteToken(label) {
  if (
    !confirm(
      `Delete token "${label}"? It's removed permanently and any live sessions using it are kicked. This can't be undone.`
    )
  )
    return;
  try {
    await api('/token/delete', { method: 'POST', body: JSON.stringify({ label }) });
    await refresh();
  } catch (err) {
    if (err.message !== 'Unauthorized') alert(`Delete failed: ${err.message}`);
  }
}

async function kickPeer(socketId) {
  if (
    !confirm(
      'Kick this peer? Their live connection is closed; they can reconnect with a valid token.'
    )
  )
    return;
  try {
    await api('/peers/kick', { method: 'POST', body: JSON.stringify({ socketId }) });
    await refresh();
  } catch (err) {
    if (err.message !== 'Unauthorized') alert(`Kick failed: ${err.message}`);
  }
}

function showInvite({ token, command, scope }, label) {
  $('token-command').textContent = command;
  $('token-raw').textContent = token;
  const titleEl = $('token-modal-title');
  if (titleEl) titleEl.textContent = label ? `Invite ready — for "${label}"` : 'Invite ready';
  const scopeEl = $('token-scope');
  if (scopeEl) {
    const sc = scope ?? '*';
    scopeEl.textContent = sc === '*' ? 'SCOPE · hub-wide' : `SCOPE · ${sc}`;
  }
  const stampEl = $('token-modal-stamp');
  if (stampEl) stampEl.textContent = `${new Date().toISOString().replace('T', ' ').slice(0, 16)}Z`;
  const modal = $('token-modal');
  const opener = document.activeElement;
  modal.addEventListener(
    'close',
    () => {
      try {
        opener?.focus?.();
      } catch {
        /* element may have been removed */
      }
    },
    { once: true }
  );
  modal.showModal();
  $('token-copy').focus();
}

// -------------------------------- wire ------------------------------------

$('onboard-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const secret = $('onboard-secret').value.trim();
  if (!secret) return;
  state.secret = secret;
  $('onboard-error').hidden = true;
  try {
    await api('/status');
    localStorage.setItem(LS_KEY, secret);
    $('onboard-secret').value = '';
    render();
  } catch (err) {
    state.secret = '';
    $('onboard-error').textContent = err.message === 'Unauthorized' ? 'Wrong secret.' : err.message;
    $('onboard-error').hidden = false;
  }
});

$('bootstrap-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('bootstrap-error').hidden = true;
  try {
    const res = await fetch(`${API_BASE}/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: state.bootstrapKey }),
    });
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    const { secret } = await res.json();
    state.secret = secret;
    state.bootstrapKey = '';
    localStorage.setItem(LS_KEY, secret);
    render();
  } catch (err) {
    $('bootstrap-error').textContent = err.message;
    $('bootstrap-error').hidden = false;
  }
});

$('invite-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const label = $('invite-label').value.trim();
  if (!label) return;
  const wildcard = $('invite-wildcard')?.checked ?? true;
  $('invite-error').hidden = true;
  try {
    await generateInvite(label, wildcard);
    $('invite-label').value = '';
  } catch (err) {
    $('invite-error').textContent = err.message;
    $('invite-error').hidden = false;
  }
});

$('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('settings-error').hidden = true;
  $('settings-status').textContent = '';
  try {
    const saved = await api('/settings', {
      method: 'POST',
      body: JSON.stringify({ name: $('set-name').value, description: $('set-desc').value }),
    });
    $('settings-status').textContent = 'Saved.';
    const nameEl = document.querySelector('.nav-brand-name');
    if (nameEl && saved.name) nameEl.textContent = saved.name;
    setTimeout(() => ($('settings-status').textContent = ''), 2000);
  } catch (err) {
    $('settings-error').textContent = err.message;
    $('settings-error').hidden = false;
  }
});

$('rotate-admin').addEventListener('click', async () => {
  if (
    !confirm(
      'Rotate the admin secret? Every device signed in with the current secret is signed out immediately and must re-bootstrap or use HUB_SECRET. This cannot be undone.'
    )
  )
    return;
  $('danger-error').hidden = true;
  try {
    await api('/admin-secret/rotate', { method: 'POST', body: JSON.stringify({}) });
    // Our own secret is now stale — drop it and force re-auth.
    state.secret = '';
    localStorage.removeItem(LS_KEY);
    render();
  } catch (err) {
    if (err.message === 'Unauthorized') return; // already bounced to sign-in
    $('danger-error').textContent = err.message;
    $('danger-error').hidden = false;
  }
});

$('forget').addEventListener('click', () => {
  localStorage.removeItem(LS_KEY);
  state.secret = '';
  render();
});

$('token-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('token-command').textContent);
    $('token-copy').textContent = '✓ Command copied';
    $('token-copy').classList.add('copied');
    const status = $('copy-status');
    if (status) status.textContent = 'Command copied to clipboard';
    setTimeout(() => {
      $('token-copy').innerHTML =
        '<svg class="ic" aria-hidden="true"><use href="#i-copy"/></svg> Copy command';
      $('token-copy').classList.remove('copied');
      if (status) status.textContent = '';
    }, 1500);
  } catch {
    /* no clipboard permission — user can select+copy manually */
  }
});

// Nav switching
for (const item of document.querySelectorAll('.nav-item')) {
  item.addEventListener('click', () => setView(item.dataset.view));
}
// "Open peers →" / "Open activity →" footer links on the Overview.
for (const link of document.querySelectorAll('[data-nav]')) {
  link.addEventListener('click', () => setView(link.dataset.nav));
}
$('topbar-invite').addEventListener('click', () => {
  setView('tokens');
  $('invite-label')?.focus();
});
$('qa-invite').addEventListener('click', () => {
  setView('tokens');
  $('invite-label')?.focus();
});
$('qa-canvases').addEventListener('click', () => setView('canvases'));
$('qa-activity').addEventListener('click', () => setView('activity'));

// Search: '/' focuses, typing filters the active pane.
$('search').addEventListener('input', applySearch);
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && !$('dash').hidden) {
    e.preventDefault();
    $('search').focus();
  }
});

render();
state.refreshTimer = setInterval(() => {
  if (state.secret) refresh();
}, 5000);
