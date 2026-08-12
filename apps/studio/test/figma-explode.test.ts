// `maude design import-figma --explode` — the DDR-219 D8 write model.
//
// Every clause of D8 is a REFUSAL, so most of this file is refusals. The one
// happy path drives the whole verb against a stubbed local MCP server and a
// stubbed asset lane, and then asserts the two things that make a codegen
// artboard honest: it renders as JSX, and the file says where it came from.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSync } from 'oxc-parser';
import { explodeArtboard, ImportFigmaError } from '../bin/_import-figma.mjs';
import { CodegenSession } from '../figma/codegen-client.ts';

// The asset constant deliberately omits the Dev Mode PORT: the reachability
// guard (`cli/lib/figma-codegen-reachability.test.mjs`) bans that literal
// outside the codegen client and its own tests, and a guard is only worth having
// while it stays absolute. The port is irrelevant to what this file asserts —
// that the URL is DISCARDED and the artwork comes back through the node-id lane.
// The byte-faithful capture lives in `figma/from-codegen.test.ts`.
const MODULE = `const imgIcon = "http://localhost/assets/aaaa.svg";

export default function Cover() {
  return (
    <div className="bg-white flex flex-col size-full" data-node-id="6:907" data-name="Cover">
      <p className="text-[16px] font-bold">Hello</p>
      <div className="size-[24px]" data-node-id="6:908" data-name="Mark">
        <img alt="" className="size-full" src={imgIcon} />
      </div>
    </div>
  );
}`;

const CANVAS = `// Imported from Figma — THIRD-PARTY CONTENT (DDR-216).
import { DCArtboard, DesignCanvas } from '@maude/canvas-lib';

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCArtboard id="node-6-907" label="Cover" width={1440} height={1024} kind="digital" layout="block" background="#ffffff">
        <img src="/assets/aaa.svg" alt="Cover" data-dc-element="Cover" data-figma-node="6:907" style={{ width: "100%", height: "100%" }} />
      </DCArtboard>
      <DCArtboard id="node-6-910" label="Second" width={800} height={600} kind="digital" layout="block" background="#ffffff">
        <img src="/assets/bbb.svg" alt="Second" data-figma-node="6:910" style={{ width: "100%", height: "100%" }} />
      </DCArtboard>
    </DesignCanvas>
  );
}
`;

const META = {
  kind: 'imported-figma',
  mode: 'render',
  source: { fileKey: '2H6a9YUgPAu0AGdEiwP895', nodeId: '0:1', importedAt: '2026-08-11T00:00:00Z' },
  layout: { artboards: [{ id: 'node-6-907', x: 0, y: 0 }] },
  figma: {
    frames: [
      {
        id: 'node-6-907',
        nodeId: '6:907',
        type: 'FRAME',
        label: 'Cover',
        w: 1440,
        h: 1024,
        route: 'render',
      },
      {
        id: 'node-6-910',
        nodeId: '6:910',
        type: 'FRAME',
        label: 'Second',
        w: 800,
        h: 600,
        route: 'render',
      },
    ],
  },
};

function sse(payload: unknown): Response {
  return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'mcp-session-id': 's' },
  });
}

/**
 * A stubbed asset lane. The REAL one is exercised by `figma/assets.test.ts`; the
 * codegen route reuses it verbatim (D6 — re-fetch by node id), and wiring the
 * real one in here would spend the developer's actual Figma PAT against a
 * fixture file key.
 */
function stubAssets(refs: Record<string, string> = {}) {
  return async (
    _fileKey: string,
    requests: ReadonlyArray<{ nodeId: string; placeholder: string }>
  ) => {
    const rewrites = new Map<string, string>();
    const resolved: Array<{ nodeId: string }> = [];
    for (const r of requests) {
      const ref = refs[r.nodeId];
      if (!ref) continue;
      rewrites.set(r.placeholder, ref);
      resolved.push({ nodeId: r.nodeId });
    }
    return { resolved, rewrites, totalBytes: 0 };
  };
}

/** A local Dev Mode server that answers exactly like the measured one. */
function mcpSession(code = MODULE) {
  const fetchImpl = async (_url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init.body)) as { method: string; id: number };
    if (body.method === 'initialize') {
      return sse({ result: { serverInfo: { name: 'Figma Dev Mode MCP Server' } }, id: body.id });
    }
    if (body.method === 'notifications/initialized') return new Response('', { status: 202 });
    if (body.method === 'tools/list') {
      return sse({ result: { tools: [{ name: 'get_design_context' }] }, id: body.id });
    }
    return sse({ result: { content: [{ type: 'text', text: code }] }, id: body.id });
  };
  return new CodegenSession({ fetchImpl });
}

function project(over: { meta?: unknown; canvas?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'maude-explode-'));
  const uiDir = join(root, '.design', 'ui', 'figma-2h6a9yug');
  mkdirSync(uiDir, { recursive: true });
  writeFileSync(join(uiDir, 'Page 1.tsx'), over.canvas ?? CANVAS);
  writeFileSync(join(uiDir, 'Page 1.meta.json'), `${JSON.stringify(over.meta ?? META, null, 2)}\n`);
  return { root, canvasRel: 'ui/figma-2h6a9yug/Page 1.tsx' };
}

const BASE = { artboardId: 'node-6-907', designRootRel: '.design' };

describe('the happy path', () => {
  test('one artboard becomes editable JSX, and only that one', async () => {
    const { root, canvasRel } = project();
    try {
      const r = await explodeArtboard({
        root,
        canvasRel,
        ...BASE,
        session: mcpSession(),
        resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
      });
      expect(r.written).toBe(true);

      const out = readFileSync(join(root, '.design', canvasRel), 'utf8');
      // The exploded artboard is now real JSX…
      expect(out).toContain("{'Hello'}");
      expect(out).toContain('label="Cover · codegen"');
      // …and the other artboard is untouched.
      expect(out).toContain('label="Second"');
      expect(out).toContain('src="/assets/bbb.svg"');
      // D6 — the response's own asset URL was discarded and the artwork came
      // back through the node-id lane instead.
      expect(out).toContain('src="/assets/deadbeef.svg"');
      expect(out).not.toContain('localhost');
      // The canvas still parses, which is the whole bar.
      expect(parseSync('c.tsx', out, { sourceType: 'module' }).errors).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('provenance lands in the FILE, because the chip cannot express mixed provenance', async () => {
    const { root, canvasRel } = project();
    try {
      const r = await explodeArtboard({
        root,
        canvasRel,
        ...BASE,
        session: mcpSession(),
        resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
      });
      const out = readFileSync(join(root, '.design', canvasRel), 'utf8');
      // `design-system-keeper`, the critic panel and `/design:edit` read the
      // FILE and never see a tree chip (DDR-219 D7).
      expect(out).toContain('GENERATED BY FIGMA, NOT BY MAUDE');
      expect(out).toContain('NOT reproducible');
      expect(out).toContain(r.responseSha256);

      const meta = JSON.parse(
        readFileSync(join(root, '.design', 'ui/figma-2h6a9yug/Page 1.meta.json'), 'utf8')
      );
      const frames = meta.figma.frames as Array<Record<string, unknown>>;
      expect(frames[0]).toMatchObject({
        id: 'node-6-907',
        route: 'codegen',
        endpoint: 'local',
        tool: 'get_design_context',
        responseSha256: r.responseSha256,
      });
      // The sibling frame's provenance must NOT have been rewritten.
      expect(frames[1].route).toBe('render');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('the prior canvas is snapshotted before the write', async () => {
    const { root, canvasRel } = project();
    try {
      await explodeArtboard({
        root,
        canvasRel,
        ...BASE,
        session: mcpSession(),
        resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
      });
      const histDir = join(root, '.design', '_history', 'ui-figma-2h6a9yug-page_1');
      const files = readdirSync(histDir);
      expect(files.some((f) => f.endsWith('.tsx'))).toBe(true);
      const snap = readFileSync(join(histDir, files.find((f) => f.endsWith('.tsx'))!), 'utf8');
      expect(snap).toBe(CANVAS);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('--dry-run spends the codegen call and writes NOTHING', async () => {
    const { root, canvasRel } = project();
    try {
      const r = await explodeArtboard({
        root,
        canvasRel,
        ...BASE,
        dryRun: true,
        session: mcpSession(),
        resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
      });
      expect(r.written).toBe(false);
      expect(readFileSync(join(root, '.design', canvasRel), 'utf8')).toBe(CANVAS);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the target is never the producer’s choice (D8 / DDR-216 D3)', () => {
  const cases: Array<[string, (p: ReturnType<typeof project>) => Record<string, unknown>]> = [
    ['a canvas outside the design root', (_p) => ({ canvasRel: '../../../etc/passwd.tsx' })],
    ['an absolute path', () => ({ canvasRel: '/etc/passwd.tsx' })],
    ['a non-existent canvas', () => ({ canvasRel: 'ui/nope.tsx' })],
    ['a bad artboard charset', (p) => ({ canvasRel: p.canvasRel, artboardId: '../../etc' })],
    [
      'an artboard not in figma.frames[]',
      (p) => ({ canvasRel: p.canvasRel, artboardId: 'node-9-9' }),
    ],
  ];

  for (const [label, build] of cases) {
    test(`refuses: ${label}`, async () => {
      const p = project();
      try {
        await expect(
          explodeArtboard({
            root: p.root,
            ...BASE,
            canvasRel: p.canvasRel,
            ...build(p),
            session: mcpSession(),
            resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
          })
        ).rejects.toBeInstanceOf(ImportFigmaError);
      } finally {
        rmSync(p.root, { recursive: true, force: true });
      }
    });
  }

  test('refuses to CREATE a canvas — an explode is an edit, never a mint', async () => {
    const p = project();
    try {
      rmSync(join(p.root, '.design', p.canvasRel));
      await expect(
        explodeArtboard({
          root: p.root,
          canvasRel: p.canvasRel,
          ...BASE,
          session: mcpSession(),
          resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
        })
      ).rejects.toThrow(/no such imported canvas/);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  test('refuses a canvas that is not imported-figma', async () => {
    const p = project({ meta: { ...META, kind: 'digital' } });
    try {
      await expect(
        explodeArtboard({
          root: p.root,
          canvasRel: p.canvasRel,
          ...BASE,
          session: mcpSession(),
          resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
        })
      ).rejects.toThrow(/not an imported-figma canvas/);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  test('refuses to re-explode an artboard that is already codegen', async () => {
    const meta = structuredClone(META);
    meta.figma.frames[0].route = 'codegen';
    const p = project({ meta });
    try {
      await expect(
        explodeArtboard({
          root: p.root,
          canvasRel: p.canvasRel,
          ...BASE,
          session: mcpSession(),
          resolveAssetsImpl: stubAssets({ '6:908': '/assets/deadbeef.svg' }),
        })
      ).rejects.toThrow(/already codegen/);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });
});

describe('the open-document coupling (probe finding 1 / residual 8)', () => {
  test('a node id that resolves in the WRONG document is caught by the name cross-check', async () => {
    // `get_design_context` takes NO file key — it reads whatever Figma has open —
    // and node ids are not unique across files. Every other control passes here:
    // the id matches, the canvas is right, the write model is satisfied. Only
    // the name says the document is wrong.
    const p = project();
    try {
      const wrongDoc = MODULE.replace('data-name="Cover"', 'data-name="Checkout step 2"');
      await expect(
        explodeArtboard({
          root: p.root,
          canvasRel: p.canvasRel,
          ...BASE,
          session: mcpSession(wrongDoc),
          resolveAssetsImpl: stubAssets(),
        })
      ).rejects.toThrow(/does not match this canvas/);
      // Nothing was written.
      expect(readFileSync(join(p.root, '.design', p.canvasRel), 'utf8')).toBe(CANVAS);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  test('the refusal names NEITHER document’s text — stdout is code-owned (D10)', async () => {
    const p = project();
    try {
      const wrongDoc = MODULE.replace('data-name="Cover"', 'data-name="Secret Client Project"');
      await explodeArtboard({
        root: p.root,
        canvasRel: p.canvasRel,
        ...BASE,
        session: mcpSession(wrongDoc),
        resolveAssetsImpl: stubAssets(),
      });
      throw new Error('should have refused');
    } catch (err) {
      expect((err as Error).message).not.toContain('Secret Client Project');
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  test('--confirm-document is the escape hatch for a frame renamed in Figma', async () => {
    const p = project();
    try {
      const renamed = MODULE.replace('data-name="Cover"', 'data-name="Cover v2"');
      const r = await explodeArtboard({
        root: p.root,
        canvasRel: p.canvasRel,
        ...BASE,
        confirmDocument: true,
        session: mcpSession(renamed),
        resolveAssetsImpl: stubAssets(),
      });
      expect(r.written).toBe(true);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });

  test('a different NODE than the one requested is always a refusal', async () => {
    const p = project();
    try {
      const otherNode = MODULE.replace('data-node-id="6:907"', 'data-node-id="9:999"');
      await expect(
        explodeArtboard({
          root: p.root,
          canvasRel: p.canvasRel,
          ...BASE,
          confirmDocument: true,
          session: mcpSession(otherNode),
          resolveAssetsImpl: stubAssets(),
        })
      ).rejects.toThrow(/different node/);
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });
});

describe('the call ceiling is the verb’s, not the caller’s (T20b / D10)', () => {
  test('one session serves one explode; a second refuses', async () => {
    const p = project();
    const session = mcpSession();
    try {
      await explodeArtboard({
        root: p.root,
        canvasRel: p.canvasRel,
        ...BASE,
        session,
        resolveAssetsImpl: stubAssets(),
      });
      await expect(
        explodeArtboard({
          root: p.root,
          canvasRel: p.canvasRel,
          artboardId: 'node-6-910',
          designRootRel: '.design',
          session,
          resolveAssetsImpl: stubAssets(),
        })
      ).rejects.toMatchObject({ kind: 'ceiling' });
    } finally {
      rmSync(p.root, { recursive: true, force: true });
    }
  });
});
