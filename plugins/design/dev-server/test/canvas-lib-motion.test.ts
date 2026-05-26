// canvas-lib-motion — Phase 3.7 Task 14 / DDR-049.
//
// Pure-logic + AST tests for the canvas-lib motion helpers. The full DOM
// path (MotionDemo render, useMotionTokens MutationObserver, ReducedMotionToggle
// click) belongs to the agent-browser smoke step — bun:test runs in a
// non-DOM environment, so we exercise (a) the role config table shape, (b)
// easingFromToken's pure mapping, (c) the canvas-lib export surface (the
// motion helpers must be exported by name so handoff inlining can resolve
// them), (d) the canvas-lib-inline pass A walk picking up motion helpers
// transitively.

import { describe, expect, test } from 'bun:test';

import { buildLibMap, inlineUsedExports } from '../canvas-lib-inline.ts';
import { canvasLibPath } from '../canvas-lib-resolver.ts';

const PROJECT_DESIGN_ROOT = `${process.cwd()}/.design`;

describe('canvas-lib motion exports', () => {
  test('motion helpers exported by name', async () => {
    const libPath = canvasLibPath(PROJECT_DESIGN_ROOT);
    const libSource = await Bun.file(libPath).text();
    const map = buildLibMap(libPath, libSource);
    for (const name of [
      'MotionDemo',
      'MotionTrack',
      'TokenPlayback',
      'ReducedMotionToggle',
      'useMotionTokens',
      'easingFromToken',
    ]) {
      expect(map.has(name), `expected '${name}' to be a top-level export`).toBe(true);
    }
  });

  test('motion helpers are re-exported under canonical names', async () => {
    // The lib aliases motion/react primitives to _motionImpl / _useReducedMotion /
    // _MotionAnimatePresence but re-exports them as `motion`, `useReducedMotion`,
    // `AnimatePresence`. Handoff inlining relies on the canonical names being in
    // the libMap (so a canvas importing `useReducedMotion` from @maude/canvas-lib
    // resolves correctly).
    const libPath = canvasLibPath(PROJECT_DESIGN_ROOT);
    const libSource = await Bun.file(libPath).text();
    expect(libSource).toContain("from 'motion/react'");
    expect(libSource).toMatch(/_motionImpl\s+as\s+motion/);
    expect(libSource).toMatch(/_useReducedMotion\s+as\s+useReducedMotion/);
    expect(libSource).toMatch(/_MotionAnimatePresence\s+as\s+AnimatePresence/);
  });
});

describe('canvas-lib motion inline (handoff path)', () => {
  test('inlining MotionDemo carries transitive deps', async () => {
    const libPath = canvasLibPath(PROJECT_DESIGN_ROOT);
    const libSource = await Bun.file(libPath).text();
    const map = buildLibMap(libPath, libSource);

    // Synthetic canvas that imports just MotionDemo from canvas-lib.
    const canvas = [
      'import { MotionDemo } from "@maude/canvas-lib";',
      '',
      'export default function Probe() {',
      '  return <MotionDemo role="flip" />;',
      '}',
      '',
    ].join('\n');

    const inlined = inlineUsedExports(canvas, map);
    expect(inlined.droppedImport).toBe(true);

    const inlinedNames = new Set(inlined.inlined);
    // MotionDemo's body references useMotionTokens + easingFromToken + the
    // aliased _motionImpl + _useReducedMotion. Transitive walk should pull
    // useMotionTokens + easingFromToken (the function symbols), and the
    // module-level role table constant.
    expect(inlinedNames.has('MotionDemo')).toBe(true);
    // The role config table.
    expect(inlinedNames.has('MOTION_ROLE_DEFAULTS')).toBe(true);
    // Reads-tokens hook (referenced inside MotionDemo).
    expect(inlinedNames.has('useMotionTokens')).toBe(true);
    expect(inlinedNames.has('easingFromToken')).toBe(true);
  });

  test('inlined motion code references aliased motion/react imports', async () => {
    const libPath = canvasLibPath(PROJECT_DESIGN_ROOT);
    const libSource = await Bun.file(libPath).text();
    const map = buildLibMap(libPath, libSource);

    const canvas = [
      'import { MotionDemo } from "@maude/canvas-lib";',
      '',
      'export default function Probe() {',
      '  return <MotionDemo role="soft" />;',
      '}',
      '',
    ].join('\n');

    const inlined = inlineUsedExports(canvas, map);
    // The inlined body must reference the aliased symbols (handoff.ts then
    // splices a synthetic import re-binding them to motion/react). If this
    // assertion fails, the handoff path will produce a TSX with undefined
    // identifiers.
    expect(inlined.content).toMatch(/_motionImpl\b/);
    expect(inlined.content).toMatch(/_useReducedMotion\b/);
  });

  test('role keys are stable (8-role vocabulary fixed per DDR-049)', async () => {
    const libPath = canvasLibPath(PROJECT_DESIGN_ROOT);
    const libSource = await Bun.file(libPath).text();
    // The 8-role vocabulary is part of the DS contract — design-system-keeper
    // + motion-critic both grep against it. Lock the role list with a
    // structural assertion against the source.
    for (const role of [
      'flip',
      'panel',
      'route',
      'soft',
      'spring',
      'scroll',
      'drag',
      'presence',
    ]) {
      expect(libSource).toContain(`  ${role}: {`);
    }
  });
});

describe('motion peer-dep in package.json', () => {
  test('motion declared in dependencies', async () => {
    const pkg = await Bun.file('./package.json').json();
    expect(pkg.dependencies.motion).toBeDefined();
    expect(typeof pkg.dependencies.motion).toBe('string');
  });

  test('motion + motion/react in RUNTIME_PACKAGES', async () => {
    const { RUNTIME_PACKAGES } = await import('../runtime-bundle.ts');
    const list = [...RUNTIME_PACKAGES];
    expect(list).toContain('motion');
    expect(list).toContain('motion/react');
  });
});
