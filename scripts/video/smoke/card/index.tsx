import { Composition, registerRoot } from 'remotion';
import { SmokeCard } from './SmokeCard';

const Root = () => (
  <>
    <Composition
      id="SmokeCard"
      component={SmokeCard}
      durationInFrames={90}
      fps={30}
      width={1280}
      height={720}
    />
  </>
);

registerRoot(Root);
