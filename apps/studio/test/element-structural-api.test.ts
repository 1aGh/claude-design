// POST /_api/{delete-element,insert-element,insert-artboard,resize-artboard}
// round-trips (Stage I + D4, feature-element-editing-robustness). Boots a real
// server, serves a canvas (injects data-cd-id + _locator.json), then drives each
// structural edit through the HTTP layer and asserts: the source mutates on
// disk, a whole-file undo seq is returned + reverts through /_api/reorder-revert,
// a pre-op history snapshot lands, and a cross-origin POST is CSRF-rejected.
// Route unreachability from the canvas origin is proven in canvas-origin-gate.

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

const CANVAS_SRC = `export default function List() {
  return (
    <DesignCanvas>
      <DCArtboard id="home" label="Home" width={1440} height={1024}>
        <div>A</div>
        <div>B</div>
        <div>C</div>
      </DCArtboard>
    </DesignCanvas>
  );
}
`;

/** div ids ordered by source line (== authored order A, B, C). */
async function divIdsByLine(main: string, designRoot: string): Promise<string[]> {
  const r = await fetch(`${main}/.design/ui/List.tsx`, { signal: AbortSignal.timeout(2000) });
  expect(r.status).toBe(200);
  const locator = JSON.parse(readFileSync(join(designRoot, '_locator.json'), 'utf8'));
  const map = locator['ui/List'] as Record<string, { line: number; jsxPath: string[] }>;
  return Object.entries(map)
    .filter(([, e]) => e.jsxPath[e.jsxPath.length - 1] === 'div')
    .sort((a, b) => a[1].line - b[1].line)
    .map(([id]) => id);
}

function letters(src: string): string[] {
  return [...src.matchAll(/>([ABC])</g)].map((m) => m[1] as string);
}

async function boot(): Promise<{ root: string; designRoot: string; main: string; proc: unknown }> {
  const { root, designRoot } = makeSandbox();
  mkdirSync(join(designRoot, 'ui'), { recursive: true });
  writeFileSync(join(designRoot, 'ui', 'List.tsx'), CANVAS_SRC);
  const port = nextPort();
  const proc = await bootServer(root, port);
  return { root, designRoot, main: `http://localhost:${port}`, proc };
}

describe('POST /_api/delete-element', () => {
  test('removes an element on disk, returns a revert seq, snapshots, CSRF-guards', async () => {
    const { designRoot, main, proc } = await boot();
    const canvasPath = join(designRoot, 'ui', 'List.tsx');
    try {
      const [, bId] = await divIdsByLine(main, designRoot);
      const res = await fetch(`${main}/_api/delete-element`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', id: bId }),
        signal: AbortSignal.timeout(2000),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ok: boolean; seq: number };
      expect(json.ok).toBe(true);
      expect(typeof json.seq).toBe('number');
      expect(letters(readFileSync(canvasPath, 'utf8'))).toEqual(['A', 'C']);

      // pre-delete snapshot landed (rollback path).
      const histDir = join(designRoot, '_history', 'ui-list');
      expect(existsSync(histDir)).toBe(true);

      // Undo restores B.
      const undo = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: json.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(undo.status).toBe(200);
      expect(letters(readFileSync(canvasPath, 'utf8'))).toEqual(['A', 'B', 'C']);

      // Cross-origin POST is CSRF-rejected.
      const forged = await fetch(`${main}/_api/delete-element`, {
        method: 'POST',
        headers: { origin: 'http://evil.example' },
        body: JSON.stringify({ canvas: 'ui/List', id: bId }),
        signal: AbortSignal.timeout(2000),
      });
      expect(forged.status).toBe(403);
      expect(letters(readFileSync(canvasPath, 'utf8'))).toEqual(['A', 'B', 'C']);
    } finally {
      await killProc(proc as never);
    }
  });
});

describe('POST /_api/insert-element', () => {
  test('inserts a div after an anchor, returns its new id + revert seq', async () => {
    const { designRoot, main, proc } = await boot();
    const canvasPath = join(designRoot, 'ui', 'List.tsx');
    try {
      const [aId] = await divIdsByLine(main, designRoot);
      const res = await fetch(`${main}/_api/insert-element`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', refId: aId, position: 'after', kind: 'div' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { ok: boolean; newId: string | null; seq: number };
      expect(json.ok).toBe(true);
      expect(json.newId).toMatch(/^[0-9a-f]{8}$/);
      expect(readFileSync(canvasPath, 'utf8')).toContain("background: 'var(--bg-2)'");

      // Undo removes the inserted element.
      await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: json.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(readFileSync(canvasPath, 'utf8')).not.toContain("background: 'var(--bg-2)'");

      // An image insert with no src is a 422 refusal (needs a contained asset).
      const noSrc = await fetch(`${main}/_api/insert-element`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', refId: aId, position: 'after', kind: 'image' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(noSrc.status).toBe(422);
    } finally {
      await killProc(proc as never);
    }
  });
});

describe('POST /_api/insert-artboard + /_api/resize-artboard', () => {
  test('inserts an empty artboard, then resizes it via numeric props', async () => {
    const { designRoot, main, proc } = await boot();
    const canvasPath = join(designRoot, 'ui', 'List.tsx');
    try {
      // Warm the pipeline / locator.
      await divIdsByLine(main, designRoot);

      const ins = await fetch(`${main}/_api/insert-artboard`, {
        method: 'POST',
        body: JSON.stringify({
          canvas: 'ui/List',
          id: 'mobile',
          label: 'Mobile',
          width: 390,
          height: 844,
        }),
        signal: AbortSignal.timeout(2000),
      });
      expect(ins.status).toBe(200);
      const insJson = (await ins.json()) as { ok: boolean; artboardId: string; seq: number };
      expect(insJson.artboardId).toBe('mobile');
      let src = readFileSync(canvasPath, 'utf8');
      expect(src).toContain('id="mobile"');
      expect(src).toContain('width={390} height={844}');

      // Resize the new artboard (numeric props, never string literals).
      const rz = await fetch(`${main}/_api/resize-artboard`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', artboardId: 'mobile', width: 420, height: 900 }),
        signal: AbortSignal.timeout(2000),
      });
      expect(rz.status).toBe(200);
      const rzJson = (await rz.json()) as { ok: boolean; seq: number };
      src = readFileSync(canvasPath, 'utf8');
      expect(src).toContain('width={420} height={900}');
      expect(src).not.toContain('width="420"');

      // Undo the resize → back to 390×844.
      await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/List', seq: rzJson.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(readFileSync(canvasPath, 'utf8')).toContain('width={390} height={844}');

      // A duplicate-id insert is a 422 refusal.
      const dup = await fetch(`${main}/_api/insert-artboard`, {
        method: 'POST',
        body: JSON.stringify({
          canvas: 'ui/List',
          id: 'home',
          label: 'Dup',
          width: 390,
          height: 844,
        }),
        signal: AbortSignal.timeout(2000),
      });
      expect(dup.status).toBe(422);

      // Cross-origin resize is CSRF-rejected.
      const forged = await fetch(`${main}/_api/resize-artboard`, {
        method: 'POST',
        headers: { origin: 'http://evil.example' },
        body: JSON.stringify({ canvas: 'ui/List', artboardId: 'home', width: 100, height: 100 }),
        signal: AbortSignal.timeout(2000),
      });
      expect(forged.status).toBe(403);
    } finally {
      await killProc(proc as never);
    }
  });
});
