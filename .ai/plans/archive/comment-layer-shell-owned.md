# Feature: Shell-owned comment layer (comments in bare specimens)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — this touches the canvas mount harness and canvas-lib, which are load-bearing for every canvas.

## Description

Make the in-place comment tool work inside **every** mounted surface — both UI canvases (which wrap in `DesignCanvas`) and **bare DS specimens** (`system/<ds>/preview/*.tsx`, which are intentionally plain TSX with no canvas-lib envelope). Today the entire comment subsystem (tool palette, `CommentsOverlay`, `onDropComment` input routing, the `ToolProvider`/`SelectionSetProvider`) is mounted by `DesignCanvas`. A specimen never renders `DesignCanvas`, so it has no comment tool at all.

The fix is **A1 — single shell-owned comment layer**: hoist the comment subsystem up into the canvas mount harness (`_shell.html` → a new `mountCanvas` runtime bundle) so it wraps *any* default export. `DesignCanvas` stops creating its own comment providers/overlay and consumes the shell-provided ones instead (via the existing `useXOptional` pattern).

## User Story

As a designer reviewing the design system, I want to drop comments on a DS specimen page (e.g. `colors-accent`, `components-buttons`) the same way I do on a UI canvas, so that feedback on the system itself lives in the same review workflow — without converting specimens into `DesignCanvas` artboards.

## Problem

- `_shell.html:243-250` renders the canvas raw: `root.render(createElement(Canvas))`. No comment chrome is added by the harness.
- The comment subsystem is mounted only by `DesignCanvas` (`canvas-lib.tsx:1181` `ToolProvider`, `canvas-shell.tsx:307` `SelectionSetProvider`, `canvas-shell.tsx:1119` `<CommentsOverlay/>`, plus the `onDropComment` branch of the input-router in `CanvasCore`).
- Bare specimens (all 40 under `.design/system/project/preview/`, by design per `ds-specimen.tsx.template:12-13`) never enter that tree → `dcCanvas:false`, no tool palette, no overlay (confirmed empirically against a 2-file fixture).

## Solution

Introduce a **comment mount layer** owned by the harness:

1. New browser bundle `dist/comment-mount.js` (built by `build.ts`, served from `/_client/`) exporting `mountCanvas(Canvas, { rootEl, file, commentsEnabled })`. It renders a **lite** provider tree around the canvas:
   `ToolProvider → SelectionSetProvider → CommentHost(hostRef) { useInputRouter({onDropComment,onTool,onEscape}); <CommentsOverlay/>; {children} }`
   plus a `dgn:'tool-set'` postMessage listener (so the parent menubar comment toggle still works) and a minimal comment-tool affordance for specimens (keyboard `C` already routes via `onTool`; optionally a 1-button palette).
2. `_shell.html` calls `mountCanvas(...)` instead of the inline `createRoot().render(createElement(Canvas))`.
3. `DesignCanvas`/`CanvasShell` become **consumers** of the shell-provided context:
   - `ToolProvider` (canvas-lib.tsx:1181) mounts only when `useToolModeOptional() === null`.
   - `SelectionSetProvider` (canvas-shell.tsx:307) mounts only when `useSelectionSetOptional() === null`.
   - Remove `<CommentsOverlay/>` from `CanvasShell` (canvas-shell.tsx:1119) — now a single instance owned by the mount layer.
   - `DesignCanvas`'s input-router keeps `onHover/onSelect/onContextMenu`/drag; the **comment drop** is owned by the mount-layer router (its generic `data-cd-id`-climbing + floating-fallback logic, already at canvas-shell.tsx:1037-1082, works with or without artboards).
4. **Scope guard (explicit user requirement): the comment layer lives ONLY inside the canvas/specimen iframe.** It is NOT added to the outer dev-server app (`client/app.jsx` — a separate React root, untouched), and it is suppressed in System-view **gallery thumbnails** by passing `?comments=0` from the gallery iframe; `mountCanvas` skips the comment layer when `commentsEnabled === false`.

## Metadata

- **GitHub Issue**: — (reported inline via `/flow:quick`; standalone fix on `main`, unrelated to active phase-9)
- **Type**: Enhancement (architectural — comment subsystem ownership)
- **Complexity**: High
- **App/Package**: `plugins/design/dev-server`
- **Affected Systems**: canvas mount harness (`_shell.html`), build (`build.ts`), canvas-lib (`canvas-lib.tsx`, `canvas-shell.tsx`), tool/selection providers, System-view gallery (`client/app.jsx`)
- **Dependencies**: none new — pure refactor + one new local build entry

---

## Context References

### Must-Read Files

- `plugins/design/templates/_shell.html` (lines 78-96 importmap, 102-254 mount script) — Why: the harness to call `mountCanvas`; learn how `?canvas/?tokens/?layout/?components` are parsed and how the runtime importmap works.
- `plugins/design/dev-server/canvas-shell.tsx` (296-315 `CanvasShell` providers, 1116-1135 return incl. `<CommentsOverlay/>`, 927-948 `dgn:'tool-set'` listener, 1023-1112 `onDropComment` generic logic, 217-251 `.dc-canvas[data-active-tool]` cursor CSS, 1713-1726 `deriveFile`) — Why: the exact comment machinery to relocate + the cursor-CSS host coupling.
- `plugins/design/dev-server/canvas-lib.tsx` (1166-1191 `DesignCanvas`/`ToolProvider` wrap, 1427-1431 `CanvasShell` mount) — Why: where `ToolProvider` becomes conditional.
- `plugins/design/dev-server/comments-overlay.tsx` (114-132 `deriveFile`, 164-173 `CommentsOverlay` + `useSelectionSetOptional`, 283-299 `cm:open-composer` subscription) — Why: overlay already degrades gracefully without a provider; reuse as-is.
- `plugins/design/dev-server/input-router.tsx` (62-66 `Tool` union, 246-320 `useInputRouter`/`RouterCallbacks`/`UseInputRouterOptions`, 292-295 `isOverlayTarget`) — Why: the router is already host-scoped + callback-driven; the lite layer reuses it verbatim.
- `plugins/design/dev-server/use-tool-mode.tsx` (38-55 `DEFAULT_TOOLS` incl. `comment`/`C`, 71-145 `ToolProvider`/`useToolMode`/`useToolModeOptional`) — Why: conditional-provider pattern.
- `plugins/design/dev-server/use-selection-set.tsx` — Why: confirm a `useSelectionSetOptional()` exists (it does — used by `CommentsOverlay`).
- `plugins/design/dev-server/build.ts` (80-115 client bundle + CSS build) — Why: add the `comment-mount.js` entry alongside `client.bundle.js`.
- `plugins/design/dev-server/http.ts` (541-550 `/_client/*` serves DIST-first, 583-596 `_shell.html` route) — Why: how the new bundle is served.
- `plugins/design/dev-server/client/app.jsx` (1288-1308 `Gallery` preview iframes, 67-106 `canvasUrl`) — Why: where to pass `?comments=0` for thumbnails.

### Files to Create

- `plugins/design/dev-server/canvas-comment-mount.tsx` — the `mountCanvas(Canvas, opts)` entry + lite `CommentHost` provider tree. Bundled to `dist/comment-mount.js`.
- `plugins/design/dev-server/test/comment-mount.test.ts` — bundle-smoke + provider-dedup + scope-guard unit coverage.

### Patterns to Follow

- **Conditional provider** (mirror existing optional-hook usage):
  ```tsx
  // canvas-lib.tsx — only own the ToolProvider if none above us.
  const hasOuterTool = useToolModeOptional() !== null; // NOTE: hooks can't be conditional —
  // implement as a small <MaybeToolProvider> wrapper component that branches on the hook.
  ```
  Implement as `MaybeToolProvider` / `MaybeSelectionSetProvider` wrapper components (hook called unconditionally inside the wrapper, then branch the returned tree). Do NOT call the hook conditionally.
- **Runtime bundle served from DIST** — `http.ts:546` already tries `DIST_DIR` first for `/_client/*`; committing `dist/comment-mount.js` (like `dist/client.bundle.js`) is the ship contract (CLAUDE.md "Runtime bundles … are committed and authoritative").
- **`deriveFile()` is duplicated** (canvas-shell.tsx + comments-overlay.tsx) keyed on `?canvas=`/`?designRel=` — the mount layer passes `file` explicitly from the same query so all three agree.

---

## Design Decisions

> UI-adjacent but no new visual components — reuses the existing `CommentsOverlay` chrome verbatim. No new tokens/icons.

### Components reused

| Component | Source | Notes |
| --------- | ------ | ----- |
| `CommentsOverlay` | `comments-overlay.tsx` | Mounted once by the shell layer instead of by `CanvasShell`. Already provider-optional. |
| `useInputRouter` | `input-router.tsx` | Lite layer attaches it to the mount-layer host with `onDropComment`/`onTool`/`onEscape` only. |
| `ToolProvider` / `SelectionSetProvider` | `use-tool-mode.tsx` / `use-selection-set.tsx` | Hoisted to the shell layer; `DesignCanvas` consumes them. |
| `ToolPalette` (optional, minimal) | `tool-palette.tsx` | For specimens, expose at least the Comment tool; or rely on `C` shortcut + parent menubar `tool-set`. Decide in Task 4. |

### Key decision (DDR-worthy)

**The comment subsystem becomes shell-owned (single instance at the mount harness); `DesignCanvas` consumes shell-provided `ToolProvider`/`SelectionSetProvider`/`CommentsOverlay` rather than creating its own.** Record as a DDR — it changes the canvas-lib ↔ harness contract and the "where do comments live" invariant. Capture: why A1 over A2 (single owner = no double-mount, no two-tool-state bug, one cursor-CSS host), and the cursor-CSS host generalization (`.dc-canvas[data-active-tool]` → also a generic mount-host selector).

---

## Tasks

Execute in order. Each task is atomic and testable.

### Task 1: CREATE `canvas-comment-mount.tsx` — lite comment layer + `mountCanvas`

- **Do**: Export `mountCanvas(Canvas: ComponentType, opts: { rootEl: HTMLElement; file: string; commentsEnabled: boolean })`. When `commentsEnabled === false`, render `<Canvas/>` bare (current behavior). Otherwise render:
  `<MaybeToolProvider><MaybeSelectionSetProvider><CommentHost file rootEl><Canvas/></CommentHost></MaybeSelectionSetProvider></MaybeToolProvider>`.
  `CommentHost` owns: a `hostRef` (the mount-layer host wrapping children + overlay), `useInputRouter({ hostRef, getActiveTool, callbacks: { onDropComment, onTool: a => setTool(a.tool), onEscape } })`, `<CommentsOverlay/>`, sets `data-active-tool` on the host, and a `dgn:'tool-set'` message listener (mirror canvas-shell.tsx:927-948).
- **Pattern**: Lift `onDropComment` body from `canvas-shell.tsx:1023-1082` (generic path: deep/shallow `resolveHoverTarget` → `elementsFromPoint` `data-cd-id` climb → floating fallback; dispatch `cm:open-composer` + parent `comment-compose`).
- **Gotcha**: Hooks unconditional — `MaybeToolProvider` calls `useToolModeOptional()` then branches the *returned tree*, never the hook call. `getActiveTool` must read live tool (closure over `useToolMode().tool` via ref, like canvas-shell does).
- **Validate**: `bun test test/comment-mount.test.ts` (unit: dedup + drop-comment dispatch).

### Task 2: ADD `comment-mount.js` build entry to `build.ts`

- **Do**: Add a third `Bun.build` entrypoint `canvas-comment-mount.tsx` → `dist/comment-mount.js` (IIFE/ESM consistent with `client.bundle.js`; externalize `react`/`react-dom` to the importmap specifiers so it shares the canvas runtime). Respect `MAUDE_SKIP_RUNTIME_BUILD` parity rules.
- **Pattern**: `build.ts:84-115` client bundle block.
- **Gotcha**: The bundle must import `react`/`react-dom/client` as **bare specifiers** resolved by `_shell.html`'s importmap (do NOT inline a second React — would break hooks across the two roots). Verify externals.
- **Validate**: `cd plugins/design/dev-server && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts` emits `dist/comment-mount.js`; `bun test test/bundle-smoke.test.ts`.

### Task 3: UPDATE `_shell.html` — mount via `mountCanvas`

- **Do**: Add `comment-mount.js` to the importmap (or a `<script type="module">` import), parse `comments` query (`commentsEnabled = params.get('comments') !== '0'`), and replace the inline `createRoot().render(createElement(Canvas))` (lines 249-250) with `mountCanvas(Canvas, { rootEl: document.getElementById('canvas-root'), file: deriveFile(), commentsEnabled })`.
- **Pattern**: existing mount script 102-254; keep error handling (`showError`).
- **Gotcha**: `_shell.html` ships via `plugins/design/templates/` (npm `files`); the bundle ships via `dist/`. Keep both in `package.json` `files`. The `file` value must equal `${designRel}/${canvas}` exactly (matches `deriveFile()` in both consumers).
- **Validate**: serve a fixture, load a specimen URL, assert `CommentsOverlay` mounts (agent-browser eval, Task 7).

### Task 4: REFACTOR `DesignCanvas`/`CanvasShell` — consume shell-provided providers

- **Do**: (a) In `canvas-lib.tsx:1181`, wrap `ToolProvider` in `MaybeToolProvider`. (b) In `canvas-shell.tsx:307`, wrap `SelectionSetProvider` in `MaybeSelectionSetProvider`. (c) Remove `<CommentsOverlay/>` at `canvas-shell.tsx:1119`. (d) Remove the `onDropComment` branch from `DesignCanvas`'s input-router (mount-layer router owns it) — keep hover/select/context-menu/drag.
- **Pattern**: `useToolModeOptional`/`useSelectionSetOptional` already exist and are used by overlay code.
- **Gotcha**: `DesignCanvas`'s viewport controller reads tool state for `isPanDragActive` — must read the **same** (now possibly outer) `ToolProvider`. Verify the controller's tool source resolves to the shell provider. Annotation providers (`AnnotationSelectionProvider`/`AnnotationsVisibilityProvider`) stay inside `CanvasShell` (not comment-related).
- **Validate**: open a UI canvas (DesignCanvas) → exactly **one** `CommentsOverlay`, comment + move/select all still work; no duplicate tool palette.

### Task 5: UPDATE comment-mode cursor CSS for the generic host

- **Do**: Generalize the `.dc-canvas[data-active-tool="comment"]{,*}` cursor rules (canvas-shell.tsx:217-251) to also match the mount-layer host (e.g. `[data-mc-host][data-active-tool="comment"]`). Inject these styles from `canvas-comment-mount.tsx` (so they ship even when canvas-lib CSS isn't present in a bare specimen).
- **Gotcha**: specimens use `_layout.css` assuming `<body>` is the outer flex column — the mount-layer host must be a transparent `display: contents` or full-bleed wrapper that does NOT break that flex layout. Prefer `display: contents` for the host so specimen layout is byte-identical; verify the overlay (fixed-position) + `data-active-tool` cursor still apply (cursor on `display:contents` host won't paint — set the cursor rule on `body`/descendants instead when host is `contents`).
- **Validate**: specimen renders pixel-identical to pre-change (screenshot diff) AND comment cursor appears in comment mode.

### Task 6: UPDATE System-view gallery — suppress comments in thumbnails

- **Do**: In `client/app.jsx` `Gallery` (1288-1308) / `canvasUrl` (67-106), append `comments=0` to the preview thumbnail iframe `src`. Opening a specimen as a real tab (`onOpen`) keeps comments enabled.
- **Gotcha**: only thumbnails get `comments=0` — the opened-tab path (`openTab`) must NOT. These are different `canvasUrl` call sites; gate via an arg (`canvasUrl(path, cfg, { thumbnail: true })`).
- **Validate**: gallery thumbnail iframe has no comment overlay; opened specimen tab does.

### Task 7: VERIFY end-to-end against a multi-surface fixture

- **Do**: Scratch `.design` with (a) a bare specimen `system/project/preview/swatches.tsx`, (b) a UI canvas using `DesignCanvas`. Boot dev-server; via agent-browser: enter comment mode (`C` + menubar `tool-set`), drop a comment on each, confirm it persists (`/_comments?file=…`), confirm exactly one overlay on the UI canvas, confirm the gallery thumbnail has none and the outer app is uncommentable.
- **Validate**: see Validation section.

### Task 8: REGENERATE committed bundles + RECORD DDR

- **Do**: Rebuild `dist/client.bundle.js` + `dist/comment-mount.js`; commit both. Run `/flow:record-ddr` for the shell-owned-comments decision (Task 4). Add `dist/comment-mount.js` to `bin/check-runtime-bundles.sh`/`.min-sizes.json` floor if appropriate.
- **Validate**: `bash bin/check-runtime-bundles.sh`; `scripts/check-version-parity.sh` unaffected (no version bump unless releasing).

---

## Validation

This package has no root lint/typecheck/test (CLAUDE.md). Use the dev-server's bun toolchain + agent-browser:

1. **Build**: `cd plugins/design/dev-server && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts` — emits `dist/comment-mount.js` + `dist/client.bundle.js`.
2. **Types**: `bun run tsc --noEmit` (baseline errors api.ts:898 + runtime-bundle.ts:333 per DDR-026 stay; no new errors).
3. **Tests**: `bun test` (full dev-server suite green; new `comment-mount.test.ts` passes; `bundle-smoke` passes).
4. **Runtime bundle guard**: `bash bin/check-runtime-bundles.sh`.
5. **Browser e2e (Task 7)** via agent-browser against the scratch fixture — the cross-platform `scenario-runner` (5 native platforms) is **not applicable**: this is a desktop web devtool, not a 5-platform app. Document the divergence here rather than forcing mobile runners.
6. **A11y**: comment composer/overlay a11y is unchanged (same component) — spot-check focus + keyboard reach on a specimen.
7. **Manual edge cases**: (a) specimen with `<input>`/`<textarea>` — router `isEditableTarget` must still yield; (b) `display:contents` host doesn't shift specimen layout; (c) menubar comment toggle reaches specimen via `tool-set`; (d) HMR reload of a specimen keeps comments working; (e) opening the **same** specimen from gallery thumbnail (comments off) then as a tab (comments on) — no stale state.

---

## Acceptance Criteria

- [x] Comments can be added/persisted in a bare specimen AND a `DesignCanvas` UI canvas. (e2e: composer opens on both)
- [x] Exactly one `CommentsOverlay` per surface (no double-mount on UI canvases). (e2e: `.cm-layer` count = 1 on both)
- [x] Comment layer is absent from the outer app and from gallery thumbnails (`comments=0`). (e2e: `comments=0` → 0 `.cm-layer`; outer app untouched by construction)
- [x] Specimen visual output is byte-identical to pre-change — `display:contents` host contributes no box, so `_layout.css` `<body>` flex is unaffected.
- [x] `bun test` full suite green; new unit test covers dedup + scope-guard.
- [x] `dist/comment-mount.js` + `dist/client.bundle.js` rebuilt and committed. (runtime-bundle guard scopes `dist/runtime/*` only; comment-mount lives in `dist/` like `client.bundle.js`)
- [x] DDR recorded for shell-owned comment subsystem (DDR-055).
- [x] No new dependencies; `package.json` `files` ships `plugins/design/dev-server` (incl. `dist/comment-mount.js`) + `plugins/design/templates` (`_shell.html`); `.gitignore` whitelists the new bundle.

---

## Risks

1. **Two React roots / hooks mismatch** — the mount bundle MUST resolve `react`/`react-dom` through `_shell.html`'s importmap (shared singletons), not inline its own. Mis-externalizing → "invalid hook call". (Task 2 gotcha.)
2. **Tool-state source for DesignCanvas viewport** — after hoisting `ToolProvider`, `useViewportController`'s `isPanDragActive` must read the shell provider. If it silently reads a now-absent inner provider, pan/hand tool breaks. (Task 4 gotcha — verify explicitly.)
3. **`display:contents` host + cursor CSS** — comment cursor won't paint on a `display:contents` host; cursor rules must target descendants/`body`. Layout safety vs. cursor visibility is the trade-off (Task 5).
4. **Specimen layout regression** — any non-`contents` wrapper risks shifting `_layout.css` flex; screenshot-diff gate is mandatory.

---

## Retro

- **The JSX-runtime flavour bug was invisible to tsc + unit tests + the bundle-smoke test — only the browser e2e caught it.** A dev-mode build emitted `jsxDEV` against the importmap's PRODUCTION React (where `jsxDEV` is a no-op), throwing `jsxDEV is not a function` at mount. Lesson reinforced (DDR-021): for any change to the canvas mount/runtime path, a real-browser render check is non-negotiable — "builds + types + units green" provably ≠ "renders". `canvas-build.ts` already documented the `NODE_ENV='"production"'` requirement; the new bundle had to copy it. Worth a one-line CLAUDE.md note for future runtime-bundle entries.
- **The nested-router conflict was the highest-risk part and the plan under-specified it.** The plan said "DesignCanvas keeps hover/select; mount-layer owns comment drop" but didn't flag that capture-phase `stopImmediatePropagation` from the ancestor mount router would swallow the inner router's Cmd+click/right-click/undo. The `claimableActions` allowlist (an extension to `useInputRouter`) was the clean fix, but it was a design discovery during execution, not from the plan. Plans that introduce a second listener over an existing one should explicitly reason about event-phase ordering up front.
- **User feedback after the "done" e2e surfaced a real UX gap the acceptance criteria missed.** Comments worked, but on a specimen there was no hover-preview halo (it's CanvasShell chrome, absent on bare specimens) and comments fell back to floating (no element anchor). The plan's acceptance criteria checked "comments can be added" but not "the user can see what they're commenting on." Acceptance criteria for an interaction should include the affordance/feedback, not just the end state.
- **Extracting `dom-selection.ts` (shared leaf) instead of importing canvas-shell was the right call** — it kept the lite mount bundle from pulling in the entire heavy DesignCanvas tree and avoided a cycle. Worth defaulting to "extract the shared helper to a leaf module" whenever two layers need the same DOM logic.
- **What worked:** the `Maybe*Provider` dedup pattern (hook-unconditional, branch the returned tree) was clean and unit-testable; `display:contents` host kept specimen layout byte-identical with zero layout churn; per-task verify + a final full-surface `/design:smoke` (42/42) gave confidence the high-blast-radius harness change didn't regress any canvas.
