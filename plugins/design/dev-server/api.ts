// JSON endpoint backers: comments, canvas state, index-data, system-data.
// Returns plain objects; http.ts wraps them in Response.json().

import crypto from 'node:crypto';
import type { Dirent } from 'node:fs';
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

/**
 * Find canvas files under a non-DS group root. Phase 3.6+ accepts both `.tsx`
 * (current authoring format) and `.html` (legacy, pre-codemod) so the tree
 * keeps rendering during the migration grace window. DS preview specimens
 * (`system/<ds>/preview/*.html`) intentionally stay `.html` and travel via
 * the DS-aware `findFiles()` path below.
 */
export async function findHtmlFiles(absRoot: string, prefixUnderRepo: string): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[];
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
    else {
      const low = e.name.toLowerCase();
      if (low.endsWith('.tsx') || low.endsWith('.html')) out.push(rel);
    }
  }
  return out;
}

async function findFiles(absRoot: string, prefix: string, exts: string[]): Promise<string[]> {
  const out: string[] = [];
  let entries: Dirent[];
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

/**
 * Phase 6 — single reply on a comment thread. `id` is `r_<hex>`; persists inside
 * the parent `Comment.thread[]`. Bodies are bounded the same way as comment
 * bodies (4000 chars), and `@handle` tokens in `body` flow into the parent's
 * `mentions[]` union.
 */
export interface Reply {
  id: string;
  author: string;
  body: string;
  created: string;
}

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
  // Phase 6 — author + threading + mentions. Default-filled on read for legacy
  // comments missing these fields (see `loadCommentsForFile`); persisted on next
  // write. `author` defaults to the local `git config user.name` resolved at
  // create time, `thread` to `[]`, `mentions` to `[]`.
  author: string;
  thread: Reply[];
  mentions: string[];
}

export interface GitCommitter {
  name: string;
  email: string;
  commits: number;
}

// Phase 6.5 T10 — export history. Five-deep ring buffer of recent exports
// surfaced by the dialog's "Recent" tab + ⌘⇧E re-run.
export interface ExportHistoryEntry {
  format: string;
  scope: string;
  options?: Record<string, unknown>;
  filename: string;
  at: string;
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
  commentsAddReply(id: string, payload: { body: string; author?: string }): Promise<Comment | null>;
  gitCommitters(): Promise<GitCommitter[]>;
  /**
   * Phase 8 — local `git config user.name`, cached for the process lifetime.
   * Used by the collab client to derive a stable color hash per peer.
   * Empty string when git is unset; the client falls back to `anonymous-<pid>`.
   */
  gitCurrentUser(): Promise<string>;
  parseMentions(text: string): string[];
  // Canvas state
  loadCanvasState(file: string): Promise<Record<string, unknown> | null>;
  saveCanvasState(file: string, state: Record<string, unknown>): Promise<void>;
  // Canvas meta sidecar (Phase 4 T5 — .design/ui/<slug>.meta.json)
  loadCanvasMeta(file: string): Promise<Record<string, unknown> | null>;
  patchCanvasMeta(
    file: string,
    patch: Record<string, unknown>
  ): Promise<Record<string, unknown> | null>;
  // Annotations sidecar (Phase 5 — .design/<slug>.annotations.svg)
  loadAnnotations(file: string): Promise<string | null>;
  saveAnnotations(file: string, svg: string): Promise<boolean>;
  // Aggregate data
  buildIndexData(): Promise<unknown>;
  buildSystemData(dsName?: string | null): Promise<unknown>;
  // Export history (Phase 6.5 T10)
  loadExportHistory(): Promise<ExportHistoryEntry[]>;
  appendExportHistory(entry: ExportHistoryEntry): Promise<void>;
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
    const prefix = `${paths.designRel.replace(/^\/+|\/+$/g, '')}/`;
    if (p.startsWith(prefix)) p = p.slice(prefix.length);
    return p
      .replace(/\//g, '-')
      .replace(/\s+/g, '_')
      .replace(/\.(tsx|html)$/i, '')
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
      if (!Array.isArray(arr)) return [];
      // Phase 6 — default-fill `author` / `thread` / `mentions` for legacy
      // rows. No write-back here; the on-disk shape stays stable until the
      // next mutation persists the upgraded record.
      return arr.map(backfillComment);
    } catch {
      return [];
    }
  }

  function backfillComment(raw: unknown): Comment {
    const c = (raw ?? {}) as Partial<Comment>;
    return {
      ...(c as Comment),
      author: typeof c.author === 'string' ? c.author : '',
      thread: Array.isArray(c.thread) ? c.thread : [],
      mentions: Array.isArray(c.mentions) ? c.mentions : [],
    };
  }

  async function saveCommentsForFile(file: string, list: Comment[]) {
    await Bun.write(commentsPath(file), JSON.stringify(list, null, 2));
  }

  async function loadAllComments(): Promise<Record<string, Comment[]>> {
    const out: Record<string, Comment[]> = {};
    let entries: Dirent[];
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
        // Backfill legacy rows so callers see the v2 shape uniformly.
        if (file) out[file] = arr.map(backfillComment);
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  function newCommentId(): string {
    return `c_${crypto.randomBytes(6).toString('hex')}`;
  }

  function newReplyId(): string {
    return `r_${crypto.randomBytes(6).toString('hex')}`;
  }

  // ---------- Git author resolution ----------
  //
  // Author defaults flow from `git config user.name` resolved against the
  // repo root. Cached for the lifetime of the process — the local git
  // identity doesn't shift mid-session and `Bun.spawn` is cheap-but-not-free.

  let cachedGitUser: string | null = null;
  let cachedGitUserAttempted = false;
  async function gitCurrentUser(): Promise<string> {
    if (cachedGitUserAttempted) return cachedGitUser ?? '';
    cachedGitUserAttempted = true;
    try {
      const proc = Bun.spawn(['git', 'config', 'user.name'], {
        cwd: paths.repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const out = await new Response(proc.stdout).text();
      await proc.exited;
      const name = out.trim();
      cachedGitUser = name || null;
    } catch {
      cachedGitUser = null;
    }
    return cachedGitUser ?? '';
  }

  // `git shortlog -sne` against the repo head — cached for 60 s so the
  // @mention popup doesn't re-fork git on every keystroke.
  let cachedCommitters: GitCommitter[] | null = null;
  let cachedCommittersAt = 0;
  async function gitCommitters(): Promise<GitCommitter[]> {
    const now = Date.now();
    if (cachedCommitters && now - cachedCommittersAt < 60_000) return cachedCommitters;
    try {
      const proc = Bun.spawn(['git', 'shortlog', '-sne', 'HEAD'], {
        cwd: paths.repoRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const text = await new Response(proc.stdout).text();
      await proc.exited;
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 20);
      const out: GitCommitter[] = [];
      for (const line of lines) {
        // Format: `<spaces><count>\t<name> <<email>>`
        const m = line.match(/^(\d+)\s+(.+?)\s+<([^>]+)>$/);
        if (!m) continue;
        const commits = Number(m[1]);
        const name = m[2]?.trim() ?? '';
        const email = m[3]?.trim() ?? '';
        if (!name) continue;
        out.push({ name, email, commits });
      }
      cachedCommitters = out;
      cachedCommittersAt = now;
      return out;
    } catch {
      cachedCommitters = cachedCommitters ?? [];
      cachedCommittersAt = now;
      return cachedCommitters;
    }
  }

  /**
   * Extract `@handle` tokens from free text. Deduped, returns the literal
   * `@name` form (matching what the autocomplete inserts), so a comment with
   * `"@ada @lin @ada"` collapses to `["@ada","@lin"]`.
   */
  function parseMentions(text: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    if (typeof text !== 'string' || !text) return out;
    const re = /@[\w][\w.-]*/g;
    for (const m of text.matchAll(re)) {
      const tok = m[0];
      if (!tok || seen.has(tok)) continue;
      seen.add(tok);
      out.push(tok);
    }
    return out;
  }

  function mentionsUnion(c: Comment): string[] {
    const all = [c.text, ...c.thread.map((r) => r.body)].join('\n');
    return parseMentions(all);
  }

  async function commentsAdd(payload: Partial<Comment> & { file: string; text: string }) {
    if (!payload || typeof payload.file !== 'string' || !payload.file) return null;
    if (typeof payload.text !== 'string' || !payload.text.trim()) return null;
    const list = await loadCommentsForFile(payload.file);
    const text = String(payload.text).trim().slice(0, 4000);
    const author =
      typeof payload.author === 'string' && payload.author.trim()
        ? payload.author.trim().slice(0, 120)
        : await gitCurrentUser();
    const c: Comment = {
      id: newCommentId(),
      file: payload.file,
      selector: String(payload.selector || ''),
      dom_path: Array.isArray(payload.dom_path) ? payload.dom_path.slice(0, 16) : [],
      tag: String(payload.tag || ''),
      classes: String(payload.classes || ''),
      bounds: payload.bounds ?? null,
      html_excerpt: String(payload.html_excerpt || '').slice(0, 2000),
      text,
      status: 'open',
      created: new Date().toISOString(),
      resolved_at: null,
      author,
      thread: [],
      mentions: parseMentions(text),
    };
    list.push(c);
    await saveCommentsForFile(payload.file, list);
    onCommentsChanged(payload.file);
    return c;
  }

  async function commentsAddReply(
    id: string,
    payload: { body: string; author?: string }
  ): Promise<Comment | null> {
    if (!payload || typeof payload.body !== 'string' || !payload.body.trim()) return null;
    const all = await loadAllComments();
    for (const [file, list] of Object.entries(all)) {
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) continue;
      const entry = list[i];
      if (!entry) continue;
      const body = payload.body.trim().slice(0, 4000);
      const author =
        typeof payload.author === 'string' && payload.author.trim()
          ? payload.author.trim().slice(0, 120)
          : await gitCurrentUser();
      const reply: Reply = {
        id: newReplyId(),
        author,
        body,
        created: new Date().toISOString(),
      };
      entry.thread = [...entry.thread, reply];
      entry.mentions = mentionsUnion(entry);
      await saveCommentsForFile(file, list);
      onCommentsChanged(file);
      return entry;
    }
    return null;
  }

  async function commentsPatch(id: string, patch: Partial<Comment>) {
    const all = await loadAllComments();
    for (const [file, list] of Object.entries(all)) {
      const i = list.findIndex((c) => c.id === id);
      if (i < 0) continue;
      const entry = list[i];
      if (!entry) continue;
      if (patch.status === 'resolved' || patch.status === 'open') {
        entry.status = patch.status;
        entry.resolved_at = patch.status === 'resolved' ? new Date().toISOString() : null;
      }
      if (typeof patch.text === 'string' && patch.text.trim()) {
        entry.text = patch.text.trim().slice(0, 4000);
        entry.mentions = mentionsUnion(entry);
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

  // ---------- Canvas meta sidecar (Phase 4 T5) ----------
  //
  // Each canvas under `<designRoot>/ui/<name>.tsx` has a sibling
  // `<name>.meta.json`. Phase 4 stores `layout` (per-artboard world-coord
  // rects) and `viewport` (last pan/zoom) inside that file so the canvas
  // runtime can restore state on reload. The PATCH path is intentionally
  // merge-shallow on top-level keys — never clobber `title`, `sections`,
  // `ai_context`, or any other authoring metadata.

  /**
   * Resolve `file` (a path relative to repoRoot like `.design/ui/Foo.tsx`)
   * into the absolute path of its sibling `.meta.json` sidecar. Refuses
   * paths that escape repoRoot.
   */
  function canvasMetaPath(file: string): string | null {
    let p = String(file).replace(/^\/+/, '');
    try {
      p = decodeURIComponent(p);
    } catch {
      /* ignore */
    }
    if (p.includes('..')) return null;
    const abs = path.join(paths.repoRoot, p);
    if (!abs.startsWith(`${paths.repoRoot}/`)) return null;
    const ext = path.extname(abs).toLowerCase();
    if (ext !== '.tsx' && ext !== '.html') return null;
    return abs.replace(/\.(tsx|html)$/i, '.meta.json');
  }

  async function loadCanvasMeta(file: string): Promise<Record<string, unknown> | null> {
    const metaAbs = canvasMetaPath(file);
    if (!metaAbs) return null;
    try {
      const raw = await Bun.file(metaAbs).text();
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' && !Array.isArray(obj)
        ? (obj as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Shallow-merge `patch` onto the existing meta sidecar and write back. Only
   * the Phase 4 keys `layout` + `viewport` are accepted from untrusted clients;
   * the rest of meta (title, sections, brief, ai_context, …) is preserved.
   * Returns the merged meta on success, null when the canvas has no meta or
   * the patch is rejected.
   */
  async function patchCanvasMeta(
    file: string,
    patch: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const metaAbs = canvasMetaPath(file);
    if (!metaAbs) return null;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return null;
    let current: Record<string, unknown> = {};
    try {
      const raw = await Bun.file(metaAbs).text();
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        current = parsed as Record<string, unknown>;
      }
    } catch {
      // No existing meta — create one with just the Phase 4 keys.
    }
    const next = { ...current };
    // Whitelist of patchable top-level keys.
    if (patch.layout !== undefined) {
      if (patch.layout === null) {
        next.layout = undefined;
      } else if (typeof patch.layout === 'object' && !Array.isArray(patch.layout)) {
        next.layout = patch.layout;
      }
    }
    if (patch.viewport !== undefined) {
      if (patch.viewport === null) {
        next.viewport = undefined;
      } else if (typeof patch.viewport === 'object' && !Array.isArray(patch.viewport)) {
        const v = patch.viewport as { x?: unknown; y?: unknown; zoom?: unknown };
        if (
          Number.isFinite(v.x as number) &&
          Number.isFinite(v.y as number) &&
          Number.isFinite(v.zoom as number)
        ) {
          const zoom = Math.min(4, Math.max(0.1, v.zoom as number));
          next.viewport = { x: v.x as number, y: v.y as number, zoom };
        }
      }
    }
    next.last_modified = new Date().toISOString();
    await Bun.write(metaAbs, JSON.stringify(next, null, 2));
    return next;
  }

  // ---------- Annotations sidecar (Phase 5) ----------
  //
  // Each canvas keeps a single `.annotations.svg` file under `<designRoot>/`
  // named by the canonical `fileSlug()`. The client posts the full SVG string
  // on every stroke commit; the server overwrites the file. SVG is bounded at
  // 1 MB (rejects larger bodies) — well above realistic annotation sizes for
  // hundreds of strokes but small enough that a malicious POST can't fill the
  // disk in one round-trip.

  function annotationsPath(file: string): string {
    return path.join(paths.designRoot, `${fileSlug(file)}.annotations.svg`);
  }

  async function loadAnnotations(file: string): Promise<string | null> {
    try {
      return await Bun.file(annotationsPath(file)).text();
    } catch {
      return null;
    }
  }

  async function saveAnnotations(file: string, svg: string): Promise<boolean> {
    if (typeof svg !== 'string') return false;
    if (svg.length > 1024 * 1024) return false;
    // Cheap content gate — must look like an <svg> document. Avoids accidental
    // writes of arbitrary blobs through this endpoint. The client controls the
    // content fully, so we don't try to sanitize beyond a tag check.
    if (!/^\s*<svg[\s>]/i.test(svg)) return false;
    await Bun.write(annotationsPath(file), svg);
    return true;
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
        scale: Number.isFinite(v.scale) ? Math.min(8, Math.max(0.05, v.scale as number)) : 1,
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
        // Strip `.design/` — the section header already names the parent;
        // the chain `▾ .design → file` was redundant.
        stripPrefix: `${paths.designRel}/`,
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
      // Always include canvas sidecars (`.meta.json`, `.css`, `.registry.json`)
      // so the client can nest them under their primary `.tsx` / `.html`. DS
      // groups additionally surface `.md` for README + SKILL docs.
      const filePaths = isDs
        ? await findFiles(groupAbs, groupRel, ['.tsx', '.html', '.md', '.css', '.json'])
        : await findFiles(groupAbs, groupRel, ['.tsx', '.html', '.css', '.json']);
      // Strip down to `g.path` so per-DS folders (`project`, `beta`, …) show
      // up as the top-level dirs inside the DS section. Single-DS configs get
      // a wrapper folder too — slightly more verbose, but consistent with
      // multi-DS and gives the user one click-target per DS to open its
      // SystemView.
      const matchedDs =
        g.label === 'Design system'
          ? (cfg.designSystems ?? []).filter(
              (d) => d.path === g.path || d.path.startsWith(`${g.path}/`)
            )
          : [];
      const dsFolders = matchedDs.map((d) => ({
        name: d.name,
        path: d.path,
        // Folder name relative to the group root — what the client will see as
        // a top-level dir name inside the tree.
        folder:
          d.path === g.path
            ? d.path.split('/').pop() || d.path
            : d.path.slice(g.path.length + 1).split('/')[0],
      }));
      groups.push({
        label: g.label,
        paths: filePaths,
        fullPath: groupRel,
        stripPrefix: `${paths.designRel}/${g.path}/`,
        kind: 'canvas' as const,
        dsFolders: dsFolders.length ? dsFolders : undefined,
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
        // Same as PROJECT — strip `.design/` so each row sits flat under the
        // section header instead of nested under a redundant `.design` dir.
        stripPrefix: `${paths.designRel}/`,
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

  // ---------- Export history (Phase 6.5 T10) ----------
  //
  // 5-deep ring buffer persisted at `<designRoot>/_export-history.json`.
  // Reads tolerate missing / malformed files (returns []). Writes truncate
  // to most-recent-first.

  const HISTORY_PATH = path.join(paths.designRoot, '_export-history.json');
  const HISTORY_DEPTH = 5;

  async function loadExportHistory(): Promise<ExportHistoryEntry[]> {
    try {
      const raw = await Bun.file(HISTORY_PATH).text();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.slice(0, HISTORY_DEPTH);
    } catch {
      return [];
    }
  }

  async function appendExportHistory(entry: ExportHistoryEntry): Promise<void> {
    const prev = await loadExportHistory();
    const next = [entry, ...prev].slice(0, HISTORY_DEPTH);
    await Bun.write(HISTORY_PATH, JSON.stringify(next, null, 2));
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
    for (const m of css.matchAll(re)) {
      const name = m[1]?.trim() ?? '';
      const value = m[2]?.trim() ?? '';
      const key = `${name}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push({ name, value, kind: tokenKind(name, value) });
    }
    return tokens;
  }

  /**
   * Build the System view payload.
   *
   * - When `dsName` is null/undefined, scope to the top-level system dir
   *   (`paths.systemDirRel`) and read tokens from `cfg.tokensCssRel`. This is
   *   the legacy single-DS shape every pre-DDR-048 caller sees.
   * - When `dsName` is provided, scope to the matching `designSystems[]` entry:
   *   `sysAbs`/`sysRel` point at the DS folder, `tokensAbs` reads from the
   *   per-DS `tokensCssRel` (auto-resolved by `normalizeDesignSystems`), and
   *   the previews/ui_kits galleries are restricted to that DS subtree.
   *
   * Returns `null` when `dsName` is set but not found in `cfg.designSystems` so
   * the HTTP handler can 404 instead of silently falling back.
   *
   * DDR-048 — system view renders user tokens only; the per-DS scope is what
   * keeps multi-DS projects from blending the wrong tokens into the wrong
   * preview gallery.
   */
  async function buildSystemData(dsName?: string | null) {
    let dsEntry: NonNullable<typeof cfg.designSystems>[number] | null = null;
    if (dsName) {
      dsEntry = cfg.designSystems?.find((d) => d.name === dsName) ?? null;
      if (!dsEntry) return null;
    }

    const scopedSystemRel = dsEntry ? dsEntry.path : paths.systemDirRel;
    const sysAbs = path.join(paths.designRoot, scopedSystemRel);
    const sysRel = path.posix.join(paths.designRel, scopedSystemRel);

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
    // Per-DS tokens path (auto-resolved by normalizeDesignSystems) wins; the
    // top-level cfg.tokensCssRel is a project-wide fallback for legacy
    // single-DS configs that don't declare `designSystems[]`. DDR-048.
    const tokensCssRel = dsEntry?.tokensCssRel ?? cfg.tokensCssRel;
    try {
      const tokensAbs = path.join(paths.designRoot, tokensCssRel);
      const css = await readFile(tokensAbs, 'utf8');
      tokens = parseTokens(css);
      tokensPath = path.relative(paths.repoRoot, tokensAbs);
    } catch {
      /* ignore */
    }
    const tokenGroups: Record<string, typeof tokens> = {};
    for (const t of tokens) {
      const group = tokenGroups[t.kind] ?? [];
      group.push(t);
      tokenGroups[t.kind] = group;
    }

    async function galleryFor(folderName: string) {
      const matches: { abs: string; rel: string }[] = [];
      try {
        // When scoped to a single DS (sysAbs IS the DS folder), only check
        // the DS-relative `<folderName>` subdir — scanning sub-dirs here
        // would treat the DS's own `preview/` as a sibling DS root.
        if (!dsEntry) {
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
        const files = await findFiles(m.abs, m.rel, ['.tsx', '.html']);
        for (const f of files) {
          const fname = f
            .split('/')
            .pop()
            ?.replace(/\.(tsx|html)$/i, '');
          const group = f.split('/').slice(-2, -1)[0] || folderName;
          const label = fname.toLowerCase() === 'index' ? group : fname;
          items.push({ label, path: f, group });
        }
      }
      return items;
    }

    const previewGallery = await galleryFor('preview');
    const uiKitsGallery = await galleryFor('ui_kits');

    // Always advertise the available DSes so the client can render the picker
    // even when the initial fetch was unscoped — avoids a second roundtrip.
    const availableDesignSystems = (cfg.designSystems ?? []).map((d) => ({
      name: d.name,
      path: d.path,
      description: d.description ?? null,
    }));

    return {
      project: cfg.name,
      designRoot: paths.designRel,
      systemDir: sysRel,
      ds: dsEntry
        ? {
            name: dsEntry.name,
            path: dsEntry.path,
            description: dsEntry.description ?? null,
            rootClass: dsEntry.rootClass ?? null,
            themeDefault: dsEntry.themeDefault ?? null,
          }
        : null,
      availableDesignSystems,
      defaultDesignSystem: cfg.defaultDesignSystem ?? availableDesignSystems[0]?.name ?? null,
      readme,
      readmePath,
      tokens,
      tokenGroups,
      tokensPath,
      previewGallery,
      uiKitsGallery,
      rootClass: dsEntry?.rootClass ?? cfg.rootClass,
      themeDefault: dsEntry?.themeDefault ?? cfg.themeDefault,
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
    commentsAddReply,
    gitCommitters,
    gitCurrentUser,
    parseMentions,
    loadCanvasState,
    saveCanvasState,
    loadCanvasMeta,
    patchCanvasMeta,
    loadAnnotations,
    saveAnnotations,
    buildIndexData,
    buildSystemData,
    loadExportHistory,
    appendExportHistory,
  };
}
