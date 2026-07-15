// Pure unit tests for client/panels/transcript-view.js (Task C4).

import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_TRANSCRIPT_VIEW,
  filterTranscriptParts,
  TRANSCRIPT_VIEWS,
  transcriptForcesExpand,
} from '../client/panels/transcript-view.js';

const PARTS = [
  { type: 'reasoning', text: 'let me think' },
  { type: 'tool-call', toolCallId: '1', toolName: 'Read file' },
  { type: 'text', text: 'first answer' },
  { type: 'reasoning', text: 'more thinking' },
  { type: 'text', text: 'final answer' },
];

describe('filterTranscriptParts', () => {
  test('normal hides reasoning, keeps text + tool-calls in order', () => {
    const result = filterTranscriptParts(PARTS, 'normal');
    expect(result.map((p) => p.type)).toEqual(['tool-call', 'text', 'text']);
  });

  test('thinking keeps everything, including reasoning', () => {
    expect(filterTranscriptParts(PARTS, 'thinking')).toEqual(PARTS);
  });

  test('verbose also keeps everything (the extra verbosity is a render-detail toggle)', () => {
    expect(filterTranscriptParts(PARTS, 'verbose')).toEqual(PARTS);
  });

  test('summary keeps ONLY the last text part', () => {
    const result = filterTranscriptParts(PARTS, 'summary');
    expect(result).toEqual([{ type: 'text', text: 'final answer' }]);
  });

  test('summary with no text parts at all returns empty, not a crash', () => {
    expect(filterTranscriptParts([{ type: 'tool-call', toolCallId: '1' }], 'summary')).toEqual([]);
  });

  test('an unrecognized mode fails toward normal (less noise), not everything', () => {
    expect(filterTranscriptParts(PARTS, 'nonsense')).toEqual(
      filterTranscriptParts(PARTS, 'normal')
    );
  });

  test('tolerates missing/empty input', () => {
    expect(filterTranscriptParts(undefined, 'normal')).toEqual([]);
    expect(filterTranscriptParts(null, 'thinking')).toEqual([]);
    expect(filterTranscriptParts([], 'summary')).toEqual([]);
  });
});

describe('transcriptForcesExpand', () => {
  test('only verbose forces expansion', () => {
    expect(transcriptForcesExpand('verbose')).toBe(true);
    expect(transcriptForcesExpand('normal')).toBe(false);
    expect(transcriptForcesExpand('thinking')).toBe(false);
    expect(transcriptForcesExpand('summary')).toBe(false);
    expect(transcriptForcesExpand(undefined)).toBe(false);
  });
});

describe('constants', () => {
  test('the view list + default are stable and consistent', () => {
    expect(TRANSCRIPT_VIEWS).toEqual(['normal', 'thinking', 'verbose', 'summary']);
    expect(TRANSCRIPT_VIEWS).toContain(DEFAULT_TRANSCRIPT_VIEW);
  });
});
