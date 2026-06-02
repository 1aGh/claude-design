// use-canvas-activity — Phase 13. Pure reducer/key helpers + provider gating.
//
// bun:test runs without a live DOM renderer, so dynamic event-driven state
// (the `maude:activity` listener + fade timers) lives in the provider's
// useEffect and can't be driven here. We unit-test the pure core
// (applyActivityChange / activityKey / matchesArtboard) directly, and verify
// the provider → hook derivation via the SSR-capture pattern with `initialState`
// (which is also the WS-snapshot seed path).

import { describe, expect, test } from 'bun:test';

import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  type ActivityMessage,
  type CanvasActivity,
  CanvasActivityProvider,
  activityKey,
  applyActivityChange,
  matchesArtboard,
  useCanvasActivity,
} from '../use-canvas-activity.tsx';

describe('use-canvas-activity / activityKey', () => {
  test('canonical design-root-relative path is unchanged', () => {
    expect(activityKey('ui/Foo.tsx')).toBe('ui/Foo.tsx');
  });

  test('strips a known designRel prefix', () => {
    expect(activityKey('.design/ui/Foo.tsx', '.design')).toBe('ui/Foo.tsx');
    expect(activityKey('.design/ui/Foo.tsx', './.design')).toBe('ui/Foo.tsx');
  });

  test('normalizes back-slash + leading slash', () => {
    expect(activityKey('\\ui\\Foo.tsx')).toBe('ui/Foo.tsx');
    expect(activityKey('/ui/Foo.tsx')).toBe('ui/Foo.tsx');
  });

  test('leaves the path alone when designRel does not match', () => {
    expect(activityKey('ui/Foo.tsx', '.design')).toBe('ui/Foo.tsx');
  });
});

describe('use-canvas-activity / applyActivityChange', () => {
  const base: ActivityMessage = { file: 'ui/Foo.tsx', status: 'active', ts: 't1' };

  test('adds an active entry', () => {
    const next = applyActivityChange({}, base);
    expect(next['ui/Foo.tsx']).toEqual({ status: 'active', artboardIds: null, ts: 't1' });
  });

  test('idle overwrites the same key', () => {
    const a = applyActivityChange({}, base);
    const b = applyActivityChange(a, { file: 'ui/Foo.tsx', status: 'idle', ts: 't2' });
    expect(b['ui/Foo.tsx']?.status).toBe('idle');
  });

  test('carries artboard_ids → artboardIds', () => {
    const next = applyActivityChange({}, { ...base, artboard_ids: ['secondary'] });
    expect(next['ui/Foo.tsx']?.artboardIds).toEqual(['secondary']);
  });

  test('different files coexist; immutable update', () => {
    const a = applyActivityChange({}, base);
    const b = applyActivityChange(a, { file: 'ui/Bar.tsx', status: 'active', ts: 't3' });
    expect(Object.keys(b).sort()).toEqual(['ui/Bar.tsx', 'ui/Foo.tsx']);
    expect(b).not.toBe(a);
  });

  test('ignores a malformed message (no file)', () => {
    const a = applyActivityChange({}, base);
    const b = applyActivityChange(a, { file: '', status: 'active', ts: 'x' });
    expect(b).toBe(a);
  });
});

describe('use-canvas-activity / matchesArtboard', () => {
  test('null scope matches every artboard', () => {
    expect(matchesArtboard(null, 'primary')).toBe(true);
  });
  test('scoped list matches only listed ids', () => {
    expect(matchesArtboard(['secondary'], 'secondary')).toBe(true);
    expect(matchesArtboard(['secondary'], 'primary')).toBe(false);
  });
});

describe('use-canvas-activity / provider → hook derivation', () => {
  function capture(node: (v: CanvasActivity) => void, props: Parameters<typeof Wrap>[0]) {
    function Probe() {
      node(useCanvasActivity());
      return null;
    }
    renderToStaticMarkup(<Wrap {...props}>{<Probe />}</Wrap>);
  }
  function Wrap(props: {
    file?: string;
    designRel?: string;
    initialState?: Record<
      string,
      { status: 'active' | 'idle'; artboardIds: string[] | null; ts: string }
    >;
    children: ReactNode;
  }) {
    return (
      <CanvasActivityProvider
        file={props.file}
        designRel={props.designRel}
        initialState={props.initialState}
      >
        {props.children}
      </CanvasActivityProvider>
    );
  }

  test('active entry for the current canvas → present + active', () => {
    let v: CanvasActivity | null = null;
    capture(
      (x) => {
        v = x;
      },
      {
        file: 'ui/Test.tsx',
        initialState: { 'ui/Test.tsx': { status: 'active', artboardIds: null, ts: 't' } },
        children: null,
      }
    );
    expect(v).toMatchObject({
      present: true,
      active: true,
      artboardIds: null,
      fileLabel: 'Test.tsx',
    });
  });

  test('idle entry → present but not active (fading out)', () => {
    let v: CanvasActivity | null = null;
    capture(
      (x) => {
        v = x;
      },
      {
        file: 'ui/Test.tsx',
        initialState: { 'ui/Test.tsx': { status: 'idle', artboardIds: null, ts: 't' } },
        children: null,
      }
    );
    expect(v).toMatchObject({ present: true, active: false });
  });

  test('no entry for this canvas → inert', () => {
    let v: CanvasActivity | null = null;
    capture(
      (x) => {
        v = x;
      },
      {
        file: 'ui/Test.tsx',
        initialState: { 'ui/Other.tsx': { status: 'active', artboardIds: null, ts: 't' } },
        children: null,
      }
    );
    expect(v).toMatchObject({ present: false, active: false });
  });

  test('scoped artboardIds flow through', () => {
    let v: CanvasActivity | null = null;
    capture(
      (x) => {
        v = x;
      },
      {
        file: 'ui/Test.tsx',
        initialState: { 'ui/Test.tsx': { status: 'active', artboardIds: ['secondary'], ts: 't' } },
        children: null,
      }
    );
    expect(v?.artboardIds).toEqual(['secondary']);
  });

  test('designRel-prefixed current file is normalized to match server keys', () => {
    let v: CanvasActivity | null = null;
    capture(
      (x) => {
        v = x;
      },
      {
        file: '.design/ui/Test.tsx',
        designRel: '.design',
        initialState: { 'ui/Test.tsx': { status: 'active', artboardIds: null, ts: 't' } },
        children: null,
      }
    );
    expect(v).toMatchObject({ present: true, active: true });
  });

  test('outside a provider the hook is inert (no overlay)', () => {
    let v: CanvasActivity | null = null;
    function Probe() {
      v = useCanvasActivity();
      return null;
    }
    renderToStaticMarkup(<Probe />);
    expect(v).toMatchObject({ present: false, active: false });
  });
});
