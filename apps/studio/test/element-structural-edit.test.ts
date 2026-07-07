// canvas-edit.ts — Stage I (feature-element-editing-robustness). Structural
// element edits: delete / insert / new-artboard + free-hand artboard resize
// (D4). Round-trips ids through transpileCanvasSource the same way
// canvas-edit.test.ts does, so the positional data-cd-id arithmetic stays in
// lockstep with the pipeline.

import { describe, expect, test } from 'bun:test';

import {
  applyDeleteElement,
  applyInsertArtboard,
  applyInsertElement,
  applyResizeArtboard,
  CanvasEditError,
} from '../canvas-edit.ts';
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

/** Parse-clean assertion — a structural edit must never emit invalid source. */
function parses(source: string): boolean {
  try {
    transpileCanvasSource(CANVAS, source);
    return true;
  } catch {
    return false;
  }
}

describe('canvas-edit / applyDeleteElement', () => {
  test('removes the target element and leaves valid source', () => {
    const src = [
      'function Demo() {',
      '  return (',
      '    <section>',
      '      <button>Keep</button>',
      '      <span>Drop</span>',
      '    </section>',
      '  );',
      '}',
    ].join('\n');
    const id = idsOf(src).span as string;
    const out = applyDeleteElement(CANVAS, src, id);
    expect(out.source).not.toContain('<span>Drop</span>');
    expect(out.source).toContain('<button>Keep</button>');
    expect(parses(out.source)).toBe(true);
    // No blank line left behind (framed span removed the leading newline+indent).
    expect(out.source).not.toMatch(/\n\s*\n\s*<\/section>/);
  });

  test('reparse gate rejects a delete that would break JSX (sole parenthesized return)', () => {
    // Deleting the only element of `return ( … )` leaves `return ();` — invalid.
    const src = 'function Demo() { return (<span>x</span>); }';
    const id = idsOf(src).span as string;
    expect(() => applyDeleteElement(CANVAS, src, id)).toThrow(CanvasEditError);
  });

  test('unknown id throws', () => {
    const src = 'function Demo() { return <div>x</div>; }';
    expect(() => applyDeleteElement(CANVAS, src, 'deadbeef')).toThrow(CanvasEditError);
  });

  test('shared-component instance delete targets the specific usage', () => {
    const src = [
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
    // The inner <article> id is shared across all three <Card/> usages.
    const innerId = idsOf(src).article as string;
    const out = applyDeleteElement(CANVAS, src, innerId, 1); // delete the 2nd usage
    // Exactly one <Card /> usage removed, two remain.
    expect(out.source.match(/<Card \/>/g)?.length).toBe(2);
    // The component definition is untouched.
    expect(out.source).toContain('function Card()');
    expect(parses(out.source)).toBe(true);
  });
});

describe('canvas-edit / applyInsertElement', () => {
  const base = [
    'function Demo() {',
    '  return (',
    '    <section>',
    '      <button>Anchor</button>',
    '    </section>',
    '  );',
    '}',
  ].join('\n');

  test('inserts a div AFTER the anchor and returns its new id', () => {
    const id = idsOf(base).button as string;
    const out = applyInsertElement(CANVAS, base, id, 'after', 'div');
    expect(out.source).toContain("background: 'var(--bg-2)'");
    expect(parses(out.source)).toBe(true);
    expect(out.newId).toMatch(/^[0-9a-f]{8}$/);
    // The recomputed id matches the pipeline-stamped id of the new <div>.
    expect(idsOf(out.source).div).toBe(out.newId);
  });

  test('inserts a text node BEFORE the anchor', () => {
    const id = idsOf(base).button as string;
    const out = applyInsertElement(CANVAS, base, id, 'before', 'text');
    expect(out.source).toContain('<p style={{ margin: 0 }}>Text</p>');
    // Order: the <p> precedes the <button> in source.
    expect(out.source.indexOf('<p ')).toBeLessThan(out.source.indexOf('<button'));
    expect(parses(out.source)).toBe(true);
  });

  test('inserts INSIDE the anchor (inside-end)', () => {
    const id = idsOf(base).section as string;
    const out = applyInsertElement(CANVAS, base, id, 'inside-end', 'div');
    // The new div is nested within <section>…</section>.
    expect(out.source).toMatch(/<section>[\s\S]*var\(--bg-2\)[\s\S]*<\/section>/);
    expect(parses(out.source)).toBe(true);
  });

  test('image insert requires a contained asset src', () => {
    const id = idsOf(base).button as string;
    expect(() => applyInsertElement(CANVAS, base, id, 'after', 'image')).toThrow(CanvasEditError);
    expect(() =>
      applyInsertElement(CANVAS, base, id, 'after', 'image', { src: '../etc/passwd' })
    ).toThrow(CanvasEditError);
    const ok = applyInsertElement(CANVAS, base, id, 'after', 'image', {
      src: 'assets/ab12cd34.png',
    });
    expect(ok.source).toContain('src="assets/ab12cd34.png"');
    expect(ok.source).toContain("objectFit: 'cover'");
    expect(parses(ok.source)).toBe(true);
  });

  test('refuses to nest inside a self-closing target', () => {
    const src = 'function Demo() { return <section><img src="assets/a.png" /></section>; }';
    const id = idsOf(src).img as string;
    expect(() => applyInsertElement(CANVAS, src, id, 'inside-end', 'div')).toThrow(CanvasEditError);
  });
});

describe('canvas-edit / applyResizeArtboard (D4)', () => {
  const canvas = [
    'export default function Demo() {',
    '  return (',
    '    <DesignCanvas>',
    '      <DCArtboard id="home" label="Home" width={1440} height={1024}>',
    '        <div>content</div>',
    '      </DCArtboard>',
    '    </DesignCanvas>',
    '  );',
    '}',
  ].join('\n');

  test('rewrites width + height numeric props (not string literals)', () => {
    const out = applyResizeArtboard(CANVAS, canvas, 'home', 1200, 900);
    expect(out.source).toContain('width={1200}');
    expect(out.source).toContain('height={900}');
    expect(out.source).not.toContain('width="1200"'); // never a string literal
    expect(parses(out.source)).toBe(true);
  });

  test('rounds + clamps and can change one axis only', () => {
    const out = applyResizeArtboard(CANVAS, canvas, 'home', 800.7, undefined);
    expect(out.source).toContain('width={801}');
    expect(out.source).toContain('height={1024}'); // untouched
  });

  test('unknown artboard id throws', () => {
    expect(() => applyResizeArtboard(CANVAS, canvas, 'nope', 100, 100)).toThrow(CanvasEditError);
  });
});

describe('canvas-edit / applyInsertArtboard (I4)', () => {
  const canvas = [
    'export default function Demo() {',
    '  return (',
    '    <DesignCanvas>',
    '      <DCArtboard id="home" label="Home" width={1440} height={1024}>',
    '        <div>content</div>',
    '      </DCArtboard>',
    '    </DesignCanvas>',
    '  );',
    '}',
  ].join('\n');

  test('appends an empty artboard after the last one', () => {
    const out = applyInsertArtboard(CANVAS, canvas, {
      id: 'mobile',
      label: 'Mobile',
      width: 390,
      height: 844,
    });
    expect(out.artboardId).toBe('mobile');
    expect(out.source).toContain(
      '<DCArtboard id="mobile" label="Mobile" width={390} height={844}></DCArtboard>'
    );
    // It lands AFTER the existing artboard.
    expect(out.source.indexOf('id="mobile"')).toBeGreaterThan(out.source.indexOf('id="home"'));
    expect(parses(out.source)).toBe(true);
  });

  test('rejects a duplicate artboard id', () => {
    expect(() =>
      applyInsertArtboard(CANVAS, canvas, { id: 'home', label: 'Dup', width: 390, height: 844 })
    ).toThrow(CanvasEditError);
  });

  test('rejects an invalid artboard id (injection guard)', () => {
    expect(() =>
      applyInsertArtboard(CANVAS, canvas, {
        id: 'a" onload="x',
        label: 'X',
        width: 390,
        height: 844,
      })
    ).toThrow(CanvasEditError);
  });
});
