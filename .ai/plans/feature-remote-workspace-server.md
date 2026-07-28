# Feature: Remote Maude — Team Workspace Server (hub + S3 + login + one-skill provisioning)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan was produced by a full divergent debate (builder / shipper / breaker, reduce tier per DDR-130) grounded in a very-thorough architecture sweep — the constraints below are verified against code, not assumed.

## Description

Turn Maude into a **remotely-hosted team workspace**: a single deployable ("workspace server") that owns a server-side git checkout of the project, runs the existing Yjs hub as the live layer, offloads binary assets to S3-compatible object storage, autosaves continuously (debounced doc→disk projection + append-only server-side commits), and gives every teammate a **per-user login** (password + one OIDC provider). Maude Desktop remains the editing client and keeps ACP fully local (the user's own `claude` subscription — DDR-123/125 compliant by construction). Provisioning is **one skill + API tokens**: a conversational command that renders the existing `apps/hub` deploy templates, wires S3, seeds the repo, and verifies the deployment with a real round-trip.

**Explicitly NOT in v1** (staged later, see Phase R): browser-based *editing* of canvases (the hosted studio surface), multi-tenant/vendor-hosted operation, multiple SSO providers. The browser gets the hub's Studio Hub console + login + invite surfaces in v1; editing stays in the desktop app.

## User Story

As a **design team member with no git or terminal knowledge**, I want to open Maude Desktop, sign in to my team's workspace URL, and have everything I do saved automatically to the team server (with big media files stored in object storage, not GitHub), so that I can collaborate like in Figma while the team's AI workflows (ACP) keep running on each member's own machine and subscription.

As the **team's admin**, I want to stand the whole thing up with one skill where I paste a domain + S3 credentials, so that I never hand-assemble Docker/TLS/token plumbing.

## Problem

- Today the working tree lives on each user's laptop; the hub is only a semi-trusted CRDT relay (DDR-054). There is no server-owned home for a project, so "autosave to the team" doesn't exist — durability = each user remembering to push.
- Binary assets are git-versioned (`assets/<sha8>`, never hub-synced — `apps/studio/sync/index.ts:365-372`), so heavy media bloats GitHub and reaches teammates only via push/pull.
- The hub has **no user concept** — identity == token label (`apps/hub/src/server.mjs:212-219`), tokens never expire, offboarding one person means rotating everyone.
- Setup of a hub today is CLI + template hand-editing; non-terminal users can't get from zero to a linked team.

## Solution

**Shape B — "Team Workspace Server", desktop-first** (debate consensus; browser-editing shape A rejected 2:1 for v1 — see Design Decisions § Debate outcome):

1. **Server-owned checkout as the workspace authority.** A headless sync/workspace agent colocated with the hub owns `/repo`, projects Y.Docs to disk on the existing debounce, and auto-commits **append-only** (never force-push; on rejection: stop, snapshot, surface a plain-words "someone else saved first" state — DDR-076 spirit). DDR-119's stated hazard ("rewriting a developer's tree under their hands") does not exist on a machine no human types in — that is the affirmative argument for the superseding DDR, not a loophole.
2. **S3 = two separate jobs, kept separate** (breaker trap #1): (a) **binary assets** move to S3 under the existing content-addressed `sha8` names — this is *additive* to DDR-110 (git stays the source-code lane); (b) **doc-store durability** — hub SQLite stays primary, with scheduled S3 snapshots + a *tested* restore drill. Canvas TSX **stays in git**; S3 never becomes the canvas distribution lane.
3. **Per-user identity on the hub**: users table (argon2 password + one OIDC provider), login mints a per-user, expiring, revocable `mau_` peer token on the existing HMAC spine (`apps/hub/src/tokens.mjs` — add `expires_at`, keep hash-at-rest). Trusted-proxy support lands with it (today `X-Forwarded-For` is deliberately untrusted — `apps/hub/src/server.mjs:846-849` — so rate limiting is decorative behind any LB).
4. **Desktop sign-in flow**: paste workspace URL → tokenless `/health` probe (existing `apps/studio/sync/hub-link.ts:87-109`) → login screen → token stored per-machine (`~/.config/maude/hubs.json`, 0600), `linkedHub` written to `.design/config.json`. DDR-110 vocabulary contract everywhere (Save version / Publish / Get latest; no git words).
5. **One-skill provisioning**: `maude hub workspace-up` (deterministic engine, DDR-062) + a thin `/design:hub-workspace` command (conversational wrapper). Inputs: domain, S3 endpoint/bucket/key/secret, admin email, optional OIDC issuer/client/secret, seed repo URL or "start fresh". Renders the **existing** templates (`apps/hub/docker-compose.yml.template`, `Caddyfile.template`, `fly.toml.template`), writes a 0600 `.env` (DDR-164 custody shape), runs the DDR-053 single-use bootstrap, and verifies with a real round-trip: write a canvas → assert it lands in S3 **and** in a commit. Output: one URL + invite links.
6. **Hard boundary, recorded up front:** the browser surface never grows a chat box (ACP is desktop-only, ToS-bound); single-tenant self-hosted only until Direction B (structured, non-executable synced unit) exists — the vendor does not become the DDR-054 omniscient operator.

## Metadata

- **Ticket**: — (tracker: github; create issue at execution start)
- **Type**: New Capability
- **Complexity**: High
- **App/Package**: `apps/hub` (identity, namespace, backup), `apps/studio` (sync/workspace agent, S3 asset lane), `cli` (`maude hub workspace-up`), `plugins/design` (skill/command), `apps/desktop` (sign-in flow)
- **Affected Systems**: hub auth + Yjs doc namespace, sync agent, asset pipeline, onboarding, deploy templates
- **Dependencies**: S3-compatible object storage (AWS S3 / R2 / MinIO-dev); argon2 (or node crypto scrypt — prefer zero-new-dep); optional OIDC lib (evaluate hand-rolled device-flow-style vs `openid-client` — hub image is frozen-lockfile, DDR-056)

---

## Context References

### Must-Read Files

> During `/flow:execute`, read every file listed here in parallel in a single message.

- `apps/hub/src/server.mjs` (lines 149-260, 410-620, 846-915) — Why: boot/TLS posture, `onAuthenticate`, admin API dispatch, rate limiting, X-Forwarded-For stance
- `apps/hub/src/tokens.mjs` (lines 78-112, 188-192, 242-324) — Why: HMAC token spine to extend (expiry/revocation), scope semantics
- `apps/hub/src/admin-auth.mjs` + `apps/hub/src/bootstrap.mjs` — Why: Bearer-only + atomic single-use bootstrap (DDR-053) — reuse, don't reinvent
- `apps/studio/sync/index.ts` (lines 198-250, 365-372, 568, 903-1018, 1083-1180) — Why: syncable set, accept-filter (assets excluded), flat-slug docName (the namespace fix lands here), multiplexed socket, auth message
- `apps/studio/sync/cold-start.ts` (lines 92-198) + `apps/studio/sync/agent.ts` (lines 64, 529-536) — Why: the data-safety spine (empty-remote-never-clobbers, content-hash journal, fail-closed snapshots) the server-side agent must inherit verbatim
- `apps/studio/sync/hub-link.ts` (lines 43-109) — Why: existing tokenless-probe + link flow the desktop sign-in extends
- `apps/studio/api.ts` (lines 614-687, 1660-1783) — Why: asset write path (caps, magic-byte sniff, dedupe) the S3 lane hooks into
- `apps/studio/generation/keys.ts` — Why: DDR-164 key-custody template for every server secret the skill writes
- `apps/hub/Dockerfile`, `apps/hub/docker-compose.yml.template`, `apps/hub/Caddyfile.template`, `apps/hub/fly.toml.template` — Why: the templates the provisioning skill renders (frozen-lockfile rule is load-bearing)
- `cli/commands/hub.mjs` + `cli/lib/hubs-config.mjs` — Why: CLI surface to extend; per-machine credential store (0600, `trusted` never committable)
- `.ai/archive/decisions/DDR-110-three-lane-collaboration-model.md`, `DDR-119*`, `DDR-109*`, `DDR-053*`, `DDR-054*`, `DDR-122*`, `DDR-076*`, `DDR-102*`, `DDR-123*`, `DDR-125*`, `DDR-052*`, `DDR-164*` — Why: the decisions this feature supersedes/amends/reuses; each supersede must be recorded, not worked around

### Files to Create

- `.ai/archive/decisions/DDR-XXX-remote-workspace-server-architecture.md` — umbrella superseding DDR (amends DDR-110 lane 1 for the hosted workspace + S3 binary lane; narrows DDR-119 via server-owned-checkout argument; extends DDR-053 with user identity; records the no-browser-chat + single-tenant boundaries)
- `apps/hub/src/users.mjs` — user table + password hash + OIDC linkage + session→token minting
- `apps/hub/src/backup.mjs` — scheduled SQLite snapshot → S3 + `restore-drill` verifier
- `apps/studio/sync/workspace-agent.ts` (or a headless mode of the existing agent) — server-owned checkout projection + append-only auto-commit
- `apps/studio/assets-s3.ts` — S3 upload/resolve lane for `assets/<sha8>` (+ hub-side authenticated asset proxy route)
- `cli/commands/hub-workspace.mjs` — `maude hub workspace-up` engine
- `plugins/design/commands/hub-workspace.md` — `/design:hub-workspace` conversational wrapper (name per CATEGORIES.md; bare `name:` slug per DDR-191)
- `apps/hub/test/{users,namespace,backup}.test.mjs`, `apps/studio/test/assets-s3.test.ts`

### Design canvases

| Canvas | Status | Tags | Notes |
| ------ | ------ | ---- | ----- |
| `.design/ui/Studio Hub.tsx` | existing | hub, admin | 7 artboards incl. landing + onboarding wizard + tokens/invite — Tier-0 prior for the hosted console + login surfaces |
| `.design/ui/Onboarding.tsx` | existing | onboarding | Three doors; Door C "Connect to a team hub" gets promoted to a first-class door |
| `.design/ui/GitHubIdentity.tsx` | existing | identity | Plain-words sign-in vocabulary ("Sign in", "Connected" — never OAuth/token) |
| `.design/ui/CreateProject.tsx` | existing | sharing | Invite-by-username surface |
| `.design/ui/LiveCollab.tsx` | existing | multiplayer | Presence + "Get latest" chrome (DDR-120) |

### Documentation

- `site/content/docs/hub/{index,deploy,linking,pricing}.mdx` — Why: public hub docs to extend with workspace mode
- Hocuspocus `extension-sqlite`/`extension-s3` docs — Why: DDR-052 names extension-s3 as the sanctioned persistence swap; v1 keeps SQLite + S3 snapshots (see Task 6 gotcha)

### Patterns to Follow

- **Key custody** (`apps/studio/generation/keys.ts`): 0600 + chmod double-assert, request-time resolution, write-only routes, env-scrub from ACP child — every secret the skill writes follows this.
- **Atomic single-use bootstrap** (`apps/hub/src/bootstrap.mjs:174-190`): POSIX-atomic rename; reuse for admin claim on a fresh workspace.
- **Fail-closed protective writes** (`apps/studio/sync/agent.ts:529-536`): if the pre-overwrite snapshot doesn't land, refuse the destructive write — the server-side commit loop inherits this.
- **Store binary Yjs updates, never JSON→binary** (phase-9.2 anti-pattern) — applies to any backup/restore code.
- **Dual allowlist rule** (`server.ts:244-262` + `http.ts:3828-3837`): any new studio route must be classified into exactly one origin class, with a `canvas-origin-gate.test.ts` assertion.

---

## Design Decisions

### Debate outcome (recorded)

Builder, shipper, and breaker **converged unprompted on the same shape** — "Workspace Server" (server owns the checkout, hub is the live layer, S3 for binaries, per-user login, desktop keeps ACP). The single genuine fork was **browser editing in v1**: builder refused to cut it; shipper refused to add it (~90 loopback-gated routes with zero auth + static fall-through serving any `repoRoot` file + Chromium-spawning exports = "auditing that surface IS the project"); breaker sided with shipper and attached seven preconditions. **Resolution: desktop-first v1; browser editing is Phase R, gated on the DDR-122 origin-gate + studio-route auth audit — grafted from builder's stance as a staged ambition, not dropped.** Non-git users are served in v1 by Maude Desktop (its zero-terminal cold start is exactly DDR-166's mandate).

### Breaker preconditions adopted as gates (each is a task below)

1. Single-tenant, self-hosted only; no vendor-operated instance until Direction B.
2. DDR-122 origin-gate on canvas-injected doc ops ships **first**.
3. Repo/branch namespace on hub docNames **before** any autosave-to-server (flat slugs + autosave = silent data loss).
4. Durable doc persistence + **tested restore drill** before git is de-emphasized.
5. Server-side commit is append-only; never force-push; fail-closed on rejection.
6. Per-user identity with expiry/revocation + trusted-proxy fix (or rate limiting stays decorative).
7. Superseding DDRs written **before** code.

### Components / UI

v1 UI surfaces reuse existing canvases (table above) — hub admin stays vanilla-JS under the 28 KB gz ceiling (DDR-097 discipline; login + invite pages join it). Desktop sign-in reuses GitHubIdentity's plain-words pattern. No new icon/token needs beyond the maude DS.

---

## Tasks

Execute in order. Phases 1→4 are v1 of this plan and **Part 1 of the remote-Maude arc** — the paid multi-tenant Maude Cloud continues the numbering at **Phase 5** in `.ai/plans/feature-maude-cloud-multitenant.md`. Phase R is recorded, not executed.

### Phase 1 — decisions + safety gates

### Task 1: CREATE umbrella superseding DDR

- **Do**: Write `DDR-XXX-remote-workspace-server-architecture.md` covering: DDR-110 amendment (S3 binary lane additive; server-owned checkout as workspace authority; vocabulary contract untouched), DDR-119 narrowing (server-owned checkout dissolves the stated hazard; no `$EDITOR` endpoint ever), DDR-053 extension (user identity mints peer tokens; admin Bearer unchanged; cookies only if/when Phase R lands), DDR-123/125 reaffirmation + **hard boundary: no chat surface in any browser UI**, single-tenant-only posture, DDR-079 banner → UI disclosure. Check the decisions dir AND uncommitted README index for the next free DDR number (numbering races on shared main — known gotcha).
- **Validate**: `/flow:record-ddr` flow; kg ingest fires automatically (repo is kgai-active).

### Task 2: UPDATE sync — origin-gate canvas-injected doc ops (DDR-122 follow-up)

- **Do**: Implement the named-but-undone fix: Y.Doc ops originating from the canvas realm must not reach the hub-synced body doc unless they came through the shell's sanctioned edit path. Follow DDR-122's follow-up note for the seam.
- **Pattern**: frozen origin sentinels in `apps/studio/collab/`; DDR-063 dual-lock.
- **Gotcha**: don't break the legitimate `useCollab()` canvas API for same-machine boards.
- **Validate**: new `bun test` in `apps/studio/test/` proving a canvas-realm-origin op is rejected; run `git status apps/studio/dist/` before AND after (dist-clobber gotcha).

### Task 3: UPDATE hub + sync — repo/branch document namespace

- **Do**: docName becomes `ws/<workspace-or-repo-id>/<branch>/<slug>` (client passes context on connect — phase-30 discovery note). Hub: accept + expose grouping in `/admin/api/canvases`; token scopes keep prefix semantics (DDR-053) so a workspace-scoped token = prefix `ws/<id>/`. Sync client: build docName from repo identity + current branch; migration shim maps legacy flat slugs (feature-flag `MAUDE_HUB_NAMESPACED=1`, default on for workspace mode, off for legacy hubs).
- **Gotcha**: two branches sharing one doc is the current (mitigated-by-cold-start) behavior — namespacing CHANGES doc identity; cold-start must treat a fresh namespaced doc as "not seeded yet" (DDR-076), never clobber.
- **Validate**: `apps/hub/test/namespace.test.mjs` + existing sync tests green.

### Phase 2 — identity + durability on the hub

### Task 4: ADD hub user model + login + per-user tokens

- **Do**: `users.mjs` (better-sqlite3 `users.db`): email, scrypt/argon2 hash, role, `created_at`, `disabled`. Routes (same `onRequest` dispatch): `POST /auth/login`, `POST /auth/logout`, admin CRUD for users + invites. Successful login mints a per-user `mau_` token (existing spine) with new `expires_at` column + revocation on user-disable; `onAuthenticate` checks expiry. OIDC: one provider, authorization-code flow, hand-rolled REST if feasible (DDR-114 precedent) to avoid new deps in the frozen hub image; else lockfile-bumped `openid-client`.
- **Pattern**: `tokens.mjs` HMAC-at-rest; `admin-auth.mjs` Bearer; DDR-053 CSP headers on the login page.
- **Gotcha**: dev-mode footgun — empty token store + unset `HUB_SECRET` ⇒ any token authenticates (`server.mjs:221-230`); workspace mode must disable this permissive path outright.
- **Validate**: `apps/hub/test/users.test.mjs` (login, expiry, revoke-kicks — reuse the rotate-kick machinery at `server.mjs:723-736`).

### Task 5: ADD trusted-proxy + persistent rate limiting

- **Do**: `HUB_TRUSTED_PROXIES` env (CIDR list); when the peer addr matches, honor rightmost untrusted `X-Forwarded-For` hop. Caddy template sets it by default. Move the three in-memory buckets to a small SQLite-backed sliding window (survives restart; single-process is fine — horizontal scale stays DDR-052's extension-redis story).
- **Validate**: unit tests: spoofed XFF from untrusted addr ignored; login brute-force 429s behind proxy.

### Task 6: ADD doc-store backup + restore drill

- **Do**: `backup.mjs`: scheduled (`node:timers`) snapshot of `hub.db`/`tokens.db`/`users.db` (SQLite `VACUUM INTO` → gzip → S3 PUT under `backups/<ts>/`), retention policy; `maude hub restore-drill` downloads latest, boots a throwaway hub on it, asserts doc count + a sentinel canvas round-trips. Skill refuses to report "done" until the drill passes once.
- **Gotcha**: keep SQLite primary — do NOT swap to `extension-s3` in v1 (unproven here; DDR-052 keeps it as a named option). Store binary Yjs updates in backups verbatim.
- **Validate**: `apps/hub/test/backup.test.mjs` against MinIO (dev-compose) — snapshot + drill green.

### Phase 3 — workspace agent + S3 asset lane

### Task 7: ADD server-side workspace agent (autosave = append-only commit)

- **Do**: headless mode of the existing sync agent (`MAUDE_WORKSPACE_MODE=1` on the studio server, no browser open, no exports): owns `/repo`, connects to the colocated hub as a peer (outbound WS — studio's loopback bind is untouched), projects docs→disk on the existing 800 ms debounce, then a quiescence-debounced `git add <touched> && git commit` (author = the editing user's identity from presence, committer = workspace bot). **Never force-push**; if a configured mirror remote rejects, stop + snapshot + set a plain-words "someone else saved first" flag the clients render. Inherits cold-start.ts verbatim, with a server-local content-hash journal (the "stateless client has no journal" gap doesn't apply — the agent is a stateful machine).
- **Pattern**: `sync/agent.ts` + `fs-mirror.ts` + `cold-start.ts`; DDR-076 fail-closed snapshots.
- **Gotcha**: exports/screenshot Chromium must be hard-disabled in workspace mode (self-SSRF vector — `exporters/index.ts:164-175`); assert boot refuses if export routes are reachable.
- **Validate**: integration test in compose: two clients edit → server repo shows append-only commits; kill -9 mid-autosave → no corruption, journal recovers.

### Task 8: ADD S3 asset lane (big data off GitHub)

- **Do**: `assets-s3.ts`: when `assets.s3` configured, `saveAsset` additionally PUTs to S3 under `assets/<sha8>.<ext>` (content-addressed = idempotent), and the workspace agent adds an `assets/` gitignore block (managed, like `cli/lib/gitignore-block.mjs`). Hub gains an **authenticated** `GET /assets/<sha8>` proxy (peer token; streams from S3; never presigned-URL-in-canvas — canvas CSP stays `img-src 'self'`). Desktop/studio resolution: local miss + `linkedHub` present → fetch from hub, cache locally, serve as today. `maude hub asset-check` verifies every `assets/` reference in the repo resolves in S3 (dangling-pointer integrity check); never-GC documented.
- **Pattern**: `api.ts:1660-1783` write path (caps + sniff + dedupe stay authoritative); `fetch-asset`'s hardening for any egress.
- **Gotcha**: DDR-148's "video rides git and hub sync" claim is wrong in code today — this task is what actually makes cross-machine media true; fix the DDR line in passing. S3 lifecycle rules must be OFF for the assets prefix (skill sets bucket policy; asset-check is the backstop).
- **Validate**: `apps/studio/test/assets-s3.test.ts` against MinIO; drop 60 MB video → lands in S3, not in git; second machine resolves it via hub.

### Task 9: UPDATE desktop sign-in + disclosure UI

- **Do**: "Sign in to workspace" flow: URL paste → tokenless `/health` probe → login (system browser to hub login page → loopback token bridge, mirroring the GitHub device-flow custody model DDR-108/114) → write `hubs.json` + `linkedHub`. Promote Onboarding Door C. Replace the DDR-079 *terminal* banner with a UI disclosure panel: "This workspace's server can see your edits and presence" + who operates it (DDR-054 posture made visible; hosted product has no terminal to print to).
- **Pattern**: `sync/hub-link.ts`; `GitHubIdentity.tsx` canvas vocabulary; keychain custody (`keychain.rs`) for the token on native.
- **Validate**: `desktop-e2e` scenario `workspace-sign-in` (DOM-driven, data-testid per convention).

### Phase 4 — provisioning skill

### Task 10: CREATE `maude hub workspace-up` engine

- **Do**: `cli/commands/hub-workspace.mjs`: interactive (+ `--json` non-interactive) prompts: domain, S3 endpoint/bucket/key/secret, admin email(+password or OIDC issuer/client/secret), seed repo URL or "start fresh" (`git init` + first commit). Renders compose (hub + workspace-agent + Caddy with `trusted_proxies` + optional MinIO **dev-only** profile), or `fly.toml`. Writes `.env` 0600 (DDR-164 shape), creates bucket + CORS + **no-expiry** policy on `assets/`, boots, runs DDR-053 bootstrap claim, then the **round-trip verifier**: create a sentinel canvas via a temp peer token → assert S3 object + git commit + restore-drill pass. Prints one URL + per-teammate invite links. Idempotent re-run = upgrade path.
- **Pattern**: existing `hub.mjs deploy fly|docker` + the three templates; `preflight.mjs` for dep checks.
- **Gotcha**: the skill scaffolds and verifies; it must NOT claim to own key rotation/backup forever — print a short "operator duties" card (rotate S3 keys, check restore drill output) instead of promising "done" (breaker trap #3).
- **Validate**: `cli/` node test with MinIO compose; full up→verify→destroy cycle green.

### Task 11: CREATE `/design:hub-workspace` command + docs

- **Do**: `plugins/design/commands/hub-workspace.md` (bare `name: hub-workspace` per DDR-191; category per `plugins/design/CATEGORIES.md` — likely a new `hub` group documented there): conversational wrapper that collects the same inputs and drives `maude hub workspace-up` (DDR-062 — plugins reach executable logic via `maude`). Extend `site/content/docs/hub/` with a "Workspace mode" page; hub README risk-banner rows updated for the new posture.
- **Validate**: `cli/lib/plugin-cli-reachability.test.mjs` + `plugin-name-namespace.test.mjs` green.

### Phase R — recorded follow-ups (NOT in this plan's execution)

- **R1 Browser editing** (`isHostedApp` third surface class): gated on a full studio-route auth/authz audit (~90 routes + ungated stragglers + static fall-through), CSP rework (DDR-109 supersede), export quotas. Builder's case is preserved in the DDR.
- **R2 Multi-tenant / vendor-hosted**: gated on Direction B (structured non-executable synced unit — phase-9.1).
- **R3 More SSO providers**; **R4 per-project permissions/roles**.

---

## Validation

1. **Lint**: `pnpm lint`
2. **Tests**: `pnpm test && pnpm test:dev-server` (hub tests run under `pnpm test`; better-sqlite3 ABI mismatch = env issue, rebuild from source, not your code)
3. **Build**: `pnpm --filter @maude/site build`
4. **Parity/tarball/tokens/site-content**: the repo's custom quality gates (`workflows.config.json` → `quality.*`)
5. **Integration**: compose-based round-trip (Task 10 verifier) — two peers, autosave commits, S3 asset resolve, restore drill
6. **Security**: `/flow:validate-security` (security-auditor + ethical-hacker) on the hub identity + S3 proxy + workspace-agent diff — this feature's trust-boundary changes make step 6.5 mandatory, severity floor medium
7. **Desktop**: `desktop-e2e` scenario `workspace-sign-in`
8. **Manual**: kill-server-mid-edit recovery; wrong-S3-key failure states render plain-words errors (no git vocabulary in any user-facing copy)

## Scenario Coverage

| Scenario | Covers | Status |
|----------|--------|--------|
| `workspace-sign-in` (desktop-e2e) | URL paste → login → linked → presence visible | 🆕 new |
| `workspace-autosave-roundtrip` (compose integration) | edit → autosave commit → second peer "Get latest" | 🆕 new |
| `workspace-asset-offload` | 60 MB drop → S3 → cross-machine resolve | 🆕 new |

## Acceptance Criteria

- [ ] All Phase 1–4 tasks completed; Phase R only recorded in the DDR
- [ ] Superseding DDR exists BEFORE implementation commits (breaker gate 7)
- [ ] DDR-122 origin-gate merged before any workspace-mode code (gate 2)
- [ ] Namespaced docNames land before server-side autosave (gate 3)
- [ ] Restore drill passes in CI/compose before docs advertise autosave durability (gate 4)
- [ ] Server commits are append-only; force-push impossible by construction (gate 5)
- [ ] Per-user expiring tokens + trusted-proxy fix shipped together (gate 6)
- [ ] No browser surface contains any chat/ACP affordance; grep-gate in tests
- [ ] `/flow:validate` passes incl. security step 6.5; scenario reports linked in PR
- [ ] UI copy audit: zero forbidden git vocabulary (DDR-110 contract)
- [ ] Roadmap regen (`pnpm --filter @maude/site gen:roadmap`) diff committed with the plan
