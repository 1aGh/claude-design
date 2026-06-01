// PPTX adapter — native (svg2pptx) pipeline units (export-pipeline-fixes item 6).
//
// Covers the two pure pieces that make svg2pptx faithful + the deck merge:
//   - preprocessSvg: lift tspan x/y onto <text> + collapse the font stack.
//   - mergeDecks: combine N single-slide svg2pptx decks into one valid package.
// The svg2pptx conversion itself (Python) + live render are integration-shape.

import { describe, expect, test } from 'bun:test';
import JSZip from 'jszip';

import { mergeDecks, preprocessSvg } from '../../exporters/pptx.ts';

describe('preprocessSvg', () => {
  test('lifts the first tspan x/y onto a <text> that lacks them', () => {
    const svg = `<svg><text fill="rgb(0,0,0)"><tspan x="33" y="65.5">Hi</tspan></text></svg>`;
    const out = preprocessSvg(svg);
    // svg2pptx reads text@x/y — they must now be present (was the 0,0 pile-up).
    expect(out).toMatch(/<text x="33" y="65\.5"/);
  });

  test('collapses a CSS font-family stack to its first concrete name', () => {
    const svg = `<text font-family="&quot;Berkeley Mono&quot;, TX-02, &quot;JetBrains Mono&quot;, monospace"><tspan x="1" y="2">x</tspan></text>`;
    const out = preprocessSvg(svg);
    // A PPTX typeface is a single font name, not a fallback list.
    expect(out).toContain('font-family="Berkeley Mono"');
    expect(out).not.toContain('TX-02');
  });

  test('does not clobber a <text> that already has its own x/y', () => {
    const svg = `<text x="10" y="20"><tspan x="99" y="88">x</tspan></text>`;
    const out = preprocessSvg(svg);
    expect(out).toContain('<text x="10" y="20"');
    expect(out).not.toContain('<text x="99"');
  });
});

const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OD_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const SLIDE_CT = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

/** Minimal single-slide deck shaped like svg2pptx output (native, no media). */
async function singleSlideDeck(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="${SLIDE_CT}"/></Types>`
  );
  zip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="x" xmlns:r="y"><p:sldMasterIdLst><p:sldMasterId id="1" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>'
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${OD_REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="${OD_REL}/slide" Target="slides/slide1.xml"/></Relationships>`
  );
  zip.file('ppt/slides/slide1.xml', '<?xml version="1.0"?><p:sld xmlns:p="x"/>');
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${OD_REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`
  );
  zip.file('ppt/slideMasters/slideMaster1.xml', '<?xml version="1.0"?><p:sldMaster xmlns:p="x"/>');
  zip.file('ppt/slideLayouts/slideLayout1.xml', '<?xml version="1.0"?><p:sldLayout xmlns:p="x"/>');
  return zip.generateAsync({ type: 'uint8array' });
}

describe('mergeDecks — combine svg2pptx single-slide decks', () => {
  test('single deck passes through', async () => {
    const d = await singleSlideDeck();
    const merged = await mergeDecks([d]);
    expect(merged.byteLength).toBe(d.byteLength);
  });

  test('three decks → one valid package, all refs + Content-Types resolve', async () => {
    const decks = await Promise.all([singleSlideDeck(), singleSlideDeck(), singleSlideDeck()]);
    const merged = await mergeDecks(decks);
    const zip = await JSZip.loadAsync(merged);
    const parts = new Set(Object.keys(zip.files).filter((n) => !n.endsWith('/')));

    // 3 contiguous slides; no 4th.
    for (const n of [1, 2, 3]) expect(parts.has(`ppt/slides/slide${n}.xml`)).toBe(true);
    expect(parts.has('ppt/slides/slide4.xml')).toBe(false);

    // presentation.xml lists 3 slides; its rels keep the slideMaster (the
    // "unopenable" regression) + carry 3 slide rels.
    const pres = (await zip.file('ppt/presentation.xml')?.async('string')) ?? '';
    expect((pres.match(/<p:sldId /g) ?? []).length).toBe(3);
    const prels = (await zip.file('ppt/_rels/presentation.xml.rels')?.async('string')) ?? '';
    expect(prels).toContain('Target="slideMasters/slideMaster1.xml"');
    expect((prels.match(/Type="[^"]*\/relationships\/slide"/g) ?? []).length).toBe(3);

    // Every rels Target resolves.
    for (const rf of [...parts].filter((p) => p.endsWith('.rels'))) {
      const xml = (await zip.file(rf)?.async('string')) ?? '';
      const baseDir = rf.replace(/_rels\/[^/]+$/, '');
      for (const rel of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
        if (/TargetMode="External"/.test(rel[0])) continue;
        const tgt = /Target="([^"]+)"/.exec(rel[0])?.[1];
        if (!tgt) continue;
        const resolved = new URL(tgt, `file:///${baseDir}`).pathname.replace(/^\//, '');
        expect(parts.has(resolved)).toBe(true);
      }
    }

    // Every Content-Types Override resolves; exactly 3 slide overrides.
    const ct = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
    for (const o of ct.matchAll(/<Override\s+PartName="([^"]+)"/g)) {
      expect(parts.has(o[1].replace(/^\//, ''))).toBe(true);
    }
    expect((ct.match(/PartName="\/ppt\/slides\/slide\d+\.xml"/g) ?? []).length).toBe(3);
  });
});
