import { AbsoluteFill, Series } from 'remotion';
import { ColdOpenScene } from '../scenes/v4/00-cold-open';
import { InstallScene } from '../scenes/v4/05-install';
import { OnboardingScene } from '../scenes/v4/10-onboarding';
import { MoodboardScene } from '../scenes/v4/12-moodboard';
import { DsRevealScene } from '../scenes/v4/15-ds-reveal';
import { DesignNewScene } from '../scenes/v4/20-design-new';
import { CriticsScene } from '../scenes/v4/25-critics';
import { CanvasPanScene } from '../scenes/v4/30-canvas-pan';
import { CmdClickScene } from '../scenes/v4/35-cmd-click';
import { DesignEditScene } from '../scenes/v4/40-design-edit';
import { CommentsScene } from '../scenes/v4/45-comments';
import { HandoffScene } from '../scenes/v4/50-handoff';
import { EndCardScene } from '../scenes/v4/55-end-card';

/**
 * V4 — the phase-16 rebuild. 13 signed-off scenes, the whole real loop, in the
 * maude product chrome. Hard cuts (Series) per the brief — no long dissolves.
 *
 * Frame budget (30 fps):
 *   00 cold-open    90    05 install     150    10 onboarding  180
 *   12 moodboard   150    15 ds-reveal   180    20 design:new  300
 *   25 critics     210    30 canvas-pan  180    35 cmd-click   180
 *   40 design:edit 270    45 comments    210    50 handoff     180
 *   55 end-card    120
 *   ──────────────────────────────────────────────────────────────
 *   total = 2400 frames = 80.0 s   (no overlap — hard cuts)
 *
 * Each scene has a paired _signoff-<id>.md under scripts/video/v4/.
 * Audio bed deferred (open question). Render: `bunx remotion render src/index.ts V4 out/v4/V4.mp4`.
 */

export const V4_SCENES: { id: string; component: React.FC; frames: number }[] = [
  { id: '00-cold-open', component: ColdOpenScene, frames: 90 },
  { id: '05-install', component: InstallScene, frames: 150 },
  { id: '10-onboarding', component: OnboardingScene, frames: 180 },
  { id: '12-moodboard', component: MoodboardScene, frames: 150 },
  { id: '15-ds-reveal', component: DsRevealScene, frames: 180 },
  { id: '20-design-new', component: DesignNewScene, frames: 300 },
  { id: '25-critics', component: CriticsScene, frames: 210 },
  { id: '30-canvas-pan', component: CanvasPanScene, frames: 180 },
  { id: '35-cmd-click', component: CmdClickScene, frames: 180 },
  { id: '40-design-edit', component: DesignEditScene, frames: 270 },
  { id: '45-comments', component: CommentsScene, frames: 210 },
  { id: '50-handoff', component: HandoffScene, frames: 180 },
  { id: '55-end-card', component: EndCardScene, frames: 120 },
];

export const V4_TOTAL_FRAMES = V4_SCENES.reduce((n, s) => n + s.frames, 0); // 2400

export const V4 = () => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Series>
      {V4_SCENES.map((s) => {
        const Scene = s.component;
        return (
          <Series.Sequence key={s.id} durationInFrames={s.frames}>
            <Scene />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
