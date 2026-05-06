#!/usr/bin/env node
// Dugmate Design — local browser. Zero deps, just node:http + node:crypto for WS handshake.
// Serves the design content under .ai/design/ behind a tabbed UI with active-canvas tracking.
//
// On boot, writes .ai/design/_server.json (port + pid + url) so the orchestrator
// can detect a running instance instead of accidentally starting a second one.
// Tabs in the UI push their active state over WebSocket; server persists to
// .ai/design/_active.json so /design "<feedback>" knows which canvas to edit.

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const PLUGIN_REL = '.claude/plugins/design';
const PLUGIN_ROOT = path.join(REPO_ROOT, PLUGIN_REL);
const DESIGN_REL = '.ai/design';
const DESIGN_ROOT = path.join(REPO_ROOT, DESIGN_REL);
const SERVER_INFO_FILE = path.join(DESIGN_ROOT, '_server.json');
const ACTIVE_FILE = path.join(DESIGN_ROOT, '_active.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.jsx':  'text/plain; charset=utf-8',
  '.ts':   'text/plain; charset=utf-8',
  '.tsx':  'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
};

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'build', '.expo', 'coverage', 'dev-server', '_history']);
const HIDDEN_OK = new Set(['.ai', '.claude']);

async function findHtmlFiles(absRoot, prefixUnderRepo) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(absRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.name.startsWith('.') && !HIDDEN_OK.has(e.name) && !e.name.startsWith('_')) continue;
    if (e.name.startsWith('_')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(absRoot, e.name);
    const rel = path.posix.join(prefixUnderRepo, e.name);
    if (e.isDirectory()) {
      out.push(...await findHtmlFiles(full, rel));
    } else if (e.name.toLowerCase().endsWith('.html')) {
      out.push(rel);
    }
  }
  return out;
}

function buildTree(paths, stripPrefix) {
  const root = {};
  for (const p of paths) {
    const stripped = p.startsWith(stripPrefix) ? p.slice(stripPrefix.length).replace(/^\/+/, '') : p;
    const parts = stripped.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i];
      const isFile = i === parts.length - 1;
      if (isFile) {
        node._files = node._files || [];
        node._files.push({ name: key, path: p });
      } else {
        node[key] = node[key] || {};
        node = node[key];
      }
    }
  }
  return root;
}

function renderTree(node, depth = 0) {
  let html = '';
  const dirs = Object.keys(node).filter(k => k !== '_files').sort();
  for (const d of dirs) {
    const open = depth < 2 ? ' open' : '';
    html += `<details${open}><summary>${escapeHtml(d)}</summary>${renderTree(node[d], depth + 1)}</details>`;
  }
  if (node._files) {
    html += '<ul>';
    for (const f of node._files.sort((a, b) => a.name.localeCompare(b.name))) {
      html += `<li><a href="#" data-path="${escapeAttr(f.path)}" title="${escapeAttr(f.path)}">${escapeHtml(f.name)}</a></li>`;
    }
    html += '</ul>';
  }
  return html;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const escapeAttr = escapeHtml;

function safePath(reqUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(reqUrl, 'http://x').pathname);
  } catch {
    return null;
  }
  const resolved = path.normalize(path.join(REPO_ROOT, pathname));
  if (resolved !== REPO_ROOT && !resolved.startsWith(REPO_ROOT + path.sep)) return null;
  return resolved;
}

async function findFreePort(start = 4321, tries = 100) {
  for (let p = start; p < start + tries; p++) {
    const ok = await new Promise(resolve => {
      const srv = net.createServer();
      srv.unref();
      srv.once('error', () => resolve(false));
      srv.listen(p, '127.0.0.1', () => srv.close(() => resolve(true)));
    });
    if (ok) return p;
  }
  throw new Error(`no free port in [${start}..${start + tries})`);
}

function encodeUrlPath(p) {
  return '/' + p.split('/').map(encodeURIComponent).join('/');
}

// ---------- active state ----------

let activeState = {
  active: null,           // currently focused tab (path under repo root)
  open_tabs: [],          // all open tabs
  selected: null,         // { selector, tag, classes, text, dom_path, bounds, html, file, ts }
  last_change: null,
  session_started: new Date().toISOString(),
};

async function loadActive() {
  try {
    const raw = await fs.readFile(ACTIVE_FILE, 'utf8');
    const prev = JSON.parse(raw);
    activeState = { ...activeState, ...prev, session_started: new Date().toISOString() };
  } catch { /* first boot */ }
}

async function saveActive() {
  try {
    await fs.mkdir(path.dirname(ACTIVE_FILE), { recursive: true });
    await fs.writeFile(ACTIVE_FILE, JSON.stringify(activeState, null, 2));
  } catch (e) {
    console.error('  warn: failed to save _active.json:', e.message);
  }
}

function setActive(file) {
  if (typeof file !== 'string') return;
  if (activeState.active === file) return;
  activeState.active = file || null;
  activeState.selected = null;             // selection is per-canvas, clear on switch
  activeState.last_change = new Date().toISOString();
  saveActive();
}

function setOpenTabs(tabs) {
  if (!Array.isArray(tabs)) return;
  activeState.open_tabs = tabs.filter(t => typeof t === 'string');
  activeState.last_change = new Date().toISOString();
  saveActive();
}

function setSelected(sel) {
  if (sel && typeof sel === 'object') {
    activeState.selected = {
      file: typeof sel.file === 'string' ? sel.file : activeState.active,
      selector: String(sel.selector || ''),
      tag: String(sel.tag || ''),
      classes: String(sel.classes || ''),
      text: String(sel.text || '').slice(0, 240),
      dom_path: Array.isArray(sel.dom_path) ? sel.dom_path.slice(0, 16) : [],
      bounds: sel.bounds || null,
      html: String(sel.html || '').slice(0, 4000),
      ts: new Date().toISOString(),
    };
  } else {
    activeState.selected = null;
  }
  activeState.last_change = new Date().toISOString();
  saveActive();
  broadcast({ type: 'selected', selected: activeState.selected });
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const s of wsClients) wsSendText(s, msg);
}

// ---------- server info ----------

async function writeServerInfo(port) {
  await fs.mkdir(DESIGN_ROOT, { recursive: true });
  const info = {
    pid: process.pid,
    port,
    url: `http://localhost:${port}`,
    started: new Date().toISOString(),
  };
  await fs.writeFile(SERVER_INFO_FILE, JSON.stringify(info, null, 2));
}

function removeServerInfo() {
  try { fsSync.unlinkSync(SERVER_INFO_FILE); } catch {}
}

// ---------- WebSocket (RFC 6455 server, minimal) ----------

const wsClients = new Set();

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
}

function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return false; }
  const accept = wsAccept(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );
  return true;
}

function wsSendText(socket, text) {
  const data = Buffer.from(text, 'utf8');
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  try { socket.write(Buffer.concat([header, data])); } catch {}
}

function wsParseFrames(buf, onText, onClose) {
  let off = 0;
  while (off + 2 <= buf.length) {
    const b1 = buf[off];
    const b2 = buf[off + 1];
    const opcode = b1 & 0x0f;
    const masked = (b2 & 0x80) === 0x80;
    let len = b2 & 0x7f;
    let p = off + 2;
    if (len === 126) {
      if (p + 2 > buf.length) return buf.slice(off);
      len = buf.readUInt16BE(p); p += 2;
    } else if (len === 127) {
      if (p + 8 > buf.length) return buf.slice(off);
      len = Number(buf.readBigUInt64BE(p)); p += 8;
    }
    if (masked) {
      if (p + 4 > buf.length) return buf.slice(off);
    }
    const maskKey = masked ? buf.slice(p, p + 4) : null;
    if (masked) p += 4;
    if (p + len > buf.length) return buf.slice(off);
    const payload = buf.slice(p, p + len);
    if (masked) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i & 3];
    }
    p += len;
    if (opcode === 0x1) { onText(payload.toString('utf8')); }
    else if (opcode === 0x8) { onClose(); return Buffer.alloc(0); }
    else if (opcode === 0x9) { /* ping — respond with pong, but minimal: skip */ }
    off = p;
  }
  return buf.slice(off);
}

function attachWs(req, socket) {
  if (!wsHandshake(req, socket)) return;
  wsClients.add(socket);
  let buf = Buffer.alloc(0);

  // Send a snapshot of current state to the new client.
  wsSendText(socket, JSON.stringify({ type: 'snapshot', state: activeState }));

  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    buf = wsParseFrames(buf,
      text => {
        try {
          const msg = JSON.parse(text);
          if (msg.type === 'active' && typeof msg.file === 'string') setActive(msg.file);
          else if (msg.type === 'tabs' && Array.isArray(msg.tabs)) setOpenTabs(msg.tabs);
          else if (msg.type === 'select' && msg.selection) setSelected(msg.selection);
          else if (msg.type === 'clear-select') setSelected(null);
        } catch {}
      },
      () => { try { socket.end(); } catch {} }
    );
  });
  socket.on('close', () => wsClients.delete(socket));
  socket.on('error', () => wsClients.delete(socket));
}

// ---------- Inspector overlay (injected into every served .html under .ai/design/) ----------
//
// Listens for Cmd/Ctrl + hover (highlight), Cmd/Ctrl + click (select), Esc (clear).
// Posts selection to parent frame via window.parent.postMessage.
// The parent (our index page) forwards over WebSocket.

const INSPECTOR_SCRIPT = `
<script>
(function() {
  if (window.__dugmateInspectorAttached) return;
  window.__dugmateInspectorAttached = true;
  var FILE = (function(){ try { return decodeURIComponent(location.pathname); } catch(e){ return location.pathname; } })().replace(/^\\//,'');

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.dgm-insp-hover { outline: 2px solid #00D4E4 !important; outline-offset: 1px !important; cursor: crosshair !important; }',
    '.dgm-insp-selected { outline: 2px solid #00D4E4 !important; outline-offset: 1px !important; box-shadow: 0 0 0 4px rgba(0,212,228,0.18) !important; }',
    '.dgm-insp-label { position: fixed; z-index: 2147483647; font: 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace; background: #00D4E4; color: #000; padding: 4px 8px; border-radius: 4px; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: translate(0, -110%); white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }',
    '.dgm-insp-label.warn { background: #ef4444; color: #fff; }'
  ].join('\\n');
  document.documentElement.appendChild(styleEl);

  var label = document.createElement('div');
  label.className = 'dgm-insp-label';
  label.style.display = 'none';
  document.documentElement.appendChild(label);

  var lastHover = null;
  var lastSelected = null;
  var modifierDown = false;

  function isModifier(e) { return e.metaKey || e.ctrlKey || e.altKey; }

  function shortText(el, max) {
    var t = (el.innerText || el.textContent || '').replace(/\\s+/g,' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    var path = [];
    while (el && el.nodeType === 1 && path.length < 8) {
      var sel = el.nodeName.toLowerCase();
      if (el.id) { sel = '#' + el.id; path.unshift(sel); break; }
      var cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) sel += '.' + cls.join('.');
      var sib = 1, n = el;
      while ((n = n.previousElementSibling)) sib++;
      sel += ':nth-child(' + sib + ')';
      path.unshift(sel);
      el = el.parentElement;
    }
    return path.join(' > ');
  }

  function domPath(el) {
    var hops = [];
    while (el && el.nodeType === 1 && hops.length < 8) {
      var label = el.nodeName.toLowerCase();
      if (el.id) label += '#' + el.id;
      var cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) label += '.' + cls.join('.');
      hops.unshift(label);
      el = el.parentElement;
    }
    return hops;
  }

  function elInfo(el) {
    var rect = el.getBoundingClientRect();
    return {
      file: FILE,
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      classes: (el.getAttribute('class') || '').trim(),
      text: shortText(el, 240),
      dom_path: domPath(el),
      bounds: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      html: (el.outerHTML || '').slice(0, 4000)
    };
  }

  function showLabel(text, x, y, warn) {
    label.style.display = '';
    label.style.left = (x + 12) + 'px';
    label.style.top = y + 'px';
    label.textContent = text;
    label.classList.toggle('warn', !!warn);
  }
  function hideLabel() { label.style.display = 'none'; }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') modifierDown = true;
    if (e.key === 'Escape') {
      if (lastHover) lastHover.classList.remove('dgm-insp-hover');
      if (lastSelected) lastSelected.classList.remove('dgm-insp-selected');
      lastHover = null; lastSelected = null;
      hideLabel();
      try { window.parent.postMessage({ dugmate: 'clear-select' }, '*'); } catch(e) {}
    }
  }, true);
  document.addEventListener('keyup', function(e) {
    if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') {
      modifierDown = false;
      if (lastHover) { lastHover.classList.remove('dgm-insp-hover'); lastHover = null; }
      hideLabel();
    }
  }, true);
  document.addEventListener('blur', function() {
    modifierDown = false;
    if (lastHover) { lastHover.classList.remove('dgm-insp-hover'); lastHover = null; }
    hideLabel();
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (!isModifier(e)) {
      if (lastHover) { lastHover.classList.remove('dgm-insp-hover'); lastHover = null; }
      hideLabel();
      return;
    }
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === lastHover) return;
    if (el === label) return;
    if (lastHover) lastHover.classList.remove('dgm-insp-hover');
    lastHover = el;
    el.classList.add('dgm-insp-hover');
    var t = el.tagName.toLowerCase();
    var c = (el.getAttribute('class') || '').trim();
    showLabel(t + (c ? '.' + c.split(/\\s+/).slice(0,2).join('.') : ''), e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function(e) {
    if (!isModifier(e)) return;
    e.preventDefault();
    e.stopPropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    if (lastSelected) lastSelected.classList.remove('dgm-insp-selected');
    lastSelected = el;
    el.classList.add('dgm-insp-selected');
    var info = elInfo(el);
    try { window.parent.postMessage({ dugmate: 'select', selection: info }, '*'); } catch(err) {}
    showLabel('selected: ' + info.tag + (info.classes ? '.' + info.classes.split(/\\s+/).slice(0,2).join('.') : ''), e.clientX, e.clientY);
    setTimeout(hideLabel, 1500);
  }, true);

  // Tell parent we're loaded with our path so it can correlate to active tab.
  try { window.parent.postMessage({ dugmate: 'loaded', file: FILE }, '*'); } catch(e) {}
})();
</script>
`;

function injectInspector(html) {
  // Inject just before </body>; if no </body>, append at end.
  var idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + INSPECTOR_SCRIPT;
  return html.slice(0, idx) + INSPECTOR_SCRIPT + html.slice(idx);
}

// ---------- HTML index ----------

async function buildIndex() {
  const systemPaths = await findHtmlFiles(path.join(DESIGN_ROOT, 'system'), DESIGN_REL + '/system');
  const uiPaths = await findHtmlFiles(path.join(DESIGN_ROOT, 'ui'), DESIGN_REL + '/ui');

  const groups = {
    'Design system': { paths: systemPaths, stripPrefix: DESIGN_REL + '/system/' },
    'UI kit': { paths: uiPaths, stripPrefix: DESIGN_REL + '/ui/' },
  };

  let nav = '';
  for (const [label, { paths, stripPrefix }] of Object.entries(groups)) {
    nav += `<section><h2>${label} <span class="count">${paths.length}</span></h2>`;
    if (paths.length === 0) {
      nav += `<p class="empty">No HTML found.</p>`;
    } else {
      nav += renderTree(buildTree(paths, stripPrefix));
    }
    nav += '</section>';
  }

  return `<!DOCTYPE html>
<html data-theme="dark"><head>
<meta charset="utf-8">
<title>Dugmate Design — local browser</title>
<link rel="stylesheet" href="${encodeUrlPath(DESIGN_REL + '/system/project/colors_and_type.css')}">
<style>
* { box-sizing: border-box; }
html, body { margin:0; padding:0; height:100%; background: var(--bg-0,#09090b); color: var(--fg-0,#fafafa); font-family: var(--font-sans,Inter,system-ui), sans-serif; font-size:13px; }
#root { display:grid; grid-template-columns: 320px 1fr; height:100vh; }
nav { background: var(--bg-1,#18181b); border-right: 1px solid var(--border, rgba(255,255,255,0.10)); overflow-y:auto; padding: 12px 8px; }
nav h1 { font-family: var(--font-heading, "IBM Plex Sans"), sans-serif; font-size: 15px; font-weight: 700; margin: 4px 8px 16px; letter-spacing: -0.01em; display:flex; align-items:center; gap:8px; }
nav h1 .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--accent, #00D4E4); box-shadow: 0 0 8px var(--accent, #00D4E4); }
nav h1 .ws { margin-left:auto; width:6px; height:6px; border-radius:999px; background: var(--fg-3, #71717a); }
nav h1 .ws.connected { background: var(--status-success, #10b981); }
nav section { margin-bottom: 16px; }
nav h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-2, #a1a1aa); margin: 0 8px 8px; font-weight: 600; display:flex; align-items:baseline; justify-content:space-between; }
nav h2 .count { color: var(--fg-3, #71717a); font-weight: 500; font-family: var(--font-mono, "JetBrains Mono"), monospace; font-variant-numeric: tabular-nums; }
nav .empty { color: var(--fg-3, #71717a); font-size: 12px; padding: 0 8px; line-height: 1.5; }
nav .empty code { font-family: var(--font-mono, "JetBrains Mono"), monospace; font-size: 11px; background: var(--bg-2, #27272a); padding: 1px 4px; border-radius: 3px; }
nav details { margin-left: 4px; }
nav details > summary { cursor: pointer; padding: 3px 8px; border-radius: var(--radius-sm, 4px); font-weight: 500; user-select: none; list-style: none; }
nav details > summary::-webkit-details-marker { display:none; }
nav details > summary::before { content: "▸"; display: inline-block; width: 12px; color: var(--fg-3); font-size: 10px; transition: transform 0.1s; }
nav details[open] > summary::before { transform: rotate(90deg); }
nav details > summary:hover { background: var(--bg-hover, rgba(255,255,255,0.05)); }
nav ul { list-style: none; padding: 0 0 0 20px; margin: 0; }
nav li a { display: block; padding: 4px 8px; color: var(--fg-1, #d4d4d8); text-decoration: none; border-radius: var(--radius-sm, 4px); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
nav li a:hover { background: var(--bg-hover, rgba(255,255,255,0.05)); color: var(--fg-0); }
nav li a.active { background: color-mix(in oklab, var(--accent, #00D4E4) 18%, transparent); color: var(--accent, #00D4E4); }
nav li a.focused::before { content: "● "; color: var(--accent, #00D4E4); }
nav .cheatsheet { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border, rgba(255,255,255,0.10)); }
nav .cheatsheet h2 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--fg-2, #a1a1aa); margin: 0 8px 8px; font-weight: 600; }
nav .cheatsheet details { margin-left: 0; margin-bottom: 4px; }
nav .cheatsheet details > summary { padding: 4px 8px; font-size: 11px; font-weight: 500; color: var(--fg-1, #d4d4d8); border-radius: var(--radius-sm, 4px); }
nav .cheatsheet details > summary:hover { background: var(--bg-hover, rgba(255,255,255,0.05)); }
nav .cheatsheet ul, nav .cheatsheet ol { padding: 4px 8px 8px 16px; margin: 0; font-size: 11px; line-height: 1.6; }
nav .cheatsheet ul.kb li, nav .cheatsheet ul.cmds li, nav .cheatsheet ul.files li { display: flex; align-items: baseline; gap: 8px; padding: 2px 0; }
nav .cheatsheet ul.kb li > span, nav .cheatsheet ul.cmds li > span, nav .cheatsheet ul.files li > span { color: var(--fg-3, #71717a); font-size: 10px; margin-left: auto; text-align: right; flex: 0 0 auto; }
nav .cheatsheet ol.steps { padding-left: 22px; }
nav .cheatsheet ol.steps li { padding: 2px 0; color: var(--fg-1, #d4d4d8); }
nav .cheatsheet kbd { font-family: var(--font-mono, "JetBrains Mono"), monospace; background: var(--bg-2, #27272a); border: 1px solid var(--border, rgba(255,255,255,0.10)); padding: 1px 5px; border-radius: 3px; font-size: 10px; color: var(--fg-0, #fafafa); }
nav .cheatsheet code { font-family: var(--font-mono, "JetBrains Mono"), monospace; font-size: 10px; color: var(--accent, #00D4E4); background: rgba(0,212,228,0.08); padding: 1px 4px; border-radius: 3px; }
nav .cheatsheet code i { font-style: normal; color: var(--fg-2, #a1a1aa); }
nav .cheatsheet ul.cmds li, nav .cheatsheet ul.files li { flex-direction: column; align-items: flex-start; gap: 2px; }
nav .cheatsheet ul.cmds li > span, nav .cheatsheet ul.files li > span { margin-left: 0; text-align: left; }
main { display:flex; flex-direction: column; min-width: 0; }
header { display:flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-1, #18181b); border-bottom: 1px solid var(--border, rgba(255,255,255,0.10)); min-height: 44px; }
.tabs { display:flex; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; }
.tabs::-webkit-scrollbar { height: 0; }
.tab { display:flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--bg-2, #27272a); border: 1px solid var(--border, rgba(255,255,255,0.10)); border-radius: var(--radius-md, 6px); font-size: 12px; cursor: pointer; white-space: nowrap; max-width: 220px; }
.tab.active { background: var(--bg-3, #3f3f46); border-color: var(--border-strong, rgba(255,255,255,0.16)); color: var(--fg-0); }
.tab .name { overflow: hidden; text-overflow: ellipsis; }
.tab .close { color: var(--fg-3, #71717a); cursor: pointer; padding: 0 4px; border-radius: 2px; line-height: 1; font-size: 14px; }
.tab .close:hover { background: rgba(255,255,255,0.10); color: var(--fg-0); }
.actions { display:flex; gap: 4px; align-items:center; }
.actions button { background: var(--bg-2); color: var(--fg-1); border: 1px solid var(--border); padding: 5px 10px; font-size: 11px; border-radius: var(--radius-md, 6px); cursor: pointer; font-family: var(--font-mono, "JetBrains Mono"), monospace; }
.actions button:hover { background: var(--bg-3); color: var(--fg-0); }
.actions a { color: var(--fg-2); text-decoration: none; font-size: 11px; padding: 5px 8px; font-family: var(--font-mono, monospace); }
.actions a:hover { color: var(--accent, #00D4E4); }
.viewport { flex: 1; position: relative; background: #000; }
.viewport iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: none; background: var(--bg-0); }
.viewport iframe.active { display: block; }
.empty-state { display:flex; align-items: center; justify-content: center; height: 100%; color: var(--fg-3); flex-direction: column; gap: 16px; padding: 40px; text-align: center; }
.empty-state .big { font-family: var(--font-heading, "IBM Plex Sans"), sans-serif; font-size: 18px; color: var(--fg-1); font-weight: 600; }
.empty-state .small { font-family: var(--font-mono, monospace); font-size: 12px; opacity: 0.7; max-width: 480px; line-height: 1.6; }
.empty-state kbd { font-family: var(--font-mono, monospace); background: var(--bg-2); border: 1px solid var(--border); padding: 1px 6px; border-radius: 3px; font-size: 11px; }
.statusbar { font-family: var(--font-mono, monospace); font-size: 10px; color: var(--fg-3); padding: 4px 12px; background: var(--bg-1, #18181b); border-top: 1px solid var(--border, rgba(255,255,255,0.10)); display:flex; align-items:center; gap:14px; }
.statusbar > span:first-child { flex: 0 1 auto; min-width: 0; max-width: 40%; }
.statusbar > #sbWs { margin-left: auto; }
.statusbar .file { color: var(--accent, #00D4E4); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:inline-block; max-width: calc(100% - 50px); vertical-align: bottom; }
.statusbar .selected-info { display:flex !important; align-items:center; gap:6px; flex: 1 1 auto; min-width: 0; }
.statusbar .selected-info .sel-dot { color: var(--accent, #00D4E4); }
.statusbar .selected-info .sel-text { color: var(--fg-1, #d4d4d8); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.statusbar .selected-info button { background: transparent; color: var(--fg-3); border: 1px solid var(--border); border-radius: 3px; padding: 1px 6px; font-family: inherit; font-size: 10px; line-height: 1; cursor: pointer; }
.statusbar .selected-info button:hover { color: var(--fg-0); background: var(--bg-2); }
</style>
</head><body>
<div id="root">
<nav>
  <h1><span class="dot"></span>Dugmate Design <span class="ws" id="wsDot" title="WebSocket"></span></h1>
  ${nav}
  <section class="cheatsheet">
    <h2>Cheatsheet</h2>
    <details open>
      <summary>Element selection</summary>
      <ul class="kb">
        <li><kbd>⌘</kbd>/<kbd>⌥</kbd> + hover <span>highlight</span></li>
        <li><kbd>⌘</kbd> + click <span>select</span></li>
        <li><kbd>Esc</kbd> in canvas <span>clear</span></li>
        <li>switch tab <span>auto-clears</span></li>
      </ul>
    </details>
    <details>
      <summary>Tabs &amp; canvas</summary>
      <ul class="kb">
        <li>click in tree <span>open tab</span></li>
        <li><kbd>⌘W</kbd> <span>close active</span></li>
        <li><kbd>⌘R</kbd> <span>reload iframe</span></li>
        <li>↻ tree <span>rescan disk</span></li>
        <li>↗ system <span>open in browser</span></li>
      </ul>
    </details>
    <details>
      <summary>Slash commands</summary>
      <ul class="cmds">
        <li><code>/design "<i>feedback</i>"</code><span>edit active canvas in place</span></li>
        <li><code>/design "<i>…</i>" --screenshot <i>path</i></code><span>edit with anotated image</span></li>
        <li><code>/design:new "<i>Name</i>" "<i>brief</i>"</code><span>scaffold new HTML in <code>ui/project/</code></span></li>
        <li><code>/design:rollback</code><span>undo last edit</span></li>
        <li><code>/design:rollback --list</code><span>show snapshots</span></li>
        <li><code>/design:screenshot</code><span>capture canvas (uses selection if set)</span></li>
        <li><code>/design:critic</code><span>UX + DS review</span></li>
        <li><code>/design:handoff</code><span>migrate to apps/web|mobile</span></li>
      </ul>
    </details>
    <details>
      <summary>Pin-to-element flow</summary>
      <ol class="steps">
        <li>Open canvas in tab</li>
        <li><kbd>⌘</kbd>+click element you want to change</li>
        <li>Status bar shows <code>● selector</code></li>
        <li>Run <code>/design "<i>change just this</i>"</code></li>
        <li>Reload iframe (<kbd>⌘R</kbd>)</li>
      </ol>
    </details>
    <details>
      <summary>Files Claude reads</summary>
      <ul class="files">
        <li><code>_active.json</code><span>active tab + selected element</span></li>
        <li><code>_server.json</code><span>port + pid (auto-managed)</span></li>
        <li><code>_history/&lt;slug&gt;/</code><span>snapshot stack (gitignored)</span></li>
      </ul>
    </details>
  </section>
</nav>
<main>
  <header>
    <div class="tabs" id="tabs"></div>
    <div class="actions">
      <button id="btn-refresh-tree" title="Re-scan disk for new HTML files">↻ tree</button>
      <button id="btn-reload-active" title="Reload active iframe (Cmd+R)">↻ active</button>
      <a id="btn-open-system" target="_blank" title="Open active file in system browser">↗ system</a>
    </div>
  </header>
  <div class="viewport" id="viewport">
    <div class="empty-state" id="emptyState">
      <div class="big">No mock open</div>
      <div class="small">← klikni na <code>.html</code> v file tree.<br>Tabs jako v editoru. <kbd>Cmd+W</kbd> zavře aktivní tab. <kbd>Cmd+R</kbd> reloadne iframe (ne celou stránku).<br><br><strong>Element selection:</strong> uvnitř canvasu drž <kbd>Cmd</kbd> nebo <kbd>Alt</kbd> a najeď myší — element se zvýrazní cyan. <kbd>Cmd</kbd>+click ho označí. <kbd>Esc</kbd> uvnitř iframe ho odznačí.<br><br>Active soubor + selection sleduje <code>.ai/design/_active.json</code> — Claude to čte při <code>/design "&lt;feedback&gt;"</code>.</div>
    </div>
  </div>
  <div class="statusbar">
    <span>active: <span class="file" id="sbFile">—</span></span>
    <span class="selected-info" id="sbSelected" style="display:none">
      <span class="sel-dot">●</span>
      <span class="sel-text" id="sbSelectedText">—</span>
      <button id="btnClearSelected" title="Clear selection (Esc inside iframe)">×</button>
    </span>
    <span id="sbWs">ws: …</span>
  </div>
</main></div>
<script>
const tabs = [];
const tabsEl = document.getElementById('tabs');
const viewport = document.getElementById('viewport');
const emptyState = document.getElementById('emptyState');
const sbFile = document.getElementById('sbFile');
const sbWs = document.getElementById('sbWs');
const wsDot = document.getElementById('wsDot');

function urlOf(p) { return '/' + p.split('/').map(encodeURIComponent).join('/'); }

// ----- WebSocket -----
let ws;
function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(proto + '//' + location.host + '/_ws');
  ws.addEventListener('open', () => { sbWs.textContent = 'ws: connected'; wsDot.classList.add('connected'); });
  ws.addEventListener('close', () => { sbWs.textContent = 'ws: reconnecting…'; wsDot.classList.remove('connected'); setTimeout(connectWs, 1000); });
  ws.addEventListener('error', () => { /* close handler will retry */ });
  ws.addEventListener('message', e => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === 'snapshot' && m.state) renderSelected(m.state.selected);
      else if (m.type === 'selected') renderSelected(m.selected);
    } catch {}
  });
}
function wsSend(obj) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch {} }

function pushTabs() {
  wsSend({ type: 'tabs', tabs: tabs.map(t => t.path) });
}

function openTab(p) {
  let tab = tabs.find(t => t.path === p);
  if (!tab) {
    const iframe = document.createElement('iframe');
    iframe.src = urlOf(p);
    iframe.dataset.path = p;
    viewport.appendChild(iframe);

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.title = p;
    const name = p.split('/').pop();
    tabEl.innerHTML = '<span class="name"></span><span class="close" title="Close (Cmd+W)">×</span>';
    tabEl.querySelector('.name').textContent = name;
    tabEl.addEventListener('click', e => {
      if (e.target.classList.contains('close')) { closeTab(p); return; }
      activate(p);
    });
    tabsEl.appendChild(tabEl);

    tab = { path: p, iframeEl: iframe, tabEl };
    tabs.push(tab);
    pushTabs();
  }
  activate(p);
}

function activate(p) {
  emptyState.style.display = 'none';
  tabs.forEach(t => {
    t.iframeEl.classList.toggle('active', t.path === p);
    t.tabEl.classList.toggle('active', t.path === p);
  });
  document.querySelectorAll('nav a[data-path]').forEach(a => {
    a.classList.toggle('active', a.dataset.path === p);
    a.classList.toggle('focused', a.dataset.path === p);
  });
  const sysLink = document.getElementById('btn-open-system');
  sysLink.href = urlOf(p);
  sbFile.textContent = p;
  wsSend({ type: 'active', file: p });
}

function closeTab(p) {
  const i = tabs.findIndex(t => t.path === p);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  t.iframeEl.remove();
  t.tabEl.remove();
  pushTabs();
  if (tabs.length) activate(tabs[Math.max(0, i - 1)].path);
  else {
    emptyState.style.display = '';
    document.getElementById('btn-open-system').href = '#';
    sbFile.textContent = '—';
    wsSend({ type: 'active', file: '' });
  }
}

document.querySelectorAll('nav a[data-path]').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); openTab(a.dataset.path); });
});

document.getElementById('btn-refresh-tree').addEventListener('click', () => location.reload());
document.getElementById('btn-reload-active').addEventListener('click', reloadActive);

function reloadActive() {
  const a = tabs.find(t => t.iframeEl.classList.contains('active'));
  if (a) a.iframeEl.src = a.iframeEl.src;
}

window.addEventListener('keydown', e => {
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key === 'w') {
    e.preventDefault();
    const a = tabs.find(t => t.iframeEl.classList.contains('active'));
    if (a) closeTab(a.path);
  } else if (meta && e.key === 'r') {
    e.preventDefault();
    reloadActive();
  }
});

// ----- Element selection: receive postMessage from injected inspector inside iframes -----
const sbSelected = document.getElementById('sbSelected');
const sbSelectedText = document.getElementById('sbSelectedText');
const btnClearSelected = document.getElementById('btnClearSelected');

function renderSelected(sel) {
  if (!sel || !sel.selector) {
    sbSelected.style.display = 'none';
    sbSelectedText.textContent = '—';
    return;
  }
  sbSelected.style.display = '';
  const txt = (sel.text || '').slice(0, 60);
  sbSelectedText.textContent = sel.selector + (txt ? ' — "' + txt + '"' : '');
  sbSelectedText.title = sel.dom_path ? sel.dom_path.join(' > ') : sel.selector;
}

window.addEventListener('message', e => {
  const m = e.data;
  if (!m || typeof m !== 'object' || !m.dugmate) return;
  if (m.dugmate === 'select' && m.selection) {
    wsSend({ type: 'select', selection: m.selection });
    renderSelected(m.selection);
  } else if (m.dugmate === 'clear-select') {
    wsSend({ type: 'clear-select' });
    renderSelected(null);
  } else if (m.dugmate === 'loaded') {
    // iframe finished loading — could be used for auto-snapshot, future enhancement
  }
});

btnClearSelected.addEventListener('click', () => {
  wsSend({ type: 'clear-select' });
  renderSelected(null);
  // also clear visual highlight inside the active iframe
  const a = tabs.find(t => t.iframeEl.classList.contains('active'));
  if (a && a.iframeEl.contentWindow) {
    try { a.iframeEl.contentWindow.postMessage({ dugmate: 'force-clear' }, '*'); } catch {}
  }
});

// kick off WS only after handlers are defined
connectWs();
</script>
</body></html>`;
}

// ---------- HTTP ----------

const port = parseInt(process.env.PORT || '0', 10) || await findFreePort(4321);

const server = http.createServer(async (req, res) => {
  try {
    const reqPath = req.url || '/';
    if (reqPath === '/_health') {
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify({ ok: true, app: 'design', pid: process.pid, port }));
      return;
    }
    if (reqPath === '/_active') {
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify(activeState));
      return;
    }
    if (reqPath === '/' || reqPath === '/index.html') {
      const html = await buildIndex();
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    const fp = safePath(reqPath);
    if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }
    let stat;
    try { stat = await fs.stat(fp); }
    catch { res.writeHead(404); res.end('Not found'); return; }

    if (stat.isDirectory()) {
      const idx = path.join(fp, 'index.html');
      try {
        const data = await fs.readFile(idx);
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Directory listing disabled');
      }
      return;
    }

    const ext = path.extname(fp).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    let data = await fs.readFile(fp);

    // Inject the inspector overlay into HTML files served from .ai/design/
    // (skip the index page itself — we don't iframe-inspect ourselves).
    if (ext === '.html' && fp.startsWith(DESIGN_ROOT + path.sep)) {
      data = Buffer.from(injectInspector(data.toString('utf8')), 'utf8');
    }

    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (e) {
    res.writeHead(500);
    res.end('Server error: ' + e.message);
  }
});

server.on('upgrade', (req, socket) => {
  if ((req.url || '').startsWith('/_ws')) {
    attachWs(req, socket);
  } else {
    socket.destroy();
  }
});

server.listen(port, '127.0.0.1', async () => {
  await loadActive();
  await writeServerInfo(port);
  const url = `http://localhost:${port}`;
  console.log(`\n  Dugmate Design browser`);
  console.log(`  ─────────────────────────────`);
  console.log(`  ${url}`);
  console.log(`  Design:    ${DESIGN_ROOT}`);
  console.log(`  Active:    ${ACTIVE_FILE}`);
  console.log(`  Press Ctrl+C to stop.\n`);
  if (process.platform === 'darwin' && !process.env.NO_OPEN) {
    exec(`open ${url}`);
  } else if (process.platform === 'linux' && !process.env.NO_OPEN) {
    exec(`xdg-open ${url}`);
  }
});

const shutdown = () => {
  console.log('\n  Stopping…');
  removeServerInfo();
  for (const s of wsClients) { try { s.end(); } catch {} }
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => removeServerInfo());
