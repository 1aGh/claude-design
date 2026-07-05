// video-render-bridge — DDR-148 addendum (audio export) unit coverage.
//
// The actual renderMediaOnWeb call needs a real browser (WebCodecs, canvas
// decode) — that's a manual/agent-browser verification (see the DDR-148
// addendum § Manual verification recipe), not a unit test, mirroring
// video-comp.test.ts's own split between the pure seek-bridge routing (tested
// here) and live Player rendering (not). What IS pure + testable: `findCompIdIn`
// (DOM containment resolution) and the `__maude_render_video__` bridge's
// routing contract — it must merge the registered comp's component/meta with
// the caller's opts and delegate to the injected `__maudeRenderVideo__`, and
// fail clearly when either the comp or the render-lib injection is missing.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

import { findCompIdIn, installMaudeSeekBridge } from '../video-comp.tsx';

interface RenderCall {
  component: unknown;
  inputProps: unknown;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  [k: string]: unknown;
}

interface RenderWindow {
  __maudeVideoComps?: Map<
    string,
    {
      id: string;
      fps: number;
      durationInFrames: number;
      width: number;
      height: number;
      ref: { current: null };
      component: unknown;
      inputProps: Record<string, unknown>;
    }
  >;
  __maude_render_video__?: (compId: string, opts: Record<string, unknown>) => Promise<unknown>;
  __maudeRenderVideo__?: (opts: RenderCall) => Promise<unknown>;
}

function registerComp(
  id: string,
  meta: { fps: number; durationInFrames: number; width: number; height: number },
  component: unknown,
  inputProps: Record<string, unknown> = {}
): void {
  const w = window as unknown as RenderWindow;
  if (!w.__maudeVideoComps) w.__maudeVideoComps = new Map();
  w.__maudeVideoComps.set(id, { id, ...meta, ref: { current: null }, component, inputProps });
}

beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  const w = window as unknown as RenderWindow;
  w.__maudeVideoComps = undefined;
  w.__maudeRenderVideo__ = undefined;
  (w as unknown as { __maude_render_video__?: unknown }).__maude_render_video__ = undefined;
  (w as unknown as { __maude_seek__?: unknown }).__maude_seek__ = undefined;
  (w as unknown as { __maude_comps__?: unknown }).__maude_comps__ = undefined;
});

describe('findCompIdIn', () => {
  test('resolves the nearest [data-comp-id] descendant', () => {
    document.body.innerHTML =
      '<div data-dc-screen="reel"><div data-comp-id="videocomp-2"><span>x</span></div></div>';
    const artboard = document.querySelector('[data-dc-screen="reel"]');
    expect(artboard).not.toBeNull();
    expect(findCompIdIn(artboard as Element)).toBe('videocomp-2');
  });

  test('returns null for an artboard with no registered comp (ordinary/CSS artboard)', () => {
    document.body.innerHTML = '<div data-dc-screen="static"><p>just a div</p></div>';
    const artboard = document.querySelector('[data-dc-screen="static"]');
    expect(findCompIdIn(artboard as Element)).toBeNull();
  });
});

describe('__maude_render_video__ bridge', () => {
  test('merges the registered component + meta with caller opts, delegates to __maudeRenderVideo__', async () => {
    const w = window as unknown as RenderWindow;
    installMaudeSeekBridge();
    const FakeComp = () => null;
    registerComp('reel', { fps: 30, durationInFrames: 228, width: 960, height: 540 }, FakeComp, {
      title: 'Showreel',
    });
    let received: RenderCall | null = null;
    w.__maudeRenderVideo__ = async (opts) => {
      received = opts;
      return { b64: 'AA==', bytes: 2, container: 'mp4', videoCodec: 'h264', audioCodec: 'aac' };
    };
    const result = await w.__maude_render_video__?.('reel', {
      container: 'mp4',
      scale: 2,
      muted: false,
      frameRange: [0, 30],
    });
    expect(result).toEqual({
      b64: 'AA==',
      bytes: 2,
      container: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
    });
    expect(received).not.toBeNull();
    const call = received as unknown as RenderCall;
    expect(call.component).toBe(FakeComp);
    expect(call.inputProps).toEqual({ title: 'Showreel' });
    expect(call.width).toBe(960);
    expect(call.height).toBe(540);
    expect(call.fps).toBe(30);
    expect(call.durationInFrames).toBe(228);
    // Caller opts pass through alongside the merged meta.
    expect(call.container).toBe('mp4');
    expect(call.scale).toBe(2);
    expect(call.muted).toBe(false);
    expect(call.frameRange).toEqual([0, 30]);
  });

  test('throws a clear error for an unregistered compId', async () => {
    const w = window as unknown as RenderWindow;
    installMaudeSeekBridge();
    await expect(w.__maude_render_video__?.('nope', { container: 'mp4' })).rejects.toThrow(
      /no registered video-comp/i
    );
  });

  test('throws a clear error when the render-lib bundle was never injected', async () => {
    const w = window as unknown as RenderWindow;
    installMaudeSeekBridge();
    registerComp('reel', { fps: 30, durationInFrames: 90, width: 960, height: 540 }, () => null);
    // __maudeRenderVideo__ intentionally left unset (simulates a capture that
    // skipped addScriptTag — e.g. gif/ordinary-artboard export never injects it).
    await expect(w.__maude_render_video__?.('reel', { container: 'mp4' })).rejects.toThrow(
      /render-lib bundle not injected/i
    );
  });
});
