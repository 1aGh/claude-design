import { describe, expect, test } from 'bun:test';
import { applyTextEdit } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

// Phase 6 (unified-text-editing) — the build-time `data-cd-editable="text"`
// marker must agree EXACTLY with applyTextEdit's acceptance (canvas-edit.ts):
// stamped ⇔ a commit would save. See isInlineEditableText in
// canvas-pipeline.ts (the mirrored predicate).

const FIXTURE = `export default function Fixture() {
  return (
    <div>
      <h1>Maude desktop E2E</h1>
      <p>
        Deterministic, static canvas — proves the native shell booted the
        sidecar, navigated the webview, and rendered a canvas.
      </p>
      <p>Total: {1 + 1} items</p>
      <span>{title}</span>
      <h2>{'Quoted title'}</h2>
      <button>
        Save
      </button>
      <section>
        <em>nested</em>
      </section>
      <div />
    </div>
  );
}
const title = 'x';
`;

function stamped(withIds: string, tag: string): boolean {
  const m = withIds.match(new RegExp(`<${tag}[^>]*>`));
  if (!m) throw new Error(`tag <${tag}> not found in output`);
  return m[0].includes('data-cd-editable="text"');
}

describe('data-cd-editable build-time stamp', () => {
  const { withIds } = transpileCanvasSource('/virtual/Fixture.tsx', FIXTURE);

  test('single static JSXText gets the marker', () => {
    expect(stamped(withIds, 'h1')).toBe(true);
    expect(stamped(withIds, 'button')).toBe(true); // whitespace-framed text
  });

  test('multi-line static JSXText gets the marker', () => {
    expect(stamped(withIds, 'p')).toBe(true); // first <p> — static prose
  });

  test('mixed static+expression content does NOT get the marker', () => {
    // <p>Total: {1 + 1} items</p> — renders as leaf-looking text nodes, but
    // the source is mixed → applyTextEdit refuses → must not be offered.
    const second = withIds.match(/<p[^>]*>Total:/);
    if (!second) throw new Error('mixed <p> not found');
    expect(second[0].includes('data-cd-editable')).toBe(false);
  });

  test('dynamic expression content does NOT get the marker', () => {
    expect(stamped(withIds, 'span')).toBe(false); // {title}
  });

  test("{'string literal'} single child DOES get the marker (DDR-150 P1)", () => {
    expect(stamped(withIds, 'h2')).toBe(true);
  });

  test('containers and empty elements do NOT get the marker', () => {
    expect(stamped(withIds, 'section')).toBe(false); // element child
    const selfClosed = withIds.match(/<div [^>]*\/>/);
    if (!selfClosed) throw new Error('self-closed div not found');
    expect(selfClosed[0].includes('data-cd-editable')).toBe(false);
  });

  test('marker agrees with applyTextEdit acceptance for every stamped element', () => {
    // Every data-cd-id that carries the marker must be accepted by the
    // engine; every one without it (that has text-ish content) refused.
    const opens = withIds.match(/<[a-z][^>]*data-cd-id="[^"]+"[^>]*>/g) ?? [];
    for (const open of opens) {
      const id = /data-cd-id="([^"]+)"/.exec(open)?.[1];
      if (!id) continue;
      const kind = /data-cd-editable="(text|var)"/.exec(open)?.[1];
      let accepted = true;
      try {
        applyTextEdit('/virtual/Fixture.tsx', withIds, id, 'replacement');
      } catch {
        accepted = false;
      }
      // `text` (literal) MUST be accepted with no runtime context. `var`
      // (a {variable}) is traced back at commit and needs occurrence/before —
      // its acceptance is covered by dynamic-text-edit.test.ts, so only assert
      // it isn't offered where the engine would hard-refuse a literal edit.
      // Unmarked text-ish elements MUST be refused (no dead-end editor).
      if (kind === 'text') {
        expect(`${open} accepted=${accepted}`).toBe(`${open} accepted=true`);
      } else if (!kind) {
        expect(`${open} accepted=${accepted}`).toBe(`${open} accepted=false`);
      }
    }
  });
});

describe('applyTextEdit sibling integrity (Task 6.3)', () => {
  test('editing the h1 leaves every sibling byte-identical', () => {
    const { withIds } = transpileCanvasSource('/virtual/Fixture.tsx', FIXTURE);
    const h1Id = /<h1[^>]*data-cd-id="([^"]+)"/.exec(withIds)?.[1];
    if (!h1Id) throw new Error('no h1 id');
    const { source: out } = applyTextEdit('/virtual/Fixture.tsx', withIds, h1Id, 'New title');
    // The h1 text changed…
    expect(out).toMatch(/<h1[^>]*data-cd-editable="text"/);
    expect(out).toContain('New title');
    expect(out).not.toContain('Maude desktop E2E');
    // …and EVERYTHING ELSE is byte-identical: strip the h1 element line from
    // both versions and compare the rest wholesale.
    const strip = (s: string) => s.replace(/<h1[^>]*>[^<]*<\/h1>/, '<h1/>');
    expect(strip(out)).toBe(strip(withIds));
  });

  test('editing the multi-line p preserves its own whitespace framing', () => {
    const { withIds } = transpileCanvasSource('/virtual/Fixture.tsx', FIXTURE);
    const pId = /<p[^>]*data-cd-id="([^"]+)"[^>]*>\s*\n\s*Deterministic/.exec(withIds)?.[1];
    if (!pId) throw new Error('no p id');
    const { source: out } = applyTextEdit('/virtual/Fixture.tsx', withIds, pId, 'Short.');
    // Leading/trailing whitespace of the JSXText survives (JSX indentation).
    expect(out).toMatch(/<p[^>]*>\s*\n\s*Short\.\s*\n\s*<\/p>/);
    // Siblings untouched.
    expect(out).toMatch(/<h1[^>]*data-cd-editable="text"/);
    expect(out).toContain('Maude desktop E2E');
    expect(out).toContain('Total: {1 + 1} items');
  });
});
