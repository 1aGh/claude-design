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

import { findArtboardOf, installMaudeSeekBridge } from '../video-comp.tsx';

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
      // issue #75 — always present in the snapshot (null when the comp was
      // registered outside an artboard), so the shell can key the transport
      // target on artboard identity instead of guessing from duration.
      artboardId: null,
      artboardLabel: null,
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

  test('a not-yet-ready Player is resilient in UI mode but still RECORDED', async () => {
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
    // A live scrub of a still-mounting comp must not blow up the UI...
    const before = w.__maude_seek_failures__ ?? 0;
    await expect(w.__maude_seek__?.(10)).resolves.toBeUndefined();
    // ...but it is no longer silent: the capture shim reads this counter and
    // refuses to encode, because a seek that never landed means a stale frame.
    expect(w.__maude_seek_failures__ ?? 0).toBeGreaterThan(before);
  });

  test('capture mode (strict) throws instead of pretending the seek landed', async () => {
    const w = window as unknown as SeekWindow;
    installMaudeSeekBridge();
    if (!w.__maudeVideoComps) w.__maudeVideoComps = new Map();
    w.__maudeVideoComps.set('pending-strict', {
      id: 'pending-strict',
      fps: 30,
      durationInFrames: 90,
      width: 640,
      height: 360,
      ref: { current: null },
    });
    await expect(w.__maude_seek__?.(10, { strict: true })).rejects.toThrow(
      /refusing to report a seek that did not happen/
    );
  });
});

// issue #75 — a comp's own id is a mount slug (`videocomp-N`) unless the author
// set one, so the shell can only tell two comps apart by the artboard they are
// mounted in. This is the resolution that puts that id on the wire.
describe('findArtboardOf', () => {
  test('resolves the enclosing artboard id + visible label', () => {
    document.body.innerHTML = `
      <article data-dc-screen="outro">
        <button class="dc-artboard-label sku"><span aria-hidden="true"></span>Outro</button>
        <div class="dc-artboard-body"><div class="dc-video-comp" data-comp-id="videocomp-2"></div></div>
      </article>`;
    const host = document.querySelector('.dc-video-comp');
    expect(findArtboardOf(host)).toEqual({ artboardId: 'outro', artboardLabel: 'Outro' });
  });

  test('a comp mounted outside any artboard reports nulls, never throws', () => {
    document.body.innerHTML = '<div class="dc-video-comp" data-comp-id="bare"></div>';
    expect(findArtboardOf(document.querySelector('.dc-video-comp'))).toEqual({
      artboardId: null,
      artboardLabel: null,
    });
    expect(findArtboardOf(null)).toEqual({ artboardId: null, artboardLabel: null });
  });

  // Adversarial review 2026-08-12 — `.dc-artboard-label` is a class anyone can
  // write, so the label must come from the element canvas-lib actually renders
  // (a DIRECT header/button child), not from the first match anywhere below.
  test('a planted label node cannot outrank the real header', () => {
    document.body.innerHTML = `
      <article data-dc-screen="intro">
        <span class="dc-artboard-label" hidden>Outro</span>
        <header class="dc-artboard-label sku">Intro</header>
        <div class="dc-artboard-body"><div class="dc-video-comp"></div></div>
      </article>`;
    expect(findArtboardOf(document.querySelector('.dc-video-comp')).artboardLabel).toBe('Intro');
  });

  test('a nested artboard resolves to the NEAREST board, not the outer label', () => {
    document.body.innerHTML = `
      <article data-dc-screen="outer">
        <header class="dc-artboard-label sku">Outer</header>
        <article data-dc-screen="inner">
          <header class="dc-artboard-label sku">Inner</header>
          <div class="dc-video-comp"></div>
        </article>
      </article>`;
    expect(findArtboardOf(document.querySelector('.dc-video-comp'))).toEqual({
      artboardId: 'inner',
      artboardLabel: 'Inner',
    });
  });

  test('a label deep in the body is ignored — only a direct header/button counts', () => {
    document.body.innerHTML = `
      <article data-dc-screen="intro">
        <div class="dc-artboard-body">
          <p class="dc-artboard-label">Outro</p>
          <div class="dc-video-comp"></div>
        </div>
      </article>`;
    expect(findArtboardOf(document.querySelector('.dc-video-comp'))).toEqual({
      artboardId: 'intro',
      artboardLabel: null,
    });
  });

  test('an unlabelled artboard still yields its id', () => {
    document.body.innerHTML =
      '<article data-dc-screen="intro"><div class="dc-video-comp"></div></article>';
    expect(findArtboardOf(document.querySelector('.dc-video-comp'))).toEqual({
      artboardId: 'intro',
      artboardLabel: null,
    });
  });
});
