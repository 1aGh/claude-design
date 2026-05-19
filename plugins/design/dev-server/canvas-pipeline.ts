// Two-pass canvas TSX transform (DDR-019, Phase 3.6 Task 1).
//
// Pass 1 — parse the source with oxc-parser, walk JSX elements in pre-order,
// inject ` data-cd-id="<8 hex>"` on every opening element via magic-string
// byte-range append. The ID is derived from `Bun.hash(componentName + ":" + idx)`
// so it survives whitespace edits inside the same component but renumbers on
// sibling insertion (documented contract — see DDR-019 "Identity stability").
//
// Pass 2 — Bun.Transpiler lowers TSX to JS. The output is re-parsed by the
// caller's smoke test to confirm parseability; making it BROWSER-loadable is
// the _shell.html + react-runtime bundle's job (Task 6, future session).
//
// Exports are pure: no fs writes, no side effects. The route handler (http.ts)
// calls writeLocator(...) and serves the JS body itself.
//
// Toolchain matches scripts/migrate-canvases.ts (codemod) and canvas-edit.ts
// (AST-aware /design:edit element edits) — same oxc-parser + magic-string pair
// in three call sites, one mental model.

import MagicString from 'magic-string';
import { parseSync } from 'oxc-parser';

import type { LocatorEntry, LocatorMap } from './locator.ts';

export interface TranspileResult {
  /** TSX -> JS output from Bun.Transpiler. Browser-loadable contract is Task 6's job. */
  js: string;
  /** Map of injected `data-cd-id` -> source location, one entry per JSX element. */
  locator: LocatorMap;
  /** ETag derived from the post-pass-1 source (the source the browser would see decompiled). */
  etag: string;
  /** Source after Pass 1 (data-cd-id injected, JSX still). Useful for tests + debugging. */
  withIds: string;
}

let cachedTranspiler: InstanceType<typeof Bun.Transpiler> | null = null;
function getTranspiler(): InstanceType<typeof Bun.Transpiler> {
  if (cachedTranspiler) return cachedTranspiler;
  // jsx: "automatic" pairs with jsxImportSource: "react" — produces calls to
  // jsx/jsxDEV/Fragment from "react/jsx-dev-runtime". Resolution is the loader's
  // problem (Task 6); Pass 2 here just lowers syntax.
  cachedTranspiler = new Bun.Transpiler({
    loader: 'tsx',
    target: 'browser',
    tsconfig: JSON.stringify({
      compilerOptions: { jsx: 'react-jsx', jsxImportSource: 'react' },
    }),
  });
  return cachedTranspiler;
}

/**
 * Transpile a canvas TSX file end-to-end (parse -> inject IDs -> JSX lower).
 * Pure — no fs writes. Caller persists the locator map via writeLocator().
 *
 * @param canvasAbsPath  Absolute path of the .tsx file (used as the locator key + diagnostics).
 * @param source         Raw TSX source. Caller is responsible for reading it via Bun.file().
 */
export function transpileCanvasSource(canvasAbsPath: string, source: string): TranspileResult {
  const parsed = parseSync(canvasAbsPath, source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    const where = first?.labels?.[0]?.start ?? 0;
    throw new TranspileError(
      `oxc-parser failed on ${canvasAbsPath} (${parsed.errors.length} errors). First: ${first?.message ?? 'unknown'} at byte ${where}.`,
      { canvas: canvasAbsPath, byte: where }
    );
  }

  const s = new MagicString(source);
  const locator: LocatorMap = {};

  walkInjectIds(parsed.program, source, canvasAbsPath, s, locator);

  const withIds = s.toString();
  const js = getTranspiler().transformSync(withIds);
  const etag = Bun.hash(withIds).toString(16);

  return { js, locator, etag, withIds };
}

export class TranspileError extends Error {
  readonly canvas: string;
  readonly byte: number;
  constructor(message: string, info: { canvas: string; byte: number }) {
    super(message);
    this.name = 'TranspileError';
    this.canvas = info.canvas;
    this.byte = info.byte;
  }
}

// ---------------------------------------------------------------------------
// AST walker — pre-order over the parsed program; tracks the enclosing
// component (PascalCase FunctionDeclaration / Variable+ArrowFunction) so each
// JSX element's ID is scoped to its component.

interface ComponentFrame {
  componentName: string;
  /** Pre-order JSX index within the component. */
  jsxIndex: number;
  /** Stack of element-type names from the component root down to current. */
  jsxPath: string[];
}

// biome-ignore lint/suspicious/noExplicitAny: oxc-parser AST nodes are heterogeneous; we shape-check at use site.
type AnyNode = any;

const PASCAL_CASE = /^[A-Z][A-Za-z0-9_]*$/;

function isPascalIdent(name: unknown): name is string {
  return typeof name === 'string' && PASCAL_CASE.test(name);
}

function componentNameOf(node: AnyNode): string | null {
  if (!node || typeof node !== 'object') return null;
  // function Foo() { ... }
  if (node.type === 'FunctionDeclaration' && isPascalIdent(node.id?.name)) {
    return node.id.name;
  }
  // const Foo = () => ...  /  const Foo = function() { ... }
  if (node.type === 'VariableDeclarator' && isPascalIdent(node.id?.name)) {
    const init = node.init;
    if (init && (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression')) {
      return node.id.name;
    }
  }
  // export default function Foo() { ... }
  if (node.type === 'FunctionExpression' && isPascalIdent(node.id?.name)) {
    return node.id.name;
  }
  return null;
}

function jsxElementName(opening: AnyNode): string {
  const name = opening?.name;
  if (!name) return '?';
  if (name.type === 'JSXIdentifier') return name.name ?? '?';
  if (name.type === 'JSXMemberExpression') {
    // e.g. <motion.div>  ->  "motion.div"
    const parts: string[] = [];
    let cur: AnyNode = name;
    while (cur?.type === 'JSXMemberExpression') {
      if (cur.property?.name) parts.unshift(cur.property.name);
      cur = cur.object;
    }
    if (cur?.type === 'JSXIdentifier') parts.unshift(cur.name);
    return parts.join('.') || '?';
  }
  if (name.type === 'JSXNamespacedName') {
    return `${name.namespace?.name ?? '?'}:${name.name?.name ?? '?'}`;
  }
  return '?';
}

function hasDataCdIdAttr(opening: AnyNode): boolean {
  const attrs = opening?.attributes;
  if (!Array.isArray(attrs)) return false;
  for (const a of attrs) {
    if (
      a?.type === 'JSXAttribute' &&
      a.name?.type === 'JSXIdentifier' &&
      a.name.name === 'data-cd-id'
    ) {
      return true;
    }
  }
  return false;
}

function computeId(componentName: string, idx: number): string {
  // 8 hex chars from Bun.hash — 32 bits of entropy. Per-component collision
  // probability for the canvas-scale we ship (≤ ~300 JSX elements) is < 1e-5.
  // Documented in DDR-019; 16 chars available as a future migration knob.
  return Bun.hash(`${componentName}:${idx}`).toString(16).padStart(16, '0').slice(0, 8);
}

function walkInjectIds(
  program: AnyNode,
  source: string,
  canvasAbsPath: string,
  s: MagicString,
  locator: LocatorMap
): void {
  // Stack of enclosing components. JSX outside any component (e.g. a top-level
  // `const x = <div/>;` constant) attributes to "" -- still gets an ID, just
  // scoped under the empty-string bucket. Rare in practice.
  const stack: ComponentFrame[] = [{ componentName: '', jsxIndex: 0, jsxPath: [] }];
  const top = (): ComponentFrame => stack[stack.length - 1] as ComponentFrame;

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
      stack.push({ componentName: newComp, jsxIndex: 0, jsxPath: [] });
      pushed = true;
    }

    if (node.type === 'JSXElement') {
      const frame = top();
      const opening = node.openingElement;
      const elName = jsxElementName(opening);
      const idx = frame.jsxIndex;
      frame.jsxIndex += 1;

      if (!hasDataCdIdAttr(opening)) {
        const id = computeId(frame.componentName, idx);
        // Insert " data-cd-id=\"<id>\"" right after the tag name. magic-string's
        // appendLeft puts the new text before any subsequent attribute. JSX
        // attribute order is irrelevant at runtime; visually the new attr lands
        // first, which makes it easy to spot in devtools.
        const insertAt: number | undefined = opening?.name?.end;
        if (typeof insertAt === 'number') {
          s.appendLeft(insertAt, ` data-cd-id="${id}"`);
          const entry: LocatorEntry = {
            canvas: canvasAbsPath,
            line: node.loc?.start?.line ?? lineColFromByte(source, node.start).line,
            col: node.loc?.start?.column ?? lineColFromByte(source, node.start).col,
            jsxPath: [...frame.jsxPath, elName],
            componentName: frame.componentName,
          };
          locator[id] = entry;
        }
      }

      // Recurse into opening attributes + children, with the jsxPath extended.
      frame.jsxPath.push(elName);
      if (opening) visit(opening.attributes);
      visit(node.children);
      frame.jsxPath.pop();

      if (pushed) stack.pop();
      return;
    }

    // Generic recursion — visit every own value that isn't location metadata.
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end' || k === 'type') continue;
      visit(node[k]);
    }

    if (pushed) stack.pop();
  }

  visit(program);
}

// oxc-parser populates node.loc on most nodes, but defensively recompute from
// the byte offset if it's missing (some attribute children skip it).
function lineColFromByte(source: string, byte: number | undefined): { line: number; col: number } {
  if (typeof byte !== 'number' || byte < 0) return { line: 1, col: 0 };
  let line = 1;
  let col = 0;
  for (let i = 0; i < byte && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
      col = 0;
    } else {
      col += 1;
    }
  }
  return { line, col };
}
