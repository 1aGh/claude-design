# Client tree restructure — sidecar nesting, DS-primary section, hidden-files toggle

> **Position.** Standalone UX polish on the dev-server client sidebar. No phase number — it's a focused refactor of `plugins/design/dev-server/client/app.jsx` + companion `api.ts` / `styles.css`. Touches none of the canvas pipeline, build system, or persistence-of-state files outside the sidebar. Lifted patterns from VS Code's file-nesting feature ([Visual Studio Code docs](https://learn.microsoft.com/en-us/visualstudio/ide/file-nesting-solution-explorer?view=vs-2022)) — proven affordance, no invention.
>
> **Why a plan (not `/flow:quick`).** Three files, one new client-side primitive (`CanvasRow` with sidecar disclosure), new persisted UI state keys, and a server-side `stripPrefix` semantics shift that affects every tree consumer. Manual smoke against the dev-server is required end-to-end. Quick-path skips don't fit.

## Description

Restructure the dev-server sidebar (the FILES panel at `app.jsx:273–365`) so it stops drowning daily work in non-canvas noise:

- **Sidecars nest under their canvas.** `Foo.tsx` is the parent row; `Foo.meta.json`, `Foo.css`, `Foo.registry.json` collapse under a disclosure chevron (VS Code-style). Sidecars stay reachable for context but don't dominate the list.
- **Design System section becomes a primary action, not a folder header.** Click the section header → opens the SystemView (token gallery + previews). A separate chevron expands the section body for per-file browsing. The body is collapsed by default — encourages the system view as the canonical DS entry point.
- **`.tsx` extensions are stripped visually.** `Canvas Viewport.tsx` renders as `Canvas Viewport`. `.html` extensions also stripped (legacy canvases). Sidecar extensions stay intact so the file type is obvious.
- **Section roots are flattened.** Today the tree shows `▾ system → ▾ project → ▾ preview` under DESIGN SYSTEM, and `▾ ui` under UI CANVASES — the section header already names the folder, so the chain is redundant. Server-side `stripPrefix` extends to the DS path (`system/<dsName>/`) or group path (`ui/`), eliminating the leading chain. Same applies to PROJECT and RUNTIME — `.design/` parent strip.
- **Runtime + project orphans hidden by default.** A new `View › Show hidden files` toggle (shortcut `H`) reveals `_active.json`, `_server.log`, top-level `README.md`/`INDEX.md`/`config.json`, and any DS-level non-canvas file (`SKILL.md`, `colors_and_type.css`). Off by default; persisted across reloads.

**Out of scope:**

- Drag-drop reorder, file rename/delete, multi-select — sidebar stays read-only.
- Multi-DS support beyond the current single-DS case. If `cfg.designSystems` has two entries under the `system/` group, the new `stripPrefix` falls back to `g.path` (one level less aggressive) so nothing regresses, but proper multi-DS sectioning is its own task.
- Replacement of CV-08 visual tokens — chevron styling reuses the existing `.glyph` and pill conventions.
- Phase-12 disabled View entries (`layers`, `inspector`, `annotate`, `present`) — unchanged.

## User Story

As Claude opening the dev-server on `md-claude` to iterate on `Canvas Viewport`, I want to see a clean list of three canvases under UI CANVASES (not nine rows of `.tsx` + `.css` + `.meta.json` triplets), and I want clicking DESIGN SYSTEM to open the system view immediately — without first staring at `system → project → preview` breadcrumbs that say nothing the section header didn't already announce.

## Problem

| Symptom | Current cause | Impact |
| --- | --- | --- |
| `.tsx` canvas list is buried under `.meta.json` + `.css` + `.registry.json` siblings | `buildTree` (`app.jsx:81–99`) emits every file as a sibling row. `FileRow` marks non-canvas files `inert` (`app.jsx:199`) — they're display-only — but they still take vertical space and visual weight. | A 3-canvas `ui/` folder renders as 9–11 rows. Eye-scanning past dead rows on every glance. |
| `▾ system → ▾ project → ▾ preview` chain under DESIGN SYSTEM | `stripPrefix` for canvas groups is `.design/` only (`api.ts:318`). `buildTree` doesn't collapse single-child chains. The section header already encodes "DESIGN SYSTEM · MDCC-DSN/01", so `system/project` is redundant. | Three nested disclosure rows before the user reaches actual content. |
| `.tsx` extension on every row | `FileRow` renders `file.name` verbatim (`app.jsx:213`). All canvases are `.tsx` (and a handful of legacy `.html`), so the extension carries no information. | Visual noise; row width inflated. |
| DESIGN SYSTEM section header is a button but its job is unclear | Header click opens SystemView (`app.jsx:330–339`), but the body below shows `system/project/...` as if the section were just a folder. Two competing UI affordances on the same row. | User doesn't know if clicking the header browses files or opens the view. |
| `RUNTIME · GITIGNORED` is always visible | Server unconditionally emits the runtime group (`api.ts:336–344`). Files inside (`_active.json`, `_server.log`, …) are gitignored and irrelevant to daily flow. | Last section of the sidebar is permanently dead weight. |
| Top-level PROJECT files (`.design/README.md`, `INDEX.md`, `config.json`) shown but unclickable | They're emitted via `findFiles` with extension filter for `md|json|txt|yml|yaml|css` (`api.ts:283`) and marked inert. | They occupy 3 rows for no daily benefit. |
| No persisted UI state for sidebar except theme | Only `THEME_STORE` (`app.jsx:10`) reads/writes localStorage. `sidebarOpen`, DS-body-expanded, future hidden-toggle all reset on reload. | UI feels forgetful — toggling sidebar off → reload → sidebar back. |

## Solution

Five-piece refactor. **A** changes server contract, **B–E** are client-side and parallel after A lands.

**A. Server: tighten `stripPrefix` to the DS / group path.** Edit `buildIndexData()` in `plugins/design/dev-server/api.ts`. Today, `stripPrefix` strips `.design/` only — leaving the immediate folder (`system/project/`, `ui/`) in every tree row. Compute an `effectiveRoot` per group:

- **PROJECT group** (`api.ts:287–297`): `stripPrefix = \`${paths.designRel}/\`` (was `''`). Section title "PROJECT" carries the parent.
- **Canvas group with label `'Design system'`**: look up the matching entry in `cfg.designSystems` whose `path` starts with `g.path`. If exactly one match → `effectiveRoot = ds.path` (e.g. `system/project`). If zero or multiple → `effectiveRoot = g.path` (fallback, current behavior). Emit `dsName?: string` + `dsTokensPath?: string` on the group response so the client can specialcase the section header for the DS.
- **Other canvas groups** (e.g. `ui`): `effectiveRoot = g.path`. `stripPrefix = \`${paths.designRel}/${effectiveRoot}/\``.
- **RUNTIME group** (`api.ts:326–344`): `stripPrefix = \`${paths.designRel}/\`` (was `''`). Matches PROJECT.

No new endpoints. The change is one local computation per group. Schema stays additive (new optional fields).

**B. Client: VS Code-style sidecar grouping.** Introduce `groupBySidecar(files)` near `buildTree` (`app.jsx:81–119`). Returns `Array<{ primary, sidecars }>`:

- Primary = file matching `/\.(tsx|html?)$/i`.
- Sidecars = same `basenameNoExt` as a primary, where the file does not itself match the canvas regex.
- Orphans (no canvas peer at this directory level) returned as `{ primary: orphan, sidecars: [] }` so the caller can gate them on the `showHidden` flag.

New `CanvasRow` component replaces the canvas path through `FileRow`: renders the canvas as an outer `<button>` with `aria-expanded`, leading chevron (`▸`/`▾`) when sidecars exist, and a nested `<div>` with the sidecar children at `depth + 1`. Sidecars rendered with `.tp-row.sidecar` (muted) — clicking is no-op (inherits the existing inert path from `FileRow`).

`Tree` component (`app.jsx:219–250`) walks each dir's `_files` via `groupBySidecar`, renders `CanvasRow` for primaries and (if `showHidden`) `FileRow` for orphans.

**C. Client: DS section header — split into open-system + expand-body.** In `Sidebar` (`app.jsx:273–365`), the existing single-button section header for DS becomes a two-region row:

- Main left region (text + pill) → existing `onOpenSystem()` action.
- Right-side chevron `▸`/`▾` → toggles `dsBodyExpanded` (new `useState` in `App`, persisted to localStorage under `MDCC_DS_EXPANDED`). Default `false`.
- When `dsBodyExpanded === false`, the section's `<Tree>` body is not rendered. Header alone is visible.

DS-level docs (`README.md`, `SKILL.md`, `colors_and_type.css`) — these are siblings of `preview/` and they ARE the DS spec. **Decision:** keep them visible inside the expanded DS body even when `showHidden` is off. The DS section is opt-in (body collapsed by default), so revealing its docs on expand is contextually relevant. Orphan `.md` / `.css` / `.json` outside the DS section stay gated on `showHidden`.

**D. Client: View menu — `Show hidden files` + persistence.** Edit `Menubar` panels array (`app.jsx:553–561`):

- New entry between `system` and the Phase-12 disabled ones:
  ```jsx
  { id: 'hidden', label: 'Show hidden files', shortcut: 'H', checked: showHidden, disabled: false }
  ```
- `onToggle` (`app.jsx:603–609`): new `case 'hidden'` → `setShowHidden(v => !v)`.
- Keyboard shortcut `H` (top-level handler near `app.jsx:1395–1425`): toggle when no input is focused, mirror existing `T` / `S` patterns.

State + persistence (top of file near `THEME_STORE`, `app.jsx:10`):
```js
const SHOW_HIDDEN_STORE = 'mdcc-show-hidden';
const DS_EXPANDED_STORE = 'mdcc-ds-expanded';
const SIDEBAR_STORE = 'mdcc-sidebar-open';
```
Initial `useState` reads from localStorage (mirror lines 16–22). `useEffect` writes on change (mirror lines 1088–1091).

When `showHidden === false`:
- `Tree` skips orphans returned by `groupBySidecar`.
- `Sidebar` filters out the entire RUNTIME group at render time (skip the section header + body).
- `Sidebar` filters out PROJECT orphans; if PROJECT body becomes empty, skip the section header too (no point showing "PROJECT" with nothing under it).

**E. Client: strip extensions in row labels.** Helper near `displayName(name)` in the new constants block:
```js
function displayName(name) { return name.replace(/\.(tsx|html?)$/i, ''); }
```
`FileRow` (`app.jsx:200–217`) renders `displayName(file.name)`. `CanvasRow` does the same for its primary. Sidecars keep full filenames (so `Foo.meta.json` is unambiguous). Same stripping applied in `Menubar` status row (`app.jsx:551`, the `basename(activePath)` rendering) — `basename(activePath).replace(...)`. And in tab labels (search `app.jsx` for `basename(` usage in the tab strip — apply the same transform).

`styles.css` additions stay minimal:
- `.tp-row.sidecar` — muted foreground (`opacity: 0.55`), no leading glyph, smaller font-size or no change (reuse existing `.muted` if shape allows).
- `.tp-section-hd.clickable` gets a flex right-side chevron child — wrap header content in two `<button>` children if a single `<button>` can't host both click targets cleanly (semantic preference: header becomes a `<div role="heading">` with two child buttons).
- No new color tokens; reuse `--u-fg-3` for the muted state.

## Metadata

- **GitHub Issue**: (none — internal UX polish)
- **Type**: Refactor (UI surface; user-visible behavior change)
- **Complexity**: Medium
- **App/Package**: `plugins/design/dev-server` (server `api.ts` + client `app.jsx` + `styles.css`)
- **Affected Systems**: tree rendering, View menu, sidebar persistence, keyboard shortcuts. Does not touch canvas pipeline, HMR, comments, or handoff.
- **Dependencies**: none new. React 19 already loaded.

---

## Context References

### Must-Read Files

- `plugins/design/dev-server/client/app.jsx` (lines 81–365) — current tree implementation: `buildTree`, `filterTree`, `FileRow`, `DirRow`, `Tree`, `SECTION_META`, `sectionMetaFor`, `Sidebar`. The entire restructure happens in this range plus the `Menubar`/`App` state at lines 546–611 and 1077–1091.
- `plugins/design/dev-server/api.ts` (lines 269–352) — `buildIndexData()` group emission. The `stripPrefix` and DS-detection logic lives here.
- `plugins/design/dev-server/client/styles.css` — existing `.tp-row`, `.tp-section-hd`, `.glyph`, `.pill`, `.muted` selectors. New styles append; nothing overwritten.
- `.design/config.json` — source of `cfg.designSystems` array. Single DS today (`system/project`). The `effectiveRoot` lookup depends on this shape.
- `CLAUDE.md` — "Dev-server runtime contract" section: `_active.json` / `_server.json` schemas. Not modified, just confirming runtime files stay where they are (only their visibility flips).

### Files to Create

None. Pure refactor of three existing files.

### Documentation

- [VS Code file nesting](https://learn.microsoft.com/en-us/visualstudio/ide/file-nesting-solution-explorer?view=vs-2022) — Why: reference pattern for sidecar disclosure UX. Names + chevron + always-grouped, never flat-when-toggle. We're not replicating their pattern config syntax — just the visual + interaction affordance.
- [antfu/vscode-file-nesting-config](https://github.com/antfu/vscode-file-nesting-config) — Why: canonical examples of which sidecar globs nest under which primary. Our pattern is simpler (same basename, different extension), but useful as sanity check.

### Patterns to Follow

**Persisted UI state** — mirror `THEME_STORE` (`app.jsx:10–22`):
```js
const SHOW_HIDDEN_STORE = 'mdcc-show-hidden';
const [showHidden, setShowHidden] = useState(() => {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(SHOW_HIDDEN_STORE) === '1'; } catch { return false; }
});
useEffect(() => {
  try { localStorage.setItem(SHOW_HIDDEN_STORE, showHidden ? '1' : '0'); } catch {}
}, [showHidden]);
```

**View dropdown panel entry** — add to existing `panels` array (`app.jsx:553–561`):
```js
{ id: 'hidden', label: 'Show hidden files', shortcut: 'H', checked: showHidden, disabled: false },
```
And in `onToggle` (line 603–607):
```js
else if (id === 'hidden') onToggleShowHidden();
```

**Keyboard shortcut** — mirror the `T` toggle near `app.jsx:1415–1422`:
```js
if (e.key.toLowerCase() === 'h' && !modifierActive(e) && !isTypingTarget(e.target)) {
  e.preventDefault();
  setShowHidden(v => !v);
}
```

**Disclosure row** — mirror `DirRow` (`app.jsx:172–191`):
- `<button>` with `aria-expanded={open}`, leading glyph `▾`/`▸`, click toggles. Children rendered as siblings when `open`.

**Inert non-canvas row** — current `FileRow` inert branch (`app.jsx:199–211`): `aria-disabled='true'`, click no-op, title="(file index only)". Sidecars inherit this.

---

## Design Decisions

> Source-of-truth design system for the dev-server client: the **CV-08 mock** spec referenced in `app.jsx:162–167` + the existing `client/styles.css` token set + the `mdcc` light/dark theme pair. No external DS bootstrap needed — we are editing the tooling UI, not introducing a new surface.

### Components (from registry)

| Component | Source | Notes |
| --- | --- | --- |
| `DirRow` | `app.jsx:172–191` | Reused for any expandable folder row in non-DS sections. Default `open=true` stays. |
| `FileRow` (inert branch) | `app.jsx:193–217` | Reused for sidecar rows + orphan rows. `kind === 'runtime'` styling carries to sidecars via new `.tp-row.sidecar` class. |
| `ViewDropdown` | `app.jsx:540–544` (function declared elsewhere — referenced from `Menubar`) | Reused; new panel entry slots in. |
| `useLocalStorage`-style read/write | `app.jsx:18, 1088–1091` (theme pattern) | Pattern copied verbatim for three new keys. |

### Custom Components Needed

| Component | Reason | Extends |
| --- | --- | --- |
| `CanvasRow` | Canvas row with optional collapsible sidecars. `FileRow` doesn't have disclosure semantics; `DirRow` doesn't have an active/selected/clickable file. Combination needed. | Composed from `FileRow` markup (icon, name, badge) + `DirRow` disclosure pattern. |

### Icons / Glyphs

| Glyph | Source | Size | Usage |
| --- | --- | --- | --- |
| `▾` / `▸` (text) | CV-08 spec — `.glyph` class | inherits row font-size | DirRow + new CanvasRow disclosure |
| `▦` | existing DS section header | inherits | DS section "open system view" affordance (unchanged) |

### Tokens

| Purpose | Token | Class |
| --- | --- | --- |
| Sidecar foreground | `--u-fg-3` (existing) | `.tp-row.sidecar` |
| Section header chevron | `--u-fg-2` | `.tp-section-hd .chev` |

No new tokens added.

---

## Tasks

Execute in order. Each task is atomic and verifiable. After each task, run the `Validate` command and reload the dev-server iframe to manually confirm.

### Task 1: UPDATE `api.ts` — compute `effectiveRoot` per group

- **Do**:
  - In `buildIndexData()`, replace `stripPrefix: ''` for PROJECT (line 294) with `stripPrefix: \`${paths.designRel}/\``.
  - Replace `stripPrefix: ''` for RUNTIME (line 341) likewise.
  - In the canvas-groups loop (lines 307–321), compute `effectiveRoot`:
    ```ts
    const matchedDs = g.label === 'Design system'
      ? cfg.designSystems.filter(d => d.path.startsWith(g.path + '/') || d.path === g.path)
      : [];
    const effectiveRoot = matchedDs.length === 1 ? matchedDs[0].path : g.path;
    ```
  - Use `effectiveRoot` in the `stripPrefix` template: `stripPrefix: \`${paths.designRel}/${effectiveRoot}/\``.
  - Emit `dsName: matchedDs[0]?.name ?? undefined` on the group object so the client can identify a DS-rooted group cleanly (today it relies on `g.label === 'Design system'`, which still works as fallback).
- **Pattern**: matches the existing `isDs` regex logic on `api.ts:310`; we keep that flag for the `findFiles` ext list but extend the same idea to `stripPrefix`.
- **Gotcha**: `cfg.designSystems` may be missing in legacy configs. Guard with `(cfg.designSystems ?? [])`.
- **Validate**: `bun run plugins/design/dev-server/server.ts` boots without error; `curl localhost:4399/_tree | jq '.groups[].stripPrefix'` shows the new prefixes; visual check in browser shows no path duplication.

### Task 2: UPDATE `app.jsx` — add persisted-state helpers + new constants

- **Do**:
  - Below `THEME_STORE` constant declaration (line 10), add `SHOW_HIDDEN_STORE`, `DS_EXPANDED_STORE`, `SIDEBAR_STORE`.
  - Add `displayName(name)` and `basenameNoExt(name)` helpers near `buildTree` (line ~80).
  - In `App` (line ~1040), declare three new pieces of state, each initialized from localStorage and synced via `useEffect` (mirror theme pattern at lines 1086–1091):
    - `showHidden` (default `false`) + `setShowHidden`
    - `dsBodyExpanded` (default `false`) + `setDsBodyExpanded`
    - Move existing `sidebarOpen` initialization (line 1081) to read from `SIDEBAR_STORE`.
- **Pattern**: theme persistence at `app.jsx:18, 1086–1091`.
- **Gotcha**: SSR guard — `typeof window === 'undefined'` short-circuit. Mirror existing theme behavior.
- **Validate**: open the page, toggle theme (still works), toggle sidebar via `T` shortcut, reload — sidebar state survives. Set `mdcc-show-hidden` to `1` in DevTools localStorage, reload — `showHidden` state should be `true` (no visible effect yet; behavior wired in later tasks).

### Task 3: UPDATE `app.jsx` — `groupBySidecar` + `CanvasRow` + `Tree`

- **Do**:
  - Add `groupBySidecar(files)` near `buildTree`. Algorithm:
    - Build `byBase = Map<basenameNoExt, { primary?: file, sidecars: file[] }>`.
    - First pass: for each file matching `CANVAS_EXT`, set `byBase.get(base).primary = f`.
    - Second pass: for each non-canvas file, append to `byBase.get(base).sidecars`. If no primary at this base → orphan; emit as separate `{ primary: f, sidecars: [], orphan: true }`.
    - Sort: canvases first (by primary.name), then orphans (by name).
  - Add `CanvasRow({ primary, sidecars, depth, kind, activePath, onOpen, openCount, showHidden })`:
    - If `sidecars.length === 0 || !showHidden`: render bare `FileRow` (no chevron). [Aside: even when `showHidden` is on, sidecars stay nested under their canvas — they're never flat siblings. So the chevron always appears when `sidecars.length > 0 && showHidden`.]
    - If `sidecars.length > 0 && showHidden`: render outer button with `aria-expanded`, leading chevron `▸`/`▾` + canvas name (`displayName`), then children at `depth + 1` rendered as `<FileRow inert>` with `.sidecar` class.
    - Local `useState(false)` for the open flag.
  - Modify `Tree` (lines 219–250) to:
    - Replace the `[...node._files].sort(...).map(FileRow)` loop with a call to `groupBySidecar(node._files)`.
    - Render `CanvasRow` for non-orphan entries.
    - Render `FileRow` for orphans only when `showHidden` is true; otherwise skip.
  - Update `FileRow` (line 213) to render `displayName(file.name)` instead of raw `file.name`. Title attribute still shows full `file.path`.
- **Pattern**: `DirRow` for disclosure; existing `FileRow` for the inner sidecar rows.
- **Gotcha**: filter (`filterTree`) operates on raw `node._files` before grouping. When a sidecar matches the filter, the canvas parent must auto-expand. Solution: in `CanvasRow`, when `filter` prop is non-empty AND any sidecar matches → force `open = true` (override local state). Plumb `search` through to `Tree` → `CanvasRow`.
- **Validate**: open `/`, see `Canvas Viewport` (single row) with disclosure chevron when `showHidden=true`. Click chevron → reveals `Canvas Viewport.css` + `Canvas Viewport.meta.json` rows below. Click main row → opens canvas in iframe. Type `meta` in search → all canvas rows with `.meta.json` peers auto-expand.

### Task 4: UPDATE `app.jsx` — DS section split header

- **Do**:
  - In `Sidebar`'s DS-branch (`app.jsx:330–339`), restructure the header:
    - Outer container: `<div className='tp-section-hd clickable' role='group'>` (no longer a single `<button>`).
    - Left child: `<button>` with section title + pill + `▦` glyph → `onClick={onOpenSystem}`; styled to look identical to today's full-row click target.
    - Right child: `<button className='chev'>` with `▸`/`▾` glyph → `onClick={() => setDsBodyExpanded(v => !v)}`; `aria-expanded` reflects state.
  - Wrap the existing `<Tree>` body (lines 346–354) in `{dsBodyExpanded && (...)}`.
  - Add CSS in `styles.css`:
    ```css
    .tp-section-hd.clickable { display: flex; align-items: center; }
    .tp-section-hd .chev { margin-left: auto; padding: 0 8px; opacity: .7; }
    .tp-section-hd .chev:hover { opacity: 1; }
    ```
- **Pattern**: existing `DirRow` chevron glyph + button affordance.
- **Gotcha**: accessibility — two nested buttons in the same row need clear labels. Add `aria-label="Open design system view"` on the left button and `aria-label="Expand design system contents"` on the chevron. Tabindex stays default (both focusable).
- **Validate**: `T` toggle still works. DS section header renders with chevron on the right. Click title → SystemView opens (same as before). Click chevron → body expands; click again → collapses. Reload → state persists.

### Task 5: UPDATE `app.jsx` — `View › Show hidden files` + `H` shortcut + RUNTIME/PROJECT gating

- **Do**:
  - Add `panels` entry as per Patterns block above. Pipe `showHidden` + `onToggleShowHidden` from `App` → `Menubar`.
  - Extend `onToggle` to handle `case 'hidden'`.
  - Add `H` shortcut in the keyboard handler block (`app.jsx:1395–1425`). Make sure it doesn't fire when typing in the filter input — check via `e.target.tagName === 'INPUT'` (existing pattern).
  - In `Sidebar`, in the `filteredGroups.map` loop (line 320): when `!showHidden && g.kind === 'runtime'` → skip the entire group (don't render header or body).
  - Inside `Tree` (or `groupBySidecar` consumer), orphans are already gated on `showHidden` from Task 3. Confirm: with `showHidden=false` and a PROJECT group containing only `.md`/`.json` (no `.tsx`/`.html`), the group's `_files` after grouping yields all orphans → all filtered out → empty body. In that case the `Sidebar` should also skip the section header (no point showing "PROJECT" with nothing). Add an `isEmpty` precheck: count visible rows after the showHidden filter; if zero → skip section.
- **Pattern**: keyboard-shortcut block already gates on `isTypingTarget` (search for the helper near line 1395).
- **Gotcha**: counter pill on UI CANVASES uses `g.paths?.length`. If we hide sidecars we don't want to hide canvases — counter should still reflect `.tsx`/`.html` count only. Today's `pillFromCount: true` path uses raw `paths.length` which already over-counts (includes sidecars in DS section). Tighten: compute `canvasCount = g.paths.filter(p => /\.(tsx|html?)$/i.test(p)).length` and use that for the pill. Aligns with the FILES header pill which already filters this way (`app.jsx:282–286`).
- **Validate**:
  - Default state: PROJECT section invisible (only orphans inside, all hidden), DESIGN SYSTEM visible (header + chevron, body collapsed), UI CANVASES shows 3 clean canvas names, RUNTIME invisible.
  - Press `H` → PROJECT section appears with `README.md`/`INDEX.md`/`config.json`; RUNTIME section appears at the bottom; canvas rows in UI CANVASES gain chevrons revealing their sidecars.
  - Press `H` again → reverts to default. Reload → state persists.
  - Open the View dropdown → "Show hidden files" entry has the `[H]` shortcut and reflects the current state.

### Task 6: UPDATE `app.jsx` — strip extensions in status row + tab labels

- **Do**:
  - In `Menubar` status row (`app.jsx:551`), apply `displayName(basename(activePath))` instead of `basename(activePath)`. The `<b>` wrapping stays.
  - Grep `app.jsx` for any other `basename(activePath)` or `basename(file.path)` invocation rendering a label (tabs, breadcrumbs, etc.). Apply `displayName` consistently.
- **Pattern**: `displayName` introduced in Task 2.
- **Gotcha**: don't strip extensions in `title` attributes — those should still show the full path so the user can hover and see what file it is.
- **Validate**: open `Docs Site` → menubar shows `… ui/Docs Site` (was `… ui/Docs Site.tsx`). Hover the row → tooltip still shows `.design/ui/Docs Site.tsx`.

### Task 7: UPDATE `styles.css` — sidecar + chevron variants

- **Do**: Append (do not refactor existing rules):
  ```css
  .tp-row.sidecar { opacity: .55; }
  .tp-row.sidecar .glyph { visibility: hidden; }
  .tp-section-hd.clickable { display: flex; align-items: center; gap: 6px; }
  .tp-section-hd.clickable > button { background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
  .tp-section-hd.clickable .chev { margin-left: auto; padding: 2px 6px; opacity: .7; }
  .tp-section-hd.clickable .chev:hover { opacity: 1; }
  ```
- **Pattern**: existing `.tp-row` + `.muted` styling.
- **Gotcha**: existing single-`<button>` `.tp-section-hd.clickable` rule may set `display: block` or similar. Confirm `flex` doesn't break the non-DS section headers (they're `<div>` without `.clickable`, so unaffected).
- **Validate**: visual diff in dev tools — sidecars appear faded under their canvas, DS section header has chevron right-aligned, no horizontal scroll, no row-height change.

### Task 8: Manual smoke against md-claude's own `.design/`

- **Do**: Spin up `bun run plugins/design/dev-server/server.ts` from the repo root. Open `http://localhost:4399`. Walk through the test scenarios in the Validation section (below). Capture before/after screenshots via `plugins/design/dev-server/bin/screenshot.sh --full`. Compare.
- **Validate**: Full Validation block below all green.

---

## Validation

Repo has no test suite, lint config, or build step beyond the dev-server Bun build (per `CLAUDE.md` — "There is no test suite, lint config, or build step"). Manual + lightweight automated checks:

1. **Bun typecheck/build**: `pnpm dlx bun build plugins/design/dev-server/client/app.jsx --target browser --outdir /tmp/mdcc-build` — must succeed with no errors.
2. **Bun tests** (touched dev-server only): `cd plugins/design/dev-server && bun test` — exists for the canvas pipeline; not for the tree, but the run must stay green (no regressions in adjacent files).
3. **Dev-server smoke**: `bun run plugins/design/dev-server/server.ts` from `/Volumes/D/git/claude-design`. Boot to "ready on http://localhost:4399".
4. **Cross-state visual smoke** (open in agent-browser, capture screenshots):
   - **State 1 — default (showHidden off, dsBodyExpanded off):** Confirm 3 canvas rows under UI CANVASES, names without extensions, no chevrons visible. DS section header only, no body. PROJECT + RUNTIME sections invisible.
   - **State 2 — DS expanded:** Click DS chevron. Expanded body shows `preview/` folder + DS-level docs (`README.md`, `SKILL.md`, `colors_and_type.css`) at root. `preview/` opens to ~22 canvas rows, also extension-stripped.
   - **State 3 — Show hidden ON:** Press `H`. PROJECT section appears (3 files), RUNTIME section appears (~5+ files), UI CANVASES canvas rows now have chevrons → expand to reveal their sidecars (`.css`, `.meta.json`, `.registry.json`).
   - **State 4 — search:** Type `meta` in filter. Auto-expand any canvas with a matching sidecar; show only filtered rows.
   - **State 5 — reload:** Refresh the page. All three persisted state values (`sidebarOpen`, `dsBodyExpanded`, `showHidden`) hold.
5. **Active-canvas regression**: Click a canvas in the tree → iframe loads it; `activePath` syncs; the menubar status row shows the canvas name without extension; the tab strip (top-right of viewport) shows tabs without extensions. Reload page → if `activePath` is restored from server state, the tab + status still render correctly.
6. **Multi-DS guard**: Temporarily add a second `designSystems[]` entry in `.design/config.json` (e.g. `{ name: 'beta', path: 'system/beta' }`). Reload → DS section falls back to `effectiveRoot = g.path` (= `system`) and shows both `project/` and `beta/` subfolders inside the body. Revert the config edit.
7. **A11y**: Keyboard-only nav through the sidebar. `Tab` reaches the DS title button, then the DS chevron, then each canvas row's chevron, then each canvas main button. `Enter` / `Space` toggles disclosures. `Esc` collapses. Screen-reader: `aria-expanded` announces correctly. `aria-label`s on the two DS-header buttons read distinctly. No new contrast issues (sidecars at `opacity: 0.55` against `--u-bg-2` — verify against the WCAG 4.5:1 floor; if borderline, switch to a foreground color token directly instead of opacity).
8. **Manual**:
   - Resize the sidebar to its minimum width — confirm canvas rows + chevrons don't overflow.
   - Toggle theme light/dark — sidecar muted state reads correctly in both themes.
   - With showHidden ON and a canvas open, edit the canvas (`/design:edit` smoke if available) — confirm sidecar `.meta.json` row is still there after the change.

---

## Scenario Coverage

Repo doesn't use `.ai/scenarios/` for tool-internal UI (the dev-server itself isn't a "feature" for the cross-platform scenario harness — there are no mobile / native variants). Manual cross-state walk in step 4 substitutes; flag in PR description that automated scenarios are intentionally absent for this surface.

---

## Acceptance Criteria

- [ ] Tasks 1–8 completed
- [ ] `bun build` succeeds for client app
- [ ] `bun test` in `plugins/design/dev-server` stays green
- [ ] All 5 states in Validation step 4 visually confirmed via screenshots
- [ ] Reload-persistence confirmed for `sidebarOpen`, `dsBodyExpanded`, `showHidden`
- [ ] Multi-DS fallback confirmed (Task 6 in Validation)
- [ ] A11y keyboard walk confirmed, contrast within WCAG 4.5:1
- [ ] Active-canvas open/close still works end-to-end
- [ ] No DDR needed (proven UX pattern, additive server schema, no new dependencies) — but if Multi-DS fallback surfaces an ambiguous case during Validation, record a DDR pointing forward to a "proper multi-DS sectioning" follow-up
- [ ] PR description links before/after screenshots
