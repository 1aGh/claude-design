// Pure unit tests for client/panels/ToolGroup.jsx's grouping/summary helpers
// (Task C1 — collapsed consecutive-tool-call groups).

import { describe, expect, test } from 'bun:test';

import { groupToolCalls, summarizeGroup } from '../client/panels/ToolGroup.jsx';

describe('groupToolCalls', () => {
  test('a lone tool-call stays a single item, not a group', () => {
    const parts = [{ type: 'tool-call', toolCallId: '1', toolName: 'Read file' }];
    expect(groupToolCalls(parts)).toEqual([{ type: 'single', part: parts[0] }]);
  });

  test('2+ CONSECUTIVE tool-calls fold into one group', () => {
    const parts = [
      { type: 'tool-call', toolCallId: '1', toolName: 'Read file' },
      { type: 'tool-call', toolCallId: '2', toolName: 'Run command' },
      { type: 'tool-call', toolCallId: '3', toolName: 'Write file' },
    ];
    const grouped = groupToolCalls(parts);
    expect(grouped).toEqual([{ type: 'tool-group', parts }]);
  });

  test('text/reasoning parts break a run into separate groups', () => {
    const parts = [
      { type: 'tool-call', toolCallId: '1', toolName: 'Read file' },
      { type: 'tool-call', toolCallId: '2', toolName: 'Write file' },
      { type: 'text', text: 'done reading and writing' },
      { type: 'tool-call', toolCallId: '3', toolName: 'Run command' },
    ];
    const grouped = groupToolCalls(parts);
    expect(grouped).toEqual([
      { type: 'tool-group', parts: [parts[0], parts[1]] },
      { type: 'single', part: parts[2] },
      { type: 'single', part: parts[3] }, // lone tool-call after the break — not a group
    ]);
  });

  test('a mix of text and reasoning parts each stay single, in order', () => {
    const parts = [
      { type: 'text', text: 'thinking about it' },
      { type: 'reasoning', text: '...' },
      { type: 'text', text: 'here is my answer' },
    ];
    expect(groupToolCalls(parts)).toEqual(parts.map((part) => ({ type: 'single', part })));
  });

  test('tolerates an empty/missing parts array', () => {
    expect(groupToolCalls([])).toEqual([]);
    expect(groupToolCalls(undefined)).toEqual([]);
    expect(groupToolCalls(null)).toEqual([]);
  });
});

describe('summarizeGroup', () => {
  test('all entries sharing one title collapse to "Ran N × <title>"', () => {
    const parts = [
      { toolName: 'Read file' },
      { toolName: 'Read file' },
      { toolName: 'Read file' },
    ];
    expect(summarizeGroup(parts)).toBe('Ran 3 × Read file');
  });

  test('mixed titles list the distinct ones, capped at 3 with an ellipsis', () => {
    const parts = [
      { toolName: 'Read file' },
      { toolName: 'Run command' },
      { toolName: 'Web search' },
      { toolName: 'Write file' },
      { toolName: 'Read file' }, // duplicate — must not inflate the unique count
    ];
    const summary = summarizeGroup(parts);
    expect(summary).toBe('Ran 5 tools — Read file, Run command, Web search…');
  });

  test('a missing toolName falls back to the generic label, not undefined', () => {
    expect(summarizeGroup([{}, {}])).toBe('Ran 2 × tool');
  });
});
