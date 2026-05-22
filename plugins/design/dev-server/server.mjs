#!/usr/bin/env node
// Design plugin — local browser. Zero deps, just node:http + node:crypto for WS handshake.
// Serves the design content under <designRoot> behind a tabbed UI with active-canvas tracking
// and Cmd+click element selection injected into served HTML files.
//
// Per-repo configuration: <repo>/.design/config.json (see ./config.schema.json).
//
// On boot, writes <designRoot>/_server.json (port + pid + url) so the orchestrator
// can detect a running instance instead of accidentally starting a second one.
// Tabs in the UI push their active state over WebSocket; server persists to
// <designRoot>/_active.json so /design:edit "<feedback>" knows which canvas to edit.

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

// Resolve the user's project root (where .design/ lives), NOT the plugin install dir.
// Priority: explicit --root arg > $CLAUDE_PROJECT_DIR (hooks) > process.cwd() (Bash tool / pnpm).
// Never uses __dirname — the plugin can be installed centrally and serve any repo.
function resolveRepoRoot() {
  const i = process.argv.indexOf('--root');
  if (i !== -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  return process.cwd();
}

const REPO_ROOT = resolveRepoRoot();

// Fail loud if launched from a directory that has no .design/ — otherwise the server
// would silently fall back to defaults and serve nothing useful, masking the real
// problem (user ran `node server.mjs` from $HOME, or CLAUDE_PROJECT_DIR is wrong).
if (!fsSync.existsSync(path.join(REPO_ROOT, '.design'))) {
  console.error(`  error: no .design/ directory at ${REPO_ROOT}`);
  console.error(`  Run from your project root, set $CLAUDE_PROJECT_DIR, or pass --root <path>.`);
  process.exit(1);
}

// ---------- Config ----------

const CONFIG_PATH = path.join(REPO_ROOT, '.design', 'config.json');

const DEFAULT_CONFIG = {
  name: 'Design',
  projectLabel: null,
  designRoot: '.design',
  canvasGroups: [
    { label: 'Design system', path: 'system' },
    { label: 'Canvases',      path: 'ui' },
  ],
  rootClass: 'app',
  themeDefault: 'dark',
  tokensCssRel: 'system/colors_and_type.css',
  teamAccentDefault: null,
  handoffTargets: [],
  newCanvasDir: 'ui',
  newComponentDir: 'ui/components',
};

function loadConfig() {
  let raw;
  try {
    raw = fsSync.readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    return { ...DEFAULT_CONFIG, _source: 'defaults' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`  warn: ${CONFIG_PATH} is not valid JSON: ${e.message}. Using defaults.`);
    return { ...DEFAULT_CONFIG, _source: 'defaults (config invalid)' };
  }
  return { ...DEFAULT_CONFIG, ...parsed, _source: '.design/config.json' };
}

const CFG = loadConfig();
const PROJECT_LABEL = CFG.projectLabel || `${CFG.name} Design`;
const DESIGN_REL = CFG.designRoot.replace(/^\/+|\/+$/g, '');
const DESIGN_ROOT = path.join(REPO_ROOT, DESIGN_REL);
const SERVER_INFO_FILE = path.join(DESIGN_ROOT, '_server.json');
const ACTIVE_FILE = path.join(DESIGN_ROOT, '_active.json');
const COMMENTS_DIR = path.join(DESIGN_ROOT, '_comments');
const CANVAS_STATE_DIR = path.join(DESIGN_ROOT, '_canvas-state');
const TOKENS_URL_REL = path.posix.join(DESIGN_REL, CFG.tokensCssRel.replace(/^\/+/, ''));

// ---------- MIME / FS ----------

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
const HIDDEN_OK = new Set(['.ai', '.claude', '.design']);

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
  active: null,
  open_tabs: [],
  selected: null,
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
    // Mirror the active file's comments inline so /design has a single read.
    // Authoritative storage stays in _comments/<slug>.json.
    let activeComments = [];
    if (activeState.active) {
      try { activeComments = await loadCommentsForFile(activeState.active); } catch {}
    }
    const enriched = { ...activeState, active_comments: activeComments };
    await fs.writeFile(ACTIVE_FILE, JSON.stringify(enriched, null, 2));
  } catch (e) {
    console.error('  warn: failed to save _active.json:', e.message);
  }
}

function setActive(file) {
  if (typeof file !== 'string') return;
  if (activeState.active === file) return;
  activeState.active = file || null;
  activeState.selected = null;
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

// ---------- Comments ----------

function fileSlug(file) {
  let p = String(file).replace(/^\/+|\/+$/g, '');
  // Decode URL-encoded paths (e.g. `Dugmate%20Studio.html` from location.pathname)
  // so the slug matches whether the caller sends raw or encoded.
  try { p = decodeURIComponent(p); } catch {}
  // Strip designRoot prefix if present so the slug stays stable regardless of how
  // callers spelled the path (some send "<designRoot>/ui/...", others send "ui/...").
  const prefix = DESIGN_REL.replace(/^\/+|\/+$/g, '') + '/';
  if (p.startsWith(prefix)) p = p.slice(prefix.length);
  return p
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.html$/i, '')
    .replace(/^\.+/, '')   // never produce a hidden file
    .toLowerCase();
}

function commentsPath(file) {
  return path.join(COMMENTS_DIR, `${fileSlug(file)}.json`);
}

async function loadCommentsForFile(file) {
  try {
    const raw = await fs.readFile(commentsPath(file), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function saveCommentsForFile(file, list) {
  await fs.mkdir(COMMENTS_DIR, { recursive: true });
  await fs.writeFile(commentsPath(file), JSON.stringify(list, null, 2));
}

async function loadAllComments() {
  const out = {};
  let entries;
  try {
    entries = await fs.readdir(COMMENTS_DIR, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(path.join(COMMENTS_DIR, e.name), 'utf8');
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const file = arr[0]?.file;
      if (file) out[file] = arr;
    } catch {}
  }
  return out;
}

function newCommentId() {
  return 'c_' + crypto.randomBytes(6).toString('hex');
}

async function broadcastComments(file) {
  const comments = await loadCommentsForFile(file);
  broadcast({ type: 'comments', file, comments });
  // Re-mirror into _active.json if this file is the active one
  if (activeState.active === file) saveActive();
}

async function commentsAdd(payload) {
  if (!payload || typeof payload.file !== 'string' || !payload.file) return null;
  if (typeof payload.text !== 'string' || !payload.text.trim()) return null;
  const list = await loadCommentsForFile(payload.file);
  const c = {
    id: newCommentId(),
    file: payload.file,
    selector: String(payload.selector || ''),
    dom_path: Array.isArray(payload.dom_path) ? payload.dom_path.slice(0, 16) : [],
    tag: String(payload.tag || ''),
    classes: String(payload.classes || ''),
    bounds: payload.bounds || null,
    html_excerpt: String(payload.html_excerpt || payload.html || '').slice(0, 2000),
    text: String(payload.text).trim().slice(0, 4000),
    status: 'open',
    created: new Date().toISOString(),
    resolved_at: null,
  };
  list.push(c);
  await saveCommentsForFile(payload.file, list);
  await broadcastComments(payload.file);
  return c;
}

async function commentsPatch(id, patch) {
  const all = await loadAllComments();
  for (const [file, list] of Object.entries(all)) {
    const i = list.findIndex(c => c.id === id);
    if (i < 0) continue;
    if (patch.status === 'resolved' || patch.status === 'open') {
      list[i].status = patch.status;
      list[i].resolved_at = patch.status === 'resolved' ? new Date().toISOString() : null;
    }
    if (typeof patch.text === 'string' && patch.text.trim()) {
      list[i].text = patch.text.trim().slice(0, 4000);
    }
    await saveCommentsForFile(file, list);
    await broadcastComments(file);
    return list[i];
  }
  return null;
}

async function commentsDelete(id) {
  const all = await loadAllComments();
  for (const [file, list] of Object.entries(all)) {
    const i = list.findIndex(c => c.id === id);
    if (i < 0) continue;
    list.splice(i, 1);
    await saveCommentsForFile(file, list);
    await broadcastComments(file);
    return true;
  }
  return false;
}

// ---------- Canvas state (pan/zoom + section ordering, persisted per-canvas) ----------

function canvasStatePath(file) {
  return path.join(CANVAS_STATE_DIR, `${fileSlug(file)}.json`);
}

async function loadCanvasState(file) {
  try {
    const raw = await fs.readFile(canvasStatePath(file), 'utf8');
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : null;
  } catch {
    return null;
  }
}

async function saveCanvasState(file, state) {
  if (!state || typeof state !== 'object') return;
  await fs.mkdir(CANVAS_STATE_DIR, { recursive: true });
  // Whitelist top-level keys we accept (don't trust arbitrary input)
  const safe = {};
  if (state.sections && typeof state.sections === 'object') safe.sections = state.sections;
  if (state.viewport && typeof state.viewport === 'object') {
    const v = state.viewport;
    safe.viewport = {
      x: Number.isFinite(v.x) ? v.x : 0,
      y: Number.isFinite(v.y) ? v.y : 0,
      scale: Number.isFinite(v.scale) ? Math.min(8, Math.max(0.05, v.scale)) : 1,
    };
  }
  await fs.writeFile(canvasStatePath(file), JSON.stringify(safe, null, 2));
}

function readJsonBody(req, max = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let buf = '';
    let too = false;
    req.on('data', c => {
      if (too) return;
      buf += c;
      if (buf.length > max) { too = true; reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (too) return;
      try { resolve(buf ? JSON.parse(buf) : null); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---------- server info ----------

async function writeServerInfo(port) {
  await fs.mkdir(DESIGN_ROOT, { recursive: true });
  const info = {
    pid: process.pid,
    port,
    url: `http://localhost:${port}`,
    started: new Date().toISOString(),
    project: CFG.name,
    config_source: CFG._source,
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
    else if (opcode === 0x9) { /* ping — skip */ }
    off = p;
  }
  return buf.slice(off);
}

function attachWs(req, socket) {
  if (!wsHandshake(req, socket)) return;
  wsClients.add(socket);
  let buf = Buffer.alloc(0);

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
          else if (msg.type === 'comments-add' && msg.payload) commentsAdd(msg.payload);
          else if (msg.type === 'comments-patch' && msg.id) commentsPatch(msg.id, msg.patch || {});
          else if (msg.type === 'comments-delete' && msg.id) commentsDelete(msg.id);
          else if (msg.type === 'comments-request' && typeof msg.file === 'string') {
            loadCommentsForFile(msg.file).then(comments => {
              wsSendText(socket, JSON.stringify({ type: 'comments', file: msg.file, comments }));
            });
          }
        } catch {}
      },
      () => { try { socket.end(); } catch {} }
    );
  });
  socket.on('close', () => wsClients.delete(socket));
  socket.on('error', () => wsClients.delete(socket));
}

// ---------- Inspector overlay (injected into every served .html under designRoot) ----------
//
// Listens for Cmd + hover (highlight), Cmd + click (select), Esc (clear).
// Posts selection to parent frame via window.parent.postMessage with key `dgn`.
// The parent (our index page) forwards over WebSocket.
// Also renders comment pins from comments list pushed by parent.

const INSPECTOR_SCRIPT = `
<script>
(function() {
  if (window.__designInspectorAttached) return;
  window.__designInspectorAttached = true;
  var FILE = (function(){ try { return decodeURIComponent(location.pathname); } catch(e){ return location.pathname; } })().replace(/^\\//,'');

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.dgn-insp-hover { outline: 2px solid #00D4E4 !important; outline-offset: 1px !important; cursor: crosshair !important; }',
    '.dgn-insp-selected { outline: 2px solid #00D4E4 !important; outline-offset: 1px !important; box-shadow: 0 0 0 4px rgba(0,212,228,0.18) !important; }',
    '.dgn-insp-label { position: fixed; z-index: 2147483647; font: 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace; background: #00D4E4; color: #000; padding: 4px 8px; border-radius: 4px; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4); transform: translate(0, -110%); white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }',
    '.dgn-insp-label.warn { background: #ef4444; color: #fff; }',
    '.dgn-pin { position: absolute; top: 0; left: 0; z-index: 2147483646; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 999px 999px 999px 4px; background: #facc15; color: #1c1917; font: 600 11px/22px var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); text-align: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4); transition: filter 120ms; transform-origin: bottom left; will-change: transform; }',
    '.dgn-pin:hover { filter: brightness(1.1); outline: 2px solid rgba(0,0,0,0.3); }',
    '.dgn-pin.resolved { background: #22c55e; color: #052e16; }',
    '.dgn-pin.focused { box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 2px #fff; outline: 2px solid #fff; }'
  ].join('\\n');
  document.documentElement.appendChild(styleEl);

  var label = document.createElement('div');
  label.className = 'dgn-insp-label';
  label.style.display = 'none';
  document.documentElement.appendChild(label);

  var pinLayer = document.createElement('div');
  pinLayer.id = 'dgn-pin-layer';
  pinLayer.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
  document.documentElement.appendChild(pinLayer);

  var lastHover = null;
  var lastSelected = null;
  var modifierDown = false;
  var cKeyDown = false;       // true while user holds C — turns next click into select+comment
  var commentsCache = [];
  var focusedPinId = null;

  function isModifier(e) { return e.metaKey; }

  function shortText(el, max) {
    var t = (el.innerText || el.textContent || '').replace(/\\s+/g,' ').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  // Filter out inspector-added classes (dgn-insp-*, dgn-pin*) — they're added/
  // removed live as the user hovers/selects, so capturing them in selectors
  // would make the saved selector stop matching the moment the user releases
  // the mouse. Same applies to dom_path.
  function realClasses(el) {
    return (el.getAttribute('class') || '').trim().split(/\\s+/)
      .filter(function(c) { return c && c.indexOf('dgn-') !== 0; });
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    var path = [];
    while (el && el.nodeType === 1 && path.length < 8) {
      var dscEl = el.getAttribute && el.getAttribute('data-dc-element');
      if (dscEl) { path.unshift('[data-dc-element="' + dscEl + '"]'); break; }
      var dscSc = el.getAttribute && el.getAttribute('data-dc-screen');
      if (dscSc) { path.unshift('[data-dc-screen="' + dscSc + '"]'); break; }
      var sel = el.nodeName.toLowerCase();
      if (el.id) { sel = '#' + el.id; path.unshift(sel); break; }
      var cls = realClasses(el).slice(0, 2);
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
      var dEl = el.getAttribute && el.getAttribute('data-dc-element');
      var dSc = el.getAttribute && el.getAttribute('data-dc-screen');
      if (dEl) label += '[data-dc-element="' + dEl + '"]';
      else if (dSc) label += '[data-dc-screen="' + dSc + '"]';
      else if (el.id) label += '#' + el.id;
      var cls = realClasses(el).slice(0, 2);
      if (cls.length && !dEl && !dSc) label += '.' + cls.join('.');
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
      classes: realClasses(el).join(' '),
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
    if (e.key === 'Meta') modifierDown = true;
    if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey)) cKeyDown = true;
    if (e.key === 'Escape') {
      if (lastHover) lastHover.classList.remove('dgn-insp-hover');
      if (lastSelected) lastSelected.classList.remove('dgn-insp-selected');
      lastHover = null; lastSelected = null;
      hideLabel();
      try { window.parent.postMessage({ dgn: 'clear-select' }, '*'); } catch(e) {}
    }
    // Cmd+C without click — open composer for already-selected element
    if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey && !e.altKey) {
      if (lastSelected) {
        e.preventDefault();
        try { window.parent.postMessage({ dgn: 'comment-shortcut' }, '*'); } catch(e) {}
      }
    }
  }, true);
  document.addEventListener('keyup', function(e) {
    if (e.key === 'Meta') {
      modifierDown = false;
      if (lastHover) { lastHover.classList.remove('dgn-insp-hover'); lastHover = null; }
      hideLabel();
    }
    if (e.key === 'c' || e.key === 'C') cKeyDown = false;
  }, true);
  document.addEventListener('blur', function() {
    modifierDown = false;
    cKeyDown = false;
    if (lastHover) { lastHover.classList.remove('dgn-insp-hover'); lastHover = null; }
    hideLabel();
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (!isModifier(e)) {
      if (lastHover) { lastHover.classList.remove('dgn-insp-hover'); lastHover = null; }
      hideLabel();
      return;
    }
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === lastHover) return;
    if (el === label) return;
    if (lastHover) lastHover.classList.remove('dgn-insp-hover');
    lastHover = el;
    el.classList.add('dgn-insp-hover');
    var t = el.tagName.toLowerCase();
    var c = (el.getAttribute('class') || '').trim();
    showLabel(t + (c ? '.' + c.split(/\\s+/).slice(0,2).join('.') : ''), e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function(e) {
    if (!isModifier(e)) return;
    if (e.target && e.target.closest && e.target.closest('.dgn-pin')) return;  // let pin handler run
    e.preventDefault();
    e.stopPropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.classList.contains('dgn-pin')) return;
    if (lastSelected) lastSelected.classList.remove('dgn-insp-selected');
    lastSelected = el;
    el.classList.add('dgn-insp-selected');
    var info = elInfo(el);
    try { window.parent.postMessage({ dgn: 'select', selection: info }, '*'); } catch(err) {}
    // Comment-while-clicking: ⌘⇧+click OR ⌘+click while holding C → select + composer
    var commentNow = e.shiftKey || cKeyDown;
    if (commentNow) {
      try { window.parent.postMessage({ dgn: 'comment-compose', selection: info }, '*'); } catch(err) {}
    }
    showLabel((commentNow ? 'comment: ' : 'selected: ') + info.tag + (info.classes ? '.' + info.classes.split(/\\s+/).slice(0,2).join('.') : ''), e.clientX, e.clientY);
    setTimeout(hideLabel, 1500);
  }, true);

  // ----- Pin rendering for comments -----
  // Pins are anchored to actual DOM elements. Because the design canvas pans/zooms
  // via CSS transform (no scroll event fires), we keep a rAF loop running while any
  // pin exists — cheap layout reads, ensures pins stay glued to their elements
  // through every transform tick (wheel zoom, drag pan, gesture pinch).

  var pinNodes = [];   // [{ el, comment, target }]
  var rafToken = null;

  function buildPinNodes() {
    pinLayer.innerHTML = '';
    pinNodes = [];
    var withSelector = commentsCache.filter(function(c) { return c && c.selector; });
    withSelector.forEach(function(c, i) {
      var target = null;
      try { target = document.querySelector(c.selector); } catch (e) {}
      var pin = document.createElement('button');
      pin.className = 'dgn-pin' + (c.status === 'resolved' ? ' resolved' : '') + (c.id === focusedPinId ? ' focused' : '');
      pin.textContent = String(i + 1);
      pin.title = (c.text || '').slice(0, 200);
      pin.style.pointerEvents = 'auto';
      pin.style.left = '0px';
      pin.style.top = '0px';
      pin.dataset.id = c.id;
      pin.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        focusedPinId = c.id;
        try { window.parent.postMessage({ dgn: 'comment-click', id: c.id }, '*'); } catch (e) {}
        buildPinNodes();
      });
      pinLayer.appendChild(pin);
      pinNodes.push({ el: pin, comment: c, target: target });
    });
    placePins();
  }

  function placePins() {
    if (!pinNodes.length) return;
    for (var i = 0; i < pinNodes.length; i++) {
      var node = pinNodes[i];
      var x, y, hidden = false;
      // Re-resolve target lazily — DOM may have changed since last build
      if (!node.target || !node.target.isConnected) {
        try { node.target = document.querySelector(node.comment.selector); } catch (e) {}
      }
      if (node.target) {
        var r = node.target.getBoundingClientRect();
        // pinLayer is position:absolute at document top:0/left:0 → coords are document-relative
        x = r.left + window.scrollX - 8;
        y = r.top + window.scrollY - 8;
        // Hide if element is gone from layout (zero rect)
        if (r.width === 0 && r.height === 0) hidden = true;
      } else if (node.comment.bounds) {
        x = node.comment.bounds.x - 8;
        y = node.comment.bounds.y - 8;
      } else {
        hidden = true;
      }
      if (hidden) {
        node.el.style.display = 'none';
      } else {
        node.el.style.display = '';
        var scale = (node.comment.id === focusedPinId) ? 1.2 : 1;
        node.el.style.transform = 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px) scale(' + scale + ')';
      }
    }
  }

  function tick() {
    rafToken = null;
    placePins();
    if (pinNodes.length) rafToken = requestAnimationFrame(tick);
  }
  function startTick() {
    if (rafToken == null && pinNodes.length) rafToken = requestAnimationFrame(tick);
  }
  function stopTick() {
    if (rafToken != null) { cancelAnimationFrame(rafToken); rafToken = null; }
  }

  function schedulePins() { buildPinNodes(); startTick(); }

  // Keep position fresh on any scroll (incl. inner scrollers via capture phase),
  // resize, transform/style mutations, and continuously while pins exist via rAF.
  window.addEventListener('resize', placePins);
  document.addEventListener('scroll', placePins, { passive: true, capture: true });
  document.addEventListener('wheel',  function() { startTick(); }, { passive: true, capture: true });
  document.addEventListener('pointermove', function(e) { if (e.buttons) startTick(); }, { passive: true, capture: true });
  document.addEventListener('keyup', function() { startTick(); }, true);
  // Also observe DOM mutations (transform style, layout shifts, late-mounted React content)
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function(){ startTick(); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['style', 'class'], childList: true });
  }

  window.addEventListener('message', function(e) {
    var m = e.data;
    if (!m || typeof m !== 'object' || !m.dgn) return;
    if (m.dgn === 'comments-set' && Array.isArray(m.comments)) {
      commentsCache = m.comments;
      schedulePins();
    } else if (m.dgn === 'comment-focus') {
      focusedPinId = m.id || null;
      // Update pin classes + transform without rebuilding nodes (preserves rAF state)
      pinNodes.forEach(function(node) {
        node.el.classList.toggle('focused', node.comment.id === focusedPinId);
      });
      placePins();
      startTick();
      // Scroll target into view if present
      var c = commentsCache.find(function(x){ return x && x.id === m.id; });
      if (c && c.selector) {
        try {
          var t = document.querySelector(c.selector);
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {}
      }
    } else if (m.dgn === 'force-clear') {
      if (lastSelected) lastSelected.classList.remove('dgn-insp-selected');
      lastSelected = null;
    }
  });

  try { window.parent.postMessage({ dgn: 'loaded', file: FILE }, '*'); } catch(e) {}
})();
</script>
`;

// ---------- Inspector script injection ----------

function injectInspector(html) {
  var idx = html.lastIndexOf('</body>');
  if (idx === -1) return html + INSPECTOR_SCRIPT;
  return html.slice(0, idx) + INSPECTOR_SCRIPT + html.slice(idx);
}

// ---------- File-tree data ----------

async function buildIndexData() {
  const groups = [];
  for (const g of CFG.canvasGroups) {
    const groupAbs = path.join(DESIGN_ROOT, g.path);
    const groupRel = path.posix.join(DESIGN_REL, g.path);
    const paths = await findHtmlFiles(groupAbs, groupRel);
    groups.push({
      label: g.label,
      paths,
      fullPath: groupRel,
      stripPrefix: groupRel + '/',
    });
  }
  return {
    project: CFG.name,
    projectLabel: PROJECT_LABEL,
    designRoot: DESIGN_REL,
    groups,
  };
}

// ---------- System view aggregator ----------

const SYSTEM_DIR_REL = (CFG.canvasGroups.find(g => /system/i.test(g.path))?.path) || 'system';

async function findFiles(absRoot, prefix, exts) {
  const out = [];
  let entries;
  try { entries = await fs.readdir(absRoot, { withFileTypes: true }); } catch { return out; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.name.startsWith('.') && !HIDDEN_OK.has(e.name)) continue;
    if (e.name.startsWith('_')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(absRoot, e.name);
    const rel = path.posix.join(prefix, e.name);
    if (e.isDirectory()) {
      out.push(...await findFiles(full, rel, exts));
    } else if (exts.some(x => e.name.toLowerCase().endsWith(x))) {
      out.push(rel);
    }
  }
  return out;
}

function tokenKind(name, value) {
  const n = name.toLowerCase();
  const v = String(value).trim();
  if (/(color|fg|bg|border|accent|status|surface|text)/.test(n)) return 'color';
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return 'color';
  if (/^(rgb|rgba|hsl|hsla|oklch|color)\(/i.test(v)) return 'color';
  if (/(font-size|fs|text)/.test(n) && /\d/.test(v)) return 'fontsize';
  if (/(font|family|display|sans|mono)/.test(n)) return 'font';
  if (/(radius|r-)/.test(n)) return 'radius';
  if (/(shadow|elev)/.test(n)) return 'shadow';
  if (/(space|gap|s-|spacing)/.test(n)) return 'space';
  if (/(weight|fw)/.test(n)) return 'weight';
  if (/(line-height|lh|leading)/.test(n)) return 'leading';
  if (/(duration|ease|motion)/.test(n)) return 'motion';
  return 'other';
}

function parseTokens(css) {
  const tokens = [];
  // Capture --name: value;  inside any rule. Naive but robust enough.
  const re = /(--[a-z][a-z0-9-]*)\s*:\s*([^;}]+);/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(css)) !== null) {
    const name = m[1].trim();
    const value = m[2].trim();
    const key = name + '|' + value;
    if (seen.has(key)) continue;
    seen.add(key);
    tokens.push({ name, value, kind: tokenKind(name, value) });
  }
  return tokens;
}

async function buildSystemData() {
  const sysAbs = path.join(DESIGN_ROOT, SYSTEM_DIR_REL);
  const sysRel = path.posix.join(DESIGN_REL, SYSTEM_DIR_REL);

  // README — try canonical locations (designRoot/README.md, system/README.md, system/<project>/README.md)
  let readme = null, readmePath = null;
  const readmeCandidates = [
    path.join(DESIGN_ROOT, 'README.md'),
    path.join(sysAbs, 'README.md'),
  ];
  try {
    const subs = await fs.readdir(sysAbs, { withFileTypes: true });
    for (const s of subs) {
      if (s.isDirectory()) readmeCandidates.push(path.join(sysAbs, s.name, 'README.md'));
    }
  } catch {}
  for (const c of readmeCandidates) {
    try {
      readme = await fs.readFile(c, 'utf8');
      readmePath = path.relative(REPO_ROOT, c);
      break;
    } catch {}
  }

  // Tokens
  let tokens = [];
  let tokensPath = null;
  try {
    const tokensAbs = path.join(DESIGN_ROOT, CFG.tokensCssRel);
    const css = await fs.readFile(tokensAbs, 'utf8');
    tokens = parseTokens(css);
    tokensPath = path.relative(REPO_ROOT, tokensAbs);
  } catch {}
  const tokenGroups = {};
  for (const t of tokens) (tokenGroups[t.kind] = tokenGroups[t.kind] || []).push(t);

  // Two canonical galleries per design-system skill: preview/ + ui_kits/
  // (Other folders — assets, components, scraps — vary per project; surface only
  // when they exist as a flat file list at the bottom.)
  async function galleryFor(folderName) {
    // Look one level deep — system/<project>/<folderName>/...
    const matches = [];
    try {
      const subs = await fs.readdir(sysAbs, { withFileTypes: true });
      for (const s of subs) {
        if (!s.isDirectory()) continue;
        const candidate = path.join(sysAbs, s.name, folderName);
        try {
          const stat = await fs.stat(candidate);
          if (stat.isDirectory()) matches.push({ abs: candidate, rel: path.posix.join(sysRel, s.name, folderName) });
        } catch {}
      }
      // Also accept top-level system/<folderName>/
      try {
        const stat = await fs.stat(path.join(sysAbs, folderName));
        if (stat.isDirectory()) matches.push({ abs: path.join(sysAbs, folderName), rel: path.posix.join(sysRel, folderName) });
      } catch {}
    } catch {}
    const items = [];
    for (const m of matches) {
      const files = await findFiles(m.abs, m.rel, ['.html']);
      for (const f of files) {
        const fname = f.split('/').pop().replace(/\.html$/i, '');
        const group = f.split('/').slice(-2, -1)[0] || folderName;
        // For "index.html" prefer the group name as the label (e.g. "desktop", "mobile")
        const label = (fname.toLowerCase() === 'index') ? group : fname;
        items.push({ label, path: f, group });
      }
    }
    return items;
  }

  const previewGallery = await galleryFor('preview');
  const uiKitsGallery  = await galleryFor('ui_kits');

  return {
    project: CFG.name,
    designRoot: DESIGN_REL,
    systemDir: sysRel,
    readme,
    readmePath,
    tokens,
    tokenGroups,
    tokensPath,
    previewGallery,
    uiKitsGallery,
    rootClass: CFG.rootClass,
    themeDefault: CFG.themeDefault,
    teamAccentDefault: CFG.teamAccentDefault,
  };
}

// ---------- Client + runtime static files ----------

const CLIENT_DIR  = path.join(__dirname, 'client');

async function serveStaticFrom(rootDir, relPath, res) {
  const safe = relPath.replace(/\.\./g, '');
  const fp = path.join(rootDir, safe);
  if (!fp.startsWith(rootDir + path.sep) && fp !== rootDir) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    const data = await fs.readFile(fp);
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const serveClientFile  = (rel, res) => serveStaticFrom(CLIENT_DIR, rel, res);

// ---------- HTTP ----------

const port = parseInt(process.env.PORT || '0', 10) || await findFreePort(4321);

const server = http.createServer(async (req, res) => {
  try {
    const reqPath = req.url || '/';
    if (reqPath === '/_health') {
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify({ ok: true, app: 'design', project: CFG.name, pid: process.pid, port }));
      return;
    }
    if (reqPath === '/_active') {
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify(activeState));
      return;
    }
    if (reqPath === '/_config') {
      const safeCfg = { ...CFG };
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify(safeCfg, null, 2));
      return;
    }
    if (reqPath === '/_index-data') {
      const data = await buildIndexData();
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
      return;
    }
    if (reqPath === '/_system-data') {
      const data = await buildSystemData();
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
      return;
    }
    if (reqPath.startsWith('/_canvas-state')) {
      const url = new URL(reqPath, 'http://x');
      if (req.method === 'GET') {
        const file = url.searchParams.get('file');
        if (!file) { res.writeHead(400); res.end('file query param required'); return; }
        const state = await loadCanvasState(file);
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(state || {}));
        return;
      }
      if (req.method === 'POST') {
        try {
          const body = await readJsonBody(req);
          if (!body || typeof body.file !== 'string' || !body.file) {
            res.writeHead(400); res.end('body must include file (string)');
            return;
          }
          await saveCanvasState(body.file, body);
          res.writeHead(204); res.end();
        } catch (e) {
          res.writeHead(400); res.end('invalid JSON: ' + e.message);
        }
        return;
      }
      res.writeHead(405); res.end('Method not allowed');
      return;
    }
    if (reqPath.startsWith('/_comments') && req.method === 'GET') {
      const url = new URL(reqPath, 'http://x');
      if (url.pathname === '/_comments-all') {
        const all = await loadAllComments();
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(all));
        return;
      }
      if (url.pathname === '/_comments') {
        const file = url.searchParams.get('file');
        if (!file) { res.writeHead(400); res.end('file query param required'); return; }
        const comments = await loadCommentsForFile(file);
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ file, comments }));
        return;
      }
    }
    if (reqPath === '/' || reqPath === '/index.html') {
      // Serve client/index.html
      try {
        const data = await fs.readFile(path.join(CLIENT_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
        res.end(data);
      } catch (e) {
        res.writeHead(500); res.end('Client UI missing — expected at ' + path.join(CLIENT_DIR, 'index.html'));
      }
      return;
    }
    if (reqPath.startsWith('/_client/')) {
      const rel = decodeURIComponent(reqPath.slice('/_client/'.length));
      await serveClientFile(rel, res);
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

    if (ext === '.html' && fp.startsWith(DESIGN_ROOT + path.sep)) {
      let html = data.toString('utf8');
      html = injectInspector(html);
      data = Buffer.from(html, 'utf8');
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
  console.log(`\n  ${PROJECT_LABEL} — local browser`);
  console.log(`  ─────────────────────────────`);
  console.log(`  ${url}`);
  console.log(`  Project:   ${CFG.name}`);
  console.log(`  Config:    ${CFG._source}`);
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
