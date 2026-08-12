/**
 * @file       figma/from-codegen.ts — Figma Dev Mode codegen → one Maude artboard.
 * @scope      apps/studio/figma/from-codegen.ts
 * @purpose    Convert the React + Tailwind MODULE the local Dev Mode server
 *             returns into a `DCArtboard` a Maude canvas renders and a human
 *             edits — for ONE frame, on explicit invocation (`--explode`).
 *
 * @rationale  Two earlier routes were built and both measured broken on the same
 *             live file (DDR-219 § Context). Route 1 derived layout from the node
 *             tree, which means reimplementing auto-layout, constraints,
 *             clipping, blend modes and vector networks in CSS — the bug surface
 *             grows with the fidelity of the source. Route 2 rendered each frame
 *             to an image, which is faithful and inert. This route asks Figma for
 *             the layout ALREADY RESOLVED and converts the result. The editability
 *             bar is met, not abandoned — but it is met by taking Figma's DOM
 *             rather than by deriving one.
 *
 * @invariant  THE MODULE STAYS REACT. The first spike flattened to HTML by
 *             stripping with regexes, and on the first real screen it rendered
 *             `type IconsProps = …` as visible body text — exactly the defect
 *             class the "named parser, never regex" rule exists to prevent.
 *             A real response is a MODULE: asset constants, a type alias, a
 *             parameterized helper component, then the default export. Maude
 *             canvases ARE React, so keeping the helper is both natively
 *             renderable and strictly MORE editable than inlining it fourteen
 *             times.
 *
 * @invariant  EVERY IDENTIFIER IS REGENERATED (DDR-216 D6 via DDR-219 D4).
 *             D6 calls the identifier space "airtight — there is no Figma string
 *             in it at all", and that holds only because every name comes from
 *             `identifierFromNodeId`. Codegen returns React source carrying its
 *             OWN names, derived from layer names
 *             (`Component231320F78B2B43C7B5A04A6Ff8B6244C45005C` was measured).
 *             So: component names, parameter names and local names are ALL
 *             discarded and regenerated. Only string VALUES survive, escaped.
 *
 * @invariant  ELEMENT AND ATTRIBUTE ALLOWLISTS, NEVER DENYLISTS (D5 rule 3). A
 *             denylist has to remember `<script>`, `<style>`, `<iframe>`,
 *             `<foreignObject>`, `on*`, `href`, `dangerouslySetInnerHTML`.
 *             An allowlist does not.
 *
 * @invariant  THE PARSER'S LEAF ENUMERATION IS THE CONTROL — not `sanitize.ts`
 *             "in full", which is not a thing that can be done (D4): every
 *             export there is a FIELD-LEVEL string function, and
 *             `jsxStringLiteral` run over a JSX document destroys the markup.
 *             What is true is that every string this module *extracts* — text
 *             node, attribute value, class token — goes through the right
 *             field-level function on the way out.
 *
 * @invariant  A PARSE ERROR REFUSES THE FRAME (D5 rule 4). Never a partial
 *             artboard: a half-converted screen that renders is this feature's
 *             signature failure mode (report success, deliver something else).
 *
 * @invariant  ASSET URLS ARE DISCARDED (D6). The response carries loopback
 *             `assets/<sha1>.svg` constants served by the Dev Mode server
 *             itself; every one is
 *             thrown away and the artwork is re-requested BY NODE ID through the
 *             existing `/v1/images` lane — same frozen host allowlist, same byte
 *             sniff, same DDR-167 SVG lane, same `renderKey` dedupe. There is no
 *             new URL surface, and the local server's loopback links (which
 *             `_fetch-asset.mjs` refuses three ways, correctly) never arise.
 *
 * @invariant  `Object.create(null)` FOR EVERY MAP KEYED BY A PARSED STRING
 *             (D5 rule 5), and `__proto__`/`constructor`/`prototype` are skipped
 *             wherever a key comes from the document.
 *
 * @dependency `oxc-parser` — and this is the named-parser decision D5 rule 1
 *             asks for, not an implementation detail. It is ALREADY a production
 *             dependency of `apps/studio` (`package.json` `dependencies`), with
 *             all seven platform bindings already staged in `devDependencies`,
 *             and it ALREADY parses third-party-authored TSX in this exact repo
 *             (`canvas-pipeline.ts` parses every canvas; `ripple.ts`,
 *             `clip-ops.ts`, `canvas-lib-inline.ts` likewise). So the two costs
 *             D5 named — "a different risk class from a JS parser" and "it drags
 *             per-platform staging (D12)" — are both ALREADY PAID by shipped
 *             code. Choosing it adds no dependency, no staging and no new
 *             platform matrix; hand-rolling a TSX parser would add several
 *             hundred lines of novel code whose whole job is to be correct on
 *             hostile input, which is the strictly worse trade. DDR-042 records
 *             the bun-compile workaround it needs, and that is already in place.
 */

import { parseSync } from 'oxc-parser';
import { FontSubstitutions, type FontToken } from './codegen-fonts.ts';
import {
  cssPropToCamel,
  isAllowedArbitraryProperty,
  isCodegenColor,
  isCodegenKeyword,
  isCodegenLength,
  isCodegenLengthList,
  isCodegenNumber,
  isCodegenShortValueList,
} from './codegen-values.ts';
import {
  attrValue,
  cleanText,
  type ImportReport,
  identifierFromNodeId,
  jsxStringLiteral,
} from './sanitize.ts';
import type { DsToken } from './style-map.ts';
import { mapClassName, type TailwindContext } from './tailwind-map.ts';

// ── Caps (D5 rule 2 — the response's OWN input-side bounds) ─────────────────
//
// D5's existing 512 KB is an OUTPUT cap and `client.ts`'s 8 MB is enforced on a
// REST response this one never traverses. Measured: a real 375×812 screen is
// 32 KB of code.

/** Source bytes we will parse at all. */
export const MAX_SOURCE_BYTES = 512 * 1024;
/** Emitted JSX bytes per artboard (D5). */
export const MAX_OUTPUT_BYTES = 512 * 1024;
/** JSX nodes across the whole module. */
export const MAX_JSX_NODES = 5_000;
/** JSX nesting depth. Measured max on a real file: 13. */
export const MAX_JSX_DEPTH = 40;
/** Helper components. Figma emits one per component variant set. */
export const MAX_COMPONENTS = 64;
/** One text run. Longer is truncated and reported, never dropped. */
export const MAX_TEXT_LEN = 2_000;
/** Module-level `const` asset declarations. */
export const MAX_ASSET_CONSTS = 512;

/**
 * Elements this converter will emit. D5 rule 3, verbatim, plus `br`.
 *
 * Measured surface on a real screen: `div` ×132, `img` ×34, `p` ×26 and one
 * helper component. The list is already generous against that.
 *
 * `svg` is deliberately ABSENT. Inline third-party SVG is a whole other risk
 * class — the one DDR-167 exists for — and codegen hands vectors over as
 * `<img src>` anyway, which is the containment the render route also relies on.
 */
const ELEMENT_ALLOWLIST: ReadonlySet<string> = new Set([
  'div',
  'span',
  'p',
  'ul',
  'ol',
  'li',
  'img',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** Elements that may not have children. */
const VOID_ELEMENTS: ReadonlySet<string> = new Set(['img', 'br']);

/** Attributes read off the source. `className` is CONSUMED, never emitted. */
const ATTRIBUTE_ALLOWLIST: ReadonlySet<string> = new Set([
  'className',
  'style',
  'src',
  'alt',
  'data-node-id',
]);

/** A Figma node id, including the instance form `I425:2940;0:95`. Charset
 *  excludes every character that could terminate a JSX attribute literal. */
const NODE_ID_ATTR_RE = /^[A-Za-z0-9:;_-]{1,120}$/;

/** Keys that must never be written into a map built from parsed input. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Refusal. Its message is code-owned and reaches verb stdout (D10). */
export class CodegenConvertError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`codegen conversion refused: ${reason}`);
    this.name = 'CodegenConvertError';
    this.reason = reason;
  }
}

export interface ConvertOptions {
  /** The frame's Figma node id — the identifier space's only root. */
  nodeId: string;
  /** Already `attrValue`-bounded by the caller. */
  label: string;
  width: number;
  height: number;
  kind: string;
  tokens?: readonly DsToken[];
  fontTokens?: readonly FontToken[];
  threshold?: number;
  report: ImportReport;
}

export interface PendingCodegenAsset {
  nodeId: string;
  format: 'svg';
  placeholder: string;
}

export interface ConvertResult {
  /** The `<DCArtboard>…</DCArtboard>` block, ready to splice into a canvas. */
  artboardJsx: string;
  /** Helper component declarations, for module scope above the canvas export. */
  helpers: string;
  /** Artwork to fetch by node id through the existing `/v1/images` lane (D6). */
  pendingAssets: PendingCodegenAsset[];
  /** Distinct Tailwind utilities the mapper did not know. */
  unmappedUtilities: string[];
  bytes: number;
  /**
   * The root element's own `data-node-id`, for the open-document cross-check.
   * `null` when the response did not carry one.
   */
  rootNodeId: string | null;
  /**
   * The root element's `data-name`, `attrValue`-bounded — the raw layer name is
   * NEVER kept. Compared against the stored frame label by the caller and then
   * discarded; it exists only to answer "is this the document we imported?"
   * (DDR-219 probe finding 1 / residual 8).
   */
  rootName: string;
}

// ── AST helpers ─────────────────────────────────────────────────────────────

/* biome-ignore-start lint/suspicious/noExplicitAny: oxc AST nodes are
   heterogeneous; every access below is shape-checked at its use site, which is
   the same discipline canvas-pipeline.ts states for the same parser. */
type Node = any;

/** oxc preserves `(expr)`. Every expression read must unwrap it first. */
function unparen(n: Node): Node {
  let cur = n;
  for (let i = 0; i < 8 && cur && cur.type === 'ParenthesizedExpression'; i += 1)
    cur = cur.expression;
  return cur;
}

function isStringLiteral(n: Node): boolean {
  return n && n.type === 'Literal' && typeof n.value === 'string';
}

function jsxName(n: Node): string | null {
  if (!n) return null;
  if (n.type === 'JSXIdentifier') return String(n.name);
  // `<Foo.Bar>` / `<svg:use>` — refused by returning null, never resolved.
  return null;
}

function attrName(a: Node): string | null {
  if (a.type !== 'JSXAttribute') return null;
  return jsxName(a.name);
}

// ── The converter ───────────────────────────────────────────────────────────

interface ComponentDecl {
  /** The regenerated name. The source name never survives. */
  name: string;
  /** original prop name → regenerated parameter name. */
  props: Map<string, string>;
  /** original prop name → its string-literal default, already escaped. */
  defaults: Map<string, string>;
  /** original local const → regenerated name. */
  locals: Map<string, string>;
  /** The prop that carried `className`, renamed to a STYLE object. */
  styleProp: string | null;
  node: Node;
}

/**
 * Convert one codegen module.
 *
 * The whole function is a single pass with hard caps and no recovery: anything
 * outside the supported subset throws, and the caller turns that into a refusal
 * with a `codegen-unavailable` disposition. There is deliberately no "best
 * effort" branch — a design importer that guesses is worse than one that stops.
 */
export function convertCodegenModule(source: string, opts: ConvertOptions): ConvertResult {
  if (source.length > MAX_SOURCE_BYTES) throw new CodegenConvertError('response over the size cap');
  if (source.length === 0) throw new CodegenConvertError('empty response');

  const parsed = parseSync('figma-codegen.tsx', source, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    // The parser's own message can quote the source, so it is NOT propagated
    // (D10: every byte this verb prints is code-owned).
    throw new CodegenConvertError('response did not parse as a TSX module');
  }

  const tw: TailwindContext = {
    ...(opts.tokens ? { tokens: opts.tokens } : {}),
    ...(opts.fontTokens ? { fontTokens: opts.fontTokens } : {}),
    ...(opts.threshold !== undefined ? { threshold: opts.threshold } : {}),
  };
  const root = identifierFromNodeId(opts.nodeId);
  const fonts = new FontSubstitutions();
  const unmapped = new Set<string>();
  const pendingAssets: PendingCodegenAsset[] = [];
  const assetPlaceholders = new Map<string, string>();

  /** Asset constant name → its (discarded) URL. Kept only so a `src={ident}`
   *  can be RECOGNISED as an asset reference rather than an unknown identifier. */
  const assetConsts: Set<string> = new Set();
  const components: ComponentDecl[] = [];
  const byOriginalName = new Map<string, ComponentDecl>();
  let rootComponent: ComponentDecl | null = null;
  let jsxNodes = 0;

  // ── Pass 1 — top-level shape ──
  for (const stmt of parsed.program.body as Node[]) {
    switch (stmt.type) {
      case 'VariableDeclaration': {
        for (const d of stmt.declarations) {
          if (d.id?.type !== 'Identifier' || !isStringLiteral(unparen(d.init))) {
            throw new CodegenConvertError('unsupported module-level declaration');
          }
          if (assetConsts.size >= MAX_ASSET_CONSTS) {
            throw new CodegenConvertError('too many asset constants');
          }
          // The URL is READ AND DROPPED HERE. Nothing downstream can reach it,
          // which is what makes D6 structural rather than a convention.
          assetConsts.add(String(d.id.name));
        }
        break;
      }
      case 'TSTypeAliasDeclaration':
      case 'TSInterfaceDeclaration':
        // Types are dropped wholesale — we regenerate plain-JS signatures, so
        // there is nothing for a type to describe. (The first spike left these
        // in the output and they rendered as body text.)
        break;
      case 'FunctionDeclaration': {
        const decl = declareComponent(stmt, root, components.length);
        components.push(decl);
        if (stmt.id?.name) byOriginalName.set(String(stmt.id.name), decl);
        break;
      }
      case 'ExportDefaultDeclaration': {
        const inner = stmt.declaration;
        if (inner?.type !== 'FunctionDeclaration') {
          throw new CodegenConvertError('default export is not a component');
        }
        const decl = declareComponent(inner, root, components.length);
        rootComponent = decl;
        if (inner.id?.name) byOriginalName.set(String(inner.id.name), decl);
        break;
      }
      default:
        throw new CodegenConvertError('unsupported module-level statement');
    }
    if (components.length > MAX_COMPONENTS) throw new CodegenConvertError('too many components');
  }
  if (!rootComponent) throw new CodegenConvertError('no default-exported component');

  // ── Emission ──

  /** Escape + bound one text run; empty means "nothing to emit". */
  function textChild(raw: string): string | null {
    const trimmed = raw.replace(/\s+/g, ' ');
    if (trimmed.trim().length === 0) return null;
    const clean = cleanText(trimmed, MAX_TEXT_LEN);
    if (clean.strippedHidden) {
      opts.report.add(opts.nodeId, 'TEXT', 'hidden-chars-dropped', 'codegen text');
    }
    if (clean.truncated) opts.report.add(opts.nodeId, 'TEXT', 'truncated-text', 'codegen text');
    if (clean.text.trim().length === 0) return null;
    return `{${jsxStringLiteral(clean.text)}}`;
  }

  /** A validated declaration map → a JSX style-object literal. */
  function styleLiteral(decls: Record<string, string>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(decls)) {
      // Keys come from OUR tables, never from the document — but the guard is
      // free and this is a map that a future edit could start feeding parsed
      // keys into.
      if (FORBIDDEN_KEYS.has(k) || !/^[A-Za-z][A-Za-z0-9]{0,48}$/.test(k)) continue;
      parts.push(`${k}: ${jsxStringLiteral(v)}`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  /**
   * Read an inline `style={{…}}`. Figma emits exactly one on a real screen
   * (`fontVariationSettings`), but it is a direct write into the style object so
   * it gets the same property allowlist as the bracket utilities.
   */
  function inlineStyle(expr: Node): Record<string, string> {
    const out: Record<string, string> = Object.create(null);
    const obj = unparen(expr);
    if (obj?.type !== 'ObjectExpression') return out;
    for (const prop of obj.properties as Node[]) {
      if (prop.type !== 'Property' || prop.computed) continue;
      const key = prop.key?.type === 'Identifier' ? String(prop.key.name) : prop.key?.value;
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) continue;
      const camel = cssPropToCamel(key);
      // The allowlist is spelled in kebab-case, so probe both spellings rather
      // than assuming which form the document used.
      const kebab = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      if (!isAllowedArbitraryProperty(kebab)) {
        unmapped.add(`style:${attrValue(key, 24)}`);
        continue;
      }
      const value = unparen(prop.value);
      const raw =
        value?.type === 'Literal' &&
        (typeof value.value === 'string' || typeof value.value === 'number')
          ? String(value.value)
          : null;
      if (raw === null) {
        unmapped.add(`style:${attrValue(key, 24)}`);
        continue;
      }
      if (
        !isCodegenKeyword(raw) &&
        !isCodegenLength(raw) &&
        !isCodegenNumber(raw) &&
        !isCodegenLengthList(raw) &&
        !isCodegenShortValueList(raw) &&
        !isCodegenColor(raw) &&
        !/^"[A-Za-z]{1,8}" -?\d{1,4}$/.test(raw)
      ) {
        unmapped.add(`style:${attrValue(key, 24)}`);
        continue;
      }
      out[camel] = raw;
    }
    return out;
  }

  /**
   * Turn a `className` attribute into style. Returns the SPREAD sources so a
   * component that forwards its incoming style still composes.
   *
   * Supported, because these are what a real response contains:
   *   `className="a b"`, `className={"a b"}`,
   *   `className={someProp || "a b"}`  (the forwarding idiom),
   *   `` className={`a b ${someProp}`} ``.
   * Anything else is a BOUNDED DEGRADATION, not a refusal: the classes are lost,
   * the element survives, and `codegen-utility-unmapped` says so. Refusing a
   * whole frame over one dynamic class string would trade a small visual loss
   * for a total one.
   */
  function classNameToStyle(
    value: Node,
    scope: ComponentDecl | null
  ): { decls: Record<string, string>; spreads: string[] } {
    const decls: Record<string, string> = Object.create(null);
    const spreads: string[] = [];
    const take = (literal: string): void => {
      const mapped = mapClassName(literal, tw);
      Object.assign(decls, mapped.declarations);
      for (const u of mapped.unmapped) unmapped.add(attrValue(u, 40) || 'unprintable');
      for (const f of mapped.substitutedFonts)
        fonts.note({ css: '', substituted: true, requested: f });
    };
    const ident = (n: Node): boolean => {
      if (n?.type !== 'Identifier' || !scope) return false;
      const renamed = scope.props.get(String(n.name)) ?? scope.locals.get(String(n.name));
      if (!renamed) return false;
      spreads.push(renamed);
      return true;
    };

    if (isStringLiteral(value)) {
      take(String(value.value));
      return { decls, spreads };
    }
    if (value?.type !== 'JSXExpressionContainer') {
      unmapped.add('className:unsupported');
      return { decls, spreads };
    }
    const expr = unparen(value.expression);
    if (isStringLiteral(expr)) {
      take(String(expr.value));
      return { decls, spreads };
    }
    if (expr?.type === 'LogicalExpression' && (expr.operator === '||' || expr.operator === '??')) {
      const left = unparen(expr.left);
      const right = unparen(expr.right);
      // `className || "fallback"` — the fallback IS the design's own styling and
      // the prop is the caller's override. Merged prop-last so the override wins,
      // which is a superset of the source's either/or semantics.
      if (isStringLiteral(right)) take(String(right.value));
      if (!ident(left)) unmapped.add('className:dynamic');
      return { decls, spreads };
    }
    if (expr?.type === 'TemplateLiteral') {
      for (const q of expr.quasis as Node[]) take(String(q.value?.cooked ?? ''));
      for (const e of expr.expressions as Node[]) {
        if (!ident(unparen(e))) unmapped.add('className:dynamic');
      }
      return { decls, spreads };
    }
    unmapped.add('className:dynamic');
    return { decls, spreads };
  }

  /** Emit one JSX element/child. `nodeIdCtx` is the nearest `data-node-id`. */
  function emitNode(
    n: Node,
    scope: ComponentDecl | null,
    depth: number,
    nodeIdCtx: string
  ): string | null {
    if (depth > MAX_JSX_DEPTH) throw new CodegenConvertError('JSX nesting over the depth cap');
    jsxNodes += 1;
    if (jsxNodes > MAX_JSX_NODES) throw new CodegenConvertError('JSX node count over the cap');

    const node = unparen(n);
    if (!node) return null;

    switch (node.type) {
      case 'JSXText':
        return textChild(String(node.value ?? ''));
      case 'Literal':
        return typeof node.value === 'string' ? textChild(node.value) : null;
      case 'JSXFragment': {
        const kids = emitChildren(node.children, scope, depth + 1, nodeIdCtx);
        return kids.length > 0 ? `<>\n${kids.join('\n')}\n</>` : null;
      }
      case 'JSXExpressionContainer': {
        const expr = unparen(node.expression);
        if (!expr || expr.type === 'JSXEmptyExpression') return null;
        if (isStringLiteral(expr)) return textChild(String(expr.value));
        if (expr.type === 'TemplateLiteral') {
          // Figma wraps text containing `&` or `{` in a template literal
          // (`` {`Ancient Near East & Egypt`} ``) rather than escaping it. With
          // no interpolations it is just text; WITH one it would be a value this
          // converter cannot resolve, so that refuses rather than dropping the
          // dynamic half and shipping a sentence with a hole in it.
          if ((expr.expressions ?? []).length > 0) {
            throw new CodegenConvertError('interpolated template as a child');
          }
          return textChild(
            (expr.quasis ?? []).map((q: Node) => String(q.value?.cooked ?? '')).join('')
          );
        }
        if (expr.type === 'LogicalExpression' && expr.operator === '&&') {
          // `{isAccount && (<div/>)}` — Figma's variant idiom.
          const test = unparen(expr.left);
          if (!scope || test?.type !== 'Identifier') {
            throw new CodegenConvertError('unsupported conditional child');
          }
          const renamed = scope.locals.get(String(test.name)) ?? scope.props.get(String(test.name));
          if (!renamed) throw new CodegenConvertError('unsupported conditional child');
          const body = emitNode(expr.right, scope, depth + 1, nodeIdCtx);
          return body ? `{${renamed} && (\n${indent(body, 1)}\n)}` : null;
        }
        if (expr.type === 'ConditionalExpression') {
          const test = unparen(expr.test);
          if (!scope || test?.type !== 'Identifier') {
            throw new CodegenConvertError('unsupported conditional child');
          }
          const renamed = scope.locals.get(String(test.name)) ?? scope.props.get(String(test.name));
          if (!renamed) throw new CodegenConvertError('unsupported conditional child');
          const a = emitNode(expr.consequent, scope, depth + 1, nodeIdCtx) ?? 'null';
          const b = emitNode(expr.alternate, scope, depth + 1, nodeIdCtx) ?? 'null';
          return `{${renamed} ? (\n${indent(a, 1)}\n) : (\n${indent(b, 1)}\n)}`;
        }
        throw new CodegenConvertError('unsupported JSX expression');
      }
      case 'JSXElement':
        return emitElement(node, scope, depth, nodeIdCtx);
      default:
        throw new CodegenConvertError('unsupported JSX child');
    }
  }

  function emitChildren(
    children: Node[] | undefined,
    scope: ComponentDecl | null,
    depth: number,
    nodeIdCtx: string
  ): string[] {
    const out: string[] = [];
    for (const c of children ?? []) {
      const emitted = emitNode(c, scope, depth, nodeIdCtx);
      if (emitted) out.push(indent(emitted, 1));
    }
    return out;
  }

  function emitElement(
    node: Node,
    scope: ComponentDecl | null,
    depth: number,
    parentNodeId: string
  ): string {
    const rawName = jsxName(node.openingElement?.name);
    if (!rawName) throw new CodegenConvertError('unsupported element name');

    const component = byOriginalName.get(rawName);
    const isComponent = component !== undefined;
    if (!isComponent && !ELEMENT_ALLOWLIST.has(rawName)) {
      // Refusal, not a drop. This feature's history is losing content while
      // reporting success; an element outside the allowlist is a structural
      // surprise and it stops the frame.
      throw new CodegenConvertError('element outside the allowlist');
    }

    const decls: Record<string, string> = Object.create(null);
    const spreads: string[] = [];
    const attrs: string[] = [];
    let ownNodeId = parentNodeId;
    let src: string | null = null;
    let hasSrc = false;

    for (const a of (node.openingElement?.attributes ?? []) as Node[]) {
      if (a.type === 'JSXSpreadAttribute') {
        throw new CodegenConvertError('spread attribute');
      }
      const name = attrName(a);
      if (!name) continue;

      if (isComponent) {
        // A helper's props are its own vocabulary. Only string-literal values
        // pass, and only for props the declaration actually declared.
        if (name === 'className') {
          const st = classNameToStyle(a.value, scope);
          Object.assign(decls, st.decls);
          spreads.push(...st.spreads);
          continue;
        }
        const renamed = component.props.get(name);
        const v = a.value;
        if (renamed && isStringLiteral(v)) {
          attrs.push(`${renamed}={${jsxStringLiteral(String(v.value))}}`);
        } else if (
          renamed &&
          v?.type === 'JSXExpressionContainer' &&
          isStringLiteral(unparen(v.expression))
        ) {
          attrs.push(`${renamed}={${jsxStringLiteral(String(unparen(v.expression).value))}}`);
        }
        continue;
      }

      if (!ATTRIBUTE_ALLOWLIST.has(name)) continue;

      if (name === 'className') {
        const st = classNameToStyle(a.value, scope);
        Object.assign(decls, st.decls);
        spreads.push(...st.spreads);
        continue;
      }
      if (name === 'style') {
        const v = a.value;
        if (v?.type === 'JSXExpressionContainer') Object.assign(decls, inlineStyle(v.expression));
        continue;
      }
      if (name === 'data-node-id') {
        const raw = isStringLiteral(a.value) ? String(a.value.value) : '';
        if (NODE_ID_ATTR_RE.test(raw)) ownNodeId = raw;
        continue;
      }
      if (name === 'alt') {
        const raw = isStringLiteral(a.value) ? String(a.value.value) : '';
        attrs.push(`alt=${JSON.stringify(attrValue(raw, 64))}`);
        continue;
      }
      if (name === 'src') {
        hasSrc = true;
        const v = a.value;
        const expr = v?.type === 'JSXExpressionContainer' ? unparen(v.expression) : null;
        // ONLY a reference to a module-level asset constant is recognised. A
        // literal URL is refused rather than downloaded — there is no URL entry
        // point into the asset lane and this route must not invent one (D6).
        if (expr?.type === 'Identifier' && assetConsts.has(String(expr.name))) {
          src = assetFor(ownNodeId);
        }
      }
    }

    if (rawName === 'img' && hasSrc && src === null) {
      opts.report.add(ownNodeId, 'ASSET', 'asset-skipped', 'unrecognized codegen src');
    }

    const styleParts: string[] = [];
    if (Object.keys(decls).length > 0) styleParts.push(`...${styleLiteral(decls)}`);
    for (const s of spreads) styleParts.push(`...${s}`);
    const styleAttr =
      styleParts.length > 0
        ? styleParts.length === 1 && styleParts[0].startsWith('...{')
          ? ` style={${styleLiteral(decls)}}`
          : ` style={{ ${styleParts.join(', ')} }}`
        : '';

    const name = isComponent ? component.name : rawName;
    const provenance =
      !isComponent && ownNodeId && ownNodeId !== parentNodeId
        ? ` data-figma-node=${JSON.stringify(ownNodeId)}`
        : '';
    const srcAttr = src ? ` src=${JSON.stringify(src)}` : '';
    const extra = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
    const open = `<${name}${styleAttr}${srcAttr}${extra}${provenance}`;

    if (isComponent || VOID_ELEMENTS.has(rawName)) {
      if (!isComponent && (node.children ?? []).length > 0) {
        throw new CodegenConvertError('void element with children');
      }
      return `${open} />`;
    }

    const kids = emitChildren(node.children, scope, depth + 1, ownNodeId);
    if (kids.length === 0) return `${open} />`;
    return `${open}>\n${kids.join('\n')}\n</${name}>`;
  }

  /** One placeholder per source NODE, so `renderKey` dedupe does the rest (D6). */
  function assetFor(nodeId: string): string {
    const existing = assetPlaceholders.get(nodeId);
    if (existing) return existing;
    const placeholder = `/assets/pending-codegen-${nodeId.replace(/[^0-9]+/g, '-')}.svg`;
    assetPlaceholders.set(nodeId, placeholder);
    pendingAssets.push({ nodeId, format: 'svg', placeholder });
    return placeholder;
  }

  /** A component's `return` — the one statement shape that produces output. */
  function componentBody(decl: ComponentDecl): string {
    const body = decl.node.body?.body ?? [];
    let ret: Node | null = null;
    const consts: string[] = [];
    for (const stmt of body as Node[]) {
      if (stmt.type === 'VariableDeclaration') {
        for (const d of stmt.declarations) {
          const renamed = decl.locals.get(String(d.id?.name ?? ''));
          const init = unparen(d.init);
          // The only local a real response declares is a variant test —
          // `const isAccount = property1 === "account"`. Nothing else is
          // admitted, because anything else is code we would be re-emitting
          // without understanding it.
          if (!renamed || !init || init.type !== 'BinaryExpression') {
            throw new CodegenConvertError('unsupported local declaration');
          }
          if (init.operator !== '===' && init.operator !== '!==') {
            throw new CodegenConvertError('unsupported local declaration');
          }
          const left = unparen(init.left);
          const right = unparen(init.right);
          const leftName = left?.type === 'Identifier' ? decl.props.get(String(left.name)) : null;
          if (!leftName || !isStringLiteral(right)) {
            throw new CodegenConvertError('unsupported local declaration');
          }
          consts.push(
            `  const ${renamed} = ${leftName} ${init.operator} ${jsxStringLiteral(String(right.value))};`
          );
        }
        continue;
      }
      if (stmt.type === 'ReturnStatement') {
        ret = stmt.argument;
        continue;
      }
      throw new CodegenConvertError('unsupported statement in a component');
    }
    if (!ret) throw new CodegenConvertError('component returns nothing');
    const jsx = emitNode(ret, decl, 0, opts.nodeId);
    if (!jsx) throw new CodegenConvertError('component produced no output');
    return `${consts.join('\n')}${consts.length ? '\n' : ''}  return (\n${indent(jsx, 2)}\n  );`;
  }

  const helperSources: string[] = [];
  for (const decl of components) {
    helperSources.push(`function ${decl.name}(${paramList(decl)}) {\n${componentBody(decl)}\n}`);
  }
  const rootJsx = (() => {
    const body = componentBody(rootComponent);
    // The root component's body is inlined into the artboard rather than kept as
    // a component: an artboard IS the component boundary here, and one fewer
    // indirection is one fewer thing the selection ladder drills through.
    const m = /return \(\n([\s\S]*)\n {2}\);$/.exec(body);
    if (!m) throw new CodegenConvertError('root component has an unsupported shape');
    return m[1];
  })();

  fonts.flush(opts.report, opts.nodeId);
  for (const u of [...unmapped].sort().slice(0, 40)) {
    opts.report.add(opts.nodeId, 'CSS', 'codegen-utility-unmapped', reportToken(u));
  }
  if (unmapped.size > 40) {
    opts.report.add(
      opts.nodeId,
      'CSS',
      'codegen-utility-unmapped',
      `and ${unmapped.size - 40} more`
    );
  }

  const abId = identifierFromNodeId(opts.nodeId).toLowerCase().replace(/_/g, '-');
  const artboardJsx = `      <DCArtboard
        id=${JSON.stringify(abId)}
        label=${JSON.stringify(`${opts.label} · codegen`)}
        width={${Math.max(1, Math.round(opts.width))}}
        height={${Math.max(1, Math.round(opts.height))}}
        kind=${JSON.stringify(ARTBOARD_KINDS.has(opts.kind) ? opts.kind : 'digital')}
        layout="block"
      >
${indent(rootJsx, 2)}
      </DCArtboard>`;

  const helpers = helperSources.join('\n\n');
  const bytes = artboardJsx.length + helpers.length;
  if (bytes > MAX_OUTPUT_BYTES)
    throw new CodegenConvertError('emitted artboard over the output cap');

  const rootMeta = rootIdentity(rootComponent);

  return {
    artboardJsx,
    helpers,
    pendingAssets,
    unmappedUtilities: [...unmapped].sort(),
    bytes,
    rootNodeId: rootMeta.nodeId,
    rootName: rootMeta.name,
  };
}

/**
 * The root element's `data-node-id` + bounded `data-name`.
 *
 * Read straight off the AST rather than off the emitted output, because the
 * emitter deliberately drops `data-name` (a raw layer name) and omits
 * `data-figma-node` on the root. This is the ONLY place that name is read, it is
 * bounded on the way out, and the caller compares it and throws it away.
 */
function rootIdentity(decl: ComponentDecl): { nodeId: string | null; name: string } {
  let nodeId: string | null = null;
  let name = '';
  for (const stmt of (decl.node.body?.body ?? []) as Node[]) {
    if (stmt.type !== 'ReturnStatement') continue;
    const el = unparen(stmt.argument);
    if (el?.type !== 'JSXElement') break;
    for (const a of (el.openingElement?.attributes ?? []) as Node[]) {
      const n = attrName(a);
      if (!isStringLiteral(a.value)) continue;
      if (n === 'data-node-id' && NODE_ID_ATTR_RE.test(String(a.value.value))) {
        nodeId = String(a.value.value);
      }
      if (n === 'data-name') name = attrValue(String(a.value.value), 64);
    }
    break;
  }
  return { nodeId, name };
}

/**
 * The existing `<DCArtboard id="…">`'s own size and label.
 *
 * Read from the CANVAS rather than only from `.meta.json` because the canvas is
 * the live truth: sizes are JSX-authoritative (DDR-027), a user may have resized
 * the board since the import, and canvases imported before `figma.frames[]`
 * carried `w`/`h` have no stored size at all. Returns `null` when the artboard
 * is absent — the caller turns that into a refusal.
 */
/**
 * Does this source parse as a TSX module?
 *
 * Exported so the WRITE path can gate on it. DDR-219 D8 says "build out-of-tree,
 * validate it parses, then write", and the first implementation spliced by byte
 * range and renamed straight onto the live path — the validation existed only in
 * the comment (post-implementation review F2).
 */
export function parsesAsModule(source: string): boolean {
  try {
    return parseSync('canvas.tsx', source, { sourceType: 'module' }).errors.length === 0;
  } catch {
    return false;
  }
}

/**
 * The closed set of artboard kinds (`canvas-lib.tsx`'s `ArtboardKind`).
 *
 * An ALLOWLIST, because `kind` lands in an emitted JSX opening tag. The first
 * version took it from a `.meta.json` field with no bound at all, which made a
 * peer-authored sidecar an injection vector into canvas source — see
 * `explodeArtboard`'s note. A closed enum is the whole vocabulary, so nothing
 * legitimate is lost by refusing everything else.
 */
export const ARTBOARD_KINDS: ReadonlySet<string> = new Set(['digital', 'print', 'web', 'video']);

export function readArtboardBox(
  canvasSource: string,
  artboardId: string
): { width: number; height: number; label: string; kind: string } | null {
  const parsed = parseSync('canvas.tsx', canvasSource, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) return null;

  let found: { width: number; height: number; label: string; kind: string } | null = null;
  const numeric = (a: Node): number | null => {
    const v = a?.value;
    if (v?.type === 'JSXExpressionContainer') {
      const e = unparen(v.expression);
      if (e?.type === 'Literal' && typeof e.value === 'number') return e.value;
    }
    if (v?.type === 'Literal' && typeof v.value === 'number') return v.value;
    return null;
  };
  const walk = (n: Node): void => {
    if (!n || typeof n !== 'object' || found) return;
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (n.type === 'JSXElement' && jsxName(n.openingElement?.name) === 'DCArtboard') {
      let id: string | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let label = '';
      // Default, not a passthrough: an unrecognised kind is refused rather than
      // carried, because this value is re-emitted into a JSX opening tag.
      let kind = 'digital';
      for (const a of (n.openingElement?.attributes ?? []) as Node[]) {
        const k = attrName(a);
        if (k === 'id' && isStringLiteral(a.value)) id = String(a.value.value);
        if (k === 'label' && isStringLiteral(a.value)) label = attrValue(String(a.value.value), 64);
        if (k === 'kind' && isStringLiteral(a.value) && ARTBOARD_KINDS.has(String(a.value.value))) {
          kind = String(a.value.value);
        }
        if (k === 'width') width = numeric(a);
        if (k === 'height') height = numeric(a);
      }
      if (id === artboardId && width !== null && height !== null) {
        found = { width, height, label, kind };
        return;
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      walk(n[k]);
    }
  };
  walk(parsed.program);
  return found;
}

/**
 * Replace ONE `<DCArtboard id="…">` subtree in an existing canvas, and hoist the
 * helper components to module scope.
 *
 * Parsed, not regexed, for the same reason the converter is: a canvas is a real
 * TSX file and `<DCArtboard` appears in its header comment. A byte-range
 * replacement over a located AST node cannot mistake prose for markup.
 *
 * @throws CodegenConvertError when the artboard id is not present exactly once —
 *         the write model refuses rather than guessing which one was meant.
 */
export function spliceArtboard(
  canvasSource: string,
  opts: { artboardId: string; artboardJsx: string; helpers: string; banner: string }
): string {
  const parsed = parseSync('canvas.tsx', canvasSource, { sourceType: 'module' });
  if (parsed.errors && parsed.errors.length > 0) {
    throw new CodegenConvertError('target canvas does not parse');
  }

  const hits: Array<{ start: number; end: number }> = [];
  let exportStart = -1;

  const walk = (n: Node): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const c of n) walk(c);
      return;
    }
    if (n.type === 'ExportDefaultDeclaration' && exportStart < 0) exportStart = n.start;
    if (n.type === 'JSXElement' && jsxName(n.openingElement?.name) === 'DCArtboard') {
      for (const a of (n.openingElement?.attributes ?? []) as Node[]) {
        if (attrName(a) !== 'id') continue;
        const v = a.value;
        const literal = isStringLiteral(v)
          ? String(v.value)
          : v?.type === 'JSXExpressionContainer' && isStringLiteral(unparen(v.expression))
            ? String(unparen(v.expression).value)
            : null;
        if (literal === opts.artboardId) hits.push({ start: n.start, end: n.end });
      }
    }
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      walk(n[k]);
    }
  };
  walk(parsed.program);

  if (hits.length === 0) throw new CodegenConvertError('artboard id not found in the canvas');
  if (hits.length > 1) throw new CodegenConvertError('artboard id is not unique in the canvas');
  if (exportStart < 0) throw new CodegenConvertError('canvas has no default export');

  const hit = hits[0];
  if (hit.start <= exportStart) throw new CodegenConvertError('artboard is outside the export');

  // Both edits are byte offsets into the SAME original source, and the export
  // always starts before the artboard it contains — so splicing from the end
  // backwards keeps the earlier offset valid without a source-map library.
  const preamble = `${opts.banner}\n${opts.helpers ? `${opts.helpers}\n\n` : ''}`;
  // The artboard block carries its own leading indentation.
  const artboard = opts.artboardJsx.replace(/^\s+/, '');
  return (
    canvasSource.slice(0, exportStart) +
    preamble +
    canvasSource.slice(exportStart, hit.start) +
    artboard +
    canvasSource.slice(hit.end)
  );
}

/**
 * Declare a component with a FULLY REGENERATED signature.
 *
 * Every name here — the component, each parameter, each local — is derived from
 * the frame's node id and an index. Nothing from the response's identifier space
 * survives, which is the only way DDR-216 D6's "airtight" claim stays true on a
 * route that receives third-party source (DDR-219 D4).
 */
function declareComponent(fn: Node, rootId: string, index: number): ComponentDecl {
  const decl: ComponentDecl = {
    name: `${rootId}_C${index}`,
    props: new Map(),
    defaults: new Map(),
    locals: new Map(),
    styleProp: null,
    node: fn,
  };

  const params = fn.params ?? [];
  if (params.length > 1) throw new CodegenConvertError('component takes more than one parameter');
  if (params.length === 1) {
    const p = params[0];
    if (p.type !== 'ObjectPattern') throw new CodegenConvertError('non-destructured props');
    let i = 0;
    for (const prop of p.properties as Node[]) {
      if (prop.type !== 'Property' || prop.computed) {
        throw new CodegenConvertError('unsupported prop pattern');
      }
      const key = prop.key?.type === 'Identifier' ? String(prop.key.name) : null;
      if (!key || FORBIDDEN_KEYS.has(key)) throw new CodegenConvertError('unsupported prop name');
      const renamed = `p${i}`;
      i += 1;
      decl.props.set(key, renamed);
      // `className` becomes a STYLE object: this converter turns classes into
      // inline style everywhere else, so a forwarded `className` would be the
      // one string in the output nothing consumes.
      if (key === 'className') decl.styleProp = renamed;
      const value = prop.value;
      if (value?.type === 'AssignmentPattern') {
        const right = unparen(value.right);
        if (!isStringLiteral(right)) throw new CodegenConvertError('unsupported prop default');
        decl.defaults.set(key, jsxStringLiteral(String(right.value)));
      }
    }
  }

  // Locals are enumerated up front so a JSX body can reference one declared
  // above it without the emitter needing a second pass.
  let li = 0;
  for (const stmt of (fn.body?.body ?? []) as Node[]) {
    if (stmt.type !== 'VariableDeclaration') continue;
    for (const d of stmt.declarations) {
      if (d.id?.type !== 'Identifier')
        throw new CodegenConvertError('unsupported local declaration');
      decl.locals.set(String(d.id.name), `v${li}`);
      li += 1;
    }
  }
  return decl;
}

function paramList(decl: ComponentDecl): string {
  if (decl.props.size === 0) return '';
  const parts: string[] = [];
  for (const [original, renamed] of decl.props) {
    if (renamed === decl.styleProp) {
      parts.push(`${renamed} = {}`);
      continue;
    }
    const def = decl.defaults.get(original);
    parts.push(def ? `${renamed} = ${def}` : renamed);
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * A report token for `detail` — strict, and deliberately NOT `attrValue`.
 *
 * `attrValue` rewrites rejected characters to SPACES, which is right for a label
 * and wrong here: a class token like `ignore.all.prior.instructions.and` comes
 * back as that sentence, and `detail` reaches verb stdout (which D10 declares
 * entirely code-owned), the HTTP summary and the panel. Charset-bounding is a
 * markup control; it was never a semantic one (post-implementation review F3).
 *
 * So: a Tailwind FAMILY shape only — lowercase, digits, hyphens, NO SPACES ever
 * — and anything else collapses to a fixed word. `unrecognized x7` is less
 * informative than the raw token and cannot be read as an instruction, which is
 * the right trade for a field an agent reads.
 */
export function reportToken(raw: string): string {
  const head = /^[a-z][a-z0-9-]{0,23}/.exec(raw.trim().toLowerCase());
  return head ? head[0] : 'unrecognized';
}

function indent(text: string, levels: number): string {
  const pad = '  '.repeat(levels);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}
/* biome-ignore-end lint/suspicious/noExplicitAny: see the note above. */
