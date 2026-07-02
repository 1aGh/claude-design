// POST /_api/reorder round-trip (DDR-138, phase-12.1). Boots a real server,
// serves a canvas (which injects data-cd-id + writes _locator.json), then drives
// a node-move reorder through the HTTP layer and asserts: the source reorders on
// disk, the response carries the recomputed movedId, a pre-reorder history
// snapshot is written (so /design:rollback can undo it), and a cross-origin POST
// is CSRF-rejected. Route unreachability from the canvas origin is proven
// separately in canvas-origin-gate.test.ts.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const CANVAS_SRC = `export default function List() {
  return (
    <section>
      <div>A</div>
      <div>B</div>
      <div>C</div>
    </section>
  );
}
`;

/** After a GET of the canvas, read _locator.json and return the div ids ordered
 *  by source line (== authored order A, B, C). */
async function divIdsByLine(main: string, designRoot: string): Promise<string[]> {
  // Serving the canvas triggers pass-1 id injection + _locator.json write.
  const r = await fetch(`${main}/.design/ui/List.tsx`, { signal: AbortSignal.timeout(2000) });
  expect(r.status).toBe(200);
  const locator = JSON.parse(readFileSync(join(designRoot, '_locator.json'), 'utf8'));
  const map = locator['ui/List'] as Record<string, { line: number; jsxPath: string[] }>;
  return Object.entries(map)
    .filter(([, e]) => e.jsxPath[e.jsxPath.length - 1] === 'div')
    .sort((a, b) => a[1].line - b[1].line)
    .map(([id]) => id);
}

/** The visible letter order (A/B/C) in the on-disk source — reflects sibling order. */
function letterOrder(src: string): string[] {
  return [...src.matchAll(/>([ABC])</g)].map((m) => m[1] as string);
}

describe('POST /_api/reorder — HTTP round-trip', () => {
  test('moves a sibling on disk, returns movedId, snapshots pre-reorder, CSRF-guards', async () => {
    const { root, designRoot } = makeSandbox();
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    const canvasPath = join(designRoot, 'ui', 'List.tsx');
    writeFileSync(canvasPath, CANVAS_SRC);

    const port = nextPort();
    const main = `http://localhost:${port}`;
    const proc = await bootServer(root, port);
    try {
      const [aId, , cId] = await divIdsByLine(main, designRoot);

      // Move A after C → order becomes B, C, A.
      const res = await fetch(`${main}/_api/reorder`, {
        method: 'POST',
        // No Origin header → same-origin/programmatic; sameOriginWrite allows it.
        body: JSON.stringify({ canvas: 'ui/List', id: aId, refId: cId, position: 'after' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        ok: boolean;
        movedId: string | null;
        semanticId: string | null;
      };
      expect(json.ok).toBe(true);
      expect(json.movedId).toMatch(/^[0-9a-f]{8}$/);

      // Source reordered on disk.
      expect(letterOrder(readFileSync(canvasPath, 'utf8'))).toEqual(['B', 'C', 'A']);

      // A pre-reorder snapshot landed under _history/ui-list/ (rollback path).
      const histDir = join(designRoot, '_history', 'ui-list');
      expect(existsSync(histDir)).toBe(true);
      const metas = readdirSync(histDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(join(histDir, f), 'utf8')) as { reason: string });
      expect(metas.some((m) => m.reason === 'pre-reorder')).toBe(true);

      // Cross-origin POST is CSRF-rejected (403), leaving the file untouched.
      const forged = await fetch(`${main}/_api/reorder`, {
        method: 'POST',
        headers: { origin: 'http://evil.example' },
        body: JSON.stringify({ canvas: 'ui/List', id: cId, refId: aId, position: 'before' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(forged.status).toBe(403);
      expect(letterOrder(readFileSync(canvasPath, 'utf8'))).toEqual(['B', 'C', 'A']);

      // A self-move is a 422 refusal (guardrail), not a 500.
      const bad = await fetch(`${main}/_api/reorder`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', id: aId, refId: aId, position: 'after' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(bad.status).toBe(422);
    } finally {
      await killProc(proc);
    }
  });
});

describe('POST /_api/reorder-revert — Cmd+Z round-trip', () => {
  test('undo restores the pre-reorder source, redo re-applies, stale content 409s', async () => {
    const { root, designRoot } = makeSandbox();
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    const canvasPath = join(designRoot, 'ui', 'List.tsx');
    writeFileSync(canvasPath, CANVAS_SRC);

    const port = nextPort();
    const main = `http://localhost:${port}`;
    const proc = await bootServer(root, port);
    try {
      const [aId, , cId] = await divIdsByLine(main, designRoot);

      // Reorder A after C → B, C, A; the response carries the revert-log seq.
      const res = await fetch(`${main}/_api/reorder`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', id: aId, refId: cId, position: 'after' }),
        signal: AbortSignal.timeout(2000),
      });
      const json = (await res.json()) as { ok: boolean; seq: number };
      expect(json.ok).toBe(true);
      expect(typeof json.seq).toBe('number');
      expect(letterOrder(readFileSync(canvasPath, 'utf8'))).toEqual(['B', 'C', 'A']);

      // Undo → back to A, B, C.
      const undo = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: json.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(undo.status).toBe(200);
      expect(letterOrder(readFileSync(canvasPath, 'utf8'))).toEqual(['A', 'B', 'C']);

      // Redo → B, C, A again.
      const redo = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: json.seq, dir: 'redo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(redo.status).toBe(200);
      expect(letterOrder(readFileSync(canvasPath, 'utf8'))).toEqual(['B', 'C', 'A']);

      // External edit → undo refuses with 409 and leaves the file alone.
      const edited = readFileSync(canvasPath, 'utf8').replace('>B<', '>B!<');
      writeFileSync(canvasPath, edited);
      const stale = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: json.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(stale.status).toBe(409);
      expect(readFileSync(canvasPath, 'utf8')).toBe(edited);

      // Unknown seq → 404; forged cross-origin POST → 403.
      const missing = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: 99999, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(missing.status).toBe(404);
      const forged = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        headers: { origin: 'http://evil.example' },
        body: JSON.stringify({ canvas: 'ui/List', seq: json.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(forged.status).toBe(403);
    } finally {
      await killProc(proc);
    }
  });
});

// Adversarial F3 (DDR-139): a REJECTED reorder must NOT deposit a _history
// snapshot — the pre-move snapshot + revert-log are written only on a confirmed
// write, so a stream of failing requests can't disk-fill _history.
describe('POST /_api/reorder — a rejected move writes no snapshot', () => {
  test('an unknown-refId reorder 422s and leaves _history empty', async () => {
    const { root, designRoot } = makeSandbox();
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(join(designRoot, 'ui', 'List.tsx'), CANVAS_SRC);
    const port = nextPort();
    const main = `http://localhost:${port}`;
    const proc = await bootServer(root, port);
    try {
      const [aId] = await divIdsByLine(main, designRoot);
      const bad = await fetch(`${main}/_api/reorder`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', id: aId, refId: 'deadbeef', position: 'after' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(bad.status).toBe(422); // refId not found → moveElement throws
      // No pre-reorder snapshot was written (the move never landed).
      const histDir = join(designRoot, '_history', 'ui-list');
      const snaps = existsSync(histDir)
        ? readdirSync(histDir).filter((f) => f.endsWith('.json'))
        : [];
      expect(snaps.length).toBe(0);
    } finally {
      await killProc(proc);
    }
  });
});
