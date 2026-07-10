/**
 * @canvas   smoke · Minimal deterministic canvas for the desktop E2E pilot.
 * @platform desktop
 * @stack    React 19 · TSX · Bun.build
 *
 * Intentionally STATIC — no animation, no DS token dependency — so the harness
 * gets a stable DOM snapshot (open question 3 in the plan: freeze-frame
 * screenshots of animated canvases lie). Slug `ui/Smoke.tsx` → the sidebar row
 * carries `data-testid="canvas-row-ui-smoke"`.
 */
import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

export default function Smoke() {
  return (
    <DesignCanvas>
      <DCSection id="smoke" title="Maude desktop E2E" subtitle="SMOKE">
        <DCArtboard id="smoke" label="SMOKE/01 · RENDER" width={480} height={320}>
          <div
            data-testid="smoke-artboard-content"
            style={{ padding: 32, fontFamily: "system-ui, sans-serif", color: "#111" }}
          >
            <h1 data-testid="smoke-h1" style={{ margin: "0 0 8px" }}>Maude desktop E2E</h1>
            <p data-testid="smoke-p" style={{ margin: 0 }}>
              Deterministic, static canvas — proves the native shell booted the
              sidecar, navigated the webview, and rendered a canvas.
            </p>
            <p data-testid="smoke-mixed" style={{ margin: "8px 0 0" }}>Total: {1 + 1} items</p>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
