// JSON endpoint backers: comments, canvas state, index-data, system-data.
// Returns plain objects; http.ts wraps them in Response.json().

import crypto from 'node:crypto';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat as statp } from 'node:fs/promises';
import path from 'node:path';

import { renderBriefBoard, validateCanvasName } from './canvas-create.ts';
import { CanvasEditError, editAttribute, editText as runEditText } from './canvas-edit.ts';
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
  /** Occurrence index among `querySelectorAll(selector)` — disambiguates a
   * component repeated within one artboard. Absent on legacy comments. */
  index?: number;
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

export type CreateCanvasResult =
  | { ok: true; file: string; rel: string; slug: string }
  | { ok: false; status: number; error: string };

export type DeleteCanvasResult =
  | { ok: true; rel: string; slug: string; trashed: string[]; trashDir: string }
  | { ok: false; status: number; error: string };

/** Phase 12 — result of an in-canvas direct edit (`editCss` / `editText`). */
export type EditOpResult =
  | { ok: true; delta: number }
  | { ok: false; status: number; error: string };

export interface Api {
  // File tree
  fileSlug(file: string): string;
  loadCommentsForFile(file: string): Promise<Comment[]>;
  saveCommentsForFile(file: string, list: Comment[]): Promise<void>;
  loadAllComments(): Promise<Record<string, Comment[]>>;
  /**
   * Resolve a canvas URL slug back to its repo-relative `file` path by scanning
   * the ACTUAL canvas files under each canvas group — independent of whether the
   * canvas has any comments yet. The inverse of `fileSlug`. Returns null when no
   * canvas matches. Load-bearing for collab: a peer that has not yet received any
   * comment for a canvas must still resolve the file to MATERIALIZE the first
   * hub-pushed comment to disk (the receiving-peer projection gap, DDR-064).
   */
  fileForSlug(slug: string): Promise<string | null>;
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
  // Phase 23 — content-addressed binary image write (drag-drop / paste / picker)
  saveAsset(bytes: Uint8Array): Promise<SaveAssetResult>;
  // Create a blank brief board from the browser (Phase 22 — POST /_api/canvas)
  createCanvas(input: {
    name?: unknown;
    kind?: unknown;
    group?: unknown;
  }): Promise<CreateCanvasResult>;
  // Soft-delete a canvas from the browser (Phase 22 — DELETE /_api/canvas)
  deleteCanvas(input: { file?: unknown }): Promise<DeleteCanvasResult>;
  // Phase 12 (DDR-101) — single-property inline CSS edit (POST /_api/edit-css).
  // Main-origin only: writes one key into the element's inline `style={{}}` object.
  editCss(input: {
    canvas?: unknown;
    id?: unknown;
    property?: unknown;
    value?: unknown;
  }): Promise<EditOpResult>;
  // Phase 12 (DDR-101) — inline text-content edit (POST /_api/edit-text). Main-origin only.
  editText(input: { canvas?: unknown; id?: unknown; text?: unknown }): Promise<EditOpResult>;
  // Phase 12.2 (DDR-102) — custom HTML attribute edit (POST /_api/edit-attr). Main-origin
  // only. The CSS panel's "custom HTML attribute" escape hatch (data-*, aria-*, role, …);
  // writes a plain JSX attribute via editAttribute's non-`style.` path.
  editAttr(input: {
    canvas?: unknown;
    id?: unknown;
    attr?: unknown;
    value?: unknown;
  }): Promise<EditOpResult>;
  // Aggregate data
  buildIndexData(): Promise<unknown>;
  buildSystemData(dsName?: string | null): Promise<unknown>;
  // Export history (Phase 6.5 T10)
  loadExportHistory(): Promise<ExportHistoryEntry[]>;
  appendExportHistory(entry: ExportHistoryEntry): Promise<void>;
}

export interface ApiHooks {
  onCommentsChanged: (file: string) => void;
  /** Phase 8 Task 5 — fires after a successful PUT /_api/annotations write. */
  onAnnotationsChanged?: (file: string, svg: string) => void;
}

/**
 * Elements the annotation tool legitimately emits (`strokesToSvg` in
 * annotations-layer.tsx). This is the WHOLE vocabulary — purely presentational.
 */
const ANNOTATION_SVG_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'ellipse',
  'line',
  'polyline',
  // Phase 24 — `polygon` (diamond / triangle shape primitives + closed arrowhead
  // outlines + diamond heads) and `circle` (circle arrowhead). Inert shape
  // elements with no script capability — same safety class as the rest.
  'polygon',
  'circle',
  'text',
  // Annotation polish (item 4a) — `tspan` carries one line of multi-line text
  // inside a `<text>` (SVG `<text>` ignores `\n`). Inert presentational element
  // with no script capability — same safety class as `text`. Only `x`/`dy`
  // (geometry) survive; the attribute denylist strips any on*/style/href.
  'tspan',
  // Phase 23 — `image` (dropped/pasted raster). The ONLY element allowed to keep
  // an href, and ONLY a relative assets/<sha8>.<ext> path (ASSET_IMAGE_HREF_RE) —
  // every external / data: / javascript: / `..` href is still stripped. <image>
  // is a passive include with no script capability. See DDR (Task 9).
  'image',
]);

/**
 * Phase 23 — the ONLY href shape allowed to survive on an `<image>`: a relative,
 * single-segment `assets/<name>.<ext>` path. Anchored (`^…$`), no scheme, no `/`
 * beyond the one `assets/` segment (blocks `assets/../../etc/passwd`), no query,
 * ext ∈ the four raster types the upload route accepts. Everything else —
 * external, `data:`, `javascript:`, `..`, or any href on a non-image element —
 * is stripped by Rule 3. Pairs with the asset-write caps (DDR Task 9).
 */
export const ASSET_IMAGE_HREF_RE = /^assets\/[A-Za-z0-9._-]+\.(?:png|jpe?g|webp|gif)$/;

/** Phase 23 — hard ceiling on a single uploaded asset (10 MB). */
export const ASSET_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Phase 23 security review (DDR-088 follow-up) — aggregate per-server-instance
 * write budget for `/_api/asset`. Content-addressing dedupes IDENTICAL bytes,
 * but a one-byte mutation (a PNG `tEXt` chunk / a single pixel) yields a fresh
 * sha8 each time, so dedup is NOT a disk-fill defense. This caps total bytes a
 * single dev-server instance will ever write to `assets/` — generous for real
 * reference material, but bounds a scripted loop from the untrusted canvas
 * origin. Overridable via `MAUDE_ASSET_SESSION_BUDGET` (bytes) for power users.
 */
export const ASSET_SESSION_BUDGET = (() => {
  const env = Number(process.env.MAUDE_ASSET_SESSION_BUDGET);
  return Number.isFinite(env) && env > 0 ? env : 256 * 1024 * 1024;
})();

/**
 * Phase 23 — content-type sniff from the first bytes (magic numbers). The
 * declared name / extension / Content-Type is NEVER trusted — the bytes decide
 * the stored extension (a `.png` name carrying GIF bytes is stored as `.gif`).
 * SVG (XML/text) matches nothing here → returns null → rejected, so a
 * script-bearing vector can't ride in through the image route. See DDR (Task 9).
 */
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | null {
  const b = bytes;
  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'png';
  }
  // JPEG — FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  // GIF — "GIF87a" / "GIF89a"
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return 'gif';
  }
  // WEBP — "RIFF"????"WEBP"
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

export interface SaveAssetResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** Relative `assets/<sha8>.<ext>` path on success. */
  path?: string;
}

/**
 * A3 (DDR-060 F1 re-audit) — sanitize an annotation SVG before it is persisted /
 * synced / mirrored into the collab Y.Map. ALLOWLIST, not denylist (the F1
 * confirming pass showed a denylist loses the race: `<svg:script>` via namespace,
 * `javascript&#58;` via HTML entity, `<style>@import url()>`, CSS `url(javascript:)`
 * all slipped a tag-name denylist). Two rules, both keyed to the fixed legit
 * vocabulary so they're zero-regression on real annotations:
 *
 *   1. Element allowlist — drop the markup of any tag whose LOCAL name (namespace
 *      stripped, so `svg:script` → `script`) isn't in ANNOTATION_SVG_ELEMENTS.
 *      Dropped-tag text content survives as inert text (not in a script/style
 *      context), which is harmless.
 *   2. Attribute denylist on survivors — the legit vocabulary uses none of
 *      `on*=`, `style=`, or any `href`, so stripping them closes inline handlers,
 *      CSS `url(javascript:)`, and entity-encoded `xlink:href` in one pass.
 *
 * The current consumer (`svgToStrokes` → DOMParser image/svg+xml → structured
 * strokes → React) never raw-renders this string, so the live XSS risk is already
 * nil; this keeps "inert" TRUE for any future raw-render consumer and for the
 * synced file a peer / Claude-context ingests (defense-in-depth, DDR-054 §3).
 */
export function sanitizeAnnotationSvg(svg: string): string {
  // Phase 23 — <image> href handling. Rule 3 below strips EVERY href (that's the
  // zero-bypass invariant). To let a legit assets/ href survive WITHOUT
  // re-opening the denylist race, we (a) neutralize any input-supplied marker so
  // only this pre-pass can mint one, (b) on `<image>` ONLY, hoist a regex-valid
  // assets href into a sanitizer-inert `data-mdcc-asset` marker (an external /
  // data: / `..` / non-image href is left as a plain href → stripped by Rule 3),
  // then (c) after the three rules, restore the marker back to `href` — but ONLY
  // after RE-validating the value, so a forged marker can never smuggle a
  // scheme/traversal back in. The restored value is, by construction, a safe
  // same-origin path. See ASSET_IMAGE_HREF_RE + DDR (Task 9).
  const hoisted = svg
    .replace(/\sdata-mdcc-asset\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\s*(?:[\w-]+:)?image\b[^>]*>/gi, (tag) => {
      const m = tag.match(/(?:xlink:)?href\s*=\s*"([^"]*)"|(?:xlink:)?href\s*=\s*'([^']*)'/i);
      const val = m ? (m[1] ?? m[2] ?? '') : '';
      if (!val || !ASSET_IMAGE_HREF_RE.test(val)) return tag;
      return tag.replace(/(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*')/i, `data-mdcc-asset="${val}"`);
    });
  const cleaned = hoisted
    // 1. Remove the CONTENT of executable / instruction-bearing elements (not
    //    just their tags) so an injected script body / `@import` / prompt-
    //    injection string can't survive as inert text a future raw-renderer or
    //    Claude-context read might act on. Namespace-tolerant (`svg:script`),
    //    non-greedy to the first matching dangerous close tag.
    .replace(
      /<\s*(?:[\w-]+:)?(?:script|style|foreignObject|title|desc)\b[\s\S]*?<\s*\/\s*(?:[\w-]+:)?(?:script|style|foreignObject|title|desc)\s*>/gi,
      ''
    )
    // 2. Element allowlist — drop the markup of any tag whose LOCAL name isn't
    //    in the fixed annotation vocabulary. `[^>]*` stops at the first `>`;
    //    annotation attrs never contain a literal `>`.
    .replace(/<\/?\s*([a-zA-Z][\w:-]*)\b[^>]*>/g, (match, rawName: string) => {
      const local = String(rawName).split(':').pop()?.toLowerCase() ?? '';
      return ANNOTATION_SVG_ELEMENTS.has(local) ? match : '';
    })
    // 3. Attribute denylist on the surviving allowlisted elements — the legit
    //    vocabulary uses no on*= / style= / *href=, so stripping them closes
    //    inline handlers, CSS url(javascript:), and entity-encoded hrefs.
    //    The leading boundary is a LOOKBEHIND on whitespace / quote / slash
    //    (not a consumed `\s`) so a handler glued to the previous attribute's
    //    closing quote — `<circle r="2"onload="…"/>`, which HTML/SVG parsers
    //    accept as a distinct attribute — is also stripped (Phase 24 security
    //    review, DDR-067). The non-consuming lookbehind leaves the preceding
    //    quote intact so the legit attribute it belonged to survives.
    .replace(
      /(?<=[\s"'/])(?:on[a-z]+|style|(?:[\w-]+:)?href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      ''
    );
  // Post-pass — restore the validated assets href on <image>. Re-validate the
  // marker value (defense-in-depth: a forged data-mdcc-asset can only resolve to
  // a safe same-origin assets path; anything with a scheme/traversal is dropped).
  return cleaned.replace(/\sdata-mdcc-asset\s*=\s*"([^"]*)"/gi, (_whole, val: string) =>
    ASSET_IMAGE_HREF_RE.test(val) ? ` href="${val}"` : ''
  );
}

export function createApi(ctx: Context, hooks: ApiHooks): Api {
  const onCommentsChanged = hooks.onCommentsChanged;
  const onAnnotationsChanged = hooks.onAnnotationsChanged;
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

  async function fileForSlug(slug: string): Promise<string | null> {
    // Authoritative slug → canvas-file resolver: enumerate the real canvas
    // files under each canvas group and match by the canonical slug. Unlike a
    // comments-file scan, this resolves even when the canvas has NO comments yet
    // — the fix for the receiving-peer projection gap where a fresh peer could
    // not locate the file to write the first hub-pushed comment (DDR-064).
    for (const g of cfg.canvasGroups) {
      const groupAbs = path.join(paths.designRoot, g.path);
      const groupRel = path.posix.join(paths.designRel, g.path);
      let files: string[];
      try {
        files = await findHtmlFiles(groupAbs, groupRel);
      } catch {
        continue;
      }
      for (const rel of files) {
        if (fileSlug(rel) === slug) return rel;
      }
    }
    return null;
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
      index: typeof payload.index === 'number' ? payload.index : undefined,
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
    // writes of arbitrary blobs through this endpoint.
    if (!/^\s*<svg[\s>]/i.test(svg)) return false;
    // A3 (DDR-060 F1 re-audit) — sanitize active content before persisting.
    // This endpoint is on the canvas-origin allowlist (DDR-054 "inert collab
    // write") and accepts ANY `file`, so a hub-pushed canvas can write a
    // sibling's `.annotations.svg`. The persisted SVG is currently consumed only
    // via `svgToStrokes` (DOMParser image/svg+xml → structured strokes → React
    // re-render), so a `<script>`/`on*` payload is parsed inertly and discarded
    // — the stored-XSS chain is LATENT today, not live. We sanitize anyway so
    // "inert" stays true for any future raw-render consumer and for the synced
    // file a peer/Claude-context ingests. The legit annotation vocabulary
    // (strokesToSvg) is purely presentational — path/rect/ellipse/g/line/
    // polyline/text — so stripping executable constructs is zero-regression.
    const clean = sanitizeAnnotationSvg(svg);
    await Bun.write(annotationsPath(file), clean);
    onAnnotationsChanged?.(file, clean);
    return true;
  }

  // Phase 23 — content-addressed asset write. Reachable from the (potentially
  // untrusted, DDR-054) canvas origin, so every cap is load-bearing, NOT
  // optional (DDR Task 9):
  //   • magic-byte sniff → true type ∈ {png,jpg,gif,webp}; a header lie or an
  //     SVG (script-bearing vector) is rejected — bytes decide, name is ignored.
  //   • ≤ 10 MB ceiling (assets get their OWN cap; never routed through the 1 MB
  //     SVG-text gate in saveAnnotations).
  //   • content-addressed name `assets/<sha8-of-bytes>.<ext>` → identical drops
  //     dedupe → a malicious canvas can't fill the disk with N copies of one
  //     image, and orphan-on-delete is safe (shared content survives).
  //   • resolved-path containment assert (defense-in-depth; the name carries no
  //     user input, but a poisoned designRoot must still not escape).
  // Running total of bytes this server instance has actually written (post-dedupe).
  let assetBytesWritten = 0;
  async function saveAsset(bytes: Uint8Array): Promise<SaveAssetResult> {
    if (!bytes || bytes.length === 0) return { ok: false, status: 400, error: 'empty body' };
    if (bytes.length > ASSET_MAX_BYTES) {
      return { ok: false, status: 413, error: 'asset exceeds the 10 MB cap' };
    }
    const kind = sniffImageType(bytes);
    if (!kind) {
      return {
        ok: false,
        status: 415,
        error: 'unsupported image type — png/jpeg/gif/webp only (SVG rejected)',
      };
    }
    const sha8 = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
    const name = `${sha8}.${kind}`;
    const assetsDir = path.join(paths.designRoot, 'assets');
    const fileAbs = path.join(assetsDir, name);
    // Containment backstop — the name is content-addressed (sha8 hex + sniffed
    // ext), so there is no user-controlled path segment, but assert anyway.
    const resolved = path.resolve(fileAbs);
    const assetsResolved = path.resolve(assetsDir);
    if (resolved !== path.join(assetsResolved, name)) {
      return { ok: false, status: 400, error: 'resolved asset path escapes assets dir' };
    }
    try {
      // Dedupe — identical bytes hash to the same name; skip the write if present.
      if (!(await Bun.file(fileAbs).exists())) {
        // Aggregate write budget (DDR-088 follow-up) — bounds a scripted
        // one-byte-mutation disk-fill loop from the untrusted canvas origin.
        // Only a genuinely NEW file counts (a dedupe hit is free).
        if (assetBytesWritten + bytes.length > ASSET_SESSION_BUDGET) {
          return {
            ok: false,
            status: 429,
            error: 'asset write budget exceeded for this server session',
          };
        }
        await mkdir(assetsDir, { recursive: true });
        await Bun.write(fileAbs, bytes);
        assetBytesWritten += bytes.length;
      }
    } catch (err) {
      return { ok: false, status: 500, error: err instanceof Error ? err.message : 'write failed' };
    }
    return { ok: true, path: `assets/${name}` };
  }

  // Phase 22 — create a blank brief board from the browser file tree. Wired ONLY
  // on the main origin (server.ts startMainServer); the segregated canvas origin
  // (DDR-054) never exposes this — an untrusted canvas iframe must not be able to
  // write arbitrary `.tsx` files. The single user-controlled value (`name`) is
  // gated by `validateCanvasName` (path + JSX + JSON injection boundary); `group`
  // is allowlisted to the configured canvas groups; a `resolve()` containment
  // assert is the defense-in-depth backstop.
  async function createCanvas(input: {
    name?: unknown;
    kind?: unknown;
    group?: unknown;
  }): Promise<CreateCanvasResult> {
    // v1 only stamps blank boards — generation stays with `/design:new` (Claude).
    const kind = input.kind == null || input.kind === '' ? 'brief-board' : input.kind;
    if (kind !== 'brief-board') {
      return { ok: false, status: 400, error: 'only kind "brief-board" is supported' };
    }
    const v = validateCanvasName(input.name);
    if (!v.ok || !v.name || !v.componentName) {
      return { ok: false, status: 400, error: v.error ?? 'invalid name' };
    }

    // Group must be one of the configured canvas groups (+ the new-canvas dir).
    const allowed = new Set<string>(cfg.canvasGroups.map((g) => g.path));
    allowed.add(cfg.newCanvasDir || 'ui');
    const group =
      input.group == null || input.group === '' ? cfg.newCanvasDir || 'ui' : String(input.group);
    if (!allowed.has(group)) {
      return { ok: false, status: 400, error: `group must be one of: ${[...allowed].join(', ')}` };
    }

    const groupAbs = path.join(paths.designRoot, group);
    const fileAbs = path.join(groupAbs, `${v.name}.tsx`);
    // Containment backstop, two layers (Phase 22 security review F2). The name
    // regex already forbids traversal, but `group` comes from config
    // (canvasGroups[].path / newCanvasDir), which `normalizeConfig` does NOT
    // validate for `..`. So assert (1) the GROUP resolves inside designRoot —
    // a config-supplied `../../etc` must not relocate the write out of the
    // project — and (2) the file resolves inside that group. Without (1) a
    // poisoned config would be an arbitrary-directory `.tsx` write (latent today
    // because config isn't sync-scoped; closed now so a future config-sync can't
    // re-open it).
    const resolvedDesignRoot = path.resolve(paths.designRoot);
    const resolvedGroup = path.resolve(groupAbs);
    if (
      resolvedGroup !== resolvedDesignRoot &&
      !resolvedGroup.startsWith(`${resolvedDesignRoot}${path.sep}`)
    ) {
      return { ok: false, status: 400, error: 'canvas group resolves outside the design root' };
    }
    if (
      path.resolve(fileAbs) !== path.join(resolvedGroup, `${v.name}.tsx`) ||
      !path.resolve(fileAbs).startsWith(`${resolvedGroup}${path.sep}`)
    ) {
      return { ok: false, status: 400, error: 'resolved path escapes the canvas group' };
    }
    if (await Bun.file(fileAbs).exists()) {
      return {
        ok: false,
        status: 409,
        error: `a canvas named "${v.name}" already exists in ${group}`,
      };
    }

    const rel = path.posix.join(group, `${v.name}.tsx`);
    const slug = fileSlug(rel);
    const dsName = cfg.defaultDesignSystem || 'project';
    const platform = 'desktop';
    const tsx = renderBriefBoard({
      name: v.name,
      componentName: v.componentName,
      dsName,
      platform,
      seedHint: 'Empty brief board — annotate me',
      historyDir: path.posix.join(paths.designRel, '_history', slug),
    });
    const now = new Date().toISOString();
    const meta = {
      kind: 'brief-board',
      title: v.name,
      subtitle: 'brief board',
      brief: v.name,
      designSystem: dsName,
      platform,
      created: now,
      last_modified: now,
    };
    await Bun.write(fileAbs, tsx);
    await Bun.write(
      path.join(groupAbs, `${v.name}.meta.json`),
      `${JSON.stringify(meta, null, 2)}\n`
    );
    // designRel-prefixed path — matches the file-tree `file.path` shape so the
    // client can open it directly after reloadTree().
    return { ok: true, file: path.posix.join(paths.designRel, rel), rel, slug };
  }

  // Phase 22 — SOFT-delete a canvas (DELETE /_api/canvas). Same trust boundary as
  // createCanvas: main-origin-only, never the untrusted canvas iframe origin
  // (DDR-054). Destructive, so it MOVES the whole sidecar set to
  // `<designRoot>/_trash/<stamp>__<slug>/` (recoverable locally) instead of a hard
  // rm — pairs with the existing `_history/` + /design:rollback model. Hub
  // propagation of the delete is deliberately out of scope (Phase 26 consent).
  async function deleteCanvas(input: { file?: unknown }): Promise<DeleteCanvasResult> {
    const raw = input?.file;
    if (typeof raw !== 'string' || !raw.trim()) {
      return { ok: false, status: 400, error: 'file is required' };
    }
    let rel = raw.trim();
    try {
      rel = decodeURIComponent(rel);
    } catch {
      /* leave as-is */
    }
    rel = rel.replace(/^\/+/, '');
    const prefix = `${paths.designRel.replace(/^\/+|\/+$/g, '')}/`;
    if (rel.startsWith(prefix)) rel = rel.slice(prefix.length);

    // Only a real `.tsx` canvas, no traversal.
    if (rel.includes('..')) return { ok: false, status: 400, error: 'invalid path' };
    if (!/\.tsx$/i.test(rel)) {
      return { ok: false, status: 400, error: 'only .tsx canvases can be deleted' };
    }

    const fileAbs = path.join(paths.designRoot, rel);
    const resolvedDesignRoot = path.resolve(paths.designRoot);
    const resolvedFile = path.resolve(fileAbs);
    if (
      resolvedFile !== resolvedDesignRoot &&
      !resolvedFile.startsWith(`${resolvedDesignRoot}${path.sep}`)
    ) {
      return { ok: false, status: 400, error: 'path escapes the design root' };
    }

    // Must live under a NON-DS canvas group — never the design system (`system`),
    // never a loose root file (config.json, README). Deleting DS sources is not a
    // canvas operation.
    const deletable = cfg.canvasGroups.filter(
      (g) => g.label !== 'Design system' && !/^system(\/|$)/.test(g.path)
    );
    const inGroup = deletable.some((g) => {
      const gAbs = path.resolve(path.join(paths.designRoot, g.path));
      return resolvedFile.startsWith(`${gAbs}${path.sep}`);
    });
    if (!inGroup) {
      return {
        ok: false,
        status: 400,
        error: 'only canvases under a managed canvas group can be deleted',
      };
    }

    if (!(await Bun.file(fileAbs).exists())) {
      return { ok: false, status: 404, error: 'canvas not found' };
    }

    const slug = fileSlug(rel);
    const base = path.basename(rel).replace(/\.tsx$/i, '');
    const groupDir = path.dirname(fileAbs);
    // Filesystem-safe wall-clock stamp (no `:`) so repeated deletes of the same
    // canvas don't collide in _trash.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const trashDir = path.join(paths.designRoot, '_trash', `${stamp}__${slug}`);
    await mkdir(trashDir, { recursive: true });

    const trashed: string[] = [];
    const moveIfExists = async (src: string, destName: string) => {
      try {
        await statp(src); // throws if absent (works for files AND dirs)
      } catch {
        return;
      }
      try {
        await rename(src, path.join(trashDir, destName));
        trashed.push(path.relative(paths.designRoot, src));
      } catch {
        /* best-effort — a sidecar that can't move shouldn't abort the delete */
      }
    };

    // Primary + the full sidecar set (annotations, meta, history, canvas-state,
    // comments). Flattened names so the trash dir is a self-contained bundle.
    await moveIfExists(fileAbs, `${base}.tsx`);
    await moveIfExists(path.join(groupDir, `${base}.meta.json`), `${base}.meta.json`);
    await moveIfExists(
      path.join(paths.designRoot, `${slug}.annotations.svg`),
      `${slug}.annotations.svg`
    );
    await moveIfExists(path.join(paths.designRoot, '_history', slug), `_history__${slug}`);
    await moveIfExists(
      path.join(paths.canvasStateDir, `${slug}.json`),
      `_canvas-state__${slug}.json`
    );
    await moveIfExists(path.join(paths.commentsDir, `${slug}.json`), `_comments__${slug}.json`);

    await Bun.write(
      path.join(trashDir, '_trash-manifest.json'),
      `${JSON.stringify({ canvas: rel, slug, deletedAt: new Date().toISOString(), trashed }, null, 2)}\n`
    );

    return {
      ok: true,
      rel,
      slug,
      trashed,
      trashDir: path.relative(paths.repoRoot, trashDir),
    };
  }

  // Phase 12 (DDR-101) — resolve a v2 canvas slug (`selected.canvas`: POSIX,
  // extension-less, designRoot-relative — matches `_locator.json` keys + the
  // `canvasSlug()` shape) to its absolute `.tsx` path, with a containment
  // backstop. Same main-origin-only trust boundary as createCanvas: the
  // untrusted canvas iframe origin never reaches a source-write endpoint.
  function resolveCanvasAbs(
    slugRaw: unknown
  ): { ok: true; abs: string } | { ok: false; status: number; error: string } {
    if (typeof slugRaw !== 'string' || !slugRaw.trim()) {
      return { ok: false, status: 400, error: 'canvas (slug) required' };
    }
    let slug = slugRaw.replace(/^\/+|\/+$/g, '').replace(/\.(tsx|html)$/i, '');
    // Accept either the bare slug (`ui/Foo`) or the designRel-prefixed file path
    // the client `selected.file` carries (`.design/ui/Foo.tsx`) — strip a leading
    // designRel so both shapes resolve to the same canvas (mirrors deriveCanvasSlug).
    const dr = paths.designRel.replace(/^\.\//, '').replace(/^\/+|\/+$/g, '');
    if (dr && slug.startsWith(`${dr}/`)) slug = slug.slice(dr.length + 1);
    if (
      !slug ||
      path.isAbsolute(slug) ||
      slug.split('/').some((seg) => seg === '..' || seg === '.' || seg === '')
    ) {
      return { ok: false, status: 400, error: 'invalid canvas slug' };
    }
    const abs = `${path.join(paths.designRoot, ...slug.split('/'))}.tsx`;
    const resolvedRoot = path.resolve(paths.designRoot);
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
      return { ok: false, status: 400, error: 'canvas resolves outside the design root' };
    }
    return { ok: true, abs };
  }

  // 8-hex lowercase, the shape `computeId` (canvas-edit.ts) stamps on data-cd-id.
  const CD_ID_RE = /^[0-9a-f]{8}$/;

  async function editCss(input: {
    canvas?: unknown;
    id?: unknown;
    property?: unknown;
    value?: unknown;
  }): Promise<EditOpResult> {
    const r = resolveCanvasAbs(input.canvas);
    if (!r.ok) return r;
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    if (!CD_ID_RE.test(id)) return { ok: false, status: 400, error: 'invalid data-cd-id' };
    const property = typeof input.property === 'string' ? input.property.trim() : '';
    // CSS property names are ASCII letters + hyphens only (optionally a leading
    // `-` for vendor prefixes) — reject anything that could smuggle a second key
    // or an expression into the inline style object.
    if (!property || !/^-?[a-z][a-z-]*$/.test(property)) {
      return { ok: false, status: 400, error: 'invalid css property' };
    }
    const value = typeof input.value === 'string' ? input.value : '';
    if (!value.trim()) return { ok: false, status: 400, error: 'value required' };
    if (value.length > 256) return { ok: false, status: 413, error: 'value too long' };
    // kebab → camelCase JSX style key. The value is always written as a JS STRING
    // literal: JSON.stringify escapes quotes/backslashes/newlines so it can never
    // break out of the string, and React accepts string values for every style
    // prop — so `var(--accent)`, `#fff`, `8px`, `700`, `1.5` all ride verbatim.
    const camel = property.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    try {
      const res = await editAttribute(r.abs, id, `style.${camel}`, JSON.stringify(value));
      return { ok: true, delta: res.delta };
    } catch (err) {
      return {
        ok: false,
        status: 422,
        error: err instanceof CanvasEditError ? err.message : 'edit failed',
      };
    }
  }

  async function editText(input: {
    canvas?: unknown;
    id?: unknown;
    text?: unknown;
  }): Promise<EditOpResult> {
    const r = resolveCanvasAbs(input.canvas);
    if (!r.ok) return r;
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    if (!CD_ID_RE.test(id)) return { ok: false, status: 400, error: 'invalid data-cd-id' };
    if (typeof input.text !== 'string') return { ok: false, status: 400, error: 'text required' };
    if (input.text.length > 5000) return { ok: false, status: 413, error: 'text too long' };
    try {
      const res = await runEditText(r.abs, id, input.text);
      return { ok: true, delta: res.delta };
    } catch (err) {
      return {
        ok: false,
        status: 422,
        error: err instanceof CanvasEditError ? err.message : 'edit failed',
      };
    }
  }

  async function editAttr(input: {
    canvas?: unknown;
    id?: unknown;
    attr?: unknown;
    value?: unknown;
  }): Promise<EditOpResult> {
    const r = resolveCanvasAbs(input.canvas);
    if (!r.ok) return r;
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    if (!CD_ID_RE.test(id)) return { ok: false, status: 400, error: 'invalid data-cd-id' };
    const attr = typeof input.attr === 'string' ? input.attr.trim() : '';
    // Plain HTML attributes only — data-*, aria-*, role, title, id, lang, dir…
    // Reject `style*` (that's /_api/edit-css), `data-cd-id` (pipeline-owned, also
    // refused downstream by editAttribute), and anything that isn't a bare html
    // attribute name. Digits allowed mid-name (e.g. data-2x).
    if (
      !attr ||
      !/^[a-z][a-z0-9-]*$/.test(attr) ||
      attr === 'data-cd-id' ||
      attr.startsWith('style')
    ) {
      return { ok: false, status: 400, error: 'invalid attribute' };
    }
    const value = typeof input.value === 'string' ? input.value : '';
    if (!value.trim()) return { ok: false, status: 400, error: 'value required' };
    if (value.length > 256) return { ok: false, status: 413, error: 'value too long' };
    try {
      // Non-`style.` attr name → editAttribute writes a plain quoted JSX attribute
      // (editStringAttr). JSON.stringify keeps the value a safe string literal.
      const res = await editAttribute(r.abs, id, attr, JSON.stringify(value));
      return { ok: true, delta: res.delta };
    } catch (err) {
      return {
        ok: false,
        status: 422,
        error: err instanceof CanvasEditError ? err.message : 'edit failed',
      };
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
        scale: Number.isFinite(v.scale) ? Math.min(8, Math.max(0.05, v.scale as number)) : 1,
      };
    }
    await Bun.write(canvasStatePath(file), JSON.stringify(safe, null, 2));
  }

  // ---------- Index data + System data ----------

  async function buildIndexData() {
    const groups = [];

    // DDR-093 — per-canvas design-system map (repo-relative canvas path → DS
    // name) so the client's canvasUrl() injects each UI canvas's OWN tokens
    // instead of unconditionally designSystems[0]. Populated from the canvas
    // groups below; returned on the payload and folded into the client cfg.
    const canvasDesignSystems: Record<string, string> = {};
    const defaultDs = cfg.defaultDesignSystem || cfg.designSystems?.[0]?.name || 'project';
    // A file under `system/<folder>/` belongs to the DS that owns that folder —
    // path-authoritative, because specimens/ui_kits rarely carry a sidecar
    // `designSystem`. Returns null for `ui/` canvases (resolved via sidecar).
    const ownerDsName = (repoRelPath: string): string | null => {
      let r = repoRelPath;
      const prefix = `${paths.designRel}/`;
      if (r.startsWith(prefix)) r = r.slice(prefix.length);
      const m = r.match(/^system\/([^/]+)\//);
      if (!m) return null;
      const folder = m[1];
      const owner = (cfg.designSystems ?? []).find(
        (d) => d.path === `system/${folder}` || d.path.endsWith(`/${folder}`)
      );
      return owner?.name ?? null;
    };

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
      // DDR-093 — record each `.tsx` canvas's design system. canvasUrl() only
      // injects tokens for `.tsx`, so skip everything else. Path-owned DS wins
      // (system/<ds>/…); otherwise the sidecar's `meta.designSystem`, defaulting
      // to the project default when the canvas declares none.
      for (const fp of filePaths) {
        if (!fp.endsWith('.tsx')) continue;
        let dsName = ownerDsName(fp);
        if (!dsName) {
          const meta = await loadCanvasMeta(fp);
          const declared = meta?.designSystem;
          dsName = typeof declared === 'string' && declared.trim() ? declared : defaultDs;
        }
        canvasDesignSystems[fp] = dsName;
      }
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
      canvasDesignSystems,
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
    fileForSlug,
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
    saveAsset,
    createCanvas,
    deleteCanvas,
    editCss,
    editText,
    editAttr,
    buildIndexData,
    buildSystemData,
    loadExportHistory,
    appendExportHistory,
  };
}
