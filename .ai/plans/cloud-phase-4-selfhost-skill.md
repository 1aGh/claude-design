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

- [ ] Fresh VPS (or Fly app): `maude hub workspace-up` → working workspace with verified round-trip, no manual template editing
- [ ] Docs published; self-host cost table untouched
- [ ] Repo quality gates green (`lint`, `tests`, `build`, parity/tarball)
