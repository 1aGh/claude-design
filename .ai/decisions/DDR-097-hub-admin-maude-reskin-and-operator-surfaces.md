# DDR-097: Hub admin reskinned MDCC → maude ("Studio Hub") + additive operator surfaces

- **Date:** 2026-06-07
- **Status:** Accepted (implemented — `feature-hub-redesign-studio-hub.md` Tasks 1–10)
- **Tags:** hub, admin, design-system, maude, mdcc, branding, bundle-size, canvases-browser, activity-feed, settings, security, dogfooding
- **Related:** supersedes the DS layer of [`hub-admin-redesign.md`](../plans/archive/hub-admin-redesign.md) (the first redesign, MDCC, v0.18.0 `02e890f`); [DDR-053](./DDR-053-hub-admin-auth-architecture.md) (admin auth — **preserved**), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) (hub = untrusted-to-peers + frozen lockfile — **preserved**), [DDR-056](./DDR-056-linked-mode-gitignore-strategy.md) (gitignore — **preserved**), [DDR-096](./DDR-096-studio-shell-rewritten-in-maude-ds.md) (the sibling studio-shell maude reskin this matches), [DDR-052](./DDR-052-hocuspocus-over-partykit-for-hub.md) (Hocuspocus + SQLite). Plan: [`feature-hub-redesign-studio-hub.md`](../plans/hub-redesign-studio-hub.md). Design reference: `.design/ui/Studio Hub.tsx` (+ `.css`), maude DS, aspiration 4.4/5.

## Context

The self-hostable hub (`apps/hub/`) ships a vanilla-JS admin SPA (`src/admin/{index.html,style.css,app.js}`). Its **first** redesign (`hub-admin-redesign.md`, v0.18.0) moved it from generic plain-CSS to the **MDCC/project** DS (dark amber terminal aesthetic). Meanwhile the rest of the product moved to the **maude** "Unified Pro Studio" DS: the studio browser shell ([DDR-096](./DDR-096-studio-shell-rewritten-in-maude-ds.md)) and the planned native-collab app (phases 26–32) are all maude. Two design languages for one product.

Three real operator gaps also persisted (the v1.2 backlog's top items): operators are **blind to what's synced** (no canvases/documents browser), there is **no activity feed**, and there is **no settings surface**.

The maude-DS design reference already existed: `.design/ui/Studio Hub.tsx` — 7 artboards, sidebar-nav app-shell, tables/feed/settings/credential-reveal chrome.

## Decision

Reskin the admin SPA **MDCC → maude** and add the three additive operator surfaces, while preserving every JS-referenced ID and the entire DDR-053/054/056 security model. Stay a standalone vanilla-JS SPA bundled into the hub binary (NOT a canvas-lib React canvas) — port the maude tokens + component anatomy into `style.css` as plain CSS (the same technique the MDCC redesign used). Four sub-decisions:

### 1. DS migration MDCC → maude (supersedes `hub-admin-redesign.md`'s DS layer)

Replace the MDCC token block (`:root, .mdcc` — amber hue 55, mono-everywhere, square `--radius-sm: 2px`) with the **maude dark-block oklch literals** (cool-neutral hue 255 surface ladder, ONE confident indigo accent hue 268, Inter display/body + JetBrains Mono, `--radius-sm: 5px`, soft `--shadow-*`). Token NAMES are largely shared between the two DSes, so the contract (`--bg-0..4`, `--fg-0..3`, `--accent*`, `--status-*`, `--space-*`, `--type-*`) carries; only VALUES + a few new tokens (`--presence-*`, `--radius-xs/md/lg/pill`, `--canvas-dot/grid`, `--accent-muted`) change. **Dark-only** (the hub admin is always dark — the maude light block is not ported). The MDCC redesign's *structure discipline* (preserve IDs, bundle gate, `dist/admin/` mirror) is **kept**; only its visual layer is superseded.

Root class renamed `.mdcc` → `.maude` (applied on both `.hub-frame`/app-shell AND the `<dialog>`), preserving the documented top-layer token-scoping fix (see §below).

### 2. Branding — "Studio Hub" as the operator-console product name

The operator console is named **"Studio Hub"** (user-chosen, per the design canvas). Relationship to the other two names:

- **Maude** — the native desktop app + the umbrella product.
- **maude hub** / **Maude Hub** — the infra component (the npm `@maude/hub` package, the `maude hub` CLI verb, `ghcr.io/1agh/maude-hub`).
- **Studio Hub** — the *operator console UI* a deployed hub serves at `/admin`.

"Studio Hub" is a UI surface name, not a new package/CLI name — it does not rename `@maude/hub` or the `maude hub` CLI. The brand chip in the admin reads "Studio Hub"; logs/CLI/package stay "Maude Hub". A third name carries mild confusion risk; mitigated by scoping it strictly to the console chrome.

### 3. Bundle ceiling raised 15 KB → 28 KB gz (with rationale)

The MDCC bundle used 8.7 KB of a 15 KB gz hard cap. The maude reskin + sidebar-nav app-shell + inline SVG icon set + three new surfaces (canvases / activity / settings markup + render logic) cannot fit 15 KB. The ceiling is raised to **28 KB gz** in `test/admin-size.test.mjs` (`BUDGET_BYTES`). Rationale: the admin SPA is served once per operator session over `no-store` from a self-hosted box on a LAN/proxy — it is not a hot public asset, and 28 KB gz (~4× a typical above-the-fold JS chunk) is still trivially small for an admin console that now does six jobs instead of four. The gate stays a *hard* ceiling (loud CI failure) so future growth is a conscious decision, not drift.

### 4. Additive surfaces — minimal, flat-now, route-driven (leave the phase-30 seam)

- **Canvases browser** — `GET /admin/api/canvases` reads the Hocuspocus `documents` table **read-only** via a defensive, isolated helper. The `@hocuspocus/extension-sqlite` schema is `("name" varchar, "data" blob, UNIQUE(name))` — **no timestamp columns** — so size comes from `length(data)` and "activity" is **joined from the live `peers` Map**, not from a (nonexistent) `updated_at`. **Flat list** (no repo/branch grouping) — phase-30 owns the repo/branch IA realignment; the route returns a flat shape so that realignment is a UI regroup, not a rewrite.
- **Activity feed** — a **bounded in-memory ring buffer** (cap 200) in `server.mjs`; pushes on connect/disconnect/token-generate/rotate. **Ephemeral** (lost on restart) — acceptable v1, explicitly NOT sold as a persisted audit trail. Never logs token VALUES (labels only). `GET /admin/api/activity`.
- **Settings** — `GET /admin/api/settings` reads hub identity/status; `POST` persists editable hub name + description to `settings.json` beside `admin.json` (atomic tmp+rename, mode 0600, name validated `^[A-Za-z0-9 _.\-]{1,64}$`). **Danger zone**: rotate-admin-secret is wired to a gated `POST /admin/api/admin-secret/rotate` (invalidates `admin.json` → forces re-bootstrap/HUB_SECRET); "wipe synced state" stays a UI affordance only (no destructive route this slice).

All three new routes are **Bearer-gated** (reuse `verifyAdminAuth`), **rate-limited** (share the per-IP bucket), respond with the hardened header set, leak no secrets, and validate input — i.e. they inherit the DDR-053 contract unchanged.

## Consequences

- The hub admin now matches the studio shell (DDR-096) and the future native app's DS — one design language.
- Operators can see synced canvases, live activity, and settings without poking SQLite.
- The bundle ceiling moved (recorded here); future contributors see the rationale in the test comment + this DDR.
- This reskin is the **maude foundation** phase-30's "hub admin realignment" builds on — same DS, flat→repo/branch is a UI regroup. Not throwaway.
- The deferred Studio Hub surfaces (landing / onboarding / identity / presence-map) are routed as **design references** into phases 28/29/30/32 — built there, not here.

## Preserved invariants (NOT changed by this reskin)

- DDR-053: Bearer-only admin auth, atomic single-use bootstrap, scope-bound tokens, rotate-kicks-sessions, CSP/XFO/Referrer headers, per-IP rate limit, strict Content-Type + proto-pollution guard, `sanitizeForLog`.
- DDR-054: hub untrusted-to-peers trust model + frozen-lockfile release image.
- DDR-056: linked-mode gitignore strategy.
- Every ID `app.js` reads (`onboard-form`, `bootstrap-form`, `auth-state`, `invite-form`, `token-modal`, `peers-rows`, `tokens-rows`, status `s-*`, …) survives the restructure.
