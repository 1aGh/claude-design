import { Composition } from 'remotion';
import { Demo } from './compositions/Demo';
import { DemoCaptioned } from './compositions/DemoCaptioned';
import { Final } from './compositions/Final';
import { PlaceholderScene } from './scenes/_placeholder';
import { SmokeScene } from './scenes/_smoke';
import { IntroScene } from './scenes/01-intro';
import { ContentScene } from './scenes/02-content';
import { OutroScene } from './scenes/03-outro';
import { ColdOpenScene } from './scenes/v4/00-cold-open';
import { InstallScene } from './scenes/v4/05-install';

/**
 * Composition registry. One <Composition> per scene + the master Demo cut.
 *
 * Per-scene compositions enable Studio scene preview + the regression goldens
 * harness. The Demo composition is the assembled cut for `pnpm run render Demo`.
 *
 * Add new scenes via /flow:video-new-scene <id> <duration-seconds> "<caption>".
 */

export const Root = () => (
  <>
    <Composition
      id="scene-00-placeholder"
      component={PlaceholderScene}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="SmokeCard"
      component={SmokeScene}
      durationInFrames={90}
      fps={30}
      width={1280}
      height={720}
    />
    <Composition
      id="scene-01-intro"
      component={IntroScene}
      durationInFrames={60}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="scene-02-content"
      component={ContentScene}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="scene-03-outro"
      component={OutroScene}
      durationInFrames={75}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* ── v4 scenes (phase-16 rebuild — maude DS) ── */}
    <Composition
      id="v4-00-cold-open"
      component={ColdOpenScene}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="v4-05-install"
      component={InstallScene}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />

    <Composition
      id="Demo"
      component={Demo}
      durationInFrames={201}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="DemoCaptioned"
      component={DemoCaptioned}
      durationInFrames={201}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Final"
      component={Final}
      durationInFrames={2535}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
