// detach-component — feature-4 (2026-07-19). Detach = CLONE the component's
// definition under a fresh name + repoint ONE usage at the clone. Behavior-
// preserving for any component (no prop substitution); subsequent edits land on
// the clone's single-usage definition → resolveEditScope reports LOCAL.

import { describe, expect, test } from 'bun:test';

import { applyDetachComponent, CanvasEditError, resolveEditScope } from '../canvas-edit.ts';
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

describe('canvas-edit / applyDetachComponent', () => {
  const SRC = `
function Card({ label }: { label: string }) {
  return <article className="card"><h2>{label}</h2></article>;
}
export default function Demo() {
  return <div><Card label="Alpha" /><Card label="Beta" /></div>;
}
`;

  test('clones the definition + repoints ONE usage; the other usage is untouched', () => {
    const ids = idsOf(SRC);
    // Detach the FIRST instance (occurrence 0 of the shared inner article).
    const out = applyDetachComponent(CANVAS, SRC, ids.article as string, 0);
    expect(out.detachedName).toBe('CardDetached');
    // Clone inserted (same body, new name); original definition intact.
    expect(out.source).toContain('function CardDetached({ label }: { label: string })');
    expect(out.source).toContain('function Card({ label }: { label: string })');
    // First usage repointed, second untouched — props preserved verbatim.
    expect(out.source).toContain('<CardDetached label="Alpha" />');
    expect(out.source).toContain('<Card label="Beta" />');
  });

  test('after detach, edits on the detached instance resolve LOCAL', () => {
    const ids = idsOf(SRC);
    const out = applyDetachComponent(CANVAS, SRC, ids.article as string, 0);
    // Recompute ids on the NEW source — the detached article now belongs to
    // CardDetached, a single-usage component.
    const { withIds } = transpileCanvasSource(CANVAS, out.source);
    const detArticle = /<article([^>]*?)data-cd-id="([0-9a-f]{8})"/.exec(
      withIds.slice(withIds.indexOf('CardDetached'))
    );
    // Sanity: some article id exists inside the detached definition region.
    expect(detArticle).toBeTruthy();
    const scope = resolveEditScope(CANVAS, out.source, detArticle?.[2] as string, 1);
    expect(scope.scope).toBe('local');
  });

  test('non-self-closing usage: BOTH tags repoint', () => {
    const src = `
function Frame({ children }: { children?: unknown }) {
  return <section className="frame">{children}</section>;
}
export default function Demo() {
  return <div><Frame><p>a</p></Frame><Frame><p>b</p></Frame></div>;
}
`;
    const ids = idsOf(src);
    const out = applyDetachComponent(CANVAS, src, ids.section as string, 0);
    expect(out.source).toContain('<FrameDetached><p>a</p></FrameDetached>');
    expect(out.source).toContain('<Frame><p>b</p></Frame>');
  });

  test('name collisions bump the suffix', () => {
    const src = `
function Card() { return <article>x</article>; }
function CardDetached() { return <aside>existing</aside>; }
export default function Demo() {
  return <div><Card /><Card /></div>;
}
`;
    const ids = idsOf(src);
    const out = applyDetachComponent(CANVAS, src, ids.article as string, 0);
    expect(out.detachedName).toBe('CardDetached2');
    expect(out.source).toContain('function CardDetached2()');
  });

  test('a plain (non-instance) element refuses', () => {
    const src = `export default function Demo() { return <div><h1>T</h1></div>; }`;
    const ids = idsOf(src);
    expect(() => applyDetachComponent(CANVAS, src, ids.h1 as string, 0)).toThrow(CanvasEditError);
  });
});
