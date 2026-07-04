/**
 * @file       video-comp.tsx — DDR-148 video-comp canvas kind.
 * @scope      apps/studio/video-comp.tsx (re-exported from canvas-lib.tsx as
 *             part of the `@maude/canvas-lib` surface).
 * @purpose    Mount a Remotion composition inside `@remotion/player`'s `<Player>`
 *             for free scrub/preview, and expose the ONE deterministic seek
 *             bridge (`window.__maude_seek__`) that the capture spine
 *             (`bin/_video-playwright.mjs`) and the Timeline panel drive.
 *
 *             A video-comp is deterministic BY CONSTRUCTION — every animated
 *             value is a pure function of `useCurrentFrame()`, so seeking the
 *             Player's `frame` renders one exact frame with no free-running
 *             clock. The capture shim steps `__maude_seek__(0..N)` and
 *             screenshots each frame; two runs to frame N are pixel-identical.
 *
 *             Runtime wiring: `remotion` + `@remotion/player` are externalised
 *             through the canvas importmap (RUNTIME_PACKAGES / DDR-148), so the
 *             Player's provider stack and the composition's `useCurrentFrame()`
 *             bind to the SAME `remotion` module instance (no dual-package
 *             frozen-at-frame-0 hazard).
 */

import { Player, type PlayerRef } from '@remotion/player';
import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Comp meta contract + the module-level seek registry

/** The temporal contract a video-comp artboard declares. */
export interface VideoCompMeta {
  /** Frames per second (Remotion timebase). */
  fps: number;
  /** Total composition length, in frames. */
  durationInFrames: number;
  /** Composition pixel width. */
  width: number;
  /** Composition pixel height. */
  height: number;
}

/** A live registration — the Player handle + its meta, keyed by artboard id. */
interface CompEntry extends VideoCompMeta {
  id: string;
  ref: React.RefObject<PlayerRef | null>;
}

/** Serializable meta the capture shim + Timeline panel read (no functions). */
export interface CompSnapshot extends VideoCompMeta {
  id: string;
}

interface MaudeSeekWindow {
  __maudeVideoComps?: Map<string, CompEntry>;
  /** Seek every registered comp to `frame` (paused). Ordinary artboards fall
   *  back to a time-based WAAPI seek. Resolves once the frame has painted. */
  __maude_seek__?: (frame: number, opts?: { fps?: number }) => Promise<void>;
  /** Serializable comp list for the capture shim / Timeline panel. */
  __maude_comps__?: () => CompSnapshot[];
}

function seekWindow(): MaudeSeekWindow | null {
  return typeof window === 'undefined' ? null : (window as unknown as MaudeSeekWindow);
}

function registry(): Map<string, CompEntry> {
  const w = seekWindow();
  if (!w) return new Map();
  if (!w.__maudeVideoComps) w.__maudeVideoComps = new Map();
  return w.__maudeVideoComps;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Two rAFs — enough for the Player to commit a seeked frame to the DOM. */
function afterPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Install the singleton seek bridge on `window`. Idempotent — the first
 * VideoComp to mount wins; later mounts reuse the same functions. The bridge
 * reads the live registry, so it always reflects the currently-mounted comps.
 * Exported so tests (and a defensive capture-shim call) can install it without
 * mounting a Player.
 */
export function installMaudeSeekBridge(): void {
  const w = seekWindow();
  if (!w || w.__maude_seek__) return;

  w.__maude_seek__ = async (frame, opts) => {
    const entries = [...registry().values()];
    if (entries.length > 0) {
      for (const e of entries) {
        const f = clamp(Math.round(frame), 0, Math.max(0, e.durationInFrames - 1));
        try {
          e.ref.current?.pause();
          e.ref.current?.seekTo(f);
        } catch {
          /* Player not yet ready — a later seek settles it */
        }
      }
      await afterPaint();
      return;
    }
    // Ordinary-artboard fallback (no registered comp): drive WAAPI by time so a
    // manual `__maude_seek__` still works. The capture shim owns the primary
    // ordinary-artboard path (it seeks <video>.currentTime + getAnimations()).
    const fps = opts?.fps ?? 30;
    const ms = (frame / fps) * 1000;
    if (typeof document !== 'undefined') {
      for (const a of document.getAnimations()) {
        try {
          a.pause();
          a.currentTime = ms;
        } catch {
          /* unseekable animation — skip */
        }
      }
    }
    await afterPaint();
  };

  w.__maude_comps__ = () =>
    [...registry().values()].map((e) => ({
      id: e.id,
      fps: e.fps,
      durationInFrames: e.durationInFrames,
      width: e.width,
      height: e.height,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoComp — the canvas-lib wrapper

export interface VideoCompProps extends VideoCompMeta {
  /** The Remotion composition component (frame-driven; NO CSS animations). */
  component: ComponentType<Record<string, unknown>>;
  /** Stable id (defaults to a mount-order slug) — keys the seek registry + the
   *  Timeline rows; match the enclosing DCArtboard id when there are several. */
  id?: string;
  /** Props forwarded to the composition (Remotion `inputProps`). */
  inputProps?: Record<string, unknown>;
  /** Show the Player's own transport chrome in PREVIEW. Auto-hidden during
   *  capture/export (the `?hide-chrome=1` shell flag). Default true. */
  controls?: boolean;
  /** Loop preview playback. Default true. */
  loop?: boolean;
  /**
   * Autoplay in preview. Default: play unless the viewer prefers reduced motion
   * (a11y) or the shell is in capture mode. Never autoplays during export.
   */
  autoPlay?: boolean;
}

let mountCounter = 0;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True when the shell asked for a chrome-free render (export capture / diff). */
function hideChrome(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('hide-chrome') === '1';
  } catch {
    return false;
  }
}

/**
 * Mount a Remotion composition as a scrubbable video-comp artboard body. Place
 * it inside a `DCArtboard` whose width/height match the composition:
 *
 * ```tsx
 * const Intro = () => {
 *   const frame = useCurrentFrame();
 *   const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
 *   return <AbsoluteFill style={{ opacity }}>…</AbsoluteFill>;
 * };
 * // …inside the canvas:
 * <DCArtboard id="intro" label="Intro" width={640} height={360}>
 *   <VideoComp component={Intro} durationInFrames={90} fps={30} width={640} height={360} />
 * </DCArtboard>
 * ```
 */
export function VideoComp({
  component,
  durationInFrames,
  fps,
  width,
  height,
  id,
  inputProps,
  controls,
  loop = true,
  autoPlay,
}: VideoCompProps) {
  const ref = useRef<PlayerRef | null>(null);
  // Stable id across re-renders; unique per mount when the author omits one.
  const [autoId] = useState(() => id ?? `videocomp-${++mountCounter}`);
  const compId = id ?? autoId;
  const capturing = hideChrome();
  const reduce = prefersReducedMotion();
  const showControls = controls ?? !capturing;
  const play = (autoPlay ?? !reduce) && !capturing;

  // Register with the seek bridge for the lifetime of this mount.
  useEffect(() => {
    installMaudeSeekBridge();
    const entry: CompEntry = { id: compId, fps, durationInFrames, width, height, ref };
    registry().set(compId, entry);
    // Announce comps to the shell so the Timeline panel can auto-suggest.
    postToShell({ dgn: 'timeline-comps', comps: seekWindow()?.__maude_comps__?.() ?? [] });
    return () => {
      const cur = registry().get(compId);
      if (cur === entry) registry().delete(compId);
      postToShell({ dgn: 'timeline-comps', comps: seekWindow()?.__maude_comps__?.() ?? [] });
    };
  }, [compId, fps, durationInFrames, width, height]);

  // Shell → iframe transport: the Timeline panel drives preview scrub/playback.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (e: MessageEvent) => {
      const m = e.data as { dgn?: string; frame?: number; id?: string } | null;
      if (!m || typeof m !== 'object' || typeof m.dgn !== 'string') return;
      // The shell asks a (possibly already-mounted) canvas to re-announce its
      // comps — answer regardless of Player readiness so a tab-switch / panel-
      // open re-syncs the Timeline panel.
      if (m.dgn === 'timeline-request-comps') {
        postToShell({ dgn: 'timeline-comps', comps: seekWindow()?.__maude_comps__?.() ?? [] });
        return;
      }
      if (m.id && m.id !== compId) return; // targeted seek to another comp
      const p = ref.current;
      if (!p) return;
      try {
        if (m.dgn === 'timeline-seek' && typeof m.frame === 'number') {
          p.pause();
          p.seekTo(clamp(Math.round(m.frame), 0, Math.max(0, durationInFrames - 1)));
        } else if (m.dgn === 'timeline-play') {
          p.play();
        } else if (m.dgn === 'timeline-pause') {
          p.pause();
        }
      } catch {
        /* Player transitional — ignore */
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [compId, durationInFrames]);

  // iframe → shell: mirror the playhead so the Timeline panel tracks preview.
  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const onFrame = () => {
      try {
        postToShell({ dgn: 'timeline-frame', id: compId, frame: p.getCurrentFrame() });
      } catch {
        /* ignore */
      }
    };
    p.addEventListener('frameupdate', onFrame);
    return () => {
      try {
        p.removeEventListener('frameupdate', onFrame);
      } catch {
        /* ignore */
      }
    };
  }, [compId]);

  const style = useMemo(() => ({ width: '100%', height: '100%', display: 'block' as const }), []);

  return (
    <div
      className="dc-video-comp"
      data-comp-id={compId}
      style={{ width, height, maxWidth: '100%' }}
    >
      <Player
        ref={ref}
        component={component}
        durationInFrames={Math.max(1, Math.round(durationInFrames))}
        fps={fps}
        compositionWidth={width}
        compositionHeight={height}
        inputProps={inputProps ?? {}}
        controls={showControls}
        loop={loop}
        autoPlay={play}
        clickToPlay={showControls}
        doubleClickToFullscreen={false}
        // We ship Remotion in-house and disclose the license (DDR-148); ack in
        // code so the Player never nags/watermarks the preview.
        acknowledgeRemotionLicense
        style={style}
      />
    </div>
  );
}
VideoComp.displayName = 'VideoComp';

function postToShell(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined' || window.parent === window) return;
  try {
    window.parent.postMessage(payload, '*');
  } catch {
    /* cross-origin parent without our listener — no-op */
  }
}
