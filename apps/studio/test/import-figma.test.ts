// `maude design import-figma --board` — the write path (DDR-216 T6).
//
// The translation itself is covered by `figma/to-strokes.test.ts`. What this
// file owns is the VERB's own contract:
//
//   • the output goes through the canonical serializer + `sanitizeAnnotationSvg`
//     (D6's annotation row) and lands at a code-computed slug;
//   • assets/artifacts stage OUTSIDE the design root and are promoted only on
//     success, so a failure leaves nothing in a versioned, Syncthing-replicated
//     directory (D5 — "gitignored" is NOT "not replicated");
//   • the write is realpath-contained;
//   • the summary is enum + node ids ONLY, never node text, because this verb
//     is run BY an agent and everything it prints is model input (D10).

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  formatSummary,
  ImportFigmaError,
  importBoard,
  importFrames,
  importTokens,
} from '../bin/_import-figma.mjs';

const TOKEN = 'figd_VERBCANARY_0123456789abcdef';
const BOARD_URL = 'https://www.figma.com/board/Em6NOwaOFTYV7NlQT4NK8l/Analyza';

let sandbox: string;
let keysDir: string;
let realFetch: typeof fetch;

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

/** A board carrying a hostile layer name, a hidden node and an unmappable one. */
const DOC = {
  document: {
    id: '0:0',
    name: 'Document',
    type: 'CANVAS',
    children: [
      {
        id: '1:8',
        name: 'Sticky',
        type: 'STICKY',
        absoluteBoundingBox: box(-3244, -6272, 240, 240),
        characters: 'Persona A',
      },
      {
        id: '2:17',
        name: 'Příliš žluťoučký — "test" / <b> & \'x\'',
        type: 'SHAPE_WITH_TEXT',
        shapeType: 'SQUARE',
        absoluteBoundingBox: box(0, 0, 200, 200),
        characters: 'SECRET_BODY_TEXT',
      },
      {
        id: '2:40',
        name: 'Parallelogram',
        type: 'SHAPE_WITH_TEXT',
        shapeType: 'PARALLELOGRAM_RIGHT',
        absoluteBoundingBox: box(400, 0, 200, 200),
      },
      {
        id: '9:1',
        name: 'hidden',
        type: 'STICKY',
        visible: false,
        characters: 'you cannot see me',
        absoluteBoundingBox: box(800, 0, 240, 240),
      },
    ],
  },
};

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'maude-figma-verb-'));
  mkdirSync(join(sandbox, '.design'), { recursive: true });
  keysDir = mkdtempSync(join(tmpdir(), 'maude-figma-verb-keys-'));
  const keysPath = join(keysDir, 'keys.json');
  writeFileSync(keysPath, JSON.stringify({ keys: { figma: TOKEN } }), { mode: 0o600 });
  process.env.MAUDE_GEN_KEYS_PATH = keysPath;
  realFetch = globalThis.fetch;
  globalThis.fetch = mock(
    async () =>
      new Response(JSON.stringify(DOC), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  rmSync(sandbox, { recursive: true, force: true });
  rmSync(keysDir, { recursive: true, force: true });
  delete process.env.MAUDE_GEN_KEYS_PATH;
});

describe('--board writes a sanitized annotation layer', () => {
  test('lands at a code-computed slug under the design root', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox });
    expect(result.slug).toMatch(/^figjam-[a-z0-9]{1,8}$/);
    expect(result.path?.startsWith(join(sandbox, '.design'))).toBe(true);
    expect(existsSync(result.path as string)).toBe(true);
  });

  test('the slug is NEVER derived from a Figma string', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox });
    expect(result.slug).not.toContain('žlu');
    expect(result.slug).not.toContain('<');
    expect(result.slug).toMatch(/^[a-z0-9-]{1,64}$/);
  });

  test('the written SVG is sanitizer-clean — no markup from the hostile name', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox });
    const svg = readFileSync(result.path as string, 'utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).not.toContain('<b>');
    expect(svg).not.toContain('<script');
    expect(svg).not.toMatch(/\son[a-z]+=/i);
  });

  test('a hidden node is not written', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox });
    const svg = readFileSync(result.path as string, 'utf8');
    expect(svg).not.toContain('you cannot see me');
  });

  test('an explicit --slug is honoured when it is a valid slug', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox, slug: 'retro-q3' });
    expect(result.slug).toBe('retro-q3');
    expect(result.path?.endsWith('retro-q3.annotations.svg')).toBe(true);
  });

  test.each([
    ['traversal', '../../etc/passwd'],
    ['absolute', '/etc/passwd'],
    ['uppercase + spaces', 'My Board'],
    ['too long', 'a'.repeat(65)],
  ])('a hostile --slug is rejected (%s), nothing is written', async (_label, slug) => {
    await expect(importBoard({ url: BOARD_URL, root: sandbox, slug })).rejects.toBeInstanceOf(
      ImportFigmaError
    );
    expect(readdirSync(join(sandbox, '.design'))).toEqual([]);
  });
});

describe('staging is outside the design root, and leaves nothing behind', () => {
  test('a successful run leaves exactly one file and no staging residue', async () => {
    await importBoard({ url: BOARD_URL, root: sandbox });
    const entries = readdirSync(join(sandbox, '.design'));
    expect(entries.length).toBe(1);
    expect(entries[0].endsWith('.annotations.svg')).toBe(true);
    // No `.tmp-*` / staging directory anywhere under the design root.
    expect(entries.some((e) => e.startsWith('.tmp') || e.startsWith('maude-figma-'))).toBe(false);
  });

  test('a dry run writes NOTHING but still reports', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox, dryRun: true });
    expect(result.path).toBeUndefined();
    expect(result.strokeCount).toBeGreaterThan(0);
    expect(readdirSync(join(sandbox, '.design'))).toEqual([]);
  });
});

describe('the summary is model input — enum + node ids only (D10)', () => {
  test('names and body text never appear in the summary', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox, dryRun: true });
    const summary = formatSummary(result.report);
    expect(summary).not.toContain('žluťoučký');
    expect(summary).not.toContain('SECRET_BODY_TEXT');
    expect(summary).not.toContain('you cannot see me');
    expect(summary).not.toContain('Persona A');
  });

  test('every non-clean disposition is named by node id and a fixed reason', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox, dryRun: true });
    const summary = formatSummary(result.report);
    // The unmappable shape is reported, not silently dropped.
    expect(summary).toContain('2:40');
    expect(summary).toContain('unmappable-shape');
    // The hidden node is reported too.
    expect(summary).toContain('9:1');
    expect(summary).toContain('hidden-node-skipped');
  });

  test('the origin shift is reported so a huge negative-space board is explicable', async () => {
    const result = await importBoard({ url: BOARD_URL, root: sandbox, dryRun: true });
    expect(result.origin).toEqual({ x: -3244, y: -6272 });
  });
});

// ── --frames (Phase 3) ──────────────────────────────────────────────────────

const DESIGN_DOC = {
  document: {
    id: '0:1',
    name: 'Page 1',
    type: 'CANVAS',
    children: [
      {
        id: '1:2',
        name: 'AL Horizontal (-> flex row)',
        type: 'FRAME',
        layoutMode: 'HORIZONTAL',
        itemSpacing: 16,
        absoluteBoundingBox: box(0, 0, 400, 100),
        children: [
          {
            id: '1:3',
            name: 'Chip One',
            type: 'RECTANGLE',
            absoluteBoundingBox: box(0, 0, 80, 40),
          },
        ],
      },
      {
        id: '2:23',
        name: 'Karta — "uvozovky" / <script> & {curly}',
        type: 'FRAME',
        absoluteBoundingBox: box(500, 0, 400, 300),
        children: [
          {
            id: '2:20',
            name: 'H',
            type: 'TEXT',
            characters: 'Nadpis',
            style: { fontSize: 32 },
            absoluteBoundingBox: box(520, 20, 200, 40),
          },
        ],
      },
      // A loose non-frame node at page level — must not become a canvas.
      { id: '3:1', name: 'stray', type: 'RECTANGLE', absoluteBoundingBox: box(0, 400, 10, 10) },
    ],
  },
};

describe('--frames writes one canvas per top-level frame', () => {
  function stubDesign() {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify(DESIGN_DOC), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    ) as unknown as typeof fetch;
  }

  const URL_D = 'https://www.figma.com/design/dGNzRC2kmrmGnOxaBa0RI7/Fixtures';

  test('emits a .tsx + .meta.json pair per frame, and skips loose nodes', async () => {
    stubDesign();
    const r = await importFrames({ url: URL_D, root: sandbox });
    expect(r.frameCount).toBe(2);
    const files = readdirSync(join(sandbox, '.design', 'ui')).sort();
    expect(files.length).toBe(4);
    expect(files.filter((f) => f.endsWith('.tsx')).length).toBe(2);
    expect(files.filter((f) => f.endsWith('.meta.json')).length).toBe(2);
  });

  test('the meta stamps kind + a real importedAt', async () => {
    stubDesign();
    const r = await importFrames({ url: URL_D, root: sandbox });
    const metaPath = (r.written[0].path as string).replace(/\.tsx$/, '.meta.json');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    expect(meta.kind).toBe('imported-figma');
    expect(meta.source.nodeId).toMatch(/^[0-9]+:[0-9]+$/);
    expect(Number.isNaN(Date.parse(meta.source.importedAt))).toBe(false);
  });

  test('a hostile frame name never reaches a FILENAME', async () => {
    stubDesign();
    await importFrames({ url: URL_D, root: sandbox });
    for (const f of readdirSync(join(sandbox, '.design', 'ui'))) {
      expect(f).toMatch(/^[a-z0-9-]+\.(tsx|meta\.json)$/);
    }
  });

  test('a dry run writes nothing but reports metrics', async () => {
    stubDesign();
    const r = await importFrames({ url: URL_D, root: sandbox, dryRun: true });
    expect(r.written[0].metrics.bytes).toBeGreaterThan(0);
    expect(existsSync(join(sandbox, '.design', 'ui'))).toBe(false);
  });

  test('a document with no frame refuses rather than writing an empty canvas', async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({ document: { id: '0:1', name: 'P', type: 'CANVAS', children: [] } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    ) as unknown as typeof fetch;
    await expect(importFrames({ url: URL_D, root: sandbox })).rejects.toBeInstanceOf(
      ImportFigmaError
    );
  });
});

// ── --tokens (Phase 4) ──────────────────────────────────────────────────────

describe('--tokens degrades from Variables to styles without surfacing an error', () => {
  const URL_D = 'https://www.figma.com/design/dGNzRC2kmrmGnOxaBa0RI7/Fixtures';

  test('a 403 on the Enterprise-gated Variables endpoint falls back to styles', async () => {
    // This is the COMMON case, not an error state — the dogfood account is Pro.
    let call = 0;
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      call += 1;
      const url = String(input);
      if (url.includes('/variables/local')) {
        return new Response(JSON.stringify({ err: 'plan' }), { status: 403 });
      }
      if (url.includes('/styles')) {
        return new Response(
          JSON.stringify({
            meta: {
              styles: [{ key: 'k', name: 'Brand/Primary', style_type: 'FILL', node_id: '1:1' }],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          nodes: {
            '1:1': {
              document: {
                id: '1:1',
                name: 'swatch',
                type: 'RECTANGLE',
                fills: [{ type: 'SOLID', visible: true, color: { r: 1, g: 0, b: 0, a: 1 } }],
              },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as unknown as typeof fetch;

    const r = await importTokens({ url: URL_D, root: sandbox, dryRun: true });
    expect(r.source).toBe('styles');
    expect(r.count).toBe(1);
    expect(r.tokens).toEqual({ brand: { primary: { $type: 'color', $value: '#ff0000' } } });
    expect(call).toBeGreaterThan(1);
  });

  test('the emitted file is plain JSON, staged outside then promoted', async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/variables/local')) return new Response('{}', { status: 403 });
      if (url.includes('/styles')) {
        return new Response(JSON.stringify({ meta: { styles: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const r = await importTokens({ url: URL_D, root: sandbox });
    expect(r.path).toContain('_history');
    expect(() => JSON.parse(readFileSync(r.path as string, 'utf8'))).not.toThrow();
  });
});

describe('the asset pipeline is actually WIRED into --frames', () => {
  const URL_D = 'https://www.figma.com/design/dGNzRC2kmrmGnOxaBa0RI7/Fixtures';

  const VECTOR_DOC = {
    document: {
      id: '0:1',
      name: 'Page 1',
      type: 'CANVAS',
      children: [
        {
          id: '1:1',
          name: 'Frame with a mark',
          type: 'FRAME',
          absoluteBoundingBox: box(0, 0, 400, 300),
          children: [
            {
              id: '2:1',
              name: 'Mark wrapper',
              type: 'GROUP',
              absoluteBoundingBox: box(0, 0, 90, 72),
              children: [
                { id: '2:2', name: 'v', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 20, 20) },
                { id: '2:3', name: 'v', type: 'VECTOR', absoluteBoundingBox: box(20, 0, 20, 20) },
              ],
            },
          ],
        },
      ],
    },
  };

  /** Answer the document, and decline to render anything. */
  function stubDeclineRender() {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/v1/images/')) {
        return new Response(JSON.stringify({ images: { '2:1': null } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(VECTOR_DOC), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
  }

  test('a collapsed cluster reaches the image endpoint as ONE batched request', async () => {
    const seen: string[] = [];
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input);
      seen.push(url);
      if (url.includes('/v1/images/')) {
        return new Response(JSON.stringify({ images: { '2:1': null } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(VECTOR_DOC), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const r = await importFrames({ url: URL_D, root: sandbox });
    const imageCalls = seen.filter((u) => u.includes('/v1/images/'));
    // ONE call for the whole cluster — the collapse is what keeps this at 1
    // instead of 2 (or, on a real logo, 14).
    expect(imageCalls.length).toBe(1);
    expect(new URL(imageCalls[0]).searchParams.get('ids')).toBe('2:1');
    expect(new URL(imageCalls[0]).searchParams.get('format')).toBe('svg');
    expect(r.pendingExports).toBe(1);
  });

  test('an unresolved asset is REPORTED and its placeholder survives in the source', async () => {
    stubDeclineRender();
    const r = await importFrames({ url: URL_D, root: sandbox });
    expect(r.resolvedAssets).toBe(0);
    const tsx = readFileSync(r.written[0].path as string, 'utf8');
    // A visibly broken image beats a silently missing element.
    expect(tsx).toContain('/assets/pending-');
    const dispositions = r.reports.flatMap((rep) => rep.entries.map((e) => e.disposition));
    expect(dispositions).toContain('asset-skipped');
  });

  test('the emitted canvas NEVER references a figma.com URL, resolved or not', async () => {
    stubDeclineRender();
    const r = await importFrames({ url: URL_D, root: sandbox });
    const tsx = readFileSync(r.written[0].path as string, 'utf8');
    expect(tsx).not.toContain('figma.com');
    expect(tsx).not.toMatch(/src="https?:/);
  });
});
