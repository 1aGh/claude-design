// RC5 (rca/issue-canvas-hmr-optimistic-update-consistency) — the ACP chat agent
// must raise the same "Claude is editing" ai-activity banner as /design:edit.
// The tracker watches streamed tool_call / tool_call_update notifications for
// edit-kind tools touching canvas files and drives start/heartbeat/end.

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { SessionUpdate } from '@agentclientprotocol/sdk';

import { createAgentActivityTracker } from '../acp/index.ts';
import type { AiActivity, AiActivityEntry } from '../collab/ai-activity.ts';
import { type Context, createBus } from '../context.ts';

const ROOT = join('/tmp', 'acp-ai-root');
const DESIGN = join(ROOT, '.design');

function mkCtx(): Context {
  return {
    cfg: {} as Context['cfg'],
    projectLabel: 'test',
    bus: createBus(),
    paths: {
      repoRoot: ROOT,
      designRel: '.design',
      designRoot: DESIGN,
      serverInfoFile: join(DESIGN, '_server.json'),
      activeFile: join(DESIGN, '_active.json'),
      commentsDir: join(DESIGN, '_comments'),
      canvasStateDir: join(DESIGN, '_canvas-state'),
      historyDir: join(DESIGN, '_history'),
      tokensUrlRel: '',
      systemDirRel: 'system',
    },
  };
}

function mkAi(): { ai: AiActivity; calls: string[] } {
  const calls: string[] = [];
  const entry = (file: string): AiActivityEntry => ({
    file,
    author: 'x',
    startedAt: 0,
    lastHeartbeat: 0,
  });
  const ai: AiActivity = {
    start(file, author) {
      calls.push(`start:${file}:${author}`);
      return entry(file);
    },
    heartbeat(file) {
      calls.push(`beat:${file}`);
      return entry(file);
    },
    end(file) {
      calls.push(`end:${file}`);
      return true;
    },
    list: () => [],
    get: () => null,
    stop: () => {},
  };
  return { ai, calls };
}

const upd = (u: Record<string, unknown>): SessionUpdate => u as unknown as SessionUpdate;

describe('acp / agent activity tracker', () => {
  test('edit tool_call on a canvas starts ai-activity with the designRel key', () => {
    const { ai, calls } = mkAi();
    const t = createAgentActivityTracker(mkCtx(), ai);
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        kind: 'edit',
        locations: [{ path: join(DESIGN, 'ui', 'Foo.tsx') }],
      })
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toStartWith('start:.design/ui/Foo.tsx:');
  });

  test('follow-up update for the same file inside the beat throttle adds nothing', () => {
    const { ai, calls } = mkAi();
    const t = createAgentActivityTracker(mkCtx(), ai);
    const loc = { locations: [{ path: join(DESIGN, 'ui', 'Foo.tsx') }] };
    t.onUpdate(upd({ sessionUpdate: 'tool_call', toolCallId: 't1', kind: 'edit', ...loc }));
    // kind omitted on the update — must be recalled from the tool_call by id.
    t.onUpdate(upd({ sessionUpdate: 'tool_call_update', toolCallId: 't1', ...loc }));
    expect(calls).toHaveLength(1);
  });

  test('read/search tools and non-canvas paths never banner', () => {
    const { ai, calls } = mkAi();
    const t = createAgentActivityTracker(mkCtx(), ai);
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 'r1',
        kind: 'read',
        locations: [{ path: join(DESIGN, 'ui', 'Foo.tsx') }],
      })
    );
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 'e2',
        kind: 'edit',
        locations: [{ path: join(ROOT, 'src', 'App.tsx') }], // outside designRoot
      })
    );
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 'e3',
        kind: 'edit',
        locations: [{ path: join(DESIGN, '_history', 'x', 'Foo.tsx') }], // runtime state
      })
    );
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 'e4',
        kind: 'edit',
        locations: [{ path: join(DESIGN, 'ui', 'Foo.meta.json') }], // not a canvas
      })
    );
    expect(calls).toEqual([]);
  });

  test('rawInput.file_path works when locations are absent', () => {
    const { ai, calls } = mkAi();
    const t = createAgentActivityTracker(mkCtx(), ai);
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 'w1',
        kind: 'edit',
        rawInput: { file_path: join(DESIGN, 'ui', 'Bar.tsx') },
      })
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toStartWith('start:.design/ui/Bar.tsx:');
  });

  test('endTurn ends every banner this turn raised', () => {
    const { ai, calls } = mkAi();
    const t = createAgentActivityTracker(mkCtx(), ai);
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 't1',
        kind: 'edit',
        locations: [{ path: join(DESIGN, 'ui', 'Foo.tsx') }],
      })
    );
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 't2',
        kind: 'edit',
        locations: [{ path: join(DESIGN, 'ui', 'Bar.tsx') }],
      })
    );
    t.endTurn();
    expect(calls.filter((c) => c.startsWith('end:'))).toEqual([
      'end:.design/ui/Foo.tsx',
      'end:.design/ui/Bar.tsx',
    ]);
    // A later turn on the same file must start (not silently beat) again.
    t.onUpdate(
      upd({
        sessionUpdate: 'tool_call',
        toolCallId: 't3',
        kind: 'edit',
        locations: [{ path: join(DESIGN, 'ui', 'Foo.tsx') }],
      })
    );
    expect(calls.filter((c) => c.startsWith('start:'))).toHaveLength(3);
  });
});
