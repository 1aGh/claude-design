// Maude Studio, in a browser — Cloud Phase 25 B3/B4/B6/B7 + C3.
//
// NOT A PORT OF THE DESKTOP CLIENT. The desktop shell is a large React
// application wired to a Bun dev-server's ~120 routes; reproducing it here
// would be a second implementation of everything, drifting from the first.
// What this page is instead: the smallest honest surface that lets a member
// who has installed nothing do the four things the phase promised — open the
// project, look at a canvas, change something by pointing at it, and take the
// work home.
//
// The canvas ITSELF is the real thing: the same `@maude/canvas-lib` bundle the
// desktop renders, in a segregated origin, with its own pan/zoom, selection
// halos and inline chrome. So "direct manipulation" is not re-implemented here
// either — the iframe already does it and posts intents out; this page turns
// those intents into the structured mutations of B4.
//
// Server-rendered, no build step, no framework. It ships as one string.

function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

export function renderStudioPage({
  projectName,
  canvases,
  session,
  renderToken,
  canvasBase,
  designSystem,
  dashboardUrl,
}) {
  const readOnly = Boolean(session.readOnly);
  const groups = new Map();
  for (const c of canvases) {
    const key = c.group || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const tree = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([group, items]) => `
        <div class="grp">
          <div class="grp-h">${esc(group || 'project')}<span class="grp-n">${items.length}</span></div>
          ${items
            .map(
              (c) =>
                `<button type="button" class="row" data-rel="${esc(c.rel)}" title="${esc(c.rel)}">${esc(c.name)}</button>`
            )
            .join('')}
        </div>`
    )
    .join('');

  const boot = {
    canvasBase,
    renderToken,
    readOnly,
    email: session.email,
    role: session.role ?? (readOnly ? 'viewer' : 'member'),
    first: canvases[0]?.rel ?? null,
    designSystem,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(projectName)} · Maude</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHBhdGggZD0iTTcgMEgyNUE3IDcgMCAwIDEgMzIgN1YzMkg3QTcgNyAwIDAgMSAwIDI1VjdBNyA3IDAgMCAxIDcgMFoiIGZpbGw9IiM2ZDVlZjUiLz48cGF0aCBkPSJNMTYgNWwyLjggOC4yTDI3IDE2bC04LjIgMi44TDE2IDI3bC0yLjgtOC4yTDUgMTZsOC4yLTIuOHoiIGZpbGw9IiNmZmYiLz48L3N2Zz4=">
<style>
  :root {
    --bg-0:#0e1014; --bg-1:#14171d; --bg-2:#1a1e26; --bg-3:#222732;
    --fg-0:#e9ecf3; --fg-1:#b9c0cf; --fg-2:#828b9e; --line:#262c38;
    --accent:#7a86f8; --warn:#e0a33a; --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing:border-box; }
  body { margin:0; height:100vh; display:flex; flex-direction:column; overflow:hidden;
         font:14px/1.5 -apple-system, system-ui, "Segoe UI", sans-serif; background:var(--bg-0); color:var(--fg-0); }
  header { display:flex; align-items:center; gap:12px; padding:0 14px; height:46px;
           background:var(--bg-1); border-bottom:1px solid var(--line); flex:none; }
  .brand { display:flex; align-items:center; gap:8px; font-weight:650; letter-spacing:-.01em; }
  .brand svg { width:20px; height:20px; color:var(--accent); }
  .proj { color:var(--fg-1); font-family:var(--mono); font-size:12px; }
  .spacer { flex:1; }
  .pill { font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase;
          padding:3px 9px; border-radius:999px; border:1px solid var(--line); color:var(--fg-1); }
  .pill--view { color:var(--warn); border-color:color-mix(in oklab, var(--warn) 45%, transparent);
                background:color-mix(in oklab, var(--warn) 12%, transparent); }
  .who { color:var(--fg-2); font-size:12px; }
  main { flex:1; display:flex; min-height:0; }
  nav { width:250px; flex:none; background:var(--bg-1); border-right:1px solid var(--line);
        overflow:auto; padding:10px 8px 24px; }
  .grp { margin-bottom:14px; }
  .grp-h { display:flex; justify-content:space-between; font-family:var(--mono); font-size:10.5px;
           letter-spacing:.09em; text-transform:uppercase; color:var(--fg-2); padding:4px 8px; }
  .grp-n { opacity:.7; }
  .row { display:block; width:100%; text-align:left; background:none; border:0; color:var(--fg-1);
         font:inherit; padding:6px 10px; border-radius:7px; cursor:pointer; }
  .row:hover { background:var(--bg-2); color:var(--fg-0); }
  .row[aria-current="true"] { background:color-mix(in oklab, var(--accent) 18%, transparent);
         color:var(--fg-0); box-shadow:inset 2px 0 0 var(--accent); }
  section.stage { flex:1; position:relative; min-width:0; background:var(--bg-0); }
  iframe { width:100%; height:100%; border:0; display:block; background:#fff; }
  .empty { position:absolute; inset:0; display:grid; place-items:center; color:var(--fg-2);
           pointer-events:none; }
  .empty[hidden] { display:none; }
  aside { width:280px; flex:none; background:var(--bg-1); border-left:1px solid var(--line);
          padding:12px; overflow:auto; }
  aside h2 { font-family:var(--mono); font-size:10.5px; letter-spacing:.09em; text-transform:uppercase;
             color:var(--fg-2); margin:0 0 8px; font-weight:600; }
  .sel { font-family:var(--mono); font-size:11.5px; color:var(--fg-1); word-break:break-all;
         background:var(--bg-2); border:1px solid var(--line); border-radius:8px; padding:8px; }
  .field { display:flex; align-items:center; gap:8px; margin:8px 0; }
  .field label { width:74px; color:var(--fg-2); font-size:12px; }
  .field input { flex:1; min-width:0; background:var(--bg-2); border:1px solid var(--line);
                 color:var(--fg-0); border-radius:7px; padding:5px 8px; font:inherit; font-size:13px; }
  .field input:focus { outline:2px solid var(--accent); outline-offset:1px; }
  button.act { background:var(--accent); color:#0f1020; border:0; border-radius:8px; font:inherit;
               font-weight:600; padding:7px 12px; cursor:pointer; }
  button.act[disabled] { opacity:.5; cursor:default; }
  button.ghost { background:var(--bg-2); color:var(--fg-1); border:1px solid var(--line); }
  .note { color:var(--fg-2); font-size:12.5px; line-height:1.5; margin:10px 0 0; }
  .note a { color:var(--accent); }
  .toast { position:fixed; left:50%; bottom:22px; transform:translateX(-50%); background:var(--bg-3);
           border:1px solid var(--line); border-radius:10px; padding:9px 14px; font-size:13px;
           box-shadow:0 12px 40px rgba(0,0,0,.45); opacity:0; transition:opacity .16s; pointer-events:none;
           max-width:min(46rem, 92vw); }
  .toast[data-show="true"] { opacity:1; }
  .toast[data-kind="error"] { border-color:#8a3b3b; }
</style>
</head>
<body>
<header>
  <span class="brand"><svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 5l2.8 8.2L27 16l-8.2 2.8L16 27l-2.8-8.2L5 16l8.2-2.8z"/></svg>maude</span>
  <span class="proj">${esc(projectName)}</span>
  <span class="spacer"></span>
  ${readOnly ? '<span class="pill pill--view" title="Your role in this project is viewer — you can look and download, but not change.">view only</span>' : ''}
  <span class="who">${esc(session.email)}</span>
  ${dashboardUrl ? `<a class="pill" href="${esc(dashboardUrl)}">dashboard</a>` : ''}
</header>
<main>
  <nav id="tree">${tree || '<p class="note">This project has no canvases yet.</p>'}</nav>
  <section class="stage">
    <div class="empty" id="empty">Pick a screen on the left.</div>
    <iframe id="frame" title="Canvas" hidden
            sandbox="allow-scripts allow-same-origin allow-popups"
            referrerpolicy="no-referrer"></iframe>
  </section>
  <aside>
    <h2>Selection</h2>
    <div class="sel" id="sel">Nothing selected. Press <b>V</b> in the canvas, then click an element.</div>
    ${
      // C3 — for a viewer the editor is ABSENT, not hidden: it never reaches
      // the browser at all, so there is nothing to un-hide in devtools and
      // nothing to mislead. The cell refuses the write regardless (C1); this
      // is the half that stops a person being offered something first.
      readOnly
        ? ''
        : `<div id="edit" hidden>
      <div class="field"><label for="f-text">Text</label><input id="f-text" type="text" autocomplete="off"></div>
      <div class="field"><label for="f-bg">Background</label><input id="f-bg" type="text" placeholder="#111 / var(--bg-1)" autocomplete="off"></div>
      <div class="field"><label for="f-color">Text color</label><input id="f-color" type="text" placeholder="var(--fg-0)" autocomplete="off"></div>
      <div class="field"><label for="f-pad">Padding</label><input id="f-pad" type="text" placeholder="16px" autocomplete="off"></div>
      <div class="field"><label></label><button class="act" id="apply">Apply</button></div>
    </div>`
    }
    <h2 style="margin-top:18px">This project</h2>
    <p class="note" id="ds"></p>
    <p class="note">
      <button class="act ghost" id="export">Download everything</button>
    </p>
    <!-- B6: what the browser cannot do, it SAYS — and names where it lives. -->
    <p class="note" id="agent-note">
      Asking Claude to make a change happens in <b>Maude Desktop</b>, on your own
      machine, with your own Claude subscription — it is not missing here, it is
      deliberately not on our servers.
      ${dashboardUrl ? `<br><a href="${esc(dashboardUrl)}">Get the app →</a>` : ''}
    </p>
  </aside>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script id="boot" type="application/json">${JSON.stringify(boot)}</script>
<script type="module">
const BOOT = JSON.parse(document.getElementById('boot').textContent);
const frame = document.getElementById('frame');
const empty = document.getElementById('empty');
const tree = document.getElementById('tree');
const selBox = document.getElementById('sel');
const editBox = document.getElementById('edit'); // absent for a viewer (C3)
const toastEl = document.getElementById('toast');
let current = null;
let selection = null;
let token = BOOT.renderToken;

document.getElementById('ds').textContent = BOOT.designSystem
  ? 'Design system: ' + BOOT.designSystem
  : 'No design system yet.';
// (the editor is not rendered at all for a viewer — see the server template)

function toast(message, kind) {
  toastEl.textContent = message;
  toastEl.dataset.kind = kind || 'info';
  toastEl.dataset.show = 'true';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.dataset.show = 'false'; }, kind === 'error' ? 9000 : 3200);
}

function shellUrl(rel) {
  const q = new URLSearchParams({ t: token, canvas: rel });
  if (BOOT.readOnly) q.set('ro', '1');
  return BOOT.canvasBase + '/_canvas/shell?' + q.toString();
}

function open(rel) {
  current = rel;
  selection = null;
  renderSelection();
  empty.hidden = true;
  frame.hidden = false;
  frame.src = shellUrl(rel);
  for (const row of tree.querySelectorAll('.row')) {
    row.setAttribute('aria-current', String(row.dataset.rel === rel));
  }
  history.replaceState(null, '', '?canvas=' + encodeURIComponent(rel));
}

tree.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (row) open(row.dataset.rel);
});

// A render capability lasts minutes; refresh it before it bites, and reload
// the frame with the new one so a long session never dead-ends.
setInterval(async () => {
  try {
    const res = await fetch('/api/studio/render-token');
    if (!res.ok) return;
    token = (await res.json()).token;
    if (current) frame.src = shellUrl(current);
  } catch (_) {}
}, 10 * 60 * 1000);

function renderSelection() {
  if (!selection) {
    selBox.innerHTML = 'Nothing selected. Press <b>V</b> in the canvas, then click an element.';
    if (!BOOT.readOnly) editBox.hidden = true;
    return;
  }
  selBox.textContent = (selection.tag || 'element') + (selection.id ? ' · ' + selection.id : '') +
    (selection.text ? ' — "' + String(selection.text).slice(0, 60) + '"' : '');
  if (!BOOT.readOnly) {
    editBox.hidden = false;
    document.getElementById('f-text').value = selection.text ? String(selection.text).slice(0, 500) : '';
    document.getElementById('f-bg').value = '';
    document.getElementById('f-color').value = '';
    document.getElementById('f-pad').value = '';
  }
}

async function edit(op) {
  const res = await fetch('/api/studio/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(Object.assign({ canvas: current }, op)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    toast(body.error || 'That change could not be applied.', 'error');
    return false;
  }
  return true;
}

async function reload() {
  // The source changed on disk; the module is content-keyed, so a reload is
  // enough — no cache to bust by hand.
  if (current) frame.src = shellUrl(current) + '&r=' + Date.now();
}

document.getElementById('apply')?.addEventListener('click', async () => {
  if (!selection?.id) { toast('Select an element first.'); return; }
  const btn = document.getElementById('apply');
  btn.disabled = true;
  try {
    const text = document.getElementById('f-text').value;
    const bg = document.getElementById('f-bg').value.trim();
    const color = document.getElementById('f-color').value.trim();
    const pad = document.getElementById('f-pad').value.trim();
    let changed = false;
    if (selection.text !== undefined && text !== (selection.text ?? '')) {
      changed = (await edit({ kind: 'set-text', id: selection.id, idIndex: selection.index, text })) || changed;
    }
    for (const [prop, value] of [['background', bg], ['color', color], ['padding', pad]]) {
      if (value) changed = (await edit({ kind: 'set-style', id: selection.id, idIndex: selection.index, property: prop, value })) || changed;
    }
    if (changed) { toast('Saved.'); await reload(); }
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('export').addEventListener('click', async () => {
  toast('Preparing your download…');
  try {
    const res = await fetch('/api/export', { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast(body.error || 'The export could not be built.', 'error'); return; }
    toast('Your download is ready in the dashboard.');
  } catch (err) {
    toast('The export could not be built.', 'error');
  }
});

// The canvas talks; this is the whole B4 lane. Only messages from the canvas
// frame are accepted — a message from any other window is ignored.
window.addEventListener('message', async (event) => {
  if (event.source !== frame.contentWindow) return;
  const m = event.data;
  if (!m || typeof m !== 'object') return;
  if (m.dgn === 'canvas-error') { toast(m.message, 'error'); return; }
  if (m.dgn === 'select' || m.dgn === 'select-set') {
    const payload = Array.isArray(m.selection) ? m.selection[0] : m.selection;
    selection = payload || null;
    renderSelection();
    return;
  }
  if (BOOT.readOnly) return;
  if (m.dgn === 'reposition-request' && m.id) {
    if (await edit({ kind: 'reposition', id: m.id, idIndex: m.idIndex, left: m.left, top: m.top })) {
      toast('Moved.');
    }
    return;
  }
  if (m.dgn === 'delete-request' && m.id) {
    if (await edit({ kind: 'delete-element', id: m.id, idIndex: m.idIndex })) { toast('Deleted.'); await reload(); }
    return;
  }
  if (m.dgn === 'resize-artboard-request' && m.artboardId) {
    if (await edit({ kind: 'resize-artboard', artboardId: m.artboardId, width: m.width, height: m.height })) {
      toast('Resized.'); await reload();
    }
    return;
  }
  if (m.dgn === 'edit-source' && m.op === 'text' && m.id) {
    if (await edit({ kind: 'set-text', id: m.id, idIndex: m.occurrence, text: m.after })) toast('Saved.');
    return;
  }
});

const wanted = new URLSearchParams(location.search).get('canvas');
if (wanted && [...tree.querySelectorAll('.row')].some((r) => r.dataset.rel === wanted)) open(wanted);
else if (BOOT.first) open(BOOT.first);
</script>
</body>
</html>`;
}
