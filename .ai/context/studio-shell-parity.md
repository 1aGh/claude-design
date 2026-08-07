# Studio shell — parity checklist (regression contract)

> **Source of truth for Plan B (`feature-studio-maude-ds-redesign.md`).** Every row below is a
> user-facing capability of the current `apps/studio/client/app.jsx` (3181 lines). The rewrite into
> maude-DS components must keep EVERY row green, verified live via agent-browser after each slice.
> A dropped row = a silently-removed feature (the `feedback_no_break_exhaustive_verify` standing rule
> forbids it). Status legend: ☐ not-yet-verified · ✅ verified green · ⚠ degraded · ❌ regressed.
>
> Generated Task 1, 2026-06-06. Each slice (Tasks 3–7) re-checks its rows; Task 8 walks the whole list.

## A. Persistence / localStorage stores

| # | Store key | Behavior | Slice |
|---|-----------|----------|-------|
| A1 | `mdcc-theme` | theme `light`/`dark`, dark default; restored at boot (`readInitialTheme`) | T2/T3 |
| A2 | `mdcc-sidebar-open` | sidebar open/collapsed persists (`SIDEBAR_STORE`) | T4 |
| A3 | `mdcc-show-hidden` | show-hidden-files persists (`SHOW_HIDDEN_STORE`) | T4 |
| A4 | `mdcc-sections-expanded` | per-section collapse map persists (`SECTIONS_STORE`) | T4 |
| A5 | `mdcc-usage-tour-seen` | first-run tour nudge suppressed after seen (`USAGE_TOUR_STORE`) | T6 |
| A6 | `mdcc-whatsnew-seen` | what's-new unseen-marker (in `whats-new.jsx`) | T6 |

## B. Menubar

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| B1 | Brand mark | "maude" wordmark + dot/mark in top-left | T3 |
| B2 | Menu names | File · Edit · View · Selection · Tools · Help rendered | T3 |
| B3 | File/Edit inert | disabled, `aria-disabled`, "coming later" title | T3 |
| B4 | View dropdown | click View → panels list (Project Tree, Comments Sidebar, Show hidden, Layers[disabled], Inspector[disabled], Annotations, Presentation[disabled]) + Zoom block | T3 |
| B5 | View toggles wired | Project Tree→sidebar, Comments Sidebar→comments panel, Show hidden→showHidden, Annotations→postMessage `view-annotations` | T3 |
| B6 | View dropdown check state | active panels show ✓ checkmark | T3 |
| B7 | Selection dropdown | Deselect all → `dgn:selection-clear`; Select all annotations → `dgn:annotation-select-all` (postToActiveCanvas) | T3 |
| B8 | Tools dropdown | 10 tools (move/hand/comment/pen/rect/ellipse/sticky/arrow/text/eraser) → `dgn:tool-set` | T3 |
| B9 | Dropdown close | Esc + outside-click close the open dropdown | T3 |
| B10 | Help item | click Help → opens HelpModal | T3/T6 |
| B11 | What's-new badge | badge w/ unseen count; click opens panel (`whats-new.jsx`) | T3/T6 |
| B12 | Stamp | SYSTEM (system tab) / CANVAS (canvas open) / IDLE (none) | T3 |
| B13 | File label | `dir/`**name** for active canvas; "design system" for system tab; "no canvas open" when none | T3 |
| B14 | ARTBOARDS count | reads `tabs.length` (0 or 1 in single-canvas model) | T3 |
| B15 | ZOOM | shows 100% (static; pan/zoom is later phase) | T3 |
| B16 | Project name | shows project (`MDCC` fallback) | T3 |
| B17 | `data-tour="help"` | tour anchor attribute present on Help menu | T6 |

## C. Sidebar — file tree

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| C1 | Group sections | PROJECT / DESIGN SYSTEM / UI CANVASES / RUNTIME·GITIGNORED from server `kind`+label | T4 |
| C2 | Section collapse | click section header chevron → toggle; persists (A4); search forces open | T4 |
| C3 | Section default-open | runtime + "Design system" collapsed by default; others open | T4 |
| C4 | Section pill count | DS = #DS folders; others = #canvas files | T4 |
| C5 | Hidden sections | runtime + orphan-only project hidden unless showHidden or search | T4 |
| C6 | DirRow | nested dir expand/collapse (▾/▸), local state | T4 |
| C7 | DsFolderRow | chevron toggles folder; click name → opens SystemView scoped to that DS; active highlight | T4/T6 |
| C8 | FileRow open | click canvas (.tsx/.html) → opens it (replaces active); selected highlight + ▸ glyph | T4 |
| C9 | FileRow preview | non-canvas, non-runtime rows (.md/.css/.json/images/fonts/video/audio) open an inline preview (`FilePreview` overlay) on click, not a canvas tab; RUNTIME rows and genuinely unrecognized extensions stay `aria-disabled` no-op (feature-studio-file-preview) | T4 |
| C10 | Runtime muted | runtime files styled muted, not deletable | T4 |
| C11 | Open-count badge | canvas with open comments shows count badge | T4 |
| C12 | Delete canvas | `tp-del` trash button (not DS, not runtime) → confirm → DELETE → tree refresh + reset active if open | T4 |
| C13 | Sidecar grouping | `.meta.json`/`.css` collapse under primary canvas; chevron only in showHidden; forceOpen on search hit | T4 |
| C14 | New-board composer | "+ board" toggles input; type name; Enter create / Esc cancel; busy "…"; error inline; opens new board active | T4 |
| C15 | FILES header counter | `htmlShown / htmlCount` + live-dot (wsConnected) | T4 |
| C16 | Search box | filter input; filters tree (name+path); clear button (×); `/` kbd hint | T4 |
| C17 | Search → sections | active search forces all sections open + reveals hidden | T4 |
| C18 | Empty states | "No matches." (search) / "Empty." (no items) per section | T4 |

## D. Viewport

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| D1 | Empty state | no canvas → Wordmark + instructions panel | T5 |
| D2 | Canvas iframe | open file → iframe `src=canvasUrl(path,cfg)` mounts canvas | T5 |
| D3 | Single-canvas replace | opening a 2nd file replaces the 1st (drops old iframe node) | T5 |
| D4 | Sandbox attrs | `sandbox`/`allow` set only when `cfg.canvasOrigin` (cross-origin split) | T5 |
| D5 | System tab branch | SYSTEM_TAB renders SystemView, not an iframe | T5/T6 |
| D6 | iframe hot-reload | file-watcher reload still re-renders the iframe; ⌘R reloads | T5 |
| D7 | registerIframe | iframe ref tracked in `iframesRef` for postMessage | T5 |

## E. SystemView (`__system__`)

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| E1 | Header | SKU + "design system view" title + `systemDir` location | T6 |
| E2 | DS picker | when >1 DS, `<select>` switches DS → `loadSystemData(ds)` | T6 |
| E3 | DS description | `ds.description` paragraph when present | T6 |
| E4 | TokenLadder | grouped tokens (colors as swatches, spacing/radius/etc.); empty state if none | T6 |
| E5 | TypeLadder | font-size ladder w/ leading + sample font | T6 |
| E6 | Gallery preview | preview specimen iframe thumbnails; click opens | T6 |
| E7 | Gallery ui_kits | ui_kits thumbnails; click opens | T6 |
| E8 | Empty galleries | message when no preview/ui_kits folders | T6 |

## F. Status bar (bottom)

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| F1 | Active file slot | shows active path / "▦ design system" / "—" | T3 |
| F2 | Selected element slot | selector + text excerpt + clear (×) when element selected (not system tab) | T3 |
| F3 | Open-comments count | total open comment count | T3 |
| F4 | Connection dot | live (connected) / reconnecting | T3 |
| F5 | Hub-sync slot | "0 syncable" when linked-but-not-syncable (DDR-060) | T3 |
| F6 | Theme toggle | sun/moon → toggles theme (A1) | T3 |

## G. Comments panel (right sidebar)

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| G1 | Toggle | ⌘⇧M or View dropdown → opens/closes right panel (`with-rsidebar`) | T6 |
| G2 | Header + total | "Comments" + total count | T6 |
| G3 | Filters | All / Open / Resolved tabs w/ counts | T6 |
| G4 | File groups | comments grouped by file; group header jumps to file | T6 |
| G5 | Comment row | number, time-ago, text, selector, resolve/reopen/delete actions | T6 |
| G6 | Jump-to | click row → opens file + focuses pin (postMessage `comment-focus`) | T6 |
| G7 | Focused highlight | focused comment id → `active-pin` highlight | T6 |
| G8 | Empty state | message when no comments for filter | T6 |

## H. Comment data flow (iframe ↔ shell ↔ WS)

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| H1 | Load all comments | `/_comments-all` at boot → `commentsByFile` | T5 |
| H2 | comment-submit | iframe `dgn:comment-submit` → WS `comments-add` | T5 |
| H3 | comment-patch | thread resolve/reopen → WS `comments-patch` | T5 |
| H4 | comment-delete | iframe/panel → WS `comments-delete` | T5 |
| H5 | comment-click | iframe pin click → `focusedCommentId` | T5 |
| H6 | comments-set push | comments change / iframe loaded → postMessage `comments-set` to iframe | T5 |
| H7 | WS comments update | WS `comments` msg → updates `commentsByFile[file]` | T5 |
| H8 | CommentBar summary | bottom open-count strip when canvas + open comments | T3 |

## I. Selection / element-pick flow

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| I1 | select / select-set | iframe ⌘+click → `dgn:select`/`select-set` → `selected` + WS `select` | T5 |
| I2 | clear-select | Esc / clear button → `dgn:clear-select` / WS `clear-select` + postMessage `force-clear` | T5 |
| I3 | StatusBar reflects | selected element shows in status bar (F2) | T3/T5 |
| I4 | tool-cursor | iframe `dgn:tool-cursor` → `resolveToolCursor` → app-wide cursor (trusted resolver only) | T5 |

## J. Theme / presence broadcast

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| J1 | theme → html attr | theme change sets `<html data-theme>` + localStorage | T2/T3 |
| J2 | theme → iframes | theme change broadcasts `dgn:theme` to every open iframe | T3 |
| J3 | theme seed on load | iframe `dgn:loaded` → seeds current theme (no flash) | T5 |
| J4 | ai-activity relay | WS `ai-activity` → postMessage to every iframe | T5 |

## K. Export bridge (canvas-origin → main-origin)

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| K1 | export-request | iframe `dgn:export-request` → bridged `POST /_api/export` → download | T5 |
| K2 | export-history | iframe `dgn:export-history-request` → bridged `/_api/export-history` | T5 |

## L. Banners / transient UI

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| L1 | SyncBanner | offline (queued count) / offline-long / reconnect-flash pill (`sync:status`) | T6 |
| L2 | git-lifecycle banner | repo state change → "reload to sync?" prompt (reload/dismiss) | T6 |
| L3 | WhatsNewToast | unseen what's-new → toast (suppressed during tour/nudge) | T6 |

## M. Help + tour

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| M1 | HelpModal | Help menu / ? / F1 → modal w/ cheatsheet `<details>` sections + SKU version | T6 |
| M2 | Help close | Esc + backdrop click close | T6 |
| M3 | Take the tour | HelpModal button → starts USAGE_TOUR | T6 |
| M4 | First-run nudge | usageNudge (not seen) → "Take a 60-second tour" prompt; Start/Dismiss | T6 |
| M5 | TourOverlay | renders tour steps; onComplete marks seen | T6 |
| M6 | WhatsNewPanel | what's-new panel (also can start tour) | T6 |

## N. Keyboard shortcuts

| # | Key | Action | Slice |
|---|-----|--------|-------|
| N1 | ⌘R | reload active iframe (override browser) | T5 |
| N2 | ⌘⇧M | toggle comments panel | T6 |
| N3 | `/` | focus search box | T4 |
| N4 | ⌘F | open sidebar + focus search | T4 |
| N5 | T | toggle sidebar (bare letter; guarded in canvas iframe) | T3/T4 |
| N6 | H | toggle show-hidden | T4 |
| N7 | S | toggle System view | T6 |
| N8 | ? / F1 | open Help modal | T6 |
| N9 | Esc | clear focused pin | T6 |
| N10 | canvas-iframe guard | bare letters (T/H/S) skip when focus is in iframe | T5 |

## O. Infra / wiring

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| O1 | WebSocket connect | `/_ws` connect + auto-reconnect (1s); wsConnected state | T5 |
| O2 | /_config fetch | designRel, tokensCssRel, designSystems, canvasOrigin into cfg | T5 |
| O3 | /_index-data fetch | groups + project + canvasDesignSystems (DDR-093) | T4/T5 |
| O4 | /_sync-status fetch | backfill sync banner on mount | T6 |
| O5 | WS send tabs/active | tabs + active-file pushed over WS (drives `_active.json`) | T5 |
| O6 | Context-menu suppress | native context menu suppressed in shell (kept in inputs) | T3 |
| O7 | App layout classes | `app` + `with-rsidebar` + `no-sidebar` modifiers | T3 |

---

## P. Plan C — functionality parity (`feature-studio-full-functionality-parity.md`, 2026-06-07)

> New rows closing the gap between `Studio.tsx` and the running studio. Plan-C task in the
> `Slice` column. Same legend (☐ / ✅ / ⚠ / ❌). Plan A/B rows above stay green.

| # | Capability | Trigger → Expected | Slice |
|---|-----------|--------------------|-------|
| P1 | Top-bar live zoom | iframe zoom change → `dgn:zoom` relay → menubar `ZOOM <n>%` updates (was static 100%) | T2 |
| P2 | Real artboard count | open canvas → menubar `<n> ARTBOARDS` = canvas's real artboard count (was `tabs.length` 0/1) | T2 |
| P3 | Menubar presence | local git-user avatar always; agent avatar appears on `ai-activity`; `.st-presence` slot fed | T2 |
| P4 | DS-folder icon | DS-folder rows render a `folder` glyph in `.st-row-glyph` (parity with `TreeRow glyph="folder"`) | T2 |
| P5 | Always-on hub-sync | status-bar hub-sync slot always visible with `N ↑ [synced]` from `/_sync-status` (was notSyncable-only) | T3 |
| P6 | What's-new `.st-toast` | toast renders in `.st-toast*` maude styling (was legacy `mdcc-wn-toast`) | T3 |
| P7 | Palette grouped set | ⌘K → grouped Canvas/Tools commands (New canvas, Export, Handoff, Draw, theme, inspector, …) | T4 |
| P8 | Palette opens | ⌘K actually opens palette; search + ↑/↓/Enter nav work | T4 |
| P9 | Shell export dialog | palette/⇧⌘E → `.st-dialog` 6-format grid (PNG/PDF/SVG/HTML/shadcn/ZIP) → `POST /_api/export` → download | T5 |
| P10 | Shell handoff | palette/⇧⌘H → dialog handoff (shadcn registry-item) | T5 |
| P11 | Inspector Inspect tab | select element → pos/size/radius/fill/text/font of selection (display-only) | T6 |
| P12 | Inspector Layers tab | selection's ancestor/child tree | T6 |
| P13 | Inspector CSS tab | computed styles, READ-ONLY w/ Phase-12 writeback callout | T6 |
| P14 | Inspector open | View-dropdown "Inspector" enabled + `I` shortcut opens panel | T6 |
| P15 | In-canvas minimap | canvas → minimap (world bounds + artboard rects + viewport outline + "World N/N") | T7 |
| P16 | Floating ZoomHud | zoom controls as a floating ZoomHud (out/value/in/Fit), not nested in tool palette | T7 |
| P17 | Annotation ctx toolbar | select stroke/shape → color swatches (`.is-on`) + thickness chip + delete | T7 |
| P18 | Comment-pin badge | thread popover header shows pin/sequence number + Resolve in header row | T7 |
| P19 | ParticipantsChrome reconcile | top-right avatar stack role-split vs menubar presence (kept or folded, documented) | T8 |

**Verification (2026-06-07, agent-browser + `maude design smoke`):**
✅ P1 (top bar ZOOM 91% live, was static 100%) · ✅ P2 (6 ARTBOARDS real) · ✅ P3 (presence avatar) ·
✅ P4 (DS folder icon) · ✅ P5 (HUB SYNC 1 ↑) · ✅ P6 (`.st-toast`) · ✅ P7/P8 (grouped palette + filter) ·
✅ P9 (real PNG export round-trip) · ✅ P10 (handoff card) · ✅ P11/P12/P13/P14 (inspector Inspect/Layers/CSS + `I`) ·
✅ P15 (minimap already existed) · ⚠ P16 (zoom HUD functional; separate-float deprioritized) · ✅ P17 (annot ctx toolbar already existed) ·
🔨 P18 (comment-pin badge in bundle + CSS; visual verify pending a commented canvas) · ✅ P19 (kept both, DDR-097).
`maude design smoke` = **88/88 styled, import-graph clean**; release bundles rebuilt (client 271 KB / comment-mount 39 KB); `dist/runtime/*.js` untouched.
</content>
</invoke>
