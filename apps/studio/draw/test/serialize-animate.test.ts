import { describe, expect, test } from 'bun:test';
import { parallel, type Timeline, timeline, track } from '../animate.ts';
import { morphVariants } from '../morph.ts';
import { circle, type DrawPrimitive, path } from '../primitives.ts';
import { buildAnimPlan, toAnimatedJsx, toAnimatedSvg } from '../serialize-animate.ts';

// An animated mark: a morphing blob + a blinking eye + a rotating blob.
const blob = morphVariants('M10 50L50 10L90 50L50 90Z', {
  n: 3,
  jitter: 5,
  seed: 4,
  dur: 1.2,
  ease: [0.34, 1.42, 0.64, 1], // snap with overshoot
  target: 'blob',
});

const PRIMS: DrawPrimitive[] = [
  path({ d: 'M10 50L50 10L90 50L50 90Z', id: 'blob', fill: '#e94' }),
  circle({ cx: 50, cy: 45, r: 6, id: 'eye', fill: '#222' }),
];

const TL: Timeline = parallel(
  timeline({ tracks: [blob.track], repeat: 'indefinite' }),
  timeline({
    tracks: [
      track(
        'opacity',
        [
          { t: 0, value: 1, ease: [0.42, 0, 0.58, 1] },
          { t: 0.5, value: 0.1 },
          { t: 1, value: 1 },
        ],
        'eye'
      ),
      track(
        'rotate',
        [
          { t: 0, value: 0 },
          { t: 1.2, value: 360 },
        ],
        'blob'
      ),
    ],
    repeat: 'indefinite',
  })
);

const OPTS = { viewBox: '0 0 100 100', pathRenderers: { blob: blob.toPath } };

describe('buildAnimPlan', () => {
  const plan = buildAnimPlan(TL, OPTS);
  test('one entry per targeted, ≥2-keyframe track', () => {
    expect(plan.length).toBe(3);
  });
  test('d-morph maps to <animate attributeName=d>', () => {
    const d = plan.find((e) => e.property === 'd');
    expect(d?.kind).toBe('animate');
    expect(d?.attr).toBe('d');
    expect(d?.values[0].startsWith('M')).toBe(true);
  });
  test('rotate maps to animateTransform', () => {
    const r = plan.find((e) => e.property === 'rotate');
    expect(r?.kind).toBe('animateTransform');
    expect(r?.attr).toBe('rotate');
  });
  test('keyTimes are normalized 0→1', () => {
    for (const e of plan) {
      expect(e.keyTimes[0]).toBe(0);
      expect(e.keyTimes[e.keyTimes.length - 1]).toBe(1);
    }
  });
  test('eased track carries n-1 keySplines', () => {
    const op = plan.find((e) => e.property === 'opacity');
    expect(op).toBeDefined();
    expect(op?.keySplines?.length).toBe((op?.values.length ?? 0) - 1);
  });
});

describe('toAnimatedSvg (SMIL)', () => {
  const svg = toAnimatedSvg(PRIMS, TL, OPTS);
  test('injects SMIL d-morph with spline easing', () => {
    expect(svg).toContain('<animate attributeName="d"');
    expect(svg).toContain('calcMode="spline"');
    expect(svg).toContain('keySplines=');
  });
  test('rotate is an additive animateTransform (no static-transform clobber)', () => {
    expect(svg).toMatch(/<animateTransform[^>]*type="rotate"[^>]*additive="sum"/);
  });
  test('preserves the overshoot handle verbatim in keySplines', () => {
    expect(svg).toContain('0.34 1.42 0.64 1');
  });
  test('emits a prefers-reduced-motion gate', () => {
    expect(svg).toContain('prefers-reduced-motion: reduce');
  });
  test('is a complete SVG document', () => {
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('repeatCount="indefinite"');
  });
});

describe('toAnimatedJsx (single-source parity)', () => {
  const svg = toAnimatedSvg(PRIMS, TL, OPTS);
  const jsx = toAnimatedJsx(PRIMS, TL, OPTS);
  const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

  test('same count of <animate> elements as the SVG form', () => {
    expect(count(jsx, /<animate /g)).toBe(count(svg, /<animate /g));
  });
  test('same count of <animateTransform> elements as the SVG form', () => {
    expect(count(jsx, /<animateTransform /g)).toBe(count(svg, /<animateTransform /g));
  });
  test('omits the xmlns document marker', () => {
    expect(jsx).not.toContain('xmlns=');
  });
  test('keeps the SMIL animation attributes (host renders SMIL)', () => {
    expect(jsx).toContain('attributeName="d"');
    expect(jsx).toContain('keyTimes=');
  });
});

describe('fail-loud', () => {
  test('a track targeting a missing id throws', () => {
    const bad = timeline({
      tracks: [
        track(
          'opacity',
          [
            { t: 0, value: 0 },
            { t: 1, value: 1 },
          ],
          'ghost'
        ),
      ],
      repeat: 1,
    });
    expect(() => toAnimatedSvg(PRIMS, bad, { viewBox: '0 0 100 100' })).toThrow(/not found/);
  });
  test('a d-morph track without a pathRenderer throws', () => {
    const tl = timeline({ tracks: [blob.track], repeat: 1 });
    expect(() => toAnimatedSvg(PRIMS, tl, { viewBox: '0 0 100 100' })).toThrow(/pathRenderer/);
  });
});
