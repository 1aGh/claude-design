import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { maude } from '../../../lib/maude-tokens';
import { DottedCanvas, Caption } from '../../../lib/maude-stage';

/**
 * Scene 05 · Install — hook.
 *
 * ~5 s (150f @ 30fps). Signature: a raw terminal, monospace, no window chrome —
 * commands type themselves in. Intent: `npm i -g @1agh/maude` + `maude init`
 * visible, zero red error text.
 */

const MONO = maude.font.mono;

// Typewriter: reveal `text` over [start, start+dur] frames.
const typed = (frame: number, text: string, start: number, dur: number) => {
  const n = Math.round(
    interpolate(frame, [start, start + dur], [0, text.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  return text.slice(0, n);
};

const Line: React.FC<{ children: React.ReactNode; visible: boolean; color?: string }> = ({
  children,
  visible,
  color,
}) => (
  <div style={{ fontFamily: MONO, fontSize: 42, lineHeight: 1.7, color, opacity: visible ? 1 : 0 }}>
    {children}
  </div>
);

export const InstallScene = () => {
  const frame = useCurrentFrame();
  const t = maude.dark;

  const cmd1 = typed(frame, 'npm i -g @1agh/maude', 8, 30);
  const cmd2 = typed(frame, 'maude init', 60, 16);
  const blink = Math.floor(frame / 15) % 2 === 0;

  // Which line "owns" the caret right now.
  const caretOn1 = frame < 44;
  const caretOn2 = frame >= 56 && frame < 86;

  const CharCaret = () => (
    <span style={{ color: t.accent, opacity: blink ? 1 : 0 }}>▋</span>
  );

  return (
    <AbsoluteFill>
      <DottedCanvas theme="dark" style={{ justifyContent: 'center' }}>
        <div style={{ paddingLeft: 180, paddingRight: 120 }}>
          <Line visible color={t.fg0}>
            <span style={{ color: t.accent, marginRight: 18 }}>$</span>
            {cmd1}
            {caretOn1 ? <CharCaret /> : null}
          </Line>
          <Line visible={frame >= 46} color={t.success}>
            added @1agh/maude 0.29.0
          </Line>
          <Line visible={frame >= 56} color={t.fg0}>
            <span style={{ color: t.accent, marginRight: 18 }}>$</span>
            {cmd2}
            {caretOn2 ? <CharCaret /> : null}
          </Line>
          <Line visible={frame >= 90} color={t.success}>
            ✓ .ai/ scaffolded
          </Line>
        </div>

        <Caption theme="dark" frame={frame} from={112} text="two plugins, one CLI." />
      </DottedCanvas>
    </AbsoluteFill>
  );
};
