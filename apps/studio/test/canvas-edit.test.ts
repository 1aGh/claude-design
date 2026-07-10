// canvas-edit.ts — Phase 3.6 Task 5. AST-aware single-attribute edits on TSX
// canvases. The same component+jsxIndex bookkeeping as canvas-pipeline.ts
// computes the target ID; tests round-trip an edit through transpileCanvasSource
// to confirm the IDs line up.

import { describe, expect, test } from 'bun:test';

import {
  applyEdit,
  applyRemove,
  applyTextEdit,
  CanvasEditError,
  editAttribute,
} from '../canvas-edit.ts';
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
    const src = 'function Demo() { return <div>x</div>; }';
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'className', 'card');
    expect(out.source).toBe(`function Demo() { return <div className="card">x</div>; }`);
  });

  test('rewrites a plain attribute (aria-label)', () => {
    const src = `function Demo() { return <button aria-label="old">x</button>; }`;
    const ids = idsOf(src);
    const id = ids.button as string;
    const out = applyEdit(CANVAS, src, id, 'aria-label', 'new');
    expect(out.source).toBe(`function Demo() { return <button aria-label="new">x</button>; }`);
  });

  test('JSX-attribute-escapes a " in a replaced literal value (no JSON \\" corruption)', () => {
    // Regression: the replace branch used to emit JSON.stringify(value) → `\"`,
    // which is invalid JS-escaping inside a JSX attribute and corrupts the source.
    // It must land as the HTML entity &quot; instead. See DDR-105.
    const src = `function Demo() { return <button aria-label="old">x</button>; }`;
    const ids = idsOf(src);
    const id = ids.button as string;
    const out = applyEdit(CANVAS, src, id, 'aria-label', 'say "hi" <b>');
    expect(out.source).toBe(
      `function Demo() { return <button aria-label="say &quot;hi&quot; &lt;b&gt;">x</button>; }`
    );
    // Never the JS-escaped form that broke things.
    expect(out.source).not.toContain('\\"');
  });

  test('JSX-attribute-escapes a " in a newly inserted attribute value', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'title', 'a "quoted" title');
    expect(out.source).toBe(
      `function Demo() { return <div title="a &quot;quoted&quot; title">x</div>; }`
    );
  });

  test('replaces an expression-container attr value with a JSX-escaped literal', () => {
    // <Tag name={expr} /> → <Tag name="value" />, entity-escaped (not JSON-escaped).
    const src = `function Demo() { return <button aria-label={lbl}>x</button>; }`;
    const ids = idsOf(src);
    const id = ids.button as string;
    const out = applyEdit(CANVAS, src, id, 'aria-label', 'with "quote"');
    expect(out.source).toBe(
      `function Demo() { return <button aria-label="with &quot;quote&quot;">x</button>; }`
    );
  });

  test('swaps a single style.<prop> value inside style={{...}}', () => {
    const src = 'function Demo() { return <div style={{ padding: 8, margin: 4 }}>x</div>; }';
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.padding', '14');
    expect(out.source).toBe(
      'function Demo() { return <div style={{ padding: 14, margin: 4 }}>x</div>; }'
    );
  });

  test('inserts a missing style key into existing style={{...}}', () => {
    const src = 'function Demo() { return <div style={{ padding: 8 }}>x</div>; }';
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.color', '"#facc15"');
    // The exact spacing of the appended key is implementation-defined; assert
    // the substring lands without trampling the prior key.
    expect(out.source).toContain('padding: 8');
    expect(out.source).toContain('color: "#facc15"');
  });

  test('inserts a brand-new style={{}} prop when missing', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.padding', '14');
    expect(out.source).toContain('<div style={{ padding: 14 }}>x</div>');
  });

  test('retime: bumps a referenced const so a derived total moves in lock-step (DDR-148)', async () => {
    const { applyRetimeSequence } = await import('../canvas-edit.ts');
    const src = [
      'const A = 66;',
      'const B = 62;',
      'const XF = 16;',
      'const TOTAL = A + B - XF;',
      'function Movie(){ return (<TransitionSeries>',
      '  <TransitionSeries.Sequence durationInFrames={A}><Intro/></TransitionSeries.Sequence>',
      '  <TransitionSeries.Transition timing={linearTiming({ durationInFrames: XF })} />',
      '  <TransitionSeries.Sequence durationInFrames={B}><Payoff/></TransitionSeries.Sequence>',
      '</TransitionSeries>); }',
    ].join('\n');
    const r0 = applyRetimeSequence(CANVAS, src, 0, { durationInFrames: 80 });
    expect(r0.source).toContain('const A = 80'); // const edited, not the literal
    expect(r0.source).toContain('const TOTAL = A + B - XF'); // derived total intact → auto-updates
    const r1 = applyRetimeSequence(CANVAS, r0.source, 1, { durationInFrames: 90 });
    expect(r1.source).toContain('const B = 90');
  });

  test('retime: edits a literal in place + supports from', async () => {
    const { applyRetimeSequence } = await import('../canvas-edit.ts');
    const src =
      'function C(){ return <Sequence from={10} durationInFrames={40}><Foo/></Sequence>; }';
    const r = applyRetimeSequence(CANVAS, src, 0, { from: 20, durationInFrames: 55 });
    expect(r.source).toContain('from={20}');
    expect(r.source).toContain('durationInFrames={55}');
  });

  test('retime: an out-of-range sequence index throws', async () => {
    const { applyRetimeSequence, CanvasEditError } = await import('../canvas-edit.ts');
    const src = 'function C(){ return <Sequence durationInFrames={40}><Foo/></Sequence>; }';
    expect(() => applyRetimeSequence(CANVAS, src, 5, { durationInFrames: 10 })).toThrow(
      CanvasEditError
    );
  });

  test('inserts into a style object with a TRAILING comma without a double comma (DDR-148 #4)', () => {
    // A frame-driven inline style commonly ends the last property with a
    // trailing comma. Appending must NOT produce `opacity: o, , color: …`
    // (a syntax error that made the canvas render the OLD source on replay).
    const src =
      'function Demo() {\n  const o = 1;\n  return <div style={{ fontSize: 12, opacity: o, }}>x</div>;\n}';
    const ids = idsOf(src);
    const id = ids.div as string;
    const out = applyEdit(CANVAS, src, id, 'style.color', "'#d48917'");
    expect(out.source).toContain("color: '#d48917'");
    expect(out.source).not.toMatch(/,\s*,/); // no double comma
    // And it must still parse.
    const reparse = applyEdit(CANVAS, out.source, id, 'style.fontSize', '13');
    expect(reparse.source).toContain('fontSize: 13');
  });

  test('throws CanvasEditError when id is not found', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    expect(() => applyEdit(CANVAS, src, 'deadbeef', 'className', 'x')).toThrow(CanvasEditError);
  });

  test('refuses to edit data-cd-id (owned by pipeline)', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    const ids = idsOf(src);
    const id = ids.div as string;
    expect(() => applyEdit(CANVAS, src, id, 'data-cd-id', 'beefcafe')).toThrow(CanvasEditError);
  });

  test('throws on malformed source', () => {
    const src = 'function Demo() { return <not closing';
    expect(() => applyEdit(CANVAS, src, 'aaaaaaaa', 'className', 'x')).toThrow();
  });

  test('targets the right element when multiple share a type', () => {
    const src =
      'function Demo() { return (<section>' +
      `<button className="a">A</button>` +
      `<button className="b">B</button>` +
      '</section>); }';
    // The pipeline visits in pre-order; expose all <button> ids by walking the
    // withIds output and capturing each match.
    const { withIds } = transpileCanvasSource(CANVAS, src);
    const matches = [
      ...withIds.matchAll(/<button[^>]*data-cd-id="([0-9a-f]{8})"[^>]*className="([ab])"/g),
    ];
    expect(matches.length).toBe(2);
    const idA = matches.find((m) => m[2] === 'a')?.[1] as string;
    expect(idA).toBeDefined();
    const out = applyEdit(CANVAS, src, idA, 'className', 'A-edited');
    expect(out.source).toContain('className="A-edited"');
    expect(out.source).toContain('className="b"');
  });
});

describe('canvas-edit / applyEdit — Stage F2 media src-replace', () => {
  test('replaces a literal <img src="…"> — the ordinary "Replace image…" case', () => {
    const src = `function Demo() { return <img src="assets/old.png" alt="x" />; }`;
    const ids = idsOf(src);
    const id = ids.img as string;
    const out = applyEdit(CANVAS, src, id, 'src', 'assets/12345678.png');
    expect(out.source).toBe(
      `function Demo() { return <img src="assets/12345678.png" alt="x" />; }`
    );
  });

  test('replaces a trivial {"literal"} src expression', () => {
    const src = `function Demo() { return <img src={"assets/old.png"} alt="x" />; }`;
    const ids = idsOf(src);
    const id = ids.img as string;
    const out = applyEdit(CANVAS, src, id, 'src', 'assets/new.png');
    expect(out.source).toContain('src="assets/new.png"');
  });

  test('refuses (does not corrupt) a src bound to a JS expression', () => {
    // src={imageUrl} is a BINDING, not a static value — silently overwriting it
    // would discard the binding. This is the exact gotcha the plan's Task F2
    // flags for "Replace image…"; the context-menu comment already assumed
    // this refusal existed (canvas-shell.tsx) — it didn't, until this fix.
    const src = `function Demo({ imageUrl }) { return <img src={imageUrl} alt="x" />; }`;
    const ids = idsOf(src);
    const id = ids.img as string;
    expect(() => applyEdit(CANVAS, src, id, 'src', 'assets/new.png')).toThrow(
      /bound to a JS expression/
    );
    // Also refuses a member-expression / template-literal binding, not just a
    // bare identifier.
    const src2 = `function Demo({ item }) { return <img src={item.url} alt="x" />; }`;
    const ids2 = idsOf(src2);
    expect(() => applyEdit(CANVAS, src2, ids2.img as string, 'src', 'assets/new.png')).toThrow(
      /bound to a JS expression/
    );
  });

  test('a non-src attribute expression binding is unaffected (existing overwrite behavior)', () => {
    // The refusal is scoped to `src` (the plan's stated gotcha) — an
    // expression-bound `title` or similar still overwrites as before; widening
    // the refusal to every attribute is a bigger, separate change.
    const src = `function Demo({ label }) { return <button title={label}>x</button>; }`;
    const ids = idsOf(src);
    const out = applyEdit(CANVAS, src, ids.button as string, 'title', 'Fixed label');
    expect(out.source).toContain('title="Fixed label"');
  });
});

describe('canvas-edit / applyRemove (reset)', () => {
  test('removes one style key, leaving the siblings + object intact', () => {
    const src = 'function Demo() { return <div style={{ padding: 8, margin: 4 }}>x</div>; }';
    const ids = idsOf(src);
    const out = applyRemove(CANVAS, src, ids.div as string, 'style.margin');
    expect(out.source).toBe('function Demo() { return <div style={{ padding: 8 }}>x</div>; }');
  });

  test('removes the leading style key (consumes the trailing comma)', () => {
    const src = 'function Demo() { return <div style={{ padding: 8, margin: 4 }}>x</div>; }';
    const ids = idsOf(src);
    const out = applyRemove(CANVAS, src, ids.div as string, 'style.padding');
    expect(out.source).toBe('function Demo() { return <div style={{ margin: 4 }}>x</div>; }');
  });

  test('removing the only style key drops the whole style attribute', () => {
    const src = 'function Demo() { return <div style={{ padding: 8 }}>x</div>; }';
    const ids = idsOf(src);
    const out = applyRemove(CANVAS, src, ids.div as string, 'style.padding');
    expect(out.source).toBe('function Demo() { return <div>x</div>; }');
  });

  test('accepts a kebab style prop name (border-radius → borderRadius)', () => {
    const src = 'function Demo() { return <div style={{ borderRadius: 8, padding: 4 }}>x</div>; }';
    const ids = idsOf(src);
    const out = applyRemove(CANVAS, src, ids.div as string, 'style.border-radius');
    expect(out.source).toBe('function Demo() { return <div style={{ padding: 4 }}>x</div>; }');
  });

  test('removes a plain attribute (custom data-*)', () => {
    const src = 'function Demo() { return <button data-state="active">x</button>; }';
    const ids = idsOf(src);
    const out = applyRemove(CANVAS, src, ids.button as string, 'data-state');
    expect(out.source).toBe('function Demo() { return <button>x</button>; }');
  });

  test('is a no-op (delta 0) when the key / attribute is absent', () => {
    const src = 'function Demo() { return <div style={{ padding: 8 }}>x</div>; }';
    const ids = idsOf(src);
    const a = applyRemove(CANVAS, src, ids.div as string, 'style.margin');
    expect(a.source).toBe(src);
    expect(a.delta).toBe(0);
    const b = applyRemove(CANVAS, src, ids.div as string, 'data-nope');
    expect(b.source).toBe(src);
    expect(b.delta).toBe(0);
  });

  test('refuses to remove data-cd-id (pipeline-owned)', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    const ids = idsOf(src);
    expect(() => applyRemove(CANVAS, src, ids.div as string, 'data-cd-id')).toThrow(
      CanvasEditError
    );
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

// Phase 12 (DDR-103) — inline text-content edit. Leaf-text only; JSX-escaped.
describe('canvas-edit / applyTextEdit', () => {
  test('overwrites a leaf text node', () => {
    const src = `function Demo() { return <button>Save</button>; }`;
    const id = idsOf(src).button as string;
    const out = applyTextEdit(CANVAS, src, id, 'Uložit');
    expect(out.source).toBe(`function Demo() { return <button>Uložit</button>; }`);
  });

  test('preserves surrounding whitespace / indentation', () => {
    const src = [
      'function Demo() {',
      '  return (',
      '    <button>',
      '      Save',
      '    </button>',
      '  );',
      '}',
    ].join('\n');
    const id = idsOf(src).button as string;
    const out = applyTextEdit(CANVAS, src, id, 'Go');
    expect(out.source).toContain('    <button>\n      Go\n    </button>');
  });

  test('JSX-escapes <, >, {, }, & so text can never become markup or an expression', () => {
    const src = `function Demo() { return <code>x</code>; }`;
    const id = idsOf(src).code as string;
    const out = applyTextEdit(CANVAS, src, id, 'a < b && c > {d}');
    expect(out.source).toContain('a &lt; b &amp;&amp; c &gt; &#123;d&#125;');
    expect(out.source).not.toContain('{d}');
  });

  test('refuses an element with mixed (element) children', () => {
    const src = `function Demo() { return <div>hi <b>there</b></div>; }`;
    const id = idsOf(src).div as string;
    expect(() => applyTextEdit(CANVAS, src, id, 'x')).toThrow(CanvasEditError);
  });

  // unified-text-editing follow-up — a `{identifier}` bound to a const string
  // is now traced back to that const and edited THERE (was a hard refusal).
  test('edits an {identifier} child bound to a const string (traces to the const)', () => {
    const src = 'const t = "x";\nfunction Demo() { return <h1>{t}</h1>; }';
    const id = idsOf(src).h1 as string;
    const out = applyTextEdit(CANVAS, src, id, 'New', { before: 'x' });
    expect(out.source).toContain('const t = "New"');
  });

  test('refuses a self-closing / empty element (no text to edit)', () => {
    const src = `function Demo() { return <div className="x" />; }`;
    const id = idsOf(src).div as string;
    expect(() => applyTextEdit(CANVAS, src, id, 'x')).toThrow(CanvasEditError);
  });

  test('throws on a missing id', () => {
    const src = `function Demo() { return <button>Save</button>; }`;
    expect(() => applyTextEdit(CANVAS, src, 'deadbeef', 'x')).toThrow(CanvasEditError);
  });

  // DDR-150 P1 — widen the editable set to a single `{'string literal'}` child.
  test('edits a single string-literal expression child', () => {
    const src = `function Demo() { return <h1>{'Old Title'}</h1>; }`;
    const id = idsOf(src).h1 as string;
    const out = applyTextEdit(CANVAS, src, id, 'New Title');
    expect(out.source).toBe(`function Demo() { return <h1>{"New Title"}</h1>; }`);
  });

  test('string-literal rewrite is inert — quotes / braces / markup cannot escape the JS string', () => {
    const src = `function Demo() { return <h1>{"x"}</h1>; }`;
    const id = idsOf(src).h1 as string;
    const out = applyTextEdit(CANVAS, src, id, 'say "hi" {expr} <b>');
    // JSON.stringify escapes the double-quotes; {expr} / <b> stay INSIDE the JS
    // string literal, so they never become a JSX expression or markup.
    expect(out.source).toContain('say \\"hi\\"');
    expect(() => transpileCanvasSource(CANVAS, out.source)).not.toThrow();
  });

  test('still refuses a genuinely-computed expression child (routes to /design:edit)', () => {
    // Call expression — no single source string to rewrite → hard refusal.
    const src = 'const price = 9;\nfunction Demo() { return <h1>{price.toFixed(2)}</h1>; }';
    const id = idsOf(src).h1 as string;
    expect(() => applyTextEdit(CANVAS, src, id, 'x', { before: '9.00' })).toThrow(CanvasEditError);
  });

  test('refuses an {identifier} that does not resolve to a string const', () => {
    // `count` is a number const — no string to trace to → refuse.
    const src = 'const count = 3;\nfunction Demo() { return <h1>{count}</h1>; }';
    const id = idsOf(src).h1 as string;
    expect(() => applyTextEdit(CANVAS, src, id, 'x', { before: '3' })).toThrow(CanvasEditError);
  });
});

// Phase 12 (DDR-103) — the `style.<prop>` write path the CSS knobs ride
// (api.editCss maps property → camelCase + always quotes the value).
describe('canvas-edit / applyEdit style.<prop> (CSS-knob path)', () => {
  test('inserts an inline style object when none exists', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    const id = idsOf(src).div as string;
    const out = applyEdit(CANVAS, src, id, 'style.borderRadius', '"8px"');
    expect(out.source).toContain('style={{ borderRadius: "8px" }}');
  });

  test('overwrites an existing style key, leaving siblings intact', () => {
    const src = `function Demo() { return <div style={{ padding: 4, color: "red" }}>x</div>; }`;
    const id = idsOf(src).div as string;
    const out = applyEdit(CANVAS, src, id, 'style.color', '"blue"');
    expect(out.source).toContain('color: "blue"');
    expect(out.source).toContain('padding: 4');
  });

  test('accepts a token-valued (var(--…)) string for on-system edits', () => {
    const src = `function Demo() { return <div>x</div>; }`;
    const id = idsOf(src).div as string;
    const out = applyEdit(CANVAS, src, id, 'style.padding', '"var(--space-3)"');
    expect(out.source).toContain('style={{ padding: "var(--space-3)" }}');
  });

  // DDR-150 P1 — the exact video-comp shape: a var-valued prop ending in a
  // trailing comma. Unconditionally prepending ", " produced `opacity: o, ,
  // color` — a syntax error that left the Player rendering stale source (the
  // "my CSS edit resets on replay" bug). Guarded by editStyleProp's between-scan.
  test('appends onto a frame-driven inline style ending in a trailing comma (no double comma)', () => {
    const src = `function Demo() { const o = 1; return <div style={{ opacity: o, }}>x</div>; }`;
    const id = idsOf(src).div as string;
    const out = applyEdit(CANVAS, src, id, 'style.color', '"var(--fg-0)"');
    expect(out.source).not.toContain(', ,');
    expect(out.source).toContain('color: "var(--fg-0)"');
    expect(() => transpileCanvasSource(CANVAS, out.source)).not.toThrow();
  });
});
