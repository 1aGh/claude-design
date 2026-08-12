/**
 * @file       figma/fig-decode.ts — the local `.fig` / `.jam` ingestion door.
 * @scope      apps/studio/figma/fig-decode.ts
 * @purpose    ZIP → `canvas.fig` → container → the two decompressors → Kiwi →
 *             a REST-SHAPED raw tree → `normalizeDocument(raw, {origin:'fig'})`.
 *             The second door onto the tree the translators already consume
 *             (DDR-221). No network, no token, no SSRF: the whole door is local.
 *
 * @invariant  EMIT REST-SHAPED RAW, DO NOT BUILD A NormalizedDocument (DDR-221
 *             A5). Handing raw to the EXISTING normalizer makes the node/depth
 *             caps and the prototype-pollution guard literally the same code as
 *             the REST door, rather than a parallel implementation that drifts.
 *
 * @invariant  FRAMING ERRORS REFUSE THE FILE; VOCABULARY GAPS DEGRADE AND
 *             REPORT (DDR-221 D3). An unknown prelude or container version is
 *             a refusal — never a best-effort decode, because a design importer
 *             that guesses produces wrong geometry that looks right.
 *
 * @invariant  EVERY SCHEMA-SOURCED STRING IS ATTACKER-CHOSEN (DDR-221 A8/F1).
 *             Enum member names come from the file's own schema, so node
 *             `type` is attacker-controlled. Anything reaching a report goes
 *             through `reportToken` + a count, never verbatim — `attrValue`
 *             is NOT enough, it maps rejected characters to spaces and a
 *             bounded label can still read as prose.
 */

import { createHash } from 'node:crypto';
import { inflateRawSync, zstdDecompressSync } from 'node:zlib';

import { styleToWeight } from './codegen-fonts.ts';
import { decodeKiwi, findRootDefinition, type KiwiSchema, parseKiwiSchema } from './fig-kiwi.ts';
import { FigZipError, readFigZip } from './fig-zip.ts';
import { reportToken } from './sanitize.ts';
import {
  KNOWN_NODE_TYPES,
  MAX_NODE_COUNT,
  type NormalizedDocument,
  normalizeDocument,
} from './types.ts';

// ── Container constants (measured on the committed fixtures) ────────────────

/** The 8-byte ASCII prelude is the ONLY editor discriminator. */
const PRELUDES: Record<string, 'design' | 'board'> = {
  'fig-kiwi': 'design',
  'fig-jam.': 'board',
};

/**
 * Known container versions. An unknown one REFUSES (DDR-221 D3) — this is the
 * decision most likely to annoy someone the first time Figma ships 107, and the
 * trade is deliberate: the message names the version, the schema-hash alarm is
 * designed to see it coming, and the REST door still works.
 */
export const KNOWN_CONTAINER_VERSIONS: ReadonlySet<number> = new Set([106]);

/** ~1 500x the measured 42 KB. */
export const MAX_CANVAS_FIG_BYTES = 64 * 1024 * 1024;
/** 2 observed. */
export const MAX_CHUNKS = 8;
/** ~117x the measured 71 777 B. */
export const MAX_SCHEMA_BYTES = 8 * 1024 * 1024;
/** ~1 000x the measured 67 207 B. */
export const MAX_DATA_BYTES = 64 * 1024 * 1024;

const CANVAS_ENTRY = 'canvas.fig';
const META_ENTRY = 'meta.json';

export class FigDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FigDecodeError';
  }
}

export interface FigContainer {
  surface: 'design' | 'board';
  prelude: string;
  version: number;
  schema: Uint8Array;
  data: Uint8Array;
  /**
   * `sha256` of the COMPRESSED schema chunk. Stable and shared across editor
   * types, so a change is an early drift warning that fires before anything
   * breaks (DDR-221 D8).
   */
  schemaSha256: string;
}

export interface FigDecodeReport {
  containerVersion: number;
  schemaSha256: string;
  /** From `meta.json`. Makes a dated fixture corpus self-labelling. */
  exportedAt?: string;
  nodeCount: number;
  /**
   * Node types the file carried that `FigmaNodeType` has no member for.
   * `reportToken`-bounded: one lowercase token, never spaces (DDR-221 A8/F1).
   */
  unmappedTypes: Array<{ type: string; count: number }>;
  /** Nodes dropped because Figma marks them internal (e.g. the hidden canvas). */
  internalNodesSkipped: number;
  /**
   * Fields this door CANNOT reproduce from a local file, with how many nodes
   * each affected. Reported rather than left implicit: the plan's bar is that
   * known-lossy fields are named, never silently degraded.
   */
  lossyFields: Array<{ field: string; count: number; why: string }>;
}

export interface FigDecodeResult {
  document: NormalizedDocument;
  report: FigDecodeReport;
}

function u32le(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
}

function decompress(chunk: Uint8Array, kind: 'schema' | 'data', max: number): Uint8Array {
  try {
    // maxOutputLength is enforced BY the codec, so a bomb never allocates
    // (DDR-221 D4, measured: a 28 533:1 zstd bomb throws instead of expanding).
    return kind === 'schema'
      ? inflateRawSync(chunk, { maxOutputLength: max })
      : zstdDecompressSync(chunk, { maxOutputLength: max });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new FigDecodeError(`the ${kind} chunk decompresses past the ${max}-byte limit`);
    }
    throw new FigDecodeError(
      kind === 'schema'
        ? 'the schema chunk is not raw-deflate data'
        : 'the data chunk is not zstd data'
    );
  }
}

/**
 * Read `canvas.fig`'s framing. Every failure here refuses the file and names
 * the observed value, so diagnosis is one line rather than an afternoon.
 */
export function readFigContainer(bytes: Uint8Array): FigContainer {
  if (bytes.length > MAX_CANVAS_FIG_BYTES) {
    throw new FigDecodeError(
      `canvas.fig is ${bytes.length} bytes, over the ${MAX_CANVAS_FIG_BYTES}-byte limit`
    );
  }
  if (bytes.length < 12)
    throw new FigDecodeError('canvas.fig is too short to be a Figma container');

  const prelude = new TextDecoder('latin1').decode(bytes.subarray(0, 8));
  const surface = PRELUDES[prelude];
  if (!surface) {
    // The observed bytes are attacker-chosen; hex keeps them inert in a report.
    const hex = Array.from(bytes.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
    throw new FigDecodeError(`unrecognised Figma container prelude (bytes: ${hex})`);
  }

  const version = u32le(bytes, 8);
  if (!KNOWN_CONTAINER_VERSIONS.has(version)) {
    throw new FigDecodeError(
      `unsupported Figma container version ${version} (known: ${[...KNOWN_CONTAINER_VERSIONS].join(', ')}). ` +
        'Import this file over the Figma API instead.'
    );
  }

  const chunks: Uint8Array[] = [];
  let offset = 12;
  while (offset + 4 <= bytes.length) {
    const len = u32le(bytes, offset);
    offset += 4;
    if (offset + len > bytes.length) {
      throw new FigDecodeError(
        `chunk ${chunks.length} declares ${len} bytes past the end of canvas.fig`
      );
    }
    chunks.push(bytes.subarray(offset, offset + len));
    offset += len;
    if (chunks.length > MAX_CHUNKS) {
      throw new FigDecodeError(`canvas.fig declares more than ${MAX_CHUNKS} chunks`);
    }
  }

  if (chunks.length !== 2) {
    throw new FigDecodeError(`canvas.fig has ${chunks.length} chunks, expected exactly 2`);
  }
  if (offset !== bytes.length) {
    throw new FigDecodeError(`canvas.fig has ${bytes.length - offset} trailing bytes`);
  }

  // The zstd magic is checked up front so a swapped chunk order refuses with a
  // clear message instead of a confusing inflate failure.
  const d = chunks[1];
  if (!(d.length >= 4 && d[0] === 0x28 && d[1] === 0xb5 && d[2] === 0x2f && d[3] === 0xfd)) {
    throw new FigDecodeError('the data chunk is missing its zstd magic');
  }

  return {
    surface,
    prelude,
    version,
    schema: decompress(chunks[0], 'schema', MAX_SCHEMA_BYTES),
    data: decompress(chunks[1], 'data', MAX_DATA_BYTES),
    schemaSha256: createHash('sha256').update(chunks[0]).digest('hex'),
  };
}

// ── Tree reconstruction ─────────────────────────────────────────────────────

interface Matrix {
  m00: number;
  m01: number;
  m02: number;
  m10: number;
  m11: number;
  m12: number;
}

const IDENTITY: Matrix = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function obj(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/**
 * ABSENT is not the same as NaN. A missing `transform` legitimately means the
 * identity, but a component that is PRESENT and non-finite is a crafted or
 * corrupt file: defaulting it to the identity yields plausible-but-wrong
 * geometry with no error signal, which is the exact failure D3 exists to
 * prevent (and the same shape as the A4 float trap). Refuse instead.
 */
function component(v: unknown, fallback: number, name: string): number {
  if (v === undefined) return fallback;
  const n = num(v);
  if (n === undefined)
    throw new FigDecodeError(`transform component ${name} is not a finite number`);
  return n;
}

function matrixOf(v: unknown): Matrix {
  const m = obj(v);
  if (!m) return IDENTITY;
  return {
    m00: component(m.m00, 1, 'm00'),
    m01: component(m.m01, 0, 'm01'),
    m02: component(m.m02, 0, 'm02'),
    m10: component(m.m10, 0, 'm10'),
    m11: component(m.m11, 1, 'm11'),
    m12: component(m.m12, 0, 'm12'),
  };
}

function compose(p: Matrix, c: Matrix): Matrix {
  return {
    m00: p.m00 * c.m00 + p.m01 * c.m10,
    m01: p.m00 * c.m01 + p.m01 * c.m11,
    m02: p.m00 * c.m02 + p.m01 * c.m12 + p.m02,
    m10: p.m10 * c.m00 + p.m11 * c.m10,
    m11: p.m10 * c.m01 + p.m11 * c.m11,
    m12: p.m10 * c.m02 + p.m11 * c.m12 + p.m12,
  };
}

/**
 * `.fig` geometry is a parent-relative affine transform plus a size; REST
 * reports an absolute axis-aligned box. Composing down the parent chain is one
 * of the two places the two doors can legitimately disagree, so it is also one
 * of the two things the Tier-2 differential exists to check (DDR-221 A3).
 */
function absoluteBox(m: Matrix, w: number, h: number) {
  const xs = [m.m02, m.m00 * w + m.m02, m.m01 * h + m.m02, m.m00 * w + m.m01 * h + m.m02];
  const ys = [m.m12, m.m10 * w + m.m12, m.m11 * h + m.m12, m.m10 * w + m.m11 * h + m.m12];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function guidOf(v: unknown): string | undefined {
  const g = obj(v);
  if (!g) return undefined;
  const s = num(g.sessionID);
  const l = num(g.localID);
  return s === undefined || l === undefined ? undefined : `${s}:${l}`;
}

/**
 * Map ONE decoded `NodeChange` onto REST-shaped fields.
 *
 * Reads a HARDCODED list of field names and never iterates the decoded
 * object's own keys (DDR-221 A8/F5) — field names come from the attacker's
 * schema, so a generic copy would let them choose which REST field each value
 * lands in (`absoluteBoundingBox`, `characters`, `children`).
 */
/**
 * `.fig` carries Figma's INTERNAL node vocabulary; REST reports the public one,
 * and the translators are written against REST. Measured by the Tier-2
 * differential on the fixtures — the unit tests could not have found this,
 * because both sides of an internal-vocabulary mismatch look perfectly valid.
 *
 * A GROUP is internally a FRAME with `resizeToFit` (shrink-wrap to children);
 * that flag is the discriminator, 5/5 on the design fixture and 1/1 on the
 * board. `ROUNDED_RECTANGLE` collapses to `RECTANGLE` (the radius survives in
 * `cornerRadius`), and `SYMBOL` is Figma's internal name for a `COMPONENT`.
 */
function restType(change: Record<string, unknown>): string | undefined {
  const type = str(change.type);
  if (type === 'FRAME' && change.resizeToFit === true) return 'GROUP';
  if (type === 'ROUNDED_RECTANGLE') return 'RECTANGLE';
  if (type === 'SYMBOL') return 'COMPONENT';
  return type;
}

/**
 * Pull a FigJam node's text out of its template overrides. Reads only the
 * hardcoded `nodeGenerationData.overrides[].textData.characters` path (A8/F5) —
 * the override list is attacker-controlled, so it is walked, never spread — and
 * takes the first entry that carries characters, which is what REST reports as
 * the node's own `characters`.
 */
function overrides(change: Record<string, unknown>): unknown[] {
  const list = obj(change.nodeGenerationData)?.overrides;
  return Array.isArray(list) ? list : [];
}

/**
 * First override carrying `key`. The template's own root comes first, so this
 * resolves to the node's own paint/text rather than a sub-part's.
 *
 * The ordering is an OBSERVED property, not a documented one — which is exactly
 * why the Tier-3 comparison is the guard: if Figma ever reorders these, the
 * translator diff against REST fails loudly instead of quietly picking the
 * wrong colour. Only hardcoded keys are read (A8/F5).
 */
function fromOverrides(change: Record<string, unknown>, key: string): unknown {
  for (const entry of overrides(change)) {
    const value = obj(entry)?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

function overrideText(change: Record<string, unknown>): string | undefined {
  for (const entry of overrides(change)) {
    const characters = str(obj(obj(entry)?.textData)?.characters);
    if (characters !== undefined) return characters;
  }
  return undefined;
}

function toRestNode(
  change: Record<string, unknown>,
  absolute: Matrix,
  lossy: { lineHeights: number }
): Record<string, unknown> {
  const size = obj(change.size);
  const w = num(size?.x) ?? 0;
  const h = num(size?.y) ?? 0;

  const raw: Record<string, unknown> = {
    id: guidOf(change.guid),
    type: restType(change),
    name: str(change.name) ?? '',
    visible: change.visible !== false,
    absoluteBoundingBox: absoluteBox(absolute, w, h),
  };

  const opacity = num(change.opacity);
  if (opacity !== undefined) raw.opacity = opacity;
  const blend = str(change.blendMode);
  if (blend) raw.blendMode = blend;
  const cornerRadius = num(change.cornerRadius);
  if (cornerRadius !== undefined) raw.cornerRadius = cornerRadius;
  const strokeWeight = num(change.strokeWeight);
  if (strokeWeight !== undefined) raw.strokeWeight = strokeWeight;
  // A FigJam STICKY / SHAPE_WITH_TEXT is a template instance: its own paint is
  // an override, not a top-level field. Reading only the top level left every
  // board node on the translator's default colour (found by Tier 3).
  const fills = change.fillPaints ?? fromOverrides(change, 'fillPaints');
  if (Array.isArray(fills)) raw.fills = fills;
  const strokes = change.strokePaints ?? fromOverrides(change, 'strokePaints');
  if (Array.isArray(strokes)) raw.strokes = strokes;
  if (Array.isArray(change.effects)) raw.effects = change.effects;

  // Auto-layout. `.fig` calls it `stack*`; REST calls it `layout*`.
  const stackMode = str(change.stackMode);
  if (stackMode === 'HORIZONTAL' || stackMode === 'VERTICAL') {
    raw.layoutMode = stackMode;
    const spacing = num(change.stackSpacing);
    if (spacing !== undefined) raw.itemSpacing = spacing;
    const hPad = num(change.stackHorizontalPadding);
    const vPad = num(change.stackVerticalPadding);
    if (hPad !== undefined) {
      raw.paddingLeft = hPad;
      raw.paddingRight = hPad;
    }
    if (vPad !== undefined) {
      raw.paddingTop = vPad;
      raw.paddingBottom = vPad;
    }
    const primary = str(change.stackPrimaryAlignItems);
    if (primary) raw.primaryAxisAlignItems = primary;
    const counter = str(change.stackCounterAlignItems);
    if (counter) raw.counterAxisAlignItems = counter;
  }

  // Text. Two storage locations, and the second one is not optional:
  //  - a design-file TEXT node carries `textData.characters` directly;
  //  - a FigJam STICKY / SHAPE_WITH_TEXT is an instance of an internal
  //    template, and its text is an OVERRIDE on a sub-node, under
  //    `nodeGenerationData.overrides[].textData.characters`.
  // Missing the second path lost the text of every sticky and every shape on
  // the board while the tree still looked perfect — found by the Tier-2
  // differential (20 nodes), invisible to every unit test.
  const characters = str(obj(change.textData)?.characters) ?? overrideText(change);
  if (characters !== undefined) raw.characters = characters;
  const fontSize = num(change.fontSize);
  const fontName = obj(change.fontName);
  if (fontSize !== undefined || fontName || characters !== undefined) {
    // `.fig` encodes typography sparsely and semantically; REST reports it
    // resolved. Three deltas, all found by the Tier-3 translator comparison:
    //  - weight lives in the font STYLE name ("Bold"), not a number — reuse the
    //    codegen lane's map rather than keeping a second one;
    //  - a default alignment is OMITTED, where REST always states it;
    //  - lineHeight is authored ({value, units}), and REST reports the RESOLVED
    //    pixel value. A PERCENT line-height cannot be resolved to px without
    //    font metrics we do not have offline, so it is carried only when the
    //    file already states pixels. This is the local door's one genuinely
    //    lossy typography field and it is asserted as lossy in the Tier-3 test.
    const lineHeight = obj(change.lineHeight);
    const lineHeightPx = str(lineHeight?.units) === 'PIXELS' ? num(lineHeight?.value) : undefined;
    if (lineHeight && lineHeightPx === undefined) lossy.lineHeights++;
    raw.style = {
      fontSize,
      fontFamily: str(fontName?.family),
      fontPostScriptName: str(fontName?.postscript),
      fontWeight: styleToWeight(str(fontName?.style) ?? null) ?? undefined,
      textAlignHorizontal: str(change.textAlignHorizontal) ?? 'LEFT',
      ...(lineHeightPx !== undefined ? { lineHeightPx } : {}),
    };
  }

  // FigJam.
  const shapeType = str(change.shapeWithTextType);
  if (shapeType) raw.shapeType = shapeType;
  // REST wraps an endpoint as `{ endpointNodeId }` (lowercase d) and the
  // normalizer unwraps it; `.fig` carries a GUID struct under `endpointNodeID`
  // (uppercase D). Emit REST's shape so the SHARED normalizer resolves it —
  // handing it a bare string silently yields an unbound connector.
  const start = guidOf(obj(change.connectorStart)?.endpointNodeID);
  if (start) raw.connectorStart = { endpointNodeId: start };
  const end = guidOf(obj(change.connectorEnd)?.endpointNodeID);
  if (end) raw.connectorEnd = { endpointNodeId: end };
  const startCap = str(change.connectorStartCap);
  if (startCap) raw.connectorStartCap = startCap;
  const endCap = str(change.connectorEndCap);
  if (endCap) raw.connectorEndCap = endCap;
  const lineStyle = str(change.connectorLineStyle);
  if (lineStyle) raw.connectorLineType = lineStyle;

  return raw;
}

/**
 * A PERCENT line-height cannot be resolved to pixels without font metrics, and
 * REST reports the resolved value. Counted per node so the import summary can
 * say so out loud (the only lossy typography field — Tier 3 asserts it is).
 */
const LOSSY_LINE_HEIGHT = {
  field: 'style.lineHeightPx',
  why: 'a percent line-height needs font metrics the local file does not carry',
};

interface RebuildResult {
  root: Record<string, unknown>;
  unmapped: Map<string, number>;
  internalSkipped: number;
  nodeCount: number;
  lossyLineHeights: number;
}

/**
 * Rebuild the tree from `parentIndex`. A `.fig` is a FLAT `nodeChanges[]`, not
 * a nested document (DDR-221 A3), and this reconstruction is a SECOND recursion
 * that the Kiwi decode-depth cap does not bound (A8/F4) — hence the explicit
 * cycle, duplicate, orphan and single-root controls here.
 */
function rebuildTree(changes: unknown[]): RebuildResult {
  if (changes.length > MAX_NODE_COUNT) {
    throw new FigDecodeError(
      `file carries ${changes.length} nodes, over the ${MAX_NODE_COUNT} limit. Import a specific frame instead.`
    );
  }

  const byId = new Map<string, Record<string, unknown>>();
  const order: string[] = [];

  for (const entry of changes) {
    const change = obj(entry);
    if (!change) throw new FigDecodeError('a node change is not an object');
    const id = guidOf(change.guid);
    if (!id) throw new FigDecodeError('a node change has no usable guid');
    if (byId.has(id)) throw new FigDecodeError(`duplicate node guid ${id}`);
    // Internal-only nodes are NOT removed here. Dropping them before parentage
    // is resolved would orphan their children and refuse a legitimate file —
    // the fixtures' internal canvas happens to be childless, which is why this
    // looked safe. They are pruned as whole subtrees during the walk instead.
    byId.set(id, change);
    order.push(id);
  }

  const childIds = new Map<string, string[]>();
  const roots: string[] = [];
  for (const id of order) {
    const change = byId.get(id) as Record<string, unknown>;
    const parentIndex = obj(change.parentIndex);
    const parent = guidOf(parentIndex?.guid);
    if (parent === undefined) {
      roots.push(id);
      continue;
    }
    if (parent === id) throw new FigDecodeError(`node ${id} is its own parent`);
    if (!byId.has(parent)) {
      // Not silently dropped: an orphan means we misread the file or the file
      // is crafted, and either way a partial tree is the wrong outcome.
      throw new FigDecodeError(`node ${id} references parent ${parent}, which is not in the file`);
    }
    const siblings = childIds.get(parent);
    if (siblings) siblings.push(id);
    else childIds.set(parent, [id]);
  }

  if (roots.length !== 1) {
    throw new FigDecodeError(`file has ${roots.length} root nodes, expected exactly 1`);
  }

  // Fractional-index ordering. Plain comparison, not `localeCompare`: the
  // strings are attacker-controlled and locale collation on 20k items is both
  // slow and locale-dependent.
  for (const siblings of childIds.values()) {
    siblings.sort((a, b) => {
      const pa = str(obj(byId.get(a)?.parentIndex)?.position) ?? '';
      const pb = str(obj(byId.get(b)?.parentIndex)?.position) ?? '';
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
  }

  const unmapped = new Map<string, number>();
  const onStack = new Set<string>();
  const lossy = { lineHeights: 0 };
  let nodeCount = 0;
  let internalSkipped = 0;

  /** Count a pruned internal subtree so the report says how much was dropped. */
  const countSubtree = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    let n = 1;
    for (const kid of childIds.get(id) ?? []) n += countSubtree(kid, seen);
    return n;
  };

  const build = (id: string, parentAbsolute: Matrix, depth: number): Record<string, unknown> => {
    // Cycle detection. A→B→A would otherwise recurse until the stack dies.
    if (onStack.has(id)) throw new FigDecodeError(`node parentage forms a cycle at ${id}`);
    onStack.add(id);

    const change = byId.get(id) as Record<string, unknown>;
    const absolute = compose(parentAbsolute, matrixOf(change.transform));
    const node = toRestNode(change, absolute, lossy);
    nodeCount++;

    const type = node.type;
    if (typeof type !== 'string' || !KNOWN_NODE_TYPES.has(type)) {
      // Vocabulary gap: degrade and report (D3). The raw string is left in
      // place so the SHARED normalizer maps it to 'UNKNOWN' — this door does
      // not get its own opinion about the vocabulary (A5). Only the REPORT
      // label is produced here, and it is BOUNDED because the type name comes
      // from the attacker's schema (A8/F1).
      // `reportToken`, NOT `attrValue`: attrValue maps rejected characters to
      // SPACES, so a 32-char bound still yields readable prose — measured, the
      // test for this control failed against attrValue first. One token, no
      // spaces, or the fixed word `unrecognized`.
      const label = reportToken(typeof type === 'string' ? type : '');
      unmapped.set(label, (unmapped.get(label) ?? 0) + 1);
    }

    const kids = childIds.get(id);
    if (kids?.length) {
      const kept: Array<Record<string, unknown>> = [];
      for (const kid of kids) {
        // Prune Figma's internal-only nodes as WHOLE SUBTREES here, where the
        // parentage is already resolved, rather than dropping them up front.
        if (byId.get(kid)?.internalOnly === true) {
          internalSkipped += countSubtree(kid, new Set());
          continue;
        }
        kept.push(build(kid, absolute, depth + 1));
      }
      if (kept.length > 0) node.children = kept;
    }

    onStack.delete(id);
    return node;
  };

  if (byId.get(roots[0])?.internalOnly === true) {
    throw new FigDecodeError('the document root is marked internal-only');
  }
  const root = build(roots[0], IDENTITY, 0);
  return { root, unmapped, internalSkipped, nodeCount, lossyLineHeights: lossy.lineHeights };
}

// ── The door ────────────────────────────────────────────────────────────────

export interface DecodeFigOptions {
  /** Charset-validated upstream. Provenance only — never derived from the file. */
  fileKey: string;
}

/**
 * Decode a `.fig` / `.jam` archive into the normalized tree both doors share.
 */
export function decodeFigArchive(archive: Uint8Array, opts: DecodeFigOptions): FigDecodeResult {
  // Both the directory parse AND the lazy per-entry read can refuse, and a
  // caller of this door should only ever have to catch FigDecodeError. Wrapping
  // just the first call let a FigZipError escape from `get()` — caught by the
  // fuzz corpus, which is exactly the class of leak it exists to find.
  let zip: ReturnType<typeof readFigZip>;
  let canvas: Uint8Array | undefined;
  try {
    zip = readFigZip(archive);
    canvas = zip.get(CANVAS_ENTRY);
  } catch (err) {
    if (err instanceof FigZipError) throw new FigDecodeError(err.message);
    throw err;
  }

  if (!canvas) throw new FigDecodeError(`archive has no ${CANVAS_ENTRY} entry`);

  const container = readFigContainer(canvas);

  let schema: KiwiSchema;
  let message: Record<string, unknown> | undefined;
  try {
    schema = parseKiwiSchema(container.schema);
    const rootIndex = findRootDefinition(schema, 'Message', 'nodeChanges', 'NodeChange');
    message = obj(decodeKiwi(container.data, schema, rootIndex));
  } catch (err) {
    throw new FigDecodeError(`could not decode canvas.fig: ${(err as Error).message}`);
  }

  const changes = message?.nodeChanges;
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new FigDecodeError('canvas.fig carries no node changes');
  }

  const { root, unmapped, internalSkipped, nodeCount, lossyLineHeights } = rebuildTree(changes);

  const document = normalizeDocument(root, {
    fileKey: opts.fileKey,
    surface: container.surface,
    origin: 'fig',
  });

  return {
    document,
    report: {
      containerVersion: container.version,
      schemaSha256: container.schemaSha256,
      exportedAt: readExportedAt(safeEntry(zip, META_ENTRY)),
      nodeCount,
      unmappedTypes: [...unmapped.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      internalNodesSkipped: internalSkipped,
      lossyFields: lossyLineHeights > 0 ? [{ ...LOSSY_LINE_HEIGHT, count: lossyLineHeights }] : [],
    },
  };
}

/**
 * `meta.json` is optional and its bytes are lazily verified, so a corrupt entry
 * must not turn a decodable document into a hard failure — nor let a
 * FigZipError escape this door's error type.
 */
function safeEntry(zip: ReturnType<typeof readFigZip>, name: string): Uint8Array | undefined {
  try {
    return zip.get(name);
  } catch {
    return undefined;
  }
}

/**
 * Read `exported_at` (Tier 4 needs it) and DELIBERATELY DROP `file_name`, which
 * sits in the same object: DDR-216 D7 forbids recording the Figma file NAME
 * anywhere an agent later reads (DDR-221 A6). The REST door never had it to
 * hand; this one must decline it explicitly.
 */
function readExportedAt(metaBytes: Uint8Array | undefined): string | undefined {
  if (!metaBytes) return undefined;
  try {
    const meta = obj(JSON.parse(new TextDecoder().decode(metaBytes)));
    const exportedAt = str(meta?.exported_at);
    if (!exportedAt) return undefined;
    // Bounded and charset-checked: it is untrusted text from the archive.
    return /^[0-9TZ:.-]{1,32}$/.test(exportedAt) ? exportedAt : undefined;
  } catch {
    return undefined;
  }
}
