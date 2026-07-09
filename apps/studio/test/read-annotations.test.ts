// read-annotations.test.ts — Phase 22. The CONTRACT test that keeps the headless
// reader (`bin/read-annotations.mjs`) in sync with the browser serializer.
//
// Strategy: build strokes → run them through the CANONICAL `strokesToSvg`
// (annotations-layer.tsx) → write to a temp <designRoot>/<slug>.annotations.svg →
// invoke the reader as a child process exactly as `maude design read-annotations`
// does (node + the .mjs) → assert the extracted `{ tool, text, x, y, color }`
// matches the inputs. If Phase 21/23/24 ever change the SVG shape, this fails
// loud — the reader is a SEPARATE implementation of the same vocabulary, so the
// serializer is the single source of truth it must track.

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  type ArrowStroke,
  type EllipseStroke,
  type ImageStroke,
  type PenStroke,
  type PolygonStroke,
  type RectStroke,
  type SectionStroke,
  type StickyStroke,
  type Stroke,
  strokesToSvg,
  type TextStroke,
} from '../annotations-layer.tsx';

const READER = fileURLToPath(new URL('../bin/read-annotations.mjs', import.meta.url));

interface Annotation {
  tool: string;
  id: string;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  text: string | null;
  color: string | null;
  anchorId?: string;
  artboard?: string | null;
  element?: {
    cdId: string | null;
    selector: string;
    index: number;
    artboard: string | null;
    rect: { x: number; y: number; w: number; h: number };
    tag: string;
    text: string;
  } | null;
  target?: { source: string; selector: { type: string; value: string }; geometry: unknown };
  href?: string;
  authorName?: string;
  members?: Array<{
    id: string;
    tool: string;
    order: number;
    x: number | null;
    y: number | null;
    w: number | null;
    h: number | null;
    href?: string;
  }>;
}

// Mirror api.ts fileSlug for the common (design-root-relative .tsx) case so the
// fixture lands where the reader will look.
function slugFor(relPath: string): string {
  return relPath
    .replace(/\//g, '-')
    .replace(/\s+/g, '_')
    .replace(/\.(tsx|html)$/i, '')
    .replace(/^\.+/, '')
    .toLowerCase();
}

/**
 * Materialize a temp repo with `<root>/.design/<slug>.annotations.svg`, run the
 * reader against it, and return the parsed JSON. `extraFiles` lets a test drop a
 * canvas-state JSON alongside.
 */
function read(
  relPath: string,
  svg: string,
  extraArgs: string[] = [],
  extraFiles: Record<string, string> = {}
): { annotations: Annotation[]; exitCode: number; stderr: string } {
  const root = mkdtempSync(`${tmpdir()}/maude-read-annot-`);
  try {
    mkdirSync(`${root}/.design`, { recursive: true });
    writeFileSync(`${root}/.design/${slugFor(relPath)}.annotations.svg`, svg);
    for (const [name, contents] of Object.entries(extraFiles)) {
      writeFileSync(`${root}/${name}`, contents);
    }
    const res = spawnSync('node', [READER, relPath, '--root', root, ...extraArgs], {
      encoding: 'utf8',
      cwd: root, // a relative --canvas-state resolves against cwd, as in real use
    });
    const stdout = (res.stdout || '').trim();
    return {
      annotations: stdout ? (JSON.parse(stdout) as Annotation[]) : [],
      exitCode: res.status ?? 1,
      stderr: res.stderr || '',
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const REL = 'ui/Board.tsx';

describe('read-annotations / standalone + anchored text', () => {
  test('standalone text yields its world (x, y), color, and verbatim string', () => {
    const t: TextStroke = {
      id: 't-std',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 20,
      text: 'hero needs a bigger CTA',
      x: 120,
      y: 80,
    };
    const { annotations, exitCode } = read(REL, strokesToSvg([t]));
    expect(exitCode).toBe(0);
    expect(annotations).toHaveLength(1);
    const [a] = annotations;
    expect(a?.tool).toBe('text');
    expect(a?.id).toBe('t-std');
    expect(a?.text).toBe('hero needs a bigger CTA');
    expect(a?.x).toBe(120);
    expect(a?.y).toBe(80);
    expect(a?.color).toBe('#1a1a1a');
    expect(a?.anchorId).toBeUndefined();
  });

  test('anchored text carries its anchor id and null world coords', () => {
    const t: TextStroke = {
      id: 't-anc',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 14,
      text: 'label',
      anchorId: 'r-host',
    };
    const { annotations } = read(REL, strokesToSvg([t]));
    const [a] = annotations;
    expect(a?.anchorId).toBe('r-host');
    expect(a?.x).toBeNull();
    expect(a?.y).toBeNull();
    expect(a?.text).toBe('label');
  });
});

describe('read-annotations / sticky', () => {
  const sticky: StickyStroke = {
    id: 'st1',
    tool: 'sticky',
    color: '#fce8a6',
    x: 40,
    y: 50,
    w: 200,
    h: 160,
    text: 'Step 1: email + password',
    fontSize: 14,
    cornerRadius: 8,
  };

  test('sticky yields geometry, paper tint, and body text', () => {
    const { annotations } = read(REL, strokesToSvg([sticky]));
    const [a] = annotations;
    expect(a?.tool).toBe('sticky');
    expect(a?.x).toBe(40);
    expect(a?.y).toBe(50);
    expect(a?.w).toBe(200);
    expect(a?.h).toBe(160);
    expect(a?.text).toBe('Step 1: email + password');
    expect(a?.color).toBe('#fce8a6'); // group fill = paper tint, NOT the #1a1a1a body ink
  });

  test('multi-line sticky text round-trips the newline', () => {
    const multi: StickyStroke = { ...sticky, text: 'line one\nline two' };
    const { annotations } = read(REL, strokesToSvg([multi]));
    expect(annotations[0]?.text).toBe('line one\nline two');
  });

  test('authorName containing `>` round-trips intact and does not corrupt sibling geometry (DDR-155/escAttr regression)', () => {
    const authored: StickyStroke = { ...sticky, authorName: 'Bob> data-x="evil' };
    const { annotations } = read(REL, strokesToSvg([authored]));
    const [a] = annotations;
    expect(a?.authorName).toBe('Bob> data-x="evil');
    // The injected `>`/`"` must not have shifted the element scan and eaten
    // the sibling geometry/text attributes.
    expect(a?.x).toBe(40);
    expect(a?.y).toBe(50);
    expect(a?.w).toBe(200);
    expect(a?.h).toBe(160);
    expect(a?.text).toBe('Step 1: email + password');
  });
});

describe('read-annotations / position-only strokes carry text:null + a bbox', () => {
  test('pen → text:null with a bounding box from its path', () => {
    const pen: PenStroke = {
      id: 'p1',
      tool: 'pen',
      color: '#e5484d',
      width: 3,
      points: [
        [10, 20],
        [60, 80],
        [30, 50],
      ],
    };
    const [a] = read(REL, strokesToSvg([pen])).annotations;
    expect(a?.tool).toBe('pen');
    expect(a?.text).toBeNull();
    expect(a?.x).toBe(10);
    expect(a?.y).toBe(20);
    expect(a?.w).toBe(50); // 60 - 10
    expect(a?.h).toBe(60); // 80 - 20
    expect(a?.color).toBe('#e5484d');
  });

  test('rect → text:null with its declared geometry', () => {
    const rect: RectStroke = {
      id: 'r1',
      tool: 'rect',
      color: '#3b82f6',
      width: 2,
      x: 5,
      y: 6,
      w: 100,
      h: 40,
      fill: null,
    };
    const [a] = read(REL, strokesToSvg([rect])).annotations;
    expect(a?.tool).toBe('rect');
    expect(a?.text).toBeNull();
    expect(a?.x).toBe(5);
    expect(a?.y).toBe(6);
    expect(a?.w).toBe(100);
    expect(a?.h).toBe(40);
  });

  test('arrow → text:null with a bbox recovered from its endpoints', () => {
    const arrow: ArrowStroke = {
      id: 'a1',
      tool: 'arrow',
      color: '#30a46c',
      width: 2,
      x1: 200,
      y1: 100,
      x2: 120,
      y2: 160,
    };
    const [a] = read(REL, strokesToSvg([arrow])).annotations;
    expect(a?.tool).toBe('arrow');
    expect(a?.text).toBeNull();
    expect(a?.x).toBe(120); // min(200,120)
    expect(a?.y).toBe(100); // min(100,160)
    expect(a?.w).toBe(80); // |200-120|
    expect(a?.h).toBe(60); // |160-100|
  });

  test('ellipse → bbox from centre + radii', () => {
    const ell: EllipseStroke = {
      id: 'e1',
      tool: 'ellipse',
      color: '#8b5cf6',
      width: 2,
      cx: 100,
      cy: 100,
      rx: 30,
      ry: 20,
      fill: null,
    };
    const [a] = read(REL, strokesToSvg([ell])).annotations;
    expect(a?.tool).toBe('ellipse');
    expect(a?.x).toBe(70);
    expect(a?.y).toBe(80);
    expect(a?.w).toBe(60);
    expect(a?.h).toBe(40);
    expect(a?.text).toBeNull();
  });

  test('polygon → bbox from its points', () => {
    const poly: PolygonStroke = {
      id: 'pg1',
      tool: 'polygon',
      shape: 'diamond',
      color: '#e5484d',
      width: 3,
      x: 10,
      y: 20,
      w: 80,
      h: 60,
    };
    const [a] = read(REL, strokesToSvg([poly])).annotations;
    expect(a?.tool).toBe('polygon');
    expect(a?.text).toBeNull();
    expect(a?.x).toBeCloseTo(10, 4);
    expect(a?.y).toBeCloseTo(20, 4);
    expect(a?.w).toBeCloseTo(80, 4);
    expect(a?.h).toBeCloseTo(60, 4);
  });
});

describe('read-annotations / empty + missing', () => {
  test('an empty annotation SVG yields []', () => {
    const { annotations, exitCode } = read(REL, strokesToSvg([]));
    expect(exitCode).toBe(0);
    expect(annotations).toEqual([]);
  });

  test('a missing annotation file yields [] (a board with no notes is valid)', () => {
    // Point at a canvas whose slug has NO file on disk.
    const root = mkdtempSync(`${tmpdir()}/maude-read-annot-`);
    try {
      mkdirSync(`${root}/.design`, { recursive: true });
      const res = spawnSync('node', [READER, 'ui/Nope.tsx', '--root', root], {
        encoding: 'utf8',
      });
      expect(res.status).toBe(0);
      expect(JSON.parse((res.stdout || '').trim())).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('read-annotations / entity decoding', () => {
  test('an entity-laden string comes back exactly as typed', () => {
    const t: TextStroke = {
      id: 't-ent',
      tool: 'text',
      color: '#1a1a1a',
      fontSize: 16,
      text: 'A & B < C "quoted"',
      x: 0,
      y: 0,
    };
    const svg = strokesToSvg([t]);
    // Sanity: the serializer DID escape the special characters on disk.
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&quot;');
    const [a] = read(REL, svg).annotations;
    expect(a?.text).toBe('A & B < C "quoted"');
  });
});

describe('read-annotations / document order + mixed scene', () => {
  test('a mixed scene preserves document order and tags each tool', () => {
    const scene: Stroke[] = [
      {
        id: 's-sticky',
        tool: 'sticky',
        color: '#bfe3c0',
        x: 0,
        y: 0,
        w: 200,
        h: 200,
        text: 'first',
        fontSize: 14,
      },
      { id: 's-text', tool: 'text', color: '#000', fontSize: 14, text: 'second', x: 300, y: 10 },
      {
        id: 's-rect',
        tool: 'rect',
        color: '#222',
        width: 2,
        x: 0,
        y: 300,
        w: 50,
        h: 50,
        fill: null,
      },
      { id: 's-arrow', tool: 'arrow', color: '#111', width: 2, x1: 0, y1: 0, x2: 40, y2: 40 },
    ];
    const { annotations } = read(REL, strokesToSvg(scene));
    expect(annotations.map((a) => a.id)).toEqual(['s-sticky', 's-text', 's-rect', 's-arrow']);
    expect(annotations.map((a) => a.tool)).toEqual(['sticky', 'text', 'rect', 'arrow']);
    // Only the word-carrying strokes have text.
    expect(annotations.map((a) => a.text)).toEqual(['first', 'second', null, null]);
  });
});

describe('read-annotations / --canvas-state overlap tagging', () => {
  test('each annotation is tagged with the artboard it overlaps', () => {
    const scene: Stroke[] = [
      // sits inside artboard "hero" (0,0,400,300)
      { id: 'in-hero', tool: 'text', color: '#000', fontSize: 14, text: 'on hero', x: 50, y: 60 },
      // sits inside artboard "list" (500,0,400,300)
      {
        id: 'in-list',
        tool: 'sticky',
        color: '#fce8a6',
        x: 520,
        y: 40,
        w: 100,
        h: 80,
        text: 'on list',
        fontSize: 14,
      },
      // sits in empty space — no artboard
      {
        id: 'floating',
        tool: 'text',
        color: '#000',
        fontSize: 14,
        text: 'nowhere',
        x: 2000,
        y: 2000,
      },
    ];
    const canvasState = JSON.stringify({
      artboards: [
        { id: 'hero', x: 0, y: 0, w: 400, h: 300 },
        { id: 'list', x: 500, y: 0, w: 400, h: 300 },
      ],
    });
    const { annotations } = read(REL, strokesToSvg(scene), ['--canvas-state', 'state.json'], {
      'state.json': canvasState,
    });
    const byId = Object.fromEntries(annotations.map((a) => [a.id, a.artboard]));
    expect(byId['in-hero']).toBe('hero');
    expect(byId['in-list']).toBe('list');
    expect(byId.floating).toBeNull();
  });

  test('without --canvas-state no artboard field is emitted', () => {
    const t: TextStroke = {
      id: 't',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'x',
      x: 0,
      y: 0,
    };
    const [a] = read(REL, strokesToSvg([t])).annotations;
    expect(a && 'artboard' in a).toBe(false);
  });
});

// feature-whiteboard-ai-toolkit — --rects (a `maude design canvas-rects`
// geometry manifest) adds element-level context on top of the existing
// artboard tagging.
describe('read-annotations / --rects element-level context', () => {
  const manifest = JSON.stringify({
    artboards: [{ id: 'hero', x: 0, y: 0, w: 400, h: 300 }],
    elements: [
      // A wrapping card AND the button inside it both contain "over-button"'s
      // center — the button (smaller area) must win (deepest heuristic).
      {
        cdId: 'card1',
        selector: '[data-dc-screen="hero"] [data-cd-id="card1"]',
        index: 0,
        artboard: 'hero',
        x: 40,
        y: 40,
        w: 300,
        h: 200,
        tag: 'div',
        text: '',
      },
      {
        cdId: 'btn1',
        selector: '[data-dc-screen="hero"] [data-cd-id="btn1"]',
        index: 0,
        artboard: 'hero',
        x: 60,
        y: 60,
        w: 100,
        h: 32,
        tag: 'button',
        text: 'Continue',
      },
    ],
    elementsTruncated: false,
  });

  test('a note whose center sits over an element resolves the DEEPEST (smallest) match', () => {
    const t: TextStroke = {
      id: 'over-button',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'shrink this',
      x: 80,
      y: 70, // inside both card1 (40,40,300,200) and btn1 (60,60,100,32)
    };
    const { annotations } = read(REL, strokesToSvg([t]), ['--rects', 'rects.json'], {
      'rects.json': manifest,
    });
    const [a] = annotations;
    expect(a?.element?.cdId).toBe('btn1');
    expect(a?.element?.tag).toBe('button');
    expect(a?.element?.text).toBe('Continue');
    expect(a?.element?.selector).toBe('[data-dc-screen="hero"] [data-cd-id="btn1"]');
    expect(a?.element?.rect).toEqual({ x: 60, y: 60, w: 100, h: 32 });
  });

  test('a note over no element resolves element: null', () => {
    const t: TextStroke = {
      id: 'floating',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'nowhere near an element',
      x: 5000,
      y: 5000,
    };
    const { annotations } = read(REL, strokesToSvg([t]), ['--rects', 'rects.json'], {
      'rects.json': manifest,
    });
    expect(annotations[0]?.element).toBeNull();
  });

  test('--rects also supplies artboard tagging when --canvas-state is absent', () => {
    const t: TextStroke = {
      id: 'on-hero',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'x',
      x: 80,
      y: 70,
    };
    const { annotations } = read(REL, strokesToSvg([t]), ['--rects', 'rects.json'], {
      'rects.json': manifest,
    });
    expect(annotations[0]?.artboard).toBe('hero');
  });

  test('an element resolution upgrades the W3C target.selector to a CssSelector', () => {
    const t: TextStroke = {
      id: 'over-button-2',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'x',
      x: 80,
      y: 70,
    };
    const { annotations } = read(REL, strokesToSvg([t]), ['--rects', 'rects.json'], {
      'rects.json': manifest,
    });
    expect(annotations[0]?.target?.selector).toEqual({
      type: 'CssSelector',
      value: '[data-dc-screen="hero"] [data-cd-id="btn1"]',
    });
  });

  test('a floating note (no artboard) keeps AnnotationIdSelector', () => {
    const t: TextStroke = {
      id: 'far-away',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'x',
      x: 9000,
      y: 9000,
    };
    const { annotations } = read(REL, strokesToSvg([t]), ['--rects', 'rects.json'], {
      'rects.json': manifest,
    });
    // Outside every artboard — anchorToArtboard returns early, no `target` at all.
    expect(annotations[0]?.target).toBeUndefined();
    expect(annotations[0]?.element).toBeNull();
  });

  test('without --rects, no element field is emitted (byte-for-byte preserved)', () => {
    const t: TextStroke = {
      id: 't',
      tool: 'text',
      color: '#000',
      fontSize: 14,
      text: 'x',
      x: 80,
      y: 70,
    };
    const [a] = read(REL, strokesToSvg([t]), ['--canvas-state', 'state.json'], {
      'state.json': JSON.stringify({ artboards: [{ id: 'hero', x: 0, y: 0, w: 400, h: 300 }] }),
    }).annotations;
    expect(a && 'element' in a).toBe(false);
  });
});

describe('read-annotations / section membership + reading order', () => {
  test('members are ordered spatially (top-to-bottom, left-to-right), not by z/paint order', () => {
    // Drawn out of visual order: B (top-right) first, A (top-left) second,
    // C (bottom-left) third — so z = [B, A, C] but reading order must be
    // [A, B, C].
    const section: SectionStroke = {
      id: 'sec1',
      tool: 'section',
      x: 0,
      y: 0,
      w: 400,
      h: 400,
      label: 'Board',
      color: '#8884',
    };
    const stickyB: StickyStroke = {
      id: 'stickyB',
      tool: 'sticky',
      color: '#fce8a6',
      x: 200,
      y: 20,
      w: 120,
      h: 120,
      text: 'B',
      fontSize: 14,
    };
    const stickyA: StickyStroke = {
      id: 'stickyA',
      tool: 'sticky',
      color: '#fce8a6',
      x: 20,
      y: 20,
      w: 120,
      h: 120,
      text: 'A',
      fontSize: 14,
    };
    const stickyC: StickyStroke = {
      id: 'stickyC',
      tool: 'sticky',
      color: '#fce8a6',
      x: 20,
      y: 220,
      w: 120,
      h: 120,
      text: 'C',
      fontSize: 14,
    };
    const { annotations } = read(REL, strokesToSvg([section, stickyB, stickyA, stickyC]));
    const sec = annotations.find((a) => a.id === 'sec1');
    expect(sec?.members?.map((m) => m.id)).toEqual(['stickyA', 'stickyB', 'stickyC']);
    expect(sec?.members?.map((m) => m.order)).toEqual([0, 1, 2]);
  });

  test('image members carry their resolvable asset href', () => {
    const section: SectionStroke = {
      id: 'sec1',
      tool: 'section',
      x: 0,
      y: 0,
      w: 400,
      h: 400,
      label: 'Board',
      color: '#8884',
    };
    const img: ImageStroke = {
      id: 'img1',
      tool: 'image',
      x: 20,
      y: 20,
      w: 120,
      h: 120,
      href: 'assets/deadbeef.png',
    };
    const { annotations } = read(REL, strokesToSvg([section, img]));
    const sec = annotations.find((a) => a.id === 'sec1');
    expect(sec?.members).toEqual([
      {
        id: 'img1',
        tool: 'image',
        order: 0,
        x: 20,
        y: 20,
        w: 120,
        h: 120,
        href: 'assets/deadbeef.png',
      },
    ]);
  });

  test('a stroke outside the section rect is not a member; a section with nothing inside gets an empty array', () => {
    const section: SectionStroke = {
      id: 'sec1',
      tool: 'section',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      label: 'Board',
      color: '#8884',
    };
    const outside: StickyStroke = {
      id: 'outside',
      tool: 'sticky',
      color: '#fce8a6',
      x: 500,
      y: 500,
      w: 60,
      h: 60,
      text: 'far away',
      fontSize: 14,
    };
    const { annotations } = read(REL, strokesToSvg([section, outside]));
    const sec = annotations.find((a) => a.id === 'sec1');
    expect(sec?.members).toEqual([]);
    const other = annotations.find((a) => a.id === 'outside');
    expect(other?.members).toBeUndefined();
  });

  test('a non-section stroke never gets a members field', () => {
    const sticky: StickyStroke = {
      id: 'lone',
      tool: 'sticky',
      color: '#fce8a6',
      x: 0,
      y: 0,
      w: 60,
      h: 60,
      text: 'no section here',
      fontSize: 14,
    };
    const { annotations } = read(REL, strokesToSvg([sticky]));
    expect(annotations[0] && 'members' in annotations[0]).toBe(false);
  });
});
