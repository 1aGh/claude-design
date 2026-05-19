// hmr-broadcast — Phase 3.6.1 Task 8. fs:any → canvas-hmr WS message classifier.

import { describe, expect, test } from 'bun:test';

import { type Context, createBus } from '../context.ts';
import { HMR_DEBOUNCE_MS, type HmrMessage, createHmrBroadcaster } from '../hmr-broadcast.ts';

function mkCtx(): Context {
  const bus = createBus();
  return {
    cfg: {} as Context['cfg'],
    projectLabel: '',
    paths: {} as Context['paths'],
    bus,
  };
}

async function awaitNextFlush(): Promise<void> {
  await new Promise((r) => setTimeout(r, HMR_DEBOUNCE_MS + 20));
}

describe('hmr-broadcast / classification', () => {
  test('.tsx → mode: module', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    ctx.bus.emit('fs:any', 'ui/Docs Site.tsx');
    await awaitNextFlush();
    expect(got).toHaveLength(1);
    expect(got[0]?.mode).toBe('module');
    expect(got[0]?.file).toBe('ui/Docs Site.tsx');
    expect(got[0]?.scope).toBe('canvas');
    h.stop();
  });

  test('.css → mode: css', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    ctx.bus.emit('fs:any', 'ui/Docs Site.css');
    await awaitNextFlush();
    expect(got[0]?.mode).toBe('css');
    h.stop();
  });

  test('_lib/* → mode: hard, scope: lib', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    ctx.bus.emit('fs:any', '_lib/canvas-lib.tsx');
    await awaitNextFlush();
    expect(got[0]?.mode).toBe('hard');
    expect(got[0]?.scope).toBe('lib');
    h.stop();
  });

  test('unrelated extensions are dropped', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    ctx.bus.emit('fs:any', 'ui/screenshot.png');
    ctx.bus.emit('fs:any', '_locator.json');
    await awaitNextFlush();
    expect(got).toHaveLength(0);
    h.stop();
  });
});

describe('hmr-broadcast / debouncing', () => {
  test('two rapid events collapse to one message', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    await awaitNextFlush();
    expect(got).toHaveLength(1);
    h.stop();
  });

  test('coalescing prefers hard > module > css', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    // Burst of mixed events; final classification should be the strongest
    // (hard, from the _lib change).
    ctx.bus.emit('fs:any', 'ui/Smoke.css');
    ctx.bus.emit('fs:any', 'ui/Smoke.tsx');
    ctx.bus.emit('fs:any', '_lib/canvas-lib.tsx');
    await awaitNextFlush();
    expect(got).toHaveLength(1);
    expect(got[0]?.mode).toBe('hard');
    h.stop();
  });
});

describe('hmr-broadcast / stop', () => {
  test('stop() prevents further broadcasts', async () => {
    const ctx = mkCtx();
    const got: HmrMessage[] = [];
    const h = createHmrBroadcaster(ctx, (m) => got.push(m));
    h.stop();
    ctx.bus.emit('fs:any', 'ui/X.tsx');
    await awaitNextFlush();
    expect(got).toHaveLength(0);
  });
});
