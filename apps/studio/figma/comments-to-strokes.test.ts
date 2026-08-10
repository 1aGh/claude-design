// figma/comments-to-strokes.ts — the review record.
//
// Comments live on their own endpoint, nowhere in the document tree, so every
// tree-walking version of this importer brought across exactly zero of them.

import { describe, expect, test } from 'bun:test';

import { STICKY_PALETTE } from '../annotations-model.ts';
import type { FigmaComment } from './client.ts';
import { commentsToStrokes, indexNodes, MAX_COMMENT_STROKES } from './comments-to-strokes.ts';
import { ImportReport } from './sanitize.ts';
import { normalizeDocument } from './types.ts';

const KEY = 'dGNzRC2kmrmGnOxaBa0RI7';

function page() {
  const doc = normalizeDocument(
    {
      id: '0:0',
      name: 'Page',
      type: 'CANVAS',
      children: [
        {
          id: '1:2',
          name: 'Screen',
          type: 'FRAME',
          visible: true,
          absoluteBoundingBox: { x: 1000, y: 500, width: 375, height: 812 },
        },
      ],
    },
    { fileKey: KEY, surface: 'design' }
  );
  return doc.root;
}

const comment = (over: Partial<FigmaComment> = {}): FigmaComment => ({
  id: 'c1',
  message: 'Chybí',
  nodeId: '1:2',
  x: 20,
  y: 30,
  resolved: false,
  ...over,
});

const ORIGIN = { x: 1000, y: 500 };

describe('positioning', () => {
  test('a pin lands at its node position plus its offset, page-normalized', () => {
    const { strokes } = commentsToStrokes([comment()], indexNodes(page()), ORIGIN, new ImportReport());
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toMatchObject({ tool: 'sticky', x: 20, y: 30 });
  });

  test('a comment pinned to a node on another page is counted, not silently lost', () => {
    const report = new ImportReport();
    const { strokes, unplacedIds } = commentsToStrokes(
      [comment({ nodeId: '9:9' })],
      indexNodes(page()),
      ORIGIN,
      report
    );
    expect(strokes).toHaveLength(0);
    expect(unplacedIds).toHaveLength(1);
  });

  test('a canvas-level pin uses its page coordinates directly', () => {
    const { strokes } = commentsToStrokes(
      [comment({ nodeId: '0:0', x: 1100, y: 600 })],
      indexNodes(page()),
      ORIGIN,
      new ImportReport(),
      '0:0'
    );
    expect(strokes[0]).toMatchObject({ x: 100, y: 100 });
  });
});

describe('threads', () => {
  test('replies fold into their root card in time order', () => {
    const { strokes } = commentsToStrokes(
      [
        comment({ id: 'root', message: 'A/b test', author: 'maj' }),
        comment({ id: 'r2', parentId: 'root', message: 'second', createdAt: '2026-02-01' }),
        comment({ id: 'r1', parentId: 'root', message: 'first', createdAt: '2026-01-01' }),
      ],
      indexNodes(page()),
      ORIGIN,
      new ImportReport()
    );
    expect(strokes).toHaveLength(1);
    expect((strokes[0] as { text: string }).text).toBe('maj: A/b test\n↳ first\n↳ second');
  });
});

describe('resolved threads', () => {
  test('are carried on grey paper rather than dropped', () => {
    // A resolved comment is the record of a decision already made; dropping it
    // is the same silent content loss the rest of this importer keeps relearning.
    const { strokes } = commentsToStrokes(
      [comment({ resolved: true })],
      indexNodes(page()),
      ORIGIN,
      new ImportReport()
    );
    expect(strokes).toHaveLength(1);
    expect((strokes[0] as { color: string }).color).toBe(STICKY_PALETTE[2]);
    expect((strokes[0] as { text: string }).text).toStartWith('✓ ');
  });

  test('an open thread stays on the default yellow', () => {
    const { strokes } = commentsToStrokes([comment()], indexNodes(page()), ORIGIN, new ImportReport());
    expect((strokes[0] as { color: string }).color).toBe(STICKY_PALETTE[0]);
  });
});

describe('bounds', () => {
  test('message text goes through the zero-glyph strip like every other import', () => {
    const report = new ImportReport();
    // U+E0041 — Unicode Tags block, zero glyphs, a payload channel.
    const { strokes } = commentsToStrokes(
      [comment({ message: `ok\u{E0041}` })],
      indexNodes(page()),
      ORIGIN,
      report
    );
    expect((strokes[0] as { text: string }).text).toBe('ok');
    expect(report.entries.some((e) => e.disposition === 'hidden-chars-dropped')).toBe(true);
  });

  test('an empty message produces no card', () => {
    const { strokes } = commentsToStrokes(
      [comment({ message: '   ' })],
      indexNodes(page()),
      ORIGIN,
      new ImportReport()
    );
    expect(strokes).toHaveLength(0);
  });

  test('a pathological comment count is capped and reported', () => {
    const many = Array.from({ length: MAX_COMMENT_STROKES + 25 }, (_, i) =>
      comment({ id: `c${i}` })
    );
    const report = new ImportReport();
    const { strokes } = commentsToStrokes(many, indexNodes(page()), ORIGIN, report);
    expect(strokes).toHaveLength(MAX_COMMENT_STROKES);
    expect(report.entries.some((e) => e.disposition === 'asset-cap-reached')).toBe(true);
  });
});

describe('orphaned threads (the caller decides, not this module)', () => {
  test('an unplaceable thread is returned by id, NOT reported here', () => {
    // Per page, "not on this page" is the normal case — a comment lives on
    // exactly one page. Reporting it here would fire once per page and read as
    // content loss that never happened. Only the caller, which sees every page,
    // can tell an unplaced thread from a deleted-target orphan.
    const report = new ImportReport();
    const { strokes, placedIds, unplacedIds } = commentsToStrokes(
      [comment({ id: 'here' }), comment({ id: 'elsewhere', nodeId: '9:9' })],
      indexNodes(page()),
      ORIGIN,
      report
    );
    expect(strokes).toHaveLength(1);
    expect(placedIds).toEqual(['here']);
    expect(unplacedIds).toEqual(['elsewhere']);
    expect(report.entries.some((e) => e.disposition === 'comment-target-deleted')).toBe(false);
  });

  test('placedIds are raw Figma ids so the caller can intersect them', () => {
    // The stroke id is sanitized (`figc_…`); the caller reconciles across pages
    // on the RAW id, and a mismatch there would silently orphan every thread.
    const { strokes, placedIds } = commentsToStrokes(
      [comment({ id: '166-92:86' })],
      indexNodes(page()),
      ORIGIN,
      new ImportReport()
    );
    expect(placedIds).toEqual(['166-92:86']);
    expect((strokes[0] as { id: string }).id).not.toBe('166-92:86');
  });
});
