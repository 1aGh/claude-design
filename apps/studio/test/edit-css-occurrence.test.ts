// canvas-edit.ts — Stage H3 (feature-element-editing-robustness). A whole-
// component-instance move/resize passes a DOM-occurrence index into edit-css so
// `applyEdit` routes the write to that instance's `<Component/>` USAGE (local to
// the dragged instance) instead of the shared inner definition (global). The knob
// / paste-style paths pass NO occurrence, so inner-shared-element styling stays
// global-and-labeled — the H2 badge is the answer there (the chosen model).
// Positional ids are round-tripped through transpileCanvasSource like the sibling
// structural test, so the arithmetic stays in lockstep with the pipeline.

import { describe, expect, test } from 'bun:test';

import { applyEdit } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/abs/Canvas.tsx';

/** Map data-cd-id by element-type name (first occurrence), like canvas-edit.test.ts. */
function idsOf(source: string): Record<string, string> {
  const { withIds } = transpileCanvasSource(CANVAS, source);
  const out: Record<string, string> = {};
  for (const m of withIds.matchAll(/<(\w+)([^>]*?)data-cd-id="([0-9a-f]{8})"/g)) {
    if (!out[m[1] as string]) out[m[1] as string] = m[3] as string;
  }
  return out;
}

const SHARED = [
  'function Card() { return <article>card</article>; }',
  'function Demo() {',
  '  return (',
  '    <section>',
  '      <Card />',
  '      <Card />',
  '      <Card />',
  '    </section>',
  '  );',
  '}',
].join('\n');

describe('canvas-edit / applyEdit — Stage H3 occurrence routing', () => {
  test('with an occurrence, a style edit routes to that <Component/> usage (local)', () => {
    // The inner <article> id is shared across all three <Card/> usages.
    const innerId = idsOf(SHARED).article as string;
    const out = applyEdit(CANVAS, SHARED, innerId, 'style.left', '"40px"', 1); // 2nd instance
    // The 2nd (index 1) <Card/> usage gains the inline style; the shared inner
    // <article> definition is untouched, so the other two instances don't move.
    expect(out.source).toContain('<Card style={{ left: "40px" }}');
    expect(out.source.match(/<Card \/>/g)?.length).toBe(2);
    expect(out.source).toContain('<article>card</article>');
  });

  test('without an occurrence, the same edit stays on the shared inner element (global)', () => {
    const innerId = idsOf(SHARED).article as string;
    const out = applyEdit(CANVAS, SHARED, innerId, 'style.left', '"40px"');
    // No occurrence → knob / paste-style behavior: the write lands on the inner
    // <article>, changing every rendered instance (the "inner styling is global"
    // model the H2 badge labels).
    expect(out.source).toContain('<article style={{ left: "40px" }}>card</article>');
    expect(out.source).not.toContain('<Card style=');
  });

  test('a normal (non-instance) element ignores the occurrence (no-op remap)', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    const id = idsOf(src).div as string;
    const out = applyEdit(CANVAS, src, id, 'style.padding', '14', 3);
    expect(out.source).toContain('<div style={{ padding: 14 }}>x</div>');
  });

  test('an element in a single-usage component ignores the occurrence (not splittable)', () => {
    const src = [
      'function Card() { return <article>card</article>; }',
      'function Demo() { return <section><Card /></section>; }',
    ].join('\n');
    const innerId = idsOf(src).article as string;
    // One usage → resolveUsageId returns the inner id (can't split) — the edit
    // lands on <article>, never fabricates a phantom usage index.
    const out = applyEdit(CANVAS, src, innerId, 'style.left', '"40px"', 0);
    expect(out.source).toContain('<article style={{ left: "40px" }}>card</article>');
    expect(out.source).not.toContain('<Card style=');
  });
});
