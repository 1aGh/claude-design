// Maude Hub admin — vanilla JS, no framework.
//
// State machine:
//   ?key=<bootstrap>     → "bootstrap" view (one-time claim)
//   localStorage secret  → "dash" view
//   neither              → "onboard" view (paste HUB_SECRET)

const LS_KEY = 'maude-hub-secret';
const $ = (id) => document.getElementById(id);

const state = {
  secret: localStorage.getItem(LS_KEY) || '',
  bootstrapKey: new URLSearchParams(location.search).get('key') || '',
  hubIdentity: null, // { publicUrl, version, hostFingerprint }
  refreshTimer: 0,
};

// DDR-053 §7: strip ?key= from the URL immediately on load so a failed
// bootstrap POST or accidental tab refresh doesn't leak the key into the
// browser's address bar / session history.
if (state.bootstrapKey) {
  history.replaceState({}, '', '/admin');
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
  const res = await fetch(`/admin/api${path}`, { ...opts, headers });
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

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
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

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
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
}

// DDR-053 §7: surface the hub's identity (publicUrl + fingerprint) on the
// bootstrap screen so the operator can confirm they're claiming the hub they
// intended — defeats the phishing-claim-link conditioning attack (F6).
async function loadIdentityForBootstrapView() {
  if (state.hubIdentity) return; // memoize
  try {
    const res = await fetch('/admin/api/identity');
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
    const [status, tokens, peers] = await Promise.all([
      api('/status'),
      api('/tokens'),
      api('/peers'),
    ]);
    renderStatus(status, peers);
    renderTokens(tokens);
    renderPeers(peers);
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

function renderTokens(t) {
  const rows = t.tokens;
  const tbody = $('tokens-rows');
  if (!rows.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="4">No tokens yet.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}${r.dev ? ' <code>dev</code>' : ''}</td>` +
        `<td>${escapeHtml(formatTime(r.createdAt))}</td>` +
        `<td>${escapeHtml(formatTime(r.lastUsedAt))}</td>` +
        `<td><button class="ghost" data-rotate="${escapeHtml(r.label)}">Rotate</button></td></tr>`
    )
    .join('');
  for (const btn of tbody.querySelectorAll('button[data-rotate]')) {
    btn.addEventListener('click', () => rotate(btn.dataset.rotate));
  }
}

function renderPeers(p) {
  const tbody = $('peers-rows');
  if (!p.peers.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="3">No peers connected.</td></tr>';
    return;
  }
  tbody.innerHTML = p.peers
    .map(
      (peer) =>
        `<tr><td><code>${escapeHtml(peer.documentName)}</code></td>` +
        `<td>${escapeHtml(peer.user || 'anon')}</td>` +
        `<td>${escapeHtml(formatTime(peer.connectedAt))}</td></tr>`
    )
    .join('');
}

// -------------------------------- actions ---------------------------------

async function generateInvite(label) {
  const data = await api('/token', { method: 'POST', body: JSON.stringify({ label }) });
  showInvite(data);
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
  showInvite(data);
  await refresh();
}

function showInvite({ token, command }) {
  $('token-command').textContent = command;
  $('token-raw').textContent = token;
  const stampEl = $('token-modal-stamp');
  if (stampEl) stampEl.textContent = `${new Date().toISOString().replace('T', ' ').slice(0, 16)}Z`;
  const modal = $('token-modal');
  const opener = document.activeElement;
  modal.addEventListener(
    'close',
    () => {
      // Restore focus to the invoking control so keyboard users aren't stranded.
      try {
        opener?.focus?.();
      } catch {
        /* element may have been removed */
      }
    },
    { once: true }
  );
  modal.showModal();
  // Land focus on the primary action so SR reads "Copy command, button".
  $('token-copy').focus();
}

// -------------------------------- wire ------------------------------------

$('onboard-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const secret = $('onboard-secret').value.trim();
  if (!secret) return;
  // Try a status call with the candidate secret.
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
    const res = await fetch('/admin/api/bootstrap', {
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
  $('invite-error').hidden = true;
  try {
    await generateInvite(label);
    $('invite-label').value = '';
  } catch (err) {
    $('invite-error').textContent = err.message;
    $('invite-error').hidden = false;
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
    $('token-copy').textContent = 'Copied ✓';
    // SR-announce the success via a sibling live region (button label
    // mutations don't trigger re-announcement on most screen readers).
    const status = $('copy-status');
    if (status) status.textContent = 'Command copied to clipboard';
    setTimeout(() => {
      $('token-copy').textContent = 'Copy command';
      if (status) status.textContent = '';
    }, 1500);
  } catch {
    /* no clipboard permission — user can select+copy manually */
  }
});

render();
state.refreshTimer = setInterval(() => {
  if (state.secret) refresh();
}, 5000);
