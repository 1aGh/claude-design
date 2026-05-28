---
"@1agh/maude": minor
---

Phase 9 Tasks 7–11 — hub deploy tooling, hub-down offline mode, linked-mode gitignore,
contributor dev workflow, and real-hub integration tests. Completes the phase-9
self-hostable-hub feature work.

**Deploy (Task 7):** `maude hub deploy fly|docker` emits ready-to-run config
(`Dockerfile`, `fly.toml`, `docker-compose.yml` + `Caddyfile`) with placeholders
substituted, then prints the exact next commands — it never runs `fly`/`docker` for you.
`maude hub token rotate --label <name>` mints a fresh value for an existing label. A new
CI workflow publishes a multi-arch (amd64 + arm64) `ghcr.io/1agh/maude-hub` image on every
release tag. New docs at `/docs/hub` (deploy recipes for Fly / AWS Lightsail / EC2+ALB /
Hetzner / DigitalOcean / Coolify / Cloudflare-Tunnel, a pricing table, and the
link/adopt/unlink/status + offline-mode UX). The release image now installs from a committed
`bun.lock` with `--frozen-lockfile` (no fresh dependency resolution at build time).

**Hub-down offline mode (Task 8):** when the hub becomes unreachable, the linked-mode sync
runtime enters offline mode — local edits keep working and queue, a yellow canvas banner
shows the queued-edit count, and on reconnect a green "Synced" flash clears it (escalating to
a red "consider git commit && push" banner after 24h offline). `maude design status` reports
the live state. A hub-wins reconcile that overwrites divergent local content now surfaces a
conflict notice.

**Linked-mode gitignore (Task 9):** a single `full` strategy (DDR-056) — canvases + their JSON
snapshots stay in git (cold backup, PR-reviewable diffs, bootstrap-from-clone) while
regenerable per-machine runtime state is ignored. `maude design init` and `maude design link
--adopt` write an idempotent `# maude:begin/end` block.

**Contributor workflow (Task 10):** `plugins/design/hub/CONTRIBUTING.md` (plain-Node + Docker
levels); `maude hub serve --dev` is zero-config.

Solo (unlinked) projects are unaffected — the sync runtime is a no-op and the offline banner
never renders.
