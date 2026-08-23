/**
 * @canvas   export · Deterministic canvas for the desktop export E2E.
 * @platform desktop
 * @stack    React 19 · TSX · Bun.build
 *
 * Deliberately separate from Smoke.tsx (which other scenarios assert the DOM
 * of) and deliberately carrying an IMAGE ASSET: the two defects the DDR-231
 * Phase 2 export work fixed were editor chrome leaking into the artifact and
 * assets never being embedded, and neither is observable on a canvas with no
 * picture in it. Slug `ui/Export.tsx` → `data-testid="canvas-row-ui-export"`.
 */
import { DCArtboard, DCSection, DesignCanvas } from "@maude/canvas-lib";

export default function ExportFixture() {
  return (
    <DesignCanvas>
      <DCSection id="export" title="Export E2E" subtitle="EXPORT">
        <DCArtboard id="board-a" label="EXPORT/01 · ARTIFACT" width={400} height={260}>
          <div
            data-testid="export-artboard-content"
            style={{ padding: 24, background: "#132038", color: "#f2efe6", height: "100%" }}
          >
            <h1 style={{ fontSize: 20, margin: 0 }}>Summer Camp</h1>
            <img src="assets/pic.png" width={96} height={96} alt="fixture" />
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
