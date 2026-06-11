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
 * Apply an inline TEXT-content edit to the JSX element with the given
 * `data-cd-id`. Leaf-text only: the element's children must be exactly one
 * `JSXText` node (whitespace-only siblings are ignored). Mixed/expression
 * children (`<b>x</b>`, `{count}`) throw `CanvasEditError` — the caller should
 * surface a "use /design:edit" refusal rather than guess. The text is
 * JSX-escaped before it touches source. Same atomic write + per-file lock as
 * `editAttribute`. See DDR-101.
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
      // Replace just the value text, keeping surrounding quotes.
      s.overwrite(v.start, v.end, JSON.stringify(value));
      return;
    }
    if (v.type === 'JSXExpressionContainer') {
      // Replace the whole `{...}` with a plain quoted literal — keeps the
      // resulting JSX readable, no escaping gymnastics.
      s.overwrite(v.start, v.end, JSON.stringify(value));
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
 * DDR-101.
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
  if (!v || v.type !== 'JSXExpressionContainer') {
    throw new CanvasEditError(
      `style attribute on ${id} is not a {{...}} expression — refusing to edit`,
      { canvas: canvasAbsPath, id }
    );
  }
  const obj = v.expression;
  if (!obj || obj.type !== 'ObjectExpression') {
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
