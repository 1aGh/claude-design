# DDR-115: Per-user camera split out of versioned canvas meta + one canonical runtime-state taxonomy

- **Date:** 2026-06-18
- **Status:** Accepted + **implemented**. `apps/studio/api.ts` (canvas-meta GET/PATCH split + view-store helpers + delete-sweep), `apps/studio/git/service.ts` (`isMaudeRuntimeState`), `cli/lib/gitignore-block.mjs`, repo `.gitignore`.
- **Tags:** dev-server, canvas-meta, viewport, camera, runtime-state, gitignore, taxonomy, changes-panel, git-hygiene, phase-4, DDR-027, DDR-054, DDR-056, DDR-102, DDR-112
- **Related:** [DDR-027](./DDR-027-artboard-size-jsx-authoritative.md) (layout = positions only, the other half of meta), [DDR-056](./DDR-056-linked-mode-gitignore-strategy.md) (the `full` gitignore strategy this reconciles), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (untrusted canvas origin — the PATCH whitelist), [DDR-102](./DDR-102-cold-start-divergence-resolution.md) (comments live-sync over the hub CRDT), [DDR-112](./DDR-112-simplified-staging-model.md) (commit-time sidecar auto-staging — the downstream consumer of a clean dirty set).

## Context

A canvas `.meta.json` mixed two fundamentally different kinds of state in one tracked file:

- **Shared document** — `title`, `subtitle`, `brief`, `platform`, `sections`/`artboards`, `layout.artboards` positions, `css_mode`, `designSystem`, `status`. Real content; belongs in git; syncs over the hub.
- **Per-user camera** — `viewport` (pan/zoom of the infinite board) and `last_modified`. Personal "where am I looking", rewritten on **every mouse pan/zoom**.

The old `PATCH /_api/canvas-meta` rewrote the whole `.meta.json` and stamped `last_modified` on **every** viewport settle, so the file churned constantly → it showed in the Changes panel and would be committed on every mouse move. The sync layer already knew this was wrong (`sync/codec.ts` `META_LOCAL_KEYS` lists `viewport`/`last_modified` and never sends them over the hub) — but the **disk/git layer never finished the split**.

Separately, three places independently decided "what is per-machine runtime vs. real content" and had **drifted apart**: the repo `.gitignore`, the `maude init` template (`cli/lib/gitignore-block.mjs`), and the `isMaudeRuntimeState` Changes-panel backstop (`git/service.ts`). Most visibly, **annotations and comments were gitignored** even though the panel backstop claimed they were versionable.

## Decision

### 1. GET-merge / PATCH-split — invisible to the client

The canvas shell loads meta client-side via `GET /_api/canvas-meta?file=` (the shell does **not** server-inject `window.__canvas_meta__`). So the route shape and client stay **identical**; only what the server reads/writes behind it changes:

- **PATCH** splits the lanes: `viewport` → a gitignored per-machine **view file**, never `.meta.json`; `layout` → `.meta.json` (versioned). `last_modified` is stamped into meta **only when `layout` is present** — a viewport-only patch leaves `.meta.json` **byte-unchanged** (the churn killer). A viewport-only patch on a canvas with no meta yet still succeeds (writes only the view file; no 404).
- **GET** loads `.meta.json`, strips any stale inline `viewport`/`last_modified`, overlays the view file's `viewport`, returns the combined object. The shell's `window.__canvas_meta__` still carries `{...sharedMeta, viewport}`, so restore-on-reload works with **zero client change**. PATCH returns the same merged shape as GET.

### 2. `_canvas-state/<slug>.view.json` is the per-machine camera lane

The camera lives in the already-gitignored `_canvas-state/` bucket as `_canvas-state/<slug>.view.json` `{ viewport: { x, y, zoom } }`. This:

- reuses the existing per-machine bucket, the delete-sweep, and the export exclusion — **no new gitignore glob**;
- is **distinct** from the legacy `_canvas-state/<slug>.json` `{ sections, viewport:{x,y,scale} }` store (FigJam-v3): that uses `scale` clamped 0.05–8, this uses `zoom` clamped 0.1–4. A separate file avoids the two writers clobbering each other's shape.

This **revises** the Phase-4 decision that the camera lives inline in `.meta.json`. Viewport validation (finite x/y, zoom clamp [0.1, 4]) is preserved verbatim for the view file.

### 3. One canonical runtime-state taxonomy

> **VERSIONED** = real content, shows in the Changes panel, committable. **IGNORED** = per-machine/per-user runtime, hidden everywhere (panel backstop + repo `.gitignore` + `maude init` template).

| Path (under `<designRoot>`) | Decision |
| --- | --- |
| `<name>.tsx`, `<name>.meta.json` | **VERSIONED** (meta no longer holds the camera) |
| `<name>.annotations.svg` | **VERSIONED** — see §4 |
| `system/<ds>/**`, `config.json` | **VERSIONED** |
| `_comments/` | **IGNORED** (hub-sync-only) — see §4 |
| `_canvas-state/` (incl. `<slug>.view.json`), `_state/`, `_chat/`, `_untrusted/` | **IGNORED** |
| `_history/`, `_trash/`, `_draw/`, `_smoke/` | **IGNORED** |
| `_server.json/.log/.lock`, `_active.json`, `_sync.json`, `_preflight.json` | **IGNORED** |
| `_locator.json`, `_export-history.json` | **IGNORED** (regenerable index) |

All three lists now agree on this set.

### 4. Annotations → versioned; Comments → hub-sync-only

- **Annotations** (`<name>.annotations.svg`) are **VERSIONED**. Durable visual markup with no other transport; previously gitignored (so they couldn't be committed at all) — flipped to versioned. They appear in the Changes panel and travel via git.
- **Comments** (`_comments/<slug>.json`) are **NOT versioned**. They already live-sync over the hub CRDT (DDR-102); versioning them in git would duplicate the transport and invite merge friction. They stay gitignored and are now also hidden by the panel backstop + present in the `maude init` template so all three lists agree.

The `isMaudeRuntimeState` doc-comment used to claim both comments and annotations were "deliberately not excluded." The rule now **diverges** (annotations versioned, comments hub-only) — the comment says so and points here.

## Consequences

- **Positive:** panning/zooming a canvas no longer dirties a tracked file; the Changes panel reflects real work (layout edits, annotations, comments-are-hidden, specimens, DS), not mouse movements. The downstream DDR-112 sidecar grouping becomes pure cosmetics over a genuinely clean dirty set. One taxonomy, three lists in lockstep.
- **No backward-compat / migration code** (single user, no other consumers): GET defensively strips stale inline `viewport`/`last_modified`; a one-time housekeeping commit stripped those keys from the already-committed metas. Adding a trailing newline to the PATCH writer keeps create/PATCH/sync-merge/housekeeping byte-consistent (no newline churn).
- **Negative / accepted:** un-ignoring annotations surfaced the existing on-disk `*.annotations.svg` as newly-committable (verified secret-free). The legacy `_canvas-state/<slug>.json` FigJam-v3 store is left untouched — flagged for a separate dead-code check, not part of this split.
- **Sync untouched:** `META_LOCAL_KEYS` stays (belt-and-suspenders); the on-disk meta simply becomes clean for the existing hub-sync path. No route added, so the DDR-054 dual-allowlist invariant is unaffected.

## Alternatives considered

- **Reuse the legacy `_canvas-state/<slug>.json` `viewport` key** — rejected: `{x,y,scale}` (clamp 0.05–8) vs `{x,y,zoom}` (clamp 0.1–4); two writers would clobber.
- **New sibling `<name>.view.json` next to the canvas** — rejected: needs a new `*.view.json` gitignore glob in content dirs and clutters `ui/`.
- **Keep the camera in meta but exclude it from the Changes panel via a content-diff** — rejected: the file still churns on disk (mtime, sync hashing, fs-watch noise); only a true split stops the write.
