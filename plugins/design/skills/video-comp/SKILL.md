---
name: video-comp
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
  `Img`, `OffthreadVideo`, `Audio`, `staticFile`, `interpolateColors`.
- `@remotion/media` — `<Video>`, the audio-capable video element (see
  "Audio in exports" below — **use this, not `remotion`'s `OffthreadVideo`,
  whenever the clip's own audio must survive the export**).
- `@remotion/transitions` — `TransitionSeries`, `linearTiming`, `springTiming`.
- Transition **presentations** (each a separate import): `@remotion/transitions/fade`,
  `/slide`, `/wipe`, `/flip`, `/clock-wipe`, `/none`. (Exotic presentations like
  `dreamy-zoom` are NOT bundled in v1 — stick to these six.)

Do **not** import `@remotion/renderer`, `@remotion/web-renderer`, or any other
`@remotion/*` — they aren't bundled and aren't needed (export is the capture
spine).

## Manual-editor vocabulary (enhanced-video-editing)

The Timeline's manual editor and the agent door speak the same per-clip props —
when authoring or editing a comp, use exactly these spellings so the
two-tokenizer contract (`enumerateClips` display + `timeline-parse.js`) holds:

- **Speed**: `playbackRate={2}` on the media element (`<Video>`/`<OffthreadVideo>`/`<Audio>`).
  The clip's `durationInFrames` = source frames ÷ rate. No speed ramps.
- **In-point**: `trimBefore={N}` on the media element (source frames; `startFrom`
  is the legacy spelling — read both, always EMIT `trimBefore`).
- **Per-clip audio**: bare `muted`, `volume={0.6}` (constants only in v1).
- **Grade**: ONE CSS filter chain on the media element's literal style —
  `style={{ filter: 'brightness(1.1) saturate(1.3)' }}`. Deterministic in the
  Player and both export paths; never a sidecar.
- **Crop/reposition**: the `data-mframe="scale,x,y"` wrapper (outer
  `overflow:hidden` div + inner `transform: scale() translate()` div) — keep it
  intact; the engine round-trips it losslessly.
- **AI placeholder**: `<AIPlaceholder prompt={"…"} kind="veo|motion|image" durationInFrames={N} />`
  from `@maude/canvas-lib` — a prompt-carrying slate clip the generation spine
  resolves in place. The prompt is USER TEXT: always the JSON-stringified
  quoted-expression form, never a template literal.
- **Storyline container**: series membership is what makes clips butt
  magnetically and accept seam transitions — greenfield comps and assembled
  reels use `<TransitionSeries>` beats (hard cuts between adjacent beats are
  valid; transitions are optional per seam).

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

- **Video/audio**: `<Video src="assets/clip.mp4" />` (from `@remotion/media` —
  see "Audio in exports" below) / `<OffthreadVideo>` (silent b-roll only) /
  `<Audio src="assets/music.mp3" volume={0.6} startFrom={30} />`. Sources are
  **always** relative `assets/…` paths (see below).

## Audio in exports: `<Video>` from `@remotion/media`, NEVER `<OffthreadVideo>`

MP4 export with audio goes through exactly one path — `renderMediaOnWeb`
(`@remotion/web-renderer`) — and that path **does not support `OffthreadVideo`**.
When a comp uses `OffthreadVideo` for a clip whose audio matters, the export
**silently degrades** to the frame-step fallback: the resulting file has no
audio track, but the job still reports `status: done`. The reason for the
fallback goes only to the dev-server's stderr — nothing about it is written to
the job record, so there is no artifact-level signal that anything went wrong.

```tsx
import { Video } from '@remotion/media';   // not OffthreadVideo from 'remotion'

<Video src="assets/clip.mp4" trimBefore={30} trimAfter={120} volume={0.8} />
```

The props are a 1:1 swap with `OffthreadVideo` (`src`, `trimBefore`, `trimAfter`,
`style`, `muted`, `playbackRate`, `volume`) — reach for `<Video>` whenever a
clip's own audio needs to make it into the export; keep `OffthreadVideo` only
for genuinely silent b-roll.

**After every export that should have audio, verify the artifact, not the job
status** — a `done` status proves the render finished, not that the file is
correct:

```sh
ffprobe -v error -show_entries stream=codec_type -of csv=p=0 out.mp4
```

If `renderMediaOnWeb` hangs or fails even with `<Video>` on a complex comp
(rare, but see "Export cost & reliability" below), compose audio separately
and mux it in with `-c:v copy` so the picture stays bit-identical. For social
delivery, target **−14 LUFS / true peak below −1 dBTP**. `loudnorm` in dynamic
mode can compress loudness range without hitting the loudness target (e.g. LRA
14.9 → 4.3 while still missing −14 LUFS) — when that happens, prefer plain
`volume` + `alimiter` and dial the level by hand (the limiter's makeup gain
means *lowering* `limit` raises perceived loudness, not the reverse).

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

**Exporting from a CLI/script instead of the ⌘E dialog:** a plain `curl` to
`localhost:<port>` can fail with "fetch failed" — `_server.json` advertises
`localhost`, but the server binds the IPv4 loopback `127.0.0.1`, and on macOS
`localhost` can resolve to the IPv6 `::1` first. Call the API through
`127.0.0.1` directly. Prefer the **non-blocking** `POST /_api/export-jobs`
over the blocking `POST /_api/export` — a render kicked off through the
blocking route keeps running orphaned (burning CPU) if the client disconnects,
where a background job is tracked and can be checked/downloaded independently:

```sh
curl -X POST "http://127.0.0.1:<port>/_api/export-jobs" \
  -H "Origin: http://127.0.0.1:<port>" -H "Content-Type: application/json" \
  -d '{"format":"mp4","scope":"artboard","options":{"scale":1}}'
# status:   GET /_api/export-jobs
# download: GET /_api/export-jobs/download?id=<jobId>
```

**Cancelling a stuck render:** `kill <PID>` the specific `_video-playwright.mjs`
process — never `pkill` by pattern on a shared machine. A pattern match can hit
an unrelated headless-browser process (including the dev server's own) and take
down more than the render you meant to stop.

## Pushing it — VFX & motion graphics (all frame-driven)

Remotion + plain React/SVG/CSS goes *far* beyond stitch-and-title. Everything
below is a **pure function of `useCurrentFrame()`** (the iron law) — build it by
hand from `interpolate`/`spring`/`random`; there is **no** effects library to
import. Proven in the Alligators cinematic-cut dogfood (2026-07-10):

- **Cinematic grade** — a CSS `filter` on the `<OffthreadVideo>` (`contrast`
  `saturate` `brightness` `hue-rotate` `sepia`) + a teal/orange gradient wash div.
- **Ken-Burns** — per-clip `transform: scale()/translate()` driven by clip progress.
- **Slow-mo / speed ramp** — `<OffthreadVideo playbackRate={0.5} />` (deterministic).
- **Impact camera shake** — `translate`/`rotate` by `random(\`seed${Math.floor(frame)}\`)`.
- **Impact zoom-punch** — a quick `scale` spike over the first ~10 frames of a hit.
- **Kinetic typography** — split text to `<span>`s, per-letter `spring({frame: frame - i*2})`
  stagger + a **RGB chromatic split** via `text-shadow` (red +Xpx / cyan −Xpx) that
  shrinks as it settles.
- **3D card CTA** — `perspective()` + `rotateY()` + `translateZ()` spring-in, with an
  expanding-ring "shockwave" (`scale()` + fading opacity).
- **Freeze / hit flash** — a full-frame white `<AbsoluteFill>` whose opacity spikes
  for ~3 frames; pair with `<Freeze frame={N}>` for a bullet-time hold.
- **Glitch / RGB-split stab** — two `clipPath`-sliced colour layers offset by a
  seeded random x, flashed for ~5 frames between hard cuts.
- **Radial speed-lines** — an SVG `<mask>` of N random-length lines from centre over a
  radial-gradient rect (anime burst); flash it during a hero run.
- **Light-leak sweep** — an animated radial gradient translated across, `screen` blend.
- **VHS / archival treatment** — `repeating-linear-gradient` scanlines + a `REC ●`
  bug + a frame-derived timecode; makes low-res source footage read as *intentional*.
- **Split-screen** — a flex row of N `<OffthreadVideo>` with a `clipPath` wipe-in.
- **Motion-graphic infographics** (Remotion's home turf):
  - **animated chalkboard play diagram** — an SVG route that draws itself via
    `strokeDasharray`/`strokeDashoffset`, with a ball-carrier dot walking the same
    waypoints (parametric `pointAt(t)`, **no DOM measurement** → deterministic);
  - **animated value bars / counters** — `spring`-filled bar widths + a counting `%`
    (use `overshootClamping: true` and clamp so the number never exceeds its target).

**`motion` (Framer Motion) is bundled but UNUSABLE inside a comp** — its `animate`
runs on wall-clock, which the frame-stepping capture can't seek. Motion here is
*always* Remotion-driven. **Cheap moving film grain:** a static feTurbulence noise
baked into a `data:` URI `background-image`, scrolled by a seeded-random offset each
frame — never a live per-frame `<feTurbulence>` (that re-runs the filter every frame).

### Recipe: translucent ghost / matte, no green screen

Unlike everything above, this is **not** a Remotion-in-comp technique — it's an
offline pre-process that bakes a finished asset, then drops into the comp like
any other clip. CSS `opacity` over the whole clip does **not** work for "the
figure is translucent, the background stays normal" — it dims everything and
reads as a double exposure. Instead:

1. **Per-frame person mask** — macOS Vision's `VNGeneratePersonSegmentationRequest`
   (`.accurate` quality) runs on-device, free, and handles a distant subject too.
2. **Reconstruct the plate behind the person** from neighboring frames where
   that region isn't occluded. With camera motion, align candidate frames
   first (`cv2.phaseCorrelate`), then `nanmedian` across them, then `cv2.inpaint`
   any remaining holes.
3. **Composite**: `out = src*(1-m) + (person*A + plate*(1-A))*m`, with
   `A ≈ 0.45`. Feather the mask (~5 px) — an unfeathered edge reads as cut-out
   paper, not a ghost.
4. Bake the result to a clip and import it as a plain asset — this pipeline
   runs outside the comp, not inside it.

If the source is an iPhone `.mov`, it may carry more than one audio stream —
use `-map 1:a:0` explicitly, or ffmpeg can fail decoding the spatial-audio
track.

## Export cost & reliability (learned the hard way — 2026-07-10 dogfood)

The capture spine screenshots every frame in Chromium, so **per-frame compositing
cost is real** and a few limits bite:

- **≤ 2 min at 30 fps by default.** The video exporter's `DEFAULT_MAX_FRAMES`
  is `3600` (`apps/studio/exporters/video.ts`), with a `MAX_FRAMES_CEILING` of
  `18000` reachable via `--option maxFrames=N`. A comp past the active cap's
  **ending is silently truncated** — author within it (or pass `maxFrames`);
  the `footage-director` targets this.
- **`scale` defaults to 2×, not 1×.** A 1280×720 comp renders at 2560×1440
  unless you opt out — this is an **opt-out**, not opt-in, and it costs real
  time (roughly 2.3× slower per frame). Pass `--option scale=1` for native
  resolution; only go to `scale=3` if you deliberately want an oversampled
  render. 1920×1080 at scale 2+ can hit memory pressure and die mid-render
  (`addVideoFrame` on `undefined`) — prefer 1280×720 at native scale for heavy
  comps.
- **Budget full-frame `mix-blend-mode` / `filter` layers.** Many *always-on*
  full-screen blend layers (grain `overlay`, grade `soft-light`, scanline `multiply`,
  …) force a per-frame GPU→CPU readback and **crash the capture renderer**
  ("Execution context was destroyed"). Keep heavy blends **brief and small-area**
  (glitch/leak stabs over a few frames are fine); make **always-on** full-frame
  layers plain `opacity`, not a blend mode. This was the real cause of random
  mid-render crashes on the effect-dense cut.
- **`renderMediaOnWeb` (the mp4/webm whole-comp audio path) can HANG** on a complex
  comp instead of throwing, so its built-in frame-step fallback never fires and the
  export times out. For a **vision-only / no-audio** comp, force the reliable
  frame-step path (drive `_video-playwright.mjs` without `--render-lib`, or export
  `gif`). Fixing the hang→fallback is a tracked DDR-148 follow-up.
- **Set the active canvas before a CLI export.** `/_api/export` scope resolves from
  `_active.json`, which is driven by the **live studio shell selection** — open the
  canvas tab (file-tree click) so the artboard resolves; a hand-written `_active.json`
  is not enough once the shell is running.
- **Headless render server:** set `MAUDE_NO_WATCH=1` so no HMR hard-reload can
  interrupt a long capture (defensive — a peer/runtime-state write to `designRoot`
  otherwise reloads the capture page).

## Verify motion over time — freeze-frames lie (DDR-094)

A single screenshot can look right while nothing actually animates. When you
check a comp, seek to **two** different frames (or scrub in the Player) and
confirm the output changes. The motion-critic enforces this as a hard gate.

**Seek any frame to verify without a full export:** the Player exposes
`window.__maude_seek__(frame)` on the capture shell — open
`_canvas-shell.html?canvas=…&hide-chrome=1`, `__maude_seek__(N)`, screenshot. Far
cheaper than a multi-minute render when checking a specific beat / motion-graphic.

Two conditions on that URL, or it comes back blank with a `Failed to fetch
dynamically imported module` error that looks like a broken canvas rather than
a bad call:

1. **`?canvas=` must carry the `.tsx` extension** — the canvas-origin route
   gate (`isCanvasSafeRoute` in `apps/studio/http.ts`) only serves paths whose
   extension is on its allowlist.
2. **The port must be the `canvasPort` from `_server.json`**, not the main
   `port` — the shell is served from the segregated canvas origin, not the
   main studio origin.

```sh
maude design screenshot --url \
  "http://localhost:<canvasPort>/_canvas-shell.html?canvas=ui/…/Foo.tsx&hide-chrome=1" \
  --full --out /tmp/x.png
```

If a canvas screenshot comes back empty, check both of the above before
concluding the environment can't do it — an empty screenshot is far more often
a malformed URL than a broken renderer.

## License note (surface once to the user)

Remotion is **source-available, not MIT**. It's **free for individuals and
companies of ≤ 3 people** (unlimited commercial use); for-profit orgs of 4+
people need their own Remotion Company License — that's **the user's**
relationship with Remotion, not Maude's. Maude ships no renderer binaries and no
telemetry. See `dist/runtime/REMOTION-LICENSE.md` + <https://remotion.pro/license>.
