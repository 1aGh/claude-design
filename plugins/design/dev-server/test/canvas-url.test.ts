// DDR-093 — canvasUrl() token-resolution. Regression guard for the
// "non-default-DS UI canvas renders unstyled" bug: every `ui/*.tsx` authored
// under a non-default design system used to load designSystems[0]'s tokens
// (scoped to a different `.<rootClass>` subtree) so every `var(--*)` went
// undefined and the canvas rendered white.

import { describe, expect, test } from 'bun:test';

import { canvasUrl, urlOf } from '../client/canvas-url.js';

// Mirrors this repo's real multi-DS config: `project` is the default (ds0),
// `maude` is the non-default one that the bug broke.
const cfg = {
  designRel: '.design',
  designSystems: [
    { name: 'project', path: 'system/project', tokensCssRel: 'system/project/colors_and_type.css' },
    { name: 'maude', path: 'system/maude', tokensCssRel: 'system/maude/colors_and_type.css' },
  ],
};

function paramsOf(url: string): URLSearchParams {
  const qs = url.split('?')[1] ?? '';
  return new URLSearchParams(qs);
}

describe('canvasUrl — per-canvas design-system token resolution', () => {
  test('explicit opts.ds resolves a non-default DS canvas to its OWN tokens', () => {
    const p = paramsOf(canvasUrl('.design/ui/Studio.tsx', cfg, { ds: 'maude' }));
    expect(p.get('tokens')).toBe('system/maude/colors_and_type.css');
    expect(p.get('components')).toBe('system/maude/preview/_components.css');
  });

  test('RCA interface form — relative path + opts.ds', () => {
    const p = paramsOf(canvasUrl('ui/Studio.tsx', cfg, { ds: 'maude' }));
    expect(p.get('tokens')).toBe('system/maude/colors_and_type.css');
    expect(p.get('components')).toBe('system/maude/preview/_components.css');
  });

  test('opts.ds = the default DS resolves to ds0 tokens', () => {
    const p = paramsOf(canvasUrl('.design/ui/Studio.tsx', cfg, { ds: 'project' }));
    expect(p.get('tokens')).toBe('system/project/colors_and_type.css');
    expect(p.get('components')).toBe('system/project/preview/_components.css');
  });

  test('cfg.canvasDesignSystems map drives resolution when opts.ds is absent', () => {
    const withMap = { ...cfg, canvasDesignSystems: { '.design/ui/Studio.tsx': 'maude' } };
    const p = paramsOf(canvasUrl('.design/ui/Studio.tsx', withMap));
    expect(p.get('tokens')).toBe('system/maude/colors_and_type.css');
    expect(p.get('components')).toBe('system/maude/preview/_components.css');
  });

  test('opts.ds wins over the map', () => {
    const withMap = { ...cfg, canvasDesignSystems: { '.design/ui/Studio.tsx': 'maude' } };
    const p = paramsOf(canvasUrl('.design/ui/Studio.tsx', withMap, { ds: 'project' }));
    expect(p.get('tokens')).toBe('system/project/colors_and_type.css');
  });

  test('unknown / no DS falls back to ds0 (single-DS + legacy behavior intact)', () => {
    const p = paramsOf(canvasUrl('.design/ui/Plain.tsx', cfg, {}));
    expect(p.get('tokens')).toBe('system/project/colors_and_type.css');
    expect(p.get('components')).toBe('system/project/preview/_components.css');
  });

  test('an unknown DS name (not in designSystems) falls back to ds0, never undefined', () => {
    const p = paramsOf(canvasUrl('.design/ui/Ghost.tsx', cfg, { ds: 'does-not-exist' }));
    expect(p.get('tokens')).toBe('system/project/colors_and_type.css');
  });

  test('specimen paths stay path-resolved and are unaffected by the map', () => {
    const withWrongMap = {
      ...cfg,
      // A bogus map entry must NOT override the specimen branch.
      canvasDesignSystems: { '.design/system/maude/preview/Buttons.tsx': 'project' },
    };
    const p = paramsOf(canvasUrl('.design/system/maude/preview/Buttons.tsx', withWrongMap));
    expect(p.get('tokens')).toBe('system/maude/colors_and_type.css');
    expect(p.get('layout')).toBe('system/maude/preview/_layout.css');
    expect(p.get('components')).toBe('system/maude/preview/_components.css');
  });

  test('the bug it guards against: ds0 is the WRONG DS for a maude canvas', () => {
    // Documents the failure mode — with neither opts.ds nor a map entry the
    // resolver returns designSystems[0] (project), which is exactly what broke a
    // maude canvas before DDR-093. The fix is that the map now supplies 'maude'.
    const p = paramsOf(canvasUrl('.design/ui/Studio.tsx', cfg));
    expect(p.get('tokens')).toBe('system/project/colors_and_type.css'); // ds0 — wrong for maude
    const fixed = paramsOf(
      canvasUrl('.design/ui/Studio.tsx', {
        ...cfg,
        canvasDesignSystems: { '.design/ui/Studio.tsx': 'maude' },
      })
    );
    expect(fixed.get('tokens')).toBe('system/maude/colors_and_type.css'); // fixed
  });

  test('non-tsx paths bypass the shell and return a direct URL', () => {
    expect(canvasUrl('.design/ui/legacy.html', cfg)).toBe(urlOf('.design/ui/legacy.html'));
  });
});
