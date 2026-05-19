// Phase 4 T7 — verify `applyHandoffStaticOverrides()` strips engine-bearing
// code from handoff inline output. Engine exports (useViewportController,
// DCMiniMap, DCZoomToolbar, ...) MUST NOT travel into a registry item.

import { describe, expect, test } from 'bun:test';

import { buildLibMap, inlineUsedExports } from '../canvas-lib-inline.ts';
import { HANDOFF_STATIC_FRAME_EXPORTS, applyHandoffStaticOverrides } from '../handoff.ts';

const LIB_PATH = '/virtual/_lib/canvas-lib.tsx';

// Trimmed canvas-lib sample — DesignCanvas pulls useViewportController +
// WorldContext + DCMiniMap + DCZoomToolbar transitively (the real shape).
const LIB_SOURCE = `
import { createContext, useContext } from "react";

export function useViewportController() {
  return { viewport: { x: 0, y: 0, zoom: 1 } };
}

export function DCMiniMap() { return <div className="dc-mm" />; }
export function DCZoomToolbar() { return <div className="dc-zoom-tb" />; }

const WorldContext = createContext(null);
function harvestArtboards(c) { return c; }
function synthDefaultGrid(s) { return s; }

export function DesignCanvas({ children }) {
  const ctl = useViewportController();
  const seeds = harvestArtboards(children);
  const layout = synthDefaultGrid(seeds);
  return (
    <WorldContext.Provider value={{ ctl, layout }}>
      <div className="dc-canvas">
        <div className="dc-world" style={{transform:'translate(0,0) scale(1)'}}>{children}</div>
        <DCMiniMap />
        <DCZoomToolbar />
      </div>
    </WorldContext.Provider>
  );
}

export function DCSection({ id, title, children }) {
  const ctx = useContext(WorldContext);
  return <section className="dc-section" data-dc-section={id} data-ctx={!!ctx}><h2>{title}</h2>{children}</section>;
}

export function DCArtboard({ id, label, width, height, children }) {
  const ctx = useContext(WorldContext);
  return (
    <article className="dc-artboard" data-dc-screen={id} data-has-ctx={!!ctx} style={{ width, height }}>
      <header>{label}</header>
      <div>{children}</div>
    </article>
  );
}
`;

const SAMPLE_CANVAS = `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib";
export default function X() {
  return (
    <DesignCanvas>
      <DCSection id="s" title="S">
        <DCArtboard id="a" label="A" width={100} height={100}>hi</DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
`;

describe('handoff-static-frames', () => {
  test('HANDOFF_STATIC_FRAME_EXPORTS lists DesignCanvas + DCSection + DCArtboard', () => {
    expect([...HANDOFF_STATIC_FRAME_EXPORTS].sort()).toEqual(
      ['DCArtboard', 'DCSection', 'DesignCanvas']
    );
  });

  test('without overrides — engine code IS pulled into the handoff inline', () => {
    const libMap = buildLibMap(LIB_PATH, LIB_SOURCE);
    const r = inlineUsedExports(SAMPLE_CANVAS, libMap);
    // BFS dragged in everything DesignCanvas needs.
    expect(r.content).toContain('useViewportController');
    expect(r.content).toContain('DCMiniMap');
    expect(r.content).toContain('DCZoomToolbar');
    expect(r.content).toContain('WorldContext');
  });

  test('with overrides — engine code is stripped from handoff inline', () => {
    const libMap = buildLibMap(LIB_PATH, LIB_SOURCE);
    applyHandoffStaticOverrides(libMap);
    const r = inlineUsedExports(SAMPLE_CANVAS, libMap);
    expect(r.content).not.toContain('useViewportController');
    expect(r.content).not.toContain('DCMiniMap');
    expect(r.content).not.toContain('DCZoomToolbar');
    expect(r.content).not.toContain('WorldContext');
    expect(r.content).not.toContain('harvestArtboards');
    expect(r.content).not.toContain('synthDefaultGrid');
    // The static frame replacements ARE present.
    expect(r.content).toContain('function DesignCanvas');
    expect(r.content).toContain('function DCSection');
    expect(r.content).toContain('function DCArtboard');
    // The static DesignCanvas is the minimal `<div className="dc-canvas">` form.
    expect(r.content).toContain('<div className="dc-canvas">{children}</div>');
  });

  test('overrides are a no-op when the canvas does not import the frame', () => {
    const libMap = buildLibMap(LIB_PATH, LIB_SOURCE);
    applyHandoffStaticOverrides(libMap);
    // Canvas only imports DCArtboard — DesignCanvas + DCSection stay unused.
    const canvas = `import { DCArtboard } from "@mdcc/canvas-lib";
export default function Y() {
  return <DCArtboard id="x" label="X" width={10} height={10}>hi</DCArtboard>;
}
`;
    const r = inlineUsedExports(canvas, libMap);
    expect(r.content).toContain('function DCArtboard');
    expect(r.content).not.toContain('function DesignCanvas');
    expect(r.content).not.toContain('function DCSection');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4.2 — drag + snap exports must also be stripped from handoff output.
// The real DCArtboard references useArtboardDrag (and friends) internally;
// the static-frame override breaks that chain. This test pins that behavior.

const LIB_SOURCE_4_2 = `
import { createContext, useContext } from "react";

export function useViewportController() { return { viewport: { x: 0, y: 0, zoom: 1 } }; }
export function DCMiniMap() { return <div />; }
export function DCZoomToolbar() { return <div />; }

const WorldContext = createContext(null);
function harvestArtboards(c) { return c; }
function synthDefaultGrid(s) { return s; }

export function computeSnap(p, others, opts) { return { x: p.x, y: p.y, guides: [] }; }
export function useSnapGuides() { /* placeholder */ }
export function useArtboardDrag(opts) {
  const _snap = computeSnap;
  return { bindHandle: () => ({}), dragState: { kind: "idle" } };
}
const DragStateContext = createContext(null);
export function SnapGuideOverlay() {
  const ctx = useContext(DragStateContext);
  return ctx ? <div className="dc-snap-guide" /> : null;
}

export function DesignCanvas({ children }) {
  const ctl = useViewportController();
  const seeds = harvestArtboards(children);
  const layout = synthDefaultGrid(seeds);
  return (
    <WorldContext.Provider value={{ ctl, layout }}>
      <DragStateContext.Provider value={null}>
        <div className="dc-canvas">{children}<DCMiniMap /><DCZoomToolbar /><SnapGuideOverlay /></div>
      </DragStateContext.Provider>
    </WorldContext.Provider>
  );
}

export function DCSection({ id, title, children }) {
  return <section data-id={id}><h2>{title}</h2>{children}</section>;
}

export function DCArtboard({ id, label, width, height, children }) {
  const drag = useArtboardDrag({ artboardId: id });
  return (
    <article className="dc-artboard" data-dc-screen={id} {...drag.bindHandle()} style={{ width, height }}>
      <header>{label}</header>
      <div>{children}</div>
    </article>
  );
}
`;

const PHASE_4_2_CANVAS = `import { DesignCanvas, DCSection, DCArtboard } from "@mdcc/canvas-lib";
export default function X() {
  return (
    <DesignCanvas>
      <DCSection id="s" title="S">
        <DCArtboard id="a" label="A" width={100} height={100}>hi</DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
`;

describe('handoff-static-frames / Phase 4.2 drag + snap exports', () => {
  test('without overrides — drag + snap engine code IS pulled in (regression baseline)', () => {
    const libMap = buildLibMap(LIB_PATH, LIB_SOURCE_4_2);
    const r = inlineUsedExports(PHASE_4_2_CANVAS, libMap);
    // DCArtboard depends on useArtboardDrag → BFS reaches it.
    expect(r.content).toContain('useArtboardDrag');
    // DesignCanvas wraps SnapGuideOverlay → BFS reaches it.
    expect(r.content).toContain('SnapGuideOverlay');
  });

  test('with overrides — drag + snap engine code is stripped', () => {
    const libMap = buildLibMap(LIB_PATH, LIB_SOURCE_4_2);
    applyHandoffStaticOverrides(libMap);
    const r = inlineUsedExports(PHASE_4_2_CANVAS, libMap);
    expect(r.content).not.toContain('useArtboardDrag');
    expect(r.content).not.toContain('SnapGuideOverlay');
    expect(r.content).not.toContain('computeSnap');
    expect(r.content).not.toContain('useSnapGuides');
    expect(r.content).not.toContain('DragStateContext');
    // Static frames still land as the minimal markup.
    expect(r.content).toContain('function DesignCanvas');
    expect(r.content).toContain('function DCArtboard');
  });
});
