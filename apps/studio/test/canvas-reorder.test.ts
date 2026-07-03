// canvas-edit.ts moveElement/applyMove — DDR-138, phase-12.1. Node-move reorder:
// relocate a whole JSXElement to a new sibling/parent position via oxc-parser +
// magic-string, re-indenting on reparent, with guardrails + a reparse gate. Tests
// verify order, formatting, the movedId recompute (must match the pipeline id the
// browser gets after reload), the data-dc-element re-settle key, and every refusal.

import { describe, expect, test } from 'bun:test';

import { applyMove, CanvasEditError } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/abs/Canvas.tsx';

/** The `id="…"` sequence in document order — reflects sibling/child order. */
function idOrder(source: string): string[] {
  return [...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] as string);
}

/** Map author `id="X"` → the data-cd-id the pipeline injects (data-cd-id lands
 *  right after the tag name, before other attrs, so it precedes id="X"). */
function cdIds(source: string): Record<string, string> {
  const { withIds } = transpileCanvasSource(CANVAS, source);
  const out: Record<string, string> = {};
  for (const m of withIds.matchAll(/data-cd-id="([0-9a-f]{8})"[^>]*?\bid="([^"]+)"/g)) {
    out[m[2] as string] = m[1] as string;
  }
  return out;
}

const LIST = `function Demo() {
  return (
    <section>
      <div id="a">A</div>
      <div id="b">B</div>
      <div id="c">C</div>
    </section>
  );
}`;

describe('canvas-edit / applyMove — sibling reorder', () => {
  test('move first element after last (reorder down)', () => {
    const ids = cdIds(LIST);
    const res = applyMove(CANVAS, LIST, ids.a as string, ids.c as string, 'after');
    expect(idOrder(res.source)).toEqual(['b', 'c', 'a']);
    // moved element keeps the siblings' 6-space indent
    expect(res.source).toContain('\n      <div id="a">A</div>');
    // untouched siblings are byte-identical
    expect(res.source).toContain('      <div id="b">B</div>\n      <div id="c">C</div>');
  });

  test('move last element before first (reorder up)', () => {
    const ids = cdIds(LIST);
    const res = applyMove(CANVAS, LIST, ids.c as string, ids.a as string, 'before');
    expect(idOrder(res.source)).toEqual(['c', 'a', 'b']);
  });

  test('movedId matches the pipeline id the browser gets after reload', () => {
    const ids = cdIds(LIST);
    const res = applyMove(CANVAS, LIST, ids.a as string, ids.c as string, 'after');
    // The recomputed movedId must equal what the pipeline assigns to <div id="a">
    // in the NEW source — that's the whole re-settle contract.
    expect(res.movedId).toBe(cdIds(res.source).a as string);
    expect(res.movedId).not.toBeNull();
  });

  test('output always re-parses (reparse gate never fires on a valid move)', () => {
    const ids = cdIds(LIST);
    const res = applyMove(CANVAS, LIST, ids.b as string, ids.a as string, 'before');
    const parsed = transpileCanvasSource(CANVAS, res.source);
    expect(parsed.withIds).toContain('<section');
  });
});

const NEST = `function Demo() {
  return (
    <section>
      <div id="a">A</div>
      <article id="box">
        <p id="p">P</p>
      </article>
    </section>
  );
}`;

describe('canvas-edit / applyMove — reparent', () => {
  test('inside-end nests the element as the last child, re-indented', () => {
    const ids = cdIds(NEST);
    const res = applyMove(CANVAS, NEST, ids.a as string, ids.box as string, 'inside-end');
    expect(idOrder(res.source)).toEqual(['box', 'p', 'a']);
    // re-indented one level deeper than the article (8 spaces)
    expect(res.source).toContain('\n        <div id="a">A</div>');
    // parses clean
    expect(transpileCanvasSource(CANVAS, res.source).withIds).toContain('id="a"');
  });

  test('inside-start nests the element as the first child', () => {
    const ids = cdIds(NEST);
    const res = applyMove(CANVAS, NEST, ids.a as string, ids.box as string, 'inside-start');
    expect(idOrder(res.source)).toEqual(['box', 'a', 'p']);
  });
});

describe('canvas-edit / applyMove — re-settle hints', () => {
  test('semanticId surfaces the moved element data-dc-element verbatim', () => {
    const src = `function Demo() {
  return (
    <section>
      <div id="a" data-dc-element="hero">A</div>
      <div id="b">B</div>
    </section>
  );
}`;
    const ids = cdIds(src);
    const res = applyMove(CANVAS, src, ids.a as string, ids.b as string, 'after');
    expect(res.semanticId).toBe('hero');
    expect(res.source).toContain('data-dc-element="hero"');
  });
});

describe('canvas-edit / applyMove — guardrails', () => {
  test('refuses moving an element relative to itself', () => {
    const ids = cdIds(LIST);
    expect(() => applyMove(CANVAS, LIST, ids.a as string, ids.a as string, 'after')).toThrow(
      CanvasEditError
    );
  });

  test('refuses moving an element into its own subtree', () => {
    const src = `function Demo() {
  return (
    <section id="sec">
      <div id="a">A</div>
      <div id="b">B</div>
    </section>
  );
}`;
    const ids = cdIds(src);
    // move <section id="sec"> (parent) inside <div id="a"> (its own descendant)
    expect(() =>
      applyMove(CANVAS, src, ids.sec as string, ids.a as string, 'inside-start')
    ).toThrow(/own subtree/);
  });

  test('refuses nesting into a self-closing target', () => {
    const src = `function Demo() {
  return (
    <section>
      <div id="a">A</div>
      <img id="img" src="x.png" />
    </section>
  );
}`;
    const ids = cdIds(src);
    expect(() =>
      applyMove(CANVAS, src, ids.a as string, ids.img as string, 'inside-start')
    ).toThrow(/self-closing/);
  });

  test('refuses an unknown moved id', () => {
    expect(() => applyMove(CANVAS, LIST, 'deadbeef', cdIds(LIST).a as string, 'after')).toThrow(
      /not found/
    );
  });

  test('refuses an unknown reference id', () => {
    expect(() => applyMove(CANVAS, LIST, cdIds(LIST).a as string, 'deadbeef', 'after')).toThrow(
      /not found/
    );
  });
});

// Reused-component instance reorder (phase-12.1 follow-up). Three <Col> usages
// render three DOM nodes that share ONE data-cd-id (the id of the element inside
// Col's body). Passing the DOM occurrence index maps the move onto the parent's
// distinct <Col> USAGE elements, so the columns actually reorder.
const REUSE = `function Col({ t }) {
  return <div id="col"><span id="lbl">{t}</span></div>;
}
function Demo() {
  return (
    <section>
      <Col t="one" />
      <Col t="two" />
      <Col t="three" />
    </section>
  );
}`;

describe('canvas-edit / applyMove — reused-component instances', () => {
  test('occurrence index maps a shared id to the parent <Col> usage', () => {
    const ids = cdIds(REUSE);
    const colId = ids.col as string; // the shared component-internal id (3 instances)
    // Move instance 0 (t="one") AFTER instance 2 (t="three") → order two, three, one.
    const res = applyMove(CANVAS, REUSE, colId, colId, 'after', 0, 2);
    const titles = [...res.source.matchAll(/t="([^"]+)"/g)].map((m) => m[1]);
    expect(titles).toEqual(['two', 'three', 'one']);
  });

  test('same shared id + same occurrence index is still a self-move', () => {
    const colId = cdIds(REUSE).col as string;
    expect(() => applyMove(CANVAS, REUSE, colId, colId, 'after', 1, 1)).toThrow(/itself/);
  });

  test('resolves from a DEEP element inside the component too', () => {
    const ids = cdIds(REUSE);
    const lblId = ids.lbl as string; // <span> inside Col — also shared across instances
    const res = applyMove(CANVAS, REUSE, lblId, lblId, 'before', 2, 0);
    const titles = [...res.source.matchAll(/t="([^"]+)"/g)].map((m) => m[1]);
    expect(titles).toEqual(['three', 'one', 'two']);
  });
});
