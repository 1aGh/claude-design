// video-comp — DDR-148 seek-bridge unit coverage.
//
// The Remotion Player's actual frame render needs a real browser (rAF, layout,
// media) — that determinism ("two seeks to frame N → identical pixels") is an
// agent-browser live check (Task 11). What IS pure + testable here is the seek
// BRIDGE the capture spine + Timeline panel drive: the comp registry, the
// clamped seek routing to each Player, and the serializable snapshot. We stand
// up happy-dom, install the bridge without mounting a Player, register a fake
// Player handle (a seekTo/pause spy), and assert the routing contract.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import { installMaudeSeekBridge } from '../video-comp.tsx';

interface FakePlayer {
  seekTo: (frame: number) => void;
  pause: () => void;
  seeks: number[];
  pauses: number;
}

interface SeekWindow {
  __maudeVideoComps?: Map<
    string,
    {
      id: string;
      fps: number;
      durationInFrames: number;
      width: number;
      height: number;
      ref: { current: FakePlayer | null };
    }
  >;
  __maude_seek__?: (frame: number, opts?: { fps?: number }) => Promise<void>;
  __maude_comps__?: () => Array<{
    id: string;
    fps: number;
    durationInFrames: number;
    width: number;
    height: number;
  }>;
}

function makeFakePlayer(): FakePlayer {
  const p: FakePlayer = {
    seeks: [],
    pauses: 0,
    seekTo(frame) {
      p.seeks.push(frame);
    },
    pause() {
      p.pauses += 1;
    },
  };
  return p;
}

function registerComp(
  id: string,
  meta: { fps: number; durationInFrames: number; width: number; height: number },
  player: FakePlayer
): void {
  const w = window as unknown as SeekWindow;
  if (!w.__maudeVideoComps) w.__maudeVideoComps = new Map();
  w.__maudeVideoComps.set(id, { id, ...meta, ref: { current: player } });
}

beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  const w = window as unknown as SeekWindow;
  w.__maudeVideoComps = undefined;
  w.__maude_seek__ = undefined;
  w.__maude_comps__ = undefined;
});

describe('video-comp seek bridge', () => {
  test('installs window.__maude_seek__ + __maude_comps__ idempotently', () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    const seek1 = w.__maude_seek__;
    const comps1 = w.__maude_comps__;
    expect(typeof seek1).toBe('function');
    expect(typeof comps1).toBe('function');
    installMaudeSeekBridge();
    // Second install must NOT replace the functions (idempotent).
    expect(w.__maude_seek__).toBe(seek1);
    expect(w.__maude_comps__).toBe(comps1);
  });

  test('__maude_comps__ reflects the live registry (serializable, no functions)', () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    registerComp(
      'intro',
      { fps: 30, durationInFrames: 90, width: 640, height: 360 },
      makeFakePlayer()
    );
    const comps = w.__maude_comps__?.() ?? [];
    expect(comps).toHaveLength(1);
    expect(comps[0]).toEqual({
      id: 'intro',
      fps: 30,
      durationInFrames: 90,
      width: 640,
      height: 360,
    });
    // No ref/functions leak into the snapshot.
    expect(Object.keys(comps[0])).not.toContain('ref');
  });

  test('seek routes to every registered Player, paused first', async () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    const a = makeFakePlayer();
    const b = makeFakePlayer();
    registerComp('a', { fps: 30, durationInFrames: 90, width: 640, height: 360 }, a);
    registerComp('b', { fps: 24, durationInFrames: 48, width: 320, height: 240 }, b);
    await w.__maude_seek__?.(30);
    expect(a.seeks).toEqual([30]);
    expect(b.seeks).toEqual([30]);
    expect(a.pauses).toBe(1);
    expect(b.pauses).toBe(1);
  });

  test('seek clamps into [0, durationInFrames-1] per comp + rounds', async () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    const a = makeFakePlayer();
    registerComp('a', { fps: 30, durationInFrames: 90, width: 640, height: 360 }, a);
    await w.__maude_seek__?.(999); // past the end → clamp to 89
    await w.__maude_seek__?.(-5); // before the start → clamp to 0
    await w.__maude_seek__?.(12.6); // fractional → round to 13
    expect(a.seeks).toEqual([89, 0, 13]);
  });

  test('two seeks to the same frame issue identical Player calls (determinism contract)', async () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    const a = makeFakePlayer();
    registerComp('a', { fps: 30, durationInFrames: 90, width: 640, height: 360 }, a);
    await w.__maude_seek__?.(42);
    await w.__maude_seek__?.(42);
    expect(a.seeks).toEqual([42, 42]);
  });

  test('a Player ref that is not yet ready (null) does not throw', async () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    if (!w.__maudeVideoComps) w.__maudeVideoComps = new Map();
    w.__maudeVideoComps.set('pending', {
      id: 'pending',
      fps: 30,
      durationInFrames: 90,
      width: 640,
      height: 360,
      ref: { current: null },
    });
    await expect(w.__maude_seek__?.(10)).resolves.toBeUndefined();
  });
});
