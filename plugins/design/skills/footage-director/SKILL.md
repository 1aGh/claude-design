---
name: design:footage-director
description: The footage → cut director layer (feature-footage-analysis-director). Owns (1) the EDL vocabulary + reziser rubric the `footage-director` agent applies, and (2) the EDL → `<TransitionSeries>` video-comp CODEGEN contract that `/design:reel` uses to turn a decided cut into a Timeline-parseable Remotion composition. Auto-load when authoring or editing a footage-driven reel/cut, when consuming an `<slug>.edl.json`, or when the request is "sestřihej ta videa"/"make a reel from these clips". Defers to skill `video-comp` for the Remotion iron rules; this skill is the FOOTAGE-specific layer on top.
---

# footage-director — from analyzed footage to a real cut

This skill is the layer that turns **understood footage** into a **composition**.
It sits on top of two things and owns the seam between them:

- **Below it:** the `footage-analyst` agent (per-clip `FootageAnalysis` sidecars)
  and the `footage-director` agent (the `Edl` decision). See those agent docs.
- **Above it:** skill **`video-comp`** — the Remotion iron rules, bundled-imports
  constraint, `<VideoComp>` meta, and the **Timeline-parseable literal-block**
  discipline. **Everything in `video-comp` applies here** — this skill only adds
  the EDL→TSX mapping. Load `video-comp` alongside this.

The end-to-end flow is orchestrated by `/design:reel`:
`ingest-footage → footage-analyst (per clip) → footage-director (EDL) → THIS codegen → critics`.

## The two artifacts (schema: `apps/studio/footage/schema.ts`)

- `assets/<sha8>.footage.json` — a `FootageAnalysis` (per clip). **Seconds-based.**
- `<designRoot>/<slug>.edl.json` — an `Edl` (per cut). Beats are **output-frame-based**;
  `startSec` is the only seconds value (source in-point).

Both are **VERSIONED** (DDR-115 — they commit + sync like `.meta.json`). Written
only via the loopback `PUT /_api/footage` route (validated); read with a plain GET.

## Transitions — Remotion already has the library, and Maude ships it

The user's "is there a transitions library" question: **yes.** `@remotion/transitions`
is bundled in `RUNTIME_PACKAGES` (DDR-148). The director may use **exactly these
six** presentations (each a separate import) — nothing else resolves on an
end-user install:

| Presentation | Import | Use it for |
| --- | --- | --- |
| `none` (hard cut) | — (omit the `<Transition>`) | the punchy default; most beats |
| `fade` | `@remotion/transitions/fade` | calm / elegant / a breath between moods |
| `slide` | `@remotion/transitions/slide` | a deliberate directional push (`{ direction }`) |
| `wipe` | `@remotion/transitions/wipe` | a graphic reveal |
| `flip` | `@remotion/transitions/flip` | a playful hard beat change |
| `clock-wipe` | `@remotion/transitions/clock-wipe` | a radial reveal (logo stings) |

Exotic presentations (`dreamy-zoom`, etc.) are **NOT bundled in v1** — do not
import them. (Widening the set is a gated follow-up: add the bundle to
`RUNTIME_PACKAGES` + `.min-sizes.json` floor + `check-runtime-bundles.sh`, per
DDR-148 "whatever is committed is what ships" — bytes on every canvas, so only
when a real cut needs it.)

## EDL → `<TransitionSeries>` codegen contract (the load-bearing part)

Turn the `Edl` into a video-comp canvas under `<designRoot>/ui/<Slug>.tsx`. The
output MUST be the **exact shape** of `video-comp` SKILL.md's worked 4-clip
example — one **literal** block per beat, **never `.map()`** over the beats
(the Timeline reads the file as text; a loop collapses N beats into one generic
row — the single most important rule here).

Mapping, beat by beat:

- **Comp meta** ← `Edl.fps` / `Edl.width` / `Edl.height`; `durationInFrames={TOTAL}`.
- **`TOTAL`** ← a **literal arithmetic sum** of the beat durations minus each
  non-null transition's frames, written as consts/literals so the Timeline can
  resolve it: `const TOTAL = 60 + 45 + 50 - 15 - 15;` — NOT
  `beats.reduce(...)` and NOT `clips.length * X`.
- **Each beat** → one literal
  `<TransitionSeries.Sequence name="{beat.name}" durationInFrames={beat.durationFrames}>`
  wrapping `<OffthreadVideo src="{beat.clip}" startFrom={Math.round(beat.startSec * fps)} />`.
  - `startFrom` (in output frames) is how a beat uses a **mid-clip in-point**; a
    second beat from the same clip is a **second literal block** with a different
    `startFrom` — this is how "multiple shots from one clip" renders.
  - `<OffthreadVideo>` (not `<Video>`) for frame-accurate export decoding.
- **Between beats** → if `beats[i].transition` is non-null, emit
  `<TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: {frames} })} />`
  BEFORE that beat's `<Sequence>`; if `null`, emit nothing (back-to-back
  sequences = a hard cut). `slide` takes `slide({ direction: 'from-right' })`.
- **Overlays** → a DS-token'd `<AbsoluteFill>` child inside the beat's Clip,
  frame-driven (spring/interpolate on `useCurrentFrame()` — **never** CSS
  animation, the iron law). `title` = centered display type; `lower-third` =
  bottom-left; `caption` = bottom-center; `logo` = the DS brand mark (Tier-0
  prior: lift `system/<ds>/preview/logo.*` per DDR-141, don't redraw it).
- **Music** → one `<Audio src="{music.asset}" volume={f => interpolate(f, [TOTAL - {fadeOutFrames}, TOTAL], [1, 0], { extrapolateLeft: 'clamp' })} />`
  under the whole reel. Omit if `Edl.music` is absent.
- **Colors/type** → DS tokens (`var(--bg-0)`, `var(--fg-0)`, `var(--accent)`),
  same as any canvas.

### Worked codegen (3-beat EDL → comp)

```tsx
import { DesignCanvas, DCSection, DCArtboard, VideoComp } from '@maude/canvas-lib';
import { AbsoluteFill, Audio, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

const FPS = 30;
// TOTAL = Σ beat frames − Σ transition frames, as a literal sum (Timeline-resolvable).
const TOTAL = 60 + 45 + 50 - 15 - 15;

const Title = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const y = interpolate(spring({ frame, fps, config: { damping: 200 } }), [0, 1], [30, 0]);
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `translateY(${y}px)`, opacity, color: 'var(--fg-0)', fontSize: 88, fontWeight: 800 }}>{text}</div>
    </AbsoluteFill>
  );
};

const Reel = () => (
  <AbsoluteFill style={{ background: 'var(--bg-0)' }}>
    <TransitionSeries>
      <TransitionSeries.Sequence name="open" durationInFrames={60}>
        <AbsoluteFill>
          <OffthreadVideo src="assets/36b11e50.mp4" startFrom={0} />
          <Title text="Alligators" />
        </AbsoluteFill>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="detail" durationInFrames={45}>
        <OffthreadVideo src="assets/36b11e50.mp4" startFrom={Math.round(6.4 * FPS)} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="logo" durationInFrames={50}>
        <OffthreadVideo src="assets/9f2a11bc.mp4" startFrom={Math.round(1.2 * FPS)} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio src="assets/deadbeef.mp3" volume={(f) => interpolate(f, [TOTAL - 20, TOTAL], [1, 0], { extrapolateLeft: 'clamp' })} />
  </AbsoluteFill>
);

export default function Canvas() {
  return (
    <DesignCanvas>
      <DCSection title="Reel">
        <DCArtboard id="reel" label="Reel" width={1920} height={1080}>
          <VideoComp component={Reel} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
```

For 6+ beats, write 6+ literal blocks — verbose but Timeline-parseable
(drag-to-retime, per-beat inspect, ⇄ replace-media). **Never** shorten with a
loop.

## Verify + hand off

- **Motion over time** (DDR-094 / DDR-148): seek to two frames (or scrub the
  Player) and confirm the frame content changes — a still can look right while
  the video is frozen. The motion-critic hard-gates this.
- **Export**: `/design:export mp4 --scope artboard` (fps/duration from the comp
  meta) — the DDR-148 capture spine, no renderer binaries.
- **License note**: Remotion is source-available (free for individuals / ≤3-person
  companies) — surface once, per `video-comp` SKILL.md.
