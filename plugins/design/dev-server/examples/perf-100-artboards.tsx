/**
 * @canvas      Perf Lab — 100 DCArtboards × 30 nodes (Phase 4 T6)
 * @ds          project
 * @platform    web-desktop
 * @opt_out     full
 * @brief       Throwaway canvas for measuring pan/zoom FPS at scale. 100
 *              DCArtboards arranged on the default 3-col grid, each holding
 *              30 inert DOM nodes. No real CSS bling — solid background,
 *              hairline border, monospace label, that's it. The point is
 *              to stress the world-transform path, not to look pretty.
 *
 * Usage:
 *              1. Open in the dev-server, fit-to-screen (Cmd+0).
 *              2. Hold space and drag for 5 s; record FPS via window
 *                 `__perf__.fps()` (instrumentation below) or via Chrome
 *                 DevTools Performance panel.
 *              3. Zoom around the cursor with wheel for 5 s; record FPS.
 *              4. Compare against the Phase 3.4 perf budget targets.
 *
 * Results land in .ai/decisions/DDR-024 + .ai/logs/phase-4-perf-<date>.md.
 */

import { DCArtboard, DCSection, DesignCanvas } from '@maude/canvas-lib';
import { useEffect } from 'react';

const ARTBOARD_COUNT = 100;
const NODES_PER_ARTBOARD = 30;

/**
 * Tiny RAF-FPS sampler exposed on `window.__perf__` so the harness (or a
 * human at the DevTools console) can grab a 1 s rolling average without
 * installing anything. Idempotent — no-op on the second mount.
 */
function installFpsSampler(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __perf__?: { fps: () => number } };
  if (w.__perf__) return;
  let last = performance.now();
  const samples: number[] = [];
  const SAMPLE_WINDOW = 60; // ~1 s at 60 fps
  function tick(now: number) {
    const dt = now - last;
    last = now;
    if (dt > 0) {
      samples.push(1000 / dt);
      if (samples.length > SAMPLE_WINDOW) samples.shift();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  w.__perf__ = {
    fps: () => {
      if (samples.length === 0) return 0;
      const sum = samples.reduce((a, b) => a + b, 0);
      return Math.round((sum / samples.length) * 10) / 10;
    },
  };
}

function PerfArtboardBody({ index }: { index: number }) {
  const nodes = Array.from({ length: NODES_PER_ARTBOARD }, (_, i) => i);
  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        color: '#444',
      }}
    >
      {nodes.map((n) => (
        <div
          key={n}
          style={{
            padding: 8,
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 3,
            background: index % 2 === 0 ? '#fff' : '#fafafa',
            minHeight: 48,
          }}
        >
          AB{index.toString().padStart(3, '0')}·N{n.toString().padStart(2, '0')}
        </div>
      ))}
    </div>
  );
}

export default function Perf100Artboards() {
  useEffect(() => {
    installFpsSampler();
  }, []);
  const ids = Array.from({ length: ARTBOARD_COUNT }, (_, i) => i);
  return (
    <DesignCanvas>
      <DCSection id="perf-lab" title="Perf — 100 × 30">
        {ids.map((i) => {
          const id = `ab-${i.toString().padStart(3, '0')}`;
          const label = `AB-${i.toString().padStart(3, '0')} · ${NODES_PER_ARTBOARD}n`;
          return (
            <DCArtboard key={id} id={id} label={label} width={1280} height={820}>
              <PerfArtboardBody index={i} />
            </DCArtboard>
          );
        })}
      </DCSection>
    </DesignCanvas>
  );
}
