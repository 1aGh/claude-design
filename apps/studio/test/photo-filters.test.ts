// photo-filters.test.ts — Stage B, Task 4. Unit-tests the PURE pipeline planner
// (`planPhotoPipeline`) — filter/step COUNT + ORDER + params, never pixel output
// (pixel realization is browser-only, in pipeline.ts). No pixi import here: the
// whole point of the planner split is that this suite runs headlessly.

import { describe, expect, test } from 'bun:test';

import type { PhotoPipelineStep } from '../photo/filters.ts';
import { DUOTONE_FRAG_SOURCE, hexToRgb01, planPhotoPipeline } from '../photo/filters.ts';
import type { PhotoEdit } from '../photo/schema.ts';
import { PHOTO_PIPELINE_ORDER } from '../photo/schema.ts';

const stages = (steps: PhotoPipelineStep[]) => steps.map((s) => s.stage);

describe('planPhotoPipeline — neutrality', () => {
  test('null / empty / all-neutral edits produce no steps', () => {
    expect(planPhotoPipeline(null)).toEqual([]);
    expect(planPhotoPipeline(undefined)).toEqual([]);
    expect(planPhotoPipeline({})).toEqual([]);
    expect(planPhotoPipeline({ adjustments: { brightness: 0, contrast: 0 } })).toEqual([]);
    // Disabled sections never emit, regardless of their params.
    expect(
      planPhotoPipeline({
        duotone: { enabled: false, colorA: '#000000', colorB: '#ffffff', intensity: 1 },
        grain: { enabled: false, amount: 1 },
        pattern: { enabled: false, opacity: 1 },
        mask: { preset: 'none', strength: 1 },
      })
    ).toEqual([]);
  });
});

describe('planPhotoPipeline — ordering', () => {
  test('a fully-loaded edit emits every stage in PHOTO_PIPELINE_ORDER', () => {
    const edit: PhotoEdit = {
      // Deliberately author the object with keys OUT of pipeline order to prove
      // the planner re-orders rather than echoing insertion order.
      mask: { preset: 'vignette', strength: 0.5 },
      pattern: { enabled: true, type: 'grid', scale: 2, opacity: 0.4, blend: 'multiply' },
      grain: { enabled: true, amount: 0.3, size: 2 },
      duotone: { enabled: true, colorA: '#1a1a2e', colorB: '#e94560', intensity: 0.8 },
      adjustments: { contrast: 0.2, brightness: -0.1 },
    };
    const steps = planPhotoPipeline(edit);
    expect(stages(steps)).toEqual([...PHOTO_PIPELINE_ORDER]);
    // Exactly one step per stage.
    expect(steps.length).toBe(5);
  });

  test('partial edits keep relative order and skip absent stages', () => {
    const steps = planPhotoPipeline({
      mask: { preset: 'edge-fade', strength: 0.7 },
      adjustments: { hue: 40 },
    });
    expect(stages(steps)).toEqual(['adjustments', 'mask']);
  });
});

describe('planPhotoPipeline — adjustments sub-order + params', () => {
  test('color-matrix ops follow the fixed sub-order and carry normalized values', () => {
    const steps = planPhotoPipeline({
      // authored out of order:
      adjustments: {
        invert: 1,
        brightness: 0.5,
        hue: 90,
        contrast: -0.3,
        grayscale: 0.4,
        saturation: 0.2,
        sepia: 0.1,
        exposure: 0.6,
      },
    });
    expect(steps.length).toBe(1);
    const adj = steps[0];
    expect(adj.stage).toBe('adjustments');
    if (adj.stage !== 'adjustments') throw new Error('unreachable');
    expect(adj.ops.map((o) => o.op)).toEqual([
      'brightness',
      'exposure',
      'contrast',
      'saturation',
      'hue',
      'sepia',
      'grayscale',
      'invert',
    ]);
    // Values pass through untouched (normalization/mapping is a realizer concern).
    const byOp = Object.fromEntries(adj.ops.map((o) => [o.op, o.value]));
    expect(byOp.brightness).toBe(0.5);
    expect(byOp.hue).toBe(90);
    expect(byOp.contrast).toBe(-0.3);
  });

  test('only non-neutral adjustment fields become ops', () => {
    const steps = planPhotoPipeline({
      adjustments: { contrast: 0.5, brightness: 0, saturation: 0 },
    });
    const adj = steps[0];
    if (adj.stage !== 'adjustments') throw new Error('expected adjustments');
    expect(adj.ops.map((o) => o.op)).toEqual(['contrast']);
  });
});

describe('planPhotoPipeline — section defaults when enabled-but-unset', () => {
  test('enabled duotone/grain/pattern fill sensible defaults', () => {
    const steps = planPhotoPipeline({
      duotone: { enabled: true },
      grain: { enabled: true },
      pattern: { enabled: true },
    });
    const duo = steps.find((s) => s.stage === 'duotone');
    const grain = steps.find((s) => s.stage === 'grain');
    const pat = steps.find((s) => s.stage === 'pattern');
    expect(duo).toBeTruthy();
    expect(grain).toBeTruthy();
    expect(pat).toBeTruthy();
    if (duo?.stage === 'duotone') {
      expect(duo.colorA).toMatch(/^#[0-9a-f]{6}$/);
      expect(duo.colorB).toMatch(/^#[0-9a-f]{6}$/);
      expect(duo.intensity).toBeGreaterThan(0);
    }
    if (pat?.stage === 'pattern') expect(pat.type).toBe('dots');
  });
});

describe('hexToRgb01', () => {
  test('parses to normalized rgb', () => {
    expect(hexToRgb01('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb01('#ffffff')).toEqual([1, 1, 1]);
    const [r, g, b] = hexToRgb01('#804020');
    expect(r).toBeCloseTo(128 / 255, 5);
    expect(g).toBeCloseTo(64 / 255, 5);
    expect(b).toBeCloseTo(32 / 255, 5);
  });
  test('throws on malformed input', () => {
    expect(() => hexToRgb01('nope')).toThrow();
    expect(() => hexToRgb01('#fff')).toThrow();
  });
});

describe('duotone shader source', () => {
  test('is a non-empty GLSL string with the expected uniforms', () => {
    expect(DUOTONE_FRAG_SOURCE).toContain('uColorA');
    expect(DUOTONE_FRAG_SOURCE).toContain('uColorB');
    expect(DUOTONE_FRAG_SOURCE).toContain('uIntensity');
    expect(DUOTONE_FRAG_SOURCE).toContain('uTexture');
  });
});
