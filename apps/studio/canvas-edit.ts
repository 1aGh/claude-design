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
// Per-canvas mutex. Mirrors locator.ts; two concurrent edits against the same
// .tsx file serialise so they can't race read-modify-write.

const locks = new Map<string, Promise<void>>();
function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(filePath) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  const next = prev.then(() => gate);
  locks.set(filePath, next);
  return prev.then(fn).finally(() => {
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
    if (next.source === source) return { source, delta: 0 };
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
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
    if (next.source === source) return { source, delta: 0 };
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
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
    if (next.source === source) return { source, delta: 0 };
    const tmp = `${canvasAbsPath}.tmp.${Math.random().toString(36).slice(2, 10)}`;
    await Bun.write(tmp, next.source);
    const { rename } = await import('node:fs/promises');
    await rename(tmp, canvasAbsPath);
    return next;
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
  const out: Array<{ id: string; componentName: string; isFrameRoot: boolean; tag: string | null }> =
    [];
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
function resolveUsageId(program: AnyNode, domId: string, occurrenceIndex: number | undefined): string {
  const all = collectElementsFull(program);
  const target = all.find((e) => e.id === domId);
  if (!target || !target.componentName) return domId;
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
      throw new CanvasEditError(`Canvas not found: ${canvasAbsPath}`, { canvas: canvasAbsPath, id });
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
  const props = obj.properties as AnyNode[];
  const tail = props.length > 0 ? (props[props.length - 1].end as number) : obj.start + 1;
  const sep = props.length > 0 ? ', ' : ' ';
  // The object's textual end is `obj.end - 1` for `}` after the chars.
  // appendLeft at obj.end -1 puts new text before the `}`.
  s.appendLeft(obj.end - 1, `${sep}${jsKey(prop)}: ${value} `);
  // Suppress unused-var lint without bypassing TS:
  void tail;
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
