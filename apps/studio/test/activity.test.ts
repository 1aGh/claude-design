// activity — Phase 13. fs:any → per-file active|idle tracker + region diff.

import { describe, expect, test } from 'bun:test';

import { type ActivityChange, createActivity, diffArtboardIds, isCanvasFile } from '../activity.ts';
import { type Context, createBus } from '../context.ts';

function mkCtx(): Context {
  const bus = createBus();
  return {
    cfg: {} as Context['cfg'],
    projectLabel: '',
    // No designRoot → refineArtboards() short-circuits; transition tests stay
    // fs-free. The diff is exercised directly via diffArtboardIds() below.
    paths: {} as Context['paths'],
    bus,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('activity / isCanvasFile', () => {
  test('accepts .tsx + .html canvases under ui/', () => {
    expect(isCanvasFile('ui/Smoke TSX.tsx')).toBe(true);
    expect(isCanvasFile('ui/legacy.html')).toBe(true);
    expect(isCanvasFile('ui/components/Card.tsx')).toBe(true);
  });

  test('rejects non-canvas extensions', () => {
    expect(isCanvasFile('ui/Smoke.css')).toBe(false);
    expect(isCanvasFile('_locator.json')).toBe(false);
    expect(isCanvasFile('ui/shot.png')).toBe(false);
  });

  test('rejects _-prefixed files + dirs (runtime artifacts, history, draw, smoke)', () => {
    expect(isCanvasFile('_active.json')).toBe(false);
    expect(isCanvasFile('_history/ui/Smoke TSX/0001.tsx')).toBe(false);
    expect(isCanvasFile('_draw/logo.proof.tsx')).toBe(false);
    expect(isCanvasFile('_history/snap.html')).toBe(false);
  });

  test('rejects SKIP_DIRS segments', () => {
    expect(isCanvasFile('node_modules/react/index.tsx')).toBe(false);
    expect(isCanvasFile('dist/runtime/x.tsx')).toBe(false);
    expect(isCanvasFile('ui/build/out.tsx')).toBe(false);
  });

  test('rejects DS preview specimens (false-positive guard)', () => {
    expect(isCanvasFile('system/aurora/preview/motion.html')).toBe(false);
    expect(isCanvasFile('system/aurora/preview/motion.tsx')).toBe(false);
    // but a real canvas elsewhere under system/ is fine
    expect(isCanvasFile('system/aurora/showcase.tsx')).toBe(true);
  });

  test('normalizes back-slash + leading slash', () => {
    expect(isCanvasFile('\\ui\\Smoke.tsx')).toBe(true);
    expect(isCanvasFile('/ui/Smoke.tsx')).toBe(true);
    expect(isCanvasFile('')).toBe(false);
  });
});

describe('activity / transitions', () => {
  test('idle → active on first canvas fs:any event', () => {
    const ctx = mkCtx();
    const seen: ActivityChange[] = [];
    ctx.bus.on('activity:change', (c) => seen.push(c));
    const act = createActivity(ctx, { idleMs: 40, diff: false });

    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    expect(act.state['ui/Smoke.tsx']?.status).toBe('active');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ file: 'ui/Smoke.tsx', status: 'active', artboard_ids: null });
    act.stop();
  });

  test('non-canvas fs:any events are ignored', () => {
    const ctx = mkCtx();
    const seen: ActivityChange[] = [];
    ctx.bus.on('activity:change', (c) => seen.push(c));
    const act = createActivity(ctx, { idleMs: 40, diff: false });

    ctx.bus.emit('fs:any', 'ui/Smoke.css');
    ctx.bus.emit('fs:any', '_active.json');
    ctx.bus.emit('fs:any', 'system/x/preview/motion.tsx');
    expect(seen).toHaveLength(0);
    expect(act.state['ui/Smoke.css']).toBeUndefined();
    act.stop();
  });

  test('active → active: rapid events keep the file active past one idle window', async () => {
    const ctx = mkCtx();
    const act = createActivity(ctx, { idleMs: 60, diff: false });

    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    await sleep(40);
    ctx.bus.emit('fs:any', 'ui/Smoke.tsx'); // refresh before the 60 ms idle fires
    await sleep(40); // 80 ms since first event, but only 40 ms since the refresh
    expect(act.state['ui/Smoke.tsx']?.status).toBe('active');
    act.stop();
  });

  test('active → idle after idleMs of silence, and emits the idle change', async () => {
    const ctx = mkCtx();
    const seen: ActivityChange[] = [];
    ctx.bus.on('activity:change', (c) => seen.push(c));
    const act = createActivity(ctx, { idleMs: 40, diff: false });

    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    await sleep(80);
    expect(act.state['ui/Smoke.tsx']?.status).toBe('idle');
    const last = seen[seen.length - 1];
    expect(last).toMatchObject({ file: 'ui/Smoke.tsx', status: 'idle' });
    act.stop();
  });

  test('mark() test seam marks active without the bus', () => {
    const ctx = mkCtx();
    const seen: ActivityChange[] = [];
    ctx.bus.on('activity:change', (c) => seen.push(c));
    const act = createActivity(ctx, { idleMs: 40, diff: false });

    act.mark('ui/Manual.tsx');
    expect(act.state['ui/Manual.tsx']?.status).toBe('active');
    expect(seen[0]?.file).toBe('ui/Manual.tsx');
    act.stop();
  });

  test('stop() halts the idle timer (no idle emit after stop)', async () => {
    const ctx = mkCtx();
    const seen: ActivityChange[] = [];
    ctx.bus.on('activity:change', (c) => seen.push(c));
    const act = createActivity(ctx, { idleMs: 40, diff: false });

    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    act.stop();
    await sleep(80);
    expect(seen.filter((c) => c.status === 'idle')).toHaveLength(0);
    // stop() also detaches the bus subscription.
    ctx.bus.emit('fs:any', 'ui/Other.tsx');
    expect(act.state['ui/Other.tsx']).toBeUndefined();
  });
});

describe('activity / diffArtboardIds (Task 7)', () => {
  const wrap = (primaryBody: string, secondaryBody: string) =>
    `import { DesignCanvas, DCArtboard } from '@maude/canvas-lib';
export default function C() {
  return (
    <DesignCanvas>
      <DCArtboard id="primary" label="Primary" width={400} height={300}>${primaryBody}</DCArtboard>
      <DCArtboard id="secondary" label="Secondary" width={400} height={300}>${secondaryBody}</DCArtboard>
    </DesignCanvas>
  );
}`;

  test('change confined to one artboard → that id only', () => {
    const prev = wrap('<p>A</p>', '<p>B</p>');
    const next = wrap('<p>A</p>', '<p>B changed</p>');
    expect(diffArtboardIds(prev, next)).toEqual(['secondary']);
  });

  test('change in both artboards → both ids', () => {
    const prev = wrap('<p>A</p>', '<p>B</p>');
    const next = wrap('<p>A2</p>', '<p>B2</p>');
    expect(diffArtboardIds(prev, next)?.sort()).toEqual(['primary', 'secondary']);
  });

  test('identical content → null (no region changed)', () => {
    const src = wrap('<p>A</p>', '<p>B</p>');
    expect(diffArtboardIds(src, src)).toBeNull();
  });

  test('change outside any artboard body → null (file-level fallback)', () => {
    const prev = wrap('<p>A</p>', '<p>B</p>');
    // Added an import line outside any DCArtboard → skeleton differs.
    const next = `import x from 'y';\n${wrap('<p>A</p>', '<p>B</p>')}`;
    expect(diffArtboardIds(prev, next)).toBeNull();
  });

  test('no DCArtboard markers → null (ambiguous)', () => {
    expect(diffArtboardIds('<div>old</div>', '<div>new</div>')).toBeNull();
  });

  test('artboard added/removed → null (shell differs)', () => {
    const prev = wrap('<p>A</p>', '<p>B</p>');
    const next = `${wrap('<p>A</p>', '<p>B</p>')}\n// trailing <DCArtboard id="third" label="T" width={1} height={1}>x</DCArtboard>`;
    expect(diffArtboardIds(prev, next)).toBeNull();
  });
});
