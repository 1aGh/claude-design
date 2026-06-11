# Phase 12: In-canvas direct edit — CSS + text + Layers panel

> **Refreshed 2026-06-11.** The original 2026-05-23 plan targeted the pre-Phase-3.4 HTML dev-server (`plugins/design/dev-server/server.mjs`, HTML canvases) and treated the source-rewrite strategy as the hard, unsolved problem. Several things shipped since that made most of it moot:
> - **Phase 3.4** migrated the dev-server to `apps/studio/` (TypeScript + Bun). `plugins/design/dev-server/` no longer exists.
> - **Phase 3.6 / DDR-019** moved canvases to TSX and built `editAttribute()` (`apps/studio/canvas-edit.ts`) — an AST-aware single-attribute source rewriter (oxc-parser + magic-string, atomic write, per-file mutex) that already handles `style.<prop>` inline-style merges and `className`. **This _is_ the old Task 3 "source-rewrite strategy", already decided and implemented.**
> - **Phase 13** added `data-cd-id` stable element IDs — the DOM-node → source-JSX-node bridge that writeback, text editing, and a click-to-select layers tree all need.
> - **Plan C** (Studio full functionality, 2026-06-08) shipped the **Inspector + Layers + CSS panels** in display-only form (`apps/studio/client/app.jsx` `InspectorPanel`, ~2795–2928), gated behind the `I` key + menubar, with an explicit "live CSS knobs land in Phase 12" callout. Plan C's deferred tail names "live CSS writeback (Phase 12)" by hand.
>
> Net effect: ~85% of the substrate is already on disk. Phase 12 is no longer a ~2-week ground-up build — it is a **wiring slice plus two real builds**: (a) wire the read-only CSS tab to write back + optimistic preview [thin], (b) inline text editing of element content [new engine fn `editText` + UI], (c) upgrade the ancestry-only Layers tab into a browsable click-to-select tree [new UI]. The original Task 0 user-survey gate is **waived** (see Task 0) and the original Task 4 (Phase-10 CRDT integration) is **dropped** — Phase 10 was superseded and de-referenced (commit `340b2ed`). **Layers drag-to-reorder is deferred to a dedicated follow-up phase** (`phase-12.1`) — it needs JSX node-move AST surgery + positional-id handling (see "Deferred"). The pre-refresh plan body is preserved in git history.

## Description

Three direct-manipulation capabilities on the already-shipped Inspector substrate, so small tweaks don't need a `/design:edit "<feedback>"` AI round-trip:

1. **CSS writeback (wiring).** Cmd+click an element, nudge `border-radius` / `padding` / `color` in the CSS tab, see it live, and the change persists to the source `.tsx` as an inline-`style={{}}` merge.
2. **Inline text editing (new).** Double-click a leaf element in the canvas → it becomes `contenteditable` → on blur/Enter the new text writes back to the source `.tsx` (the element's `JSXText` child, JSX-escaped). Webflow/Figma-style direct edit.
3. **Layers tree (new UI).** Replace the ancestry-only Layers tab with a browsable tree of the active artboard's DOM — collapsible, click any layer to select it in the canvas, hover to highlight. **Drag-to-reorder is NOT in this phase** (deferred).

## User Story

As a developer reviewing a canvas, I want to (a) Cmd+click a button and change its `border-radius`/`padding` with live feedback, (b) double-click its label and retype it in place, and (c) open the Layers tree and click any nested element to select it — all writing straight back to the source `.tsx`, so trivial cosmetic + copy tweaks and navigation don't require a full `/design:edit "<feedback>"` round-trip with the AI.

## Problem

- Today any cosmetic change — nudging a padding, fixing a typo in a button label — requires invoking `/design:edit "<feedback>"`. Heavyweight context + AI latency + cost for a one-property or one-word tweak.
- The Inspector CSS tab shows the selected element's markup but is read-only, with a standing "Phase 12" promise.
- There is **no way to edit an element's text content** directly — `contentEditable` exists in the repo only for the annotation layer (sticky notes / text boxes, Phase 21), not for canvas element copy.
- The Layers tab only shows the **ancestry chain of the currently selected element** (`app.jsx:2890–2906`, a non-clickable indented `dom_path` list). No way to browse the artboard's full layer tree or click a layer to select — selection is Cmd+click-in-canvas only.
- All the hard infrastructure (stable IDs, AST rewrite engine, selection identity, panels, selection resolver/bus) exists but isn't connected end-to-end.

## What already exists — do NOT rebuild

| Capability | Where | Notes |
|---|---|---|
| Inspector panel (Inspect / Layers / CSS tabs), `I` key + menubar toggle | `apps/studio/client/app.jsx` `InspectorPanel` (~2795–2928) | CSS tab **read-only** (markup snapshot + "Phase 12 … read-only" callout, ~2908–2924). Layers tab **ancestry-only, non-clickable** (~2890–2906). |
| Selection payload (`SelectedElement`) | `apps/studio/inspect.ts` (7–36) | `id` (8-hex `data-cd-id`, when `v===2`), `selector`, `index`, `canvas` (slug), `classes`, `tag`, `html`, `bounds`, `dom_path`. The source-node bridge + per-tree-node identity. |
| Stable DOM→source IDs (`data-cd-id`) + resolver | `canvas-pipeline.ts` (inject), `canvas-comment-mount.tsx` (capture), `dom-selection.ts` (`resolveSelectionEl`, artboard-scoped) | `id = Bun.hash("<componentName>:<jsxIndex>")` (positional). Same resolver powers click-to-select from the tree, the text-edit target, and the CSS-edit target. |
| Selection bus (canvas-shell ↔ shell) | `app.jsx` `m.dgn === 'select'` handler (~3248), postMessage bridge | Cmd+click posts `select` → shell. Tree click-to-select + text-edit relay reuse this bus (`dgn:select-by-id` / `dgn:edit-text`). |
| **Source-rewrite engine** | `apps/studio/canvas-edit.ts` — `editAttribute(absPath, id, attr, value)` / `applyEdit(...)` | oxc-parser + magic-string; `style.<prop>` + `className` + string attrs; atomic tmp+rename; per-file mutex. DDR-019. Deps `oxc-parser ^0.134.0` + `magic-string ^0.30.21` already present. **Attribute-only — does NOT edit text children (needs a new `editText`) and does NOT move nodes (why reorder is deferred).** |
| `contentEditable` plumbing | `annotations-layer.tsx` (2633+), `input-router.tsx` (325), `canvas-lib.tsx` (209) | Proven in-repo, but only on the **annotation layer** — not on canvas element content. The text-edit UX reuses the pattern, new target. |
| Route-origin security model | `http.ts` `CANVAS_SAFE_API`, `server.ts` `routes`, `test/canvas-origin-gate.test.ts` | DDR-054/088: canvas-reachable routes go in BOTH allowlists; privileged write routes go in NEITHER. |

## Solution

Seven small deliverables on the existing substrate.

**A. Privileged write endpoints (main-origin only).**
- `POST /_api/edit-css` — body `{ canvas, id, property, value }`. Resolve slug→abs `.tsx`; map `property`→`style.<camelProp>`; quote `value`; call `editAttribute(...,'style.<prop>',expr)`.
- `POST /_api/edit-text` — body `{ canvas, id, text }`. Resolve slug→abs `.tsx`; call new `editText(abs, id, text)` (B-engine). JSX-escape the text.
- Both return `{ ok, delta }` or a structured `{ ok:false, code, message }`. Both listed in **NEITHER** `CANVAS_SAFE_API` nor the canvas `routes` map (privileged source writes, DDR-054). The CSS-tab UI lives in the shell (main origin) and reaches them directly; the inline text editor reaches them via the bus → shell relay.

**B. `editText` engine fn (new, in `canvas-edit.ts`).** Find the element by `data-cd-id` (reuse `findOpening`), then locate its **`JSXText` child** and overwrite that span via magic-string. **Leaf-only:** clean only when the element's children are a single (or pure) `JSXText`. Mixed children (text + nested elements + `{expr}`) → throw `CanvasEditError` (the endpoint surfaces "this element has mixed content — use /design:edit"). **Security:** the text is written into **source `.tsx`**, so JSX-significant chars must be entity-escaped (`<`→`&lt;`, `>`→`&gt;`, `{`→`&#123;`, `}`→`&#125;`) — never write raw braces/angle-brackets into source. Positional `data-cd-id`s are unaffected (text doesn't change element index), so no identity recompute.

**C. Editable CSS knobs.** Turn the read-only CSS tab into a form for the top ~8–10 properties (proposed: `border-radius`, `padding`, `margin`, `color`, `background`, `font-size`, `font-weight`, `gap`, `width`, `display` — final in Task 2). Pre-fill from computed style. Commit on blur/Enter → optimistic preview (E) → `POST /_api/edit-css`. Remove the read-only callout.

**D. Inline text editor.** Double-click a leaf element in the canvas → the inspector sets it `contenteditable` + focuses it. On blur/Enter: capture `textContent`, post `dgn:edit-text { id, text }` to the shell → shell calls `POST /_api/edit-text`. Esc cancels (restore original). The contenteditable already shows the new text live (optimistic); persist + file-watcher reload supersedes it. On refusal (mixed children) revert + toast. Double-click that lands on a non-leaf/mixed element → no edit, brief "use /design:edit for rich content" hint.

**E. Optimistic live preview (≤50ms) for CSS.** Knob change posts `dgn:preview-style { id, property, value }` → canvas-shell resolves via `data-cd-id` + sets `element.style[prop]` instantly. Commit persists; file-watcher hard-reload converges; error reverts.

**F. Browsable Layers tree (click-to-select + hover-highlight).**
- **Data:** the inspector (in the canvas iframe) walks the **active artboard's** DOM on demand → posts a serialized tree `{ id, tag, classes, label, children }` to the shell; re-walk on reload. No new HTTP route — the existing postMessage bus.
- **Render:** collapsible indented rows, element-type icon, tag + role/class hint, selected-node highlight. Mirror Chrome DevTools' Elements panel.
- **Click → select:** post `dgn:select-by-id { id, artboard }`; canvas-shell resolves via `dom-selection.ts`, highlights/scrolls, emits the normal `select` payload back so Inspect/CSS tabs update.
- **Hover → highlight:** `dgn:highlight { id }` transient outline.
- **Scope:** rooted at the active artboard; switcher header if multiple artboards. Virtualize only if the perf budget is missed.

**G. Honest failure modes (cross-cutting).** Disable knobs / decline text edit when `selected.id` is absent (legacy `v===1` selection), the element's `style` isn't an inline `{{…}}` object, or text content is mixed. Always prefer a clear "use /design:edit" message over a corrupt source write.

## Deferred (recorded, not silently dropped)

- **Layers drag-to-reorder → dedicated follow-up phase (`phase-12.1-layers-reorder.md`).** Reordering siblings means *moving* JSX element nodes within their parent's children — a "move-node" capability (whitespace-safe span relocation) plus handling that `data-cd-id` is **positional**, so a move recomputes sibling IDs on the next pipeline pass and selection identity must re-settle. Its own risk surface; written after this phase lands. **The browsable click-to-select tree IS in scope; only reorder is deferred.**
- **Phase-10 CRDT multi-peer co-editing** (old Task 4) — superseded + de-referenced (`340b2ed`). Single-writer per canvas via the existing per-file mutex.
- **Export entry point in the inspector toolbar** — Plan C already ships the shell `ExportDialog` with both entry points.
- **Token-aware / className editing + rich (mixed-content) text editing** — v1 writes inline style + leaf text only; class/token-level and mixed-content editing are later enhancements once the simple paths are proven.

## Metadata

- **Type:** New Feature (wiring slice + text-edit engine fn + tree UI)
- **Complexity:** Medium (was High — most infra exists; `editText` + the tree are the genuinely new builds)
- **Depends on:** Plan C (panels + selection bus + contentEditable plumbing), Phase 3.6 / DDR-019 (`canvas-edit.ts` engine), Phase 13 (`data-cd-id` + resolver). All shipped.
- **Supersedes / drops:** original Task 0 gate (waived), original Task 4 (Phase-10 CRDT — superseded).
- **Spins off:** `phase-12.1-layers-reorder.md` (drag-to-reorder) — written after this lands.
- **Ship target:** ready to execute now. Suggest v0.30+.
- **Affected files:**
  - `apps/studio/canvas-edit.ts` — new `editText(abs, id, text)` (JSXText overwrite + JSX-escape + leaf-only guard); extend tests.
  - `apps/studio/api.ts` or new `apps/studio/edit-css.ts` — `POST /_api/edit-css` + `POST /_api/edit-text` handlers (in-process `editAttribute` / `editText`).
  - `apps/studio/http.ts` / `apps/studio/server.ts` — register both routes main-origin-only (NOT in `CANVAS_SAFE_API`, NOT in the canvas `routes` map).
  - `apps/studio/inspect.ts` (inspector injection) — serialized artboard DOM tree on demand; double-click→contenteditable handler; handle `dgn:select-by-id` / `dgn:highlight` / `dgn:preview-style` / `dgn:edit-text`.
  - `apps/studio/canvas-shell.tsx` (canvas runtime bus) — relay select-by-id / highlight / preview-style / edit-text; reuse `dom-selection.ts`.
  - `apps/studio/client/app.jsx` — `InspectorPanel`: editable CSS knobs + commit (remove callout); Layers tab → browsable tree.
  - `apps/studio/test/canvas-origin-gate.test.ts` — assert `/_api/edit-css` AND `/_api/edit-text` blocked from canvas origin.
  - `apps/studio/test/canvas-edit.test.ts` (extend) + new endpoint + tree-serialization tests.
  - **Task 8 (design plugin, separate surface):** `plugins/design/skills/design-system/SKILL.md` (generation envelope), `plugins/design/commands/new.md`, `plugins/design/commands/edit.md`, `plugins/design/agents/{info-architecture,design,signature-moment}-critic.md` — reinforce always-stamp `data-dc-element`.
  - Release bundle rebuild: `dist/client.bundle.js` + `dist/styles.css` (CLAUDE.md release-rebuild rule).

---

## Tasks

### Task 0: Waive the original user-survey gate (record decision)

- **Do:** Write a DDR (`.ai/decisions/DDR-1NN-phase-12-in-canvas-direct-edit.md`) recording: (a) original Task-0 survey gate **waived** — demand established by Plan C shipping panels display-only + naming "live CSS writeback (Phase 12)"; (b) write strategy = inline `style={{}}` merge (CSS) + `JSXText` overwrite with entity-escaping (text), both via the `canvas-edit.ts` engine; leaf-only + inline-only constraints; (c) old Task 4 (Phase-10 CRDT) dropped — single-writer via per-file mutex; (d) drag-to-reorder spun off to `phase-12.1` (rewrite engine is attribute/text-only + `data-cd-id` is positional).
- **Validate:** DDR exists + indexed; no survey artifact required.

### Task 1: `POST /_api/edit-css` endpoint (privileged, main-origin only)

- **Do:** Handler resolves `{canvas:slug}`→abs `.tsx`; maps `property`(kebab)→`style.<camel>`; quotes `value` (`JSON.stringify` for strings, bare numbers through); calls `editAttribute(...,'style.<prop>',expr)`. Returns `{ok,delta}` / structured error. Register **main-origin only**; NOT in `CANVAS_SAFE_API` or the canvas `routes` map.
- **Validate:** valid `{canvas,id,property,value}` mutates source (inline-style merge); invalid id → error; non-inline `style={var}` → friendly refusal.

### Task 2: Editable CSS knobs in the CSS tab (Webflow Style-panel layout)

- **Do:** Replace the read-only CSS-tab body with a **Webflow-style grouped form**. Engine accepts any CSS property (`style.<prop>`), so this is purely the curated surface:
  - **Layout** — `display`, `flex-direction`, `align-items`, `justify-content`, `gap`
  - **Spacing** — `padding` + `margin` via a 4-side box-model widget (per-side longhands)
  - **Size** — `width`, `height`, `min-width`, `max-width`
  - **Typography** — `font-size`, `font-weight`, `line-height`, `letter-spacing`, `text-align`, `color`
  - **Background** — `background-color` (+ swatch picker)
  - **Borders** — `border-width`, `border-style`, `border-color`, `border-radius` (4 corners)
  - **Effects** — `opacity`, `box-shadow`
  - **+ Raw property** escape hatch — type any `property: value` for anything off-list.
  - **Token presets:** where the active DS defines tokens, color knobs show palette swatches and spacing/gap/radius show the DS scale; picking a preset writes `var(--token)` (e.g. `style={{ padding: 'var(--space-3)' }}`), keeping edits on-system. Where no token applies, fall back to a free literal (hex / px) — matching how canvases are already authored (almost entirely inline literal `style={{}}`, e.g. `Agency Hero.tsx`).
  - Pre-fill each knob from the selected element's computed style; commit on blur/Enter → optimistic preview (Task 5) → `POST /_api/edit-css`. Per-side spacing / per-corner radius write the **longhand** (`paddingTop`, `borderTopLeftRadius`); document that a longhand may coexist with an existing shorthand (longhand wins). Disable + honest note when `selected.id` absent or style not an inline `{{…}}` object. Remove the "Phase 12 … read-only" callout.
- **Validate:** change `border-radius` (free px) and a `color` (DS swatch → `var(--accent)`); both commit; reload; persisted; the swatch edit wrote `var(--…)`, the px edit wrote a literal. Raw-property row sets an off-list prop. Keyboard-operable (labels + focus order).

### Task 3: `editText` engine fn + `POST /_api/edit-text` + inline text editor

- **Do:** (a) `editText(abs, id, text)` in `canvas-edit.ts` — find element by `data-cd-id`, overwrite its single `JSXText` child span via magic-string; **entity-escape** `< > { }`; throw `CanvasEditError` on mixed/expression children. (b) `POST /_api/edit-text { canvas, id, text }` (main-origin only; same gating as Task 1). (c) Inline UI: double-click a leaf element in the canvas → inspector sets it `contenteditable` + focuses; blur/Enter → capture `textContent` → `dgn:edit-text { id, text }` → shell → endpoint; Esc cancels/restores; refusal reverts + toasts.
- **Validate:** double-click a button label, retype, blur; source `.tsx` `JSXText` updated + escaped; reload preserves; a `<div>` with mixed children declines with a clear hint; typing `<`/`{` round-trips as entities, never raw into source.

### Task 4: Browsable Layers tree (Webflow Navigator — click-to-select + hover-highlight)

- **Do:** (a) `inspect.ts` walks the **active artboard's** DOM → serializes `{ id, tag, classes, label, type, children }` → posts to shell; re-emit on reload. (b) `app.jsx` Layers tab → collapsible indented tree styled after **Webflow's Navigator**: indentation, collapse carets, selected-node highlight.
  - **Label resolution (readability):** `data-dc-element` (kebab → Title Case, e.g. `cta-primary` → "Cta Primary") → `aria-label` → `role` → `tag` + first meaningful class → bare `tag`. (Phase 13 already injects `data-dc-element` on named/interactive elements — see Task 8 for tightening its coverage so trees read well across all canvases.)
  - **Type icon:** derive from tag + role + `data-dc-element` prefix and render via `StIcon` — button (`button`/`[role=button]`/`cta-*`), heading (`h1`–`h6`/`[role=heading]`), input (`input`/`textarea`/`select`), image (`img`/`svg`/`picture`), link (`a`), list (`ul`/`ol`/`li`), nav (`nav`), form (`form`), text (`p`/`span`), container/box (`div`/`section`/default).
  - (c) Click row → `dgn:select-by-id {id,artboard}` → canvas-shell resolves via `dom-selection.ts`, highlights/scrolls, emits `select` back. (d) Hover → `dgn:highlight {id}`. (e) Artboard-rooted; switcher header for multi-artboard.
- **Validate:** tree shows nested structure with readable labels + correct type icons; click a deep node → selected + highlighted, Inspect tab updates, `_active.json.selected` matches; hover highlights; arrow-navigate + Enter selects.

### Task 5: Optimistic live preview bus (CSS)

- **Do:** `dgn:preview-style { id, property, value }` (shell → canvas-shell) sets `element.style[camelProp]` immediately; Task-1 success → file-watcher reload supersedes; Task-1 error → revert + error.
- **Validate:** knob edit reflects ≤50ms; persist+reload converges; induced error reverts.

### Task 6: Tests + origin-gate guard

- **Do:** (a) `canvas-edit` tests: CSS property→`style.<prop>` mapping + value quoting; `editText` JSXText overwrite, entity-escaping, leaf-only refusal. (b) Endpoint unit tests for both `/_api/edit-css` + `/_api/edit-text` (valid / id-not-found / refusal). (c) `canvas-origin-gate.test.ts`: BOTH endpoints not reachable from canvas origin. (d) Tree-serialization test (well-formed `{id,tag,children}`; select-by-id resolves the same element a Cmd+click would).
- **Validate:** all groups green; `bun test` passes in `apps/studio/`.

### Task 7: Keyboard shortcuts + a11y + perf

- **Do:** `I` toggles inspector (shipped); `Esc` clears selection / cancels text edit; optionally `L` opens inspector on Layers. CSS inputs + tree rows + the contenteditable keyboard-operable, labeled, visible focus; tree `role="tree"`/`treeitem` + arrow nav. Perf: ~500-node tree ≤100ms (virtualize rows only if missed); CSS knob ≤50ms.
- **Validate:** `a11y-auditor` on CSS form + Layers tree + text editor (keyboard-only nav). Benchmark a heavy canvas; log numbers.

### Task 8: Tighten generation envelope — always stamp `data-dc-element` (tree readability)

> **Different surface from Tasks 1–7** (design plugin skills, not `apps/studio/`). Its own validation loop (regenerate a canvas + inspect the tree), so keep its commits/diff separable.

- **Do:** Reinforce the generation envelope so named / interactive / structural-region elements **always** carry a human-readable `data-dc-element="<kebab-id>"` (role-prefixed: `cta-primary`, `card-hero`, `nav-item-1`, `form-field-email`, `section-pricing`, …). Today adoption is spotty (only ~2 canvases use it). Touch: `plugins/design/skills/design-system/SKILL.md` (or the frontend-design generation envelope that `/design:new` consumes), `plugins/design/commands/new.md`, `plugins/design/commands/edit.md`, and the critic(s) that already reference `data-dc-element` (`info-architecture-critic`, `design-critic`, `signature-moment-critic`) so they flag missing labels as a warning. Keep it a **generation directive**, not a hardcoded value (DDR-043 bias-free templates rule).
- **Validate:** `/design:new` a throwaway canvas → every named region / interactive primitive carries `data-dc-element`; open it in the Layers tree → rows read as human labels ("Cta Primary", "Pricing Section"), not "div.flex". Existing canvases without labels still render in the tree via the fallback chain (Task 4) — no regression.

---

## Validation

1. **Static:** `bun test` green in `apps/studio/`; biome + tsc clean (modulo DDR-026 baseline). Record `dist/client.bundle.js` size delta.
2. **Origin-gate:** `/_api/edit-css` AND `/_api/edit-text` blocked from canvas origin.
3. **`/design:smoke` gate (auto-fires):** diff touches `apps/studio/**` → step-3.5 smoke runs. Read every PNG (no sampling, DDR-021). No `BLANK`/`ERROR`/unstyled specimens.
4. **Functional scenarios:** `canvas-inspector-edit` + `canvas-text-edit` + `canvas-layers-select` (web-desktop only — touch out of scope).
5. **A11y:** `a11y-auditor` against CSS form + Layers tree + inline text editor.
6. **Perf:** tree ≤100ms on ~500 nodes; CSS knob ≤50ms perceived.
7. **No regression:** Inspect tab works; `/design:edit` Step 3a still uses the shared `editAttribute` engine; panels behave when nothing selected; annotation-layer contentEditable unaffected.
8. **Release rebuild:** after `client/` changes, `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`; commit `dist/client.bundle.js` + `dist/styles.css`.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `canvas-inspector-edit` | Cmd+click → CSS tab → change `border-radius` → live preview → source `.tsx` inline-`style` merge → reload preserves | 🆕 new |
| `canvas-text-edit` | Double-click a button label → contenteditable → retype → blur → source `JSXText` updated (escaped) → reload preserves; mixed-content element declines | 🆕 new |
| `canvas-layers-select` | Open Layers tree → click a deep nested node → selected + highlighted, Inspect/CSS tabs update, `_active.json.selected` matches | 🆕 new |
| `inspector-source-rewrite-strategy` | Edit a CSS prop / text → source diff matches DDR'd strategy (inline-`style` merge / escaped JSXText); non-inline / mixed → friendly refusal | 🆕 new |
| ~~`canvas-layers-reorder`~~ | Layers drag-to-reorder | ⏭ deferred to `phase-12.1` (node-move AST surgery) |

---

## Acceptance criteria

- [x] Gate decision recorded (Task 0 DDR-101): survey waived; CSS=inline-style merge + text=escaped JSXText overwrite; Phase-10 dropped; reorder → phase-12.1.
- [x] `POST /_api/edit-css` + `POST /_api/edit-text` exist, main-origin only, NOT in `CANVAS_SAFE_API` / canvas `routes`; origin-gate test guards BOTH. _(verified: canvas-origin-gate 403)_
- [ ] CSS tab edits the top ~8–10 properties → source `.tsx` via `editAttribute`; read-only callout removed.
- [ ] Double-click leaf element → inline contenteditable → text writes back to source `JSXText`, JSX-escaped; mixed-content declines cleanly.
- [ ] Optimistic CSS preview ≤50ms; persist+reload converges; endpoint error reverts cleanly.
- [ ] **Layers tab is a browsable tree:** click any layer → select + highlight + Inspect/CSS update; hover → highlight; artboard-scoped; rows show readable labels (`data-dc-element` → aria → tag) + per-type icons (Webflow Navigator style).
- [ ] CSS knobs are grouped Webflow-style (Layout / Spacing / Size / Typography / Background / Borders / Effects + raw escape hatch); token presets write `var(--token)`, free input writes literals; both via inline `style={{}}`.
- [ ] Generation envelope reinforced (Task 8): a freshly `/design:new`'d canvas stamps `data-dc-element` on named/interactive elements → tree reads as human labels.
- [ ] Tests green (CSS mapping/quoting, `editText` escape/leaf-only, both endpoints, origin-gate, tree-serialization); `/design:smoke` clean; a11y keyboard-nav passes.
- [ ] Perf budgets met (tree ≤100ms / ~500 nodes; CSS knob ≤50ms).
- [ ] No regression in Inspect tab, `/design:edit` Step 3a, or annotation-layer text editing.
- [ ] Release bundle rebuilt + committed.
- [ ] Drag-to-reorder explicitly deferred to `phase-12.1` (recorded, not silently dropped).

---

## Retro (2026-06-11)

**Shipped (13 commits `03053f5`…`29b2518` on `worktree-buzzing-snuggling-manatee`):** Tasks 0,1,2,3(engine+UI),4,6,8 — CSS writeback + inline text edit + browsable Layers tree + the always-stamp envelope. Both write endpoints **live-verified** on a real server; CSS panel + Layers tree UI **screenshot-verified**. Full dev-server suite **1331/1331**, tsc baseline-only, biome clean, build clean.

**What worked**
- Reframing the stale plan against the shipped substrate (DDR-019 `editAttribute`, `data-cd-id`, Plan-C panels) collapsed a "2-week High" feature into a wiring slice — the biggest risk (source-rewrite) was already solved + governed.
- Live verification caught **3 real bugs** static checks missed: the WS `selected`-echo clobbering CSS pre-fill (`mergeSelClientFields`), reused `.st-field` (58px) truncating values, and raw `getComputedStyle` noise — the reason the v1 CSS panel was "unusable". Looking at actual pixels (not just green builds) was decisive.
- `el.style` (authored inline) vs `getComputedStyle` (resolved) simplified the value-source away from a planned endpoint.

**What didn't / friction**
- **Authored the whole feature in the wrong tree first** (`main` checkout, not the worktree), tangling with uncommitted annotations-v3; untangling cost real time. Lesson saved to memory.
- v1 CSS panel shipped functional-but-unusable by reusing inspect-tab classes — "build-green ≠ user-usable". CSS-panel polish carved into **phase-12.2** (user-parked).
- Dev-server boots repeatedly dev-bloat `dist/` + churn `site/lib` + `.design/ui/*.meta.json`; constant revert/explicit-stage.

**Deferred (honest):** Task 5 (optimistic preview) → phase-12.2. Task 7 → a11y primitives in code, full auditor at validation. **canvas-render `/design:smoke` + click→source round-trips in a real canvas are NOT yet live-verified** — they need a server **restart** (canvas-shell rebundles per boot; the running server cached the old bundle) + the user on a restarted server (cross-origin Cmd+click = documented automation gap).

**For next /plan:** re-ground a pre-refactor plan against current code BEFORE estimating; for dev-server UI budget a real render-verify loop (screenshot the populated state), not just tsc/build.

**Close-out addendum (2026-06-11, 15 commits `03053f5`…`7ad984c`):** user-tested on a restarted :4555 — text edit confirmed, then 2 follow-ups wired per feedback: context-menu "Inspect" enabled (was a disabled TODO) → opens the right panel; "Inspect" added to the **element context toolbar** (`1 element · Inspect · Copy CSS · Copy ID · Comment`), tool-palette button reverted (wrong place). Final `/flow:done`: full suite **1331/1331** @ HEAD, smoke 0-blank/error (15 UNSTYLED = pre-existing late-CSS-load flake, not phase-12), tsc baseline, biome clean. Live round-trips verified by the user on the restarted server. **Deferred:** phase-12.2 (CSS-panel Webflow polish: steppers/token-dropdown/box-model) + Task 5 preview, both user-parked. Security: write-endpoint surface covered by DDR-101 + the canvas-origin-gate test (no full security fan-out run — no new attack surface beyond the two main-origin routes). Changesets: none on branch (overridable — the What's New entry is the user-facing note). Roadmap regen deferred to merge/main (stale-base worktree).
