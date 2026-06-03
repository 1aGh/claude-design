---
title: In-app What's New + guided tour for the Maude UI
shipTarget: null
date: null
status: planned
---

# Feature: In-app "What's New" + guided tour for the Maude UI

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports — mirror `ai-banner.tsx`, `build-roadmap.mjs`, and the `HelpModal` in `client/app.jsx` rather than inventing new shapes.

## Description

Add two user-facing surfaces to the **Maude UI** (the design dev-server's browser client) and one **mechanism** that keeps them fed:

1. **What's New** — a dismissible, version-aware notice (menubar badge + first-run toast + panel) that tells users about new Maude features the moment their installed version ships them.
2. **Guided tour** — a hand-rolled overlay engine that powers (a) per-feature **spotlight** tours launched from a What's New entry, and (b) an evergreen **first-run "how Maude works"** walkthrough reachable from Help.
3. **The mechanism** — a single source-of-truth feed (`whats-new.json`, ships with the dev-server) consumed by *both* the Maude UI and the docs site, plus a **repo-internal skill** that `/flow:done` triggers so every closed-out phase appends a feed entry — not just a roadmap/docs-site bump.

The hedge in the request ("nový tour **nebo aspoň** banner whats new") is honored by sequencing: **Phase 1 (feed + What's New) ships and works standalone**; the tour (Phase 3) layers on top.

## User Story

As a **Maude user** I want the UI itself to tell me what's new and walk me through it, so I discover features without reading the changelog — and as the **Maude maintainer** I want closing a phase to automatically surface that feature in-app, not just on the docs site.

## Problem

- The Maude UI has **zero onboarding scaffolding** — no tour, no "what's new", no first-run experience (confirmed: only `HelpModal`, `SyncBanner`, `AiBanner` exist).
- "Update docs on phase done" today is a **partial, manual** roadmap regen (`pnpm --filter @maude/site gen:roadmap`) + an optional changeset. Nothing reaches the product UI. Shipped features are invisible to users who don't read GitHub releases.
- There's no shared, durable feed of user-facing feature notes. Changesets are per-release and consumed/deleted by `changeset version`; the roadmap is phase-granular, not feature-highlight granular.

## Solution

A single `plugins/design/dev-server/whats-new.json` feed (already inside the npm `files` set) is the source of truth. The dev-server serves it at `GET /_api/whats-new`; the client compares it against a `localStorage` last-seen marker and surfaces unseen entries. A repo-internal `whats-new-entry` skill (scaffolded with `/skill-creator`) appends an entry on `/flow:done`, wired by a **CLAUDE.md convention** mirroring the proven roadmap-regen rule (plus an optional, generic, config-gated soft-prompt in the flow plugin for downstream opt-in). The site mirrors the same feed into `site/lib/whats-new.json` (Vercel-safe) and renders a `/whats-new` page. A hand-rolled `TourOverlay` (no runtime dep) powers spotlight + usage tours.

## Metadata

- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `plugins/design/dev-server` (UI + server), `site/` (docs page + generator), `plugins/flow` (generic config-gate, minimal), repo root (`.claude/skills/`, `CLAUDE.md`, `scripts/`)
- **Affected Systems**: dev-server client bundle (committed), dev-server HTTP API, site build pipeline, `/flow:done`, release/version stamping
- **Dependencies**: none new at runtime (hand-rolled tour — see DDR-B). Site page uses existing Next.js/Fumadocs.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message — independent context loads.

- `plugins/design/dev-server/ai-banner.tsx` (full) — **the banner pattern to mirror**: `ensureStyles()` injected `<style>`, `fixed` positioning, `role="status"`/`aria-live`, `prefers-reduced-motion` guard, mount-time backfill `fetch` + WS subscribe. The What's New toast copies this skeleton.
- `plugins/design/dev-server/client/app.jsx` — `App()` (~2195) for the mount point; `SyncBanner` (~2128) as a second banner reference; `HelpModal` (~871) for the modal/panel pattern + the `?`/F1 keybind; `/_index-data` fetch (~2355) for the data-load convention; localStorage keys use the **`mdcc-`** prefix (`mdcc-theme`, `mdcc-sidebar-open`, …) — reuse it.
- `plugins/design/dev-server/server.mjs` (HTTP route block, ~line 109+) — where `GET /_api/whats-new` is added; mirror an existing `/_api/*` JSON route.
- `plugins/design/dev-server/paths.ts` — **DDR-045**: resolve `whats-new.json` via `DEV_SERVER_ROOT`, NEVER `dirname(fileURLToPath(...))` (breaks inside `bun --compile` binaries — two releases shipped broken from this exact bug).
- `plugins/design/dev-server/build.ts` — Bun.build → committed `dist/client.bundle.js` + `dist/styles.css`. Rebuild after every client edit: `cd plugins/design/dev-server && bun run build.ts`.
- `plugins/design/dev-server/client/styles/_index.css` (+ `3-shell.css`, `4-components.css`, `1-tokens.css`) — token names `--u-*` / `--maude-*`; add new component CSS in `4-components.css`.
- `site/scripts/build-roadmap.mjs` (full) — **the generator pattern to mirror** for `build-whats-new.mjs` (reads repo file → writes committed `site/lib/*.json`).
- `site/package.json` (`prebuild`/`predev`/`gen:*`) — add `gen:whatsnew` and wire it into prebuild/predev.
- `site/components/mdcc/roadmap-timeline.tsx` + `site/app/(home)/roadmap/page.tsx` — the site page + server-component pattern to mirror for `/whats-new`.
- `plugins/flow/commands/done.md` (steps 7 retro/archive → 8 report) — insertion point for the generic config-gated soft-prompt.
- `CLAUDE.md` § "Site roadmap regen" — the **convention precedent** the mechanism imitates (rule in always-loaded file, not a hook — deliberately, per the roadmap retro).
- `scripts/bump-version.sh` — SSOT for versions; where pending feed entries get stamped at release.

### Files to Create

- `plugins/design/dev-server/whats-new.json` — the feed (seed with 2–3 real recent entries pulled from STATE.md History, e.g. annotation brief-boards, canvas create/delete, draw SVG agent).
- `plugins/design/dev-server/whats-new.schema.json` — JSON Schema for the feed; the generator + a test validate against it.
- `plugins/design/dev-server/client/whats-new.tsx` — `WhatsNewBadge` (menubar entry point), `WhatsNewToast` (first-run notice), `WhatsNewPanel` (list of unseen entries), seen-logic util.
- `plugins/design/dev-server/client/tour/overlay.tsx` — hand-rolled `TourOverlay` engine (Phase 3).
- `plugins/design/dev-server/client/tour/usage-tour.ts` — evergreen "how Maude works" step definitions (Phase 3).
- `plugins/design/dev-server/whats-new.test.ts` — bun:test for the route + seen-util (+ tour-step resolver in Phase 3).
- `.claude/skills/whats-new-entry/SKILL.md` — repo-internal skill (scaffold via `/skill-creator`).
- `site/scripts/build-whats-new.mjs` — generator → `site/lib/whats-new.json` (committed).
- `site/app/(home)/whats-new/page.tsx` + `site/components/mdcc/whats-new-feed.tsx` — the docs-site page (Phase 2).
- `scripts/stamp-whats-new.mjs` (or a `--stamp <version>` mode on the generator) — resolve pending entries at release.

---

## Design Decisions

> UI feature — discovery results below. No project `*-design-system.md` governs the dev-server chrome; the **client's own CSS tokens are the spec** (CLAUDE.md "Pattern priors come first").

### Components (reuse / mirror)

| Component | Source | Notes |
| --------- | ------ | ----- |
| Banner/toast skeleton | `plugins/design/dev-server/ai-banner.tsx` | `ensureStyles()` + `fixed` + `role` + reduced-motion. Copy structure for `WhatsNewToast`. |
| Modal/panel | `HelpModal` in `client/app.jsx` (~871) | Reuse `.help-modal-*` classes + open/close + `Esc` handling for `WhatsNewPanel`. |
| Menubar entry point | `.mb-*` menu system in `client/app.jsx` | `WhatsNewBadge` lives in `.mb-menus`/`.mb-status` as a `✦` button with an unseen-count dot. |
| Site timeline | `site/components/mdcc/roadmap-timeline.tsx` | Mirror for `whats-new-feed.tsx` (server component, ASCII/token styling). |

### Icons

| Icon | Source | Usage |
| ---- | ------ | ----- |
| `✦` sparkle (inline SVG or glyph) | match client's existing inline-SVG icon convention | What's New badge + toast leading mark. Keep single-stroke, token-colored (`--maude-hud-accent`). |

### Tokens

| Purpose | Token |
| ------- | ----- |
| Accent (badge dot, highlight) | `--maude-hud-accent` / `--maude-hud-accent-tint` (already used by `ai-banner.tsx`) |
| Surface / border / fg | `--u-bg-*`, `--u-border`, `--u-fg-*` |
| Motion | honor `motion.customPulses.canvasActivity` ceiling + `prefers-reduced-motion` (config: `.ai/workflows.config.json` already sets these) |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `WhatsNewBadge` / `WhatsNewToast` / `WhatsNewPanel` | no what's-new infra exists | banner + modal patterns above |
| `TourOverlay` | no tour infra exists; zero-dep by choice (DDR-B) | none (hand-rolled) |

### Decisions to record (DDR sweep targets)

- **DDR-A — Single-source What's New feed.** `plugins/design/dev-server/whats-new.json` is canonical (ships via npm `files`; describes **Maude's own product** updates, resolved from the maude package root via `paths.ts`, *not* the downstream project). The site mirrors it into `site/lib/whats-new.json`. One file, two consumers.
- **DDR-B — Hand-rolled zero-dep tour engine.** No `driver.js`/`shepherd.js`. Rationale: the dev-server's "committed bundle is authoritative / zero runtime dep" ethos + documented Bun.build environment-sensitivity (the motion-bundle breakage). ~250 LOC `TourOverlay` bundles into the committed `client.bundle.js`.
- **DDR-C — Pending→stamped entry versioning.** `/flow:done` appends entries with `version: null` (pending). The release flow (`scripts/bump-version.sh` → `stamp-whats-new.mjs`) stamps all pending entries with the new version + date — mirrors how changesets accumulate then `version` resolves them. Client/site label unstamped entries "Coming next release".
- **DDR-D — Mechanism = repo-internal skill + CLAUDE.md convention.** The Maude-specific authoring logic lives in `.claude/skills/whats-new-entry/` (repo-local, not shipped in the marketplace or npm), triggered by a CLAUDE.md rule on `/flow:done` (proven roadmap-regen pattern). The generic flow plugin gets only an **optional, config-gated, project-agnostic** soft-prompt (`integrations.whatsNew`) so downstream repos can opt in — no Maude paths in `plugins/flow/` (respects the project-agnostic invariant).
- **DDR-E (consider)** — downstream opt-out: `MAUDE_NO_WHATSNEW=1` so the dev-server in a *user's* project can suppress Maude product news.

---

## Tasks

Execute in dependency order. Phases 1→2→3; Phase 1 ships independently.

### Phase 1 — Feed + What's New + mechanism (the floor)

#### Task 1: CREATE the feed + schema
- **Do**: Author `whats-new.json` (`{ "$schema": "./whats-new.schema.json", "entries": [...] }`) and `whats-new.schema.json`. Entry shape: `{ id (=plan slug), version (string|null), date (string|null), kind ("feature"|"improvement"|"usage"|"fix"), title, summary, learnMore? (url), surface? , tour?: [{ target (css/data-tour key), title, body }] }`.
- **Pattern**: seed entries from `.ai/state/STATE.md` History (real recent phases).
- **Gotcha**: keep it in `plugins/design/dev-server/` so it's already covered by `package.json` `files` — verify with `bash scripts/check-tarball-shape.sh`.
- **Validate**: feed parses + validates against schema (a tiny node/bun script or the Task 6 test).

#### Task 2: ADD server route `GET /_api/whats-new`
- **Do**: In `server.mjs`, add a JSON route returning `{ version: <maude pkg version>, entries }`. Read the feed via `DEV_SERVER_ROOT` from `paths.ts`; read version from the maude `package.json` (resolved from package root, not cwd). Cache in memory (static per release).
- **Pattern**: mirror an existing `/_api/*` JSON handler.
- **Gotcha**: **DDR-045** — never `__dirname`; use `paths.ts`. Fail soft (empty `entries`) if the file is missing, never 500.
- **Validate**: `curl localhost:<port>/_api/whats-new` returns the feed (covered by Task 6 test).

#### Task 3: ADD client What's New surfaces
- **Do**: Create `client/whats-new.tsx` with: a **seen-util** (`localStorage['mdcc-whatsnew-seen']` = last-seen version; semver-ish compare to find unseen entries), `WhatsNewBadge` (menubar `✦` + unseen-count dot), `WhatsNewToast` (first-run, auto-dismiss, mirrors `ai-banner.tsx`), `WhatsNewPanel` (list of unseen entries, "mark all seen", per-entry `Learn more`; in Phase 3 a `Take tour` button when `entry.tour` exists). Mount `WhatsNewBadge` in the menubar and `WhatsNewToast` in `App()` near `SyncBanner`. Add component CSS to `client/styles/4-components.css`.
- **Pattern**: `ai-banner.tsx` (toast), `HelpModal` (panel), `.mb-*` (badge).
- **Gotcha**: do NOT reuse the `top:14px` center slot — it collides with `AiBanner`. Toast = bottom-left; badge in menubar. Honor `prefers-reduced-motion`. Use `mdcc-` localStorage prefix.
- **Validate**: rebuild bundle (`cd plugins/design/dev-server && bun run build.ts`), **commit** `dist/client.bundle.js` + `dist/styles.css`; open the UI via agent-browser, confirm badge/toast for an unseen version and that dismissal persists across reload.

#### Task 4: CREATE repo-internal `whats-new-entry` skill
- **Do**: Scaffold via `/skill-creator` → `.claude/skills/whats-new-entry/SKILL.md`. Behavior: given the just-archived plan + feature commit + current dev version, draft an entry (`id`=plan slug, `kind`, `title`, `summary`, optional `tour[]` if the feature added a UI surface), append to `whats-new.json` (validate against schema), and regenerate `site/lib/whats-new.json` (`pnpm --filter @maude/site gen:whatsnew`). `version: null` (pending — DDR-C).
- **Pattern**: the roadmap-regen convention; keep the skill repo-scoped.
- **Gotcha**: idempotent on plan slug (don't double-append if re-run).
- **Validate**: invoke the skill against a recent archived plan; confirm a well-formed pending entry lands + feed re-validates.

#### Task 5: WIRE the mechanism (convention + optional generic gate)
- **Do**: (a) Add a `CLAUDE.md` rule (sibling to "Site roadmap regen"): on `/flow:done`, run the `whats-new-entry` skill and include the `whats-new.json` + `site/lib/whats-new.json` diff in the feature commit. (b) In `plugins/flow/commands/done.md`, add an **optional, config-gated** soft-prompt after step 7 (retro/archive), before step 8 (report): if `integrations.whatsNew.enabled`, prompt to author a What's New entry — generic wording, no Maude specifics. (c) Extend `plugins/flow/.claude-plugin/config.schema.json` with `integrations.whatsNew` (`{ enabled, feed, skill? }`); set it in this repo's `.ai/workflows.config.json`.
- **Pattern**: DDR-066 soft-gate shape (handoff sweep) for the prompt.
- **Gotcha**: project-agnostic invariant — the flow plugin must not reference `plugins/design/dev-server/...`; the path comes from config. Skip silently when the knob is absent.
- **Validate**: `node cli/bin/maude.mjs config get integrations.whatsNew` (if exposed) / schema lints clean; done.md prompt only fires when enabled.

#### Task 6: ADD release-time version stamping + tests
- **Do**: `scripts/stamp-whats-new.mjs` (or generator `--stamp <version>` mode): rewrite all `version: null` entries to the released version + today's date. Call it from `scripts/bump-version.sh` (after the three manifest bumps) so a release resolves pending entries (DDR-C). Add `whats-new.test.ts` (bun:test): route returns feed; seen-util computes unseen set correctly across version boundaries; schema validates the committed feed.
- **Gotcha**: `bump-version.sh` is shell — invoke the node stamper; keep parity check (`scripts/check-version-parity.sh`) green.
- **Validate**: `pnpm test:dev-server`; dry-run a bump and confirm pending entries stamp.

### Phase 2 — Docs-site /whats-new page

#### Task 7: CREATE `build-whats-new.mjs` generator + wire it
- **Do**: Mirror `build-roadmap.mjs`: read `plugins/design/dev-server/whats-new.json`, validate against schema, write committed `site/lib/whats-new.json`. Add `gen:whatsnew` to `site/package.json` and into `prebuild` + `predev`. Add the regen to the `site-content` quality gate (and assert no committed drift).
- **Gotcha**: committed output (Vercel uploads only `site/`, can't see `plugins/...` reliably at deploy — same fallback rationale as roadmap.json).
- **Validate**: `pnpm --filter @maude/site gen:whatsnew` writes a committed JSON; `site-content` gate stays green after commit.

#### Task 8: CREATE the `/whats-new` page
- **Do**: `site/app/(home)/whats-new/page.tsx` + `site/components/mdcc/whats-new-feed.tsx` reading `site/lib/whats-new.json`, grouped by version (pending entries labeled "Coming next release"). Add a nav link.
- **Pattern**: `roadmap/page.tsx` + `roadmap-timeline.tsx`.
- **Validate**: `pnpm --filter @maude/site build` renders the page; spot-check.

### Phase 3 — Tour engine + spotlight + usage tour

#### Task 9: ADD `data-tour` anchors to shell elements
- **Do**: Add stable `data-tour="..."` attributes to the sidebar/file-tree, tabs, canvas viewport (Cmd+Click inspector), comments bar, export trigger, and Help — the anchors both tours target.
- **Validate**: anchors present in built DOM (agent-browser snapshot).

#### Task 10: CREATE hand-rolled `TourOverlay` engine
- **Do**: `client/tour/overlay.tsx` — backdrop with a cutout highlight around the target (`getBoundingClientRect`), tooltip card (Next/Back/Skip + step counter), keyboard (`Esc` skip, `→`/`←`), `role="dialog"` + focus trap + focus restore, `prefers-reduced-motion` (no transitions). Resolve a step's target by `data-tour` key or CSS selector; skip steps whose target is absent.
- **Gotcha**: a11y is the hard part — trap focus, restore on close, announce step changes. Reduced-motion must fully disable cutout/tooltip animation.
- **Validate**: bun:test for the step-resolver; agent-browser keyboard walk-through.

#### Task 11: WIRE spotlight tours
- **Do**: `WhatsNewPanel`/`WhatsNewToast` `Take tour` button → launch `TourOverlay` with `entry.tour[]`. Mark entry seen on completion.
- **Validate**: a seeded entry with `tour[]` runs end-to-end via agent-browser.

#### Task 12: ADD evergreen usage tour
- **Do**: `client/tour/usage-tour.ts` — ~6 steps (sidebar canvases → tabs → canvas + Cmd+Click inspector → comments → export ⌘E → Help). First-run trigger: `localStorage['mdcc-usage-tour-seen']` absent → one-time "Take the 60-sec tour?" nudge. Add "Start tour" to `HelpModal`/Help menu (always re-runnable).
- **Gotcha**: first-run nudge must not fight the What's New toast — show at most one at a time (usage tour wins on true first run; What's New on subsequent version bumps).
- **Validate**: rebuild + commit bundle; agent-browser first-run + Help re-run.

---

## Validation

1. **Tests**: `pnpm test:dev-server` (route + seen-util + tour-resolver + schema) and `pnpm test`.
2. **Build**: `pnpm --filter @maude/site build` (exercises `build-whats-new.mjs`).
3. **Committed bundle**: rebuild `cd plugins/design/dev-server && bun run build.ts`; confirm `dist/client.bundle.js` + `dist/styles.css` are committed (stale bundle = shipped-broken UI, per the motion-bundle precedent).
4. **Quality gates** (`config.quality`): `lint`, `format`, `parity`, `tarball` (feed ships), `site-content` (now includes `gen:whatsnew`, no drift).
5. **Maude-UI scenario (agent-browser, not scenario-runner)**: the Maude UI is the dev-server's *own* web client (not a canvas), so drive it with `flow:agent-browser` against a running dev-server: (a) unseen version → badge + toast appear; (b) dismiss persists across reload; (c) `Take tour` runs a spotlight; (d) first-run usage tour fires once. Capture screenshots.
6. **A11y** (`a11y-auditor` / `flow:a11y-rules`): toast `role="status"`/`aria-live`; tour `role="dialog"` + focus trap + `Esc` + focus restore; `prefers-reduced-motion` disables all motion; badge is a real button with an accessible name.
7. **Manual**: downstream-repo behavior — the dev-server in a *user* project shows Maude product news; verify `MAUDE_NO_WHATSNEW=1` opt-out (DDR-E) and unobtrusiveness.

---

## Scenario Coverage (UI — required)

The standard 5-platform `scenario-runner` targets *canvases*, which doesn't fit the dev-server's own chrome. Use a **web-desktop agent-browser scenario** instead, stored under `.ai/scenarios/`:

| Scenario | Covers | Status |
| -------- | ------ | ------ |
| `maude-ui-whats-new` | badge/toast on unseen version, dismissal persistence, panel `Learn more`, spotlight + usage tour | 🆕 new |

Note in the PR description why `scenario-runner`'s canvas focus is bypassed for this surface (DDR-worthy if a reviewer pushes back).

---

## Acceptance Criteria

- [ ] All tasks completed (Phase 1 independently usable)
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop)
- [ ] `/validate` passes overall:
  - [ ] Static (lint, format) + dev-server tests + site build
  - [ ] Committed `dist/client.bundle.js` + `dist/styles.css` rebuilt & in the commit
  - [ ] `parity`, `tarball`, `site-content` gates green (feed ships; no site drift)
  - [ ] agent-browser Maude-UI scenario: badge/toast/dismiss/tour all PASS
  - [ ] `a11y-auditor`: 0 blockers (toast live-region; tour dialog/focus/reduced-motion)
- [ ] `whats-new-entry` skill appends a valid pending entry from a real archived plan
- [ ] CLAUDE.md convention + optional generic flow gate documented; flow plugin carries **no** Maude-specific paths
- [ ] DDR-A..E recorded (or consciously deferred)
- [ ] Code follows project conventions, no regressions
```

---

## Retro

Shipped all 3 phases on `feat/in-app-whats-new-tour` (commits `155df68`, `1006d78`, `46f207e`, hardening `a44acbe`). DDR-086 (feed architecture) + DDR-087 (zero-dep tour) recorded; DDR-A..E folded into those two. DDR-E (downstream `MAUDE_NO_WHATSNEW` opt-out) consciously **not** implemented (benign, dismissible news).

- **Sequencing into a shippable floor worked.** Phase 1 (feed + banner + mechanism) verified + committed standalone before Phase 2/3 — each phase was independently live-verifiable, and the user could have stopped after any. Good model for multi-surface features.
- **The user's "internal skill" steer resolved the project-agnostic tension cleanly.** Putting the authoring logic in `.claude/skills/whats-new-entry/` + a generic config-gated `/flow:done` prompt kept `plugins/flow/` Maude-free. Worth reusing whenever a generic-plugin step needs project-specific behavior.
- **The security fan-out earned its keep.** 0 blockers, but the ethical-hacker's creativity finding (package-root feed resolution is the load-bearing boundary; a future "project-overridable feed" would silently open a main-origin injection lane) became a real regression test + an explicit DDR clause. The `learnMore` scheme + build-time validation were cheap closes.
- **Footgun that cost the most time:** booting the source dev-server OR running `test:dev-server` self-heals the committed `dist/client.bundle.js` to a 3.6 MB unminified dev build — bit me ~4× (revert `dist/runtime/`+`comment-mount`, rebuild `--release`). Now documented in CLAUDE.md, but a pre-commit guard (assert `client.bundle.js` is minified / under a size floor, like `check-runtime-bundles.sh` does for runtime) would prevent it structurally. **Improvement for `/execute`:** after any dev-server server-boot/test, run `git status` on `dist/` and rebuild release before proceeding.
- **Scenario shape mismatch:** the standard 5-platform `scenario-runner` targets canvases, not the dev-server's own chrome. Used a web-desktop agent-browser pass instead. `/flow:plan` + `/done` should keep treating "is this a canvas or app-chrome surface?" as a branch — the canvas scenario harness doesn't fit chrome features.
