# artboard-kinds

**Persona:** A designer organizing a multi-artboard canvas who wants each frame to declare **what it is** — a digital screen, a print page, a web flow, or a video comp — so the canvas shows the right chrome and the agent generates with the right rules. They expect to change an artboard's kind with one action (a picker or a right-click), see the chrome update instantly, and have it persist as a plain JSX prop they can read in the source.

**Feature under test:** `feature-1-artboard-kinds-foundation` (commit `0e001da7`, DDR-181) — the `kind` prop on `DCArtboard` (`digital`|`print`|`web`|`video`), per-kind chrome (icon chip + tint in the label strip), the `ArtboardGuidesOverlay` world-sibling primitive + per-user `overlays` visibility lane in `view.json`, and the two kind-switch surfaces (context-menu "Artboard kind" submenu + Inspector CSS-tab "Kind" picker). Both surfaces post to the `/_api/set-artboard-kind` write lane, which rides the AST attr-edit toolkit (`canvas-edit.ts`) with whole-file undo.

**Canvas under test:** `.design/ui/Artboard Kinds Lab.tsx` — a **throwaway verification fixture** (`@opt_out full`, `@ds maude`). Three `DCArtboard`s (`ak-alpha` / `ak-beta` / `ak-gamma`), all authored **without** a `kind` prop (so each resolves to the implicit `digital` default). Each carries a titled inner block so it renders visibly. Regenerable — delete and re-author from this description if absent.

## Hypothesis

- Every `DCArtboard` renders `data-dc-kind` on `.dc-artboard`, resolving to `digital` when the prop is absent (T1). A `digital` artboard shows **no** kind chip; the CSS gate is `[data-dc-kind]:not([data-dc-kind='digital'])`.
- Setting an artboard's kind to `print`|`web`|`video` (via either surface) writes an explicit `kind="…"` JSX prop to the source, flips `data-dc-kind` live (file-watcher hard-reload), and paints a per-kind **icon chip** (`.dc-artboard-kind-chip` with an SVG `ArtboardKindIcon`) + subtle tint in the label strip (T3). Setting kind back to **Digital** writes `kind: null` — clearing the explicit prop rather than writing `kind="digital"`.
- The change is **whole-file-undo reversible** (`/_api/set-artboard-kind` returns a `seq`; `pre-set-artboard-kind` snapshot).
- The **context menu** on an artboard exposes an **"Artboard kind ▸"** submenu (Digital (default) / Print / Web / Video) — the `themeItem` submenu pattern, posting `set-artboard-kind-request` to the shell (T8b).
- The **Inspector CSS tab**, with an artboard selected, renders a **"Kind"** section with a `<select aria-label="artboard kind">` whose options mirror the union and whose `onChange` calls the same write lane (T8a).
- Per-user guide **visibility** persists in `_canvas-state/<slug>.view.json` under `overlays` (never in the versioned `.meta.json`), GET-merged back on load (T6). NOTE: the live world-space guide-line assembly + intent-preset snapping **toggle UI is a documented scope trim** (T7 execute report) — foundation ships the data lane + overlay mount, not the guides toolbar.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1280×720+ | ✓ |
| web-mobile / ios-phone / ios-tablet / android-phone | — | **SKIPPED** |

Native + mobile **SKIPPED** — the Maude Studio dev-server is desktop-development tooling; artboard-kind chrome, the context menu, and the Inspector picker have no touch/mobile parity surface. Same rationale as `element-editing-resize-and-position` / `structural-and-scope`. Record as `SKIPPED reason="canvas editor is a desktop-only dev tool; no touch/mobile parity story"`. Project `platforms` in `.ai/workflows.config.json` is single-platform, so parity is N/A (not a gap).

## Preconditions

- Dev server booted in **same-origin mode** so the harness can reach the canvas iframe via `iframe.contentDocument`:
  `MAUDE_CANVAS_ORIGIN_SPLIT=0 MAUDE_SKIP_RUNTIME_BUILD=1 bun run apps/studio/server.ts --root . --port <N>`
- `.design/ui/Artboard Kinds Lab.tsx` present (re-author from the fixture description if absent), all three artboards at baseline (no `kind` prop).
- Browser viewport ≥ 1280×720. Isolated `agent-browser --session <name>` so concurrent runs don't scramble the tab.

## Driving model (agent-browser)

The artboard chrome (label strip, kind chip, context menu) lives in the **canvas iframe**; the Inspector / Kind picker live in the **parent shell**. With `MAUDE_CANVAS_ORIGIN_SPLIT=0` both are same-origin: reach the iframe from a shell-frame `eval` via `document.querySelector('iframe').contentDocument`.

- **Write-lane assertions** POST directly to `/_api/set-artboard-kind` with `{ canvas: ".design/ui/Artboard Kinds Lab.tsx", artboardId, kind }` and `Origin: http://localhost:<N>` (the route is `sameOriginWrite` + loopback gated). `canvas` is the **designRoot-relative source path**, NOT a slug. This is the exact op both UI surfaces invoke, so it exercises the AST write + snapshot + live re-render end-to-end.
- **Context-menu assertions** use real CDP right-click (`agent-browser mouse move <x> <y>` → `mouse down right` → `mouse up right`) on an artboard label strip, then read `.dc-context-menu` items. Menu open is timing-sensitive — settle ~1 s and read in the same step; repeated rapid right-clicks race the close.
- **Inspector-picker assertions:** artboard-frame **selection does not register reliably under headless synthetic/CDP clicks** (same limitation `structural-and-scope` Step 6 flags for artboard-frame selection). Assert the picker's existence + wiring from source (`ArtboardKnobs`, `app.jsx`) and verify the picker's write path via the shared `/_api/set-artboard-kind` lane rather than driving the `<select>` DOM. A future harness using real CDP move-tool drags on the artboard frame could assert the live dropdown.

## Steps

1. **Open the fixture; baseline.** Open the shell, click the `canvas-row-ui-artboard-kinds-lab` tree row, wait for the iframe. Assert `.dc-artboard` × 3, every `data-dc-kind === "digital"`, and `.dc-artboard-kind-chip` count = 0. Screenshot.
2. **Set kind → print (write lane).** POST `set-artboard-kind` `ak-alpha` → `print`. Assert `{ok:true, seq}`, the source gains `<DCArtboard kind="print" id="ak-alpha" …>`, and (after the watcher reload) `ak-alpha` `data-dc-kind === "print"` with a `.dc-artboard-kind-chip` (SVG icon) present; `ak-beta`/`ak-gamma` stay digital + chip-less. Screenshot.
3. **Null-clear → digital (undo semantics).** POST `ak-alpha` → `null`. Assert `{ok:true, seq}`, the `kind=` prop is **removed** from source (not rewritten to `"digital"`), and the live chip disappears.
4. **Three distinct kinds render distinct chrome.** POST `ak-alpha`→print, `ak-beta`→web, `ak-gamma`→video. Assert three distinct `data-dc-kind` values, three chips each with an `<svg>` icon, and a screenshot showing three visibly-distinct label strips. Then reset all three to `null`.
5. **Context-menu "Artboard kind" submenu (T8b).** Real right-click an artboard label strip. Assert `.dc-context-menu` lists **"Artboard kind ▸"** alongside "Theme ▸", "Delete artboard", "Export this artboard…". (Driving the submenu leaf is timing-sensitive; the parent item's presence + the write-lane proof of Step 2 together cover the surface.)
6. **Inspector Kind picker wiring (T8a).** Open View ▸ Inspector, CSS tab. Assert the panel renders and (source-verified) `ArtboardKnobs` gates a `<select aria-label="artboard kind">` on artboard selection whose `onChange` → `/_api/set-artboard-kind`. Live dropdown drive is a follow-up (artboard selection headless-limited).
7. **Guides visibility lane (T6).** Assert `view.json` accepts an `overlays.guides` PATCH that lands in `_canvas-state/<slug>.view.json` and never in the versioned `.meta.json`. (Data lane only — the guides toolbar/snapping UI is the T7 scope trim.)

## Success criteria

- Steps 1–5 PASS: baseline digital resolution + no chip, kind write → source prop + live chip + tint, null-clear removes the prop, three distinct kinds render distinct chrome, and the context-menu "Artboard kind ▸" submenu is present.
- Step 6 reports the Inspector picker as **source-verified + write-lane-proven**, live-dropdown-drive deferred (honest partial, not a false pass) — the headline write path IS proven via the shared route.
- Step 7 confirms the overlays data lane; the guides toolbar UI is explicitly out of foundation scope (T7).
- Zero JS console errors in the canvas iframe over the run.
- Cross-platform parity: N/A (web-desktop only by design; the other 4 documented as SKIPPED).

## Follow-ups (not blocking)

- **Live Inspector-dropdown drive** and **submenu-leaf click** need a harness that can register artboard-frame selection / hover under real CDP move-tool input — both are proven here via the shared `/_api/set-artboard-kind` lane + static UI-presence checks. Unit coverage: `apps/studio/test/artboard-kinds.test.tsx`, `canvas-meta-api.test.ts`.
- **Guides snapping UI** (world-space guide lines from visible artboards + the 2 intent presets) is a documented T7 scope trim — a scenario step lands once `feature-2/3` or the editing-trio wires the toolbar.
