# Feature: Self-hosted workspace readiness — durability, people, BYO identity, and a guided setup

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

> **This plan was rewritten after a divergent bookend debate** (BUILDER · SHIPPER · BREAKER, relay tier, 2026-08-18). All three seats returned `CHANGE_THE_PLAN` at confidence 8, converged to 9, and every surviving position was rewritten at least once by a seat that disagreed with it. The debate found **a live data-destruction bug in shipped artifacts** and **an account-takeover path in this plan's own Track C**. Both are now Phase 0 and a blocker respectively. The resulting scope is *smaller* than the first draft: `boot-guard.mjs` is deleted, Track A shrinks to one line, and Track C loses its largest task to a library and a code path to a security fix.
>
> Owner decisions (2026-08-18): auto-restore **without** a staleness gate · verify with **`jose`** · **all four tracks in one cycle**. Phase 0 is not a fifth track — it is a patch for a bug that exists today, and it ships first because the feature's own docs would otherwise walk operators into it.

## Description

The workspace hub is architecturally complete and operationally half-finished. `maude hub workspace-up` renders and verifies a real deployment; the hub owns a checkout, commits autosaves, serves the real studio through an authenticating proxy, and stores media in S3. What is missing is everything between "the container is up" and "a team uses this without us."

**And underneath that, one thing is actively broken.** Backups carry no identity, and self-hosted deployments have no way to namespace them:

- `MAUDE_BACKUP_PREFIX` has exactly **one setter in the entire repository** — `infra/cell/entrypoint.sh:62`, where the cell *derives* it from the tenant id. `grep MAUDE_BACKUP_PREFIX cli/lib/workspace-plan.mjs` returns **zero**. There is no field, no prompt, no derivation. `backup.mjs:173` therefore falls through to the **bare bucket root** for every self-hosted deployment, by construction rather than by operator error.
- `snapshotPrefix()` is `backups/<ISO timestamp>` — time only.
- `runBackup`'s manifest is `{ version: 1, createdAt, files, repo? }` — no project, no tenant, no hub id.

So two hubs sharing one bucket interleave generations into a single time-sorted keyspace. `listBackups` returns both; `pruneOldBackups` is count-only (`slice(0, length - keep)`, `DEFAULT_KEEP = 14`, no age floor, no owner filter) and **deletes across the merge**. Hub A's history is destroyed by Hub B's backup ticks, on a healthy Tuesday, with nobody restoring anything and nothing failing anywhere. And on a cold start, `restoreLatest`'s `force: false` guard cannot help: a complete generation from the wrong project is a valid complete generation.

Severity, stated honestly: self-hosting is barely usable today, so probably nobody has two hubs on one bucket yet. That is not reassurance — **the first act this feature exists to enable is the act that triggers it.** Six StudyFi hubs, one bucket, no namespace field. Track D would ship a runbook walking operators into the configuration that eats their history.

The remaining four gaps, found by reading the shipped code:

1. **A lost `/repo` volume is silent data loss.** `infra/cell/entrypoint.sh` already solves this — warm-start check → `dist/rehydrate.mjs` → `die` on failure — and `dist/rehydrate.mjs` is already built into the self-host image (`build.ts:96+`). But `apps/hub/Dockerfile` ends at `CMD ["node","dist/hub.bundle.mjs"]` and never calls it. Two boot paths; one recovers, one re-clones `MAUDE_SEED_REPO` over the loss and boots green. **The divergence is the bug.** Worse, the shipped warm-start condition keys on `[ -f /data/hub.db ]` *alone*, which does not model the self-host two-volume case — `/data` intact + `/repo` lost reads as a *warm* start, skips rehydrate, and falls through to `seedRepo`. That half is live in production cells right now.
2. **There is no way to manage people in the UI.** `/admin` nav is Overview · Peers · Tokens · Canvases · Activity · Settings. The full user CRUD (`/admin/api/users*`) and the magic-link invite API (`/admin/api/invites`, which already accepts an `email` and returns a ready link) exist, are tested, and are called by **nothing** — `grep users src/admin/app.js` returns zero hits. The topbar's "Generate invite" is the *peer token* generator: it asks for a label, not an address.
3. **No BYO identity.** No OIDC anywhere in `apps/hub/src/`. The only identity seam is `cloud-identity.mjs`, whose sole issuer is our Cloudflare control plane — which a self-hoster does not have.
4. **The docs stop at "it works on a VPS."** `apps/hub/README.md` still describes Phase 9 (2026-05-28) and says deploy templates "land in a subsequent slice."

## User Story

As someone who wants Maude for my team without using Maude Cloud, I want to be walked through standing up one project's workspace on my own infrastructure with my own identity provider, so that my designers sign in with their company account, collaborate in the browser, and I can prove their work survives losing the box.

## Problem

The self-hosted product is the hub (`self-hosted-is-the-hub-and-cloud-stays-open`, 2026-07-31) — not a portable copy of the cloud. That decision holds, and it makes the hub the *whole* product for a self-hoster. Today it ships the engine without the dashboard, the identity story, or the operating manual — over a backup layer that cannot tell whose data it is holding.

## Solution

**Phase 0 (patch release, ships first)** makes a backup generation prove its owner, and fixes the two-volume re-seed. Ordered so that step 1 stops the destruction without depending on anything else being true.

**Then four tracks in one cycle.**

**Track A' — one entrypoint.** `apps/hub/Dockerfile` gains an entrypoint that calls `dist/rehydrate.mjs`, and the boot decision table lives **inside rehydrate** — which already imports `listBackups` / `restoreLatest` / `targetFromEnv`, already exits non-zero on doubt, already ships as a dist entry, and is already called by the cell. The cell's `[ -f /data/hub.db ]` shell test is **deleted** rather than duplicated. Net: *fewer* decision points than today. `boot-guard.mjs` is not written; original tasks A1, A2 and A4 disappear.

Auto-restore is the default on a genuine cold start (owner call), and it is safe because Phase 0 gives the generation an owner to check. No staleness kill-switch on the boot path — eight-day-old data beats no service; log the age, surface it in the console, never die on it.

**Track B — People in the console**, over APIs that already exist and are tested. Plus the durability rows, and the explicit **OIDC link action** that Track C's security fix requires.

**Track C — BYO identity (OIDC).** One adapter covers Auth0 and Google. The **flow is ours** (PKCE, state, nonce, `sub`→account, SSRF pinning, mode switch); the ~150 lines deciding whether a signature is valid are **`jose`'s** (pinned, `alg: ['RS256']` explicit at the call site). And **no auto-link, ever** — see the blocker below.

**Track D — documentation and a guided setup skill**, with a freshness test so five new pages cannot rot the way the README already did. AWS is documentation plus the tooling that genuinely does not exist yet (owner call): no ECS emitter, no Terraform module.

### Blocker — Track C as first drafted contained an account takeover

The first draft's C3 said: *"First successful OIDC sign-in for an email that already exists **links** rather than creates."*

`users.mjs:63` is `email TEXT PRIMARY KEY` — **email is the account key**. And `createUser`'s own docstring (`users.mjs:210`) reads: *"Throws on a duplicate address (callers map that to 409) so a signup can never silently overwrite an existing account's password."*

So auto-link does not defeat a missing guard — **it routes around an existing one that has been holding since it was written**, reaching the same outcome by aliasing an identity onto the row instead of rewriting its hash. With the domain allowlist optional and no `email_verified` requirement, an attacker who can assert `admin@company.com` at a permissive issuer owns the admin account in one request, with no admin action.

The plan's own Gotcha caught the *second*-order case ("an IdP can reassign an address; `sub` is the stable subject") while the first-order takeover sat in the sentence directly above it. That is how it survived review.

**The remedy is deletion.** Every unmapped `sub` goes to `oidc_pending` — matching email or not. Linking to an existing account becomes an explicit act in the People view. Less code than the draft had. **This makes B a hard prerequisite for C**, not a preference: without the People view, C's only safe posture has no operator interface at all.

### Four rules the debate produced, to be recorded verbatim

The debate reached for the same wrong move four times, from three different seats — each converting a **data-integrity** problem into an **availability** problem: refuse-on-boot as the fix for a write-side collision; a staleness threshold that dies where booting is obviously right; a required namespace that orphans good generations on upgrade; and flipping `/health` unhealthy to surface a backup refusal. Two rules killed all four:

> **Conditions gate machines; heuristics inform humans.**
> **Degradation is a report, not a liveness signal.**

Twice the security-correct answer was also the *smaller* one (`jose` deletes most of C1; killing auto-link removes a branch). BUILDER's generalization:

> **When a plan carves out a special case for a sub-case the general path already handles, the carve-out is usually where the defect lives — and deleting it shrinks the work.**

And on the dependency question, BREAKER's framing:

> **The hand-roll is not a smaller shipment. It is the same shipment plus a permanent unassigned obligation.**

## Metadata

- **Type**: Bug Fix (Phase 0) + New Capability (B, C, D) + Enhancement (A')
- **Complexity**: High
- **App/Package**: `apps/hub`, `infra/cell`, `cli`, `plugins/design`, `site`
- **Affected Systems**: backup identity + retention, hub boot sequence, cell entrypoint, admin console, hub auth spine, `workspace-up`, design-plugin skills, docs site
- **Dependencies**: **`jose`** (pinned; zero transitive deps) — the one addition, and it *removes* more code than it adds
- **Supersedes/extends**: extends `self-hosted-is-the-hub-and-cloud-stays-open`, DDR-192 §3, DDR-204, DDR-205 (generalizes its identity argument one layer up), DDR-097 (ceiling **not** raised — see B4)

---

## Context References

### Must-Read Files

> Read every file listed here in parallel in a single assistant message.

**Phase 0 — backup identity**
- `apps/hub/src/backup.mjs` (132–175 `targetFromEnv`/`targetFromConfig`/`prefixedTarget`, 212–217 `snapshotPrefix`, 240–275 `runBackup` + manifest, 286–297 `pruneOldBackups`, 300–330 `restoreLatest`, 431–472 `scheduleBackups`) — Why: every mechanism Phase 0 touches. Note `scheduleBackups` already catches and retries on failure by design.
- `infra/cell/entrypoint.sh` (55–95) — Why: the only place `MAUDE_BACKUP_PREFIX` is ever set, and the comment explaining that a missing `export` there would restore one tenant from another's documents.
- `cli/lib/workspace-plan.mjs` (41 `validateWorkspaceConfig`, 175 `envEntries`, 271 `renderCompose`) — Why: where a namespace field must land; currently zero mentions of the prefix.
- `apps/hub/src/repo-checkpoint.mjs` (1–60) — Why: the one-generation rule, and why mixed-generation restore is *"the kind of corruption that looks like a bug in the app for weeks."*

**Track A'**
- `apps/hub/src/rehydrate.mjs` (full) — Why: the decision table's new home. It already exits non-zero on doubt and walks back through generations.
- `apps/hub/Dockerfile` (last 20 lines) — Why: `ENTRYPOINT ["/usr/bin/tini","--"]` + `CMD ["node","dist/hub.bundle.mjs"]` is the one-line change. **Another session is actively editing this file** (the `log-format.ts` COPY for cloud-managed git posture) — rebase carefully.
- `apps/hub/build.ts` (96–130) — Why: proves `dist/rehydrate.mjs` ships; no third entry is needed.
- `apps/hub/src/seed-repo.mjs` (full) — Why: `isEmptyDir` is the *same* condition restore fires on, so restore-before-seed must be an assertion, not an ordering coincidence.

**Track B**
- `apps/hub/src/admin/index.html` (128–135 nav, 169–191 Overview stats, 275–296 invite form) · `apps/hub/src/admin/app.js` (126 `render`, 165–185 `refresh`, 186–210 `applyPlatformPosture`, 466 `setView`) — Why: the view machinery and the posture pattern.
- `apps/hub/src/auth-routes.mjs` (350–470) · `apps/hub/src/invites.mjs` (113–140) — Why: exact contracts the UI must not reinvent.
- `apps/hub/test/admin-size.test.mjs` — Why: the ceiling and why it is anti-drift, not performance.

**Track C**
- `apps/hub/src/users.mjs` (60–70 schema, 137–145 `assertValidRole`, 206–225 `createUser`) — Why: `email TEXT PRIMARY KEY`, the two-role vocabulary, and the duplicate-address guard the draft routed around.
- `apps/hub/src/role-matrix.mjs` (85–135) — Why: "Unknown roles get NOTHING", and line ~129's warning that *"the next role added on either side re-opens this"* — the reason `pending` must not be a role.
- `apps/hub/src/cloud-identity.mjs` (30–80) — Why: the explicit-mode-switch discipline, **and** the passage the draft mis-cited: *"Deliberately NOT a JWT… we control both ends. One algorithm, no negotiation, nothing to downgrade."* Every clause is about controlling both ends — the property Track C removes by design.
- `apps/cloud/oauth-google.mjs` (1–60) — Why: PKCE/state/claim decision layer already written once here.
- `apps/hub/src/browser-auth.mjs` · `tokens.mjs` · `revocations.mjs` — Why: the session, revocation and kick semantics OIDC must join rather than parallel.
- `apps/studio/bin/curl-local.sh` — Why: DDR-185's resolve-then-refuse shape, inverted, is the model for the JWKS egress guard.
- `/Users/iagh/git/studyfi/studyfi-design/plugins/studyfi-app/skills/new-app/references/auth-setup.md` — Why: the downstream standard, and its list of flaws not to reproduce.

**Track D**
- `plugins/design/commands/hub-workspace.md` · `plugins/design/skills/design-system/SKILL.md` (staged-discovery only) · `site/content/docs/hub/{index,deploy,workspace}.mdx` + `meta.json` · `apps/hub/README.md`

### Files to Create

**Phase 0**: `apps/hub/test/backup-identity.test.mjs` · `apps/hub/test/two-volume-warm-start.test.mjs`
**Track A'**: `apps/hub/entrypoint.sh` · `apps/hub/test/boot-decision.test.mjs`
**Track B**: `apps/hub/test/admin-people.test.mjs`
**Track C**: `apps/hub/src/oidc.mjs` · `apps/hub/src/oidc-routes.mjs` · `apps/hub/src/oidc-egress.mjs` · `apps/hub/test/oidc.test.mjs` · `apps/hub/test/oidc-routes.test.mjs` · `apps/hub/test/oidc-egress.test.mjs`
**Track D**: `plugins/design/skills/self-host/SKILL.md` · `_credentials.md` · `_targets.md` · `site/content/docs/hub/{self-host,aws,identity,people,durability}.mdx` · `apps/hub/test/docs-env-freshness.test.mjs`

### Design canvases

| Canvas | Status | Notes |
| ------ | ------ | ----- |
| `.design/ui/Studio Hub.tsx` | 7 artboards, `iteration_count: 1` | **Tier-0 prior for Track B.** Its `dashboard` nav is exactly today's six items — the canvas has no People surface either, so B adds one. Lift the table chrome from `tokens`, the one-time credential reveal from `invite-modal` (the invite link is exactly that shape), the empty/error patterns from `states`. Artboard `onboarding` (step rail: Claim · Identity · Transport · First invite · Live) is the visual prior for Track D's skill stages — ask in that order so words and pictures agree. |
| `.design/ui/Cloud Self Service.tsx` | `draft`, 15 artboards | Contrast reference only — multi-tenant and billed. Do not lift its People shapes; a self-hoster has one project and no billing. |

### Documentation

- [OpenID Connect Core §3.1](https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth) · [RFC 7636 PKCE](https://datatracker.ietf.org/doc/html/rfc7636) · [RFC 8725 JWT BCP](https://datatracker.ietf.org/doc/html/rfc8725) · [`jose` docs](https://github.com/panva/jose) · [Auth0 OIDC discovery](https://auth0.com/docs/get-started/applications/configure-applications-with-oidc-discovery) · [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect)
- Internal: DDR-053, DDR-056, DDR-097, DDR-185, DDR-192, DDR-193, DDR-204, DDR-205, DDR-209

---

## Tasks

### Phase 0 — the patch release (ships before the feature)

> Ordered so step F1 stops the destruction **without depending on "probably nobody has two hubs on one bucket yet" being true** — the property a fix release should have.

#### Task F1: ADD project identity to the backup manifest + refuse on WRITE

- **Do**: Manifest → `version: 2` with a `project` identity field. `runBackup` reads the newest existing manifest in the target keyspace first and **refuses to write** when it names a different project. Works at the bare root, needs no prefix to exist.
- **Gotcha**: **The identity value must be unique per hub and must not be a value an operator copies when cloning a deployment.** Not `HUB_SECRET`, not a hostname, not anything in `.env` that gets duplicated across six StudyFi hubs — if it is, both refusals pass on exactly the collision they exist to catch. Derive it once, persist it in `/data`, and stamp it. This is the load-bearing item three separate conclusions rest on.
- **Validate**: `cd apps/hub && node --test test/backup-identity.test.mjs`

#### Task F2: REFUSE a mismatched generation on READ

- **Do**: `restoreLatest` refuses a generation whose `project` does not match. **Refuse `absent` (a `version: 1` generation) whenever `MAUDE_BACKUP_PREFIX` is unset** — that is the only configuration that could have produced a shared keyspace, so "no identity" there means "possibly not yours."
- **Gotcha**: A prefixed deployment with legacy generations is safe and must still restore — the `absent` refusal is conditioned on the *unset prefix*, not on the missing field.
- **Validate**: `cd apps/hub && node --test test/backup-identity.test.mjs`

#### Task F3: ADD a namespace for NEW renders only, with an orphan net

- **Do**: `workspace-plan.mjs` renders and validates a derived namespace for **newly rendered configs**. **Never force one onto an existing deployment** — once F1 lands the prefix is a remedy, not a safety mechanism, and forcing it would orphan every existing generation (a prefixed target lists a *disjoint* keyspace). For an operator who voluntarily prefixes an existing deployment, add the net: at boot, if the prefixed keyspace has zero generations **and** the bare root has ≥1 → refuse and print the migration instruction.
- **Gotcha**: **`targetFromEnv()` returns the already-prefixed target**, and `prefixedTarget` rewrites `list('backups/')` → `list('<prefix>/backups/')`. Probing it twice looks in `<prefix>/backups/` twice and always answers zero — the check would pass review and do nothing. It needs the **base** target constructed without the prefix. The remediation is a **printed `aws s3 cp --recursive`-shaped instruction naming both keyspaces**, not a `maude hub migrate-backups` verb we would have to test against S3, R2 and MinIO.
- **Validate**: `node --test cli/lib/workspace-plan.test.mjs && cd apps/hub && node --test test/backup-identity.test.mjs`

#### Task F4: FIX the two-volume warm start — live in production cells today

- **Do**: The warm-start condition becomes "`hub.db` present **AND** the repo has commits". Today `[ -f /data/hub.db ]` alone makes `/data` intact + `/repo` lost a *warm* start: it skips rehydrate and falls through to `seedRepo`, which clones the seed over the loss.
- **Gotcha**: This is the only Phase 0 item with real users **right now** — it affects production cells, not just the latent self-host collision. Own regression test.
- **Validate**: `cd apps/hub && node --test test/two-volume-warm-start.test.mjs test/cell-durability.test.mjs`

#### Task F5: SURFACE a write-side refusal as state, not a log line

- **Do**: One Overview row + one field in the authenticated `/admin/api/status`: `backups DISABLED — identity conflict with <other>`.
- **Gotcha**: A write-side refusal converts *"hub B destroys hub A's history"* into *"**hub B has no backups at all**"* — the right trade, but not benign, and it recurs every tick into a log nobody tails. `scheduleBackups` already catches, logs and retries by design; its own docstring names this failure mode: *"a network error must not silently end all future backups, which is exactly how 'we had backups' becomes 'we had backups until March'."* The file anticipated it and nobody built the surface above the log. **Do NOT express this by flipping `/health` unhealthy** — under compose restart policies or ECS health-based replacement that kills a hub which is up and serving correctly, and `/health` is unauthenticated so naming the conflicting project there over-shares. Degradation is a report, not a liveness signal.
- **Validate**: `cd apps/hub && node --test test/admin-api.test.mjs test/health.test.mjs`

#### Task F6: ADD an advisory merge-detection report

- **Do**: An operator verb that inspects a keyspace and reports evidence of interleaved generations. **Advisory only — it never gates a boot or a restore.** It closes the forward-only residual: F1 makes new generations safe but says nothing about a bucket already interleaved.
- **Gotcha**: Conditions gate machines, heuristics inform humans. Timestamp-contiguity analysis as a boot gate would pass a merged series that happens to look even and refuse a single-owner series whose hub was down a day.
- **Validate**: `cd apps/hub && node --test test/backup-identity.test.mjs`

### Track A' — one entrypoint

#### Task A1: MOVE the boot decision into `rehydrate.mjs` and give the Docker path an entrypoint

- **Do**: `apps/hub/entrypoint.sh` calls `node dist/rehydrate.mjs --data /data --repo /repo` then execs the server; Dockerfile points at it. The decision table lives **inside rehydrate**:

  | `/repo` | `/data` | gens | identity | verdict |
  |---|---|---|---|---|
  | empty | empty | ≥1 | matches | **restore** |
  | empty | empty | ≥1 | mismatched | refuse, print both identities |
  | empty | empty | ≥1 | absent + prefix set | restore + announce loudly |
  | empty | empty | ≥1 | absent + **no prefix** | refuse (F2) |
  | empty | empty | 0 + seed | seed |
  | empty | empty | 0 | fresh |
  | empty | populated | ≥1 | — | **refuse** |
  | populated | any | any | — | proceed |
  | any | any | list error | — | proceed, log loudly |

  Delete the cell's `[ -f /data/hub.db ]` shell test — one decision point, two callers, fewer than today. `MAUDE_ALLOW_EMPTY_START=1` is the only knob; no `MAUDE_ON_EMPTY_CHECKOUT` policy var.
- **Gotcha**: Row 7 (`/repo` empty, `/data` populated) **refuses** — `restoreLatest` throws without `force` and overwrites newer DBs with it, and `repo-checkpoint.mjs` names mixed-generation restore as corruption. **No staleness kill-switch** (owner call, and all three seats): log the generation's age, surface it, never die on it. Restore must be **announced** — a hub that quietly came back from a five-day-old generation and resumed committing is a worse incident than one that refused, because no investigation starts. Restore-before-seed is an **assertion**, not an ordering coincidence: `seedRepo`'s `isEmptyDir` gate is the same condition restore fires on.
- **Validate**: `cd apps/hub && node --test test/boot-decision.test.mjs`

#### Task A2: ADD a `user_version` stamp to the SQLite databases

- **Do**: Stamp `PRAGMA user_version` on each database. (`grep PRAGMA apps/hub/src/` currently returns one hit, `integrity_check`.)
- **Gotcha**: Now-or-never asymmetry — an unstamped database is ambiguous **forever**, so every self-hoster who deploys before this exists creates a db no future migration can safely inspect. Five lines. `maude hub upgrade` is **deferred** (no such asymmetry; strictly easier against already-stamped databases), and `maude hub restore` is **cut** (the boot refusal prints a working copy-pasteable command from output we control).
- **Validate**: `cd apps/hub && node --test test/backup.test.mjs`

### Track B — People in the console (prerequisite for C)

#### Task B1: ADD the People view markup

- **Do**: Seventh nav item + `#view-people`: accounts table (email · role · created · state · live tokens), "Add someone", "Invite by link". Plus the **pending queue** and an **explicit link action** (Track C's safe posture renders here). Plus the remaining durability rows — last generation, age, count, **resolved backup prefix**, unacknowledged-restore notice.
- **Gotcha**: Re-label the existing peer-token "Generate invite" so the two stop reading as one thing — a terminal token for a git peer versus an account for a person. Durability rows go in **Overview/Settings, not an eighth view**.
- **Validate**: `cd apps/hub && node --test test/admin-static.test.mjs`

#### Task B2: WIRE the People view to the existing APIs

- **Do**: `renderPeople()`, `/users` in `refresh()`'s `Promise.all`, handlers for create / disable / enable / password-reset / invite / **promote-pending** / **link-sub-to-account**. Invite `url` renders in a copy-once reveal.
- **Gotcha**: `GET /users` already returns `tokenCount` — render it; it answers "did the offboard take effect."
- **Validate**: `cd apps/hub && node --test test/admin-people.test.mjs`

#### Task B3: ADD strict-identity posture — and RESOLVE the `strict` collision

- **Do**: Hide People under `identity.mode === 'strict'` (the dashboard owns membership there). **Rename one of the two flags.** `identity.mode === 'strict'` (cloud) means *the platform owns people*; `HUB_OIDC_MODE=strict` means *no password login* — under which People is **more** necessary, since somebody must assign the role. Two flags spelled `strict` implying opposite things about the same surface is a bug waiting to be written.
- **Validate**: `cd apps/hub && node --test test/admin-people.test.mjs`

#### Task B4: MEASURE the admin bundle — do not raise the ceiling

- **Do**: Measure and confirm it fits. Current: **22,535 B gz of 28,672 B — 6,137 B headroom**. The OIDC sign-in button lives in `studio-door.mjs`, which is server-rendered and **not in this bundle at all**. A Tokens-modeled People view lands ~2–2.5 KB gz.
- **Gotcha**: The first draft called this "blocking" and it is not. Raising DDR-097's ceiling here would be exactly the drift the test's comment exists to prevent, and it is not needed.
- **Validate**: `cd apps/hub && node --test test/admin-size.test.mjs`

### Track C — BYO identity (after B)

#### Task C1: CREATE `apps/hub/src/oidc.mjs` — discovery + verification via `jose`

- **Do**: Discovery, `createRemoteJWKSet`, `jwtVerify` with **`algorithms: ['RS256']` explicit at the call site** (never a default), `issuer`, `audience`, `nonce` checked.
- **Gotcha**: Keep the `alg: none` / HS256-confusion / wrong-`iss` / wrong-`aud` / expired tests **even though the library handles them** — and say so in the test header, or they read as redundant and get deleted. They stop being correctness tests and become the tripwire against a future maintainer swapping the verifier out. Pin the version.
- **Validate**: `cd apps/hub && node --test test/oidc.test.mjs`

#### Task C2: CREATE `apps/hub/src/oidc-egress.mjs` — the JWKS fetch guard

- **Do**: Pin `jwks_uri` to the issuer's origin, re-check after redirects, and **resolve-then-connect-to-the-resolved-address**, refusing link-local and private destinations. Rate-limit refetch on unknown `kid`.
- **Gotcha**: **A library does not help here** — `createRemoteJWKSet` fetches whatever URL you hand it, so the network half is ours either way. **A hostname regex does not stop DNS rebinding**; Node `fetch` will not resolve-check-connect without a custom lookup/agent. On the EC2 target `aws.mdx` recommends, an unpinned fetch reaches IMDS at `169.254.169.254` — the S3 credentials `_credentials.md` calls the ones with real blast radius. `aws.mdx` must also require IMDSv2 (`HttpTokens=required`, hop limit 1). Model: `curl-local.sh` (DDR-185), inverted.
- **Validate**: `cd apps/hub && node --test test/oidc-egress.test.mjs`

#### Task C3: CREATE the flow — and NEVER auto-link

- **Do**: `GET /auth/oidc/start` (PKCE `S256`, state, nonce) and `/callback` (state, code exchange, verify, `sub` → account, mint the **same** peer token the password login mints, set the `browser-auth.mjs` cookie). **Every unmapped `sub` goes to `oidc_pending` — matching email or not.** Treat the email claim as untrusted display data: require `email_verified === true` and label it IdP-asserted.
- **Gotcha**: **This is the takeover fix. Named test, seen red first against the draft's behaviour: *an OIDC identity whose email claim matches an existing admin account gets `pending` and no session.*** The risk here is bookkeeping — this rule is one sentence, so it survives being implemented from a "Do" line without it. The test is the rule, not the note.
- **Validate**: `cd apps/hub && node --test test/oidc-routes.test.mjs`

#### Task C4: ADD `oidc_pending` as a table, not a fourth role

- **Do**: A separate `oidc_pending` table (`sub`, claimed email, first seen, last attempt), rendered by the People view. Promote creates the real account row.
- **Gotcha**: `assertValidRole` **throws** outside `admin|member`, `role-matrix.mjs` returns NOTHING for unknown roles, and its own comment warns *"the next role added on either side re-opens this"* — referring to the dual-vocabulary bug that already shipped as `readOnly: true` on every session. A separate table keeps `ROLES` at two and touches none of the role-matrix / session-role / read-only-sessions tests.
- **Validate**: `cd apps/hub && node --test test/users.test.mjs test/role-matrix.test.mjs`

#### Task C5: ADD the mode switch — explicit, allowlist mandatory, no double-mode

- **Do**: `HUB_OIDC_MODE=hybrid|strict` (unset = off), `HUB_OIDC_ISSUER`, `HUB_OIDC_CLIENT_ID`, `HUB_OIDC_CLIENT_SECRET`, `HUB_OIDC_ALLOWED_DOMAINS` — **required when `HUB_OIDC_MODE` is set**, not optional. Refuse to boot when `MAUDE_CLOUD_IDENTITY` and `HUB_OIDC_MODE` are both enabled. Refuse `strict` unless at least one account can reach admin.
- **Gotcha**: Explicit, never inferred — `cloud-identity.mjs` documents the exact bug: *"An env var that names a dependency must never double as consent to a behavioral mode."* The two tri-states would otherwise be 9 untested combinations; the boot refusal kills four permanently. An allowlist is a **filter, never a grant** — a permitted domain with no account still lands in `oidc_pending`.
- **Validate**: `cd apps/hub && node --test test/oidc-routes.test.mjs test/cloud-identity.test.mjs`

#### Task C6: ADD the sign-in button + thread OIDC through the scaffolder

- **Do**: `studio-door.mjs` renders "Sign in with <label>" when enabled (server-rendered, no script). `workspace-plan.mjs`: accept the fields, emit them from `envEntries`, forward them in `renderCompose`'s `hubEnv`, add a discovery-reachable verification step.
- **Gotcha**: `hubEnv` is a hand-maintained list — a var written into `.env` but absent there never reaches the container. That exact half-wiring already shipped once with `MAUDE_ADMIN_PASSWORD`; the comment is still in the file. Add to **both**.
- **Validate**: `node --test cli/lib/workspace-plan.test.mjs && cd apps/hub && node --test test/studio-door.test.mjs`

### Track D — documentation and the guided setup skill

#### Task D1: CREATE `plugins/design/skills/self-host/SKILL.md`

- **Do**: Staged interview in the order artboard `onboarding` already draws: (0) plain hub vs workspace — route away honestly if the smaller answer is right · (1) where: laptop / VPS+Docker / AWS EC2 / other · (2) address & TLS · (3) storage **incl. the namespace and the never-expire-`assets/` rule** · (4) identity: built-in or OIDC, with the explicit warning that a verified user still needs a role · (5) seed · (6) durability: backup target, restore-drill schedule, remove `MAUDE_SEED_REPO` after first successful boot · (7) dry run → review → run · (8) hand over `operatorDuties()` in full.
- **Gotcha**: Frontmatter `name: self-host` — bare slug, no plugin prefix (DDR-191). Everything executable goes through `maude hub …` (DDR-062).
- **Validate**: `node --test cli/lib/plugin-name-namespace.test.mjs cli/lib/plugin-cli-reachability.test.mjs`

#### Task D2: CREATE `_credentials.md` + `_targets.md`

- **Do**: Per-choice credential tables — what it is, where to get it, what it may do, where it lands, how to rotate. `HUB_SECRET`, S3 key pair (+ least-privilege IAM policy), ACME email, admin email+password, OIDC client id/secret. `_targets.md`: EC2 not Fargate; gp3 EBS not EFS; `DeleteOnTermination=false`; one task, no autoscaling; ALB terminates TLS and upgrades WebSockets; **IMDSv2 required**.
- **Validate**: covered by D6 + D7.

#### Task D3: UPDATE `hub-workspace.md` to load the skill · Task D4: CREATE the five docs pages + `meta.json` · Task D5: REWRITE `apps/hub/README.md`

- **Do**: One command surface. Pages: `self-host` (umbrella), `aws` (runbook), `identity` (built-in vs OIDC; Auth0 + Google; the authn≠authz rule), `people` (the view, invites-are-links, offboarding in hours), `durability` (what survives what, the boot table, backup identity, the drill).
- **Gotcha**: `deploy.mdx`'s AWS paragraphs must become a pointer to `aws.mdx`, not a duplicate. **`aws.mdx` ships unexecuted** unless someone runs it on a real box — either do that, or say on the page that it is derived rather than driven. `workspace.mdx`'s voice is already willing to name what the tool does not do.
- **Validate**: `pnpm --filter @maude/site build`

#### Task D6: CREATE the docs freshness test

- **Do**: Assert every `HUB_*` / `MAUDE_*` token appearing in `apps/hub/README.md`, `site/content/docs/hub/*.mdx` and the `self-host` skill exists in `apps/hub/src/` or `cli/lib/workspace-plan.mjs`.
- **Gotcha**: This is the difference between docs that rot and docs that break the build when they lie. The plan's own Problem #4 is a README stale since May; five new hand-written pages without a gate is that problem, five times.
- **Validate**: `cd apps/hub && node --test test/docs-env-freshness.test.mjs`

#### Task D7: VERIFY end to end on a laptop

- **Do**: Run the skill against `--local --dev-minio`: interview → dry-run → run → sign in → create a person → invite → redeem in a second profile → edit → confirm the commit → restart → nothing lost → **delete the `/repo` volume → confirm auto-restore returns the work and announces the generation** → point a second hub at the same bucket → **confirm the write-side refusal fires and shows in Overview**.
- **Gotcha**: Per the `maude-verify-regression-tests-fail-first` memory, revert each guard and watch the destructive behaviour happen. The last two steps are the only proof Phase 0 and A' work.
- **Validate**: the run itself.

#### Task D8: RECORD the decisions

- **Do**: `/flow:record-ddr` for: (1) backup generations carry a project identity, refused on write and read; (2) one boot decision in `rehydrate.mjs`, both entrypoints call it; (3) `jose` over a hand-rolled verifier; (4) OIDC never auto-links on a matching email. Each records the four rules verbatim from the Solution section.
- **Validate**: `kg search "backup identity"` returns the new decision.

---

## Validation

Repo gates from `.ai/workflows.config.json` (no `typecheck` gate — `quality.yml` runs no `tsc`):

1. `pnpm format` · 2. `pnpm lint` · 3. `pnpm test && pnpm test:dev-server` · 4. `pnpm --filter @maude/site build` · 5. `bash scripts/check-version-parity.sh` · 6. `bash scripts/check-tarball-shape.sh` · 7. site-content drift regen + clean `git diff` · 8. `cd apps/hub && node --test --test-force-exit test/*.test.mjs`

**Test-run hygiene (memory, both earned the hard way):** run the `apps/studio` `bun test` suite **alone** (`maude-parallel-test-runs-contaminate`); every regression test must be **seen to fail first** (`maude-verify-regression-tests-fail-first`) — especially C3's takeover test and Phase 0's refusals; `git status apps/studio/dist/` before and after any run.

**Not applicable, deliberately:** the 5-platform `scenario-runner` / `agent-device` matrix. The only UI is a desktop operator console on a self-hosted box — no iOS/Android surface, no studio-client change. Substituting a mobile parity check would be theatre. Instead:

9. **`agent-browser` over `/admin`** on a `--local` workspace — People renders, create/disable/invite round-trips, the strict-identity hide, the durability rows, the OIDC button.
10. **`a11y-auditor`** over `/admin`.
11. **Manual**: D7 in full.

---

## Acceptance Criteria

- [ ] **Phase 0 shipped as its own release before any Track lands**
- [ ] Two hubs on one bucket: the second **refuses to write** and says so in Overview and `/admin/api/status` — and **not** via `/health`
- [ ] The backup identity value is provably unique per hub and derives from nothing an operator copies between deployments
- [ ] `/data` intact + `/repo` lost no longer re-seeds (regression test, seen red first)
- [ ] Deleting `/repo` auto-restores, announces the generation and its age, and never dies on staleness
- [ ] `boot-guard.mjs` does **not** exist; the cell's `[ -f /data/hub.db ]` shell test is deleted
- [ ] **An OIDC identity whose email matches an existing admin gets `pending` and no session** — named test, seen red against the draft's auto-link
- [ ] `oidc_pending` is a table; `ROLES` still has two members
- [ ] JWKS fetch cannot reach a link-local address, survives DNS rebinding, and is origin-pinned
- [ ] Admin bundle under its **unchanged** ceiling
- [ ] Docs freshness test green; `aws.mdx` either executed or labelled derived
- [ ] All tasks completed; `/validate` passes; DDRs recorded
- [ ] `pnpm --filter @maude/site gen:roadmap` run and the diff committed alongside
