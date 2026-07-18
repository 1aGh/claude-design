# web-artboards

**Persona:** A designer building a responsive web page. They want an artboard that declares itself a **web viewport** — width = breakpoint, height hugs content — so the canvas shows a breakpoint band, they can spin up a mobile/tablet variant with **one action** (duplicate at a new width), and edit the layout with the same flex/grid track tools they know from Figma/Webflow. The handoff must be flex-first code, not absolutized pixels.

**Feature under test:** `feature-3-web-artboards` (commit `2d124965`, DDR-186) — the `kind="web"` authoring contract, the **breakpoint-band chip** (`≤ Npx`, `web-overlay-content.tsx` registered into the foundation's `kindOverlayRegistry`), the **"Duplicate at width…"** action (context menu in `canvas-shell.tsx` + Inspector `ArtboardKnobs` in `client/app.jsx`, engine op `applyDuplicateArtboard` in `canvas-edit.ts`, route `/_api/duplicate-artboard`), and the **CSS-Grid track editor** (Inspector Grid section + on-canvas gutter-drag overlay `grid-track-handles.ts`/`use-grid-track-handles.tsx`, riding the existing `/_api/edit-css` write lane). Sibling of `artboard-kinds` (foundation) — read that spec first; it documents the accepted headless artboard-selection limitation this spec inherits.

**Canvas under test:** `.design/ui/Web Artboards Lab.tsx` — a **throwaway verification fixture** (`@opt_out full`, `@ds maude`). Two `kind="web"` `DCArtboard`s:
- `web-hero` (1280×720) — a flow-first (flex) landing composition (nav header + hero section + CTA). The duplicate/breakpoint/reflow subject.
- `web-grid` (900×500) — carries a `display:grid` container (class `wal-grid`, `grid-template-columns: 1fr 1fr`, four cell children). The grid-track-round-trip subject.

Regenerable — delete and re-author from this description if absent. **Note:** the grid container must NOT carry an authored `data-cd-id` — the `/_api/edit-css` lane only accepts the build-stamped 8-hex id (`CD_ID_RE = /^[0-9a-f]{8}$/`), so an authored non-hex id blocks the write. Identify it by its class / `display:grid` computed style and read the stamped id off the DOM.

## Hypothesis

- Every `kind="web"` `DCArtboard` resolves `data-dc-kind="web"` and paints a **breakpoint chip** in the header's top-right reading `≤ {round(liveWidth)}px` (the video badge's slot; web/video are mutually exclusive). The chip tracks the artboard's OWN live width, so two differently-sized web artboards show different chips (T2).
- **"Duplicate at width…"** (`POST /_api/duplicate-artboard` `{ canvas, artboardId, width }`) clones the artboard as its **next sibling in source** with a suffixed id (`{id}-{width}`, collision-bumped `-2`), a suffixed label (`{label} ({width}px)`), the new `width={…}`, and **every other prop + all content carried over verbatim** (kind/guides/print, children incl. their `data-cd-id` usages). Returns `{ ok, artboardId, seq }` (T3).
- The duplicate is **whole-file-undo reversible** via `POST /_api/reorder-revert` `{ canvas, seq, dir:'undo' }` (id-churn-proof: refuses 409 when the canvas changed since the logged snapshot).
- The clone **reflows**: authored flow-first (flex), it re-lays-out at the narrower width and its hug height re-measures — visible as headline wrapping + nav compression at 390px vs 1280px (T4).
- A `display:grid` container's `grid-template-columns` / `grid-template-rows` **round-trip through `POST /_api/edit-css`** (`{ canvas, id:<8hex>, property, value }`), including an **`fr`** value, land in the source `style={{}}` object, and the grid **visually reflows** (track count + `fr` ratio honored in computed style) (T5).
- Width/height stay **numeric JSX attrs** (DDR-027); the duplicate op rewrites `width={…}`, never a string.

## Platform matrix

| Platform | Viewport | Required |
| --- | --- | --- |
| web-desktop | 1280×720+ | ✓ |
| web-mobile / ios-phone / ios-tablet / android-phone | — | **SKIPPED** |

Native + mobile **SKIPPED** — the Maude Studio dev-server is desktop-development tooling; the breakpoint chip, duplicate action, and grid track editor have no touch/mobile parity surface. Same rationale as the sibling `artboard-kinds` / `element-editing-resize-and-position` / `structural-and-scope`. Record as `SKIPPED reason="canvas editor is a desktop-only dev tool; no touch/mobile parity story"`. Project `platforms` in `.ai/workflows.config.json` is single-platform, so parity is N/A (not a gap).

## Preconditions

- Dev server booted in **same-origin mode** so the harness can reach the canvas iframe:
  `MAUDE_CANVAS_ORIGIN_SPLIT=0 MAUDE_SKIP_RUNTIME_BUILD=1 bun run apps/studio/server.ts --root . --port <N>`
- `.design/ui/Web Artboards Lab.tsx` present (re-author from the fixture description if absent), grid at baseline (`1fr 1fr`).
- Browser viewport ≥ 1280×720. Isolated `agent-browser --session <name>`.
- **Guard `apps/studio/dist/`** — a source dev-server boot self-heals unminified dev bundles over the committed release artifacts; `git status apps/studio/dist/` before AND after, `git checkout -- apps/studio/dist/...` any unintended churn (CLAUDE.md rule).

## Driving model (agent-browser)

The breakpoint chip + grid live in the **canvas iframe**; the context menu / Inspector Grid section live in the **parent shell**. Two things bit this run and shape the model:

- **The shell tab-open flow is not headless-drivable in this session.** Clicking a `canvas-row-*` tree row writes `_active.json` server-side but the shell React app did not mount the iframe tab (no `iframe` in the DOM, "no canvas open" persists) under agent-browser — the same class of artboard-selection headless limitation the sibling `artboard-kinds` / `structural-and-scope` specs flag. **Workaround (reliable):** navigate agent-browser **directly to the canvas iframe URL** — `/_canvas-shell?canvas=ui/<name>.tsx&designRel=.design&tokens=system/<ds>/colors_and_type.css&components=system/<ds>/preview/_components.css` (params built exactly as `client/canvas-url.js` does). This renders the canvas standalone; the chrome (chips, guides, grid) is fully present and assertable via `document.querySelector` on the page (no cross-origin hop needed).
- **Write-lane assertions POST directly** to `/_api/duplicate-artboard`, `/_api/reorder-revert`, `/_api/edit-css` with `Origin: http://localhost:<N>` (all three are `sameOriginWrite` + loopback-Host gated, MAIN-ORIGIN-ONLY — absent from `CANVAS_SAFE_API`). `canvas` is the designRoot-relative path (`.design/ui/<name>.tsx`) OR bare slug (`ui/<name>`); both resolve. This is the exact op each UI surface (context menu / Inspector) invokes, so it exercises the AST write + snapshot + live re-render end-to-end. The on-canvas gutter-drag + the context-menu/Inspector click surfaces themselves are **source-verified + write-lane-proven** here (artboard-frame selection + modifier-drag are the sibling specs' documented headless gap).
- **Session cross-talk caution:** keep exactly ONE agent-browser session on the server while POSTing structural writes. A second stale session (e.g. an open shell tab) was observed re-firing a duplicate on HMR reconnect, producing a spurious `-2` clone and a 409 on the subsequent undo. Close extra sessions before the undo step.

## Steps

1. **Open the fixture direct; baseline.** Navigate to the `web-hero`/`web-grid` canvas URL. Assert `.dc-artboard` × 2, both `data-dc-kind === "web"`, and two breakpoint chips reading `≤ 1280px` + `≤ 900px` (each artboard's own width). Screenshot.
2. **Duplicate at 390 (write lane + reflow).** `POST /_api/duplicate-artboard` `{ artboardId:"web-hero", width:390 }`. Assert `{ok:true, artboardId:"web-hero-390", seq}`; source gains `<DCArtboard kind="web" id="web-hero-390" label="Web hero (390px)" width={390}>` **immediately after** the source `web-hero` and before `web-grid`; content byte-identical to the source clone. Reload: assert 3 artboards, the new one's chip reads `≤ 390px`, and a screenshot shows the hero **reflowed** (headline wraps to 2 lines, nav compresses) vs the 1280px original. Screenshot.
3. **Undo the duplicate.** With exactly one session live, `POST /_api/reorder-revert` `{ seq, dir:"undo" }` **immediately** after a clean duplicate. Assert `{ok:true, dir:"undo"}` and the source is restored **byte-identical** to the pre-duplicate baseline (artboard count back to 2, clone gone). (The id-churn 409 guard is a correct alternative outcome if the canvas changed since — proven separately.)
4. **Grid track round-trip (`fr`).** Read the grid container's stamped 8-hex `data-cd-id` off the DOM (by class `.wal-grid` / `display:grid`). `POST /_api/edit-css` `{ id:<hex>, property:"grid-template-columns", value:"1fr 2fr 1fr" }`. Assert `{ok:true}`, the source `style` gains `gridTemplateColumns: "1fr 2fr 1fr"` (quote style is the writer's — assert quote-agnostically), and on reload the grid's computed `grid-template-columns` is **3 tracks with the middle ≈ 2× the outer** (the `fr` ratio). Screenshot the 3-column reflow. Then `POST` `grid-template-rows: "80px 1fr"` and assert the rows round-trip to source.

## Success criteria

- Steps 1–4 PASS: web-kind chip renders + tracks live per-artboard width; duplicate-at-breakpoint clones verbatim/adjacent/suffixed with the new width + `seq`; the clone reflows at 390px; undo restores byte-identical; grid `columns`/`rows` round-trip through `edit-css` (incl. `fr`) and visually reflow with the fraction ratio honored.
- The context-menu "Duplicate at width…" leaf and the on-canvas gutter-drag are reported as **source-verified + write-lane-proven** (the shared `/_api/duplicate-artboard` + `/_api/edit-css` lanes ARE driven end-to-end) — live click/drag deferred to a harness that can register artboard-frame selection + modifier-drag under real CDP (the sibling specs' documented gap), an honest partial, not a false pass.
- On-canvas **corner-drag cell-span** is a disclosed T5 scope trim (Inspector `grid-column`/`grid-row` text fields cover cell placement instead) — out of scenario scope, see DDR-186.
- No canvas-render error overlay over the run (checked via absence of `.dc-error-overlay` at every reload; every reload rendered the expected artboard/element counts).
- Cross-platform parity: N/A (web-desktop only by design; the other 4 documented as SKIPPED).

## Follow-ups (not blocking)

- **Live context-menu "Duplicate at width…" drive** and **on-canvas gutter drag-resize** need a harness that registers artboard-frame selection / modifier-drag under real CDP move-tool input — both are proven here via the shared `/_api/duplicate-artboard` + `/_api/edit-css` lanes + static UI-presence checks. Unit coverage: `apps/studio/test/element-structural-*.test.ts` (4 `applyDuplicateArtboard` + 2 HTTP cases), `grid-track-handles.test.ts` (22 pure-geometry), `handoff.test.ts` (kind metadata).
- **Shell tab-open under agent-browser** (clicking a `canvas-row-*` row → mounted iframe) did not work headless this session — the direct-canvas-URL workaround is the reliable path. Worth revisiting if a future harness needs the full shell chrome (menubar, Inspector panel) rather than just the canvas surface.
