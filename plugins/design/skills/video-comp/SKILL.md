---
name: design:video-comp
description: Author a video-comp canvas — a real Remotion composition mounted in the embedded Player for scrub/preview, exported to MP4/GIF through Maude's own capture spine (no renderer binaries). Auto-load when the brief or feedback mentions video, animation, klip/clip, motion graphics, titles, transitions, or hudba/music, or when authoring/editing a `<VideoComp>` artboard. Owns the Remotion iron rules + Maude's runtime/asset/export conventions (DDR-148).
---

# video-comp — author animation & marketing video AS a canvas

A **video-comp** is a canvas artboard whose body is a genuine **Remotion**
composition, mounted in the embedded `@remotion/player` for free scrub/preview
and exported to **MP4/GIF** through Maude's own capture spine. You author it in
TSX exactly like any other canvas — the composition is a React component driven
by the frame index. See **DDR-148** for the architecture.

Load this skill whenever the brief/feedback mentions **video, animation, klip,
motion graphics, titles, transitions, or music/hudba**, or when you touch a
`<VideoComp>` artboard.

## The determinism iron law (non-negotiable)

Export is frame-perfect ONLY because every animated value is a **pure function
of the frame index**. Adapted from Remotion's official LLM guidance:

- **Drive everything from `useCurrentFrame()`** via `interpolate()` / `spring()`.
- **NEVER use CSS animations or transitions inside a comp** — no `@keyframes`,
  no `transition:`, no `animation:`. They run on a wall-clock the capture can't
  seek, so the export freezes or tears. (Ordinary non-comp artboards MAY use
  CSS/WAAPI — but a `<VideoComp>` body must not.)
- **No `Date.now()` / `Math.random()` / bare `requestAnimationFrame`** in render
  output. For randomness use Remotion's seeded `random(seed)`.
- Timing is in **frames**, not milliseconds: `interpolate(frame, [0, 30], …)` is
  "over the first second at 30fps".

## Only bundled imports resolve (Maude runtime constraint)

A canvas can `import` ONLY from the packages Maude pre-bundles — an unbundled
specifier fails to resolve on an end-user install (no `node_modules`). For
video-comps that means:

- `@maude/canvas-lib` — `DesignCanvas`, `DCSection`, `DCArtboard`, **`VideoComp`**.
- `remotion` — `useCurrentFrame`, `useVideoConfig`, `interpolate`, `spring`,
  `Easing`, `random`, `AbsoluteFill`, `Sequence`, `Series`, `Loop`, `Freeze`,
  `Img`, `Video`, `OffthreadVideo`, `Audio`, `staticFile`, `interpolateColors`.
- `@remotion/transitions` — `TransitionSeries`, `linearTiming`, `springTiming`.
- Transition **presentations** (each a separate import): `@remotion/transitions/fade`,
  `/slide`, `/wipe`, `/flip`, `/clock-wipe`, `/none`. (Exotic presentations like
  `dreamy-zoom` are NOT bundled in v1 — stick to these six.)

Do **not** import `@remotion/renderer`, `@remotion/web-renderer`, or any other
`@remotion/*` — they aren't bundled and aren't needed (export is the capture
spine).

## The `<VideoComp>` wrapper + comp meta

Mount the composition inside a `DCArtboard` whose width/height match the comp.
`<VideoComp>` carries the **comp meta** (`fps` / `durationInFrames` / `width` /
`height`) that both the Player and the exporter read:

```tsx
import { DesignCanvas, DCSection, DCArtboard, VideoComp } from '@maude/canvas-lib';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const Title = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'var(--bg-0)', color: 'var(--fg-0)', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `translateY(${y}px)`, opacity, fontSize: 72, fontWeight: 800 }}>Hello</div>
    </AbsoluteFill>
  );
};

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection title="Hero video">
        <DCArtboard id="hero" label="Hero" width={1280} height={720}>
          <VideoComp component={Title} durationInFrames={90} fps={30} width={1280} height={720} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
```

- Use **DS tokens** (`var(--bg-0)`, `var(--accent)`, `var(--fg-0)`) for colors,
  same as any canvas — a video-comp is still a DS surface.
- Multiple comps on one canvas → give each `<VideoComp id="…">` a stable id.
- **Keep `<Sequence>`/`<TransitionSeries.Sequence>` structure parseable** (literal
  `from` / `durationInFrames` props, one block per beat) — the Timeline panel
  reads it directly.

## Vocabulary: sequences, series, transitions, media

- **`<Sequence from={30} durationInFrames={60}>`** — time-shift a child so its
  own `useCurrentFrame()` starts at 0 when the parent hits frame 30.
- **`<Series>` / `<Series.Sequence durationInFrames={…}>`** — lay beats back-to-back
  without hand-computing offsets.
- **`<TransitionSeries>`** — beats joined by transitions (the "spoj tyhle klipy"
  vocabulary):

```tsx
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}><Clip src="assets/a.mp4" /></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
  <TransitionSeries.Sequence durationInFrames={60}><Clip src="assets/b.mp4" /></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={linearTiming({ durationInFrames: 15 })} />
  <TransitionSeries.Sequence durationInFrames={60}><Clip src="assets/c.mp4" /></TransitionSeries.Sequence>
</TransitionSeries>
```

- **Video/audio**: `<Video src="assets/clip.mp4" />` / `<OffthreadVideo>` /
  `<Audio src="assets/music.mp3" volume={0.6} startFrom={30} />`. Sources are
  **always** relative `assets/…` paths (see below).

## Make it hand-editable (DDR-150 — so the user can tweak it on the Timeline)

The Timeline lets the user move / trim / remove / replace / insert clips by
hand after you generate the comp. Author it so those direct edits land cleanly:

- **Explicit `from` + `durationInFrames`** on every `<Sequence>` — a literal
  number or a top-level `const A = 60;` (a derived `const TOTAL = A + B - XF;`
  is fine; both resolve). Avoid computing timing inline from a prop/expression
  the user can't grab (`durationInFrames={a > b ? x : y}` is opaque to the
  Timeline). A cursor-implicit clip still works — moving it just inserts a `from`.
- **Name your clips** with `<Sequence name="intro">` / `<Sequence name="logo">`.
  The name becomes the clip's durable identity in the Timeline (it survives
  reordering + Prettier), so an edit always lands on the right clip even on a
  multi-comp canvas. Without a name the Timeline falls back to a comp-scoped
  index, which is still safe but less legible.
- **One `<Video>`/`<Audio>`/`<Img src>` per clip** for a replaceable media slot
  (the ⇄ button swaps its `src`). A `src` built from a prop isn't replaceable.
- Prefer **standalone `<Sequence>`** clips when the user will likely add/remove
  beats — splitting or inserting inside a `<TransitionSeries>` is deferred
  (the transition-overlap math), so those ops refuse there for now.
- **Never build `<Sequence>`/`<TransitionSeries.Sequence>` blocks with
  `.map()`/`.flatMap()` over an array** — even though it's valid React and
  renders correctly, the Timeline reads the file as **text**, not as executed
  code (see `timeline-parse.js`'s header). A loop produces exactly ONE literal
  `<TransitionSeries.Sequence>` occurrence in the source (the JSX written once
  inside the callback), with an unresolvable `durationInFrames={clip.dur}` —
  the panel collapses N real clips into one generic fallback row. **Write one
  literal block per beat**, even for many clips — see the worked example below.

## Assets: `assets/` only, no network

Media lives in `<designRoot>/assets/` (content-addressed on drop). Reference it
**relatively** — `src="assets/<name>.mp4"`. NEVER fetch from a URL and never
inline a data: URL. Drop a video/audio file onto the canvas to upload it; large
files (>20 MB) ride git + collab sync, so keep clips lean.

## Worked example — join 4 clips + crossfades + a music bed

Four **literal** `<TransitionSeries.Sequence name="…">` blocks, one per beat —
not a `.map()`/`.flatMap()` over a clips array (see the callout above: a loop
is invisible to the Timeline). This is the shape to reuse whenever you're
asked to stitch N dropped clips together, however many N is.

```tsx
import { DesignCanvas, DCSection, DCArtboard, VideoComp } from '@maude/canvas-lib';
import { AbsoluteFill, Audio, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

const XF = 15; // crossfade length, shared by all 3 transitions
// 4 clips, 3 crossfades → total = sum(clip durations) - 3*XF. Keep this a
// literal sum of consts (not `clips.length * CLIP - ...`) so the Timeline
// can resolve it too.
const TOTAL = 60 + 60 + 60 + 60 - XF * 3;

const Clip = ({ src, label }: { src: string; label: string }) => {
  const frame = useCurrentFrame();
  const up = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <OffthreadVideo src={src} />
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 48 }}>
        <div style={{ color: 'var(--fg-0)', fontSize: 40, fontWeight: 700, opacity: up }}>{label}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Reel = () => (
  <AbsoluteFill>
    <TransitionSeries>
      <TransitionSeries.Sequence name="clip-1" durationInFrames={60}>
        <Clip src="assets/a.mp4" label="01" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: XF })} />
      <TransitionSeries.Sequence name="clip-2" durationInFrames={60}>
        <Clip src="assets/b.mp4" label="02" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: XF })} />
      <TransitionSeries.Sequence name="clip-3" durationInFrames={60}>
        <Clip src="assets/c.mp4" label="03" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: XF })} />
      <TransitionSeries.Sequence name="clip-4" durationInFrames={60}>
        <Clip src="assets/d.mp4" label="04" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {/* Music bed under the whole reel, fading out over the last 20 frames. */}
    <Audio src="assets/music.mp3" volume={(f) => interpolate(f, [TOTAL - 20, TOTAL], [0.7, 0], { extrapolateLeft: 'clamp' })} />
  </AbsoluteFill>
);

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection title="Showreel">
        <DCArtboard id="reel" label="Reel" width={1280} height={720}>
          <VideoComp component={Reel} durationInFrames={TOTAL} fps={30} width={1280} height={720} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
```

This scales to any clip count: for 6+ clips, write 6+ literal blocks — verbose
but Timeline-parseable, which is the whole point (drag-to-retime, per-clip
inspect, replace-media). Don't reach for a loop to shorten it.

## Preview + export

- **Preview/scrub** is free — the Player shows transport controls in the canvas,
  and the **Timeline panel** (View → Timeline) scrubs + retimes sequence blocks.
- **Export** via the ⌘E dialog or the slash command (DDR-062 — go through the
  command, never a bin path):
  - `\/design:export mp4 --scope artboard` — fps/duration come from the comp meta.
  - `\/design:export gif --scope artboard --option fps=15 --option gifColors=128`.
  - MP4 is H.264 (falls back to WebM if the capture browser has no H.264 encoder);
    GIF is palette-quantized. Both render deterministically through the capture
    spine — **no native binaries, no user install**.

## Verify motion over time — freeze-frames lie (DDR-094)

A single screenshot can look right while nothing actually animates. When you
check a comp, seek to **two** different frames (or scrub in the Player) and
confirm the output changes. The motion-critic enforces this as a hard gate.

## License note (surface once to the user)

Remotion is **source-available, not MIT**. It's **free for individuals and
companies of ≤ 3 people** (unlimited commercial use); for-profit orgs of 4+
people need their own Remotion Company License — that's **the user's**
relationship with Remotion, not Maude's. Maude ships no renderer binaries and no
telemetry. See `dist/runtime/REMOTION-LICENSE.md` + <https://remotion.pro/license>.
