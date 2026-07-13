# Feature: Unified Settings modal (vertical tabs + internal scroll)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Replace the single-column, unbounded `SettingsPanel` modal ("Settings — AI generation") with **one** Settings modal for **all** Maude preferences, laid out as a left **vertical tab rail** + a **scrollable content pane**. Each preference category is its own tab; the content pane has a fixed max-height with `overflow-y:auto` so no category can push the dialog off-screen (the current bug — the AI-generation section already overflows the viewport). View options that today live only in the **View menu** (minimap, zoom controls, auto-open Inspector…) also get a home here, so there is a single canonical place for everything.

## User Story

As a Maude user I want one Settings modal with clearly-grouped, scrollable tabs so that I can find and change any preference (keys, subtitles, appearance, canvas view options) in one place without the panel overflowing my screen.

## Problem

- `SettingsPanel.jsx` renders every section stacked in one `.st-dialog-bd` with **no scroll container and a fixed 540px top-anchored dialog** → with several provider cards + the whisper model list, the body **exceeds the viewport and gets clipped** ("tohle se nevleze do view"). Screenshot in the request shows this.
- The modal is **AI-generation-only**. Other preferences are scattered: theme is a sidebar toggle button; minimap / zoom-controls / annotations / auto-open-inspector are **View-menu** checkbox items; panel widths/visibility live in ad-hoc `localStorage` keys. There is no single "preferences" surface.
- No logical grouping — keys, subtitles, and models are one long scroll.

## Solution

Refactor `SettingsPanel.jsx` into a **tabbed shell** and widen it:

- **Left rail** (`role="tablist"`, vertical): one button per category. Lift the ARIA + roving-focus pattern from `GitPanel.jsx` (`gp-tabs`) / the inspector `st-cp-poptabs`, laid out vertically via CSS.
- **Right pane** (`role="tabpanel"`): fixed max-height (`min(72vh, …)`), `overflow-y:auto` — the scroll the request asks for. Only the active tab's content mounts/shows.
- **Tabs (logical grouping):**
  1. **Appearance** — theme (light / dark; keep the existing binary, `system` optional stretch). New tab; today theme is only the sidebar toggle. Both surfaces share the same `theme` state.
  2. **Canvas & View** — the persistent view-chrome + inspector prefs currently in the View menu: **Minimap**, **Zoom controls**, **Annotations default**, **Auto-open Inspector on select**. These are toggle rows; they read/write the **same state** as the View-menu items (single source of truth — no divergence). Presentation Mode stays View-menu-only (it's a transient mode, not a stored preference).
  3. **AI generation** — the existing `ProviderCard` list + intro (unchanged logic).
  4. **Subtitles** — the existing `TranscriptionEngineCard` + `WhisperModelCard` (unchanged logic).
- **Deep-link:** the modal accepts an optional `initialTab`. `⌘,` and a renamed **File → "Settings…"** entry open to `appearance` (or last-used); leave a path for "Settings — AI generation…" callers to open straight to `ai-generation` if we keep that affordance. Persist last-open tab in `localStorage` (`mdcc-settings-tab`).
- Rename the dialog title from "Settings — AI generation" to **"Settings"**; the active tab name is the subheading.

**Approach decision (stated, not asked — per the user's prose-first preference):** keep the View-menu toggles *in place* (fast access) and make the Settings "Canvas & View" tab a **second view onto the same state**, rather than moving the toggles out of the menu. This avoids a regression in muscle-memory access and keeps one state owner. The alternative (settings-modal-only, strip the menu) was rejected: it hides quick toggles behind a modal.

## Metadata

- **Type**: Enhancement (UI refactor)
- **Complexity**: Medium
- **App/Package**: `apps/studio` (studio client — served in both web browser and native desktop shell)
- **Affected Systems**: studio-client shell (`app.jsx`), `SettingsPanel.jsx`, client CSS, committed `dist/client.bundle.js` + `dist/styles.css`
- **Dependencies**: none new (zero-dep client; reuses existing tokens + `st-dialog` shell)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in one message.

- `apps/studio/client/panels/SettingsPanel.jsx` (whole file, 460 lines) — Why: the modal to refactor. Contains `ProviderCard`, `TranscriptionEngineCard`, `WhisperModelCard`, the `Icon` set, and the `st-scrim`/`st-dialog` shell + Esc handling. All sub-cards stay; only the outer shell becomes tabbed.
- `apps/studio/client/app.jsx` lines 44-95 — Why: `localStorage` store-key constants (`THEME_STORE`, `MINIMAP_STORE`, `ZOOMCTL_STORE`, …) + `readBoolStore` helper. New `SETTINGS_TAB_STORE` goes here.
- `apps/studio/client/app.jsx` lines 2859-2953 — Why: the View-menu `panels` array (minimap / zoomctl / annotations / auto-open-inspector items). The Settings "Canvas & View" tab mirrors these; confirm the exact toggle callbacks (`onToggleMinimap`, `onToggleZoomCtl`, `onToggleAnnotations`, `onToggleAutoOpenInspector`) and disabled conditions.
- `apps/studio/client/app.jsx` lines 2741-2757 — Why: File-menu items; rename "Settings — AI generation…" → "Settings…".
- `apps/studio/client/app.jsx` lines 7124-7145, 7426-7965 — Why: `theme` / `minimapVisible` / `zoomCtlVisible` / `annotationsVisible` / `autoOpenInspector` state + toggles + their `localStorage` persistence and `broadcastChrome`. The Settings tab must call these exact setters (do not fork state).
- `apps/studio/client/app.jsx` lines 10375-10380, 10575-10580, 11361 — Why: `⌘,` handler, command-palette "Settings" entry, and the `<SettingsPanel onClose=… />` render site. Add `initialTab` / view-pref props here.
- `apps/studio/client/panels/GitPanel.jsx` lines 464-490 — Why: **pattern prior** for `role="tablist"` / `role="tab"` markup + selection to lift (rendered vertically here).
- `apps/studio/client/styles/3-shell-maude.css` lines 442, 483-497, 1537 — Why: `.st-scrim` / `.st-dialog*` shell rules to extend (widen, add tab-rail + scroll-pane rules alongside).
- `apps/studio/client/styles/4-components.css` lines 1657-1700 — Why: `.st-provider-card` / `.st-settings-intro` / `.st-pill` rules the cards depend on; new tab CSS lives near here or in 3-shell-maude.css.

### Files to Create

- (none) — all changes are edits. New CSS classes (`.st-settings-tabs`, `.st-settings-rail`, `.st-settings-pane`, `.st-pref-row`) are added to an existing stylesheet.

### Patterns to Follow

- **Tablist ARIA + roving focus:** mirror `GitPanel.jsx` `gp-tabs` (`role="tablist"`, each button `role="tab"` + `aria-selected`, arrow-key roving). Lay the rail out vertically with CSS (`flex-direction:column`); keyboard is Up/Down instead of Left/Right for a vertical list.
- **Toggle rows:** the "Canvas & View" tab rows are labeled switches; reuse the `st-engine-radio`/`st-provider` label+note structure (label + one-line description) for consistent density.
- **State ownership:** every toggle in the modal calls the *existing* `app.jsx` setter (passed as a prop) — never a private copy. This is the single-source-of-truth rule that keeps the View menu and the modal in sync (mirror how `minimapVisible` + `onToggleMinimap` already thread down to `Menubar`).
- **Tokens only:** no hardcoded colors; theme tokens (`--fg-*`, `--bg-*`, `--accent`, `--border-*`, `--space-*`, `--radius-*`) as the current panel already does.

---

## Design Decisions

### Components (reused)

| Component | Source | Notes |
| --- | --- | --- |
| `ProviderCard` | `SettingsPanel.jsx` | Unchanged; rendered inside the "AI generation" tab. |
| `TranscriptionEngineCard`, `WhisperModelCard` | `SettingsPanel.jsx` | Unchanged; rendered inside the "Subtitles" tab. |
| `st-dialog` / `st-scrim` shell | `3-shell-maude.css` | Extended: wider dialog + tab layout; keep pop animation + scrim-click/Esc close. |
| Tablist markup | `GitPanel.jsx` `gp-tabs` | Lifted for the vertical rail. |

### Tokens

| Purpose | Token |
| --- | --- |
| Dialog surface / rail bg | `--bg-1` / `--bg-0` |
| Active tab accent | `--accent` / `--accent-fg` |
| Row borders | `--border-subtle` / `--border-default` |
| Body / label / note text | `--fg-0` / `--fg-2` / `--u-fg-3` |

### Custom Components Needed

| Component | Reason |
| --- | --- |
| Vertical tab rail + tabbed shell inside `SettingsPanel` | No existing vertical-tab modal in the client; assembled from the tablist pattern + `st-dialog` shell. |
| `PrefToggleRow` (small local component) | Consistent labeled-switch row for the "Appearance" + "Canvas & View" tabs. |

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: ADD Settings CSS (tab rail + scroll pane)

- **Do**: In `3-shell-maude.css`, add a `.st-dialog.is-settings` variant (widen to ~720px, `max-width:92vw`) and: `.st-settings-tabs` (grid: rail + pane), `.st-settings-rail` (vertical `role=tablist`, sticky), `.st-settings-tab` (button; `[aria-selected=true]` accent), `.st-settings-pane` (`max-height:min(72vh, 640px)`, `overflow-y:auto`, `padding`), `.st-pref-row` (labeled switch row). Reduced-motion respected (no new animation beyond the existing `st-pop`).
- **Pattern**: token-only values; mirror `.st-provider-card` spacing.
- **Gotcha**: `.st-scrim` uses `place-items:start center; padding-top:12vh` — the taller settings dialog must not exceed viewport; the **pane** scrolls, not the page. Verify at a short (768px) viewport.
- **Validate**: visual — build + open modal (Task 6).

### Task 2: REFACTOR `SettingsPanel.jsx` into a tabbed shell

- **Do**: Add a `TABS` array (`appearance`, `canvas-view`, `ai-generation`, `subtitles`) each `{ id, label }`. Add `activeTab` state seeded from `initialTab` prop → else `localStorage` (`mdcc-settings-tab`) → else `appearance`; persist on change. Render the vertical rail + a pane that shows the active tab's content. Move the existing provider block into the `ai-generation` panel and the transcription/whisper blocks into `subtitles`. Keep the `st-scrim` mousedown-close + Esc handler. Title → "Settings"; add the active-tab label as a subheading.
- **Pattern**: `GitPanel.jsx` tablist; arrow-key roving adapted to Up/Down.
- **Gotcha**: keep each card's `fetch` on mount — but only the AI/Subtitles tabs need the provider/prefs fetches; either keep the existing top-level `useEffect` loads (cheap) or lazily load when the tab first opens. Simplest: keep top-level loads; do NOT unmount cards on tab switch if that would refetch/lose in-flight download polling — use CSS `hidden`/conditional render carefully (WhisperModelCard polls a download; unmounting mid-download drops the poll). **Prefer keep-mounted + `hidden` for the Subtitles tab** to preserve the download poll.
- **Validate**: `node -e "require('esbuild')..."` not available — rely on the client build in Task 6.

### Task 3: ADD "Appearance" + "Canvas & View" tab content

- **Do**: Build a small `PrefToggleRow({label, note, checked, disabled, onChange})`. **Appearance**: theme control (light/dark; wire to the `theme` + `onToggleTheme`/`setTheme` props from `app.jsx`). **Canvas & View**: rows for Minimap, Zoom controls, Annotations, Auto-open Inspector on select — each wired to the passed-in setter. Disable minimap/zoomctl rows when no canvas is open / on the system tab (mirror the View-menu `disabled: !activePath || isSystem` condition) and show the reason inline.
- **Pattern**: reuse `st-engine-radio` label+note density.
- **Gotcha**: these MUST use `app.jsx`'s existing state/setters (Task 4 threads them as props). No private toggle state, or the modal and View menu will drift.
- **Validate**: toggling minimap in the modal moves the View-menu checkmark and shows/hides the canvas minimap (Task 6).

### Task 4: WIRE props from `app.jsx` into `SettingsPanel`

- **Do**: At the render site (line ~11361), pass `initialTab` (default from `⌘,`/menu), plus `theme`, `onToggleTheme`/`setTheme`, `minimapVisible`+`onToggleMinimap`, `zoomCtlVisible`+`onToggleZoomCtl`, `annotationsVisible`+`onToggleAnnotations`, `autoOpenInspector`+`onToggleAutoOpenInspector`, and `hasCanvas`/`isSystem` (for disabled state). Add `SETTINGS_TAB_STORE = 'mdcc-settings-tab'` near the other store constants.
- **Pattern**: these props already thread down to `Menubar`; reuse the same variables.
- **Gotcha**: `⌘,` handler + command-palette entry + File-menu item all call `setSettingsOpen(true)` — optionally set a `settingsTab` state so "Settings — AI generation…" can deep-link to `ai-generation`. If keeping it simple, one "Settings…" entry opening to last-used tab is acceptable.
- **Validate**: modal opens from ⌘,, File menu, and command palette.

### Task 5: RENAME the File-menu entry + command-palette label

- **Do**: `apps/studio/client/app.jsx` line 2752 and ~10575: "Settings — AI generation…" → "Settings…". Keep the `⌘,` shortcut hint.
- **Gotcha**: grep for any other "Settings — AI generation" string (tour, whats-new, tests) and update or leave doc-strings intact as history.
- **Validate**: labels read "Settings…".

### Task 6: REBUILD the committed client bundle (release-minified)

- **Do**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release`, then stage `apps/studio/dist/client.bundle.js` + `apps/studio/dist/styles.css`.
- **Pattern**: CLAUDE.md "In-app What's New feed" + client-surface rebuild rule — whatever is committed is what ships; never leave an unminified dev bundle.
- **Gotcha**: do NOT boot the source dev-server without rebuilding `--release` after (its self-heal writes a 3.6 MB dev bundle). `MAUDE_SKIP_RUNTIME_BUILD=1` reuses the committed `dist/runtime/*.js`.
- **Validate**: `git diff --stat` shows the two dist files; bundle size in the ~250 KB range, not 3.6 MB.

---

## Validation

There is **no test suite / lint / typecheck** in this repo (CLAUDE.md). Validate by building + driving the UI.

1. **Build**: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` — exits 0, emits minified `dist/client.bundle.js` + `dist/styles.css`.
2. **Boot + drive** (agent-browser): start the dev server against a scratch `.design/` project, open the browser, open Settings (⌘,). Verify:
   - Vertical tab rail with 4 tabs; clicking each swaps the pane.
   - A long tab (AI generation with several provider cards, or Subtitles with the whisper model list) **scrolls inside the pane** and the dialog stays within the viewport (repro of the original bug — capture a before/after screenshot at ~768px height).
   - "Canvas & View" toggles move in lock-step with the View-menu checkmarks (toggle in modal → menu reflects it, and vice-versa) and actually show/hide the minimap / zoom controls on the canvas.
   - Theme control in "Appearance" flips the app theme (and matches the sidebar toggle).
   - Esc + scrim-click + Close button all dismiss.
3. **Keyboard**: Up/Down roves the tab rail; Tab reaches pane controls; focus-visible rings present.
4. **Native parity (optional)**: the same bundle serves the desktop shell — a `desktop-e2e` scenario can open Settings via ⌘, and assert the tablist (`data-testid="settings-tabs"`) if a testid is added. Not required for merge.

---

## Acceptance Criteria

- [ ] One Settings modal with a **vertical tab rail** + **internally-scrolling** content pane; no category can push the dialog off-screen.
- [ ] Tabs: Appearance · Canvas & View · AI generation · Subtitles, logically grouped.
- [ ] View options (minimap, zoom controls, annotations, auto-open inspector) are settable in the modal **and stay in sync** with the View menu (single state owner).
- [ ] Existing AI-generation keys + Subtitles behavior unchanged (provider save/remove, transcription radio, whisper download-poll survives tab switches).
- [ ] File-menu / command-palette / ⌘, all open the unified modal; label reads "Settings…".
- [ ] `dist/client.bundle.js` + `dist/styles.css` rebuilt release-minified and committed.
- [ ] a11y: tablist ARIA, roving focus, focus-visible, tokens-only (no hardcoded colors), reduced-motion respected.
- [ ] Verified live via agent-browser with before/after screenshots at a short viewport.
- [ ] No DDR-worthy decision left unrecorded (a UI-consolidation this size likely doesn't need a DDR; note it in the retro if a state-ownership rule emerges).

---

## Retro (2026-07-13)

**Shipped (commit `816560b9`):** unified Settings modal (vertical tabs + internal scroll) **plus** two mid-flight extensions the user requested while iterating — configurable panel docking (Model B: left/right tabbed slots, per-panel side in a new Layout tab, Layers split into its own panel) and a disk-backed UI-prefs store. Also fixed a real bug (minimap/zoom rendering while toggled OFF — `use-chrome-visibility` provider default mismatched the shell's OFF default and the seed raced `dgn:'loaded'`).

**What worked**
- Live agent-browser verification at every step (modal scroll math, both dock slots tab-switching, panel moves persisting to disk, theme re-theming the whole shell) caught nothing broken and gave real confidence on an 11k-line shell refactor with no unit tests.
- Keeping the individual panel open-booleans and layering a side-aware `togglePanel`/`openPanelExclusive` over them (instead of rewriting 54 setter call-sites) kept the docking blast radius contained.
- Extending the existing `keys.json` XDG pattern for `ui-prefs.ts` made disk persistence a small, low-risk addition; `writeUiPrefs` deep-merges `panelSides` so partial patches don't reset siblings.

**What didn't / what to change**
- **Concurrent editing of `app.jsx` on shared `main` was the real hazard.** Another session added an artboard-hug feature to the same working tree and committed it (`865310d4`) mid-refactor — sweeping in a *partial* snapshot of this docking work and the `/_api/ui-prefs` route WITHOUT the new `ui-prefs.ts` module, leaving HEAD non-building. This close-out repaired it. Lesson: for a large in-place refactor of a hot shared file, work in an isolated worktree (memory `feedback_work_in_worktree_not_main`) — do not race another agent on `main`.
- Docking grew well past the original plan scope (settings modal only). It deserves its own plan + DDR next time rather than riding a settings-consolidation plan.

**Deferred / follow-ups**
- **DDRs to record** (skipped now to avoid a numbering race with the concurrent session — memory `project_ddr_numbering_races_on_shared_main`): (1) disk-backed UI-prefs store at `~/.config/maude/prefs.json`; (2) configurable panel docking model (Model B — two tabbed single-slot docks, side-aware exclusion).
- View-menu "Layers" checkmark still keyed to `inspectorOpen && tab==='layers'`; doesn't reflect the standalone Layers panel in `separate` mode (cosmetic).
- Full `/flow:validate` (cross-platform scenario, a11y-auditor, design-system-guard) deferred — this was a `--quick` close. Run before merge.
- Native ACP `assistant` docking verified only by code path (native-only; not browser-testable). Confirm in a desktop build.
