/**
 * @canvas      Smoke TSX — TSX runtime smoke (single artboard, useState round-trip)
 * @ds          project
 * @platform    web-desktop
 * @opt_out     none
 * @artboards   primary
 * @brief       Minimal canvas that exercises the dev-server pipeline end-to-end:
 *              data-cd-id injection, canvas-lib import via the virtual module,
 *              React 19 useState, and a single fixed-size artboard.
 * @stack       React 19 · TSX · Bun.build · css_mode=inline
 * @history     _history/ui_Smoke-TSX/
 * @handoff     bunx shadcn add file://./Smoke TSX.registry.json
 *
 * Authored under the project DS. Tokens + shared component classes load via the
 * dev-server's _shell.html harness. The frame envelope below is imported from
 * the project-owned canvas library (virtual specifier → `_lib/canvas-lib.tsx`).
 */

import { useState } from "react";

import { DesignCanvas, DCSection, DCArtboard } from "@maude/canvas-lib";

export default function SmokeTSX() {
  const [n, setN] = useState(0);
  return (
    <DesignCanvas>
      <DCSection id="overview" title="TSX runtime smoke">
        <DCArtboard id="primary" label="A · primary" width={720} height={320}>
          <div className="mdcc" style={{ padding: 32, fontFamily: "monospace" }}>
            <h1 data-dc-element="title">TSX smoke canvas</h1>
            <button
              type="button"
              onClick={() => setN(n + 1)}
              style={{
                padding: "8px 14px",
                border: "1px solid currentColor",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              clicked {n}
            </button>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}
