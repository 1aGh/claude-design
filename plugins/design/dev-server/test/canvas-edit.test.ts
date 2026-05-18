// canvas-edit.ts — Phase 3.6 Task 5. AST-aware single-attribute edits on TSX
// canvases. The same component+jsxIndex bookkeeping as canvas-pipeline.ts
// computes the target ID; tests round-trip an edit through transpileCanvasSource
// to confirm the IDs line up.

import { describe, expect, test } from 'bun:test';

import { applyEdit, CanvasEditError, editAttribute } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/abs/Canvas.tsx';

function idsOf(source: string): Record<string, string> {
  // Run the pipeline to learn what data-cd-id each JSX element gets, returning
  // a map keyed by the element-type name so tests can ask "what id is the
  // <span>?" without hardcoding the hash.
  const { withIds } = transpileCanvasSource(CANVAS, source);
  const out: Record<string, string> = {};
  for (const m of withIds.matchAll(/<(\w+)([^>]*?)data-cd-id="([0-9a-f]{8})"/g)) {
    if (!out[m[1] as string]) out[m[1] as string] = m[3] as string;
  }
  return out;
}

describe('canvas-edit / applyEdit', () => {
  test('swaps an existing className literal value', () => {
    const src = `function Demo() { return <button className="btn">OK</button>; }`;
    const ids = idsOf(src);
    const id = ids.button as string;
    const out = applyEdit(CANVAS, src, id, 'className', 'btn btn--ghost');
    expect(out.source).toBe(
      `function Demo() { return <button className="btn btn--ghost">OK</button>; }`
    );
    // "btn" (3 chars) → "btn btn--ghost" (14 chars): +11 bytes inside the
    // literal; quotes unchanged.
    expect(out.delta).toBe(11);
  });

  test('inserts className when missing', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'className', 'card');
    expect(out.source).toBe(
      `function Demo() { return <div className="card">x</div>; }`
    );
  });

  test('rewrites a plain attribute (aria-label)', () => {
    const src = `function Demo() { return <button aria-label="old">x</button>; }`;
    const ids = idsOf(src);
    const id = ids.button as string;
    const out = applyEdit(CANVAS, src, id, 'aria-label', 'new');
    expect(out.source).toBe(
      `function Demo() { return <button aria-label="new">x</button>; }`
    );
  });

  test('swaps a single style.<prop> value inside style={{...}}', () => {
    const src = `function Demo() { return <div style={{ padding: 8, margin: 4 }}>x</div>; }`;
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.padding', '14');
    expect(out.source).toBe(
      `function Demo() { return <div style={{ padding: 14, margin: 4 }}>x</div>; }`
    );
  });

  test('inserts a missing style key into existing style={{...}}', () => {
    const src = `function Demo() { return <div style={{ padding: 8 }}>x</div>; }`;
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.color', '"#facc15"');
    // The exact spacing of the appended key is implementation-defined; assert
    // the substring lands without trampling the prior key.
    expect(out.source).toContain('padding: 8');
    expect(out.source).toContain('color: "#facc15"');
  });

  test('inserts a brand-new style={{}} prop when missing', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.padding', '14');
    expect(out.source).toContain('<div style={{ padding: 14 }}>x</div>');
  });

  test('throws CanvasEditError when id is not found', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    expect(() => applyEdit(CANVAS, src, 'deadbeef', 'className', 'x')).toThrow(CanvasEditError);
  });

  test('refuses to edit data-cd-id (owned by pipeline)', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    const ids = idsOf(src);
    const id = ids.div as string;
    expect(() => applyEdit(CANVAS, src, id, 'data-cd-id', 'beefcafe')).toThrow(CanvasEditError);
  });

  test('throws on malformed source', () => {
    const src = `function Demo() { return <not closing`;
    expect(() => applyEdit(CANVAS, src, 'aaaaaaaa', 'className', 'x')).toThrow();
  });

  test('targets the right element when multiple share a type', () => {
    const src =
      `function Demo() { return (<section>` +
      `<button className="a">A</button>` +
      `<button className="b">B</button>` +
      `</section>); }`;
    // The pipeline visits in pre-order; expose all <button> ids by walking the
    // withIds output and capturing each match.
    const { withIds } = transpileCanvasSource(CANVAS, src);
    const matches = [...withIds.matchAll(/<button[^>]*data-cd-id="([0-9a-f]{8})"[^>]*className="([ab])"/g)];
    expect(matches.length).toBe(2);
    const idA = matches.find((m) => m[2] === 'a')?.[1] as string;
    expect(idA).toBeDefined();
    const out = applyEdit(CANVAS, src, idA, 'className', 'A-edited');
    expect(out.source).toContain('className="A-edited"');
    expect(out.source).toContain('className="b"');
  });
});

describe('canvas-edit / editAttribute (fs)', () => {
  test('writes the edit atomically + is a no-op when source unchanged', async () => {
    const tmp = `/tmp/canvas-edit-${Math.random().toString(36).slice(2)}.tsx`;
    const src = `function Demo() { return <div className="x">y</div>; }`;
    await Bun.write(tmp, src);
    const ids = idsOf(src);
    const id = ids.div as string;

    const r1 = await editAttribute(tmp, id, 'className', 'longer-value');
    expect(r1.delta).toBeGreaterThan(0);
    const after = await Bun.file(tmp).text();
    expect(after).toContain('className="longer-value"');

    // Second pass with the same value — no-op (the source already has it).
    const r2 = await editAttribute(tmp, id, 'className', 'longer-value');
    expect(r2.delta).toBe(0);
  });
});
