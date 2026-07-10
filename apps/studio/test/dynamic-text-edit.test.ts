import { describe, expect, test } from 'bun:test';
import { applyTextEdit } from '../canvas-edit.ts';
import { transpileCanvasSource } from '../canvas-pipeline.ts';

// unified-text-editing follow-up — editing text that comes from a `{variable}`
// or `{item.prop}` by tracing it back to its source string (a local const or a
// `.map()`ed array element). The safety contract: never rewrite the wrong item
// — occurrence picks the `.map()` slot, `before` verifies/rescues it, and an
// unresolvable expression still throws (routes to /design:edit).

const CANVAS = '/virtual/Cards.tsx';
const SRC = `const TOPICS = [
  { key: "a", body: "Alpha body text." },
  { key: "b", body: "Beta body text." },
  { key: "c", body: "Gamma body text." },
];
const TAGS = ["first", "second", "third"];
const HEADLINE = "The one headline";
export default function Cards() {
  return (
    <div>
      <h1>{HEADLINE}</h1>
      <section>
        {TOPICS.map((t) => (
          <article key={t.key}>
            <p>{t.body}</p>
          </article>
        ))}
      </section>
      <ul>
        {TAGS.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <p>Total: {TOPICS.length} topics</p>
      <span>{price.toFixed(2)}</span>
    </div>
  );
}
const price = 9;
`;

function ids(withIds: string, tag: string, inner: string): string {
  // Grab the data-cd-id of the <tag …>inner… element.
  const re = new RegExp(`<${tag}\\s+data-cd-id="([^"]+)"[^>]*>\\s*\\{?${inner}`);
  const m = withIds.match(re);
  if (!m) throw new Error(`no ${tag} matching ${inner}`);
  return m[1] as string;
}

describe('dynamic text edit — resolveDynamicTextSpan via applyTextEdit', () => {
  const { withIds } = transpileCanvasSource(CANVAS, SRC);

  test('{item.prop} in a .map — occurrence picks the array item', () => {
    const pId = ids(withIds, 'p', 't\\.body');
    // occurrence 1 → TOPICS[1].body, verified by `before`.
    const { source } = applyTextEdit(CANVAS, withIds, pId, 'Beta EDITED', {
      occurrence: 1,
      before: 'Beta body text.',
    });
    expect(source).toContain('body: "Beta EDITED"');
    expect(source).toContain('body: "Alpha body text."'); // sibling untouched
    expect(source).toContain('body: "Gamma body text."');
  });

  test('{item.prop} — index drift rescued by unique before-match', () => {
    const pId = ids(withIds, 'p', 't\\.body');
    // Wrong occurrence, but `before` uniquely identifies Gamma → rewrite it.
    const { source } = applyTextEdit(CANVAS, withIds, pId, 'Gamma EDITED', {
      occurrence: 0,
      before: 'Gamma body text.',
    });
    expect(source).toContain('body: "Gamma EDITED"');
    expect(source).toContain('body: "Alpha body text."');
  });

  test('{item} in a .map over a string array', () => {
    const liId = ids(withIds, 'li', 'tag');
    const { source } = applyTextEdit(CANVAS, withIds, liId, 'SECOND', {
      occurrence: 1,
      before: 'second',
    });
    expect(source).toContain('"first", "SECOND", "third"');
  });

  test('{localConst} — rewrites the const string', () => {
    const h1Id = ids(withIds, 'h1', 'HEADLINE');
    const { source } = applyTextEdit(CANVAS, withIds, h1Id, 'A new headline', {
      before: 'The one headline',
    });
    expect(source).toContain('HEADLINE = "A new headline"');
  });

  test('genuinely computed text still refuses (routes to /design:edit)', () => {
    const spanId = ids(withIds, 'span', 'price\\.toFixed');
    expect(() =>
      applyTextEdit(CANVAS, withIds, spanId, 'nope', { occurrence: 0, before: '9.00' })
    ).toThrow(/dynamic content/);
  });

  test('mixed literal+expression (Total: {n} topics) refuses', () => {
    // This <p> has text + expression + text → mixed, never offered.
    const m = withIds.match(/<p[^>]*data-cd-id="([^"]+)"[^>]*>Total:/);
    expect(m).toBeTruthy();
    expect(() => applyTextEdit(CANVAS, withIds, (m as RegExpMatchArray)[1] as string, 'x')).toThrow(
      /mixed or expression/
    );
  });

  test('no occurrence + no before on an ambiguous .map refuses (never guesses)', () => {
    const pId = ids(withIds, 'p', 't\\.body');
    // Without occurrence or before there is no way to know which card → refuse.
    expect(() => applyTextEdit(CANVAS, withIds, pId, 'x')).toThrow(/dynamic content/);
  });
});

describe('stamp marks var-editable text', () => {
  const { withIds } = transpileCanvasSource(CANVAS, SRC);
  test('{item.prop}, {item}, {const} get data-cd-editable="var"', () => {
    expect(withIds).toMatch(/<p[^>]*data-cd-editable="var"[^>]*>\s*\{t\.body\}/);
    expect(withIds).toMatch(/<li[^>]*data-cd-editable="var"[^>]*>\s*\{tag\}/);
    expect(withIds).toMatch(/<h1[^>]*data-cd-editable="var"[^>]*>\s*\{HEADLINE\}/);
  });
  test('computed + mixed text are NOT marked', () => {
    const span = withIds.match(/<span[^>]*>\{price\.toFixed/);
    expect((span as RegExpMatchArray)[0].includes('data-cd-editable')).toBe(false);
    const p = withIds.match(/<p[^>]*>Total:/);
    expect((p as RegExpMatchArray)[0].includes('data-cd-editable')).toBe(false);
  });
});
