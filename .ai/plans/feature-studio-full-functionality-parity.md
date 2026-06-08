# Feature: Studio — full functionality + design parity (Plan C, completes DDR-096)

Validate docs and codebase patterns before implementing. Pay attention to the canvas-origin split (DDR-054 — in-iframe overlays are untrusted; structural changes there carry the `runtime-health` "parse-clean / fails-at-eval" risk + the committed-bundle rebuild rule), the CSS `@layer` order (DDR-014), the committed `dist/client.bundle.js` + `dist/styles.css` release rule (CLAUDE.md "Runtime bundles" + "In-app What's New feed"), and the **no-break exhaustive-verify discipline** (`feedback_no_break_exhaustive_verify`).

> **Plan C of the Studio line.** Plan A = runtime restructure (`apps/studio/`, DDR-095). Plan B = shell rewritten into maude DS (`feature-studio-maude-ds-redesign.md`, DDR-096) — DONE. Plan C closes the gap between the approved `Studio.tsx` mockup and the **actually-running studio**: the items that DDR-096 deferred, the elements that render static placeholders instead of live state, and the in-canvas chrome whose layout/behavior still diverges from the design. The standing parity contract is `.ai/context/studio-shell-parity.md` — extend it, every existing row stays green.

> **⚠ Risk-class invariant (`feedback_no_break_exhaustive_verify`):** Target 100% functional parity, zero regressions. Verify EVERY changed surface live via `agent-browser` per slice — "build green" ≠ "feature green". In-canvas (`canvas-shell.tsx`) work additionally requires `maude design runtime-health --restart` clean + a release-minified bundle rebuild.

## Description

The studio shell now *looks* like maude (DDR-096), but a user-visible audit (2026-06-07) found three classes of remaining gap:

1. **Static-where-it-should-be-dynamic** — top bar zoom is hardcoded `100%`; artboard count shows tab-count (0/1) not the canvas's real artboard count; hub-sync slot only renders in the `notSyncable` edge case so it usually shows nothing.
2. **Deferred-but-wanted** — the Inspector panel (Inspect/Layers/CSS) is CSS-scaffold-only (no React); the command palette is a flat 6-action list missing the design's Canvas/Tools command set (New canvas, Export, Handoff, Draw); export/handoff has no shell-level dialog (only an in-iframe `<select>`-based one); presence avatars never render (the `.st-presence` slot is never fed); the what's-new toast still uses legacy `mdcc-wn-*` styling, not `.st-toast`.
3. **In-canvas chrome divergence** — the canvas iframe (`canvas-shell.tsx`) has no minimap; its zoom controls are nested inside the tool palette instead of a floating ZoomHud + Fit per the design; the comment popover header omits the pin/sequence badge and puts Resolve in the footer; selected annotations have no context toolbar (color swatches / thickness / delete); the DS-folder sidebar rows have no folder icon.

This plan makes every one of those wired + design-matched, and explicitly phases the heavy dependencies (full pan/zoom world transform, live CSS writeback, real multiplayer presence) so the achievable 90% lands now and the aspirational tail is recorded, not silently dropped.

## User Story

As a Maude user, I want the studio to not just look like the `Studio.tsx` design but actually **work** like it — the menubar and status bar reflect live state (real zoom, real artboard count, hub sync), the command palette runs the real Canvas/Tools commands, export/handoff has a proper dialog, the Inspector shows the selected element, and the in-canvas tools (minimap, zoom HUD, annotation color/thickness, comment threads) match the design — so the tool is complete, not a styled shell over placeholders.

## Problem

The audit (4 parallel passes over `app.jsx`, `canvas-shell.tsx`, the overlay `*.tsx`, and the export backend, 2026-06-07) catalogued the exact gaps below. The user explicitly asked for "nejen kompletní redesign ale i plnou funkcionalitu."

## Solution

Close the gaps slice-by-slice, grounded in the audit's file:line citations. Each slice extends `.ai/context/studio-shell-parity.md` with its new rows and is live-verified. Heavy dependencies are isolated into their own phase with a DDR gate so they don't block the wins.

## Metadata

- **Type**: Enhancement + Refactor (UI / dev-server client + in-canvas overlays)
- **Complexity**: High — spans the shell client, the in-canvas overlay bundle (untrusted origin), the export backend wiring, and a committed-bundle release rebuild
- **App/Package**: `@maude/dev-server` — `apps/studio/client/app.jsx` + `client/styles/*-maude.css`; in-canvas `apps/studio/{canvas-shell,tool-palette,comments-overlay,annotations-layer,contextual-toolbar,participants-chrome}.tsx`; export wiring `api.ts`/`http.ts`/`exporters/`
- **Affected Systems**: `build.ts` (client + Lightning CSS), committed `dist/client.bundle.js` + `dist/styles.css` + `dist/runtime/*.js`, `/design:smoke`, `runtime-health`, what's-new feed
- **Dependencies**: none new (React 19, maude tokens are CSS, export backend already supports 7 formats × 4 scopes)

---

## Context References

### Must-Read Files

> Read in parallel in a single message during `/flow:execute`.

- `.design/ui/Studio.tsx` (770 lines) — the design spec. Key components: Menubar (167), StatusBar (313), ViewDropdown (133), ToolsDropdown (155), Sidebar+TreeRow (206/216), FloatingToolbar (274), ZoomHud (301), Minimap (289), PresenceCursor (94), InspectorPanel (330), CommentsPanel (387), CommentsStage thread popover (438), AnnotateStage context toolbar (457), PaletteBoard (640), HandoffBoard export dialog (712).
- `.design/ui/Studio.css` — the `.st-*` token CSS for every element; lift the not-yet-ported classes (`.st-minimap`, `.st-zoom`, `.st-toolbar`, `.st-toast`, `.st-insp-*`, `.st-rp-*`, `.st-thread`, `.st-ctx`, `.st-cpop`, `.st-sticky`, `.st-dialog`, `.st-fmt*`).
- `apps/studio/client/app.jsx` — Menubar (~1527), `.st-mb-right` (1656–1682, the static zoom/artboard slots), StatusBar (2062–2124, hub-sync conditional at 2100), DsFolderRow (510–542, no folder glyph), Viewport/stage (1687–1764), CommandPalette (361–447) + paletteActions (3181–3225), ai-activity relay (2599–2610).
- `apps/studio/client/styles/3-shell-maude.css` — present families: `.st-stage`/`.st-empty` (279–296), `.st-rpanel`/`.st-rp-*`/`.st-insp-*` (299–350, scaffold), `.st-palette` (373–393), `.st-presence`/`.st-avatar` (125–128, unused). ABSENT: `.st-minimap`, `.st-zoom`, `.st-toolbar`, `.st-toast`, `.st-thread`, `.st-ctx`, `.st-cpop`, `.st-sticky`, `.st-dialog`, `.st-fmt*`.
- `apps/studio/canvas-shell.tsx` (1958) — in-canvas overlay root; `dgn:tool-set` handler (~1295), no Minimap mount.
- `apps/studio/tool-palette.tsx` — bottom-center palette; zoom nested at 422–479; `DRAW_TOOLS` (232) collapses rect/ellipse into one "shape" + popover.
- `apps/studio/comments-overlay.tsx` — CommentThread (926–1110); header 1028–1043 (no pin badge); Resolve in footer 1081–1096.
- `apps/studio/contextual-toolbar.tsx` — element-selection toolbar only (copy CSS/ID/comment); no annotation color/thickness/delete.
- `apps/studio/annotations-layer.tsx` — stroke/sticky/halo rendering.
- `apps/studio/participants-chrome.tsx` + `cursors-overlay.tsx` + `use-agent-presence.tsx` — existing in-canvas presence (cursors match design; avatar stack is an unmodeled extra to reconcile).
- `apps/studio/export-dialog.tsx` — in-iframe `<dialog>` (495–570); `exporters/index.ts` (7 formats), `exporters/scope.ts` (4 scopes), `http.ts` `/_api/export` (688–756) + `/_api/export-history` (680–686).
- `apps/studio/client/whats-new.jsx` — `mdcc-wn-toast` (135–150), to restyle to `.st-toast`.
- `.ai/decisions/DDR-096-studio-shell-rewritten-in-maude-ds.md` + `.ai/context/studio-shell-parity.md` + CLAUDE.md "Runtime bundles" / "In-app What's New feed".

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio.tsx` | (meta) | maude, app-shell | **The spec.** All 6 artboards are the parity target for this plan. |

### Patterns to Follow

- **Lift, don't reinvent** — `Studio.css` already solves every `.st-*` element in maude tokens; port the not-yet-present classes near-verbatim into `client/styles/*-maude.css` (DDR-014 `@layer` order). No hardcoded hex.
- **DDR-054 untrusted origin** — in-canvas (`canvas-shell.tsx`) changes are structural-risk; keep diffs surgical, rebuild release-minified, run `runtime-health --restart`.
- **Backend already exists** — export is 7 formats × 4 scopes server-side; the gap is a shell-level dialog + palette/keyboard wiring, not new export logic.

---

## Design Decisions

### Scope calls (confirm or redirect in `/flow:execute`)

| Surface | This plan builds | Deferred (own phase + DDR) |
| ------- | ---------------- | -------------------------- |
| Top-bar zoom | live zoom relayed from the iframe's existing in-canvas zoom via postMessage | full shell-driven pan/zoom world transform (Phase 4) |
| Artboard count | real count from the open canvas's meta/DOM | — |
| Hub sync slot | always-visible `N ↑ [synced]` counter from `/_sync-status` | — (reconcile vs DDR-060's notSyncable-only rule in a DDR) |
| Command palette | full Canvas/Tools grouped set wired to real flows | — |
| Export/Handoff | shell-level maude dialog (6-format grid + shadcn callout) over the existing backend | retire/keep the in-iframe dialog — decide in a DDR |
| Inspector panel | **display-only** Inspect/Layers/CSS from live selection | live CSS writeback to the artboard (Phase 12, needs canvas-origin write bridge + DDR) |
| Presence | real agent-activity + local git-user avatar in menubar | full human multiplayer presence channel |
| In-canvas minimap / ZoomHud / annotation ctx toolbar / comment-pin badge | all built per design | — |

### Tokens

Adopt the remaining `.st-*` classes from `Studio.css` verbatim (`--bg-*`, `--fg-*`, `--accent*`, `--presence-*`, `--status-*`, `--radius-*`, `--dur-*`). No hardcoded hex.

---

## Tasks

Execute in order. Each slice ends with an agent-browser parity pass + parity-doc rows.

### Task 1: EXTEND — parity contract rows for every Plan-C gap (no code)

- **Do**: Append a "Plan C — functionality parity" section to `.ai/context/studio-shell-parity.md`, one row per gap below with trigger → expected. Rows: top-bar live zoom; real artboard count; always-on hub-sync; DS-folder folder icon; menubar presence (agent + git-user); command-palette full set + grouping; shell export/handoff dialog (6-format grid); inspector display-only (3 tabs); in-canvas minimap; floating ZoomHud + Fit; annotation context toolbar (color/thickness/delete); comment-popover pin badge + header Resolve; what's-new `.st-toast` restyle; ParticipantsChrome reconciliation.
- **Validate**: every audit finding has a row; existing rows untouched.

### Task 2: UPDATE — top bar live state (zoom · artboard count · presence) + DS-folder icon

- **Do**:
  1. **Zoom** (app.jsx ~1677): replace `ZOOM 100%` literal with state fed by a new `dgn:zoom` postMessage the canvas iframe emits on zoom change (the in-canvas zoom already exists in `tool-palette.tsx`); seed `100%` until first message.
  2. **Artboard count** (app.jsx ~1672): replace `tabsCount` with the real artboard count of the open canvas (from its `.meta.json` `artboards[]` or a `dgn:artboards` count message from the iframe). Keep `ARTBOARDS` label.
  3. **Presence** (app.jsx Menubar): pass a `presence` prop — render the local user avatar (`/_api/git-user` initials) + a live agent avatar when `ai-activity` is active (data already arrives at 2599–2610). Wire the unused `.st-presence`/`.st-avatar` CSS.
  4. **DS-folder icon** (app.jsx DsFolderRow 510–542): add a `<span className="st-row-glyph"><StIcon name="folder" /></span>` between the chevron and the name, matching the design's `TreeRow glyph="folder"`.
- **Pattern**: postMessage relays mirror the existing theme/ai-activity broadcast loop (2464–2470, 2599–2610).
- **Gotcha**: the iframe is untrusted (DDR-054) — treat `dgn:zoom`/`dgn:artboards` as advisory display only; clamp/validate before render.
- **Validate**: agent-browser — open a canvas, zoom in the iframe → top bar updates; artboard count matches the canvas; DS folders show a folder icon; local avatar renders; trigger an agent edit → agent avatar appears.

### Task 3: UPDATE — bottom bar always-on hub sync + what's-new `.st-toast`

- **Do**:
  1. **Hub sync** (app.jsx StatusBar 2100–2113): render the slot unconditionally with `{syncStatus.pushable ?? 0} ↑` + ` synced` when caught up, falling back to today's `0 syncable` only when linked-but-not-syncable. Record the reconciliation vs DDR-060 in the Task-9 DDR.
  2. **What's-new toast** (whats-new.jsx 135–150): restyle from `mdcc-wn-toast` to `.st-toast`/`.st-toast-hd`/`.st-toast-title`/`.st-toast-txt` per Studio.tsx 655–660; port `.st-toast*` CSS from Studio.css. Behavior unchanged (DDR-096's deferred polish).
- **Validate**: agent-browser — hub-sync slot always visible with correct count in linked + unlinked states; what's-new toast renders in maude `.st-toast` styling.

### Task 4: ADD — command palette full Canvas/Tools set + grouping

- **Do**: Extend `paletteActions` (app.jsx 3181–3225) to the grouped design set (PALETTE, Studio.tsx 636–639): **Canvas** — New canvas… (⌘N → new-board composer), Export… (⇧⌘E → Task-5 dialog), Handoff to production (⇧⌘H → Task-5 dialog handoff tab); **Tools** — Draw a mark (⌘D → surface the `/design:draw` hint/flow), Toggle theme, Open inspector (I → Task-6). Keep the existing reload/comments/what's-new/help. Render group headers in `CommandPalette` (361–447) + bind the new keyboard shortcuts. Preserve fuzzy search + ↑/↓/Enter nav.
- **Gotcha**: ⌘K must actually open it — verify the binding in the running build (user reported it "missing or not working"); add a regression row.
- **Validate**: agent-browser — ⌘K opens; groups render; New canvas / Export / Handoff / theme / inspector all execute; search + arrow-nav + Enter work.

### Task 5: ADD — shell-level Export & Handoff dialog (maude `.st-dialog`)

- **Do**: Build a shell-level export modal per HandoffBoard (Studio.tsx 712–754): `.st-scrim` + `.st-dialog`, a 6-format `.st-fmt-grid` (PNG·2× / PDF / SVG / HTML / shadcn / ZIP) with selectable `.is-on` cards, scope summary ("N artboards selected"), the shadcn registry-item callout, and a primary "Export" / "Export registry-item" button. Wire to the existing `POST /_api/export` (7 formats × 4 scopes) + `/_api/export-history`. Open from the palette (Task 4) + ⇧⌘E / ⇧⌘H. Decide in the DDR whether the in-iframe `export-dialog.tsx` is retired or kept as the in-canvas entry.
- **Gotcha**: backend formats include PPTX/Canva not in the design's 6 — keep them reachable (e.g. a "more" affordance) rather than dropping capability (no silent cap).
- **Validate**: agent-browser — open via palette + shortcut; select each format; export downloads; history shows; shadcn handoff produces a registry-item.

### Task 6: ADD — Inspector panel (display-only Inspect / Layers / CSS)

- **Do**: Build the `InspectorPanel` React component per Studio.tsx 330–385 into the right dock, using the scaffolded `.st-rpanel`/`.st-rp-*`/`.st-insp-*` CSS. **Inspect** tab: pos/size/radius/fill/text/font of the current selection (from the existing `selected` postMessage data — extend it with computed geometry/styles via a `dgn:inspect` request to the iframe if needed). **Layers** tab: the selection's ancestor/child tree. **CSS** tab: computed styles, **read-only**, with the Phase-12 "knob edits write back" callout kept as a callout (not a live control). Enable the View-dropdown "Inspector" item + the `I` shortcut (drop the Phase-12 disabled flag for display-only).
- **Gotcha**: DDR-096 deliberately did NOT ship a display-only panel "claiming functionality it lacks" — so the CSS tab MUST visibly mark itself read-only (the callout) to avoid implying writeback. Live writeback stays a separate phase.
- **Validate**: agent-browser — select an element in the canvas → Inspect shows its real props; Layers shows its tree; CSS shows computed values + the read-only callout; tab switch works; `I` + View-dropdown open it.

### Task 7: ADD — in-canvas chrome: Minimap · floating ZoomHud+Fit · annotation context toolbar · comment-pin badge (untrusted origin)

- **Do** (all in `canvas-shell.tsx` + siblings, token-disciplined, minimal structural diff):
  1. **Minimap** — mount a Minimap per Studio.tsx 289–300 (world bounds + artboard rects + viewport outline + "World N/N" header). Port `.st-minimap` CSS.
  2. **ZoomHud** — extract the zoom controls from inside the tool palette into a floating ZoomHud (zoom-out / value / zoom-in / Fit) per Studio.tsx 301–310; port `.st-zoom` CSS. (Tool-palette keeps tools only.)
  3. **Annotation context toolbar** — when a stroke/shape is selected, show a floating toolbar (color swatches with `.is-on` / thickness chip / delete) per Studio.tsx 474–483; extend `contextual-toolbar.tsx` or add an annotation-scoped variant. Port `.st-ctx`/`.st-cpop`/`.st-sticky` CSS.
  4. **Comment popover pin badge** — add the pin/sequence number to the thread header + move Resolve into the header row per Studio.tsx 438–439 (`comments-overlay.tsx` 1028–1043).
  5. **Optional rect/ellipse split** — decide whether to split the collapsed "shape" tool into separate rect/ellipse buttons per the design, or keep the popover (lower priority; note in DDR).
- **Gotcha**: this is the untrusted canvas-runtime bundle — diffs risk the "parse-clean, fails-at-module-eval" class; rebuild release-minified, `git checkout` vendored `dist/runtime/*.js` if the boot self-heal regenerated them, and run `runtime-health --restart`.
- **Validate**: agent-browser on a canvas with annotations + comments — minimap renders + tracks; ZoomHud zooms + Fit works; select a stroke → color/thickness/delete toolbar; open a comment → pin badge + header Resolve; `runtime-health` clean.

### Task 8: RECONCILE + VERIFY — ParticipantsChrome, full parity sweep, smoke, release rebuild

- **Do**:
  1. Reconcile `participants-chrome.tsx` (the top-right avatar stack, an unmodeled extra) with the design's menubar presence — keep both with a clear role split, or fold, and document.
  2. Walk the entire `.ai/context/studio-shell-parity.md` (Plan A/B rows + new Plan-C rows) live via agent-browser — zero regressions.
  3. `maude design smoke` (UI canvases + specimens), `maude design runtime-health`.
  4. **Release rebuild** (CLAUDE.md): `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` → commit release-minified `dist/client.bundle.js` + `dist/styles.css`; restore `dist/runtime/*.js` if regenerated.
- **Validate**: parity 100% green; smoke exit 0; runtime-health OK; committed bundles release-sized (~250 KB, not the 3.6 MB dev bundle).

### Task 9: RECORD — DDR + what's-new + roadmap

- **Do**: DDR for Plan C's scope calls (always-on hub-sync vs DDR-060; shell export dialog vs in-iframe; inspector display-only with writeback deferred; presence = agent+git-user not multiplayer; top-bar zoom relay vs full pan/zoom). Append a what's-new entry via the `whats-new-entry` skill ("Studio: live status bar, command palette, export dialog, inspector"). Regen roadmap (`pnpm --filter @maude/site gen:roadmap`).
- **Validate**: DDR recorded + indexed; what's-new pending (version null); roadmap diff committed.

---

## Deferred (out of Plan C — recorded, not dropped)

- **Full shell-driven pan/zoom world transform** (Phase 4) — top-bar zoom here is relayed-display only; a real fit/zoom-to-cursor world is its own plan. Blocks: menubar Zoom dropdown items, minimap viewport-drag.
- **Live CSS knob writeback** (Phase 12) — Inspector CSS tab is read-only here; writeback needs a canvas-origin write bridge (DDR-054) + diff-staging for handoff.
- **Presentation mode** (Phase 6) — the View-dropdown "Presentation" item stays disabled.
- **Real human multiplayer presence** — menubar shows agent + local user only; a presence WS channel for remote humans (the mock's Petra/Sam) is separate.

---

## Validation

1. **Build**: `cd apps/studio && bun run build.ts` then `--release` — both succeed; Lightning CSS emits `dist/styles.css`.
2. **Parity (the bar)**: every row of `.ai/context/studio-shell-parity.md` (incl. new Plan-C rows) green via agent-browser — zero regressions.
3. **Smoke**: `maude design smoke` — UI canvases + specimens render styled.
4. **Runtime health**: `maude design runtime-health` — clean after in-canvas changes.
5. **Committed bundles**: `dist/client.bundle.js` + `dist/styles.css` release-minified + committed; `dist/runtime/*.js` unchanged-or-restored.
6. **A11y**: `a11y-auditor` over the new surfaces (palette, dialog, inspector, in-canvas toolbars) — contrast (dark+light), focus, keyboard nav, `prefers-reduced-motion`.
7. **Visual**: `/design:screenshot` shell vs `Studio.tsx` artboards — match.

## Acceptance Criteria

- [ ] Top bar: zoom + artboard count live; presence (agent + git-user) renders.
- [ ] Bottom bar: hub-sync always visible with real count; what's-new toast in `.st-toast`.
- [ ] Sidebar: DS-folder rows show a folder icon.
- [ ] Command palette: ⌘K opens; full grouped Canvas/Tools set wired; search + kbd nav.
- [ ] Shell export/handoff dialog over the real backend (6-format grid + shadcn).
- [ ] Inspector panel display-only (Inspect/Layers/CSS) wired to live selection; CSS tab clearly read-only.
- [ ] In-canvas: minimap, floating ZoomHud+Fit, annotation context toolbar, comment-pin badge + header Resolve.
- [ ] ParticipantsChrome reconciled with menubar presence.
- [ ] 100% parity, zero regressions (standing rule); smoke + runtime-health green; bundles release-rebuilt + committed.
- [ ] DDR recorded (all scope calls); what's-new appended; roadmap regen committed.
- [ ] Deferred tail (pan/zoom, CSS writeback, presentation, multiplayer) explicitly recorded, not silently dropped.
