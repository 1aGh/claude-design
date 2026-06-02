import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { BrowserChrome, TerminalFrame } from '../lib/capture-frames';
import { LowerThird } from '../lib/LowerThird';
import { IntroScene } from '../scenes/01-intro';
import { OutroScene } from '../scenes/03-outro';
import { BenefitCard } from '../scenes/05-benefit-card';
import { SplitScreenFrame } from '../scenes/06-split-screen';

/**
 * Final v2.1 — single perfect cut, 16 scenes, 15 xfades.
 *
 * Frame budget per storyboard.md (30 fps):
 *
 *   intro          75   IntroScene
 *   install       210   VHS scene-install-init-serve.mp4
 *   tui-setup-ds  165   VHS scene-tui-setup-ds-dryrun.mp4
 *   ds-reveal     210   Playwright scene-ds-reveal.mp4
 *   card-A         75   <BenefitCard kind="local-figma">
 *   tui-new       360   <SplitScreenFrame> VHS+Playwright (real /design:new)
 *   canvas-reveal 180   Playwright scene-canvas-reveal.mp4
 *   canvas-hero   270   Playwright scene-canvas-hero.mp4
 *   card-B         75   <BenefitCard kind="all-in-one">
 *   tui-edit      360   <SplitScreenFrame> VHS+Playwright (real /design:edit)
 *   comments      210   Playwright scene-comments.mp4
 *   annotations   165   Playwright scene-annotations.mp4
 *   card-C         75   <BenefitCard kind="human-ai">
 *   docs          120   Playwright scene-docs.mp4
 *   card-D         75   <BenefitCard kind="your-repo">
 *   outro          90   OutroScene
 *   ────────────────────
 *   sum         2715 frames
 *   - 15 xfades × 12 = 180 overlap
 *   = 2535 frames = 84.5 s on-screen.
 *
 * Captions overlay only over capture scenes (intro/outro/cards carry their
 * own typography). Strings live in CAPTIONS below — sourced verbatim from
 * storyboard.md § Caption strings.
 */

const XFADE = 12;

const SCENES = {
  intro: 75,
  install: 210,
  tuiSetupDs: 165,
  dsReveal: 210,
  cardA: 75,
  tuiNew: 360,
  canvasReveal: 180,
  canvasHero: 270,
  cardB: 75,
  tuiEdit: 360,
  comments: 210,
  annotations: 165,
  cardC: 75,
  docs: 120,
  cardD: 75,
  outro: 90,
} as const;

// Caption start = scene-start in the assembled timeline (xfades subtract
// duration each, so cumulative offset = sum(prev) - XFADE × prev-xfade-count).
// We compute starts below for the lower-third overlays.
const captionStarts = (() => {
  const order: (keyof typeof SCENES)[] = [
    'intro',
    'install',
    'tuiSetupDs',
    'dsReveal',
    'cardA',
    'tuiNew',
    'canvasReveal',
    'canvasHero',
    'cardB',
    'tuiEdit',
    'comments',
    'annotations',
    'cardC',
    'docs',
    'cardD',
    'outro',
  ];
  const starts: Record<string, number> = {};
  let cursor = 0;
  for (let i = 0; i < order.length; i++) {
    starts[order[i]] = cursor;
    cursor += SCENES[order[i]] - (i < order.length - 1 ? XFADE : 0);
  }
  return starts as Record<keyof typeof SCENES, number>;
})();

const CAPTIONS: Partial<Record<keyof typeof SCENES, string>> = {
  install: 'Install. Init. Serve.',
  tuiSetupDs: 'Onboarding is a slash command.',
  dsReveal: 'Design system from a paragraph.',
  tuiNew: 'One slash. Real canvas, real code.',
  canvasReveal: 'Multi-artboard. Pan. Zoom. Ship.',
  canvasHero: 'Cmd+Click. The file Claude needs.',
  tuiEdit: 'Edit. Reload. Same canvas.',
  comments: 'Comments anchored to pixels. No exports.',
  annotations: 'Draw on the canvas. Hand it off.',
  docs: 'Docs at maude.iagh.cz.',
};

const xfade = () => (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: XFADE })}
  />
);

export const Final = () => (
  <AbsoluteFill>
    <Audio src={staticFile('ambient.aac')} volume={0.7} />

    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENES.intro}>
        <IntroScene />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.install}>
        <TerminalFrame src="scene-install-init-serve.mp4" />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.tuiSetupDs}>
        {/* Real tape is ~40s; clip via startFrom/endAt (frames-at-fps, NOT seconds).
            We start ~22s in (660 frames) where Stage 1 prompt is rendering. */}
        <TerminalFrame src="scene-tui-setup-ds-dryrun.mp4" startFrom={660} />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.dsReveal}>
        {/* clip is ~11.6 s; skip the 3 s hydration preamble. */}
        <BrowserChrome src="scene-ds-reveal.mp4" urlBar="localhost:4400" startFrom={90} />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.cardA}>
        <BenefitCard kind="local-figma" />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.tuiNew}>
        {/* Split-screen: VHS clipped to first ~40s of activity (typing +
            spinner + streaming); Playwright clipped to last 12s where the
            canvas materializes. */}
        <SplitScreenFrame
          leftSrc="scene-tui-new.mp4"
          rightSrc="scene-canvas-appears.mp4"
          leftPlaybackRate={3}
          rightStartFrom={90}
          urlBar="localhost:4400"
        />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.canvasReveal}>
        {/* clip ~10.6 s; skip 6 s of hydration + click + zoom-reset preamble. */}
        <BrowserChrome src="scene-canvas-reveal.mp4" urlBar="localhost:4400" startFrom={180} />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.canvasHero}>
        {/* clip ~14.4 s; skip 6 s preamble; Cmd+hover beats land 4.5/6/7.5s of clip. */}
        <BrowserChrome src="scene-canvas-hero.mp4" urlBar="localhost:4400" startFrom={180} />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.cardB}>
        <BenefitCard kind="all-in-one" />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.tuiEdit}>
        <SplitScreenFrame
          leftSrc="scene-tui-edit.mp4"
          rightSrc="scene-canvas-edit.mp4"
          leftPlaybackRate={1.5}
          rightStartFrom={4500} /* skip first 150 s of 306 s playwright capture (post-edit half) */
          urlBar="localhost:4400"
        />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.comments}>
        {/* clip ~13.8 s; skip 6 s preamble — pin drops at ~8-9 s of clip. */}
        <BrowserChrome src="scene-comments.mp4" urlBar="localhost:4400" startFrom={180} />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.annotations}>
        {/* clip ~13.2 s; skip 5 s preamble — pen/arrow/label land 6-12 s of clip. */}
        <BrowserChrome src="scene-annotations.mp4" urlBar="localhost:4400" startFrom={150} />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.cardC}>
        <BenefitCard kind="human-ai" />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.docs}>
        <BrowserChrome src="scene-docs.mp4" urlBar="maude.iagh.cz" />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.cardD}>
        <BenefitCard kind="your-repo" />
      </TransitionSeries.Sequence>
      {xfade()}

      <TransitionSeries.Sequence durationInFrames={SCENES.outro}>
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>

    {(Object.keys(CAPTIONS) as (keyof typeof SCENES)[]).map((key) => (
      <Sequence key={key} from={captionStarts[key]} durationInFrames={SCENES[key]}>
        <LowerThird caption={CAPTIONS[key] as string} durationInFrames={SCENES[key]} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

// Total: sum(SCENES) - 15 × XFADE
// = 2715 - 180 = 2535 frames @ 30fps = 84.5 s on-screen.
export const FINAL_DURATION_FRAMES = Object.values(SCENES).reduce((s, n) => s + n, 0) - 15 * XFADE;
