/**
 * Animation primitives — single import surface for scenes.
 *
 * Provenance:
 *   - remotion-bits (av/remotion-bits, MIT): AnimatedText, GradientTransition,
 *     TypeWriter, CodeBlock, Particles, etc. Curated React components.
 *   - remotion-animated (stefanwittwer, MIT): <Animated by={[Fade(), Move(...)]}>
 *     declarative chained animations. Replaces hand-rolled spring()+interpolate
 *     for card entrances / exits.
 *
 * Scenes should import from this file, not from the packages directly. Lets
 * us swap implementations (e.g. if remotion-animated v3 changes its API) in
 * exactly one place.
 */

export {
  AnimatedText,
  CodeBlock,
  GradientTransition,
  MatrixRain,
  Particles,
  StaggeredMotion,
  TypeWriter,
} from 'remotion-bits';

export {
  Animated,
  CustomEasing,
  Ease,
  Fade,
  Move,
  Rotate,
  Scale,
  Size,
} from 'remotion-animated';
