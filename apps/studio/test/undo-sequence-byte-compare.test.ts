// Stage K (Task K1, feature-element-editing-robustness) — the scripted
// mixed-op undo sequence the plan's INV-1 asks for: resize → delete → insert
// → move → spacing-drag → Cmd+Z ×5 → canvas byte-identical to the start.
//
// Drives the SAME HTTP routes the client's undo mechanisms call:
//   - CSS-shaped ops (resize/move/spacing) undo by re-POSTing `/_api/edit-css`
//     with the pre-edit value — exactly what `recordSourceEdit` +
//     `commands/edit-source-command.ts`'s `undo()` do (do/undo are both a
//     single `applyFn` call with a different `value`, so there is no
//     separate "revert" endpoint to test — the HTTP-level round-trip IS the
//     undo mechanism).
//   - Structural ops (delete/insert) undo via `/_api/reorder-revert`, the
//     whole-file seq-log swap Stage I reuses from Phase 12.1's reorder undo
//     (`commands/reorder-command.ts`) rather than a bespoke command per op.
//
// `/_api/reorder-revert` 409s if the file drifted since the logged seq (its
// own doc comment: "refuses 409 when the canvas changed since") — so the 5
// undos below MUST run in strict reverse (LIFO) order, exactly like a real
// Cmd+Z stack, or the structural reverts would fail closed. That ordering
// constraint is itself part of what this test proves.

import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootServer, killProc, makeSandbox, nextPort } from './_helpers.ts';

// Style values use DOUBLE quotes throughout — matching this codebase's own
// authored-JSX convention (canvas-lib.tsx, scaffold-design.ts): editCss's
// underlying write is a JSON.stringify literal, which is always
// double-quoted regardless of the original source's quote style. A
// single-quoted fixture would make a value round-trip only VALUE-identical,
// not byte-identical (a cosmetic quote-style delta, not a real undo gap) —
// double-quoting the fixture up front keeps this test's byte-compare
// meaningful instead of tripping over that unrelated cosmetic mismatch.
const CANVAS_SRC = `export default function Seq() {
  return (
    <DesignCanvas>
      <DCArtboard id="home" label="Home" width={1440} height={1024}>
        <figure style={{ position: "absolute", left: "20px", top: "20px", width: "100px", height: "60px" }}>Box</figure>
        <div>A</div>
        <div>B</div>
        <div>C</div>
        <section style={{ display: "flex", paddingLeft: "8px" }}>
          <span>x</span>
          <span>y</span>
        </section>
      </DCArtboard>
    </DesignCanvas>
  );
}
`;

interface LocatorEntry {
  line: number;
  jsxPath: string[];
}

async function locatorMap(main: string, designRoot: string): Promise<Record<string, LocatorEntry>> {
  const r = await fetch(`${main}/.design/ui/Seq.tsx`, { signal: AbortSignal.timeout(2000) });
  expect(r.status).toBe(200);
  const locator = JSON.parse(readFileSync(join(designRoot, '_locator.json'), 'utf8'));
  return locator['ui/Seq'] as Record<string, LocatorEntry>;
}

/** First (only, in this fixture) data-cd-id whose JSX tag is `tag`. */
function idOf(map: Record<string, LocatorEntry>, tag: string): string {
  const hit = Object.entries(map).find(([, e]) => e.jsxPath[e.jsxPath.length - 1] === tag);
  expect(hit).toBeDefined();
  return hit?.[0] as string;
}

function idsByTag(map: Record<string, LocatorEntry>, tag: string): string[] {
  return Object.entries(map)
    .filter(([, e]) => e.jsxPath[e.jsxPath.length - 1] === tag)
    .sort((a, b) => a[1].line - b[1].line)
    .map(([id]) => id);
}

async function editCss(
  main: string,
  body: { canvas: string; id: string; property: string; value: string }
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${main}/_api/edit-css`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2000),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

describe('Stage K1 — mixed resize/delete/insert/move/spacing undo sequence', () => {
  test('5 undos (LIFO) return the canvas byte-identical to its start', async () => {
    const { root, designRoot } = makeSandbox();
    mkdirSync(join(designRoot, 'ui'), { recursive: true });
    writeFileSync(join(designRoot, 'ui', 'Seq.tsx'), CANVAS_SRC);
    const port = nextPort();
    const proc = await bootServer(root, port);
    const main = `http://localhost:${port}`;
    const canvasPath = join(designRoot, 'ui', 'Seq.tsx');
    const original = readFileSync(canvasPath, 'utf8');
    expect(original).toBe(CANVAS_SRC);

    try {
      // ── 1. resize (CSS-shaped) ──────────────────────────────────────────
      let map = await locatorMap(main, designRoot);
      const boxId = idOf(map, 'figure');
      const resize = await editCss(main, {
        canvas: 'ui/Seq',
        id: boxId,
        property: 'width',
        value: '140px',
      });
      expect(resize.ok).toBe(true);
      expect(readFileSync(canvasPath, 'utf8')).toContain('width: "140px"');

      // ── 2. delete (structural) ──────────────────────────────────────────
      map = await locatorMap(main, designRoot);
      const [aId, bId] = idsByTag(map, 'div');
      const del = await fetch(`${main}/_api/delete-element`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/Seq', id: bId }),
        signal: AbortSignal.timeout(2000),
      });
      expect(del.status).toBe(200);
      const delJson = (await del.json()) as { ok: boolean; seq: number };
      expect(delJson.ok).toBe(true);
      expect(
        [...readFileSync(canvasPath, 'utf8').matchAll(/<div>([ABC])</g)].map((m) => m[1])
      ).toEqual(['A', 'C']);

      // ── 3. insert (structural) ──────────────────────────────────────────
      const ins = await fetch(`${main}/_api/insert-element`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/Seq', refId: aId, position: 'after', kind: 'div' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(ins.status).toBe(200);
      const insJson = (await ins.json()) as { ok: boolean; seq: number; newId: string | null };
      expect(insJson.ok).toBe(true);

      // ── 4. move (CSS-shaped, same box element as step 1) ────────────────
      map = await locatorMap(main, designRoot);
      const boxIdAfterStructural = idOf(map, 'figure');
      const move = await editCss(main, {
        canvas: 'ui/Seq',
        id: boxIdAfterStructural,
        property: 'left',
        value: '60px',
      });
      expect(move.ok).toBe(true);
      expect(readFileSync(canvasPath, 'utf8')).toContain('left: "60px"');

      // ── 5. spacing-drag (CSS-shaped, padding-left) ──────────────────────
      map = await locatorMap(main, designRoot);
      const sectionId = idOf(map, 'section');
      const spacing = await editCss(main, {
        canvas: 'ui/Seq',
        id: sectionId,
        property: 'padding-left',
        value: '24px',
      });
      expect(spacing.ok).toBe(true);
      expect(readFileSync(canvasPath, 'utf8')).toContain('paddingLeft: "24px"');

      // ── Cmd+Z ×5 — strict LIFO ───────────────────────────────────────────
      const undo5 = await editCss(main, {
        canvas: 'ui/Seq',
        id: sectionId,
        property: 'padding-left',
        value: '8px',
      });
      expect(undo5.ok).toBe(true);

      const undo4 = await editCss(main, {
        canvas: 'ui/Seq',
        id: boxIdAfterStructural,
        property: 'left',
        value: '20px',
      });
      expect(undo4.ok).toBe(true);

      const undo3 = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/Seq', seq: insJson.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(undo3.status).toBe(200);

      const undo2 = await fetch(`${main}/_api/reorder-revert`, {
        method: 'POST',
        body: JSON.stringify({ canvas: 'ui/Seq', seq: delJson.seq, dir: 'undo' }),
        signal: AbortSignal.timeout(2000),
      });
      expect(undo2.status).toBe(200);

      const undo1 = await editCss(main, {
        canvas: 'ui/Seq',
        id: boxId,
        property: 'width',
        value: '100px',
      });
      expect(undo1.ok).toBe(true);

      // ── Assert: byte-identical to the pre-sequence source ───────────────
      expect(readFileSync(canvasPath, 'utf8')).toBe(original);
    } finally {
      await killProc(proc);
    }
  });
});
