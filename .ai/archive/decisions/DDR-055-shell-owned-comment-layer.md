## DDR-055 — Shell-owned comment layer (comments in bare DS specimens)

- **Status:** Accepted — 2026-05-28
- **Authors:** 1aGh
- **Phase:** standalone fix on `main` (reported inline; unrelated to active phase-9)
- **Supersedes:** —
- **Superseded by:** —
- **Related:**
  - [DDR-007](./DDR-007-stable-element-id-schema-data-dc-attrs.md) — `data-cd-id` / `data-dc-screen` element-id schema the comment drop resolves against
  - [DDR-019](./DDR-019-tsx-canvas-mount-harness.md) — the `_shell.html` mount harness this change hooks into (if present; mount harness origin)
  - [DDR-026](./DDR-026-input-router-vs-viewport-controller-event-ownership.md) — input-router vs viewport-controller event ownership (the router this change extends)
  - [DDR-044](./DDR-044-marketplace-install-vs-npm-install-artifact-strategy.md) — committed `dist/*.js` ship contract (now includes `comment-mount.js`)

## Context

The in-place comment tool (tool palette + `CommentsOverlay` + the `onDropComment` branch of the canvas input-router + `ToolProvider` / `SelectionSetProvider`) was mounted **only** by `DesignCanvas` (`canvas-lib.tsx` / `canvas-shell.tsx`). UI canvases wrap their content in `DesignCanvas`, so they got the comment tool. **Bare DS specimens** (`system/<ds>/preview/*.tsx`) are intentionally plain TSX with no canvas-lib envelope (per `ds-specimen.tsx.template`) — they never render `DesignCanvas`, so they had **no comment tool at all**. A designer reviewing the design system itself (e.g. `colors-accent`, `components-buttons`) could not drop feedback on a specimen the way they could on a UI canvas.

The mount harness (`_shell.html`) rendered every canvas raw: `createRoot(...).render(createElement(Canvas))`. No comment chrome was added by the harness, so whatever a canvas didn't mount itself, it didn't have.

## Decision

**The comment subsystem becomes shell-owned: a single instance lives at the canvas mount harness, wrapping ANY default export. `DesignCanvas` consumes the shell-provided `ToolProvider` / `SelectionSetProvider` / `CommentsOverlay` instead of creating its own.** (Plan option **A1**.)

Concretely:

1. **New runtime bundle `dist/comment-mount.js`** (`canvas-comment-mount.tsx`, built by `build.ts`, served from `/_client/`) exports `mountCanvas(Canvas, { rootEl, file, commentsEnabled })`. When `commentsEnabled === true` it renders a **lite** provider tree:
   `MaybeToolProvider → MaybeSelectionSetProvider → CommentHost(hostRef){ useInputRouter(comment-scoped); <CommentsOverlay/>; {children} }`.
   When `false`, it renders `<Canvas/>` bare.
2. **`_shell.html`** calls `mountCanvas(...)` instead of the inline `createRoot().render(...)`, parsing `?comments=0` → `commentsEnabled === false`.
3. **`DesignCanvas` / `CanvasShell` are now consumers**: `ToolProvider` → `MaybeToolProvider`, `SelectionSetProvider` → `MaybeSelectionSetProvider` (both mount only when no outer instance exists), `<CommentsOverlay/>` removed from `CanvasShell`, and the `onDropComment` branch removed from `CanvasShell`'s router (the mount-layer router owns the drop).

### Why A1 over A2 (per-surface comment mount)

A2 would have each surface (DesignCanvas + a separate specimen wrapper) mount its own comment subsystem. Rejected because:
- **Single owner = no double-mount.** A UI canvas would otherwise carry two `CommentsOverlay`s, two `ToolProvider`s → two tool states that drift (toggle comment in one, the other stays move) and two pin layers.
- **One cursor-CSS host.** Comment-mode cursor is keyed on a host attribute; a single host avoids competing `data-active-tool` writers.
- The `Maybe*` wrapper pattern (hook called unconditionally, returned tree branches on the result — never a conditional hook) lets `DesignCanvas` transparently consume an outer provider when present and self-provide when standalone (legacy `.html` mocks, tests).

### Nested-router coexistence — `claimableActions` allowlist

On a UI canvas the mount-layer router is an **ancestor** capture-listener over `DesignCanvas`'s own router (`.dc-canvas`). Capture-phase ancestors fire first; `useInputRouter` calls `stopImmediatePropagation()` on any non-`no-op` action it claims, which would otherwise swallow the inner router's **Cmd+click select / right-click context-menu / Cmd+Z undo** before they ever fire.

Fix: `useInputRouter` gained an optional `claimableActions: ReadonlySet<RouterAction['kind']>`. Any classified action outside the set is downgraded to `no-op` (no `preventDefault`, no dispatch, no `stopImmediatePropagation`) so it propagates untouched. Default (omitted) = claim everything, preserving `CanvasShell`'s existing behavior. The mount layer passes `{ 'drop-comment', 'tool', 'escape' }` — it owns the comment drop, shares tool/escape with the inner router (idempotent against the same shared provider), and lets select/context-menu/undo flow through. Verified e2e: on a UI canvas comment-drop opens the composer AND Cmd+click still paints a selection halo.

### JSX runtime flavour — production, always

`comment-mount.js` externalizes `react` / `react-dom` / `yjs` / `y-protocols` / `lib0` to the importmap bare specifiers so it shares the canvas's single React (and other) singletons — inlining a second React breaks hooks ("invalid hook call"). The dev-server's `/_canvas-runtime/*` bundles are **production** React, where `react/jsx-dev-runtime`'s `jsxDEV` is a no-op (undefined at call time). The build therefore forces `define: { 'process.env.NODE_ENV': '"production"' }` **regardless of build mode** (mirroring `canvas-build.ts`) so it emits production `jsx` (`react/jsx-runtime`), not `jsxDEV`. A dev-mode build emitting `jsxDEV` against the production runtime throws `jsxDEV is not a function` — caught only by the browser e2e, not by `tsc` or unit tests.

### Scope guard (explicit user requirement)

The comment layer lives **only inside the canvas/specimen iframe**. It is NOT added to the outer dev-server app (`client/app.jsx` — a separate React root, untouched). It is suppressed in System-view **gallery thumbnails** by passing `?comments=0` from the thumbnail iframe (`canvasUrl(path, cfg, { thumbnail: true })`); `mountCanvas` skips the comment layer when `commentsEnabled === false`. Opening a specimen as a real tab keeps comments on.

### `display: contents` host

`CommentHost`'s wrapper is `display: contents` so a bare specimen's own flex/grid layout (`_layout.css` on `<body>`) is byte-identical to pre-change — the host box contributes nothing to layout. A `display:contents` box can't paint a cursor, so the comment-mode cursor rule (injected from the mount module, keyed on `[data-active-tool="comment"]`) targets `body` + descendants, not the host box.

## Consequences

- **Contract change:** the canvas-lib ↔ mount-harness boundary moved. "Where do comments live" is now the mount harness, not `DesignCanvas`. Anyone mounting a canvas outside `mountCanvas` (direct `createRoot().render(<Canvas/>)`) gets no comment layer — that's the legacy `.html`-mock path, which keeps its own inspector-injected comment flow.
- **Ship contract:** `dist/comment-mount.js` is committed + authoritative (whitelisted in `.gitignore`, ships via the `plugins/design/dev-server` `files` entry), exactly like `dist/client.bundle.js`. Built dev-mode (unminified) to match the existing committed `client.bundle.js` convention.
- **DRY:** `hoverTargetToSelection` + `deriveFile` + DOM-path helpers were extracted from `canvas-shell.tsx` into a new leaf module `dom-selection.ts` (no React, no canvas-lib import) so both the canvas chrome and the lite mount layer share one implementation without a cycle and without bundling the heavy `DesignCanvas` tree into the lite mount.
- **Generalized cursor host:** the comment-mode cursor rule now also matches a generic `[data-mc-host]` / `body[data-active-tool]`, not just `.dc-canvas[data-active-tool]`.

## Verification

- `tsc --noEmit` clean modulo the documented baseline (`api.ts:898/899`, `runtime-bundle.ts:333` — DDR-026).
- Full dev-server `bun test` suite green (656+ pass; the 2 transient failures on one run were timing-only — `bundle-smoke` 5 s default vs an 8 s runtime-regen build, and a 304-etag race — both pass clean in isolation). New `test/comment-mount.test.ts`: provider-dedup (Maybe* consume an outer instance) + bundle scope-guard (react externalized, `mountCanvas` exported).
- **Browser e2e (agent-browser, the gate that caught the `jsxDEV` bug):** bare specimen → composer opens on comment drop, exactly one `.cm-layer`; UI canvas → one `.cm-layer` + one tool palette, comment-drop opens composer AND Cmd+click still selects; `?comments=0` → zero `.cm-layer`, canvas still renders. The cross-platform `scenario-runner` (5 native platforms) is **not applicable** — this is a desktop web devtool, not a 5-platform app.
