# DDR-068: Preview specimens import `_layout.css` as their sole CSS entry; `/design:smoke` gates on computed style, not just "has content"

- **Date:** 2026-06-01
- **Status:** Accepted
- **Tags:** design, dev-server, smoke, render-gate, css, import-graph, regression-prevention, ux
- **Related:** [DDR-021](./DDR-021-design-smoke-gate-for-infra-and-bulk-ops.md), [DDR-019](./DDR-019-canvas-tsx-format.md), [DDR-025](./DDR-025-canvas-lib-single-source-in-dev-server.md), [RCA `issue-ds-preview-unstyled-specimens`](../logs/rca/issue-ds-preview-unstyled-specimens.md)

## Context

After the HTML→TSX "self-contained specimens" migration (commit `0f6b847`), the dev-server stopped global-injecting the shared stylesheets (`colors_and_type.css` + `_layout.css` + `_components.css`) into every canvas. Styling now depends **entirely** on each canvas's `import` graph — `canvas-build.ts:170` inlines only the CSS the bundler produced from `import "./x.css"` statements. The import graph became the single source of truth for "what styles this canvas", and it had two silent holes:

- **A — 5 specimens imported neither tokens nor layout** (`components-diff-view`, `components-monospace-table`, `iconography`, `selection`, `ui_kits-desktop-showcase`). Their own class CSS referenced `var(--bg-1)`, `var(--font-mono)`, … which were undefined → rendered unstyled.
- **B — `.btn`/`.input`/`.select`/`.textarea` live only in `preview/_components.css`, which no specimen imported** (and `_layout.css` `@import`ed only `colors_and_type.css`) → native browser controls across 12 specimens.

Both the prior repair (`745bcf0` — *"All five verified rendering via agent-browser"*) and **`/design:smoke` passed the broken specimens**, because both assert *"the DOM mounts / has content"*, not *"it is styled"*. `smoke.sh` probes `body.innerText.trim().length > 0` (the broken specimens had text) and `PNG > 2 KB` (they were ~5 KB). This is the exact *build-green ≠ user-visible-green* class DDR-021 exists to close — but DDR-021's gate stops at "renders", one layer above "renders **styled**".

The fix (commit `e5aa81e`) patched the import holes. This DDR records the **contract + the detection** so the class can't recur silently.

## Alternatives considered

- **Option A — Re-introduce global CSS injection** in the dev-server shell (auto-inject shared stylesheets into every canvas, as the pre-`0f6b847` HTML era did).
  - pros: specimens physically cannot forget styling; zero per-file discipline.
  - cons: reverses the deliberate self-contained-canvas architecture (DDR-019 / handoff bundles must be standalone for the shadcn `registry-item.json` export — a downstream consumer has no dev-server to inject for them); hidden magic that makes "what styles this file" un-greppable; a handoff bundle would render fine in-server and break on export. Rejected.
- **Option B — Mandate full per-specimen imports** (`colors_and_type.css` + `_layout.css` + `_components.css` + own) and rely on review.
  - pros: explicit, self-contained, no detection needed.
  - cons: 3–4 import lines per file, drift-prone — this is *exactly* the discipline that already failed. No safety net. Rejected as the sole measure.
- **Option C — Single CSS entry point + deterministic detection.** `_layout.css` becomes the one CSS entry: it `@import`s `colors_and_type.css` (tokens) **and** `_components.css` (controls). Every specimen imports just `_layout.css` (plus optionally its own component CSS). `/design:smoke` gains (1) a **computed-style gate** and (2) a **static import-graph lint**.
  - pros: one import per specimen; the token/control chain is centralized + DRY; keeps canvases self-contained (no hidden injection — the chain is real `@import`s the bundler follows, so handoff bundles inherit it); detection is deterministic and catches **both** holes (lint → forgotten import; computed-style → rendered-but-unstyled).
  - cons: smoke gets one extra `eval` per canvas; the computed-style heuristic needs a sane "is this a UA default" baseline to avoid false positives; the lint must understand transitive `@import` so it doesn't flag a specimen that correctly imports only `_layout.css`.

## Decision

We pick **Option C**.

1. **`_layout.css` is the single CSS entry point.** It `@import`s `../colors_and_type.css` (tokens) and `./_components.css` (`.btn`/`.input`/`.select`/`.textarea`). A specimen that imports `_layout.css` transitively gets tokens + layout + components.
2. **Every `system/*/preview/*.tsx` MUST import `_layout.css`** (directly, or via its own CSS `@import`ing it). It may add its own component CSS on top.
3. **`/design:smoke` (`smoke.sh`) gains two gates:**
   - **computed-style gate** — after mount, read the canvas body's resolved `font-family` and `background-color`; fail the canvas if they equal the UA default (e.g. serif `Times`, `rgba(0,0,0,0)` / `rgb(255,255,255)` against a DS that declares a non-white surface) instead of the DS token value. This is the "renders but unstyled" detector.
   - **static import-graph lint** — before/independent of render: assert every specimen reaches `_layout.css` in its import graph, and every shared `preview/_*.css` has **≥ 1 importer** (no orphaned shared partial like `_components.css` was).

This keeps the self-contained-canvas architecture intact (no resurrected global injection) while making the single entry point hard to forget and impossible to ship unstyled without a red smoke exit code.

## Consequences

**Positive:**
- The "renders but unstyled" regression class is closed at detection — deterministic, CI-gating via smoke's non-zero exit (extends DDR-021 down one layer to the **style** layer).
- One CSS import per specimen; the shared chain is DRY and greppable.
- Handoff/registry bundles stay self-contained — the `@import` chain is real, so an exported bundle carries its styling.
- Orphan-CSS lint surfaces dead shared partials generally, not just this instance.

**Negative / trade-offs:**
- Smoke is marginally slower (one extra `eval` per canvas) and the computed-style check is a **heuristic** — it needs a per-DS notion of "the token-resolved baseline" and a UA-default denylist; mis-tuned, it risks false positives (flagging an intentionally minimal specimen) or false negatives (a DS whose tokens happen to equal a UA default).
- The import-lint must parse transitive CSS `@import`, not just TSX `import`, or it will false-flag specimens that correctly import only `_layout.css`.
- `_layout.css` now pulls `_components.css` for **every** specimen — a few token-only specimens load CSS they don't visibly use (negligible; dev-only).

## Revisit when

- A DS legitimately needs a specimen with intentionally minimal / no DS styling (a "raw HTML reset" demo): add a per-specimen opt-out (e.g. `*.meta.json` `style_gate: "off"`) rather than weakening the global gate.
- The computed-style false-positive rate proves noisy in practice → fall back to the static import-lint alone (it catches both A and the orphan case deterministically; computed-style is the belt-and-suspenders).
- If a future architecture re-bundles all specimens behind a shared CSS layer (e.g. a per-DS `@layer` entry), the "single entry = `_layout.css`" rule moves to that entry; the smoke gates stay.

## Linked
- RCA: [`.ai/logs/rca/issue-ds-preview-unstyled-specimens.md`](../logs/rca/issue-ds-preview-unstyled-specimens.md)
- Fix commit: `e5aa81e` (restored the import holes)
- Regression chain: `0f6b847` (removed global injection) → `745bcf0` (fixed blank-mount only, not the missing CSS)
- Supersedes: —
- Implements into: `plugins/design/dev-server/bin/smoke.sh` (gates) + `plugins/design/commands/smoke.md` + the design-system scaffold spec in `plugins/design/skills/design-system/SKILL.md` (the `_layout.css`-is-sole-entry contract).
