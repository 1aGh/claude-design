import { describe, expect, test } from 'bun:test';
import { parseSync } from 'oxc-parser';

import { TranspileError, transpileCanvasSource } from '../canvas-pipeline.ts';

const FIXTURE = `
import { useState } from 'react';

export default function DocsSite() {
  const [count, setCount] = useState(0);
  return (
    <section className="hero">
      <h1>Hello, world.</h1>
      <p data-dc-element="hero-copy">Subhead with <em>emphasis</em>.</p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        Click {count}
      </button>
    </section>
  );
}
`;

describe('transpileCanvasSource — Pass 1 (ID injection)', () => {
  test('determinism: same source produces same locator map across calls', () => {
    const a = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const b = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    expect(Object.keys(a.locator).sort()).toEqual(Object.keys(b.locator).sort());
    expect(a.withIds).toEqual(b.withIds);
    expect(a.etag).toEqual(b.etag);
  });

  test('every JSX element gets exactly one data-cd-id', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    // Fixture has 5 JSX elements: section, h1, p, em, button.
    const ids = r.withIds.match(/ data-cd-id="[0-9a-f]{8}"/g) ?? [];
    expect(ids.length).toBe(5);
    expect(Object.keys(r.locator).length).toBe(5);
  });

  test('IDs are 8 lowercase hex characters', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    for (const id of Object.keys(r.locator)) {
      expect(id).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  test('whitespace-only edits inside the component preserve IDs', () => {
    const a = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const withExtraSpaces = FIXTURE.replace('Hello, world.', '  Hello, world.  ');
    const b = transpileCanvasSource('/x/DocsSite.tsx', withExtraSpaces);
    // Whitespace doesn't change componentName or pre-order index of any JSX
    // element, so the same ID set must result.
    expect(Object.keys(b.locator).sort()).toEqual(Object.keys(a.locator).sort());
  });

  test('inserting a sibling shifts the element-to-ID mapping (documented contract)', () => {
    // The contract per DDR-019:
    //   - ID is computed from (componentName, preOrderIndex).
    //   - The SET of IDs is therefore a function of element count, not content
    //     — every position-hash that existed before still exists (superset).
    //   - But the SOURCE ELEMENT attached to a given ID shifts: ID at idx=1 used
    //     to point to <h1>, after inserting <span> above it now points to <span>.
    //     This is the "selection jumps" failure mode Phase-12's (componentName,
    //     jsxPath) fallback recovers.
    const a = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const withInsert = FIXTURE.replace(
      '<section className="hero">',
      '<section className="hero">\n      <span>NEW</span>'
    );
    const b = transpileCanvasSource('/x/DocsSite.tsx', withInsert);

    // Count: one new JSX element => one new ID.
    expect(Object.keys(b.locator).length).toBe(Object.keys(a.locator).length + 1);

    // Superset: every old position-hash still appears.
    for (const id of Object.keys(a.locator)) expect(b.locator[id]).toBeDefined();

    // jsxPath-at-ID shifts: the IDs that used to point at h1/p/em/button now
    // point at different element types (or at the new <span>). Concretely:
    // count how many shared IDs have an UNCHANGED jsxPath after the insert.
    let unchangedPaths = 0;
    for (const id of Object.keys(a.locator)) {
      const before = a.locator[id]?.jsxPath.join('>');
      const after = b.locator[id]?.jsxPath.join('>');
      if (before === after) unchangedPaths += 1;
    }
    // Only the first element (the <section> wrapper, idx 0) is unaffected by
    // the insert that happens inside it.
    expect(unchangedPaths).toBe(1);
  });

  test('locator entries carry canvas, line, col, jsxPath, componentName', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    for (const entry of Object.values(r.locator)) {
      expect(entry.canvas).toBe('/x/DocsSite.tsx');
      expect(typeof entry.line).toBe('number');
      expect(entry.line).toBeGreaterThan(0);
      expect(typeof entry.col).toBe('number');
      expect(Array.isArray(entry.jsxPath)).toBe(true);
      expect(entry.jsxPath.length).toBeGreaterThan(0);
      expect(entry.componentName).toBe('DocsSite');
    }
  });

  test('jsxPath reflects element-type nesting', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const paths = Object.values(r.locator)
      .map((e) => e.jsxPath.join('>'))
      .sort();
    // Expected, sorted: section, section>button, section>h1, section>p, section>p>em
    expect(paths).toEqual(['section', 'section>button', 'section>h1', 'section>p', 'section>p>em']);
  });
});

describe('transpileCanvasSource — Pass 2 (JSX -> JS)', () => {
  test('output is parseable JS (no syntax errors)', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const parsed = parseSync('/x/DocsSite.js', r.js, { sourceType: 'module' });
    expect(parsed.errors.length).toBe(0);
  });

  test('output preserves the default export', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    expect(r.js).toMatch(/export default/);
  });

  test('output references data-cd-id on every emitted element', () => {
    const r = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const dcCount = (r.js.match(/"data-cd-id":\s*"[0-9a-f]{8}"/g) ?? []).length;
    expect(dcCount).toBe(5);
  });
});

describe('transpileCanvasSource — robustness', () => {
  test('idempotent: re-running on the post-pass-1 source does not double-inject', () => {
    // Re-parsing the post-pass-1 source through the pipeline should detect the
    // existing data-cd-id attribute on every element and skip injection.
    const first = transpileCanvasSource('/x/DocsSite.tsx', FIXTURE);
    const second = transpileCanvasSource('/x/DocsSite.tsx', first.withIds);
    const firstIds = (first.withIds.match(/ data-cd-id="/g) ?? []).length;
    const secondIds = (second.withIds.match(/ data-cd-id="/g) ?? []).length;
    expect(secondIds).toBe(firstIds);
  });

  test('handles arrow-function component bound to a PascalCase const', () => {
    const src = `
      const Hello = () => <h1>hi</h1>;
      export default Hello;
    `;
    const r = transpileCanvasSource('/x/Hello.tsx', src);
    expect(Object.keys(r.locator).length).toBe(1);
    expect(Object.values(r.locator)[0]?.componentName).toBe('Hello');
  });

  test('handles JSXMemberExpression element names (motion.div)', () => {
    const src = `
      const motion = { div: 'div' };
      export default function MotionCanvas() {
        return <motion.div>boop</motion.div>;
      }
    `;
    const r = transpileCanvasSource('/x/MotionCanvas.tsx', src);
    expect(Object.keys(r.locator).length).toBe(1);
    const entry = Object.values(r.locator)[0];
    expect(entry?.jsxPath).toEqual(['motion.div']);
  });

  test('throws TranspileError on a malformed source', () => {
    const broken = 'export default function X() { return <div></span>; }';
    expect(() => transpileCanvasSource('/x/Broken.tsx', broken)).toThrow(TranspileError);
  });

  test('source with no JSX produces empty locator + still-valid JS', () => {
    const src = 'export default function X() { return 42; }';
    const r = transpileCanvasSource('/x/X.tsx', src);
    expect(Object.keys(r.locator).length).toBe(0);
    const parsed = parseSync('/x/X.js', r.js, { sourceType: 'module' });
    expect(parsed.errors.length).toBe(0);
  });
});
