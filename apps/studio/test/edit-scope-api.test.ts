// GET /_api/edit-scope — the INV-3 local-vs-shared predictability verdict
// (feature-element-editing-robustness Stage H). Boots a real server, serves a
// canvas with a `Card` component reused 3×, then asserts:
//   • an element INSIDE the reused component → scope 'shared', affects 3
//   • a top-level artboard element → scope 'local'
//   • the `.map()` caveat (DDR-139) — a local element rendered N× (client-
//     supplied `rendered`) → scope 'shared', reason 'mapped'
//   • the route is main-origin only (proven separately in canvas-origin-gate).

import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const CANVAS_SRC = `const Card = ({ title }) => (
  <div className="card">
    <h3>{title}</h3>
  </div>
);

export default function Gallery() {
  return (
    <DesignCanvas>
      <DCArtboard id="home" label="Home" width={1440} height={1024}>
        <section className="grid">
          <Card title="A" />
          <Card title="B" />
          <Card title="C" />
        </section>
      </DCArtboard>
    </DesignCanvas>
  );
}
`;

interface LocEntry {
  line: number;
  jsxPath: string[];
  componentName: string;
}

async function boot() {
  const { root, designRoot } = makeSandbox();
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(join(designRoot, 'ui', 'Gallery.tsx'), CANVAS_SRC);
  const port = nextPort();
  const proc = await bootServer(root, port);
  return { designRoot, main: `http://localhost:${port}`, proc };
}

/** Warm the pipeline (stamps cd-ids + writes _locator.json), return the map. */
async function locatorMap(main: string, designRoot: string): Promise<Record<string, LocEntry>> {
  const r = await fetch(`${main}/.design/ui/Gallery.tsx`, { signal: AbortSignal.timeout(2000) });
  expect(r.status).toBe(200);
  const locator = JSON.parse(readFileSync(join(designRoot, '_locator.json'), 'utf8'));
  return locator['ui/Gallery'] as Record<string, LocEntry>;
}

function findId(map: Record<string, LocEntry>, pred: (e: LocEntry) => boolean): string {
  const hit = Object.entries(map).find(([, e]) => pred(e));
  if (!hit) throw new Error('no matching locator entry');
  return hit[0];
}

async function scope(main: string, id: string, rendered?: number) {
  const q = new URLSearchParams({ canvas: 'ui/Gallery', id });
  if (rendered != null) q.set('rendered', String(rendered));
  const res = await fetch(`${main}/_api/edit-scope?${q}`, { signal: AbortSignal.timeout(2000) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('GET /_api/edit-scope', () => {
  test('reports shared for a reused-component inner element, local for a top-level one', async () => {
    const { designRoot, main, proc } = await boot();
    try {
      const map = await locatorMap(main, designRoot);

      // An element inside the reused `Card` component (componentName === 'Card').
      const innerId = findId(map, (e) => e.componentName === 'Card');
      const shared = await scope(main, innerId);
      expect(shared.status).toBe(200);
      expect(shared.body.scope).toBe('shared');
      expect(shared.body.componentName).toBe('Card');
      expect(shared.body.affects).toBe(3);
      expect(shared.body.reason).toBe('component');

      // A top-level artboard element (the <section>) — not inside a reused comp.
      const topId = findId(
        map,
        (e) => e.componentName !== 'Card' && e.jsxPath[e.jsxPath.length - 1] === 'section'
      );
      const local = await scope(main, topId);
      expect(local.status).toBe(200);
      expect(local.body.scope).toBe('local');
      expect(local.body.affects).toBe(1);
      expect(local.body.reason).toBe('single');

      // The .map() caveat (DDR-139): a local element the client says renders N×
      // is 'shared' ('mapped') even though its source usage count is 1.
      const mapped = await scope(main, topId, 4);
      expect(mapped.body.scope).toBe('shared');
      expect(mapped.body.reason).toBe('mapped');
      expect(mapped.body.affects).toBe(4);

      // A bogus id is a 400 (invalid data-cd-id shape).
      const bad = await fetch(`${main}/_api/edit-scope?canvas=ui/Gallery&id=zzz`, {
        signal: AbortSignal.timeout(2000),
      });
      expect(bad.status).toBe(400);
    } finally {
      await killProc(proc as never);
    }
  });
});
