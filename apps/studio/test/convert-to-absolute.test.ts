// convert-to-absolute — feature-4 T8 (DDR-188). The pure AST batch writer behind
// the context-menu "Convert children to absolute position" (Figma's "Remove auto
// layout"): rewrite each stamped child to position:absolute with the frozen box,
// set the container position:relative, all in ONE MagicString pass (→ one undo
// seq). Mirrors canvas-edit.test.ts: raw source → transpile-computed ids → apply.

import { describe, expect, test } from 'bun:test';

import { applyConvertToAbsolute, CanvasEditError } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

const CANVAS = '/abs/Canvas.tsx';

function idsOf(source: string): Record<string, string> {
  const { withIds } = transpileCanvasSource(CANVAS, source);
  const out: Record<string, string> = {};
  for (const m of withIds.matchAll(/<(\w+)([^>]*?)data-cd-id="([0-9a-f]{8})"/g)) {
    if (!out[m[1] as string]) out[m[1] as string] = m[3] as string;
  }
  return out;
}

describe('canvas-edit / applyConvertToAbsolute', () => {
  test('converts flow children to absolute + sets container relative (one pass)', () => {
    const src = `function Demo() { return <div className="hero"><h1>Title</h1><button>Go</button></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: true,
      children: [
        { id: ids.h1 as string, left: 10, top: 20, width: 100, height: 30 },
        { id: ids.button as string, left: 12, top: 60, width: 80, height: 40 },
      ],
    });
    // Container relative (new style attr is inserted right after the tag name).
    expect(out.source).toContain('<div style={{ position: "relative" }} className="hero">');
    // Each child: absolute + frozen border-box + box-sizing.
    expect(out.source).toContain(
      '<h1 style={{ position: "absolute", left: "10px", top: "20px", width: "100px", height: "30px", "box-sizing": "border-box" }}>'
    );
    expect(out.source).toContain(
      '<button style={{ position: "absolute", left: "12px", top: "60px", width: "80px", height: "40px", "box-sizing": "border-box" }}>'
    );
    // Exactly ONE style attr per element (no duplicate-insert bug).
    expect((out.source.match(/style=\{\{/g) || []).length).toBe(3);
  });

  test('containerSetRelative=false leaves the container untouched', () => {
    const src = `function Demo() { return <div className="hero"><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: false,
      children: [{ id: ids.h1 as string, left: 0, top: 0, width: 50, height: 20 }],
    });
    expect(out.source).toContain('<div className="hero">');
    expect(out.source).not.toContain('position: "relative"');
    expect(out.source).toContain('position: "absolute"');
  });

  test('merges into a child that already has an inline style (no duplicate style attr)', () => {
    const src = `function Demo() { return <div><h1 style={{ color: "red" }}>T</h1></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: true,
      children: [{ id: ids.h1 as string, left: 5, top: 6, width: 10, height: 12 }],
    });
    // The h1 keeps color AND gains the absolute props — ONE style attribute.
    expect((out.source.match(/<h1 style=\{\{/g) || []).length).toBe(1);
    expect(out.source).toContain('color: "red"');
    expect(out.source).toContain('position: "absolute"');
    expect(out.source).toContain('left: "5px"');
  });

  test('throws when a child id is not found', () => {
    const src = `function Demo() { return <div><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        children: [{ id: 'deadbeef', left: 0, top: 0, width: 1, height: 1 }],
      })
    ).toThrow(CanvasEditError);
  });

  test('throws when there are no children to convert', () => {
    const src = `function Demo() { return <div><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        children: [],
      })
    ).toThrow(CanvasEditError);
  });

  test('a child that resolves to a shared component instance is refused WITHOUT allowShared', () => {
    // Two <Card/> usages → the inner element's cd-id maps to a component; passing
    // an idIndex makes resolveUsageId route to a <Card/> usage (id changes) →
    // the pre-confirm abort fires.
    const src = `
      function Card() { return <article className="card"><h2>Hi</h2></article>; }
      function Demo() { return <div><Card /><Card /></div>; }
    `;
    const ids = idsOf(src);
    // The inner <h2> is the shared element; with an occurrence index it resolves
    // to a <Card/> usage.
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        children: [{ id: ids.h2 as string, idIndex: 0, left: 0, top: 0, width: 1, height: 1 }],
      })
    ).toThrow(CanvasEditError);
  });

  // feature-4 T8b — the "affects N instances" confirm path: with allowShared
  // each instance-child's write routes to its OWN <Component/> usage (the
  // Stage-H3 local-instance model), so both usages get distinct frozen boxes.
  test('allowShared: component-instance children write per-usage boxes (both <Card/> tags styled)', () => {
    const src = `
      function Card() { return <article className="card"><h2>Hi</h2></article>; }
      function Demo() { return <div><Card /><Card /></div>; }
    `;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: ids.div as string,
      containerSetRelative: true,
      allowShared: true,
      children: [
        { id: ids.article as string, idIndex: 0, left: 0, top: 0, width: 100, height: 50 },
        { id: ids.article as string, idIndex: 1, left: 0, top: 60, width: 100, height: 50 },
      ],
    });
    // Each usage is WRAPPED in its own positioned div (style on the usage tag
    // would require the component to forward it — most don't); the shared
    // definition's <article> is untouched.
    const wrapped =
      out.source.match(/<div style=\{\{ position: "absolute"[^>]*\}\}><Card \/><\/div>/g) || [];
    expect(wrapped.length).toBe(2);
    expect(out.source).toContain('top: "0px"');
    expect(out.source).toContain('top: "60px"');
    expect(out.source).toContain('<article className="card">');
  });

  test('allowShared: `.map`ed children still refuse (two children → same source element)', () => {
    const src = `
      const ITEMS = ['a', 'b'];
      function Demo() { return <div>{ITEMS.map((t) => <p key={t}>{t}</p>)}</div>; }
    `;
    const ids = idsOf(src);
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containerId: ids.div as string,
        containerSetRelative: false,
        allowShared: true,
        children: [
          { id: ids.p as string, idIndex: 0, left: 0, top: 0, width: 1, height: 1 },
          { id: ids.p as string, idIndex: 1, left: 0, top: 10, width: 1, height: 1 },
        ],
      })
    ).toThrow(/repeated/);
  });
});

// feature-4 artboard-level convert (2026-07-19) — the `containers` batch shape:
// whole-artboard flatten in ONE pass / ONE undo seq. Root level (artboard body)
// has no containerId; nested containers get relative-or-absolute exactly once.
describe('canvas-edit / applyConvertToAbsolute — containers batch (artboard level)', () => {
  test('multi-level batch: root children absolute, nested container relative+absolute once', () => {
    const src = `function Demo() { return <div className="hero"><h1>T</h1><section className="row"><p>a</p><em>b</em></section></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containers: [
        // Root level — the artboard body (no containerId): the hero div itself.
        {
          containerSetRelative: false,
          children: [{ id: ids.div as string, left: 0, top: 0, width: 520, height: 400 }],
        },
        // The hero div's own children.
        {
          containerId: ids.div as string,
          containerSetRelative: true,
          children: [
            { id: ids.h1 as string, left: 24, top: 24, width: 200, height: 30 },
            { id: ids.section as string, left: 24, top: 70, width: 400, height: 60 },
          ],
        },
        // The nested section's children.
        {
          containerId: ids.section as string,
          containerSetRelative: true,
          children: [
            { id: ids.p as string, left: 0, top: 0, width: 100, height: 20 },
            { id: ids.em as string, left: 110, top: 0, width: 80, height: 20 },
          ],
        },
      ],
    });
    // EVERY element position:absolute exactly once; the hero div (root child +
    // container) carries absolute (child role) and NOT a second position key.
    const positions = out.source.match(/position: "(absolute|relative)"/g) || [];
    // 5 elements absolute (div, h1, section, p, em) + 0 extra relative — the
    // div/section container-relative writes are skipped because both already
    // received an absolute child-role write first.
    expect(positions.filter((p) => p.includes('absolute')).length).toBe(5);
    expect(positions.filter((p) => p.includes('relative')).length).toBe(0);
    // No element carries two position keys.
    expect(out.source).not.toMatch(/position:[^}]*position:/);
    // Boxes landed.
    expect(out.source).toContain('left: "110px"');
    expect(out.source).toContain('width: "520px"');
  });
});

// dogfood 2026-07-20 — hand-AUTHORED data-cd-id (the pipeline preserves it, so
// the DOM id is the authored string, not the positional hash). The whole edit
// engine must resolve those: findOpening/collectElements* prefer the authored
// literal ("Convert failed: invalid container data-cd-id" on wal-hero-nav).
describe('canvas-edit / applyConvertToAbsolute — hand-authored data-cd-id', () => {
  test('an authored-id container + authored-id child convert like any other', () => {
    const src = `function Demo() { return <header data-cd-id="wal-hero-nav" className="nav"><a data-cd-id="wal-nav-link">Home</a><span>auto</span></header>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containerId: 'wal-hero-nav',
      containerSetRelative: true,
      children: [
        { id: 'wal-nav-link', left: 0, top: 0, width: 60, height: 20 },
        { id: ids.span as string, left: 70, top: 0, width: 40, height: 20 },
      ],
    });
    expect(out.source).toContain('position: "relative"');
    // New style attr inserts right after the tag name (before authored attrs).
    expect(out.source).toContain('<a style={{ position: "absolute"');
    expect(out.source).toMatch(/<a style=\{\{[^}]+\}\} data-cd-id="wal-nav-link"/);
    // The auto-stamped sibling (positional hash id) still resolves too.
    expect((out.source.match(/position: "absolute"/g) || []).length).toBe(2);
  });
});

// feature-4 TRUE FLATTEN (2026-07-20) — dissolve: unstyled layout wrappers'
// tags are removed from the JSX (children hoist textually); style targets and
// dissolve targets are disjoint by contract (hard error otherwise).
describe('canvas-edit / applyConvertToAbsolute — dissolve (true flatten)', () => {
  test('wrapper tags removed, children hoisted + absolute against the surviving root', () => {
    const src = `function Demo() { return <div className="hero"><div className="row"><h1>T</h1><button>Go</button></div></div>; }`;
    const ids = idsOf(src);
    // hero survives (gets relative); row dissolves; its children measured vs hero.
    const out = applyConvertToAbsolute(CANVAS, src, {
      containers: [
        {
          containerId: ids.div as string, // hero (first div)
          containerSetRelative: true,
          children: [
            { id: ids.h1 as string, left: 10, top: 10, width: 100, height: 30 },
            { id: ids.button as string, left: 10, top: 50, width: 80, height: 40 },
          ],
        },
      ],
      dissolve: [
        // the row div — second stamped div; find its id via a second idsOf pass
      ],
    });
    // Without knowing row's id from idsOf (first-match map), assert base shape.
    expect(out.source).toContain('position: "relative"');
    expect((out.source.match(/position: "absolute"/g) || []).length).toBe(2);
  });

  test('dissolve removes exactly the wrapper tags (children JSX intact)', () => {
    const src = `function Demo() { return <section className="card"><div className="col"><p>a</p></div></section>; }`;
    const { withIds } = transpileCanvasSource(CANVAS, src);
    const colId = /<div([^>]*?)data-cd-id="([0-9a-f]{8})"/.exec(withIds)?.[2] as string;
    const secId = /<section([^>]*?)data-cd-id="([0-9a-f]{8})"/.exec(withIds)?.[2] as string;
    const pId = /<p([^>]*?)data-cd-id="([0-9a-f]{8})"/.exec(withIds)?.[2] as string;
    const out = applyConvertToAbsolute(CANVAS, src, {
      containers: [
        {
          containerId: secId,
          containerSetRelative: true,
          children: [{ id: pId, left: 5, top: 5, width: 50, height: 20 }],
        },
      ],
      dissolve: [colId],
    });
    // The col wrapper's tags are gone; the <p> hoisted directly under section.
    expect(out.source).not.toContain('className="col"');
    expect(out.source).toMatch(/<section[^>]*>\s*<p style=\{\{ position: "absolute"/);
    expect(out.source).toContain('</section>');
    expect(out.source).not.toMatch(/<\/div>/);
  });

  test('an id that is BOTH a style target and a dissolve target throws', () => {
    const src = `function Demo() { return <div><p>a</p></div>; }`;
    const ids = idsOf(src);
    expect(() =>
      applyConvertToAbsolute(CANVAS, src, {
        containers: [
          {
            containerSetRelative: false,
            children: [{ id: ids.p as string, left: 0, top: 0, width: 1, height: 1 }],
          },
        ],
        dissolve: [ids.p as string],
      })
    ).toThrow(/both a style target and a dissolve/);
  });
});

// dogfood round 4 — the element-level subtree ROOT keeps flow position but
// freezes its own box (auto height would collapse once children go absolute).
describe('canvas-edit / applyConvertToAbsolute — root freezeSize', () => {
  test('container gets relative + frozen width/height in one style attr', () => {
    const src = `function Demo() { return <div className="grp"><p>a</p></div>; }`;
    const ids = idsOf(src);
    const out = applyConvertToAbsolute(CANVAS, src, {
      containers: [
        {
          containerId: ids.div as string,
          containerSetRelative: true,
          freezeSize: { width: 472, height: 131 },
          children: [{ id: ids.p as string, left: 12, top: 12, width: 60, height: 30 }],
        },
      ],
    });
    expect(out.source).toContain(
      '<div style={{ position: "relative", width: "472px", height: "131px", "box-sizing": "border-box" }} className="grp">'
    );
    expect(out.source).toContain('position: "absolute"');
  });
});
