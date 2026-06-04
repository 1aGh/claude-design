# DDR-093 — A UI canvas resolves its tokens from `meta.designSystem`, not `designSystems[0]`

**Status:** Accepted — 2026-06-04.
**Supersedes:** none. **Fixes:** the latent multi-DS regression root-caused in [`.ai/logs/rca/issue-canvas-ds-token-injection.md`](../logs/rca/issue-canvas-ds-token-injection.md) — every `ui/*.tsx` authored under a **non-default** design system rendered unstyled (white) in the live browser.
**Related:** [DDR-048](DDR-048-multi-design-system-config.md) (multi-DS config — the `designSystems[]` array + per-DS `tokensCssRel` this builds on; the bug was the UI-canvas branch never catching up to multi-DS); [DDR-061](DDR-061-design-system-context-cache.md) (DS-context resolution); [DDR-021](DDR-021-build-green-is-not-user-visible-green.md) / [DDR-068](DDR-068-smoke-computed-style-gate.md) (`/design:smoke` is where the recurrence guard belongs — "build-green ≠ user-visible-green").
**Instruments:** `plugins/design/dev-server/client/canvas-url.js` (NEW — the extracted, unit-testable `canvasUrl`/`urlOf` resolver); `plugins/design/dev-server/client/app.jsx` (imports the resolver; folds `canvasDesignSystems` into `cfg`); `plugins/design/dev-server/api.ts` (`buildIndexData()` builds + returns the `canvasDesignSystems` map); tests: `test/canvas-url.test.ts` (pure resolver matrix + regression guard), `test/index-data-canvas-ds.test.ts` (server attaches the right DS per canvas).

## Context

The dev-server **client** injects token/component CSS into each canvas iframe via a query string (`?tokens=…&components=…`) built by `canvasUrl()`. In a multi-DS project (here: `project` = `designSystems[0]`/default, scoped to `.mdcc[data-theme]`; `maude` = non-default, scoped to `.maude[data-theme]`), the UI-canvas branch of `canvasUrl()` resolved tokens **unconditionally from `designSystems[0]`**, ignoring the canvas's own `meta.designSystem`. A `maude` canvas therefore loaded `project` tokens — whose ladder never cascades into a `.maude` subtree — so every `var(--*)` went undefined and the canvas rendered white.

Two facts made it a silent latent bug: (1) the per-canvas `designSystem` lived in the `.meta.json` sidecar but **never reached the client index payload** (`buildIndexData()` emitted `paths: string[]` with no per-canvas DS), so even a willing `canvasUrl()` had nothing to honor; (2) CSS scoping turned "wrong tokens" into "no tokens." It stayed invisible because single-DS projects and default-DS canvases have `ds0 === the right DS`, and `/design:new`'s step-9 reality check screenshots through **explicit** target-DS tokens — an idealized host that masked the live client's behavior.

## Decision

**The per-canvas `meta.designSystem` is authoritative for token injection.** A UI canvas resolves its tokens/components from its OWN design system; `designSystems[0]` is only the fallback when no DS is known (single-DS / legacy / default-DS canvas), preserving historical behavior byte-for-byte.

1. **Server — `buildIndexData()` surfaces a `canvasDesignSystems` map** (repo-relative canvas path → DS name) on the `/_index-data` payload. A file under `system/<ds>/…` is **path-authoritative** (specimens/ui_kits rarely carry a sidecar `designSystem`); a `ui/` canvas reads `meta.designSystem`, defaulting to `cfg.defaultDesignSystem`. `paths: string[]` stays unchanged (backward-compatible).
2. **Client — `canvasUrl()` honors the per-canvas DS.** Resolution order: explicit `opts.ds` (the unit-test seam) → `cfg.canvasDesignSystems[path]` (the server map, folded into `cfg` on tree load) → `ds0`. The **specimen branch is untouched** (still path-resolved from `system/<ds>/preview/`).
3. **The pure resolver is extracted to `client/canvas-url.js`** so the token-resolution branches are unit-testable without a DOM (`app.jsx` self-mounts on import, so its internals were untestable).

**Keep the self-import workaround** (a non-default-DS canvas doing `import "../system/<ds>/colors_and_type.css"`) as defense-in-depth — it makes the shadcn registry-item handoff self-contained and is harmless once the client is correct.

### Alternatives rejected

- **Thread `node.designSystem` through every caller** (the RCA's first sketch). Rejected: tabs/gallery items carry only `.path`, so it meant changing the tree→tab→gallery node shapes in three places. The `cfg.canvasDesignSystems[path]` map does the lookup inside `canvasUrl()` with **zero caller changes** — far smaller surface. `opts.ds` is still accepted as the explicit testing interface.
- **Build the map in the `/_config` handler.** Rejected: `/_config` returns the static `ctx.cfg` with no file I/O; the map needs to walk canvases + read sidecars, which `buildIndexData()` already does, and it must stay live as canvases are added/retargeted (the file-watcher re-runs `loadTree`).
- **Inline `data:`-style token duplication / per-canvas token copies.** Rejected: the DS already owns one authoritative `tokensCssRel`; the fix is pointing each canvas at the right one, not copying.

## Consequences

- Non-default-DS UI canvases now render correctly in the live browser (tab + gallery thumbnail) without a self-import. As a bonus, `system/<ds>/ui_kits/` thumbnails (which the `/preview/`-only specimen regex never matched) also get the right DS via the map.
- The server↔client index payload gains one field (`canvasDesignSystems`); both `setCfg` call sites use functional merges so the racing `/_config` and `/_index-data` fetches can't clobber each other.
- **Recurrence guard (follow-up, not in this change):** `/design:smoke` should open a non-default-DS canvas through the **client-built** URL and assert a DS-specific computed `--token` resolves — the DDR-021/DDR-068 class of check the explicit-token reality screenshot bypassed. Tracked as a `/design:smoke` hardening item.
