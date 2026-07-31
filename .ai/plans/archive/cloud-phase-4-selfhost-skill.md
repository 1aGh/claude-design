# Cloud Phase 4 — Self-host provisioning skill (`maude hub workspace-up` + `/design:hub-workspace`)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phases 1–3. This phase keeps the **self-host path first-class** (positioning guard) and doubles as the cell-provisioning engine the cloud reuses in Phase 5.

## Description

"One skill where I add API tokens and done": a deterministic CLI engine + a conversational plugin command that renders the existing deploy templates, wires S3-compatible storage, seeds the repo, boots, and verifies with a real round-trip.

## Metadata

- **Type**: New Capability | **Complexity**: Medium
- **App/Package**: `cli`, `plugins/design`, `apps/hub` (templates), `site` (docs)
- **Dependencies**: Phases 1–3

## Context References

### Must-Read Files

- `cli/commands/hub.mjs` + `cli/lib/hubs-config.mjs` — CLI surface to extend; credential store rules (0600; `trusted` never committable)
- `apps/hub/docker-compose.yml.template`, `Caddyfile.template`, `fly.toml.template`, `Dockerfile` — the templates to render (frozen-lockfile rule is load-bearing)
- `apps/studio/generation/keys.ts` — DDR-164 custody shape for every secret written
- `cli/lib/preflight.mjs` — dep checks pattern
- `plugins/design/CATEGORIES.md` + `cli/lib/plugin-name-namespace.test.mjs` — command naming rules (bare `name:` slug per DDR-191; group prefix)

## Tasks

### Task 1: CREATE `maude hub workspace-up` engine

- **Do**: `cli/commands/hub-workspace.mjs`: interactive + `--json` prompts — domain, S3 endpoint/bucket/key/secret, admin e-mail (+password or OIDC issuer/client/secret), seed repo URL or "start fresh" (`git init` + first commit). Renders compose (hub + workspace-agent + Caddy with `trusted_proxies`; MinIO under a **dev-only** profile) or `fly.toml`. Writes `.env` 0600. Creates bucket + CORS + **no-expiry** policy on `assets/`. Boots, runs DDR-053 bootstrap claim, then the **round-trip verifier**: sentinel canvas via temp token → assert S3 object + git commit + restore-drill pass. Prints one URL + per-teammate invite links. Idempotent re-run = upgrade path.
- **Gotcha**: the skill scaffolds and verifies — it must NOT claim to own key rotation/backup forever; print a short "operator duties" card instead of promising "done" (breaker trap).
- **Validate**: `cli/` node test with MinIO compose — full up→verify→destroy cycle.

### Task 2: CREATE `/design:hub-workspace` command + docs

- **Do**: `plugins/design/commands/hub-workspace.md` (bare `name: hub-workspace`; category per CATEGORIES.md — add a `hub` group there): conversational wrapper driving `maude hub workspace-up` (DDR-062 — plugins reach executable logic via `maude`). Extend `site/content/docs/hub/` with a "Workspace mode" page; update the hub README risk-banner rows for the new posture.
- **Validate**: `cli/lib/plugin-cli-reachability.test.mjs` + `plugin-name-namespace.test.mjs` green; site builds.

## Exit gate

- [x] **No manual template editing** — `maude hub workspace-up` renders `docker-compose.yml`, `Caddyfile` and `.env` (0600) from flags or `--config`, and `--dry-run` shows the whole plan first. Verified live: a real run wrote the files with no literal secret in compose, and a re-run provably REUSED `HUB_SECRET` (the upgrade path — re-minting would lock out every peer holding a token).
- [x] **Docs published; self-host cost table untouched** — `site/content/docs/hub/workspace.mdx` + `meta.json`; `pricing.mdx` unchanged. The site's catalog-parity gate caught the missing `command-catalog.mjs` entry, which is the gate working.
- [x] **Repo quality gates green** — `cli` 237/237, site builds, `plugin-name-namespace` + `plugin-cli-reachability` green, containment gate green.
- [~] **Fresh VPS with a verified round-trip** — PARTIALLY closed (2026-07-29). Booted for real on a local Docker daemon via the new `--local` mode. `health` and `admin-claimed` now execute **against a live stack**, and `user-signin` was verified BY HAND (HTTP 200 + a scoped session token from a real container). The remaining five (`canvas-roundtrip`, `git-commit`, `s3-object`, `s3-no-expiry`, `restore-drill`) still report **skipped** — an unrun check must never print as passed.
  - **The reason those steps had never run was itself the finding.** Verification required a public domain and a certificate, so nobody — including us — could exercise their own workspace before buying one. `--local` (plain HTTP, `HUB_INSECURE_HTTP=1`, no ACME) removes that, and every part of the render says loudly that it is for testing only.
  - **Booting it found a product-stopping bug that all 21 unit tests missed:** `workspace-up` wrote `MAUDE_ADMIN_EMAIL`/`MAUDE_ADMIN_PASSWORD` into `.env`, compose forwarded only the email, and the hub read **neither** — so a freshly provisioned workspace had zero users and the person the operator had just named could not sign in. The command still reported success, because `user-signin` was one of the six `skipped` steps. Fixed by `apps/hub/src/first-user.mjs` (first-boot only, never overwrites, never logs the password) plus forwarding the password through compose.

**Status: CORE COMPLETE** (2026-07-28; exit gate advanced 2026-07-29). The command is usable and honest about what it has and hasn't proven. Three of eight checks are now proven against a live stack; the remaining five are the natural companion to Phase 5's cell work.

## Retro

- **Splitting decisions from effects was the highest-leverage choice.** Almost everything that can go wrong in a provisioner is a decision — a domain that can never get a cert, a missing no-expiry rule, an "it worked" printed too early — and decisions test without a VPS. The Docker-shaped remainder is then small and boring.
- **`skipped` had to be a first-class outcome.** The tempting shortcut is to run the two easy checks and print a green summary. Making "not yet automated" print distinctly is what keeps the exit gate above honest instead of self-congratulatory.
- **The operator-duties card is the anti-"done" mechanism** the breaker seat asked for, and writing it as data (rather than a closing paragraph) meant a test could assert rotation/backups/upgrades/bill are all still named. Worth reusing anywhere a command could be mistaken for ongoing ownership.
- **A site parity gate caught a real omission** (`command-catalog.mjs`) that no unit test would have. Cheap gates over generated content keep paying.
- **`skipped` was honest, and honesty was not enough.** Six unrun checks were reported correctly and still concealed a bug that made the product unusable: nobody could sign in to a workspace the command had just called verified. An unrun check is not a neutral gap — it is where the bugs are, by construction. The lesson for DDR-196 §2: reporting `skipped` buys the right to ship, not the right to stop.
- **The fixture wrote the assumption again.** 21 unit tests covered the render, and every one asserted what the file *contains*. None asserted that the container *consumes* it. Rendering a variable nothing reads passes every string test there is.
- **For `/plan` next time:** the plan said "test with MinIO compose". For the third phase running, making the dependency optional (here: profile-gated, and the decisions tested without it) removed an infrastructure requirement with no loss of coverage.
