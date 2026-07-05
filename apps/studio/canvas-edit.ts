// AST-aware single-element edits for the `/design:edit` Step 3a fast path
// (DDR-019, Phase 3.6 Task 5).
//
// Caller hands us (canvasAbsPath, dataCdId, attr, value); we parse the TSX,
// re-walk it with the same component/jsxIndex bookkeeping as canvas-pipeline.ts,
// find the JSX element whose ID matches, and rewrite a single attribute via
// magic-string. The two-pass-transform contract (DDR-019) is the only thing
// that keeps source-DOM identity stable across edits — so the editor lives
// next to the transpiler and shares its toolchain (oxc-parser + magic-string).
//
// Supported `attr` syntaxes:
//   - "className"         → swap the value of the `className` JSX attribute
//                           (insert one if missing). Value form: bare string.
//   - "style.<prop>"      → swap (or insert) a single CSS-property key inside
//                           the inline `style={{ ... }}` object. Value form:
//                           literal text inserted between `:` and `,` — pass a
//                           JS expression (string with quotes for strings, raw
//                           number for numbers).
//   - "<any other name>"  → swap (or insert) the value of a plain string
//                           attribute (aria-label, role, title, ...).
//
// All edits preserve every other attribute byte-for-byte. The `data-cd-id`
// attribute is intentionally NOT writable through this path — the pipeline
// owns those.
//
// Concurrent edits against the same canvas serialise behind a per-file mutex
// (matches the locator.ts pattern). Two parallel edits against different
// canvases run in parallel.

import { mkdir, open, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import MagicString from 'magic-string';
import { parseSync } from 'oxc-parser';

export class CanvasEditError extends Error {
  readonly canvas: string;
  readonly id: string;
  constructor(message: string, info: { canvas: string; id: string }) {
    super(message);
    this.name = 'CanvasEditError';
    this.canvas = info.canvas;
    this.id = info.id;
  }
}

const PASCAL_CASE = /^[A-Z][A-Za-z0-9_]*$/;
// biome-ignore lint/suspicious/noExplicitAny: oxc-parser AST nodes are heterogeneous.
type AnyNode = any;

function isPascalIdent(name: unknown): name is string {
  return typeof name === 'string' && PASCAL_CASE.test(name);
}

function componentNameOf(node: AnyNode): string | null {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'FunctionDeclaration' && isPascalIdent(node.id?.name)) return node.id.name;
  if (node.type === 'VariableDeclarator' && isPascalIdent(node.id?.name)) {
    const init = node.init;
    if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
      return node.id.name;
    }
  }
  if (node.type === 'FunctionExpression' && isPascalIdent(node.id?.name)) return node.id.name;
  return null;
}

function computeId(componentName: string, idx: number): string {
  return Bun.hash(`${componentName}:${idx}`).toString(16).padStart(16, '0').slice(0, 8);
}

interface OpeningHit {
  opening: AnyNode;
  /** The full JSXElement node — `editText` needs `.children` (JSXText), not just the opening tag. */
  element: AnyNode;
}

/**
 * Find the openingElement of the JSX element whose pipeline-computed ID matches
 * `targetId`. Walks pre-order with the same component+jsxIndex bookkeeping the
 * pipeline uses, so the ID arithmetic stays in lockstep. Returns null if no
 * match.
 */
function findOpening(program: AnyNode, targetId: string): OpeningHit | null {
  interface Frame {
    componentName: string;
    jsxIndex: number;
  }
  const stack: Frame[] = [{ componentName: '', jsxIndex: 0 }];
  let hit: OpeningHit | null = null;

  function visit(node: AnyNode): void {
    if (hit || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const c of node) {
        if (hit) return;
        visit(c);
      }
      return;
    }
    if (typeof node.type !== 'string') return;

    const newComp = componentNameOf(node);
    let pushed = false;
    if (newComp !== null) {
      stack.push({ componentName: newComp, jsxIndex: 0 });
      pushed = true;
    }

    if (node.type === 'JSXElement') {
      const frame = stack[stack.length - 1] as Frame;
      const idx = frame.jsxIndex;
      frame.jsxIndex += 1;
      const id = computeId(frame.componentName, idx);
      if (id === targetId) {
        hit = { opening: node.openingElement, element: node };
      }
      if (!hit) {
        if (node.openingElement) visit(node.openingElement.attributes);
        visit(node.children);
      }
      if (pushed) stack.pop();
      return;
    }

    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      visit(node[k]);
    }

    if (pushed) stack.pop();
  }

  visit(program);
  return hit;
}

function findAttribute(opening: AnyNode, name: string): AnyNode | null {
  const attrs = opening?.attributes;
  if (!Array.isArray(attrs)) return null;
  for (const a of attrs) {
    if (a?.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier' && a.name.name === name) {
      return a;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-canvas mutex — TWO layers (DDR-150 P2). (1) An in-process Promise chain
// serialises edits within THIS process (fast). (2) A cross-process advisory
// lockfile serialises against edits from ANOTHER process — the `/design:edit`
// CLI (`import.meta.main` below) or the HMR file-watcher — so their
// read-modify-write can't interleave with ours and lose an update (the in-
// process `locks` Map alone couldn't see them). The lockfile lives in the OS
// temp dir (NOT the versioned design root — never touches the gitignore
// taxonomy) keyed by the canvas absolute path. A crashed holder leaves a STALE
// lock, stolen after LOCK_STALE_MS; if it stays contended past LOCK_MAX_WAIT_MS
// we proceed anyway rather than deadlock — the atomic tmp-rename write + the
// content-hash fingerprint are the backstop against a truly simultaneous writer.

const LOCK_DIR = path.join(tmpdir(), 'maude-locks');
const LOCK_STALE_MS = 15_000;
const LOCK_POLL_MS = 25;
const LOCK_MAX_WAIT_MS = 10_000;

/** OS-temp lockfile path for a canvas (shared across processes; keyed by abs path). */
export function lockPathFor(filePath: string): string {
  return path.join(LOCK_DIR, `${Bun.hash(filePath).toString(16).padStart(16, '0')}.lock`);
}

/**
 * Acquire the cross-process advisory lock for `filePath`; resolves to an
 * idempotent release fn. Exported for tests. Degrades to a no-op lock (rather
 * than breaking every edit) if the temp dir is unwritable or contention outlasts
 * LOCK_MAX_WAIT_MS.
 */
export async function acquireFileLock(filePath: string): Promise<() => Promise<void>> {
  const lp = lockPathFor(filePath);
  await mkdir(LOCK_DIR, { recursive: true }).catch(() => {});
  const start = Date.now();
  for (;;) {
    try {
      const fh = await open(lp, 'wx'); // O_CREAT | O_EXCL — fails if already held
      await fh.writeFile(`${process.pid} ${Date.now()}`);
      await fh.close();
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await unlink(lp).catch(() => {});
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        return async () => {}; // can't create a lockfile at all → in-process-only
      }
      try {
        const st = await stat(lp);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          await unlink(lp).catch(() => {}); // holder crashed — steal
          continue;
        }
      } catch {
        continue; // vanished between EEXIST and stat — retry the create
      }
      if (Date.now() - start > LOCK_MAX_WAIT_MS) return async () => {}; // don't deadlock
      await new Promise((r) => setTimeout(r, LOCK_POLL_MS));
    }
  }
}

const locks = new Map<string, Promise<void>>();
function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(filePath) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  const next = prev.then(() => gate);
  locks.set(filePath, next);
  return prev
    .then(async () => {
      // In-process calls are already serialised by the chain above, so only ONE
      // local call ever contends the lockfile — cross-process is its only job.
      const releaseFile = await acquireFileLock(filePath);
      try {
        return await fn();
      } finally {
        await releaseFile();
      }
    })
    .finally(() => {
      release();
      if (locks.get(filePath) === next) locks.delete(filePath);
    });
}

// ---------------------------------------------------------------------------
// Public API.

export interface EditResult {
  /** The post-edit source (also written to disk by editAttribute()). */
  source: string;
  /** Number of bytes the edit changed (positive = grew, negative = shrunk). */
  delta: number;
  /**
   * Whether a disk write actually happened. Set by the disk-op wrappers only
   * (pure apply* variants leave it undefined). Callers must NOT infer this from
   * `delta` — an equal-length replacement (e.g. text "Alpha" → "Gamma") is a
   * real write with delta 0 (RC1 rim-suppression finding).
   */
  changed?: boolean;
}

/**
 * Apply a single-attribute edit to the JSX element with the given `data-cd-id`.
 * Reads the canvas, rewrites in memory, writes atomically (via Bun.write to a
 * tmp + rename) so a concurrent reader never sees a partial file.
 */
export async function editAttribute(
  canvasAbsPath: string,
  id: string,
  attr: string,
  value: string
): Promise<EditResult> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id,
      });
    }
    const source = await file.text();
    const next = applyEdit(canvasAbsPath, source, id, attr, value);
    if (next.source === source) return { source, delta: 0, changed: false };
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return { ...next, changed: true };
  });
}

/**
 * Remove an attribute (or one inline-style property) from the element with the
 * given `data-cd-id` — the "reset to original" path (Phase 12.3). `attr` follows
 * the same shape as `editAttribute`: `style.<camelOrKebab>` removes one inline
 * style key (dropping the whole `style={{}}` when it was the last key); any other
 * name removes that plain JSX attribute. A missing key/attribute is a no-op
 * (delta 0), never an error. Same atomic write + per-file lock as `editAttribute`.
 */
export async function removeAttribute(
  canvasAbsPath: string,
  id: string,
  attr: string
): Promise<EditResult> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id,
      });
    }
    const source = await file.text();
    const next = applyRemove(canvasAbsPath, source, id, attr);
    if (next.source === source) return { source, delta: 0, changed: false };
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return { ...next, changed: true };
  });
}

/** Pure variant of `removeAttribute` — exposed for tests. */
export function applyRemove(
  canvasAbsPath: string,
  source: string,
  id: string,
  attr: string
): EditResult {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new CanvasEditError(
      `oxc-parser failed on ${canvasAbsPath}: ${first?.message ?? 'unknown'}`,
      {
        canvas: canvasAbsPath,
        id,
      }
    );
  }
  const hit = findOpening(parsed.program, id);
  if (!hit) {
    throw new CanvasEditError(`data-cd-id "${id}" not found in ${canvasAbsPath}`, {
      canvas: canvasAbsPath,
      id,
    });
  }
  const s = new MagicString(source);
  if (attr.startsWith('style.')) {
    removeStyleProp(s, hit.opening, attr.slice('style.'.length), source);
  } else if (attr === 'data-cd-id') {
    throw new CanvasEditError('data-cd-id is owned by the pipeline; cannot be removed', {
      canvas: canvasAbsPath,
      id,
    });
  } else {
    removeStringAttr(s, hit.opening, attr, source);
  }
  const out = s.toString();
  return { source: out, delta: out.length - source.length };
}

/**
 * Apply an inline TEXT-content edit to the JSX element with the given
 * `data-cd-id`. Leaf-text only: the element's children must be exactly one
 * `JSXText` node (whitespace-only siblings are ignored). Mixed/expression
 * children (`<b>x</b>`, `{count}`) throw `CanvasEditError` — the caller should
 * surface a "use /design:edit" refusal rather than guess. The text is
 * JSX-escaped before it touches source. Same atomic write + per-file lock as
 * `editAttribute`. See DDR-103.
 */
export async function editText(
  canvasAbsPath: string,
  id: string,
  text: string
): Promise<EditResult> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id,
      });
    }
    const source = await file.text();
    const next = applyTextEdit(canvasAbsPath, source, id, text);
    if (next.source === source) return { source, delta: 0, changed: false };
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return { ...next, changed: true };
  });
}

/**
 * Pure variant — exposed for tests + in-memory pipelines. Caller owns
 * persistence. Throws CanvasEditError if the ID isn't found or the edit shape
 * isn't representable.
 */
export function applyEdit(
  canvasAbsPath: string,
  source: string,
  id: string,
  attr: string,
  value: string
): EditResult {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new CanvasEditError(
      `oxc-parser failed on ${canvasAbsPath}: ${first?.message ?? 'unknown'}`,
      { canvas: canvasAbsPath, id }
    );
  }

  const hit = findOpening(parsed.program, id);
  if (!hit) {
    throw new CanvasEditError(`data-cd-id "${id}" not found in ${canvasAbsPath}`, {
      canvas: canvasAbsPath,
      id,
    });
  }

  const s = new MagicString(source);
  if (attr.startsWith('style.')) {
    editStyleProp(s, hit.opening, attr.slice('style.'.length), value, canvasAbsPath, id);
  } else if (attr === 'data-cd-id') {
    throw new CanvasEditError('data-cd-id is owned by the pipeline; cannot be edited', {
      canvas: canvasAbsPath,
      id,
    });
  } else {
    editStringAttr(s, hit.opening, attr, value);
  }

  const out = s.toString();
  return { source: out, delta: out.length - source.length };
}

/**
 * Pure variant of `editText` — parse, locate the JSXText child, overwrite its
 * source span (preserving the original leading/trailing whitespace so JSX
 * indentation survives), escaping the new text. Throws `CanvasEditError` for a
 * missing id, no text content, or mixed/expression children.
 */
export function applyTextEdit(
  canvasAbsPath: string,
  source: string,
  id: string,
  text: string
): EditResult {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new CanvasEditError(
      `oxc-parser failed on ${canvasAbsPath}: ${first?.message ?? 'unknown'}`,
      { canvas: canvasAbsPath, id }
    );
  }

  const hit = findOpening(parsed.program, id);
  if (!hit) {
    throw new CanvasEditError(`data-cd-id "${id}" not found in ${canvasAbsPath}`, {
      canvas: canvasAbsPath,
      id,
    });
  }

  const children: AnyNode[] = Array.isArray(hit.element?.children) ? hit.element.children : [];
  // Ignore whitespace-only JSXText siblings (`<button>\n  Save\n</button>` parses
  // as one JSXText; `<a>\n  <b/>\n</a>` parses as ws + element + ws — the ws is
  // noise). What's left is the "real" content.
  const meaningful = children.filter(
    (c) => !(c?.type === 'JSXText' && typeof c.value === 'string' && c.value.trim() === '')
  );
  if (meaningful.length === 0) {
    throw new CanvasEditError(`element "${id}" has no editable text content`, {
      canvas: canvasAbsPath,
      id,
    });
  }
  const only = meaningful[0];
  // A single `{'string literal'}` expression child — `<h1>{'Title'}</h1>` — is
  // editable (DDR-150 P1): rewrite the literal in place. Written back via
  // JSON.stringify so the result is an inert, correctly-escaped quoted string —
  // the value never leaves the `{...}`, so (unlike JSXText) there is no markup /
  // entity injection surface to guard. Any OTHER expression (identifier,
  // template, call, member — `{title}`, `` {`${n} items`} ``) is genuinely
  // dynamic: refuse and route to /design:edit rather than delete the binding.
  if (meaningful.length === 1 && only?.type === 'JSXExpressionContainer') {
    const expr = (only as AnyNode).expression;
    if (
      expr &&
      (expr.type === 'Literal' || expr.type === 'StringLiteral') &&
      typeof expr.value === 'string'
    ) {
      const s = new MagicString(source);
      s.overwrite(expr.start as number, expr.end as number, JSON.stringify(text));
      const out = s.toString();
      return { source: out, delta: out.length - source.length };
    }
    throw new CanvasEditError(`element "${id}" has dynamic content — edit it via /design:edit`, {
      canvas: canvasAbsPath,
      id,
    });
  }
  if (meaningful.length > 1 || only?.type !== 'JSXText') {
    throw new CanvasEditError(
      `element "${id}" has mixed or expression content — edit it via /design:edit`,
      { canvas: canvasAbsPath, id }
    );
  }

  const start = only.start as number;
  const end = only.end as number;
  const raw = source.slice(start, end);
  // Preserve the original indentation/newline framing; swap only the visible text.
  const lead = /^\s*/.exec(raw)?.[0] ?? '';
  const trail = /\s*$/.exec(raw)?.[0] ?? '';
  const s = new MagicString(source);
  s.overwrite(start, end, `${lead}${escapeJsxText(text)}${trail}`);
  const out = s.toString();
  return { source: out, delta: out.length - source.length };
}

// ---------------------------------------------------------------------------
// Node-move reorder (DDR-138, phase-12.1). Moving a whole JSXElement to a new
// sibling/parent position — the one structural edit `editAttribute`/`editText`
// don't do. Remove the element's line-span + insert a re-indented copy at an
// anchor derived from `refId` + `position`. A same-parent reorder is the
// degenerate case where source/target indent match (no re-indent). Reparenting
// works because we re-indent (not raw magic-string.move). Guardrails refuse
// structurally-unsafe moves; a post-move reparse gate guarantees we never write
// corrupt source. The move response recomputes the moved element's positional
// id (matches what the pipeline assigns on the next pass) + surfaces its
// author-semantic `data-dc-element` handle so the client can re-settle the
// selection through the id churn.

export type MovePosition = 'before' | 'after' | 'inside-start' | 'inside-end';

export interface MoveResult extends EditResult {
  /** Recomputed positional id of the moved element (== the DOM `data-cd-id`
   *  after the next pipeline pass). Best-effort — null if not resolvable. */
  movedId: string | null;
  /** The moved element's `data-dc-element` value (DDR-007), if it has one — a
   *  stable re-select key that survives the id churn byte-for-byte. */
  semanticId: string | null;
}

/** Read a plain-string JSX attribute value off an opening element (null when
 *  absent or not a string literal). */
function getStringAttr(opening: AnyNode, name: string): string | null {
  const attr = findAttribute(opening, name);
  if (!attr) return null;
  const v = attr.value;
  if (v == null) return '';
  if (v.type === 'Literal' || v.type === 'StringLiteral') return String(v.value);
  return null;
}

/** Info about the line a byte offset sits on: the whitespace indentation, where
 *  it begins, and whether a newline immediately precedes it. */
function lineStartInfo(
  source: string,
  pos: number
): { indent: string; indentStart: number; newlineBefore: boolean } {
  let i = pos;
  while (i > 0 && (source[i - 1] === ' ' || source[i - 1] === '\t')) i--;
  return {
    indent: source.slice(i, pos),
    indentStart: i,
    newlineBefore: i > 0 && source[i - 1] === '\n',
  };
}

/** Detect the file's indentation unit (tab vs N spaces). Canvases are Prettier
 *  2-space by default; fall back to that. */
function detectIndentUnit(source: string): string {
  if (/\n\t/.test(source)) return '\t';
  const m = /\n( +)\S/.exec(source);
  return m ? m[1] : '  ';
}

/** Re-indent an element's source text from `fromIndent` (its old line indent) to
 *  `toIndent` (the target depth). The first line carries no leading indent in
 *  `elText` (it starts at the element), so only continuation lines shift, by the
 *  same delta, preserving the element's internal structure. */
function reindentBlock(elText: string, fromIndent: string, toIndent: string): string {
  if (fromIndent === toIndent) return elText;
  const lines = elText.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) return line;
      const lead = /^[ \t]*/.exec(line)?.[0] ?? '';
      const rest = line.slice(lead.length);
      if (rest === '') return line; // blank line — leave as-is
      const rel = lead.startsWith(fromIndent) ? lead.slice(fromIndent.length) : lead;
      return toIndent + rel + rest;
    })
    .join('\n');
}

/** Normalize element text for duplicate-tolerant matching: trim each line so
 *  re-indentation differences don't defeat the match. */
function normalizeForMatch(t: string): string {
  return t
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
}

/** Walk the program with the SAME component + jsxIndex bookkeeping the pipeline
 *  uses (canvas-pipeline.ts walkInjectIds), collecting every JSXElement with the
 *  id it will be assigned. Reused to recompute the moved element's post-move id. */
function collectElements(program: AnyNode): Array<{ id: string; node: AnyNode }> {
  interface Frame {
    componentName: string;
    jsxIndex: number;
  }
  const stack: Frame[] = [{ componentName: '', jsxIndex: 0 }];
  const out: Array<{ id: string; node: AnyNode }> = [];

  function visit(node: AnyNode): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const c of node) visit(c);
      return;
    }
    if (typeof node.type !== 'string') return;

    const newComp = componentNameOf(node);
    let pushed = false;
    if (newComp !== null) {
      stack.push({ componentName: newComp, jsxIndex: 0 });
      pushed = true;
    }

    if (node.type === 'JSXElement') {
      const frame = stack[stack.length - 1] as Frame;
      const idx = frame.jsxIndex;
      frame.jsxIndex += 1;
      out.push({ id: computeId(frame.componentName, idx), node });
      if (node.openingElement) visit(node.openingElement.attributes);
      visit(node.children);
      if (pushed) stack.pop();
      return;
    }

    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      visit(node[k]);
    }
    if (pushed) stack.pop();
  }

  visit(program);
  return out;
}

/**
 * Every JSX element with its enclosing-component frame + tag. Superset of
 * collectElements used to resolve a reused-component INSTANCE to its parent
 * USAGE (see resolveUsageId).
 */
function collectElementsFull(
  program: AnyNode
): Array<{ id: string; componentName: string; isFrameRoot: boolean; tag: string | null }> {
  interface Frame {
    componentName: string;
    jsxIndex: number;
  }
  const stack: Frame[] = [{ componentName: '', jsxIndex: 0 }];
  const out: Array<{
    id: string;
    componentName: string;
    isFrameRoot: boolean;
    tag: string | null;
  }> = [];
  function tagOf(node: AnyNode): string | null {
    const n = node?.openingElement?.name;
    if (n?.type === 'JSXIdentifier' && typeof n.name === 'string') return n.name;
    return null;
  }
  function visit(node: AnyNode): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const c of node) visit(c);
      return;
    }
    if (typeof node.type !== 'string') return;
    const newComp = componentNameOf(node);
    let pushed = false;
    if (newComp !== null) {
      stack.push({ componentName: newComp, jsxIndex: 0 });
      pushed = true;
    }
    if (node.type === 'JSXElement') {
      const frame = stack[stack.length - 1] as Frame;
      const idx = frame.jsxIndex;
      frame.jsxIndex += 1;
      out.push({
        id: computeId(frame.componentName, idx),
        componentName: frame.componentName,
        isFrameRoot: idx === 0,
        tag: tagOf(node),
      });
      if (node.openingElement) visit(node.openingElement.attributes);
      visit(node.children);
      if (pushed) stack.pop();
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      visit(node[k]);
    }
    if (pushed) stack.pop();
  }
  visit(program);
  return out;
}

/**
 * Resolve a reused-component INSTANCE id to the parent's `<Component>` USAGE id.
 *
 * A component used N times (`<Column/>` … `<Column/>`) renders N DOM nodes that
 * all carry ONE data-cd-id — the id of an element INSIDE the component's
 * definition. That id can't be moved (there's only one, inside the loop-free
 * component body). But each USAGE in the parent is a distinct, movable JSX
 * element. So when `domId` names an element that lives inside a component with
 * multiple usages, map it to the `occurrenceIndex`-th usage (the occurrence index
 * of ANY element in the component equals the instance index = the usage index).
 * Falls through to `domId` for a normal element, or a `.map()`ed single-usage
 * element (one usage → can't split). Reordering elements WITHIN a reused
 * component's definition isn't reachable via drag (edit the component source).
 */
function resolveUsageId(
  program: AnyNode,
  domId: string,
  occurrenceIndex: number | undefined
): string {
  const all = collectElementsFull(program);
  const target = all.find((e) => e.id === domId);
  if (!target?.componentName) return domId;
  const usages = all.filter((e) => e.tag === target.componentName);
  if (usages.length <= 1) return domId; // single usage (or `.map`) — not splittable
  const i =
    typeof occurrenceIndex === 'number' && occurrenceIndex >= 0 && occurrenceIndex < usages.length
      ? occurrenceIndex
      : 0;
  return usages[i]?.id ?? domId;
}

/**
 * Move the element with `data-cd-id === id` to a position relative to the element
 * with `data-cd-id === refId`. Async wrapper: read, apply, atomic write under the
 * per-file mutex — identical persistence to `editAttribute`.
 *
 * `idIndex` / `refIndex` are the DOM occurrence indices — which rendered instance
 * of a reused component the id refers to (0 for a normal, single-render element).
 */
export async function moveElement(
  canvasAbsPath: string,
  id: string,
  refId: string,
  position: MovePosition,
  idIndex?: number,
  refIndex?: number
): Promise<MoveResult> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id,
      });
    }
    const source = await file.text();
    const next = applyMove(canvasAbsPath, source, id, refId, position, idIndex, refIndex);
    if (next.source === source) return next;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
  });
}

/** Pure variant of `moveElement` — exposed for tests. Never mutates disk. */
export function applyMove(
  canvasAbsPath: string,
  source: string,
  id: string,
  refId: string,
  position: MovePosition,
  idIndex?: number,
  refIndex?: number
): MoveResult {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new CanvasEditError(
      `oxc-parser failed on ${canvasAbsPath}: ${first?.message ?? 'unknown'}`,
      { canvas: canvasAbsPath, id }
    );
  }

  // Map reused-component INSTANCE ids to their parent USAGE elements before the
  // move (a shared internal id isn't movable per-instance; the usage is).
  id = resolveUsageId(parsed.program, id, idIndex);
  refId = resolveUsageId(parsed.program, refId, refIndex);

  if (id === refId) {
    throw new CanvasEditError('cannot move an element relative to itself', {
      canvas: canvasAbsPath,
      id,
    });
  }

  const moved = findOpening(parsed.program, id);
  if (!moved) {
    throw new CanvasEditError(`data-cd-id "${id}" not found in ${canvasAbsPath}`, {
      canvas: canvasAbsPath,
      id,
    });
  }
  const ref = findOpening(parsed.program, refId);
  if (!ref) {
    throw new CanvasEditError(`reference data-cd-id "${refId}" not found in ${canvasAbsPath}`, {
      canvas: canvasAbsPath,
      id: refId,
    });
  }

  const movedEl = moved.element;
  const refEl = ref.element;
  const mStart = movedEl.start as number;
  const mEnd = movedEl.end as number;
  const rStart = refEl.start as number;
  const rEnd = refEl.end as number;

  // Guardrail: the reference must not live inside the moved element's subtree —
  // that would splice the node into itself.
  if (rStart >= mStart && rEnd <= mEnd) {
    throw new CanvasEditError('cannot move an element into its own subtree', {
      canvas: canvasAbsPath,
      id,
    });
  }

  const inside = position === 'inside-start' || position === 'inside-end';
  if (inside && (refEl.openingElement?.selfClosing || !refEl.closingElement)) {
    throw new CanvasEditError(
      `target "${refId}" is self-closing — cannot nest an element inside it`,
      { canvas: canvasAbsPath, id: refId }
    );
  }

  const indentUnit = detectIndentUnit(source);
  const elText = source.slice(mStart, mEnd);
  const movedLine = lineStartInfo(source, mStart);
  const removeStart = movedLine.newlineBefore ? movedLine.indentStart - 1 : movedLine.indentStart;

  // Resolve the target indent + insertion anchor per position.
  let targetIndent: string;
  let anchor: number;
  let insertText: string;

  if (position === 'after') {
    targetIndent = lineStartInfo(source, rStart).indent;
    const reText = reindentBlock(elText, movedLine.indent, targetIndent);
    anchor = rEnd;
    insertText = `\n${targetIndent}${reText}`;
  } else if (position === 'before') {
    const rLine = lineStartInfo(source, rStart);
    targetIndent = rLine.indent;
    const reText = reindentBlock(elText, movedLine.indent, targetIndent);
    if (rLine.newlineBefore) {
      anchor = rLine.indentStart - 1;
      insertText = `\n${targetIndent}${reText}`;
    } else {
      anchor = rLine.indentStart;
      insertText = `${targetIndent}${reText}\n`;
    }
  } else if (position === 'inside-start') {
    targetIndent = lineStartInfo(source, rStart).indent + indentUnit;
    const reText = reindentBlock(elText, movedLine.indent, targetIndent);
    anchor = refEl.openingElement.end as number;
    insertText = `\n${targetIndent}${reText}`;
  } else {
    // inside-end — insert as the last child, before the closing tag's own line.
    targetIndent = lineStartInfo(source, rStart).indent + indentUnit;
    const reText = reindentBlock(elText, movedLine.indent, targetIndent);
    const cStart = refEl.closingElement.start as number;
    const cLine = lineStartInfo(source, cStart);
    if (cLine.newlineBefore) {
      anchor = cLine.indentStart - 1;
      insertText = `\n${targetIndent}${reText}`;
    } else {
      anchor = cStart;
      insertText = `${reText}`;
    }
  }

  const s = new MagicString(source);
  s.remove(removeStart, mEnd);
  s.appendLeft(anchor, insertText);
  const out = s.toString();

  // Reparse gate: never write source that doesn't parse. This is the catch-all
  // that lets us keep the guardrail set small.
  const check = parseSync(canvasAbsPath, out, { sourceType: 'module' });
  if (check.errors && check.errors.length > 0) {
    const first = check.errors[0];
    throw new CanvasEditError(
      `move would produce invalid source (${first?.message ?? 'parse error'}); aborted`,
      { canvas: canvasAbsPath, id }
    );
  }

  // Re-settle hints. semanticId survives the move verbatim; movedId is the
  // recomputed positional id (matches the post-reload DOM).
  const semanticId = getStringAttr(movedEl.openingElement, 'data-dc-element');
  let movedId: string | null = null;
  const wanted = normalizeForMatch(reindentBlock(elText, movedLine.indent, targetIndent));
  for (const { id: eid, node } of collectElements(check.program)) {
    if (normalizeForMatch(out.slice(node.start as number, node.end as number)) === wanted) {
      movedId = eid;
      break;
    }
  }

  return { source: out, delta: out.length - source.length, movedId, semanticId };
}

// ---------------------------------------------------------------------------
// DDR-148 — Timeline drag-to-retime. Rewrites a `<...Sequence>`'s
// `durationInFrames` / `from` to a new frame count. Sequences are addressed by
// their document ORDER (the same order timeline-parse.js tokenizes them), not a
// data-cd-id — a member-expression element (`TransitionSeries.Sequence`) has no
// stable cd-id, and the order is what the Timeline UI already knows.

export interface RetimePatch {
  durationInFrames?: number;
  from?: number;
}

const SEQ_TAG_RE = /<(?:TransitionSeries\.Sequence|Series\.Sequence|Sequence)\b[^>]*>/g;

/**
 * Rewrite one attribute on a sequence tag. Prefers editing a referenced const
 * (`durationInFrames={A}` → bump `const A = …`) so a derived total
 * (`const TOTAL = A + B - XF`) updates in lock-step; falls back to editing a
 * literal in place; refuses a non-trivial expression (returns false).
 */
function retimeAttr(
  s: MagicString,
  source: string,
  tag: string,
  tagStart: number,
  key: 'durationInFrames' | 'from',
  newVal: number
): boolean {
  const am = tag.match(new RegExp(`\\b${key}=\\{\\s*([^}]*?)\\s*\\}`));
  if (!am || am.index == null) {
    // Attr absent. For `from`, INSERT it — moving a cursor-implicit clip
    // (`<Sequence durationInFrames={…}>`) to a new start needs an explicit
    // `from` (DDR-150 P3 Task 6). durationInFrames is required on a clip, so
    // never auto-insert it.
    if (key === 'from') {
      const nameMatch = tag.match(/^<([A-Za-z][\w.]*)/);
      if (nameMatch) {
        s.appendLeft(tagStart + nameMatch[0].length, ` from={${newVal}}`);
        return true;
      }
    }
    return false;
  }
  const inner = am[1].trim();
  if (/^[A-Za-z_$][\w$]*$/.test(inner)) {
    const cm = source.match(new RegExp(`\\bconst\\s+${inner}\\s*=\\s*(-?\\d+)`));
    if (cm && cm.index != null && cm[1]) {
      const numStart = cm.index + cm[0].lastIndexOf(cm[1]);
      s.overwrite(numStart, numStart + cm[1].length, String(newVal));
      return true;
    }
  }
  if (/^-?\d+$/.test(inner)) {
    const innerRel = am[0].indexOf(inner, am[0].indexOf('{'));
    const valStart = tagStart + am.index + innerRel;
    s.overwrite(valStart, valStart + inner.length, String(newVal));
    return true;
  }
  return false;
}

/** Pure retime — exposed for tests. Never mutates disk. */
export function applyRetimeSequence(
  canvasAbsPath: string,
  source: string,
  seqIndex: number,
  patch: RetimePatch
): { source: string } {
  const s = new MagicString(source);
  SEQ_TAG_RE.lastIndex = 0;
  let i = 0;
  let touched = false;
  let m: RegExpExecArray | null = SEQ_TAG_RE.exec(source);
  while (m) {
    if (i === seqIndex) {
      const tag = m[0];
      const tagStart = m.index;
      for (const [key, val] of [
        ['durationInFrames', patch.durationInFrames],
        ['from', patch.from],
      ] as const) {
        if (val == null || !Number.isFinite(val)) continue;
        if (retimeAttr(s, source, tag, tagStart, key, Math.max(0, Math.round(val)))) touched = true;
      }
      break;
    }
    i += 1;
    m = SEQ_TAG_RE.exec(source);
  }
  if (!touched) {
    throw new CanvasEditError(`no retimable sequence at index ${seqIndex}`, {
      canvas: canvasAbsPath,
      id: String(seqIndex),
    });
  }
  const next = s.toString();
  const parsed = parseSync(canvasAbsPath, next, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(
      `retime produced invalid source: ${parsed.errors[0]?.message ?? 'parse error'}`,
      { canvas: canvasAbsPath, id: String(seqIndex) }
    );
  }
  return { source: next };
}

/** Retime a sequence on disk (atomic write + per-file lock, like moveElement). */
export async function retimeSequence(
  canvasAbsPath: string,
  seqIndex: number,
  patch: RetimePatch
): Promise<{ source: string }> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id: String(seqIndex),
      });
    }
    const source = await file.text();
    const next = applyRetimeSequence(canvasAbsPath, source, seqIndex, patch);
    if (next.source === source) return next;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
  });
}

/**
 * Retime a clip addressed by the enumerator's `stableId` (comp-scoped) instead of
 * a whole-file index — the DDR-150 P2 fix for the multi-comp mis-hit. Verifies
 * the content-hash fingerprint (refuse a stale/raced target), patches the clip's
 * own tag via `retimeAttr` (const-preferring), then reparse + semantic gate.
 */
export function applyRetimeSequenceByClip(
  canvasAbsPath: string,
  source: string,
  artboardId: string | undefined,
  stableId: string,
  expectedHash: string | undefined,
  patch: RetimePatch
): { source: string } {
  const clip = resolveClip(canvasAbsPath, source, artboardId, stableId, expectedHash);
  // A `from` move is STANDALONE-<Sequence>-only. `<TransitionSeries.Sequence>` /
  // `<Series.Sequence>` compute their own offsets — Remotion silently IGNORES a
  // `from` prop on them, so patching/inserting one writes a lie: the timeline
  // draws a gap while the rendered video never changes (the dogfood bug —
  // "video je furt stejné, ať klipem pohnu jakkoliv"). Refuse loudly instead.
  if (patch.from != null && clip.tag !== 'Sequence') {
    throw new CanvasEditError(
      `"${stableId}" is a ${clip.tag} — the series computes its position, so moving it has no effect. Trim its duration instead, or reorder the beats.`,
      { canvas: canvasAbsPath, id: stableId }
    );
  }
  const s = new MagicString(source);
  SEQ_TAG_RE.lastIndex = 0;
  let touched = false;
  let m: RegExpExecArray | null = SEQ_TAG_RE.exec(source);
  while (m) {
    if (m.index === clip.start) {
      for (const [key, val] of [
        ['durationInFrames', patch.durationInFrames],
        ['from', patch.from],
      ] as const) {
        if (val == null || !Number.isFinite(val)) continue;
        if (retimeAttr(s, source, m[0], m.index, key, Math.max(0, Math.round(val)))) touched = true;
      }
      break;
    }
    m = SEQ_TAG_RE.exec(source);
  }
  if (!touched) {
    throw new CanvasEditError(`clip "${stableId}" has no retimable from/durationInFrames`, {
      canvas: canvasAbsPath,
      id: stableId,
    });
  }
  const next = s.toString();
  const parsed = parseSync(canvasAbsPath, next, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(
      `retime produced invalid source: ${parsed.errors[0]?.message ?? 'parse error'}`,
      { canvas: canvasAbsPath, id: stableId }
    );
  }
  assertCompSemantics(canvasAbsPath, next);
  return { source: next };
}

/** Retime a clip by stableId on disk (atomic write + cross-process lock). */
export async function retimeSequenceByClip(
  canvasAbsPath: string,
  artboardId: string | undefined,
  stableId: string,
  expectedHash: string | undefined,
  patch: RetimePatch
): Promise<{ source: string }> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id: stableId,
      });
    }
    const source = await file.text();
    const next = applyRetimeSequenceByClip(
      canvasAbsPath,
      source,
      artboardId,
      stableId,
      expectedHash,
      patch
    );
    if (next.source === source) return next;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
  });
}

// ---------------------------------------------------------------------------
// Clip addressing (DDR-150 P2). The SINGLE authoritative tokenizer for a
// video-comp's clips. The Timeline UI addresses every op through the `stableId`
// this returns, NOT its own regex position — killing the two-tokenizer
// document-order disagreement that made destructive ops corrupt the wrong clip
// on a multi-comp canvas (the debate's headline defect). AST-based, so it skips
// tags inside comments/strings (the regex parser didn't) and scopes cleanly to
// one comp's body even when several comps share a file.

/** Sequence-family "clip" tags (the timeline rows). */
const CLIP_TAGS = new Set(['Sequence', 'Series.Sequence', 'TransitionSeries.Sequence']);
/** Transition tags (occupy a slot between clips inside a TransitionSeries). */
const TRANSITION_TAGS = new Set(['Series.Transition', 'TransitionSeries.Transition']);
/** Media tags that carry a `src` (the replace-media + drop targets). */
const MEDIA_TAGS = new Set(['Video', 'OffthreadVideo', 'Audio', 'Img', 'Image']);

/** Full tag string of a JSXElement: `Sequence` | `TransitionSeries.Sequence` | … */
function jsxTagName(node: AnyNode): string | null {
  const n = node?.openingElement?.name;
  if (!n) return null;
  if (n.type === 'JSXIdentifier') return typeof n.name === 'string' ? n.name : null;
  if (n.type === 'JSXMemberExpression') {
    const obj = n.object?.type === 'JSXIdentifier' ? n.object.name : null;
    const prop = n.property?.type === 'JSXIdentifier' ? n.property.name : null;
    if (obj && prop) return `${obj}.${prop}`;
  }
  return null;
}

/** Evaluate a numeric AST expression against a resolved const map (literal,
 *  negation, const identifier, or simple arithmetic of them). null if not
 *  resolvable — from/duration are best-effort labels, never load-bearing for
 *  addressing (that's stableId + contentHash). */
function evalNum(n: AnyNode, consts: Record<string, number>): number | null {
  if (!n || typeof n !== 'object') return null;
  const t = n.type;
  if ((t === 'Literal' || t === 'NumericLiteral') && typeof n.value === 'number') return n.value;
  if (t === 'UnaryExpression' && n.operator === '-') {
    const v = evalNum(n.argument, consts);
    return v == null ? null : -v;
  }
  if (t === 'Identifier') return Object.hasOwn(consts, n.name) ? (consts[n.name] as number) : null;
  if (t === 'BinaryExpression') {
    const l = evalNum(n.left, consts);
    const r = evalNum(n.right, consts);
    if (l == null || r == null) return null;
    switch (n.operator) {
      case '+':
        return l + r;
      case '-':
        return l - r;
      case '*':
        return l * r;
      case '/':
        return r ? l / r : null;
      default:
        return null;
    }
  }
  return null;
}

/** Top-level numeric const bindings (3 passes so a derived `TOTAL = A + B` resolves). */
function collectNumericConsts(program: AnyNode): Record<string, number> {
  const consts: Record<string, number> = {};
  const decls: Array<{ name: string; init: AnyNode }> = [];
  for (const node of program?.body ?? []) {
    if (node?.type !== 'VariableDeclaration') continue;
    for (const d of node.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.init) decls.push({ name: d.id.name, init: d.init });
    }
  }
  for (let pass = 0; pass < 3; pass += 1) {
    for (const { name, init } of decls) {
      if (Object.hasOwn(consts, name)) continue;
      const v = evalNum(init, consts);
      if (v != null && Number.isFinite(v)) consts[name] = Math.round(v);
    }
  }
  return consts;
}

/** Resolve a numeric JSX attribute (`from={20}` / `durationInFrames={A}`). */
function numAttr(opening: AnyNode, name: string, consts: Record<string, number>): number | null {
  const a = findAttribute(opening, name);
  let v = a?.value;
  if (!v) return null;
  if (v.type === 'JSXExpressionContainer') v = v.expression;
  const n = evalNum(v, consts);
  return n == null ? null : Math.round(n);
}

/** First media descendant of a clip (its `<Video>`/`<Audio>`/`<Img>` — the replace target). */
function firstMediaDescendant(clip: AnyNode): AnyNode | null {
  let found: AnyNode | null = null;
  function walk(n: AnyNode): void {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const c of n) {
        if (found) return;
        walk(c);
      }
      return;
    }
    if (n.type === 'JSXElement' && MEDIA_TAGS.has(jsxTagName(n) ?? '')) {
      found = n;
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      walk(n[k]);
    }
  }
  walk(clip.children ?? []);
  return found;
}

/** Map every top-level component name → its render body root (for nested-media resolution). */
function collectComponentBodies(program: AnyNode): Map<string, AnyNode> {
  const out = new Map<string, AnyNode>();
  const body = (program?.body ?? []) as AnyNode[];
  for (const stmt of body) {
    if (stmt?.type === 'FunctionDeclaration' && isPascalIdent(stmt.id?.name)) {
      out.set(stmt.id.name, stmt.body);
    } else if (stmt?.type === 'VariableDeclaration') {
      for (const d of stmt.declarations ?? []) {
        const name = componentNameOf(d);
        if (name && d.init?.body) out.set(name, d.init.body);
      }
    }
  }
  return out;
}

/** Map every top-level `const NAME = [ {…}, … ]` → its ArrayExpression (for `CLIPS[i].src`). */
function collectArrayLiterals(program: AnyNode): Map<string, AnyNode> {
  const out = new Map<string, AnyNode>();
  for (const stmt of (program?.body ?? []) as AnyNode[]) {
    if (stmt?.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.init?.type === 'ArrayExpression') {
        out.set(d.id.name, d.init);
      }
    }
  }
  return out;
}

/** The first JSXElement child of `clip` whose tag is a PascalCase component (not a primitive). */
function firstComponentChild(clip: AnyNode): AnyNode | null {
  for (const child of (clip.children ?? []) as AnyNode[]) {
    if (child?.type === 'JSXElement') {
      const tag = jsxTagName(child);
      if (tag && isPascalIdent(tag) && !MEDIA_TAGS.has(tag)) return child;
    }
  }
  return null;
}

/** A media element's `src` attr node (JSX value), or null. */
function srcAttrValue(mediaEl: AnyNode): AnyNode | null {
  const attr = findAttribute(mediaEl.openingElement, 'src');
  return attr?.value ?? null;
}

/**
 * Resolve a clip's media even when it's nested one level inside a wrapper
 * component whose `src` is fed by an array element (the showreel
 * `<ClipShot clip={CLIPS[2]} />` → `<Video src={clip.src} />` pattern). Returns
 * the media tag + a replace target: a direct `cdId` (literal src), an
 * `arrayRef` (edit `NAME[i].field`), or `shared` (literal src in a reused comp).
 */
function resolveNestedMedia(
  clip: AnyNode,
  componentBodies: Map<string, AnyNode>,
  arrays: Map<string, AnyNode>,
  cdIdOf: Map<AnyNode, string>
): {
  el: AnyNode;
  tag: string;
  src: string | null;
  cdId: string | null;
  arrayRef: { arrayName: string; index: number; field: string } | null;
  shared: boolean;
} | null {
  // 1. Direct media descendant (literal or prop src).
  const direct = firstMediaDescendant(clip);
  if (direct) {
    return {
      el: direct,
      tag: jsxTagName(direct) ?? 'Video',
      src: getStringAttr(direct.openingElement, 'src'),
      cdId: cdIdOf.get(direct) ?? null,
      arrayRef: null,
      shared: false,
    };
  }
  // 2. Wrapper component: <Comp propName={ARR[i]} /> → Comp body → media <X src={param.field}>.
  const wrapper = firstComponentChild(clip);
  if (!wrapper) return null;
  const compName = jsxTagName(wrapper);
  const body = compName ? componentBodies.get(compName) : null;
  if (!body) return null;
  const media = firstMediaDescendant({ children: [body] });
  if (!media) return null;
  const tag = jsxTagName(media) ?? 'Video';
  const srcVal = srcAttrValue(media);
  // Literal src inside the shared component → replaceable, but shared.
  if (srcVal?.type === 'Literal' || srcVal?.type === 'StringLiteral') {
    return { el: media, tag, src: String(srcVal.value), cdId: cdIdOf.get(media) ?? null, arrayRef: null, shared: true };
  }
  // Prop-bound src: `src={param.field}` where `param` is the component's first
  // destructured/parameter name, bound at the call site to `ARR[i]`.
  if (srcVal?.type === 'JSXExpressionContainer') {
    const expr = srcVal.expression;
    // member: param.field
    if (expr?.type === 'MemberExpression' && expr.object?.type === 'Identifier' && expr.property?.type === 'Identifier') {
      const field = expr.property.name;
      // Find the call-site prop bound to this component's param: <Comp X={ARR[i]}>.
      // The wrapper's first attribute value that is `ARR[i]` gives the array + index.
      for (const attr of (wrapper.openingElement?.attributes ?? []) as AnyNode[]) {
        const v = attr?.value;
        if (v?.type !== 'JSXExpressionContainer') continue;
        const e = v.expression;
        if (
          e?.type === 'MemberExpression' &&
          e.object?.type === 'Identifier' &&
          arrays.has(e.object.name) &&
          e.property?.type === 'Literal' &&
          typeof e.property.value === 'number'
        ) {
          const arr = arrays.get(e.object.name);
          const el = (arr?.elements ?? [])[e.property.value] as AnyNode | undefined;
          const prop = el?.type === 'ObjectExpression'
            ? (el.properties ?? []).find((p: AnyNode) => p?.key?.name === field || p?.key?.value === field)
            : null;
          const litSrc =
            prop?.value && (prop.value.type === 'Literal' || prop.value.type === 'StringLiteral')
              ? String(prop.value.value)
              : null;
          return {
            el: media,
            tag,
            src: litSrc,
            cdId: null,
            arrayRef: { arrayName: e.object.name, index: e.property.value, field },
            shared: false,
          };
        }
      }
    }
  }
  // Media exists but src isn't resolvable to a replaceable target.
  return { el: media, tag, src: null, cdId: null, arrayRef: null, shared: false };
}

/** Stable content fingerprint of a clip's exact source span (optimistic-concurrency check). */
function hashSpan(source: string, start: number, end: number): string {
  return Bun.hash(source.slice(start, end)).toString(16).padStart(16, '0').slice(0, 12);
}

/** One clip (timeline row) + everything an op needs to address + label it. */
export interface ClipInfo {
  /** Durable identity: `name:<Sequence name>` → `mclip:<sentinel>` → `<comp>#<indexInComp>`. */
  stableId: string;
  kind: 'sequence' | 'transition';
  tag: string;
  from: number | null;
  durationInFrames: number | null;
  mediaTag: string | null;
  mediaSrc: string | null;
  /** Positional cd-id of the media element (for `editAttribute` src-replace). */
  mediaCdId: string | null;
  /**
   * When the clip's media lives inside a wrapper component whose `src` is fed by
   * an array element (`<ClipShot clip={CLIPS[2]} />` → `<Video src={clip.src}>`),
   * this points at the array-literal string to edit for a replace (the showreel
   * pattern). `mediaCdId` is then null (the element's src is a prop, not literal).
   */
  mediaArrayRef: { arrayName: string; index: number; field: string } | null;
  /**
   * True when the media's literal `src` lives in a SHARED wrapper component (every
   * instance renders the same element) — replacing it changes every clip using
   * that component. The client warns before applying.
   */
  mediaShared: boolean;
  /** Positional cd-id of the clip's OWN `<Sequence>` node (for `moveElement` z-order reorder). */
  clipCdId: string | null;
  /** Fingerprint of the clip's source span — refuse an op if it no longer matches. */
  contentHash: string;
  start: number;
  end: number;
}

/** A media element sitting DIRECTLY in the comp body (not inside a clip) — an
 *  `<Audio>` music bed under the reel, a full-length `<Video>` background, … .
 *  Not a clip (no from/duration semantics of its own), but it IS addressable:
 *  the Timeline's audio rows use `cdId` for a replace (`editAttribute` on src). */
export interface LooseMediaInfo {
  tag: string;
  src: string | null;
  cdId: string | null;
  contentHash: string;
}

export interface CompClips {
  compName: string | null;
  artboardId: string | null;
  fps: number | null;
  durationInFrames: number | null;
  clips: ClipInfo[];
  /** DDR-150 dogfood #5 — loose media beds (document order), for audio replace. */
  media: LooseMediaInfo[];
}

/**
 * Enumerate the clips of ONE video-comp (scoped by `artboardId` → its
 * `<VideoComp component={X}>` → component X's body). The Timeline UI renders
 * rows from this and addresses every op by `clip.stableId` — so UI and engine
 * can never disagree about which clip is which (the multi-comp defect). Throws
 * `CanvasEditError` on unparseable source.
 */
export function enumerateClips(
  canvasAbsPath: string,
  source: string,
  artboardId?: string
): CompClips {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(
      `oxc-parser failed on ${canvasAbsPath}: ${parsed.errors[0]?.message ?? 'unknown'}`,
      { canvas: canvasAbsPath, id: artboardId ?? '' }
    );
  }
  const program = parsed.program;
  const consts = collectNumericConsts(program);
  const cdIdOf = new Map<AnyNode, string>();
  for (const { id, node } of collectElements(program)) cdIdOf.set(node, id);

  interface Usage {
    compName: string | null;
    artboardId: string | null;
    fps: number | null;
    duration: number | null;
  }
  interface RawClip {
    tag: string;
    kind: 'sequence' | 'transition';
    node: AnyNode;
    comp: string;
    indexInComp: number;
    start: number;
    end: number;
  }
  interface RawMedia {
    tag: string;
    node: AnyNode;
    comp: string;
    start: number;
    end: number;
  }
  const usages: Usage[] = [];
  const clips: RawClip[] = [];
  const mediaEls: RawMedia[] = [];
  const compClipCount: Record<string, number> = {};
  const compStack: string[] = [''];
  const artboardStack: Array<string | null> = [];

  function visit(node: AnyNode): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const c of node) visit(c);
      return;
    }
    if (typeof node.type !== 'string') return;
    const newComp = componentNameOf(node);
    let pushedComp = false;
    if (newComp !== null) {
      compStack.push(newComp);
      pushedComp = true;
    }
    if (node.type === 'JSXElement') {
      const tag = jsxTagName(node);
      let pushedArt = false;
      if (tag === 'DCArtboard') {
        artboardStack.push(getStringAttr(node.openingElement, 'id'));
        pushedArt = true;
      }
      if (tag === 'VideoComp') {
        const compAttr = findAttribute(node.openingElement, 'component');
        const cv = compAttr?.value;
        const cn =
          cv?.type === 'JSXExpressionContainer' && cv.expression?.type === 'Identifier'
            ? cv.expression.name
            : null;
        usages.push({
          compName: cn,
          artboardId: artboardStack.length ? artboardStack[artboardStack.length - 1] : null,
          fps: numAttr(node.openingElement, 'fps', consts),
          duration: numAttr(node.openingElement, 'durationInFrames', consts),
        });
      }
      if (tag && (CLIP_TAGS.has(tag) || TRANSITION_TAGS.has(tag))) {
        const comp = compStack[compStack.length - 1] as string;
        const idx = compClipCount[comp] ?? 0;
        compClipCount[comp] = idx + 1;
        clips.push({
          tag,
          kind: TRANSITION_TAGS.has(tag) ? 'transition' : 'sequence',
          node,
          comp,
          indexInComp: idx,
          start: node.start as number,
          end: node.end as number,
        });
      }
      if (tag && MEDIA_TAGS.has(tag)) {
        // Every media element, with its owning comp — loose beds are filtered
        // out of clip spans below (an <Audio> under the reel vs inside a clip).
        mediaEls.push({
          tag,
          node,
          comp: compStack[compStack.length - 1] as string,
          start: node.start as number,
          end: node.end as number,
        });
      }
      if (node.openingElement) visit(node.openingElement.attributes);
      visit(node.children);
      if (pushedArt) artboardStack.pop();
      if (pushedComp) compStack.pop();
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      visit(node[k]);
    }
    if (pushedComp) compStack.pop();
  }
  visit(program);

  // Resolve which comp to scope to. Preference mirrors timeline-parse.js:
  // the selected artboard's comp → a comp with clips → the first usage.
  const target =
    (artboardId && usages.find((u) => u.artboardId === artboardId && u.compName)) ||
    usages.find((u) => u.compName && clips.some((c) => c.comp === u.compName)) ||
    usages.find((u) => u.compName) ||
    null;
  const targetComp = target?.compName ?? clips[0]?.comp ?? null;

  const componentBodies = collectComponentBodies(program);
  const arrays = collectArrayLiterals(program);
  const scoped = targetComp == null ? [] : clips.filter((c) => c.comp === targetComp);
  const clipInfos: ClipInfo[] = scoped.map((c) => {
    const opening = c.node.openingElement;
    const nameAttr = getStringAttr(opening, 'name');
    const before = source.slice(Math.max(0, c.start - 160), c.start);
    const sentinel = before.match(/\{\/\*\s*@mclip\s+([A-Za-z0-9_-]+)\s*\*\/\}\s*$/);
    const stableId =
      nameAttr != null && nameAttr !== ''
        ? `name:${nameAttr}`
        : sentinel
          ? `mclip:${sentinel[1]}`
          : `${targetComp}#${c.indexInComp}`;
    // Resolve media even through a wrapper component (the showreel pattern) so
    // the Timeline can badge the clip video/image/audio AND replace its source.
    const m = resolveNestedMedia(c.node, componentBodies, arrays, cdIdOf);
    return {
      stableId,
      kind: c.kind,
      tag: c.tag,
      from: numAttr(opening, 'from', consts),
      durationInFrames: numAttr(opening, 'durationInFrames', consts),
      mediaTag: m ? m.tag : null,
      mediaSrc: m ? m.src : null,
      mediaCdId: m ? m.cdId : null,
      mediaArrayRef: m ? m.arrayRef : null,
      mediaShared: m ? m.shared : false,
      clipCdId: cdIdOf.get(c.node) ?? null,
      contentHash: hashSpan(source, c.start, c.end),
      start: c.start,
      end: c.end,
    };
  });

  // Loose media beds — media in the target comp OUTSIDE every clip span
  // (an <Audio> music bed, a background <Video>). Document order.
  const media: LooseMediaInfo[] = mediaEls
    .filter(
      (mel) =>
        mel.comp === targetComp && !scoped.some((c) => mel.start >= c.start && mel.end <= c.end)
    )
    .map((mel) => ({
      tag: mel.tag,
      src: getStringAttr(mel.node.openingElement, 'src'),
      cdId: cdIdOf.get(mel.node) ?? null,
      contentHash: hashSpan(source, mel.start, mel.end),
    }));

  return {
    compName: targetComp,
    artboardId: target?.artboardId ?? null,
    fps: target?.fps ?? null,
    durationInFrames: target?.duration ?? null,
    clips: clipInfos,
    media,
  };
}

/**
 * Resolve a `stableId` (from `enumerateClips`) to its live clip in `source`,
 * verifying the caller's `expectedHash` still matches (optimistic concurrency —
 * a stale UI index or a concurrent edit is refused, not silently mis-applied).
 * Returns the ClipInfo (with current start/end for the patch). Throws on a
 * missing id or a hash mismatch.
 */
export function resolveClip(
  canvasAbsPath: string,
  source: string,
  artboardId: string | undefined,
  stableId: string,
  expectedHash?: string
): ClipInfo {
  const { clips } = enumerateClips(canvasAbsPath, source, artboardId);
  const hit = clips.find((c) => c.stableId === stableId);
  if (!hit) {
    throw new CanvasEditError(`clip "${stableId}" not found`, {
      canvas: canvasAbsPath,
      id: stableId,
    });
  }
  if (expectedHash != null && expectedHash !== hit.contentHash) {
    throw new CanvasEditError(
      `clip "${stableId}" changed since it was read (concurrent edit); reload and retry`,
      { canvas: canvasAbsPath, id: stableId }
    );
  }
  return hit;
}

/**
 * The semantic gate (DDR-150 P2). Parse-clean is NOT correct: a wrong-clip
 * delete, an orphaned/leading/double `<TransitionSeries.Transition>`, all parse
 * fine yet render wrong. After any structural clip edit, assert every
 * `<TransitionSeries>` strictly alternates Sequence/Transition and begins + ends
 * with a Sequence. Throws `CanvasEditError` on a violation.
 */
export function assertCompSemantics(canvasAbsPath: string, source: string): { ok: true } {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(
      `oxc-parser failed on ${canvasAbsPath}: ${parsed.errors[0]?.message ?? 'unknown'}`,
      { canvas: canvasAbsPath, id: '' }
    );
  }
  const series: AnyNode[] = [];
  (function find(node: AnyNode): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const c of node) find(c);
      return;
    }
    if (node.type === 'JSXElement' && jsxTagName(node) === 'TransitionSeries') series.push(node);
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      find(node[k]);
    }
  })(parsed.program);

  for (const s of series) {
    const kinds: Array<'sequence' | 'transition'> = [];
    for (const child of s.children ?? []) {
      if (child?.type !== 'JSXElement') continue;
      const tag = jsxTagName(child);
      if (tag && TRANSITION_TAGS.has(tag)) kinds.push('transition');
      else if (tag && CLIP_TAGS.has(tag)) kinds.push('sequence');
    }
    if (kinds.length === 0) continue;
    const bad =
      kinds[0] !== 'sequence' ||
      kinds[kinds.length - 1] !== 'sequence' ||
      kinds.some((k, i) => i > 0 && k === kinds[i - 1]);
    if (bad) {
      throw new CanvasEditError(
        'TransitionSeries must alternate Sequence/Transition and begin + end with a Sequence (a leading, trailing, or doubled Transition is invalid Remotion)',
        { canvas: canvasAbsPath, id: '' }
      );
    }
  }
  return { ok: true };
}

/** Source span of an element extended back over its leading indent + newline
 *  (so removing it doesn't leave a blank line) — mirrors moveElement's removeStart. */
function spanWithFraming(source: string, start: number, end: number): [number, number] {
  const line = lineStartInfo(source, start);
  const rs = line.newlineBefore ? line.indentStart - 1 : line.indentStart;
  return [rs, end];
}

/**
 * Remove a clip (DDR-150 P3), addressed by the enumerator's stableId. Verifies
 * the content-hash fingerprint; refuses removing the ONLY clip; when the clip
 * lives in a `<TransitionSeries>` also removes ONE adjacent transition so the
 * series stays valid; then reparse + semantic gate (the backstop that refuses a
 * remove which would leave a dangling/doubled transition, rather than corrupt).
 */
export function applyRemoveClip(
  canvasAbsPath: string,
  source: string,
  artboardId: string | undefined,
  stableId: string,
  expectedHash: string | undefined
): { source: string } {
  const { clips } = enumerateClips(canvasAbsPath, source, artboardId);
  const idx = clips.findIndex((c) => c.stableId === stableId);
  if (idx < 0) {
    throw new CanvasEditError(`clip "${stableId}" not found`, {
      canvas: canvasAbsPath,
      id: stableId,
    });
  }
  const clip = clips[idx] as ClipInfo;
  if (expectedHash != null && expectedHash !== clip.contentHash) {
    throw new CanvasEditError(
      `clip "${stableId}" changed since it was read (concurrent edit); reload and retry`,
      { canvas: canvasAbsPath, id: stableId }
    );
  }
  if (clip.kind !== 'sequence') {
    throw new CanvasEditError(`"${stableId}" is a transition, not a removable clip`, {
      canvas: canvasAbsPath,
      id: stableId,
    });
  }
  if (clips.filter((c) => c.kind === 'sequence').length <= 1) {
    throw new CanvasEditError('cannot remove the only clip — delete the comp instead', {
      canvas: canvasAbsPath,
      id: stableId,
    });
  }
  const spans: Array<[number, number]> = [spanWithFraming(source, clip.start, clip.end)];
  if (clip.tag.startsWith('TransitionSeries.')) {
    const next = clips[idx + 1];
    const prev = clips[idx - 1];
    const t = next?.kind === 'transition' ? next : prev?.kind === 'transition' ? prev : null;
    if (t) spans.push(spanWithFraming(source, t.start, t.end));
  }
  const s = new MagicString(source);
  for (const [a, b] of spans) s.remove(a, b);
  const out = s.toString();
  const parsed = parseSync(canvasAbsPath, out, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(
      `remove produced invalid source: ${parsed.errors[0]?.message ?? 'parse error'}`,
      { canvas: canvasAbsPath, id: stableId }
    );
  }
  assertCompSemantics(canvasAbsPath, out); // refuse a dangling/doubled transition
  return { source: out };
}

/** Remove a clip on disk (atomic write + cross-process lock). */
export async function removeClip(
  canvasAbsPath: string,
  artboardId: string | undefined,
  stableId: string,
  expectedHash: string | undefined
): Promise<{ source: string }> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id: stableId,
      });
    }
    const source = await file.text();
    const nextSrc = applyRemoveClip(canvasAbsPath, source, artboardId, stableId, expectedHash);
    if (nextSrc.source === source) return nextSrc;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, nextSrc.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return nextSrc;
  });
}

/**
 * Reorder a clip among its STANDALONE `<Sequence>` siblings (DDR-150 P5) — the
 * z-order / render-stacking gesture (later sibling paints on top), distinct from
 * the horizontal `from`-move. Reuses the shipped `applyMove` (re-indent + reparse
 * + re-settle-through-id-churn) addressed by each clip's own cd-id, then runs the
 * semantic gate. Refuses a `<TransitionSeries.Sequence>`/`<Series.Sequence>`
 * (reordering those breaks the transition/back-to-back timing — not a stacking
 * op) and a self-move. Both `stableId`s are fingerprint-checked. Returns the moved
 * clip's stableId (recomputed from disk — a pure reorder leaves its content hash
 * unchanged, so it's found even when addressed by scoped index).
 */
export function applyReorderClip(
  canvasAbsPath: string,
  source: string,
  artboardId: string | undefined,
  movedStableId: string,
  movedHash: string | undefined,
  refStableId: string,
  refHash: string | undefined,
  position: MovePosition
): { source: string; stableId: string } {
  if (movedStableId === refStableId) {
    throw new CanvasEditError('cannot reorder a clip relative to itself', {
      canvas: canvasAbsPath,
      id: movedStableId,
    });
  }
  const moved = resolveClip(canvasAbsPath, source, artboardId, movedStableId, movedHash);
  const ref = resolveClip(canvasAbsPath, source, artboardId, refStableId, refHash);
  if (moved.tag !== 'Sequence' || ref.tag !== 'Sequence') {
    throw new CanvasEditError(
      'z-order reorder is standalone-<Sequence>-only (a TransitionSeries/Series clip carries timing that reordering would break)',
      { canvas: canvasAbsPath, id: movedStableId }
    );
  }
  if (!moved.clipCdId || !ref.clipCdId) {
    throw new CanvasEditError('clip has no addressable node to reorder', {
      canvas: canvasAbsPath,
      id: movedStableId,
    });
  }
  const res = applyMove(canvasAbsPath, source, moved.clipCdId, ref.clipCdId, position);
  assertCompSemantics(canvasAbsPath, res.source);
  // A pure reorder never touches the clip body → its content hash is preserved.
  // Re-address by that hash so a scoped-index stableId still resolves post-move.
  const after = enumerateClips(canvasAbsPath, res.source, artboardId);
  const settled = after.clips.find((c) => c.contentHash === moved.contentHash);
  return { source: res.source, stableId: settled?.stableId ?? movedStableId };
}

/** Reorder a clip on disk (atomic write + cross-process lock). */
export async function reorderClip(
  canvasAbsPath: string,
  artboardId: string | undefined,
  movedStableId: string,
  movedHash: string | undefined,
  refStableId: string,
  refHash: string | undefined,
  position: MovePosition
): Promise<{ source: string; stableId: string }> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id: movedStableId,
      });
    }
    const source = await file.text();
    const next = applyReorderClip(
      canvasAbsPath,
      source,
      artboardId,
      movedStableId,
      movedHash,
      refStableId,
      refHash,
      position
    );
    if (next.source === source) return next;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
  });
}

/** Media tags a caller may insert as a clip's child (also gated at the api layer). */
const INSERTABLE_MEDIA = new Set(['Video', 'Audio', 'Img', 'OffthreadVideo']);

/**
 * Insert a new `<Sequence>` clip into a comp (DDR-150 P4), addressed by
 * artboardId. Appends after the comp's LAST clip (matching its indentation),
 * optionally with a media child. Scoped to STANDALONE `<Sequence>` comps —
 * refuses a `<TransitionSeries>` (its overlap/transition math isn't a clean
 * append) and a comp with no existing clip to anchor to. Reparse + semantic
 * gate; `src` contained (no ../ or script schemes). Returns the new stableId.
 */
export function applyInsertClip(
  canvasAbsPath: string,
  source: string,
  artboardId: string | undefined,
  opts: { from: number; durationInFrames: number; mediaTag?: string | null; src?: string | null }
): { source: string; stableId: string | null } {
  const { clips, compName } = enumerateClips(canvasAbsPath, source, artboardId);
  if (!compName) {
    throw new CanvasEditError('no video-comp for this artboard', {
      canvas: canvasAbsPath,
      id: artboardId ?? '',
    });
  }
  if (clips.length === 0) {
    throw new CanvasEditError('comp has no existing clip to anchor the insert', {
      canvas: canvasAbsPath,
      id: artboardId ?? '',
    });
  }
  const last = clips[clips.length - 1] as ClipInfo;
  if (last.tag.startsWith('TransitionSeries.')) {
    throw new CanvasEditError(
      'cannot append into a <TransitionSeries> (transition math) — deferred',
      {
        canvas: canvasAbsPath,
        id: artboardId ?? '',
      }
    );
  }
  const from = Math.max(0, Math.round(opts.from));
  const dur = Math.max(1, Math.round(opts.durationInFrames));
  const indent = lineStartInfo(source, last.start).indent;
  let media = '';
  if (opts.mediaTag && INSERTABLE_MEDIA.has(opts.mediaTag)) {
    const src = (opts.src ?? '').trim();
    if (src && (/\.\./.test(src) || /^\s*(javascript|vbscript|file|data):/i.test(src))) {
      throw new CanvasEditError(
        'media src must be a contained asset path (no ../ or script schemes)',
        {
          canvas: canvasAbsPath,
          id: artboardId ?? '',
        }
      );
    }
    media = `\n${indent}  <${opts.mediaTag} src="${escapeAttr(src)}" />\n${indent}`;
  }
  const clipText = `\n${indent}<Sequence from={${from}} durationInFrames={${dur}}>${media}</Sequence>`;
  const s = new MagicString(source);
  s.appendLeft(last.end, clipText);
  const out = s.toString();
  const parsed = parseSync(canvasAbsPath, out, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(
      `insert produced invalid source: ${parsed.errors[0]?.message ?? 'parse error'}`,
      { canvas: canvasAbsPath, id: artboardId ?? '' }
    );
  }
  assertCompSemantics(canvasAbsPath, out);
  const after = enumerateClips(canvasAbsPath, out, artboardId);
  const newStableId = after.clips.length
    ? (after.clips[after.clips.length - 1]?.stableId ?? null)
    : null;
  return { source: out, stableId: newStableId };
}

/** Insert a clip on disk (atomic write + cross-process lock). */
export async function insertClip(
  canvasAbsPath: string,
  artboardId: string | undefined,
  opts: { from: number; durationInFrames: number; mediaTag?: string | null; src?: string | null }
): Promise<{ source: string; stableId: string | null }> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, {
        canvas: canvasAbsPath,
        id: artboardId ?? '',
      });
    }
    const source = await file.text();
    const next = applyInsertClip(canvasAbsPath, source, artboardId, opts);
    if (next.source === source) return next;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
  });
}

/**
 * Replace a media `src` that lives in an array-of-objects literal
 * (`const CLIPS = [{ src: 'assets/a.mp4', … }, …]`) — the showreel pattern where
 * a clip's `<Video src={clip.src}>` is fed by `<ClipShot clip={CLIPS[i]} />`.
 * Pure. Rewrites `NAME[index].field`'s string to `value` (contained asset path).
 * Throws `CanvasEditError` on a bad path / missing target.
 */
export function applyEditArrayElementString(
  canvasAbsPath: string,
  source: string,
  arrayName: string,
  index: number,
  field: string,
  value: string
): { source: string } {
  const v = value.trim();
  if (!v || /\.\./.test(v) || /^\s*(javascript|vbscript|file|data|https?):/i.test(v)) {
    throw new CanvasEditError('src must be a contained asset path (no ../ or scheme)', {
      canvas: canvasAbsPath,
      id: `${arrayName}[${index}].${field}`,
    });
  }
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CanvasEditError(`oxc-parser failed: ${parsed.errors[0]?.message ?? 'unknown'}`, {
      canvas: canvasAbsPath,
      id: arrayName,
    });
  }
  let arr: AnyNode | null = null;
  for (const stmt of (parsed.program?.body ?? []) as AnyNode[]) {
    if (stmt?.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations ?? []) {
      if (d?.id?.type === 'Identifier' && d.id.name === arrayName && d.init?.type === 'ArrayExpression') {
        arr = d.init;
      }
    }
  }
  if (!arr) throw new CanvasEditError(`array "${arrayName}" not found`, { canvas: canvasAbsPath, id: arrayName });
  const el = (arr.elements ?? [])[index] as AnyNode | undefined;
  if (!el || el.type !== 'ObjectExpression') {
    throw new CanvasEditError(`${arrayName}[${index}] is not an object literal`, {
      canvas: canvasAbsPath,
      id: `${arrayName}[${index}]`,
    });
  }
  const prop = (el.properties ?? []).find(
    (p: AnyNode) => p?.key?.name === field || p?.key?.value === field
  );
  const valNode = prop?.value;
  if (!valNode || (valNode.type !== 'Literal' && valNode.type !== 'StringLiteral')) {
    throw new CanvasEditError(`${arrayName}[${index}].${field} is not a string literal`, {
      canvas: canvasAbsPath,
      id: `${arrayName}[${index}].${field}`,
    });
  }
  const s = new MagicString(source);
  s.overwrite(valNode.start as number, valNode.end as number, JSON.stringify(v));
  const out = s.toString();
  const re = parseSync(canvasAbsPath, out, { sourceType: 'module' });
  if (re.errors && re.errors.length > 0) {
    throw new CanvasEditError(`edit produced invalid source: ${re.errors[0]?.message ?? 'parse error'}`, {
      canvas: canvasAbsPath,
      id: arrayName,
    });
  }
  return { source: out };
}

/** Edit an array-element src on disk (atomic write + cross-process lock). */
export async function editArrayElementString(
  canvasAbsPath: string,
  arrayName: string,
  index: number,
  field: string,
  value: string
): Promise<{ source: string }> {
  return withLock(canvasAbsPath, async () => {
    const file = Bun.file(canvasAbsPath);
    if (!(await file.exists())) {
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, { canvas: canvasAbsPath, id: arrayName });
    }
    const source = await file.text();
    const next = applyEditArrayElementString(canvasAbsPath, source, arrayName, index, field, value);
    if (next.source === source) return next;
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
  });
}

/** A clip in an assemble request — a dropped reference chip's src + kind. */
export interface AssembleClip {
  src: string;
  mediaKind: 'video' | 'audio';
  /** Intrinsic duration probed client-side; falls back to fps*3 when absent. */
  durationInFrames?: number | null;
}

/** Reject a src that isn't a contained relative asset path (no ../, no scheme). */
function assertContainedAssetSrc(src: string, canvasAbsPath: string): void {
  const t = src.trim();
  if (!t || /\.\./.test(t) || /^\s*(javascript|vbscript|file|data|https?):/i.test(t)) {
    throw new CanvasEditError(
      'clip src must be a contained asset path (assets/…, no ../ or scheme)',
      { canvas: canvasAbsPath, id: '' }
    );
  }
}

/**
 * Generate a full video-comp canvas TSX from a set of dropped reference clips
 * (DDR-150 P4 Task 12 — the "udělej z toho video" one-click). Video clips are
 * laid back-to-back as named `<Sequence>`s (explicit from/durationInFrames — so
 * they're immediately hand-editable on the Timeline, DDR-150); audio clips become
 * `<Audio>` beds under the whole reel. Only bundled Remotion imports are used
 * (skill invariant). `componentName` is the exported Canvas component; every src
 * is escaped + contained. The comp is a genuine frame-driven composition, never a
 * frozen preview. Throws `CanvasEditError` on an empty set / bad src.
 */
export function assembleCompSource(
  componentName: string,
  clips: AssembleClip[],
  opts: { fps?: number; width?: number; height?: number } = {}
): string {
  const fps = Math.max(1, Math.round(opts.fps ?? 30));
  const width = Math.max(1, Math.round(opts.width ?? 1280));
  const height = Math.max(1, Math.round(opts.height ?? 720));
  const videos = clips.filter((c) => c.mediaKind === 'video');
  const audios = clips.filter((c) => c.mediaKind === 'audio');
  if (videos.length === 0 && audios.length === 0) {
    throw new CanvasEditError('assemble needs at least one clip', { canvas: componentName, id: '' });
  }
  for (const c of clips) assertContainedAssetSrc(c.src, componentName);

  const defDur = fps * 3;
  let cursor = 0;
  const seqLines: string[] = [];
  videos.forEach((c, i) => {
    const dur = Math.max(1, Math.round(c.durationInFrames ?? defDur));
    seqLines.push(
      `      <Sequence name="clip-${i + 1}" from={${cursor}} durationInFrames={${dur}}>`,
      `        <OffthreadVideo src="${escapeAttr(c.src)}" />`,
      `      </Sequence>`
    );
    cursor += dur;
  });
  // Audio beds run under the whole reel (no seek — a bed, not a clip).
  audios.forEach((c) => {
    seqLines.push(`      <Audio src="${escapeAttr(c.src)}" />`);
  });
  const total = Math.max(cursor, defDur);

  const remotionImports = ['AbsoluteFill', 'Sequence'];
  if (videos.length) remotionImports.push('OffthreadVideo');
  if (audios.length) remotionImports.push('Audio');

  return [
    `import { DesignCanvas, DCSection, DCArtboard, VideoComp } from '@maude/canvas-lib';`,
    `import { ${remotionImports.join(', ')} } from 'remotion';`,
    ``,
    `const Comp = () => (`,
    `  <AbsoluteFill style={{ background: 'var(--bg-0)' }}>`,
    ...seqLines,
    `  </AbsoluteFill>`,
    `);`,
    ``,
    `export default function ${componentName}() {`,
    `  return (`,
    `    <DesignCanvas>`,
    `      <DCSection title="Assembled reel">`,
    `        <DCArtboard id="reel" label="Reel" width={${width}} height={${height}}>`,
    `          <VideoComp component={Comp} durationInFrames={${total}} fps={${fps}} width={${width}} height={${height}} />`,
    `        </DCArtboard>`,
    `      </DCSection>`,
    `    </DesignCanvas>`,
    `  );`,
    `}`,
    ``,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Edit shapes.

function editStringAttr(s: MagicString, opening: AnyNode, name: string, value: string): void {
  const attr = findAttribute(opening, name);
  if (attr) {
    // Replace existing value. JSX attribute value forms we handle:
    //   - <Tag name="literal" />           → replace inside the quotes
    //   - <Tag name={'literal'} />         → wrap quotes around new value
    //   - <Tag name={expr} />              → replace the whole expression text
    //   - <Tag name />                     → no value node; add `="..."`
    const v = attr.value;
    if (!v) {
      // <Tag name /> → <Tag name="value" />
      s.appendLeft(attr.end, `="${escapeAttr(value)}"`);
      return;
    }
    if (v.type === 'Literal' || v.type === 'StringLiteral') {
      // Replace the whole `"value"` (quotes included) so we control the escaping.
      // The value lands in a JSX *attribute*, where `"` must become `&quot;` and
      // `<`/`>` their entities — NOT JS backslash escaping. `JSON.stringify` would
      // emit `\"`, which is invalid in a JSX attribute and corrupts the source on
      // any value containing a double quote. Use the same `escapeAttr` as the two
      // insert branches so all four paths agree. See DDR-103 / DDR-105.
      s.overwrite(v.start, v.end, `"${escapeAttr(value)}"`);
      return;
    }
    if (v.type === 'JSXExpressionContainer') {
      // Replace the whole `{...}` with a plain quoted literal — keeps the
      // resulting JSX readable. Same JSX-attribute escaping as above (NOT
      // `JSON.stringify`, which would JS-escape a `"` and corrupt the source).
      s.overwrite(v.start, v.end, `"${escapeAttr(value)}"`);
      return;
    }
    // Unknown shape — refuse rather than corrupt.
    throw new Error(`Unsupported JSX attribute value shape: ${v.type}`);
  }
  // Attribute missing — insert right after the tag name (mirrors pipeline's
  // injection point so attribute order stays predictable).
  const insertAt: number | undefined = opening?.name?.end;
  if (typeof insertAt !== 'number') {
    throw new Error('Opening element has no resolvable name range');
  }
  s.appendLeft(insertAt, ` ${name}="${escapeAttr(value)}"`);
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;').replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));
}

/**
 * Escape JSX-significant characters so user-typed text lands in source `.tsx`
 * as inert TEXT, never as markup or an expression. The text is written between
 * an element's tags (`<button>HERE</button>`), where `<`/`>` would start a tag
 * and `{`/`}` would open a JSX expression — so all four (plus a bare `&`, which
 * begins an entity) are encoded. This is the load-bearing guard that keeps the
 * inline text editor (Phase 12) from being a source-injection vector. See
 * DDR-103.
 */
function escapeJsxText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

function editStyleProp(
  s: MagicString,
  opening: AnyNode,
  prop: string,
  value: string,
  canvasAbsPath: string,
  id: string
): void {
  const attr = findAttribute(opening, 'style');
  if (!attr) {
    // No style prop yet — insert one with a single key.
    const insertAt: number | undefined = opening?.name?.end;
    if (typeof insertAt !== 'number') {
      throw new Error('Opening element has no resolvable name range');
    }
    s.appendLeft(insertAt, ` style={{ ${jsKey(prop)}: ${value} }}`);
    return;
  }
  const v = attr.value;
  if (v?.type !== 'JSXExpressionContainer') {
    throw new CanvasEditError(
      `style attribute on ${id} is not a {{...}} expression — refusing to edit`,
      { canvas: canvasAbsPath, id }
    );
  }
  const obj = v.expression;
  if (obj?.type !== 'ObjectExpression') {
    throw new CanvasEditError(
      `style={...} on ${id} is not an inline ObjectExpression — refusing to edit`,
      { canvas: canvasAbsPath, id }
    );
  }

  // Search for an existing property with the same key. JSX styles permit
  // camelCase identifiers (paddingTop) AND quoted strings ("padding-top").
  // Compare both forms.
  const propCamel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  for (const p of obj.properties as AnyNode[]) {
    if (p?.type !== 'Property' && p?.type !== 'ObjectProperty') continue;
    const k = p.key;
    if (!k) continue;
    const kname = k.type === 'Identifier' ? k.name : k.type === 'Literal' ? String(k.value) : null;
    if (kname === prop || kname === propCamel) {
      s.overwrite(p.value.start, p.value.end, value);
      return;
    }
  }

  // Key missing — append before the closing `}`. ObjectExpression's last char
  // is the `}`; magic-string appendLeft at end keeps the brace in place.
  //
  // TRAILING-COMMA guard: a frame-driven inline style often ends the last
  // property with a trailing comma (`opacity: o,\n}`). Unconditionally
  // prepending `, ` there produced `opacity: o, , color: X` — a double comma =
  // syntax error, so the canvas failed to rebuild and the Player kept rendering
  // the OLD source (the "my CSS edit resets when I replay the video" bug).
  // Detect an existing trailing comma between the last property and the `}` and
  // omit our separating comma when one is already there.
  const props = obj.properties as AnyNode[];
  let sep = ' ';
  if (props.length > 0) {
    const lastEnd = props[props.length - 1].end as number;
    const between = s.original.slice(lastEnd, (obj.end as number) - 1);
    sep = /,/.test(between) ? ' ' : ', ';
  }
  // The object's textual end is `obj.end - 1` for `}` after the chars.
  // appendLeft at obj.end -1 puts new text before the `}`.
  s.appendLeft((obj.end as number) - 1, `${sep}${jsKey(prop)}: ${value} `);
}

/**
 * Remove a single inline-style property (the "reset to original" path — DDR-104
 * Phase 12.3). No-op when the style attribute or the key is absent. When the key
 * was the object's ONLY property, the whole `style={{…}}` attribute is removed so
 * we don't leave an empty `style={{}}` behind.
 */
function removeStyleProp(s: MagicString, opening: AnyNode, prop: string, source: string): boolean {
  const attr = findAttribute(opening, 'style');
  if (!attr) return false;
  const v = attr.value;
  if (v?.type !== 'JSXExpressionContainer') return false;
  const obj = v.expression;
  if (obj?.type !== 'ObjectExpression') return false;
  const props = (obj.properties as AnyNode[]).filter(
    (p) => p?.type === 'Property' || p?.type === 'ObjectProperty'
  );
  const propCamel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const idx = props.findIndex((p) => {
    const k = p.key;
    const kname =
      k?.type === 'Identifier' ? k.name : k?.type === 'Literal' ? String(k.value) : null;
    return kname === prop || kname === propCamel;
  });
  if (idx === -1) return false;

  // Only property → drop the whole `style={{…}}` attribute (plus the leading space).
  if (props.length === 1) {
    const start = source[attr.start - 1] === ' ' ? attr.start - 1 : attr.start;
    s.remove(start, attr.end);
    return true;
  }
  // Otherwise remove the one property + one adjacent comma/whitespace run so the
  // remaining object stays well-formed: consume forward to the next prop's start
  // (eats the trailing `, `), or — for the last prop — backward from the previous
  // prop's end (eats the leading `, `).
  const target = props[idx];
  if (idx < props.length - 1) {
    s.remove(target.start as number, props[idx + 1].start as number);
  } else {
    s.remove(props[idx - 1].end as number, target.end as number);
  }
  return true;
}

/**
 * Remove a plain JSX attribute (the custom-attribute "reset" path). No-op when
 * absent. Refuses `data-cd-id` / `style` (pipeline-owned / wrong endpoint).
 */
function removeStringAttr(s: MagicString, opening: AnyNode, name: string, source: string): boolean {
  if (name === 'data-cd-id' || name === 'style') return false;
  const attr = findAttribute(opening, name);
  if (!attr) return false;
  const start = source[attr.start - 1] === ' ' ? attr.start - 1 : attr.start;
  s.remove(start, attr.end);
  return true;
}

/**
 * Render a JS object key — bare identifier when the prop is camelCase + valid
 * JS id, quoted otherwise. Mirrors how authors write JSX styles.
 */
function jsKey(prop: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(prop)) return prop;
  return JSON.stringify(prop);
}

// ---------------------------------------------------------------------------
// CLI entry. Invoked by bin/canvas-edit.sh — keeps Bun startup off the hot
// path of /design:edit when the orchestrator shells out.
//
// Layout:  bun run canvas-edit.ts --invoke <canvas> <id> <attr> <value>

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--invoke' && argv.length === 5) {
    const [, canvas, id, attr, value] = argv;
    if (!canvas || !id || !attr || value === undefined) {
      console.error('canvas-edit: --invoke needs <canvas> <id> <attr> <value>');
      process.exit(2);
    }
    try {
      const r = await editAttribute(canvas, id, attr, value);
      console.log(JSON.stringify({ canvas, id, delta: r.delta }));
      process.exit(0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`canvas-edit: ${msg}`);
      process.exit(2);
    }
  } else {
    console.error('Usage: bun run canvas-edit.ts --invoke <canvas> <id> <attr> <value>');
    process.exit(2);
  }
}
