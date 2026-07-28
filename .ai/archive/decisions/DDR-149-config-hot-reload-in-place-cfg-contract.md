# DDR-149 — Dev-server config hot-reload: in-place `ctx.cfg` swap contract

**Status:** accepted
**Date:** 2026-07-03
**Relates:** DDR-115 (runtime-state taxonomy), DDR-124 (external-canvas list watcher / `canvas-list-update`), DDR-093 (per-canvas DS token injection), rca/issue-ds-scaffold-files-not-in-filetree-stale-config

## Context

Reported bug: `/design:setup-ds` running in the ACP chat scaffolded a full design system (34 preview specimens + README/SKILL/tokens under `.design/system/kanban-glass/`), the files landed on disk, but the FILES tree showed nothing — **even after the manual reload button** shipped for the earlier watcher-gap RCAs. The tell: manual reload re-fetches `GET /_index-data` correctly, so the staleness had to be server-side. RCA traced it to `createContext()` reading `.design/config.json` exactly once at boot: the scaffold rewrites the config mid-session (adds the `system` canvas group, `designSystems[]`, `tokensCssRel`), but `buildIndexData()` kept iterating the boot-time `cfg.canvasGroups`, so `system/**` never entered the index payload. `canvas-list-watch` was equally blind — it captured `groupPaths` at construction, so writes under the new group never even scheduled a refresh. This wasn't a watcher-reliability gap (DDR-124's and the desktop-refresh RCA's territory); it was a **config lifecycle** gap: mid-session config mutation is the documented first-bootstrap flow, and the server had no invalidation path short of a restart.

## Decision

**Hot-reload `.design/config.json` on disk change, by mutating the shared `ctx.cfg` object IN PLACE — never by replacing the reference.**

- `context.ts` exports `reloadConfig(ctx): boolean`: re-runs `loadConfig` (including `normalizeDesignSystems`), and on change deletes stale keys + `Object.assign`s the new values into the SAME `ctx.cfg` object, then recomputes the derived `ctx.paths.tokensUrlRel` / `ctx.paths.systemDirRel` and `ctx.projectLabel` in place.
- **Why in place:** every long-lived module factory holds the object reference (`const { cfg, paths } = ctx` in `api.ts` etc.). Swapping the object contents under the shared reference upgrades every consumer at once — `/_index-data`, canvas create allowlists, DS token resolution, sync group iteration — with zero per-module wiring.
- **The contract this creates:** long-lived modules must read cfg **values at use time**, never copy them at construction. `canvas-list-watch.ts`'s boot-captured `groupPaths` was exactly such a copy and is now a live read. Any future module that snapshots a cfg value at factory time silently re-introduces this bug class — `reloadConfig`'s doc comment carries the warning.
- **Trigger + fan-out** (`server.ts`): `fs:json` events for exactly `config.json` → 150 ms debounce → `reloadConfig`; on change → `canvasListWatch.refresh()` (its set-diff emits `canvas-list-update` for every canvas the new groups uncover — the tree refreshes over the DDR-124 path with no new client wiring) + a new `config-updated` bus event, relayed by `ws.ts` to inspector clients only (same-origin shell; NOT the untrusted canvas origin), on which the client re-fetches `/_config`.
- **Deliberately NOT hot-reloadable:** `designRoot` — the fs-watcher and every runtime path root hang off it; a change logs a warn and keeps the old value (restart required). A config.json that is **missing or invalid mid-edit keeps the running config** — a live server must not downgrade to defaults on a half-written editor save (`loadConfig`'s `_source` field encodes the distinction).

## Consequences

- ✅ The first-bootstrap dogfood loop works end-to-end: `/design:setup-ds` from the ACP chat → the `Design system` group and its specimens appear in the tree live (verified against a live server: config rewrite reflected in `/_index-data`, `/_config`, and a `config-updated` WS push within ~1 s).
- ✅ Any mid-session config edit (second DS, new canvas group, changed `defaultDesignSystem`) now applies without a restart, on every surface that reads `ctx.cfg` at use time.
- ⚠️ New invariant to police in review: **no boot-time copies of cfg values in long-lived modules.** Value copies (arrays destructured into locals, precomputed allowlists) go stale silently — the type system can't catch it.
- ⚠️ In-place mutation is not transactional: a request racing the swap can read a half-updated cfg for one tick. Accepted for a loopback dev server — the payloads are advisory UI state, the swap is synchronous within one event-loop turn, and the subsequent `canvas-list-update`/`config-updated` nudges reconcile every client.
- ➡️ Not addressed: hot-reloading `designRoot`, and hub-linked `linkedHub` re-pointing semantics on live config change (sync runtime reads `ctx.cfg.linkedHub` at start; a live re-point still requires a restart — same as before this change).

## Security fan-out (`/flow:done`, 2026-07-03)

Defender: **PASS WITH SUGGESTIONS** (0 at/above the medium floor; 3 low + 1 info). Adversarial: **PASS WITH SUGGESTIONS** — confirms no new cross-origin/remote vector (`config-updated` is inspector-only; the untrusted canvas origin can neither write config.json nor read `/_config`//_index-data`; sync hub re-point correctly blocked by boot-pinning); the honest delta is *timing* — two pre-existing poisoned-config primitives went from restart-gated to live. Hardening applied in follow-up commit `eec1035`:

- **LOW (both reviewers) — design-root containment clamp.** `canvasGroups[].path`, `tokensCssRel`, and `designSystems[]` entries that escape the design root (`../` or absolute) are rejected at config-load time (`clampToDesignRoot` in `normalizeConfig` — boot AND reload), with warn + drop/default-reset, instead of relying on downstream `safePathUnderRoot` repoRoot confinement.
- **LOW — `linkedHub` boot-pinned** like `designRoot` (warn + keep boot value on change): the sync runtime captures `linkedHub` once at startup, so a live swap could only make use-time `syncTsx` gating drift out of step with the hub the socket is actually attached to.
- **LOW — no-await invariant pinned** with a comment on the delete+assign swap (atomic only because synchronous).
- **INFO (accepted, no action):** config-write-thrash DoS (debounced, trusted-writer-only); the `designRoot ≠ .design` watch/read dead-spot is pre-existing (`loadConfig` hardcodes `.design/config.json`) and fails safe via the `_source` guard.

## Testing

`apps/studio/test/config-reload.test.ts` (8 cases: boot-captured reference sees the swapped groups; derived paths recompute; unchanged → `false`; invalid JSON keeps running config; deleted file keeps running config; defaults-boot + created config applies; linkedHub boot-pin; design-root escape clamp) and a hot-reload scenario in `canvas-list-watch.test.ts` (group added by in-place swap uncovers pre-existing canvases via `refresh()`, and future writes under the new group pass the live `fs:any` gate). Live E2E: source server boot → config rewrite → index/config/WS assertions.
