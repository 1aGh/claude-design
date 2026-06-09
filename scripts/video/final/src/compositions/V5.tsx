import { AbsoluteFill, Series } from 'remotion';
import { V5ColdOpen } from '../scenes/v5/00-cold-open';
import { V5Questionary } from '../scenes/v5/10-questionary';
import { V5DesignSystem } from '../scenes/v5/20-design-system';
import { V5ItDraws } from '../scenes/v5/40-it-draws';
import { V5Critics } from '../scenes/v5/50-critics';
import { V5TalkCanvas } from '../scenes/v5/60-talk-canvas';
import { V5Multiplayer } from '../scenes/v5/65-multiplayer';
import { V5DrawCode } from '../scenes/v5/70-draw-code';
import { V5Animate } from '../scenes/v5/80-animate';
import { V5Handoff } from '../scenes/v5/90-handoff';
import { V5SecondBrain } from '../scenes/v5/92-second-brain';
import { V5DailyLoop } from '../scenes/v5/94-daily-loop';
import { V5NothingSlips } from '../scenes/v5/96-nothing-slips';
import { V5EndCard } from '../scenes/v5/99-end-card';

/**
 * V5 — the phase-16 feature SHOWREEL (supersedes V4's tutorial cut).
 *
 * 14 beats, hard cuts (Series). Arc: hook → DS from a conversation → it draws →
 * it judges itself → ✦ you direct it by pointing & drawing ✦ → multiplayer →
 * the moat (vector + motion) → ship → a second brain (memory · rhythm · gate).
 *
 * Grounded in real assets (real Studio/canvas/DS/moodboard captures + the real
 * geometry-engine mark). The storyboard (.design/ui/Studio Intro Video.tsx) was
 * inspiration only — these scenes elevate it per the executor directive.
 *
 * Frame budget (30 fps):
 *   00 cold-open    120   10 questionary 240   20 design-system 210
 *   (VO-timed) 00 159 · 10 251 · 20 270 · 40 208 · 50 209 · 60 318 · 65 225
 *   70 239 · 80 177 · 90 222 · 92 248 · 94 138 · 96 280 · 99 201
 *   ──────────────────────────────────────────────────────────────
 *   total = 3145 frames = 104.8 s   (hard cuts; beats sized to the VO takes)
 *
 * Render: bunx remotion render src/index.ts V5 out/v5/V5.mp4
 */
// Durations are timed to the actual ElevenLabs VO take per beat (+~0.9s breathing
// room) so each line sits cleanly inside its beat — no overlap, no drift. See
// scripts/video/v5/_audio-prompts.md for the VO/beat timecode map.
export const V5_SCENES: { id: string; component: React.FC; frames: number }[] = [
  { id: '00-cold-open', component: V5ColdOpen, frames: 159 },
  { id: '10-questionary', component: V5Questionary, frames: 251 },
  { id: '20-design-system', component: V5DesignSystem, frames: 270 },
  { id: '40-it-draws', component: V5ItDraws, frames: 208 },
  { id: '50-critics', component: V5Critics, frames: 209 },
  { id: '60-talk-canvas', component: V5TalkCanvas, frames: 318 },
  { id: '65-multiplayer', component: V5Multiplayer, frames: 225 },
  { id: '70-draw-code', component: V5DrawCode, frames: 239 },
  { id: '80-animate', component: V5Animate, frames: 177 },
  { id: '90-handoff', component: V5Handoff, frames: 222 },
  { id: '92-second-brain', component: V5SecondBrain, frames: 248 },
  { id: '94-daily-loop', component: V5DailyLoop, frames: 138 },
  { id: '96-nothing-slips', component: V5NothingSlips, frames: 280 },
  { id: '99-end-card', component: V5EndCard, frames: 201 },
];

export const V5_TOTAL_FRAMES = V5_SCENES.reduce((n, s) => n + s.frames, 0); // 2610

export const V5 = () => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Series>
      {V5_SCENES.map((s) => {
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
