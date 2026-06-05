// Per-DS tokensCssRel auto-resolution — load-bearing for DDR-048. When a
// config entry doesn't spell out `tokensCssRel`, the dev-server must derive
// it from `<entry.path>/colors_and_type.css` so the System view can read the
// scaffolded layout without forcing every config author to repeat the path.

import { describe, expect, test } from 'bun:test';
import { normalizeDesignSystems } from '../context';

const baseCfg = {
  name: 'fixture',
  projectLabel: null,
  designRoot: '.design',
  canvasGroups: [],
  rootClass: 'app',
  themeDefault: 'dark' as const,
  tokensCssRel: 'system/colors_and_type.css',
  teamAccentDefault: null,
  handoffTargets: [],
  newCanvasDir: 'ui',
  newComponentDir: 'ui/components',
  _source: '.design/config.json' as const,
};

describe('normalizeDesignSystems', () => {
  test('no designSystems → passthrough (top-level tokensCssRel is the only source)', () => {
    const out = normalizeDesignSystems({ ...baseCfg, designSystems: undefined });
    expect(out.designSystems).toBeUndefined();
    expect(out.tokensCssRel).toBe('system/colors_and_type.css');
  });

  test('empty designSystems array → passthrough', () => {
    const out = normalizeDesignSystems({ ...baseCfg, designSystems: [] });
    expect(out.designSystems).toEqual([]);
  });

  test('entry without tokensCssRel → derived from <path>/colors_and_type.css', () => {
    const out = normalizeDesignSystems({
      ...baseCfg,
      designSystems: [{ name: 'studyfi', path: 'system/studyfi' }],
    });
    expect(out.designSystems?.[0].tokensCssRel).toBe('system/studyfi/colors_and_type.css');
  });

  test('entry with explicit tokensCssRel → preserved (leading slash trimmed)', () => {
    const out = normalizeDesignSystems({
      ...baseCfg,
      designSystems: [
        { name: 'studyfi', path: 'system/studyfi', tokensCssRel: '/system/studyfi/tokens.css' },
      ],
    });
    expect(out.designSystems?.[0].tokensCssRel).toBe('system/studyfi/tokens.css');
  });

  test('path with leading + trailing slashes → normalized', () => {
    const out = normalizeDesignSystems({
      ...baseCfg,
      designSystems: [{ name: 'alpha', path: '/system/alpha/' }],
    });
    expect(out.designSystems?.[0].path).toBe('system/alpha');
    expect(out.designSystems?.[0].tokensCssRel).toBe('system/alpha/colors_and_type.css');
  });

  test('multiple entries → each resolved independently', () => {
    const out = normalizeDesignSystems({
      ...baseCfg,
      designSystems: [
        { name: 'alpha', path: 'system/alpha' },
        { name: 'beta', path: 'system/beta', tokensCssRel: 'system/beta/custom.css' },
      ],
    });
    expect(out.designSystems?.[0].tokensCssRel).toBe('system/alpha/colors_and_type.css');
    expect(out.designSystems?.[1].tokensCssRel).toBe('system/beta/custom.css');
  });

  test('preserves unrelated entry fields (description, rootClass, themes)', () => {
    const out = normalizeDesignSystems({
      ...baseCfg,
      designSystems: [
        {
          name: 'studyfi',
          path: 'system/studyfi',
          description: 'StudyFi production mirror',
          rootClass: 'studyfi',
          themeDefault: 'light',
          themes: ['light', 'dark'],
          newCanvasDir: 'ui/studyfi',
        },
      ],
    });
    const entry = out.designSystems?.[0];
    expect(entry?.description).toBe('StudyFi production mirror');
    expect(entry?.rootClass).toBe('studyfi');
    expect(entry?.themeDefault).toBe('light');
    expect(entry?.themes).toEqual(['light', 'dark']);
    expect(entry?.newCanvasDir).toBe('ui/studyfi');
  });
});
