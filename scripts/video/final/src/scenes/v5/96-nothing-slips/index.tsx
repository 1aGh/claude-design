import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import {
  CARD_SHADOW,
  easeOut,
  font,
  lerp,
  maude,
  PANEL_SHADOW,
  Phrase,
  Void,
} from '../../../lib/v5-stage';

/**
 * Beat 96 · Nothing slips through (210f / 7s).
 *
 * The full /flow:done gate ticks green in a cascade — security (defender +
 * attacker) · code review · validation (lint/type/tests/build) · smoke · a
 * 5-platform scenario run — then the PR opens. Grounded: /flow:done +
 * /flow:validate + scenario-runner + security-auditor/ethical-hacker.
 * VO: "nothing ships unchecked — security, code review, tests, five platforms —
 * every time. Then it opens the PR."
 */
const t = maude.dark;

const GATES = [
  'Security review · defender + attacker',
  'Code review',
  'Validation · lint',
  'Validation · typecheck',
  'Validation · tests',
  'Validation · build',
  'Smoke tests',
];
const PLATFORMS = ['web · desktop', 'web · mobile', 'iOS · phone', 'iOS · tablet', 'Android'];

export const V5NothingSlips = () => {
  const frame = useCurrentFrame();
  const panel = easeOut(lerp(frame, [2, 18], [0, 1]));
  const pr = easeOut(lerp(frame, [168, 192], [0, 1]));

  return (
    <AbsoluteFill>
      <Void theme="dark" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1100,
            background: t.bg1,
            border: `1px solid ${t.border}`,
            borderRadius: 22,
            boxShadow: PANEL_SHADOW,
            padding: 44,
            opacity: panel,
            transform: `translateY(${interpolate(panel, [0, 1], [24, 0])}px) scale(${1 - pr * 0.04})`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 26 }}>
            <span style={{ fontFamily: font.display, fontWeight: 700, fontSize: 30, color: t.fg0 }}>
              /flow:done
            </span>
            <span style={{ marginLeft: 14, fontFamily: font.mono, fontSize: 18, color: t.fg2 }}>
              · the gate
            </span>
          </div>

          {GATES.map((g, i) => {
            const at = 14 + i * 14;
            const p = lerp(frame, [at, at + 12], [0, 1]);
            return (
              <div
                key={g}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 0',
                  borderBottom: `1px solid ${t.borderSubtle}`,
                  opacity: interpolate(p, [0, 0.3], [0.3, 1]),
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: p > 0.6 ? t.success : t.bg3,
                    color: t.bg0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    transform: `scale(${interpolate(p, [0.5, 1], [0.6, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
                  }}
                >
                  {p > 0.6 ? '✓' : ''}
                </span>
                <span style={{ fontFamily: font.body, fontSize: 23, color: t.fg0 }}>{g}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: font.mono,
                    fontSize: 16,
                    color: t.success,
                    opacity: p > 0.7 ? 1 : 0,
                  }}
                >
                  pass
                </span>
              </div>
            );
          })}

          {/* 5-platform scenarios */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20 }}>
            <span style={{ fontFamily: font.body, fontSize: 23, color: t.fg0, marginRight: 8 }}>
              Scenarios
            </span>
            {PLATFORMS.map((pf, i) => {
              const at = 120 + i * 8;
              const p = lerp(frame, [at, at + 10], [0, 1]);
              return (
                <span
                  key={pf}
                  style={{
                    fontFamily: font.mono,
                    fontSize: 15,
                    color: p > 0.6 ? t.success : t.fg3,
                    background: p > 0.6 ? t.bg2 : t.bg0,
                    border: `1px solid ${p > 0.6 ? t.success : t.borderSubtle}`,
                    borderRadius: 99,
                    padding: '6px 14px',
                    opacity: interpolate(p, [0, 0.3], [0.4, 1]),
                  }}
                >
                  {p > 0.6 ? '✓ ' : ''}
                  {pf}
                </span>
              );
            })}
          </div>
        </div>

        {/* PR opens */}
        <div
          style={{
            position: 'absolute',
            bottom: 120,
            width: 760,
            background: t.bg2,
            border: `1px solid ${t.success}`,
            borderRadius: 16,
            boxShadow: CARD_SHADOW,
            padding: '22px 28px',
            opacity: pr,
            transform: `translateY(${interpolate(pr, [0, 1], [30, 0])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: t.success,
              color: t.bg0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            ⊶
          </span>
          <div>
            <div style={{ fontFamily: font.body, fontWeight: 600, fontSize: 24, color: t.fg0 }}>
              Pull request opened
            </div>
            <div style={{ fontFamily: font.mono, fontSize: 17, color: t.fg2 }}>
              feat: hero on the new design system · all checks green
            </div>
          </div>
          <span
            style={{ marginLeft: 'auto', fontFamily: font.mono, fontSize: 16, color: t.success }}
          >
            ready to merge
          </span>
        </div>

        <Phrase frame={frame} from={150} text="every time." align="center" size={34} bottom={56} />
      </Void>
    </AbsoluteFill>
  );
};
