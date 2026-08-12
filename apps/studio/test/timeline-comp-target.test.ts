// timeline-comp-target — issue #75 regression coverage.
//
// The Timeline draws the rows of ONE artboard's comp but drives the transport
// through a targeted postMessage, so "which comp id" is a real decision. The
// old rule matched the parsed row total against `durationInFrames`; two comps
// of equal length collapsed onto the FIRST one, so Play moved artboard #1 while
// the panel showed artboard #2. These tests pin the artboard-first rule.

import { describe, expect, test } from 'bun:test';

import {
  activeComp,
  resolveCompTarget,
  sanitizeArtboardText,
} from '../client/panels/timeline-comp-target.js';

const comp = (id: string, artboardId: string | null, durationInFrames: number) => ({
  id,
  artboardId,
  durationInFrames,
  fps: 30,
  width: 1920,
  height: 1080,
  artboardLabel: artboardId,
});

describe('resolveCompTarget', () => {
  test('empty / missing comps → null', () => {
    expect(resolveCompTarget([], { artboardId: 'a' })).toBe(null);
    // @ts-expect-error — defensive: the shell hands through canvas-origin data.
    expect(resolveCompTarget(null, {})).toBe(null);
  });

  test('THE BUG — equal-duration comps resolve by artboard, not by order', () => {
    const comps = [comp('videocomp-1', 'intro', 150), comp('videocomp-2', 'outro', 150)];
    expect(resolveCompTarget(comps, { artboardId: 'outro', total: 150 })).toBe('videocomp-2');
    expect(resolveCompTarget(comps, { artboardId: 'intro', total: 150 })).toBe('videocomp-1');
  });

  test('an author-set comp id equal to the artboard id also matches', () => {
    const comps = [comp('intro', null, 150), comp('outro', null, 150)];
    expect(resolveCompTarget(comps, { artboardId: 'outro', total: 150 })).toBe('outro');
  });

  test('no artboard known → an UNAMBIGUOUS duration still identifies the comp', () => {
    const comps = [comp('videocomp-1', 'intro', 150), comp('videocomp-2', 'outro', 90)];
    expect(resolveCompTarget(comps, { artboardId: null, total: 90 })).toBe('videocomp-2');
  });

  test('no artboard known + ambiguous duration → first comp (the only guess left)', () => {
    const comps = [comp('videocomp-1', 'intro', 150), comp('videocomp-2', 'outro', 150)];
    expect(resolveCompTarget(comps, { artboardId: null, total: 150 })).toBe('videocomp-1');
  });

  // Adversarial review 2026-08-12 — comp ids and artboard ids are separate
  // author-chosen namespaces, so the weaker claim must never beat the real one.
  test('an announced artboard OUTRANKS a comp that merely names itself after it', () => {
    const comps = [comp('outro', 'intro', 150), comp('videocomp-2', 'outro', 150)];
    expect(resolveCompTarget(comps, { artboardId: 'outro', total: 150 })).toBe('videocomp-2');
  });

  // The row parser derives the artboard lexically from the .tsx; canvas-lib
  // reports the viewport one structurally. When the lexical claim names an
  // artboard no comp is mounted in, the pan signal must still land the target.
  test('candidate list — a stale first candidate falls through to the live one', () => {
    const comps = [comp('videocomp-1', 'intro', 150), comp('videocomp-2', 'outro', 150)];
    expect(resolveCompTarget(comps, { artboardId: ['ghost', 'outro'], total: 150 })).toBe(
      'videocomp-2'
    );
    // First candidate wins whenever it DOES name a mounted comp.
    expect(resolveCompTarget(comps, { artboardId: ['intro', 'outro'], total: 150 })).toBe(
      'videocomp-1'
    );
    expect(resolveCompTarget(comps, { artboardId: [null, undefined, 'outro'] })).toBe(
      'videocomp-2'
    );
  });

  test('an artboard with no comp falls back rather than returning null', () => {
    const comps = [comp('videocomp-1', 'intro', 150)];
    expect(resolveCompTarget(comps, { artboardId: 'a-still-image-board', total: 150 })).toBe(
      'videocomp-1'
    );
  });
});

// The artboard label is untrusted canvas-origin text rendered as shell chrome
// (security-review 2026-08-12): a chip that can be made to read as a different
// artboard than the transport is scoped to defeats its own purpose.
describe('sanitizeArtboardText', () => {
  test('strips bidi overrides + isolates', () => {
    expect(sanitizeArtboardText('Intro\u202e')).toBe('Intro');
    expect(sanitizeArtboardText('\u2066Outro\u2069')).toBe('Outro');
    expect(sanitizeArtboardText('gnp\u202egpj.Hero')).toBe('gnpgpj.Hero');
  });

  test('strips zero-width, soft hyphen, BOM and C0/C1 controls', () => {
    expect(sanitizeArtboardText('In\u200btro')).toBe('Intro');
    expect(sanitizeArtboardText('\ufeffHero\u00ad')).toBe('Hero');
    expect(sanitizeArtboardText('Line\nBreak\tTab')).toBe('LineBreakTab');
    expect(sanitizeArtboardText('Bell\u0007')).toBe('Bell');
  });

  test('an all-invisible label reads as NO label, not as a blank chip', () => {
    expect(sanitizeArtboardText('\u200b\u200b\u200b')).toBe(null);
    expect(sanitizeArtboardText('   ')).toBe(null);
    expect(sanitizeArtboardText('')).toBe(null);
  });

  test('non-strings are null, never coerced', () => {
    expect(sanitizeArtboardText(undefined)).toBe(null);
    expect(sanitizeArtboardText(null)).toBe(null);
    expect(sanitizeArtboardText(42)).toBe(null);
    expect(sanitizeArtboardText({ toString: () => 'nope' })).toBe(null);
  });

  test('caps length, and a cap that lands mid-space still trims', () => {
    expect(sanitizeArtboardText('x'.repeat(500))).toHaveLength(120);
    expect(sanitizeArtboardText(`${'x'.repeat(119)} yz`)).toBe('x'.repeat(119));
  });

  test('ordinary labels survive intact (accents, emoji, punctuation)', () => {
    expect(sanitizeArtboardText('Přehled — 2. krok')).toBe('Přehled — 2. krok');
    expect(sanitizeArtboardText('Hero 🎬')).toBe('Hero 🎬');
  });
});

describe('activeComp', () => {
  test('reads meta off the SAME comp the transport targets', () => {
    const comps = [comp('videocomp-1', 'intro', 150), comp('videocomp-2', 'outro', 90)];
    expect(activeComp(comps, 'videocomp-2')?.durationInFrames).toBe(90);
  });

  test('unknown id → first comp (panel still renders); empty → null', () => {
    const comps = [comp('videocomp-1', 'intro', 150)];
    expect(activeComp(comps, 'nope')?.id).toBe('videocomp-1');
    expect(activeComp([], 'x')).toBe(null);
  });
});
