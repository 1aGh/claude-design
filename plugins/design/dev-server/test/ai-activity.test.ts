// Unit: AI activity tracker (Phase 8 Task 4).

import { describe, expect, test } from 'bun:test';

import { HEARTBEAT_GRACE_MS, createAiActivity } from '../collab/ai-activity.ts';
import { type Context, createBus } from '../context.ts';

function makeCtx(): { ctx: Context; events: { file: string; entry: unknown }[] } {
  const events: { file: string; entry: unknown }[] = [];
  const bus = createBus();
  bus.on('ai-activity', (p: { file: string; entry: unknown }) => events.push(p));
  const ctx = {
    cfg: {} as Context['cfg'],
    projectLabel: 'test',
    paths: {} as Context['paths'],
    bus,
  };
  return { ctx, events };
}

describe('AiActivity', () => {
  test('start adds an entry and emits bus event', () => {
    const { ctx, events } = makeCtx();
    const clock = 1000;
    const ai = createAiActivity(ctx, () => clock);
    const entry = ai.start('ui/Foo.tsx', 'Claude');
    expect(entry.file).toBe('ui/Foo.tsx');
    expect(entry.author).toBe('Claude');
    expect(entry.startedAt).toBe(1000);
    expect(entry.lastHeartbeat).toBe(1000);
    expect(events).toHaveLength(1);
    expect(events[0]?.entry).toBe(entry);
    ai.stop();
  });

  test('start preserves startedAt across restart for the same file', () => {
    const { ctx } = makeCtx();
    let clock = 1000;
    const ai = createAiActivity(ctx, () => clock);
    ai.start('ui/Foo.tsx', 'Claude');
    clock = 5000;
    const restarted = ai.start('ui/Foo.tsx', 'Claude');
    expect(restarted.startedAt).toBe(1000);
    expect(restarted.lastHeartbeat).toBe(5000);
    ai.stop();
  });

  test('heartbeat refreshes lastHeartbeat + emits', () => {
    const { ctx, events } = makeCtx();
    let clock = 1000;
    const ai = createAiActivity(ctx, () => clock);
    ai.start('ui/Foo.tsx', 'Claude');
    clock = 2000;
    const refreshed = ai.heartbeat('ui/Foo.tsx');
    expect(refreshed?.lastHeartbeat).toBe(2000);
    expect(refreshed?.startedAt).toBe(1000);
    // Two bus events — one for start, one for heartbeat.
    expect(events.length).toBe(2);
    ai.stop();
  });

  test('heartbeat returns null when no entry exists', () => {
    const { ctx } = makeCtx();
    const ai = createAiActivity(ctx);
    expect(ai.heartbeat('ui/Absent.tsx')).toBeNull();
    ai.stop();
  });

  test('end clears the entry and emits a null', () => {
    const { ctx, events } = makeCtx();
    const clock = 1000;
    const ai = createAiActivity(ctx, () => clock);
    ai.start('ui/Foo.tsx', 'Claude');
    const ok = ai.end('ui/Foo.tsx');
    expect(ok).toBe(true);
    expect(ai.get('ui/Foo.tsx')).toBeNull();
    const last = events.at(-1);
    expect(last?.entry).toBeNull();
    ai.stop();
  });

  test('end on absent entry returns false (no emit)', () => {
    const { ctx, events } = makeCtx();
    const ai = createAiActivity(ctx);
    expect(ai.end('ui/Absent.tsx')).toBe(false);
    expect(events.length).toBe(0);
    ai.stop();
  });

  test('list returns all live entries', () => {
    const { ctx } = makeCtx();
    const clock = 1000;
    const ai = createAiActivity(ctx, () => clock);
    ai.start('ui/Foo.tsx', 'Claude');
    ai.start('ui/Bar.tsx', 'Claude');
    expect(ai.list().length).toBe(2);
    ai.end('ui/Foo.tsx');
    expect(ai.list().length).toBe(1);
    ai.stop();
  });

  test('grace period — entry stays inside HEARTBEAT_GRACE_MS', () => {
    const { ctx } = makeCtx();
    let clock = 1000;
    const ai = createAiActivity(ctx, () => clock);
    ai.start('ui/Foo.tsx', 'Claude');
    // 29 s later — still within grace.
    clock = 1000 + HEARTBEAT_GRACE_MS - 1000;
    // We don't auto-tick the janitor in tests; just confirm entry still exists.
    expect(ai.get('ui/Foo.tsx')).not.toBeNull();
    ai.stop();
  });
});
