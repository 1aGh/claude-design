// TIER 3 — end to end through the REAL translators (DDR-221 D7).
//
// Tier 2 proves the two doors normalize to the same TREE. That is necessary and
// not sufficient: the translators read specific fields, and a tree can agree on
// everything a diff looks at while still translating differently. This tier
// runs `toStrokes` (board) and `toCanvas` (design) over BOTH doors' output and
// compares what they actually produce.
//
// It is also where the Tier-2 vocabulary finding pays off concretely: before the
// internal→REST mapping, `to-strokes`/`to-artboard` saw FRAME where REST gave
// GROUP and every sticky arrived with empty text — so this comparison is the one
// that would have caught the user-visible half of that bug.

import { describe, expect, test } from 'bun:test';

import { decodeFigArchive } from './fig-decode.ts';
import { toArtboard, toCanvas } from './to-artboard.ts';
import { toStrokes } from './to-strokes.ts';
import { type FigmaNode, type NormalizedDocument, walkNodes } from './types.ts';

const FIXTURES = new URL('../../../.ai/fixtures/figma/2026-08-03/', import.meta.url).pathname;

async function doors(archive: string, oracle: string, fileKey: string) {
  const rest = (await Bun.file(FIXTURES + oracle).json()) as NormalizedDocument;
  const bytes = new Uint8Array(await Bun.file(FIXTURES + archive).arrayBuffer());
  const { document: fig } = decodeFigArchive(bytes, { fileKey });
  return { rest, fig };
}

/** The first CANVAS page, which is what an import actually translates. */
function firstPage(doc: NormalizedDocument): FigmaNode {
  let page: FigmaNode | undefined;
  walkNodes(doc.root, (n) => {
    if (!page && n.type === 'CANVAS') page = n;
  });
  if (!page) throw new Error('no CANVAS page in the document');
  return page;
}

describe('tier 3 — FigJam board through to-strokes', () => {
  test('both doors produce the same stroke set: kinds, geometry, text and bindings', async () => {
    const { rest, fig } = await doors(
      'figjam.jam',
      'figjam.rest-oracle.json',
      'Em6NOwaOFTYV7NlQT4NK8l'
    );
    const a = toStrokes(rest);
    const b = toStrokes(fig);

    // A stroke's identity for comparison purposes: what the user would see.
    const shape = (s: Record<string, unknown>) =>
      [
        s.tool,
        Math.round(Number(s.x ?? 0)),
        Math.round(Number(s.y ?? 0)),
        Math.round(Number(s.w ?? 0)),
        Math.round(Number(s.h ?? 0)),
        String(s.text ?? s.label ?? ''),
        String(s.color ?? ''),
      ].join('|');

    const av = (a.strokes as unknown as Record<string, unknown>[]).map(shape).sort();
    const bv = (b.strokes as unknown as Record<string, unknown>[]).map(shape).sort();
    expect(bv).toEqual(av);
    expect(b.strokes.length).toBe(a.strokes.length);
    expect(b.origin).toEqual(a.origin);
  });

  test('sticky TEXT actually arrives — the regression Tier 2 found, at the user-visible layer', async () => {
    const { fig } = await doors('figjam.jam', 'figjam.rest-oracle.json', 'Em6NOwaOFTYV7NlQT4NK8l');
    const { strokes } = toStrokes(fig);
    const texts = (strokes as unknown as Record<string, unknown>[])
      .map((s) => String(s.text ?? s.label ?? ''))
      .filter(Boolean);
    // Before the override-path fix every one of these was an empty string while
    // the board still looked structurally perfect.
    expect(texts.some((t) => t.includes('palette yellow'))).toBe(true);
    expect(texts.some((t) => t.includes('Sekce vnější'))).toBe(true);
    expect(texts.filter((t) => t.trim().length > 0).length).toBeGreaterThan(10);
  });

  test('bound connectors survive as bindings, not as frozen lines', async () => {
    const { rest, fig } = await doors(
      'figjam.jam',
      'figjam.rest-oracle.json',
      'Em6NOwaOFTYV7NlQT4NK8l'
    );
    // `to-strokes` mints ids as `fig_<session>_<local>_<n>` where <n> is a
    // process-wide counter, so the SECOND call in a test file is offset by the
    // first. Compare the host NODE, which is the part that carries meaning.
    const host = (b: unknown) => {
      const id = (b as { hostId?: string } | null)?.hostId;
      return id ? id.replace(/_\d+$/, '') : null;
    };
    const bindings = (r: ReturnType<typeof toStrokes>) =>
      (r.strokes as unknown as Record<string, unknown>[])
        .filter((s) => s.tool === 'arrow')
        .map((s) => `${host(s.startBind)}->${host(s.endBind)}`)
        .sort();
    expect(bindings(toStrokes(fig))).toEqual(bindings(toStrokes(rest)));
  });

  test('the two doors report the same dispositions', async () => {
    const { rest, fig } = await doors(
      'figjam.jam',
      'figjam.rest-oracle.json',
      'Em6NOwaOFTYV7NlQT4NK8l'
    );
    const codes = (r: ReturnType<typeof toStrokes>) =>
      r.report.entries.map((e) => `${e.node}:${e.disposition}`).sort();
    expect(codes(toStrokes(fig))).toEqual(codes(toStrokes(rest)));
  });
});

describe('tier 3 — design page through to-canvas', () => {
  const KEY = 'dGNzRC2kmrmGnOxaBa0RI7';

  test('both doors produce the same artboard set and the same JSX', async () => {
    const { rest, fig } = await doors('design.fig', 'design.rest-oracle.json', KEY);
    const a = toCanvas(rest, firstPage(rest));
    const b = toCanvas(fig, firstPage(fig));

    expect(b.artboardCount).toBe(a.artboardCount);
    expect(b.origin).toEqual(a.origin);
    // The emitted component source is the real deliverable — compare it whole,
    // minus the ONE field a local file cannot reproduce (see the next test).
    // Normalized: the ONE field a local export cannot reproduce (next test).
    // `toCanvas`'s banner carries no verb, so there is nothing else to allow for.
    const norm = (tsx: string) => tsx.replace(/ lineHeight: "[^"]*",/g, '');
    expect(norm(b.tsx)).toBe(norm(a.tsx));
  });

  test('a single-frame artboard names the DOOR it came through', async () => {
    // `--fig` reads a local export with no network at all. A banner claiming
    // `--frames` on a file nobody fetched is a false provenance claim, so
    // `toArtboard` reads `doc.origin` rather than hardcoding the verb.
    const { rest, fig } = await doors('design.fig', 'design.rest-oracle.json', KEY);
    const frameOf = (d: NormalizedDocument) => {
      let f: FigmaNode | undefined;
      walkNodes(d.root, (n) => {
        if (!f && n.type === 'FRAME') f = n;
      });
      if (!f) throw new Error('no FRAME in the fixture');
      return f;
    };
    expect(toArtboard(rest, frameOf(rest)).tsx).toContain('import-figma --frames`');
    expect(toArtboard(fig, frameOf(fig)).tsx).toContain('--fig (offline, local export)`');
  });

  test('lineHeight is the ONLY thing the local door cannot reproduce, and it says so', async () => {
    // REST reports a RESOLVED pixel line-height; a .fig stores the authored
    // value, and `{value: 100, units: "PERCENT"}` cannot become pixels without
    // font metrics we do not have offline. Asserted AS lossy per the plan's
    // "known-lossy fields are listed explicitly; nothing degrades silently" —
    // and asserted as the only one, so the list cannot quietly grow.
    const bytes = new Uint8Array(await Bun.file(`${FIXTURES}design.fig`).arrayBuffer());
    const { report } = decodeFigArchive(bytes, { fileKey: KEY });
    expect(report.lossyFields.map((f) => f.field)).toEqual(['style.lineHeightPx']);
    expect(report.lossyFields[0]?.count).toBeGreaterThan(0);

    const { rest, fig } = await doors('design.fig', 'design.rest-oracle.json', KEY);
    const a = toCanvas(rest, firstPage(rest)).tsx;
    const b = toCanvas(fig, firstPage(fig)).tsx;
    // Everything OTHER than lineHeight matches, so the diff really is that one
    // property and not a bucket that happens to contain it.
    expect(a.includes('lineHeight:')).toBe(true);
    expect(b.includes('lineHeight:')).toBe(false);
  });

  test('the GROUP mapping reaches the translator — flattening depends on it', async () => {
    // `isStylelessWrapper`/`flattenWrappers` key off GROUP. While the decoder
    // emitted Figma's internal FRAME for those nodes, the three nested wrappers
    // in the design fixture would never have been flattened.
    const { rest, fig } = await doors('design.fig', 'design.rest-oracle.json', KEY);
    const groups = (d: NormalizedDocument) => {
      let n = 0;
      walkNodes(d.root, (x) => {
        if (x.type === 'GROUP') n++;
      });
      return n;
    };
    expect(groups(fig)).toBe(groups(rest));
    expect(groups(fig)).toBeGreaterThan(0);
  });

  test('the two doors report the same dispositions', async () => {
    const { rest, fig } = await doors('design.fig', 'design.rest-oracle.json', KEY);
    const codes = (r: ReturnType<typeof toCanvas>) =>
      r.report.entries.map((e) => `${e.node}:${e.disposition}`).sort();
    expect(codes(toCanvas(fig, firstPage(fig)))).toEqual(codes(toCanvas(rest, firstPage(rest))));
  });
});
