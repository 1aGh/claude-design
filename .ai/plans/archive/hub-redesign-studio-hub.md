# Feature: Hub admin redesign — maude-DS reskin + additive operator console ("Studio Hub")

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This plan reskins + extends the EXISTING hub admin SPA — it does not build a new app.** The native-collab app surfaces (landing, onboarding, identity, presence map) are deliberately OUT of scope and routed to phases 28–32 (see § Compatibility).

## Description

Re-skin the self-hostable hub's built-in admin console (`plugins/design/hub/src/admin/`) from the **MDCC/project** design language to the **maude** DS ("Unified Pro Studio"), and fill the three real gaps the current 4-card dashboard has: a **canvases/documents browser**, an **activity feed**, and a **settings** surface. The design reference is the already-built `.design/ui/Studio Hub.tsx` canvas (7 artboards, maude DS).

This is the **second** redesign of this UI. The first (`hub-admin-redesign.md`, shipped v0.18.0, commit `02e890f`) moved it from generic plain-CSS to MDCC. This one moves MDCC → maude so the hub admin matches the **future native app** (phases 26–32 are all maude-DS), and adds the operator surfaces a deployed hub actually needs.

## User Story

As a **hub operator** I want a console that shows me what's synced, what's happening live, and lets me manage tokens + settings — in the same visual language as the Maude app — so that running a self-hosted hub feels like a first-class part of Maude, not a bolted-on admin panel.

## Problem

1. The current admin (MDCC dark, 4-card dashboard) is visually divergent from where the product is going — phases 26–32 (native collab app) are all built in the **maude** DS. Two design languages for one product.
2. **Operators are blind to what's synced.** No way to see which canvases/documents exist on the hub, their size, or last activity without poking SQLite directly (the #1 gap in the v1.2 backlog analysis).
3. **No activity feed.** Status is a one-shot poll; there's no "Alice joined", "token rotated", "bob edited docs-site" log.
4. **No settings surface.** Hub name, public URL, transport, storage, and the admin-secret kill-switch aren't visible/manageable in the UI.

## Solution

A focused, roadmap-aligned slice:

1. **Reskin** `src/admin/{index.html,style.css,app.js}` to the **maude** DS, adopting the **sidebar-nav app-shell** from the Studio Hub canvas (Overview · Peers · Tokens · Canvases · Activity · Settings) — which conveniently gives the three new surfaces a home. Preserve every JS-referenced ID and the full DDR-053/054/056 security model.
2. **Add the three additive surfaces** (Canvases browser, Activity feed, Settings) with the minimal new API routes to back them.
3. **Stay a standalone vanilla-JS SPA** bundled into the hub binary — NOT a canvas-lib React canvas. Port the maude tokens + component classes into `style.css` as plain CSS (the same technique the MDCC redesign used). Respect the bundle-size gate.
4. **Route the deferred surfaces** (landing/download, onboarding wizard, GitHub identity, presence map, artboard-lock overlay) as **design-reference pointers** into phases 28/29/30/32 — do NOT implement them here.

## Metadata

- **Ticket**: — (tracker provider `none` in this repo)
- **Type**: Enhancement + Refactor (reskin)
- **Complexity**: Medium-High (cross-cutting: hub server routes + admin SPA + tests + design-ref routing; bundle-size constrained)
- **App/Package**: `plugins/design/hub` (+ design-reference edits in `.ai/plans/phase-28..32`)
- **Affected Systems**: hub admin SPA, hub server API (`/admin/api/*`), hub test suite, bundle pipeline (`dist/admin/` mirror), the native-collab phase plans (design-ref cross-links)
- **Dependencies**: none new (no new npm deps; the maude DS port is plain CSS)

---

## Compatibility analysis — how the "Studio Hub" ideas map onto what we have + what we're planning

> This is the section the request was really about. The Studio Hub canvas surfaced ~7 artboards of ideas. They split into three buckets against the roadmap.

**What we already have:** the hub (Phase 9, shipped + archived) — a **Hocuspocus + Yjs + SQLite** sync server (Node-only, DDR-052) with a vanilla-JS admin SPA, already redesigned once to MDCC (`hub-admin-redesign.md`, v0.18.0). Auth = `HUB_SECRET` bootstrap + scope-bound `mau_` tokens + rotate-as-kill-switch, hardened per DDR-053.

**What we're planning:** the **native-collab app** (phases 26–32, maude DS) — a Tauri desktop shell + in-UI git (phase 27) + **GitHub OAuth identity** (phase 28) + **GitHub-first onboarding** (phase 29) + **live multiplayer / artboard locking** (phase 30) + ACP sidepanel (31) + signed-installer distribution (32). **The hub is KEPT but REPOSITIONED:** git owns canvas *distribution*; the hub owns live *co-edit + presence* (Yjs awareness, comments, annotations, cursors, agent presence). Identity moves to GitHub; **hub-token auth is demoted to phase-29's "advanced door (c)".** Phase 30 explicitly mandates a **"hub admin realignment"** — "rework the hub admin (`Sync Hub Admin` canvas + `src/admin/`) to present ONE repo/branch context, not a multiplexed directory of many repos. Remove the flat global document list view."

### Bucket A — Compatible & in-scope for THIS plan (hub admin)

| Studio Hub idea | Disposition | Notes |
| --- | --- | --- |
| maude-DS reskin of the admin chrome | ✅ **Build now** | MDCC → maude; matches the future native app. |
| Sidebar-nav app-shell (Overview/Peers/Tokens/Canvases/Activity/Settings) | ✅ **Build now** | Replaces the 4-card grid; hosts the new surfaces. |
| **Canvases / documents browser** | ✅ **Build now** | The #1 gap. New `GET /admin/api/canvases` over the Hocuspocus SQLite `documents` table. |
| **Activity feed** | ✅ **Build now** | Net-new (no `audit.log` exists today). In-memory ring buffer + `GET /admin/api/activity`. |
| **Settings surface** (name, public URL, transport, storage, danger zone) | ✅ **Build now** | Mostly read + the admin-secret rotate kill-switch. |
| Tokens table + scope chips + rotate-as-kill-switch confirm | ✅ **Reskin only** | Already shipped; just re-dress in maude. |
| Peers table | ✅ **Reskin only** | Keep the diagnostic peers view (reskinned). Full repo/branch realignment = phase-30. |

### Bucket B — Belongs in the NATIVE APP — deferred to phases 28–32 (route as design reference, do NOT build here)

| Studio Hub idea | Lands in | Why not the hub admin |
| --- | --- | --- |
| **Landing / "what Studio Hub is" splash** + deploy CTA | Phase 32 (`/desktop` download page) + docs site (`site/content/docs/hub/`) | A self-hosted operator console shouldn't be a marketing surface; the product landing is the native-app download page. |
| **First-run onboarding wizard** (claim → identity → TLS → first invite) | Phase 29 (GitHub-first onboarding) | Phase 29 makes **GitHub OAuth the headline**; the hub bootstrap-key claim is the **"advanced door (c)"**. A bootstrap-key-first wizard would directly contradict the planned IA + the vocabulary contract. The hub admin keeps its minimal claim screen (already shipped). |
| **Sign-in / identity (HUB_SECRET paste)** | Phase 28 (GitHub identity) | Native app authenticates via GitHub device flow → keychain. HUB_SECRET stays the hub-operator credential only. |
| **Presence map** (canvas nodes + peer avatars + **AI-agent cursor**) | Phase 30 (live multiplayer, native canvas UI) | Presence/cursors/agent-presence/artboard-lock overlays live in the native app's canvas, not the operator console. The hub admin shows a flat diagnostic peers table only. |

> **Routing action (Task 9):** add a one-line "Design reference: `.design/ui/Studio Hub.tsx` → artboard `<id>`" pointer to each of phases 28/29/30/32 so the future implementer inherits the mockup instead of re-deriving it. The Studio Hub canvas is, in effect, a **maude-DS design reference for the native app's collab surfaces** — more useful there than as a hub-admin spec.

### Bucket C — Decisions to record (DDR candidates)

| Decision | Lean (from this request) | Record as |
| --- | --- | --- |
| **Branding** — is the hub console "Studio Hub", "Maude Hub", or just the hub admin? Introduces a name alongside "Maude" (native app) + "maude hub" (infra). | "**Studio Hub**" as the operator-console product name (user-chosen). Flag coherence w/ "Maude". | DDR (new) |
| **DS migration** — hub admin moves MDCC → maude. | **Yes** (confirmed). Supersedes the MDCC redesign's visual layer; keeps its structure + security. | DDR (new) — supersedes `hub-admin-redesign.md`'s DS choice |
| **Bundle ceiling** — current 15 KB gz hard cap (8.7 KB used). Reskin + 3 surfaces will grow it. | Measure; bump the ceiling if the additive surfaces justify it (e.g. 22–25 KB gz) — record the new number + rationale. | DDR (new) or amend `admin-size.test.mjs` comment |
| **Peers IA** — flat doc list now vs phase-30 repo/branch realignment. | Flat is acceptable v1 (repo/branch IA depends on phase-27 git layer); leave a seam, don't pre-build. | Note in plan; phase-30 owns the realignment |

---

## Context References

### Must-Read Files

> Read these in parallel during `/flow:execute`.

- `plugins/design/hub/src/admin/index.html` — current SPA structure + all JS-referenced IDs that MUST be preserved.
- `plugins/design/hub/src/admin/style.css` (esp. lines 1–20) — current MDCC token scoping (`:root, .mdcc`); the `<dialog>` top-layer token-scoping gotcha is documented here and MUST carry over.
- `plugins/design/hub/src/admin/app.js` — the fetch/render logic; route names, ID lookups, the 5s peer poll, the token modal.
- `plugins/design/hub/src/server.mjs` — the `/admin/api/*` route table + the Hocuspocus `onAuthenticate`/`onConnect`/`onDisconnect` hooks (where activity events originate + where the `peers` Map lives).
- `plugins/design/hub/src/admin-assets.mjs` — how the admin shell/CSS/JS get bundled inline into the binary (the new surfaces must flow through here).
- `plugins/design/hub/src/admin-auth.mjs` — the Bearer/bootstrap/rate-limit auth (must stay untouched by the reskin).
- `plugins/design/hub/test/{admin-size,admin-static,admin-api,admin-hardening}.test.mjs` — the gates the redesign must keep green.
- `.design/ui/Studio Hub.tsx` + `.design/ui/Studio Hub.css` — the maude-DS design reference (chrome, sidebar nav, tables, callouts, presence chips).
- `.design/system/maude/colors_and_type.css` — the maude token values (oklch) to inline into `style.css`.
- `.design/system/maude/preview/_components.css` — the maude component anatomy (`.btn`, `.panel`, `.toolbar`, `.tree-row`, `.callout`, `.presence-dot`, `.seg`, `.tab`, `.field`, `.input`, `.kbd`) to port as plain CSS.

### Files to Create

- (none net-new files in `src/`) — all changes UPDATE existing `src/admin/*` + `src/server.mjs`. New tests may be added under `plugins/design/hub/test/`.
- DDR file(s) under `.ai/archive/decisions/DDR-0XX-hub-admin-maude-reskin.md` (Task 1). → **Recorded: [DDR-097](../decisions/DDR-097-hub-admin-maude-reskin-and-operator-surfaces.md)** (MDCC→maude DS migration · "Studio Hub" branding · bundle ceiling 15→28 KB gz).

### Design canvases

| Canvas | Status | Design system | Notes |
| ------ | ------ | ------------- | ----- |
| `.design/ui/Studio Hub.tsx` | new (2026-06-05), aspiration 4.4/5 | **maude** | The maude-DS reference. **In-scope artboards:** C (dashboard/overview app-shell), D (peers table — flat diagnostic part only, NOT the presence map), E (tokens + rotate kill-switch + generate-invite), G (states + **settings**). **Out-of-scope artboards (→ phases):** A (landing→32), B (onboarding→29), D presence-map (→30), G sign-in (→28). |
| `.design/ui/Sync Hub Admin.tsx` | prior MDCC mock | project (MDCC) | The shipped design's source-of-truth; shows the IDs/flows to preserve. |

### Documentation / source-of-truth plans

- `.ai/plans/archive/hub-admin-redesign.md` — the FIRST redesign (MDCC). This plan supersedes its DS layer; mirror its discipline (preserve IDs, bundle gate, `dist/admin/` mirror).
- `.ai/plans/archive/phase-9-self-hosted-hub-file-sync.md` — hub origin + v1.2 backlog (the gaps this plan fills).
- `.ai/plans/phase-30-native-collab-live-multiplayer.md` — owns the "hub admin realignment" (repo/branch context). **This plan must not pre-empt it** — leave the peers/canvases IA flat with a seam.
- `.ai/plans/phase-29-native-collab-onboarding.md` / `phase-28-native-collab-github-identity.md` / `phase-32-native-collab-distribution.md` — receive the deferred Studio Hub surfaces as design refs (Task 9).
- DDR-053 (admin auth), DDR-054 (hub = untrusted-to-peers trust model + frozen lockfile), DDR-056 (gitignore) — security invariants the reskin MUST preserve.

### Patterns to Follow

- **Plain-CSS DS port** — the MDCC redesign inlined token VALUES + ported `_components.css` class anatomy into `src/admin/style.css` (no `var()` indirection to a missing tokens file; the values are literal). Mirror that: copy the maude dark-block oklch values + the maude component classes verbatim into the new `style.css`. Dark-only (the hub is always dark).
- **Preserve JS-referenced IDs** — `app.js` looks up `invite-form`, `bootstrap-form`, `auth-state`, `token-modal`, etc. by ID. The reskin changes classes/structure but every ID `app.js` reads MUST survive (this was the prior redesign's Task 3 constraint).
- **No emoji in chrome / thin-stroke SVG icons** — the maude DS bans emoji; the sidebar nav + buttons use 1.4-stroke inline SVG glyphs (the Studio Hub canvas ICONS set is the reference; inline them as small SVG strings, mindful of bundle size).
- **Read-only over the Hocuspocus SQLite extension** — the canvases browser queries the extension's `documents` table read-only (confirm column names — `name`, `data`, timestamps — at execution; the `@hocuspocus/extension-sqlite` schema owns it). Compute byte-size from the blob length; join live peer count from the in-memory `peers` Map.

---

## Design Decisions

### Components (ported from the maude DS, as plain CSS)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `.btn` (+ `--primary/--ghost/--danger/--sm`) | `system/maude/preview/_components.css` | Port literal. |
| `.panel` / `.panel-hd` / `.panel-bd` | maude `_components.css` | The one-material card. |
| `.tree-row`, `.tab/.tabbar`, `.seg`, `.field`, `.input`, `.kbd`, `.callout`, `.presence-dot`, `.chip/.tag` | maude `_components.css` | Port literal. |
| sidebar nav (`.sh-nav*`), stat row, tables (`.sh-tbl`), KV (`.sh-kv`), activity feed (`.sh-feed*`), scope chips (`.sh-scope*`), settings rows (`.sh-set*`) | `.design/ui/Studio Hub.css` | The canvas-local chrome; rename `sh-` → hub-admin prefix or keep, but inline as plain CSS. |

### Existing screens reused

| Screen | Source | Notes |
| ------ | ------ | ----- |
| Sign-in / bootstrap claim | current `src/admin/` | Reskin only — keep the minimal claim (native-app onboarding is phase 29). |
| Token modal | current `src/admin/` | Reskin to the maude `.sh-issued*` credential-reveal. |

### Tokens

| Purpose | maude token | Note |
| ------- | ----------- | ---- |
| Panel/canvas/elevation bg | `--bg-0..4` (oklch hue 255) | inline literal values (dark block). |
| Text | `--fg-0..2` (AVOID `--fg-3` for real text — a11y; the canvas had this fixed) | `--fg-3` is disabled-tier only. |
| Accent (one job per surface) | `--accent` indigo + `--accent-fg`/`--accent-tint`/`--accent-muted` | primary action / active nav only. |
| Status / presence | `--status-*` / `--presence-*` | peer swatches = data, token-pure. |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| Canvases browser table | net-new surface | `.sh-tbl` + a size/last-edited/peer-count row |
| Activity feed | net-new surface | `.sh-feed*` (ring-buffer-backed) |
| Settings panel + danger zone | net-new surface | `.sh-set*` + `.btn--danger` |

---

## Tasks

Execute in order. Each task is atomic and testable. **No code in planning — this is the execution roadmap.**

### Task 1: RECORD decisions (DDRs)

- **Do**: Write a DDR for (a) hub admin DS migration MDCC → maude (supersedes `hub-admin-redesign.md`'s DS layer), (b) branding "Studio Hub" as the operator-console name (note coherence w/ "Maude"), (c) bundle-ceiling outcome (decide final gz cap). Cross-link DDR-053/054/056 as preserved invariants.
- **Pattern**: existing `.ai/archive/decisions/DDR-0XX-*.md` format.
- **Validate**: DDR file(s) exist + linked from this plan.

### Task 2: PORT maude tokens + component anatomy into `src/admin/style.css`

- **Do**: Replace the MDCC token block + component classes with the maude dark-block oklch values + maude `_components.css` anatomy (literal values, dark-only). Keep the `:root, .mdcc`-style scoping fix for the `<dialog>` top-layer (rename the root class, e.g. `.maude`, applied on both `.hub-frame` and the dialog). Reference: `Studio Hub.css`.
- **Gotcha**: the token-issued `<dialog>` renders in the top layer as a sibling — tokens MUST be on a selector both it and the frame match (documented in the current style.css header). Carry this over.
- **Validate**: visual diff against Studio Hub canvas artboards C/E/G; `admin-static.test.mjs` still green.

### Task 3: UPDATE `src/admin/index.html` to the maude sidebar-nav app-shell

- **Do**: Restructure to the Studio Hub app-shell — left sidebar nav (Overview · Peers · Tokens · Canvases · Activity · Settings) + top bar (hub identity · live · search · Generate invite) + content sections. **Preserve every ID `app.js` reads.** Keep the dotted-canvas backdrop (a maude signature) behind content.
- **Pattern**: `Studio Hub.tsx` artboard C (dashboard) structure.
- **Gotcha**: bundle size — inline SVG icons are the heaviest add; keep the glyph set minimal (6 nav + ~8 action icons), reuse one `<svg>` symbol-sprite or compact path strings.
- **Validate**: `admin-static.test.mjs` (all IDs present); manual browser load of `/admin`.

### Task 4: ADD canvases browser — `GET /admin/api/canvases` + UI

- **Do**: Add a Bearer-gated route that reads the Hocuspocus SQLite `documents` table read-only (slug/name, byte-size from blob length, last-modified), joins the live peer count from the `peers` Map, returns JSON. Render the Canvases section table (Canvas · Size · Last edited · Peers). Empty state = the maude `.sh-empty`.
- **Pattern**: existing `GET /admin/api/peers` route shape + the `.sh-tbl` table.
- **Gotcha**: confirm the extension's table/column names at execution (don't assume); read-only, never mutate. Flat list now — repo/branch grouping is phase-30's realignment (leave a seam).
- **Validate**: new `admin-api.test.mjs` case (route returns the synced-doc list, Bearer-gated → 401 without).

### Task 5: ADD activity feed — in-memory ring buffer + `GET /admin/api/activity` + UI

- **Do**: Add a bounded in-memory ring buffer in `server.mjs` (no `audit.log` exists today — net-new). Push events on connect/disconnect (peer joined/left), token generate/rotate (incl. sessions kicked). Expose a Bearer-gated `GET /admin/api/activity` (recent N). Render the Activity section (`.sh-feed*`, dot color by event type).
- **Pattern**: the `peers` Map lifecycle hooks in `server.mjs`; the `.sh-feed` markup in `Studio Hub.css`.
- **Gotcha**: ephemeral (lost on restart) is acceptable v1 — document it; optional persistence is backlog. Don't log token VALUES (only labels). Cap the ring (e.g. 200) so memory is bounded.
- **Validate**: new test — fire a connect + a rotate, assert the activity route reflects both with no secrets.

### Task 6: ADD settings surface — `GET/POST /admin/api/settings` + danger zone

- **Do**: Settings section: hub name + description (editable → `POST /admin/api/settings`, persisted to a small JSON file beside `admin.json`), public URL + transport (TLS provider) + storage (data dir + size) READ from existing identity/status, and a **danger zone**: "Rotate admin secret" (signs every device out). Wire the rotate-admin to a new gated route OR mark it CLI-only-for-now with a disabled affordance + hint (decide in Task 1).
- **Pattern**: existing `GET /admin/api/status` + `/identity`; the `.sh-set*` + `.btn--danger` markup.
- **Gotcha**: settings writes must be atomic (tmp + rename, mode 0600) like `admin.json` (DDR-053). Validate inputs (name `^[A-Za-z0-9 _.\-]{1,64}$`). Rotate-admin must invalidate the stored secret + force re-bootstrap/HUB_SECRET — high blast radius; gate carefully or defer the ACTION (keep the UI).
- **Validate**: new test — settings round-trips; input validation rejects bad names; rotate-admin (if built) invalidates.

### Task 7: MEASURE + gate bundle size

- **Do**: Run `admin-size.test.mjs`. If over 15 KB gz, trim (compact SVG, dedupe CSS) or bump the ceiling per Task 1's decision (update `BUDGET_BYTES` + the comment with the rationale).
- **Validate**: `bun test test/admin-size.test.mjs` green at the agreed ceiling.

### Task 8: TESTS — extend the admin suite

- **Do**: Extend `admin-static.test.mjs` (new section IDs), `admin-api.test.mjs` (canvases/activity/settings routes + Bearer gating + no-secret-leak), `admin-hardening.test.mjs` (the new routes honor rate-limit + Bearer). Keep `admin-size` green.
- **Validate**: `cd plugins/design/hub && bun test` — all green.

### Task 9: ROUTE deferred surfaces to phases 28/29/30/32 (design-reference cross-links)

> **Context (verified):** phases 28/29/30 ALREADY have a `### Design canvases` section + tasks that say "run `/design:new` to CREATE fresh mockups" (`GitHubIdentity`/`CreateProject`, `Onboarding`/`RepoBranchSwitcher`, `ArtboardLock`). They do NOT yet know Studio Hub exists, and phase-30 still points at the OLD MDCC `.design/ui/Sync Hub Admin.tsx` as its realignment starting point. So this task isn't adding a missing convention — it's **cross-linking Studio Hub INTO those existing sections** so the implementer lifts from the finished maude-DS draft instead of re-deriving, and **fixing phase-30's stale pointer**.

- **Do**: Add a "Reference (lift, don't re-derive): `.design/ui/Studio Hub.tsx` → artboard `<id>` (`<what it shows>`, maude DS)" row to each phase's existing `### Design canvases` table:
  - **phase-28** → artboard G (sign-in / identity card) as a maude reference for `GitHubIdentity.tsx`.
  - **phase-29** → artboard B (onboarding wizard chrome + **step-rail**) — **chrome/layout reference ONLY**; flag that the **door order must stay GitHub-first** (Studio Hub makes bootstrap-key the headline; phase-29 demotes it to advanced door (c)). Not a drop-in.
  - **phase-30** → artboard D (presence map + AI-agent cursor) for `ArtboardLock.tsx`/presence; **update the existing `Sync Hub Admin.tsx` pointer → `Studio Hub.tsx`** (newer, maude DS, the realignment target's actual visual language). Also note: the hub-admin realignment (Task 4's flat canvases list → repo/branch IA) is phase-30's, and Studio Hub artboards C/D are the maude reference for it.
  - **phase-32** → artboard A (landing) as a reference for the `/desktop` download page IA (NOT a 1:1 — that page markets the native app, not a self-hosted hub).
- **Gotcha**: do NOT implement any of these surfaces here, and do NOT delete the phases' own `/design:new` tasks — Studio Hub is a *reference to lift from*, the phases may still iterate fresh mockups (esp. phase-29 which mandates ≥4.5/5 and a different door order).
- **Validate**: each phase plan's `Design canvases` section cites Studio Hub with the lift/don't-re-derive framing; phase-30's stale `Sync Hub Admin` pointer updated; no code change.

### Task 10: MIRROR `src/admin/` → `dist/admin/` + rebuild hub bundle

- **Do**: Re-run the admin bundling (`admin-assets.mjs` flow) so the inline strings update; mirror `src/admin/` → `dist/admin/` (the prior redesign's Task 7); rebuild `dist/hub.bundle.mjs`; verify the served `/admin` reflects the reskin.
- **Validate**: boot `maude hub serve --dev`, load `/admin`, confirm maude reskin + all 4 sections render + the security tests pass.

---

## Validation

Run from `plugins/design/hub`:

1. **Hub test suite**: `cd plugins/design/hub && bun test` (admin-size, admin-static, admin-api, admin-hardening, auth-hardening, bootstrap, rate-limit, health, scope, two-client-sync, rotate-kicks, stress-integration) — all green.
2. **Bundle gate**: `bun test test/admin-size.test.mjs` — gz under the agreed ceiling.
3. **Lint/format (repo)**: `pnpm lint` (biome) on changed files.
4. **Types**: `pnpm typecheck` (DDR-026 baseline only; the hub is `.mjs` so mostly N/A).
5. **Manual / live**: `maude hub serve --dev` → load `/admin` in agent-browser → verify: sign-in + bootstrap claim render in maude; dashboard 4 sections (Overview/Peers/Tokens + Canvases/Activity/Settings); token generate → modal; canvases list reflects a synced doc; activity shows a join + rotate; settings round-trip. Bearer-gating: every new `/admin/api/*` 401s without the header.
6. **Security re-check**: spawn `security-auditor` — confirm the new routes preserve Bearer-only + rate-limit + no-secret-leak + input validation (DDR-053); no new outbound fetch (CSP `connect-src 'self'`).
7. **A11y**: the admin is dark-only desktop — verify contrast (no `--fg-3` on real text — the canvas fixed this), focus rings, dialog `aria-modal` + `inert` backdrop, table captions.

> No cross-platform `scenario-runner` (the hub admin is a desktop-only operator console, not a multi-platform app surface) — note the intentional divergence.

---

## Acceptance Criteria

- [x] All 10 tasks completed.
- [x] `cd apps/hub && node --test test/*.test.mjs` green — **112/112** (incl. the extended admin suite; the hub uses `node --test`, not `bun test`; path moved to `apps/hub` per DDR-095).
- [x] Bundle gz under the agreed ceiling — **17.4 KB gz < 28 KB** (ceiling bumped 15→28, recorded in DDR-097 + `admin-size.test.mjs` comment).
- [x] maude reskin matches Studio Hub artboards C/E/G; sign-in + bootstrap reskinned; token modal = maude credential-reveal (live agent-browser verified — sign-in, overview, tokens, token modal, canvases, activity, settings all maude).
- [x] Canvases browser + Activity feed + Settings render and are Bearer-gated; no secret leaks in any new route (security-auditor confirmed).
- [x] Every JS-referenced ID preserved; all DDR-053/054/056 invariants intact (`security-auditor`: **0 blockers, 0 warnings ≥ medium**).
- [x] `dist/admin/` mirrored + `dist/hub.bundle.mjs` rebuilt (365 KB; `dist/` is gitignored — CI rebuilds on release).
- [x] Deferred surfaces cross-linked into phases 28/29/30/32 (design refs) — and NOT implemented here.
- [x] DDRs recorded — [DDR-097](../decisions/DDR-097-hub-admin-maude-reskin-and-operator-surfaces.md) (DS migration + branding + bundle ceiling).
- [ ] STATE.md history row + `pnpm --filter @maude/site gen:roadmap` — deferred to `/flow:done` (no plan archived yet; the plan archives at close-out).

---

## Risks

1. **Bundle ceiling (15 KB gz, 43% headroom today).** Reskin + 3 surfaces + inline SVG icons will eat it fast. Mitigation: compact SVGs, dedupe CSS, and a Task-1 decision to bump the cap with rationale. **Highest-likelihood friction.**
2. **Pre-empting phase-30's hub-admin realignment.** Building a flat canvases/peers list that phase-30 then has to re-IA to repo/branch context = rework. Mitigation: flat is explicitly a v1 seam; keep the data shape route-driven so the realignment is a UI regroup, not a rewrite.
3. **Activity feed has no existing source.** No `audit.log` today — it's net-new in-memory (lost on restart). Acceptable v1, but don't oversell it as an audit trail (that's a separate, persisted concern).
4. **Reskinning an already-shipped UI = double work** if the project pivots the hub admin again under phase-30. Mitigation: this reskin is explicitly the maude-DS foundation phase-30's realignment will build on (same DS), so it's not throwaway.
5. **Branding "Studio Hub" vs "Maude".** A third name could confuse. Mitigation: Task-1 DDR makes the call explicit; lean to "Studio Hub" per the request but document the relationship to the native "Maude" app.
6. **Hocuspocus SQLite schema coupling.** The canvases browser reads the extension's table directly — a future Hocuspocus upgrade could change columns. Mitigation: read-only, defensive column probing, isolated in one helper.

---

## Confidence

**7/10** for one-pass implementation. The reskin (Tasks 2–3) and the additive surfaces (Tasks 4–6) are well-grounded — the design reference exists (Studio Hub canvas), the prior MDCC redesign is a proven template, and the API patterns are established. The two soft spots: the **bundle-size budget** (may force a mid-task decision + trimming) and the **Hocuspocus SQLite column probing** for the canvases browser (needs a quick execution-time confirmation). The native-app surfaces being explicitly deferred removes the biggest scope risk.

---

## Retro

- **What worked.** Lifting faithfully from `.design/ui/Studio Hub.tsx` (+ the real `/design:handoff` → `Studio Hub.registry.json`) made the reskin + operator surfaces match the design closely on the first pass. **Live agent-browser verification after each slice** (standing `feedback_no_break_exhaustive_verify`) earned its keep — it caught real bugs that "build green" hid: the empty-state collapse, the CSP-dropped inline styles, the uncolored avatars, the cramped mobile appbar.
- **The CSP-vs-inline-style trap (biggest surprise).** The admin serves `style-src 'self'` (DDR-053), which **silently drops every inline `style="…"` attribute** — that was the root cause of the "rozhozený spacing" (quick-actions buttons wrapping, lost gaps) AND the uncolored avatars, not a layout mistake. Lesson for `/plan`: on any CSP-hardened surface, forbid inline styles from the start — all layout/colour goes through classes. Added utility classes (`.stack`, `.btn--block`, `.avatar--N`, …) as the fix.
- **Class-name collisions.** `.empty` (empty-state card) collided with `<tr class="empty">` table rows → `display:flex` hijacked the row → `colspan` ignored → empty states crammed off-centre. Namespaced to `.empty-state*`. Lesson: don't reuse a component class as a row/state class.
- **Scope was the one un-validated untrusted string.** The close-out ethical-hacker pass found token `scope` reached the admin DOM with only client-side escaping (single layer) while everything else used source-regex + escape (two layers). Fixed at source (`assertValidScope`) + `listCanvases` name filter — restoring the two-layer invariant on a DDR-054 component. Lesson: when a field flows to both `matchesScope` (auth) AND the DOM, validate it at the source like labels.
- **Scope grew (consciously).** Beyond the original 10 tasks, the user requested operator surfaces the plan hadn't scoped — per-peer **kick**, token **delete**, **Sessions** column, the Overview peers+activity widgets, a `/` **landing** (replacing "Welcome to Hocuspocus!"), and the canonical spark-bubble **logo/favicon**. Presence map / onboarding wizard / full marketing landing stayed deferred (phases 28–32) per an explicit scope decision. A standalone **playground** (`apps/hub/playground/` + `~/git/playground`) was added for turnkey local Docker testing.
- **Tooling friction.** agent-browser attaches to a shared browser instance — its commands raced with the user's running studio tab (port 4555), causing spurious logouts; fixed by an isolated `--session`. Worth knowing for future live-verify work.
- **Follow-up (non-blocking, from the security pass).** The public `GET /` landing does a per-request `readFileSync` + render with no rate limit and `no-store` (defeats CDN). Low-severity DoS amplifier — memo-cache the rendered landing (invalidate on settings write) + allow CDN caching when convenient.
