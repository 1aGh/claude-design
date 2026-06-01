# Feature: Export pipeline fixes — 6 bugs (size, chrome leak, selection/artboard scoping, SVG bg, HTML artboard, PPTX validity)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan touches the export pipeline that was just hardened (graceful Playwright-missing, SVG `formatXML`, cross-origin bridge — see `.ai/logs/rca/issue-nefunguji-exporty.md`); those fixes are landed and must not regress.

## Description

A cluster of 6 user-reported defects in the canvas export pipeline (`POST /_api/export` → `exporters/*.ts` + `bin/_*-playwright.mjs`). All formats render through Playwright against the standalone `_canvas-shell.html`. The bugs span scope resolution (`scope.ts`), the per-format shims, the dialog options UI (`export-dialog.tsx`), and chrome suppression.

## User Story

As a designer exporting a canvas, I want each format to export exactly the region I chose (selection or the selected artboard), at a usable resolution, without the editor's UI chrome bleeding in, and in files that open in the target apps — so the export is usable as a deliverable.

## Problem

Reported (verbatim, Czech):
1. **PNG custom size** — default PNG resolution is tiny; no way to pick a larger size.
2. **PNG/PDF chrome leak** — the minimap ("WORLD MAP", bottom-right) and the "who is present" presence avatars (top-right) appear in the exported PNG (and PDF).
3. **Selection scope exports the whole artboard** — for ALL formats, `scope=selection` ignores the selection and exports the artboard.
4. **SVG loses background** — SVG export keeps structure + text but drops the background fill (see attached image).
5. **HTML artboard exports the first artboard** — `scope=artboard` HTML always emits artboard #1, not the selected/active one.
6. **PPTX won't open** — the exported `.pptx` fails to open in Canva and Keynote.

## Solution

Address each with a root-caused fix, sharing two pieces of foundational work (selection/active-artboard propagation; a real `hide-chrome` implementation) that several items depend on. **No code is written in this planning phase.** Each task below states the root-cause hypothesis from research + the investigation step to confirm before patching (per `flow:debugging-rules` — evidence before fixes).

## Metadata

- **Ticket**: none (provider `github`; human bug report, no issue number) — `refs nefunguji-exporty-v2` in commits
- **Type**: Bug Fix (cluster of 6)
- **Complexity**: High — 6 distinct defects across ~10 files; 2 shared infra changes; cross-origin + Playwright + OOXML surface
- **App/Package**: `plugins/design/dev-server`
- **Affected Systems**: export endpoint (`http.ts`), scope resolver (`exporters/scope.ts`), per-format adapters (`exporters/{png,pdf,svg,html,pptx}.ts`), Playwright shims (`bin/_*-playwright.mjs`), export dialog (`export-dialog.tsx`), canvas-shell chrome (`canvas-shell.tsx`, `participants-chrome.tsx`, `canvas-lib.tsx`)
- **Dependencies**: none new — uses installed `playwright` (+ Chromium), `dom-to-svg`, `dom-to-pptx`, `pptxgenjs`, `pdf-lib`, `jszip`

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message.

- `plugins/design/dev-server/exporters/scope.ts` (full) — scope → `Target[]`; the `selection`→`artboard` and `artboard`→`:first-of-type` fallbacks (lines 151–195) are the root of items 3 & 5.
- `plugins/design/dev-server/exporters/index.ts` (lines 103–135) — `canvasShellUrl()`; sets `hide-chrome=1` (line 133) whose consumer **does not exist** (item 2).
- `plugins/design/dev-server/bin/_png-playwright.mjs` (full) — viewport/clip + `--scale` → `deviceScaleFactor` (line 38); default `scale=1` (item 1); widen logic (item 2/5).
- `plugins/design/dev-server/bin/_html-playwright.mjs` (full) — `:first-of-type` default selector (item 5).
- `plugins/design/dev-server/bin/_svg-playwright.mjs` (full) — `elementToSVG(target)` (item 4 — background lost).
- `plugins/design/dev-server/bin/_pptx-playwright.mjs` (full) — single-artboard `dom-to-pptx` output (item 6).
- `plugins/design/dev-server/exporters/pptx.ts` (lines 99–263) — `mergePptx()` regex OOXML surgery, does NOT patch `[Content_Types].xml` (item 6).
- `plugins/design/dev-server/exporters/png.ts` + `exporters/pdf.ts` — option plumbing (item 1) + shared chrome (item 2).
- `plugins/design/dev-server/export-dialog.tsx` (lines ~210–248 submit; ~400–445 the FORMAT/SCOPE `<select>`s) — only 2 controls today; per-format options UI must be added for item 1.
- `plugins/design/dev-server/inspect.ts` (lines 36–177) — `state.selected` tracking (the live `_active.json.selected` the export reads); confirm population at export time (item 3).
- `plugins/design/dev-server/canvas-shell.tsx` (lines 1380–1410 mounts `ToolPalette`/`ParticipantsChrome`; line 427 chrome class list) — what chrome renders in the standalone shell (item 2).
- `plugins/design/dev-server/participants-chrome.tsx` (line 157 `.dc-participant`) — presence avatar class to suppress (item 2).
- `plugins/design/dev-server/test/exporters/*` — existing adapter/scope/endpoint tests to extend.

### Documentation

- pptxgenjs valid-file requirements + `[Content_Types].xml` overrides per slide — Why: item 6 merge must register every `slideN.xml` as a content-type Override or the deck is invalid. (Fetch via context7 `pptxgenjs` / OOXML spec during execute.)
- `dom-to-svg` README — `elementToSVG` background behaviour — Why: confirm whether the root element's `background` is painted; item 4.
- DDR-042 (`.ai/decisions/DDR-042-*`) — why SVG/PPTX swapped to `dom-to-svg`/`dom-to-pptx` — Why: don't reintroduce the foreignObject/hand-walker path.

### Patterns to Follow

- Shim arg parsing + `launchChromium()` (post-RCA): every shim uses `import { launchChromium } from './_pw-launch.mjs'`. New shim flags follow the existing `--flag value` reducer (`_png-playwright.mjs:12–17`).
- Adapter shape: `run(targets, options, ctx) → {filename, contentType, body}` (`exporters/index.ts:54`). Options are validated per-adapter.
- Bridge payload (cross-origin): the dialog already passes `{format, scope, options}` to the parent (`export-dialog.tsx` submit → `app.jsx runBridgedExport`). Any new field (e.g. a captured selection) rides the same `options` bag — no new channel.

---

## Tasks

Execute in dependency order. Shared infra (Tasks 1–2) first, then per-item.

### Task 1: ROOT-CAUSE + FIX selection/active-artboard propagation (items 3 & 5)

- **Do**:
  1. **Confirm the failure**: add a temporary log of `inspect.state.selected` + `inspect.state.active` inside the `/_api/export` handler (`http.ts:593`), run a real UI selection→export, and capture whether `selected` is null at export time. Hypothesis: clicking the Export toolbar button / opening the dialog clears the canvas selection, so `state.selected` is null by the time the bridged export runs → `scope.ts` `selection` recurses to `artboard`, and `artboard` falls to `[data-dc-screen]:first-of-type`.
  2. **Fix selection survival**: snapshot the live selection in the iframe at dialog-submit time and pass it through the export `options` bag (e.g. `options.selection = { selector, file }`), then have `resolveScope` prefer `options`-supplied selection over `activeJson.selected`. This makes the export independent of whether focus/selection was cleared by the dialog. (Plumb `options` into `resolveScope` — today it only sees `activeJson`; thread it via `runExport`.)
  3. **Add an "active artboard" signal** so `scope=artboard` works WITHOUT an element selection: the iframe knows the artboard under the viewport centre / last-focused `[data-dc-screen]`. Include it in the submit snapshot (`options.artboardId`) and have `scope.ts` `artboard` use `[data-dc-screen="<id>"]` instead of `:first-of-type` when present.
- **Pattern**: `scope.ts:151–183`; selection snapshot mirrors how `app.jsx` already reads canvas selection (`dgn: 'select'`).
- **Gotcha**: `resolveScope` is pure + unit-tested (`test/exporters/scope.test.ts`) — extend its signature additively (`options?`) so existing tests stay green. Selection selector must be unique across artboards or `.first()` picks wrong; prefer an id-scoped selector.
- **Validate**: `bun test test/exporters/scope.test.ts`; manual UI: select an element in artboard #2 → export PNG/HTML selection + artboard → both target #2.

### Task 2: IMPLEMENT the `hide-chrome` consumer (item 2 — minimap + presence + chrome leak)

- **Do**:
  1. The standalone shell reads `?hide-chrome=1` (already on the URL from `index.ts:133`) and, when set, injects a `<style id="canvas-hide-chrome">` that `display:none !important`s every floating editor chrome layer. Find the shell entry that reads `location.search` (canvas-shell mount / the `_canvas-shell.html` bootstrap) and gate a CSS rule on the param (or set `<html data-export>` and key the rule off it).
  2. **Enumerate ALL chrome to hide** — not just the minimap. Confirmed leakers + candidates: `.dc-mm` (minimap), `.dc-participant` / participants-chrome stack (presence avatars, top-right), `.dc-tool-palette`, `.dc-zoom-tb`, `.dc-context-menu`, `.dc-annot-svg`, `.dc-annot-ctx`, `.cm-composer/.cm-thread/.cm-mention-popup/.cm-pin`, the AI banner (`ai-banner.tsx`), undo HUD, snap guides. Grep `canvas-shell.tsx` + `participants-chrome.tsx` + `tool-palette.tsx` for the exact class names and build the complete selector list. (The line-427 list is a starting point but is the dblclick-ignore list, NOT a hide list, and omits `.dc-participant`.)
  3. Update the stale comment at `index.ts:131` to describe the real mechanism (or delete the claim that the style "already exists").
- **Pattern**: token/style injection like `ensureHaloStyles()` in `canvas-shell.tsx`.
- **Gotcha**: must apply ONLY in the export shell, never the live iframe — gate strictly on the param so the live editor keeps its chrome. PDF and PNG share this path (both go through `canvasShellUrl`), so one fix covers both (item 2 says PDF too).
- **Validate**: export PNG + PDF of a multi-peer canvas; assert no minimap, no avatars, no tool palette in the output. Add a shim/endpoint test that the served `_canvas-shell.html?hide-chrome=1` contains the hide style and the live URL does not.

### Task 3: ADD PNG custom size + sane default (item 1)

- **Do**:
  1. Raise the default so a single-scale export isn't tiny: change `png.ts` default `scale` and/or expose a size control. Decide the model: **scale multiplier** (1×/2×/3×, default 2×) is simplest and already plumbed (`_png-playwright.mjs:38` `deviceScaleFactor`); **target width** (e.g. 1920/2560/custom px) is friendlier — compute `scale = round(targetWidth / nativeArtboardWidth)`.
  2. Add a per-format options control to the dialog: when FORMAT=PNG, render a third `<select>`/input ("Size": 1×/2×/3× or px presets + custom). Wire it into the `options` bag the submit already sends (`export-dialog.tsx` submit → bridge → `/_api/export` → `png.ts` reads `options.scale`/`options.width`).
  3. PDF/SVG can reuse the same size plumbing later, but PNG is the scoped target here.
- **Pattern**: dialog already reads `FORMAT_META` per format; add a `FORMAT_OPTIONS[format]` map rendering the control. `png.ts:103–106` already reads `options.scale`.
- **Gotcha**: clamp `deviceScaleFactor` ≤ 4 (already done at `_png-playwright.mjs:38`); a huge custom width × native could OOM Chromium — cap total pixels. Multi-artboard PNG (zip) must apply the scale to every artboard.
- **Validate**: export PNG at 1×/2×/3× → assert output pixel dimensions scale accordingly; `bun test test/exporters/png.test.ts`.

### Task 4: FIX SVG missing background (item 4)

- **Do**:
  1. Investigate where the artboard's visible background comes from: is it painted on the `[data-dc-screen]` element itself, on an inner DS theme wrapper (`.mdcc`/`.app`), or on `.dc-world`/body behind it? `getComputedStyle(target).backgroundColor` in the page tells you. `_svg-playwright.mjs` calls `elementToSVG(target)` on the widened artboard — if the bg lives on a parent not in `target`, it's lost.
  2. Fix: ensure the captured root carries the background. Options (pick per finding): (a) capture from the element that actually holds the bg; (b) prepend an explicit `<rect width height fill={computedBg}>` as the first child of the emitted `<svg>` using the target's computed `background-color` (and gradient/image if present); (c) set an inline `background` on the clone before `elementToSVG`.
  3. Apply to BOTH branches (single `serializeOne` + multi) consistently — they already diverged once (the `formatXML` bug). Consider extracting one shared `serialize(el)` to avoid re-drift.
- **Pattern**: `_svg-playwright.mjs:77–96` (serializeOne) + 109–119 (multi).
- **Gotcha**: don't reintroduce `formatXML` (removed in the prior RCA fix). Transparent artboards (intentional) should stay transparent — only add a rect when the computed bg is non-transparent.
- **Validate**: export SVG of an artboard with a solid DS background → open in browser + Illustrator/Inkscape → background present; `bun test test/exporters/svg.test.ts`.

### Task 5: VERIFY HTML targets the selected/active artboard (item 5)

- **Do**: Largely resolved by Task 1 (active-artboard / selection now reaches `scope.ts`). Confirm `_html-playwright.mjs` non-multi branch (`page.locator(selector ?? '[data-dc-screen]:first-of-type').first()` + `el.closest('[data-dc-screen]')`) widens to the RIGHT artboard once `scope.ts` passes `[data-dc-screen="<activeId>"]` instead of `:first-of-type`. If HTML has an extra divergence (e.g. it ignores the widen target), fix the shim to widen to the selector's `closest('[data-dc-screen]')` like PNG does.
- **Pattern**: compare `_png-playwright.mjs` widen (lines 58–60) vs `_html-playwright.mjs` `serializeOne` widen.
- **Gotcha**: HTML output is always a ZIP (even single) — filename/slug must reflect the chosen artboard, not `#1`.
- **Validate**: multi-artboard canvas, select artboard #3, export HTML artboard → the zip contains artboard #3's markup, not #1.

### Task 6: ROOT-CAUSE + FIX PPTX invalid file (item 6)

- **Do**:
  1. **Reproduce + diagnose**: export PPTX (single-artboard AND canvas-as-separate), `unzip` the `.pptx`, validate the OOXML. Prime suspect: `mergePptx()` (`pptx.ts:182–263`) rewrites `slideN.xml` + `presentation.xml` + its rels via regex but **never updates `[Content_Types].xml`** — each `ppt/slides/slideN.xml` needs a `<Override PartName="/ppt/slides/slideN.xml" ContentType="…slide+xml"/>`; merged slides 2..N have no Override → Keynote/Canva reject the package. Also verify slideLayout/master rels resolve for every slide and `rId` numbers don't collide.
  2. **Also check the single-artboard path** (`captureOne` → raw `dom-to-pptx` output): if even single-artboard fails, the bundle/output itself is invalid (validate that file independently first to bisect single vs merge).
  3. **Fix**: patch `[Content_Types].xml` Overrides in `mergePptx`, ensure unique `rId`s and slide-layout rels per slide; OR replace the regex surgery with a robust path (e.g. drive `pptxgenjs` to assemble all slides in one document instead of byte-merging). Prefer the latter if dom-to-pptx exposes a way to append multiple captures to one deck.
- **Pattern**: `pptx.ts:182–263`; OOXML package = `[Content_Types].xml` + `_rels` + `ppt/presentation.xml` must agree.
- **Gotcha**: `[Content_Types].xml` is at the zip root and is easy to forget. Test the file opens in a real consumer, not just "unzips".
- **Validate**: `bun test test/exporters/pptx.test.ts` (extend to assert every slide has a Content-Types Override); manual: open exported deck in Keynote + Canva + LibreOffice Impress.

### Task 7: Update the RCA + regression tests

- **Do**: Append findings to `.ai/logs/rca/issue-nefunguji-exporty.md` (or a `-v2` sibling). Add/extend `test/exporters/*` for each fixed item (scope selection-passthrough, hide-chrome presence, png scale dims, svg background rect, pptx content-types). Run `pnpm format`.
- **Validate**: `bun test test/exporters/` all green.

---

## Validation

Run from repo root unless noted:

1. **Lint**: `pnpm lint`
2. **Format**: `pnpm format` (no diff)
3. **Tests**: `pnpm test && pnpm test:dev-server` (dev-server suite was 907/907 pre-change)
4. **Build**: `cd plugins/design/dev-server && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts` (rebuilds `dist/client.bundle.js` + canvas-shell — needed because `export-dialog.tsx`/`canvas-shell.tsx` ship in those bundles; commit the rebuilt `dist/client.bundle.js`).
5. **Live export matrix** (dev server running, real UI via agent-browser): for a MULTI-artboard canvas with a peer present and an element selected in artboard #2 —
   - PNG selection → only the selected element; PNG artboard → artboard #2; **no minimap, no avatars**; 2×/3× size scales pixels.
   - PDF → no chrome leak.
   - SVG artboard → background present, text/structure intact.
   - HTML artboard → artboard #2 (not #1).
   - PPTX (single + canvas-as-separate) → opens in Keynote + Canva.
6. **Regression**: re-run the prior RCA verification (⌘E → PNG → "Saved …"; Recent tab populates; all 7 formats 200 via curl) — the cross-origin bridge + chromium-missing handling must still hold.

---

## Acceptance Criteria

- [x] All 7 tasks completed; each reported defect verified fixed via live `/_api/export` + agent-browser (`/tmp/export-verify/*`, 2026-06-01).
- [x] `scope=selection` exports the selection (9×14 px element capture, not the 1440×900 artboard); `scope=artboard` exports the active/selected artboard by id (`about` ≠ `#1 landing`) — `Target.widen` + `options.artboardId` propagation.
- [x] No editor chrome (minimap `.dc-mm`, presence avatars `.dc-participants`, tool palette, banners) in any rendered export — verified in two PNGs.
- [x] PNG has a size control (1×/2×/3×, default 2×); output dimensions scale (1442×902 @1× → 4326×2706 @3×).
- [x] SVG keeps the background in Affinity — backdrop `<rect>` + **every `oklch/oklab/lch/lab/color()` converted to sRGB `rgb()`** (Chromium serializes DS tokens as oklch, which Affinity can't parse → was the real cause; 0 CSS-Color-4 left, verified rendered). **User confirmed SVG OK.**
- [x] PPTX now a valid OOXML package — `mergePptx` rewrite fixed 3 bugs (dropped slideMaster/theme rels via the `[^/]*` regex = the "won't open anywhere" cause; colliding per-input media; missing Content-Types Overrides). Custom validator: 132 parts, all rels Targets resolve, all parts typed, all `r:id` resolve. **Open-in-Keynote/Canva still to confirm by user (no app in this env).**
- [x] `pnpm test:dev-server` green (907/907 + 24 new exporter assertions); lint clean on changed files. **NOTE:** `dist/client.bundle.js` did NOT need a rebuild — the dialog ships via `@maude/canvas-lib` (bundled per-canvas at request time), not the committed client bundle. The plan's assumption here was wrong; rebuild produced a no-op diff.
- [x] No regression of the landed export RCA fixes — all 7 formats return 200 (Playwright-missing message, SVG `formatXML`, cross-origin bridge intact).
- [ ] Architectural decisions (selection-passthrough; pptx regex-merge-patch) recorded as a DDR — **at `/flow:done`** (draft in RCA v2 §Decisions).
- [ ] Plan archived + `pnpm --filter @maude/site gen:roadmap` run — **at `/flow:done`**.

## Execution status (2026-06-01)

All implementation + per-task verification complete. Changed files (14 + 1 new test):
`exporters/{scope,index,png,pdf,svg,html,pptx}.ts`, `export-dialog.tsx`,
`bin/_{png,pdf,svg}-playwright.mjs`, `templates/_shell.html`,
`test/exporters/{scope,png}.test.ts` + new `test/exporters/pptx-merge.test.ts`.
RCA: `.ai/logs/rca/issue-nefunguji-exporty-v2.md` (gitignored, local). Next: `/flow:done`
(DDR + Keynote/Canva open-test + archive + roadmap regen).

## Retro

- **Items 1–5 landed cleanly** (PNG size, chrome-hide, selection scope, SVG bg/oklch, HTML artboard). Per-item live verification (curl matrix + agent-browser + a custom OOXML validator) caught the real root causes — several deeper than the plan's hypotheses (e.g. item 2's `hide-chrome` consumer *existed*; the bug was wrong class names. Item 3 had a second cause: unconditional `--widen-to-artboard`).
- **Item 6 (PPTX) ballooned from "patch the merge" into a full architecture rework** across THREE approaches: dom-to-pptx (reflows text) → SVG-image/`svgBlip` (Canva rejects as corrupt, Keynote rasterizes) → svg2pptx native shapes (the winner, after fixing tspan-coord lift + font-stack collapse). A one-line plan item became the bulk of the work.
- **Lesson — validate against the TARGET consumers early.** Structural OOXML validity (all refs resolve) and LibreOffice renders were misleading proxies: the deck was "valid" yet broke in Canva (`svgBlip`) and Keynote (rasterize), and LibreOffice's fallback font exaggerated text overlap that wasn't there in Keynote with the real font. The user's real-app verdict was the only authoritative signal. Future export-fidelity work should spike against the actual apps (Canva/Keynote/PowerPoint) before committing an approach.
- **New dependency: Python `svg2pptx`** (soft, DDR-069) — first Python touchpoint in a Bun/Node dev-server. Gated with a PNG fallback so absence degrades, never errors.
- **Process — flag high-uncertainty items in `/plan`.** "Export fidelity across third-party consumers" is inherently a spike (every tool/app has quirks); estimating it as a single bullet under-scoped it badly. Mark such items spike-first next time.
- **Dead code left for cleanup:** `dom-to-pptx` dep + `_pptx-playwright.mjs` + `_enumerate-artboards-playwright.mjs` (no longer referenced).

---

## Notes / open decisions for execute

- **Selection model**: pass-through snapshot in `options` (robust to focus loss) vs. preventing the dialog from clearing selection. Lean pass-through — deterministic and survives the cross-origin bridge.
- **PNG size UX**: scale presets (1×/2×/3×) vs target-width px vs DPI. Lean presets + optional custom width; default ≥ 2×.
- **PPTX**: patch the regex merge (cheap, fragile) vs reassemble via pptxgenjs (robust, more work). If single-artboard PPTX is ALSO invalid, the problem is upstream of merge → bisect first.
