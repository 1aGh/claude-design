/**
 * @file       figma/to-tokens.ts — Figma styles/variables → W3C design tokens.
 * @scope      apps/studio/figma/to-tokens.ts
 * @purpose    Produce VALID INPUT for the existing `import-tokens` pipeline,
 *             and nothing more.
 *
 * @invariant  DDR-172 OWNS THE MAPPING CONTRACT. Naming, collision handling,
 *             theme semantics, the per-family value grammars, the mapping
 *             report — all of it already exists and is already security-
 *             reviewed. This module's ONLY job is to emit a W3C design-tokens
 *             JSON document; it must never grow a second mapping contract, and
 *             it never writes a stylesheet itself.
 *
 * @invariant  A TOKEN NAME IS A SINK (DDR-216 D6). A Figma paint style's NAME
 *             becomes a token name and then a live CSS custom-property name in
 *             `system/**` — which is versioned, peer-synced, rendered in every
 *             canvas, and read by agents. So names are charset-bounded here,
 *             before they reach DDR-172's own validation.
 *
 * @invariant  A STYLE DESCRIPTION IS NEVER CARRIED. Figma styles have a free-
 *             text `description`. DDR-172 Decision 8 traced this exact class
 *             (free text → `config.json` → multiple agents' context, cross-peer
 *             under DDR-054) and closed it by ELIMINATING the sink rather than
 *             bounding it. Same elimination: there is no code path from a Figma
 *             description to any output.
 *
 * @invariant  THE VARIABLES ENDPOINT IS ENTERPRISE-GATED, so a 403 is the
 *             COMMON case, not an error. The dogfood account is Pro — the
 *             STYLES path is the one this feature is actually exercised on, and
 *             the Variables branch is the speculative one.
 */

import type { FigmaStyleMeta } from './client.ts';
import { ImportReport } from './sanitize.ts';
import type { FigmaEffect, FigmaNode, FigmaPaint, FigmaTypeStyle } from './types.ts';

/** A W3C design-tokens group/leaf tree. */
export interface TokenLeaf {
  $type: 'color' | 'dimension' | 'fontWeight' | 'shadow' | 'fontFamily';
  $value: string | number | Record<string, unknown>;
}
export type TokenNode = TokenLeaf | { [key: string]: TokenNode };

/**
 * Token-name charset. A Figma style name is free text (`Brand/Primary 500`,
 * `Text — Heading / XL`), so it is normalized to kebab segments and bounded
 * before it becomes a name at all. Anything that survives is safe to place in
 * a JSON key and, downstream, in a CSS custom-property name.
 */
export function tokenNameSegments(raw: string, maxSegments = 4): string[] {
  return (
    raw
      .normalize('NFKD')
      // Drop combining marks so `Přílíš` degrades to `Prilis` rather than to junk.
      .replace(/[̀-ͯ]/g, '')
      .split('/')
      .map((part) =>
        part
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48)
      )
      .filter((part) => part.length > 0)
      .slice(0, maxSegments)
  );
}

function figmaColorHex(c: { r: number; g: number; b: number; a?: number }): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  const base = `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  // 8-digit hex only when there is real transparency — DDR-172's colour grammar
  // accepts both, and an always-`ff` suffix is noise in every diff.
  return c.a !== undefined && c.a < 1 ? `${base}${to(c.a)}` : base;
}

function setDeep(root: Record<string, TokenNode>, segments: string[], leaf: TokenLeaf): boolean {
  if (segments.length === 0) return false;
  let cursor: Record<string, TokenNode> = root;
  for (const seg of segments.slice(0, -1)) {
    // Never walk through a polluting key, and never build a prototype chain.
    if (seg === '__proto__' || seg === 'constructor' || seg === 'prototype') return false;
    const existing = cursor[seg];
    if (existing && typeof existing === 'object' && !('$value' in existing)) {
      cursor = existing as Record<string, TokenNode>;
    } else if (existing) {
      return false; // a leaf already occupies this path — collision, reported
    } else {
      const next: Record<string, TokenNode> = Object.create(null);
      cursor[seg] = next as TokenNode;
      cursor = next;
    }
  }
  const last = segments[segments.length - 1];
  if (last === '__proto__' || last === 'constructor' || last === 'prototype') return false;
  if (cursor[last]) return false; // collision — DDR-172 owns resolution, we report
  cursor[last] = leaf;
  return true;
}

export interface StyleNodeSource {
  /** The style descriptor (name + type). */
  meta: FigmaStyleMeta;
  /** The node the style is defined on, when the file payload carried it. */
  node?: FigmaNode;
}

export interface ToTokensResult {
  /** A W3C design-tokens document, ready for `import-tokens`. */
  tokens: Record<string, TokenNode>;
  report: ImportReport;
  /** Which source the tokens came from — drives the UI's wording. */
  source: 'variables' | 'styles';
  count: number;
}

function firstVisiblePaint(paints: readonly FigmaPaint[] | undefined): FigmaPaint | null {
  for (const p of paints ?? []) if (p.visible) return p;
  return null;
}

function shadowLeaf(effects: readonly FigmaEffect[]): TokenLeaf | null {
  for (const e of effects) {
    if (!e.visible) continue;
    if (e.type !== 'DROP_SHADOW') continue;
    return {
      $type: 'shadow',
      $value: {
        offsetX: `${Math.round(e.offset?.x ?? 0)}px`,
        offsetY: `${Math.round(e.offset?.y ?? 0)}px`,
        blur: `${Math.round(e.radius ?? 0)}px`,
        spread: `${Math.round(e.spread ?? 0)}px`,
        color: e.color ? figmaColorHex(e.color) : '#000000',
      },
    };
  }
  return null;
}

function typeLeaves(style: FigmaTypeStyle): Array<[string, TokenLeaf]> {
  const out: Array<[string, TokenLeaf]> = [];
  if (style.fontSize !== undefined) {
    out.push(['size', { $type: 'dimension', $value: `${Math.round(style.fontSize)}px` }]);
  }
  if (style.lineHeightPx !== undefined) {
    out.push([
      'line-height',
      { $type: 'dimension', $value: `${Math.round(style.lineHeightPx)}px` },
    ]);
  }
  if (style.fontWeight !== undefined) {
    out.push(['weight', { $type: 'fontWeight', $value: Math.round(style.fontWeight) }]);
  }
  // Font FAMILY is deliberately not emitted — the same reasoning as
  // `style-map.ts`: a Figma family name is free text from the document, and
  // DDR-172's font grammar exists precisely because a family value reaches a
  // live stylesheet. A project's type stack is a DS decision, not an import's.
  return out;
}

/**
 * Build a W3C design-tokens document from a file's paint / text / effect styles.
 *
 * `nodesByStyleNodeId` lets the caller supply the style-defining nodes it
 * already fetched; a style with no reachable node is reported `unmappable-type`
 * rather than guessed at.
 */
export function stylesToTokens(
  styles: readonly FigmaStyleMeta[],
  nodesByStyleNodeId: ReadonlyMap<string, FigmaNode> = new Map()
): ToTokensResult {
  const report = new ImportReport();
  const tokens: Record<string, TokenNode> = Object.create(null);
  let count = 0;

  for (const meta of styles) {
    const nodeId = meta.nodeId ?? '';
    const node = nodeId ? nodesByStyleNodeId.get(nodeId) : undefined;
    const segments = tokenNameSegments(meta.name);
    if (segments.length === 0) {
      report.add(nodeId || meta.key, meta.styleType, 'value-rejected', 'unusable style name');
      continue;
    }
    if (!node) {
      report.add(nodeId || meta.key, meta.styleType, 'unmappable-type', 'style node not fetched');
      continue;
    }

    let placed = false;
    switch (meta.styleType) {
      case 'FILL': {
        const paint = firstVisiblePaint(node.fills);
        if (paint?.type === 'SOLID' && paint.color) {
          placed = setDeep(tokens, segments, {
            $type: 'color',
            $value: figmaColorHex(paint.color),
          });
        } else {
          // A gradient/image paint style has no single-value token equivalent.
          report.add(nodeId, meta.styleType, 'unmappable-type', 'non-solid paint style');
          continue;
        }
        break;
      }
      case 'TEXT': {
        if (!node.style) {
          report.add(nodeId, meta.styleType, 'unmappable-type', 'text style carries no typeStyle');
          continue;
        }
        const leaves = typeLeaves(node.style);
        if (leaves.length === 0) {
          report.add(nodeId, meta.styleType, 'unmappable-type', 'no mappable type fields');
          continue;
        }
        placed = leaves.every(([suffix, leaf]) => setDeep(tokens, [...segments, suffix], leaf));
        break;
      }
      case 'EFFECT': {
        const leaf = node.effects ? shadowLeaf(node.effects) : null;
        if (!leaf) {
          report.add(nodeId, meta.styleType, 'unmappable-type', 'no drop-shadow effect');
          continue;
        }
        placed = setDeep(tokens, segments, leaf);
        break;
      }
      default:
        report.add(nodeId, meta.styleType, 'unmappable-type', 'unsupported style type');
        continue;
    }

    if (placed) {
      count += 1;
      report.add(nodeId, meta.styleType, 'imported');
    } else {
      // A name collision. DDR-172 owns collision SEMANTICS downstream; here it
      // simply means two Figma styles normalized to the same token path, which
      // the user needs told rather than silently resolved.
      report.add(nodeId, meta.styleType, 'value-rejected', 'token name collision');
    }
  }

  return { tokens: JSON.parse(JSON.stringify(tokens)), report, source: 'styles', count };
}

/**
 * The Variables branch — richer (modes → themes), and **plan-gated**.
 *
 * Deliberately thin and deliberately second. Verified 2026-08-02: the primary
 * dogfood account is Pro/Full seat, so `GET /v1/files/:key/variables/local`
 * 403s there and the STYLES path above is the one that actually gets exercised.
 * Treat this branch as speculative until it can be tested against a real
 * Enterprise file.
 */
export function variablesToTokens(raw: unknown): ToTokensResult {
  const report = new ImportReport();
  const tokens: Record<string, TokenNode> = Object.create(null);
  let count = 0;

  const meta = raw as { variables?: Record<string, unknown> } | null;
  const variables = meta?.variables;
  if (!variables || typeof variables !== 'object') {
    return { tokens: {}, report, source: 'variables', count: 0 };
  }

  for (const [id, entry] of Object.entries(variables)) {
    if (id === '__proto__' || id === 'constructor' || id === 'prototype') continue;
    if (!entry || typeof entry !== 'object') continue;
    const v = entry as Record<string, unknown>;
    const name = typeof v.name === 'string' ? v.name : '';
    const resolvedType = typeof v.resolvedType === 'string' ? v.resolvedType : '';
    const segments = tokenNameSegments(name);
    if (segments.length === 0) continue;

    const byMode = v.valuesByMode as Record<string, unknown> | undefined;
    const first = byMode ? Object.values(byMode)[0] : undefined;
    if (first === undefined) continue;

    let leaf: TokenLeaf | null = null;
    if (resolvedType === 'COLOR' && first && typeof first === 'object') {
      const c = first as { r?: number; g?: number; b?: number; a?: number };
      if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number') {
        leaf = { $type: 'color', $value: figmaColorHex({ r: c.r, g: c.g, b: c.b, a: c.a }) };
      }
    } else if (resolvedType === 'FLOAT' && typeof first === 'number' && Number.isFinite(first)) {
      leaf = { $type: 'dimension', $value: `${Math.round(first)}px` };
    }
    if (!leaf) {
      report.add(id, resolvedType || 'VARIABLE', 'unmappable-type', 'unsupported variable type');
      continue;
    }
    if (setDeep(tokens, segments, leaf)) {
      count += 1;
      report.add(id, resolvedType, 'imported');
    } else {
      report.add(id, resolvedType, 'value-rejected', 'token name collision');
    }
  }

  return { tokens: JSON.parse(JSON.stringify(tokens)), report, source: 'variables', count };
}
