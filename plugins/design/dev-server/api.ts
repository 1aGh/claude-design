// JSON endpoint backers: comments, canvas state, index-data, system-data.
// Returns plain objects; http.ts wraps them in Response.json().

import crypto from 'node:crypto';
import { readFile, readdir, stat as statp } from 'node:fs/promises';
import path from 'node:path';

import type { Context } from './context.ts';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.expo',
  'coverage',
  'dev-server',
  '_history',
]);
const HIDDEN_OK = new Set(['.ai', '.claude', '.design']);

// ---------- File tree ----------

export async function findHtmlFiles(absRoot: string, prefixUnderRepo: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(absRoot, { withFileTypes: true });
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
    if (e.isDirectory()) out.push(...(await findHtmlFiles(full, rel)));
    else if (e.name.toLowerCase().endsWith('.html')) out.push(rel);
  }
  return out;
}

async function findFiles(absRoot: string, prefix: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(absRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.name.startsWith('.') && !HIDDEN_OK.has(e.name)) continue;
    if (e.name.startsWith('_')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(absRoot, e.name);
    const rel = path.posix.join(prefix, e.name);
    if (e.isDirectory()) out.push(...(await findFiles(full, rel, exts)));
    else if (exts.some((x) => e.name.toLowerCase().endsWith(x))) out.push(rel);
  }
  return out;
}

// ---------- Comments ----------

export interface Comment {
  id: string;
  file: string;
  selector: string;
  dom_path: string[];
  tag: string;
  classes: string;
  bounds: { x: number; y: number; w: number; h: number } | null;
  html_excerpt: string;
  text: string;
  status: 'open' | 'resolved';
  created: string;
  resolved_at: string | null;
}

export interface Api {
  // File tree
  fileSlug(file: string): string;
  loadCommentsForFile(file: string): Promise<Comment[]>;
  saveCommentsForFile(file: string, list: Comment[]): Promise<void>;
  loadAllComments(): Promise<Record<string, Comment[]>>;
  commentsAdd(payload: Partial<Comment> & { file: string; text: string }): Promise<Comment | null>;
  commentsPatch(id: string, patch: Partial<Comment>): Promise<Comment | null>;
  commentsDelete(id: string): Promise<boolean>;
  // Canvas state
  loadCanvasState(file: string): Promise<Record<string, unknown> | null>;
  saveCanvasState(file: string, state: Record<string, unknown>): Promise<void>;
  // Aggregate data
  buildIndexData(): Promise<unknown>;
  buildSystemData(): Promise<unknown>;
}

export function createApi(ctx: Context, onCommentsChanged: (file: string) => void): Api {
  const { paths, cfg } = ctx;

  function fileSlug(file: string): string {
    let p = String(file).replace(/^\/+|\/+$/g, '');
    try {
      p = decodeURIComponent(p);
    } catch {
      /* ignore */
    }
    const prefix = paths.designRel.replace(/^\/+|\/+$/g, '') + '/';
    if (p.startsWith(prefix)) p = p.slice(prefix.length);
    return p
      .replace(/\//g, '-')
      .replace(/\s+/g, '_')
      .replace(/\.html$/i, '')
      .replace(/^\.+/, '')
      .toLowerCase();
  }

  function commentsPath(file: string): string {
    return path.join(paths.commentsDir, `${fileSlug(file)}.json`);
  }

  async function loadCommentsForFile(file: string): Promise<Comment[]> {
    try {
      const raw = await Bun.file(commentsPath(file)).text();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async function saveCommentsForFile(file: string, list: Comment[]) {
    await Bun.write(commentsPath(file), JSON.stringify(list, null, 2));
  }

  async function loadAllComments(): Promise<Record<string, Comment[]>> {
    const out: Record<string, Comment[]> = {};
    let entries;
    try {
      entries = await readdir(paths.commentsDir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.json')) continue;
      try {
        const raw = await readFile(path.join(paths.commentsDir, e.name), 'utf8');
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr) || arr.length === 0) continue;
        const file = arr[0]?.file as string | undefined;
        if (file) out[file] = arr;
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  function newCommentId(): string {
    return 'c_' + crypto.randomBytes(6).toString('hex');
  }

  async function commentsAdd(payload: Partial<Comment> & { file: string; text: string }) {
    if (!payload || typeof payload.file !== 'string' || !payload.file) return null;
    if (typeof payload.text !== 'string' || !payload.text.trim()) return null;
    const list = await loadCommentsForFile(payload.file);
    const c: Comment = {
      id: newCommentId(),
      file: payload.file,
      selector: String(payload.selector || ''),
      dom_path: Array.isArray(payload.dom_path) ? payload.dom_path.slice(0, 16) : [],
      tag: String(payload.tag || ''),
      classes: String(payload.classes || ''),
      bounds: payload.bounds ?? null,
      html_excerpt: String(payload.html_excerpt || '').slice(0, 2000),
      text: String(payload.text).trim().slice(0, 4000),
      status: 'open',
      created: new Date().toISOString(),
      resolved_at: null,
    };
    list.push(c);
    await saveCommentsForFile(payload.file, list);
    onCommentsChanged(payload.file);
    return c;
  }

  async function commentsPatch(id: string, patch: Partial<Comment>) {
    const all = await loadAllComments();
    for (const [file, list] of Object.entries(all)) {
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) continue;
      const entry = list[i]!;
      if (patch.status === 'resolved' || patch.status === 'open') {
        entry.status = patch.status;
        entry.resolved_at = patch.status === 'resolved' ? new Date().toISOString() : null;
      }
      if (typeof patch.text === 'string' && patch.text.trim()) {
        entry.text = patch.text.trim().slice(0, 4000);
      }
      await saveCommentsForFile(file, list);
      onCommentsChanged(file);
      return entry;
    }
    return null;
  }

  async function commentsDelete(id: string): Promise<boolean> {
    const all = await loadAllComments();
    for (const [file, list] of Object.entries(all)) {
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) continue;
      list.splice(i, 1);
      await saveCommentsForFile(file, list);
      onCommentsChanged(file);
      return true;
    }
    return false;
  }

  // ---------- Canvas state ----------

  function canvasStatePath(file: string): string {
    return path.join(paths.canvasStateDir, `${fileSlug(file)}.json`);
  }

  async function loadCanvasState(file: string) {
    try {
      const raw = await Bun.file(canvasStatePath(file)).text();
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : null;
    } catch {
      return null;
    }
  }

  async function saveCanvasState(file: string, state: Record<string, unknown>) {
    if (!state || typeof state !== 'object') return;
    const safe: Record<string, unknown> = {};
    if (state.sections && typeof state.sections === 'object') safe.sections = state.sections;
    if (state.viewport && typeof state.viewport === 'object') {
      const v = state.viewport as { x?: number; y?: number; scale?: number };
      safe.viewport = {
        x: Number.isFinite(v.x) ? v.x : 0,
        y: Number.isFinite(v.y) ? v.y : 0,
        scale: Number.isFinite(v.scale) ? Math.min(8, Math.max(0.05, v.scale!)) : 1,
      };
    }
    await Bun.write(canvasStatePath(file), JSON.stringify(safe, null, 2));
  }

  // ---------- Index data + System data ----------

  async function buildIndexData() {
    const groups = [];

    // PROJECT — top-level .design/ files (README.md, INDEX.md, config.json, …).
    // These are non-HTML so they're listed but not openable in the iframe; the
    // sidebar can still display them as context (mirrors CV-08 mock).
    const projectFiles: string[] = [];
    try {
      const entries = await readdir(paths.designRoot, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        if (!e.isFile()) continue;
        if (e.name.startsWith('_')) continue;
        if (e.name.startsWith('.')) continue;
        if (!/\.(md|json|txt|yml|yaml|css)$/i.test(e.name)) continue;
        projectFiles.push(path.posix.join(paths.designRel, e.name));
      }
    } catch {}
    if (projectFiles.length) {
      groups.push({
        label: 'Project',
        paths: projectFiles,
        fullPath: paths.designRel,
        // Strip only the leading slash — keep `.design/...` so the tree
        // renders `▾ .design` as the parent dir per CV-08 mock.
        stripPrefix: '',
        kind: 'project' as const,
      });
    }

    // Canvas groups — strip just `.design/` so the immediate subdir
    // (`system`, `ui`, …) shows up as a dir wrapper in the tree (mirrors
    // CV-08's `▾ ui` / `▾ system/project` headers).
    //
    // For DS groups (label === 'Design system' OR path starts with `system`)
    // we also include sibling .md / .css / .json so README, SKILL, and the
    // tokens CSS file render in the tree per CV-08 mock. Inert at click time
    // (FileRow non-HTML branch).
    for (const g of cfg.canvasGroups) {
      const groupAbs = path.join(paths.designRoot, g.path);
      const groupRel = path.posix.join(paths.designRel, g.path);
      const isDs = g.label === 'Design system' || /^system(\/|$)/.test(g.path);
      const filePaths = isDs
        ? await findFiles(groupAbs, groupRel, ['.html', '.md', '.css', '.json'])
        : await findHtmlFiles(groupAbs, groupRel);
      groups.push({
        label: g.label,
        paths: filePaths,
        fullPath: groupRel,
        stripPrefix: paths.designRel + '/',
        kind: 'canvas' as const,
      });
    }

    // RUNTIME — gitignored state files (_active.json, _server.json) +
    // pointers to _history/ and _comments/ dirs. Visible but inert in the
    // sidebar; matches the CV-08 mock's bottom section.
    const runtimeFiles: string[] = [];
    try {
      const entries = await readdir(paths.designRoot, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        if (!e.name.startsWith('_')) continue;
        runtimeFiles.push(path.posix.join(paths.designRel, e.name));
      }
    } catch {}
    if (runtimeFiles.length) {
      groups.push({
        label: 'Runtime',
        paths: runtimeFiles,
        fullPath: paths.designRel,
        // Same as PROJECT — keep `.design/` so the tree shows the parent dir.
        stripPrefix: '',
        kind: 'runtime' as const,
      });
    }

    return {
      project: cfg.name,
      projectLabel: ctx.projectLabel,
      designRoot: paths.designRel,
      groups,
    };
  }

  function tokenKind(name: string, value: string): string {
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

  function parseTokens(css: string) {
    const tokens: { name: string; value: string; kind: string }[] = [];
    const re = /(--[a-z][a-z0-9-]*)\s*:\s*([^;}]+);/gi;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      const name = m[1]!.trim();
      const value = m[2]!.trim();
      const key = `${name}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push({ name, value, kind: tokenKind(name, value) });
    }
    return tokens;
  }

  async function buildSystemData() {
    const sysAbs = path.join(paths.designRoot, paths.systemDirRel);
    const sysRel = path.posix.join(paths.designRel, paths.systemDirRel);

    let readme: string | null = null;
    let readmePath: string | null = null;
    const readmeCandidates = [
      path.join(paths.designRoot, 'README.md'),
      path.join(sysAbs, 'README.md'),
    ];
    try {
      const subs = await readdir(sysAbs, { withFileTypes: true });
      for (const s of subs)
        if (s.isDirectory()) readmeCandidates.push(path.join(sysAbs, s.name, 'README.md'));
    } catch {
      /* ignore */
    }
    for (const c of readmeCandidates) {
      try {
        readme = await readFile(c, 'utf8');
        readmePath = path.relative(paths.repoRoot, c);
        break;
      } catch {
        /* ignore */
      }
    }

    let tokens: ReturnType<typeof parseTokens> = [];
    let tokensPath: string | null = null;
    try {
      const tokensAbs = path.join(paths.designRoot, cfg.tokensCssRel);
      const css = await readFile(tokensAbs, 'utf8');
      tokens = parseTokens(css);
      tokensPath = path.relative(paths.repoRoot, tokensAbs);
    } catch {
      /* ignore */
    }
    const tokenGroups: Record<string, typeof tokens> = {};
    for (const t of tokens) (tokenGroups[t.kind] = tokenGroups[t.kind] || []).push(t);

    async function galleryFor(folderName: string) {
      const matches: { abs: string; rel: string }[] = [];
      try {
        const subs = await readdir(sysAbs, { withFileTypes: true });
        for (const s of subs) {
          if (!s.isDirectory()) continue;
          const candidate = path.join(sysAbs, s.name, folderName);
          try {
            const st = await statp(candidate);
            if (st.isDirectory())
              matches.push({ abs: candidate, rel: path.posix.join(sysRel, s.name, folderName) });
          } catch {
            /* ignore */
          }
        }
        try {
          const st = await statp(path.join(sysAbs, folderName));
          if (st.isDirectory())
            matches.push({
              abs: path.join(sysAbs, folderName),
              rel: path.posix.join(sysRel, folderName),
            });
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
      const items: { label: string; path: string; group: string }[] = [];
      for (const m of matches) {
        const files = await findFiles(m.abs, m.rel, ['.html']);
        for (const f of files) {
          const fname = f
            .split('/')
            .pop()!
            .replace(/\.html$/i, '');
          const group = f.split('/').slice(-2, -1)[0] || folderName;
          const label = fname.toLowerCase() === 'index' ? group : fname;
          items.push({ label, path: f, group });
        }
      }
      return items;
    }

    const previewGallery = await galleryFor('preview');
    const uiKitsGallery = await galleryFor('ui_kits');

    return {
      project: cfg.name,
      designRoot: paths.designRel,
      systemDir: sysRel,
      readme,
      readmePath,
      tokens,
      tokenGroups,
      tokensPath,
      previewGallery,
      uiKitsGallery,
      rootClass: cfg.rootClass,
      themeDefault: cfg.themeDefault,
      teamAccentDefault: cfg.teamAccentDefault,
    };
  }

  return {
    fileSlug,
    loadCommentsForFile,
    saveCommentsForFile,
    loadAllComments,
    commentsAdd,
    commentsPatch,
    commentsDelete,
    loadCanvasState,
    saveCanvasState,
    buildIndexData,
    buildSystemData,
  };
}
