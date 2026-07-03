// RCA issue-acp-subagent-activity-invisible — the ACP chat "still working"
// indicator must survive the premature turn-end that claude-agent-acp emits
// while background subagents are still running (adapter settles the prompt at
// the main agent's `result`, #773). These lock the pure activity reducer +
// label so a background subagent stays visible instead of the panel looking idle.

import { describe, expect, test } from 'bun:test';

import {
  activityLabel,
  applyUpdate,
  isSubagentTool,
  reduceActivity,
} from '../client/panels/acp-runtime.js';

const call = (id: string, toolName?: string, over: Record<string, unknown> = {}) => ({
  t: 'update' as const,
  update: {
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: over.title,
    kind: over.kind,
    ...(toolName ? { _meta: { claudeCode: { toolName } } } : {}),
  },
});
const done = (id: string, status = 'completed') => ({
  t: 'update' as const,
  update: { sessionUpdate: 'tool_call_update', toolCallId: id, status },
});

describe('reduceActivity', () => {
  test('a Task tool_call survives turn-end — the background subagent stays tracked', () => {
    const m = new Map();
    expect(
      reduceActivity(m, call('t1', 'Task', { title: 'map the acp module', kind: 'think' }))
    ).toBe(true);
    expect(m.size).toBe(1);

    // The regression this fix exists for: turn-end must NOT wipe the map.
    expect(reduceActivity(m, { t: 'turn-end', stopReason: 'end_turn' })).toBe(false);
    expect(m.size).toBe(1);

    // …it drains on the subagent's OWN completed update, not on turn-end.
    expect(reduceActivity(m, done('t1'))).toBe(true);
    expect(m.size).toBe(0);
  });

  test('a hard error still wipes the map (teardown)', () => {
    const m = new Map();
    reduceActivity(m, call('t1', 'Read', { kind: 'read' }));
    expect(reduceActivity(m, { t: 'error', message: 'boom' })).toBe(true);
    expect(m.size).toBe(0);
  });

  test('captures the concrete tool name for subagent classification', () => {
    const m = new Map();
    reduceActivity(m, call('t1', 'Task', { title: 'x', kind: 'think' }));
    reduceActivity(m, call('t2', 'Read', { title: 'foo.ts', kind: 'read' }));
    const tools = [...m.values()];
    expect(isSubagentTool(tools[0])).toBe(true);
    expect(isSubagentTool(tools[1])).toBe(false);
  });

  test('failed updates remove the tool; unknown ids are a no-op', () => {
    const m = new Map();
    reduceActivity(m, call('t1', 'Bash', { kind: 'execute' }));
    expect(reduceActivity(m, done('nope'))).toBe(false);
    expect(reduceActivity(m, done('t1', 'failed'))).toBe(true);
    expect(m.size).toBe(0);
  });
});

describe('activityLabel', () => {
  test('subagents get explicit, counted wording', () => {
    expect(activityLabel([{ toolName: 'Task', title: 'a' }])).toBe('1 subagent running');
    expect(activityLabel([{ toolName: 'Task' }, { toolName: 'Agent' }])).toBe(
      '2 subagents running'
    );
  });

  test('non-subagent tools fall back to title / count / Working…', () => {
    expect(activityLabel([{ title: 'Edit foo.ts' }])).toBe('Edit foo.ts');
    expect(activityLabel([{ title: 'a' }, { title: 'b' }])).toBe('2 tasks running');
    expect(activityLabel([])).toBe('Working…');
  });
});

// The F2 fix: the SAME reducer folds live-turn frames AND the post-turn-end
// "background continuation" frames the client used to drop. If this drifts, the
// dropped subagent results / consolidation render wrong (or not at all).
describe('applyUpdate (shared part reducer)', () => {
  const chunk = (text: string) => ({
    sessionUpdate: 'agent_message_chunk',
    content: { type: 'text', text },
  });
  const call = (id: string, title: string, kind: string, rawInput: unknown = {}) => ({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title,
    kind,
    rawInput,
  });
  const upd = (id: string, status: string, rawOutput: unknown) => ({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status,
    rawOutput,
  });

  test('coalesces consecutive text chunks into one part', () => {
    const parts: unknown[] = [];
    const ti = new Map();
    applyUpdate(parts, ti, chunk('Panel: '));
    applyUpdate(parts, ti, chunk('9 blockers'));
    expect(parts).toEqual([{ type: 'text', text: 'Panel: 9 blockers' }]);
  });

  test('tool_call adds a pending part; tool_call_update fills the result', () => {
    const parts: Array<Record<string, unknown>> = [];
    const ti = new Map();
    applyUpdate(parts, ti, call('t1', 'Write critique/001.md', 'edit', { path: 'x' }));
    expect(parts[0]).toMatchObject({ type: 'tool-call', toolName: 'Write critique/001.md' });
    expect(parts[0].result).toBeUndefined();
    applyUpdate(parts, ti, upd('t1', 'completed', { ok: true }));
    expect(parts[0]).toMatchObject({ result: { ok: true }, isError: false });
  });

  test('failed update marks isError', () => {
    const parts: Array<Record<string, unknown>> = [];
    const ti = new Map();
    applyUpdate(parts, ti, call('t1', 'Bash', 'execute'));
    applyUpdate(parts, ti, upd('t1', 'failed', null));
    expect(parts[0].isError).toBe(true);
  });

  test('thought → reasoning part; usage/plan ignored', () => {
    const parts: unknown[] = [];
    const ti = new Map();
    applyUpdate(parts, ti, {
      sessionUpdate: 'agent_thought_chunk',
      content: { type: 'text', text: 'hmm' },
    });
    applyUpdate(parts, ti, { sessionUpdate: 'usage_update' });
    applyUpdate(parts, ti, { sessionUpdate: 'plan' });
    expect(parts).toEqual([{ type: 'reasoning', text: 'hmm' }]);
  });

  test('update for an unknown tool id is a no-op', () => {
    const parts: unknown[] = [];
    const ti = new Map();
    applyUpdate(parts, ti, upd('nope', 'completed', {}));
    expect(parts).toEqual([]);
  });
});
