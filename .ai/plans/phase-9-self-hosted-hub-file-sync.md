# Phase 9 (v1.1 work): Self-hostable hub + bidirectional file sync

> **Not in v1.0 MVP.** Ship target: ~6-8 weeks after v1.0 GA. This is the headline v1.1 deliverable — the "deploy your own collab server" story.

## Description

Make collaboration usable across the internet without exposing anyone's laptop, without requiring SaaS, without making contributors learn Yjs / PartyKit / Hocuspocus. Three pieces:

1. **`maude hub serve`** — long-running self-hostable service. Wraps **Hocuspocus** (`@hocuspocus/server`, MIT, Node-native — see `.ai/docs/research-collab.md` § Self-hostable framework comparison for why not PartyKit). Persists Yjs state per canvas via `@hocuspocus/extension-sqlite`. Token-based auth. TLS via Caddy or Cloudflare Tunnel.
2. **`maude hub deploy <target>`** — one-shot deploy recipes. Emits `fly.toml` / `docker-compose.yml` / `systemd` unit. Targets: `fly` (primary), `docker`, `systemd`, `tailscale-funnel`, `cloudflare-tunnel`. ~$0.45-5/mo run cost on Fly free-ish tier.
3. **`maude design link <hub-url>`** + **bidirectional file sync agent** — peer command that pairs the local clone with a hub. After link, the existing `maude design serve` does double duty: serves the local browser UI AND keeps `.design/*.html` mirrored against the hub's Yjs state. Claude Code on the peer never sees Yjs — it reads / writes plain files via `Read` / `Edit` / `Write` exactly as today.

**Key insight from research:** v1.1 treats HTML body as opaque `Y.Text`, not structured `Y.XmlFragment`. Round-trip drift would otherwise cause infinite sync churn. Structured CRDT for true element-level co-editing is Phase 10 (v1.2) — and only if v1.1 incidents prove it's needed.

## User Story

As an indie dev who wants to collaborate with a designer in another timezone, I want to run `maude hub deploy fly` once, share the resulting URL with my designer, and have her run `maude design link <url>` in her clone of the repo — so that her browser sees the same canvases I see, her local `.design/` mirrors mine automatically, and Claude Code on her laptop can read/write design files just like mine does. No SaaS account, no PartyKit install, no Yjs knowledge required.

## Problem

- Phase 8's LAN model requires peers on the same network or a Tailscale-style overlay. Designer in Tokyo + dev in Prague need a meeting point.
- Browser-only access (Phase 8) means the remote peer's Claude Code doesn't have local access to design files — can't `Edit` them, can't `Read` them, can't run `/design` flow locally.
- Existing collab tools (Liveblocks, PartyKit Cloud) are SaaS lock-ins; PartyKit framework's "run anywhere" claim falls apart on plain VPS (requires Cloudflare account).
- Hocuspocus exists and is production-tested but Yjs / Hocuspocus configuration is too much for a "I just want to share a canvas" user.

## Solution

Hide all Yjs / Hocuspocus complexity behind two `maude` commands. Bundle a pre-configured Hocuspocus server as `maude hub serve`. Bundle a Yjs client + file watcher into `maude design serve` (already exists; just adds linked-mode behavior when a hub URL is configured).

### Architecture

```
Alice laptop                      Self-hosted hub                  Bob laptop
┌──────────────────┐           ┌──────────────────────┐         ┌──────────────────┐
│ Browser canvas   │←──WSS────→│ maude hub serve       │←──WSS───│ Browser canvas   │
│ Claude Code      │           │ (Hocuspocus +        │         │ Claude Code      │
│ maude design serve│←──WSS────→│  SQLite at /data)    │←──WSS──→│ maude design serve│
│  ├ Yjs client    │           │                      │         │  ├ Yjs client    │
│  ├ fs watcher    │           │ Token auth           │         │  ├ fs watcher    │
│  └ sync agent    │           │ TLS via Caddy        │         │  └ sync agent    │
│ .design/ on disk │  bidir    │                      │  bidir  │ .design/ on disk │
│ (git-tracked)    │   sync ←──┤ /data/<canvas>.ydoc  ├──→ sync │ (git-tracked)    │
└──────────────────┘   ↕       └──────────────────────┘     ↕   └──────────────────┘
       │                                                          │
       └─── git push / pull (independent, asynchronous) ──────────┘
```

**Three-times mental model (preserved from Phase 8):**
1. **Live (Y.Doc)** — canonical on hub, replicated on every connected peer.
2. **Disk (`.design/*.html`)** — each peer's local mirror, generated from Y.Doc at 800ms quiescence. **This is what Claude Code reads.**
3. **Git** — peer-local history of disk savepoints. Independent per peer; reconciled via `git push` / `pull` as usual.

The sync layer guarantees: live state → disk state on every quiescence. Disk state → live state on every fs.watch event from a non-self origin. Echo prevention via SHA-256 origin tags (see Task 4).

### What the user actually does

```sh
# One-time on a VPS or fly.io account
maude hub deploy fly
# → emits fly.toml, prints HUB_URL + TOKEN + invite command to share

# On each peer's laptop, inside the repo
maude design link https://maude-hub-foo.fly.dev --token=abc123
# → tests connection, first-sync, writes .design/config.json.linkedHub
# → starts a linked maude design serve in background OR prompts to start

# Daily workflow stays the same
cd ~/repo
maude design serve              # browser opens; canvas live with hub
# Claude Code in another terminal:
/design "make CTA red"          # writes to .design/screen.html locally
                                # → fs watcher detects → pushes to hub
                                # → hub broadcasts → Bob's agent writes Bob's disk
                                # → Bob's browser updates from his disk reload OR live Yjs update
```

## Migration from Phase 8 LAN mode

A user who has been running Phase 8 LAN mode (no hub) and now wants to enable hub federation goes through:

1. **Existing state**: Peer running Phase 8 has local `.design/_state/<slug>.ydoc.bin` files from prior LAN sessions (binary CRDT logs containing comment history, annotations).
2. **Deploy hub**: `maude hub deploy fly` (or any other target) — creates empty hub, prints URL + token.
3. **Adopt from existing local state**:
   ```sh
   maude design link <url> --token=... --adopt
   ```
   - Agent detects hub is empty AND local `.ydoc.bin` files exist for this project.
   - Pushes the entire Y.Doc state from local `.ydoc.bin` to hub (preserves comment history, annotations, layout).
   - Hub becomes seeded from this peer's local state.
   - JSON snapshot files (`.design/_comments/*.json`, `.design/<slug>.annotations.svg`) remain unchanged on disk.
4. **Other peers join**: Previously LAN-only collaborators run `git pull` to get the `linkedHub` config commit, then:
   ```sh
   maude design link --use-config --token=...
   ```
   - Hub is now canonical; their local state reconciles via Yjs sync v2.
   - Commutative merge — no data loss expected for comments / annotations (additive operations).
   - HTML body conflicts (rare in LAN model since `--bind` was opt-in) resolved last-write-wins.
5. **LAN endpoint deprecation**: After successful hub adoption, peers no longer need `--bind 0.0.0.0` on their local dev servers — they connect to hub for sync. Loopback dev server still serves browser UI as usual.

**No data loss expected.** The `_state/<slug>.ydoc.bin` is the migration vehicle — a complete CRDT log of the LAN session that hub adopts wholesale. Snapshots on disk (`.json`, `.svg`) remain authoritative reference for git history.

**Edge case — long-disconnected LAN peer.** If a peer was in a LAN session days ago and only now reconnects after the team has done much hub work: their `.ydoc.bin` is stale. The peer's `maude design link --use-config` triggers Yjs sync v2 → server-side state vector wins on conflicting attributes, but the peer's comments / annotations added during disconnection are merged in additively. Document this in the linking command UX as "merging X local changes into hub state".

---

## Metadata

- **Type:** New Feature (largest in v1.1)
- **Complexity:** Very High
- **Depends on:** Phase 8 (Yjs runtime + Awareness layer already present), Phase 1 (workspace + bundler infra — `plugins/design/hub/` slot pre-reserved in Phase 1 Task 0)
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/hub/` (new workspace — `pnpm-workspace.yaml` extended)
    - `plugins/design/hub/package.json` (private; deps: `@hocuspocus/server`, `@hocuspocus/extension-sqlite`)
    - `plugins/design/hub/src/server.mjs` (entry — wraps Hocuspocus)
    - `plugins/design/hub/src/auth.mjs` (token verification, rate limiting)
    - `plugins/design/hub/Dockerfile`
    - `plugins/design/hub/fly.toml.template`
    - `plugins/design/hub/docker-compose.yml.template`
    - `plugins/design/hub/Caddyfile.template`
  - `plugins/design/dev-server/runtime/sync/` (new — Yjs client + fs watcher + echo prevention)
  - `plugins/design/dev-server/server.mjs` (extended — linked-mode behavior; detects `.design/config.json.linkedHub` and connects on boot)
  - `cli/commands/hub.mjs` (new — `maude hub serve|deploy|token|status`)
  - `cli/commands/design.mjs` (extended — `link|unlink|status|adopt` subcommands)
  - `plugins/design/dev-server/config.schema.json` (extends `linkedHub` field)
  - `.design/config.json` (committed — adds `linkedHub: { url, projectId }` when linked)
  - `~/.config/mdcc/hubs.json` (per-machine, NEVER committed — stores `{ url: token }` pairs)
  - `docs/site/content/docs/hub-deploy.mdx` (Phase 2 deploy recipes)
  - `docs/site/content/docs/linking.mdx` (Phase 2 link / unlink UX)

---

## Tasks

### Task 0: Architectural DDR — Hocuspocus over PartyKit

- **Do:** Record DDR explaining the rejection of PartyKit (research-collab.md § Self-hostable framework comparison): `partyserver` is hard-coupled to Cloudflare Workers / Durable Objects; "run anywhere" claim breaks on plain VPS. Hocuspocus chosen for: production-proven (TipTap's collab backend), Node-native, MIT, `extension-sqlite` for zero-config persistence, `extension-redis` available later if hub needs to scale horizontally.
- **Validate:** DDR in `.ai/decisions/`, signed off.

### Task 1: Hub workspace + Hocuspocus skeleton

- **Do:** Add `plugins/design/hub/` to `pnpm-workspace.yaml`. Stub `package.json` (`"private": true`, `"name": "@maude/hub"`). Install `@hocuspocus/server`, `@hocuspocus/extension-sqlite`. Write `src/server.mjs` that instantiates Hocuspocus with: SQLite persistence at `/data/<project-id>/`, token auth via `onAuthenticate`, awareness enabled. Listens on `$PORT` (default 1234). esbuild bundles to `dist/hub.bundle.mjs` so the published npm tarball ships the hub binary.
- **Pattern:** `https://tiptap.dev/docs/hocuspocus/server/configure` — copy the canonical setup.
- **Validate:** `node plugins/design/hub/dist/hub.bundle.mjs` boots on `localhost:1234`. Two `y-websocket` clients can connect and sync.

### Task 2: `maude hub serve|deploy|token|status`

- **Do:** `cli/commands/hub.mjs` exposes:
  - `maude hub serve [--port N] [--data <path>] [--token <hex>] [--insecure-http]` — runs the bundled Hocuspocus locally (for testing, LAN deploy, or contributor dev). `--insecure-http` allows non-TLS for localhost dev.
  - `maude hub deploy fly|docker|systemd|tailscale|cloudflare` — emits the corresponding template, runs the deploy CLI if available (`fly launch` etc.) or prints next steps.
  - **`maude hub token <subcommand>`** — full lifecycle:
    - `maude hub token generate [--project <id>] [--label <name>]` — generates 32-byte hex token, stores HMAC hash on hub side (in SQLite `tokens` table with `created_at`, `project`, `label`, `last_used`), prints raw token ONCE (warning: "this is shown only now, copy it"). Token format: `mau_<32hex>` (recognizable prefix).
    - `maude hub token rotate <token-id|label>` — invalidates old token, generates replacement. Peers see "auth expired, re-link" notification.
    - `maude hub token list` — shows all active tokens (label, project, created, last-used; never the raw token).
    - `maude hub token revoke <token-id|label>` — immediate kill (HMAC removed from SQLite). Connected peers get disconnected on next heartbeat.
  - `maude hub status [<url>]` — pings hub, shows uptime / persisted canvases / version / active connections.
- **Pattern:** Token UX mirrors `gh auth token` + `ghcr` PAT scoping. Each deploy target is a templated config file (substitutes `IMAGE_TAG`, `VOLUME_SIZE`, `REGION`) + a "what to run next" message.
- **Auth scope:** A token grants access to ALL projects unless created with `--project <id>` (then it's project-scoped). Default = workspace-wide; project-scoped recommended for external collaborators.
- **Validate:** End-to-end: `maude hub deploy fly` on a clean fly.io account succeeds; `maude hub status <url>` returns OK; `maude hub token rotate` disconnects peers within 5s.

### Task 3: `maude design link|unlink|status|adopt`

- **Do:** `cli/commands/design.mjs` extends:
  - `maude design link <url> --token <hex>` — pings hub, performs first-sync handshake (hub state vs local disk: hub-wins by default; `--peer-wins` flag to push local up first; `--adopt` to push local up unconditionally if hub is empty); writes `.design/config.json.linkedHub`; stores token in `~/.config/mdcc/hubs.json`; prints "you're linked"
  - `maude design unlink` — removes linkedHub from config + drops the token; local files untouched
  - `maude design status` — shows hub URL, last successful sync, pending ops queue size, conflict state if any
  - `maude design adopt <url> --token <hex>` — explicit "I am the source of truth, overwrite hub state with my disk" for first-time bootstrap from a populated repo
- **Pattern:** Same UX rhythm as `git remote add` + `git push --set-upstream origin main` — familiar to engineers.
- **Validate:** Round-trip linking, unlinking, status all work locally against `maude hub serve`.

### Task 4: Bidirectional file sync agent (the hard part)

- **Do:** In `plugins/design/dev-server/runtime/sync/`:
  1. **Yjs client** — connects to hub via Hocuspocus client lib (`@hocuspocus/provider`); per canvas a Y.Doc is loaded.
  2. **fs.watch / chokidar watcher** — observes `.design/*.html`, `.design/_comments/*.json`, `.design/_annotations/*.svg`. Debounced 250ms.
  3. **Echo prevention** — before writing a file from a Yjs update, agent records `sha256(bytes)` in `recentRemoteWrites: Map<filepath, { hash, expiresAt }>`. On fs.watch fire, agent computes `sha256(fileBytes)`; if it matches a pending entry within 1500ms, drop the event (it's our own write). If no match, treat as user/Claude edit; push to Y.Doc.
  4. **Atomic writes** — agent writes to `<filepath>.tmp` then `renameSync` to final path. Claude Code's `Write` tool does NOT currently use this pattern (writes are not atomic in Node by default); document this as known minor risk + accept (fs.watch usually fires after rename in macOS / Linux; Windows is more fragile — document).
  5. **Cold start** — on `maude design serve` boot with a linkedHub: open Y.Doc from hub, read disk into agent memory, compare hash with Y.Doc snapshot → either accept hub (default), accept disk (`--peer-wins` in link), or open a 3-way merge prompt.
  6. **Y.Doc → disk codec** — for v1.1, treat HTML body as `Y.Text` (no parse / serialize asymmetry). On Y.Doc text update → write to disk at 800ms quiescence. Comments/annotations stay as Y.Array → JSON snapshot.
- **Pattern:** Echo prevention is borrowed from Syncthing's "weak hash + sequence number" approach. Chokidar's `awaitWriteFinish` option handles partial writes.
- **Validate:** Stress test: `for i in {1..100}; do echo "<button>$i</button>" > .design/screen.html; sleep 0.1; done` → hub state matches final write; no echo loop; no missed events.

### Task 5: Awareness layer on hub

- **Do:** Same Awareness UX as Phase 8 (cursors, selections, viewport, "Claude is editing" banner) but now the hub is the relay. The dev server forwards browser Awareness frames to the Hocuspocus connection's awareness channel; receives others' frames back.
- **Validate:** Two peers linked to same hub from different cities: see each other's cursors within 100ms over WSS.

### Task 6: Auth + transport hardening

- **Do:** Hub-side: `onAuthenticate({ token, documentName }) → verifies token` (HMAC-SHA256 against `HUB_SECRET` env). Rate limit: 100 req/min per token. WSS mandatory unless `HUB_INSECURE_HTTP=1` env (for testing).
- **TLS** options documented:
  - Fly deploy uses Fly's auto-cert
  - Docker / VPS uses Caddy with `acme_email` env for auto-Let's Encrypt
  - Cloudflare Tunnel terminates TLS upstream
  - Tailscale Funnel ditto
- **Validate:** Wrong token rejected with HTTP 401 on WS upgrade. Rate limit kicks in. HTTP (non-WSS) refused on production deploys.

### Task 7: One-click deploy templates + docs

- **Do:** Concrete templates committed to `plugins/design/hub/`:

  **`Dockerfile`** — production multi-stage build:
  ```dockerfile
  # Stage 1: build (only if not using pre-built bundle from npm)
  FROM node:20-alpine AS builder
  WORKDIR /build
  COPY package.json pnpm-lock.yaml ./
  COPY plugins/design/hub/ ./plugins/design/hub/
  RUN corepack enable && pnpm install --frozen-lockfile --filter @maude/hub
  RUN pnpm --filter @maude/hub build

  # Stage 2: runtime
  FROM node:20-alpine
  RUN apk add --no-cache tini sqlite-libs
  WORKDIR /app
  COPY --from=builder /build/plugins/design/hub/dist/hub.bundle.mjs ./
  VOLUME ["/data"]
  ENV PORT=1234 DATA_DIR=/data NODE_ENV=production
  HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:1234/health || exit 1
  EXPOSE 1234
  USER node
  ENTRYPOINT ["/sbin/tini", "--"]
  CMD ["node", "hub.bundle.mjs"]
  ```
  Image published as `ghcr.io/1agh/maude-hub:vX.Y.Z` + `:latest` on every release tag (multi-arch: amd64 + arm64 via buildx).

  **`fly.toml.template`** — `auto_stop_machines = "stop"`, 3GB volume at `/data`, primary region from user, internal port 1234.

  **`docker-compose.yml.template`** — production stack with TLS:
  ```yaml
  services:
    hub:
      image: ghcr.io/1agh/maude-hub:latest
      restart: unless-stopped
      environment:
        HUB_SECRET: ${HUB_SECRET}
        PUBLIC_DOMAIN: ${PUBLIC_DOMAIN}
      volumes: ["hub-data:/data"]
      expose: ["1234"]
    caddy:
      image: caddy:2-alpine
      restart: unless-stopped
      ports: ["80:80", "443:443"]
      volumes:
        - "./Caddyfile:/etc/caddy/Caddyfile:ro"
        - "caddy-data:/data"
        - "caddy-config:/config"
      depends_on: [hub]
  volumes:
    hub-data: {}
    caddy-data: {}
    caddy-config: {}
  ```

  **`Caddyfile.template`** — autocert + WS upgrade:
  ```
  {$PUBLIC_DOMAIN} {
    reverse_proxy hub:1234 {
      header_up X-Real-IP {remote_host}
    }
    encode gzip
  }
  ```

  **`systemd/maude-hub.service.template`** — for raw VPS where user runs Caddy / Nginx separately for TLS.

  **`cloudflared.template`** + **`tailscale-funnel.md`** recipes for no-public-IP home servers.

- **Pricing analysis doc** at `docs/site/content/docs/hub-pricing.mdx`: Fly free tier behavior, Render free tier (sleep after 15min idle), Railway $5/mo trial, Coolify on $5 VPS as cheapest sovereign option.
- **Validate:** Each template produces a working hub when followed end-to-end. CI smoke tests the Fly deploy on every release tag.

### Task 8: Conflict resolution UX

- **Do:** Scenarios with explicit handling:
  - **`git pull` brings new disk state while linked.** Agent detects file hash differs from last-known-Y.Doc snapshot. Prompts: "Local changes from git pull. Sync up to hub? [Push to hub / Discard local and accept hub / Abort]". Default 30s timeout → push.
  - **Hub disk wiped, restored from backup.** Peer reconnects, sees Y.Doc state-vector older than its local. Yjs sync v2 merges peer ops onto hub (peer-as-cold-backup pattern, automatic, no UX).
  - **Two peers offline + diverged via git.** When both come online, last-write-wins on hub (with Yjs merge); a notification surfaces to the disadvantaged peer.
  - **Token rotation.** `maude hub token --rotate` invalidates all existing peer tokens; peers see "auth expired, re-link" notification.
- **Validate:** Each scenario walked through in test harness.

### Task 9: Gitignore strategy + `collab.commitStrategy` config option

- **Do:** DDR + implementation for "what stays in git vs what doesn't" in linked mode.
- **Default strategy = `"full"`** (recommended for all teams):
  ```gitignore
  # Maude design plugin runtime — gitignored even in linked mode
  .design/_state/                # binary CRDT logs (regenerable from hub)
  .design/_server.json
  .design/_server.log
  .design/_active.json
  .design/_history/
  .design/_chat/                 # Phase 7 ACP transcripts (per-machine)
  ```
  Committed:
  ```
  .design/config.json            # contains linkedHub URL — shared via git
  .design/*.html                 # canvases (live-synced AND git-tracked)
  .design/*.layout.json          # Phase 4 spatial layout
  .design/*.annotations.svg      # Phase 5 draw layer (JSON snapshot from Y.Doc)
  .design/_comments/*.json       # Phase 6 comments (JSON snapshot from Y.Doc Y.Array)
  .design/system/                # design tokens
  ```
- **Alternative `collab.commitStrategy: "hub-only"`** — opt-in for teams who don't want canvas content in git (rare; mostly large binary-heavy projects):
  - Generates extra `.gitignore` entries for `.design/*.html`, `.design/*.layout.json`, etc.
  - Only `.design/config.json` + `.design/system/` stay in git
  - Hub becomes the canonical source; clone-without-hub-access yields an empty canvas state
  - `maude design link` then pulls everything fresh
- **Alternative `collab.commitStrategy: "manual"`** — generates no `.gitignore` entries; team curates ignore rules themselves.
- **Implementation:**
  1. `maude init` (or `maude design link --adopt`) writes the appropriate `.gitignore` rules. Idempotent — re-running doesn't duplicate.
  2. Switching strategies via `maude config set collab.commitStrategy <value>` + `maude design sync-gitignore` (regenerates `.gitignore` block between `# maude:begin` and `# maude:end` markers; preserves user's other gitignore rules).
  3. Solo→linked transition (`maude design link --adopt`): if `.gitignore` lacks runtime rules, prompt "Add Maude gitignore block? [Y/n]". Yes → write block. User can edit anytime.
  4. Linked→solo (`maude design unlink`): leave `.gitignore` intact; runtime rules are harmless in solo mode (the gitignored files just don't exist).
- **DDR rationale:** Cold backup, PR review value, bootstrap-from-clone all argue for keeping `.html` in git. `hub-only` is opt-in for unusual cases.
- **Validate:**
  - Fresh repo + `maude init` writes correct `.gitignore` block.
  - Switching `commitStrategy: hub-only` adds extra rules; switching back to `full` removes them.
  - `maude design unlink` doesn't touch user-authored gitignore content outside markers.

### Task 10: Local development workflow for hub

- **Do:** End-to-end recipe for contributors testing the hub without a Fly account. Three nested levels of fidelity:

  **Level 1 — fastest iteration (no Docker, plain Node):**
  ```sh
  # Terminal A — run hub
  pnpm --filter @maude/hub dev   # watch mode via esbuild + node --watch
  # Hub serves on http://localhost:1234, --insecure-http accepted

  # Terminal B — generate test token
  maude hub token generate --hub http://localhost:1234 --label dev-test
  # Prints: mau_a3f9c8b2...

  # Terminal C — peer with linked repo
  cd /tmp/test-project
  maude init
  echo '<button>test</button>' > .design/screen.html
  maude design link http://localhost:1234 --token mau_a3f9c8b2... --adopt

  # Terminal D — second peer simulating second user
  cd /tmp/test-project-2   # different clone of same repo
  git clone /tmp/test-project .
  maude design link --use-config --token mau_a3f9c8b2...

  # Now edits in either terminal C or D propagate.
  ```

  **Level 2 — Docker-compose stack (closer to production):**
  ```sh
  # In plugins/design/hub/ — committed dev compose file:
  cp docker-compose.dev.yml docker-compose.yml
  # docker-compose.dev.yml binds 1234 to host, no Caddy, no TLS
  docker compose up
  # → hub available at http://localhost:1234
  # Same linking flow as Level 1
  ```

  **Level 3 — full production-like stack (TLS via mkcert + Caddy):**
  ```sh
  # Install mkcert (one-time)
  brew install mkcert nss
  mkcert -install
  mkcert hub.localhost
  # Move certs into ./plugins/design/hub/dev/certs/

  # docker-compose.dev-tls.yml mounts the certs into Caddy
  docker compose -f docker-compose.dev-tls.yml up
  # → hub available at https://hub.localhost (trusted by browser)
  # Tests full WSS flow including cert validation
  ```

- **Bonus:** `maude hub serve --dev` shortcut that runs hub on `localhost:1234` with auto-generated dev token (`mau_dev_<random>`), prints the full `maude design link` invite, and skips authentication enforcement when token starts with `mau_dev_` (with red warning banner in logs). Reduces contributor onboarding to one command.
- **Contributor doc:** `plugins/design/hub/CONTRIBUTING.md` covers the three levels + common gotchas (Docker on macOS volume perf, fs.watch behavior on Linux containers).
- **Validate:**
  - Fresh contributor following Level 1 docs from `pnpm i` to first cross-terminal sync in < 5 minutes.
  - Level 3 catches WSS / TLS issues that Level 1 would miss.
  - `maude hub serve --dev` works without any config files.

### Task 11: Stress + integration tests

- **Do:** Test matrix:
  - 5 peers × hub × 1 hour with random ops every 5s → hub stable, all peers converge, no echo loops
  - WS drop / reconnect 100× → ops queue and replay correctly
  - Hub restart with persistence intact
  - Hub deploy on Fly + 2 cross-continent peers connect successfully
  - Token rotation mid-session → peers gracefully reconnect with new token
  - `collab.commitStrategy` switching: `full` ↔ `hub-only` ↔ `manual` — gitignore regeneration idempotent
- **Validate:** All pass in CI nightly.

---

## Validation

1. **Static:** Bundle sizes — hub `dist/hub.bundle.mjs` ≤ 5MB (Hocuspocus + SQLite + deps); agent sync delta in dev-server bundle ≤ 100KB gz.
2. **Functional:** Full flow `maude hub deploy fly` → `maude design link` → cross-machine edit visible in <500ms.
3. **Stress:** 5 peers × 1 hour passes (no echo, bounded growth).
4. **Cross-platform scenario:** `hub-cross-continent-edit` web-desktop, web-mobile.
5. **A11y:** `maude design status` output is structured (parseable); `--json` flag for tooling.
6. **Security:** Token verification on every connection; rate limit verified.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `hub-bootstrap-from-empty` | Deploy hub → first peer links from populated repo → second peer links empty → second peer's disk populated | 🆕 new |
| `hub-cross-continent-edit` | Two peers on different ISPs linked to same hub on Fly → A's `/design` edit appears in B's disk + browser within 1s | 🆕 new |
| `hub-pull-conflict` | A linked, B does `git pull` introducing different file → conflict prompt → resolve via push | 🆕 new |
| `hub-restart-resilience` | Hub `fly machines restart` mid-session → peers reconnect → no ops lost | 🆕 new |
| `hub-unlink-resume-solo` | Peer `maude design unlink` → continues solo with local files intact → re-links later → state reconciles | 🆕 new |

---

## Acceptance criteria

- [ ] DDR signed off: Hocuspocus over PartyKit.
- [ ] `maude hub serve` boots locally; `maude hub deploy fly` produces a working hub.
- [ ] `maude design link / unlink / status / adopt` all functional.
- [ ] Bidirectional file sync passes 100-event stress test with no echo loops.
- [ ] Atomic write semantics documented; Windows fragility called out.
- [ ] First-sync conflict UX (hub-wins / peer-wins / adopt) all reachable.
- [ ] Awareness layer over WSS works cross-continent in scenario test.
- [ ] One-click deploy templates: `fly`, `docker`, `systemd`, `tailscale`, `cloudflare` — each tested end-to-end.
- [ ] Pricing doc accurate (Fly free-tier behavior, Render, Railway, Coolify).
- [ ] All five scenarios pass.
- [ ] Solo workflow regression-tested — unlinked repos behave identically to v1.0.
- [ ] `~/.config/mdcc/hubs.json` per-machine token storage works on macOS / Linux / Windows.
- [ ] Decision-trigger documented for moving to Phase 10 (structured CRDT) — record the kind of incident that would justify the v1.2 jump.
- [ ] `maude hub token generate|rotate|list|revoke` fully implemented; HMAC-hashed storage; per-project scoping verified.
- [ ] Gitignore strategy DDR signed off; `collab.commitStrategy` default = `"full"`; alternate strategies (`hub-only`, `manual`) tested.
- [ ] `maude hub serve --dev` works zero-config; contributor onboarding < 5 min to first cross-terminal sync.
- [ ] Multi-arch Docker image (`amd64` + `arm64`) published on every release tag to GHCR.
- [ ] Three-level local dev workflow (plain Node, Docker compose, Docker + mkcert TLS) documented in `plugins/design/hub/CONTRIBUTING.md`.
- [ ] Phase 8 → Phase 9 migration scenario tested end-to-end (`.ydoc.bin` adoption preserves comment history + annotations from a real Phase 8 LAN session).
