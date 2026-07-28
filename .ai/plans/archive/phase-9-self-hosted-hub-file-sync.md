# Phase 9 (v1.1): Self-hostable hub + bidirectional file sync — THE collaboration story

> **Not in v1.0 MVP.** Ship target: ~4-5 weeks after v1.0 GA (downscoped from initial 6-8 estimate by cutting systemd template, tunnel templates, `hub-only`/`manual` commitStrategy, full token CRUD, Level-3 contributor dev). This is the **only cross-machine collaboration path** in Maude — Phase 8 is loopback-only. For v1.0 users, collab handoff = git. For v1.1, collab handoff = deploy a hub. There is no LAN-tunnel middle ground.

## Description

Make collaboration usable across the internet without exposing anyone's laptop, without requiring SaaS, without making contributors learn Yjs / PartyKit / Hocuspocus. Three pieces:

1. **`maude hub serve`** — long-running self-hostable service. Wraps **Hocuspocus** (`@hocuspocus/server`, MIT, Node-native — see `.ai/docs/research-collab.md` § Self-hostable framework comparison for why not PartyKit). Persists Yjs state per canvas via `@hocuspocus/extension-sqlite`. Token-based auth. TLS via Caddy or upstream cloud LB.
2. **`maude hub deploy <target>`** — one-shot deploy recipes. Emits `fly.toml` or `docker-compose.yml`. Targets: `fly` (primary one-command), `docker` (universal — works on AWS Lightsail / EC2, Hetzner, DigitalOcean, Coolify, Render, home server). Run cost: ~$0.45/mo on Fly free-ish tier (256MB arm), ~$4-6/mo on AWS Lightsail t4g.nano or Hetzner CX11.
3. **In-hub admin UI** — vanilla-JS single-HTML-page (`/admin`) bundled into the hub binary. First-run bootstrap link printed to logs; subsequent visits auth via `HUB_SECRET`. User opens browser → "Generate invite" button → modal with one-time token + copy-paste `maude design link` command + QR code. Removes friction of SSH-ing into hub to run CLI token commands.
4. **`maude design link <hub-url>`** + **bidirectional file sync agent** — peer command that pairs the local clone with a hub. After link, the existing `maude design serve` does double duty: serves the local browser UI AND keeps `.design/*.html` mirrored against the hub's Yjs state. Claude Code on the peer never sees Yjs — it reads / writes plain files via `Read` / `Edit` / `Write` exactly as today.

**Key insight from research:** v1.1 treats HTML body as opaque `Y.Text`, not structured `Y.XmlFragment`. Round-trip drift would otherwise cause infinite sync churn. Structured CRDT for true element-level co-editing is Phase 10 (v1.2) — and only if v1.1 incidents prove it's needed.

## User Story

As an indie dev who wants to collaborate with a designer in another timezone, I want to run `maude hub deploy fly` once, open the printed hub URL in my browser, click "Generate invite" to get a copy-paste `maude design link` command, send it to my designer over Slack, and have her paste it into her terminal — so that her browser sees the same canvases I see, her local `.design/` mirrors mine automatically, and Claude Code on her laptop can read/write design files just like mine does. No SaaS account, no PartyKit install, no Yjs knowledge required, no SSH-into-the-hub required to generate tokens.

## Problem

- Phase 8 is loopback-only — two collaborators in different locations have no live-collab path in v1.0 (only git push/pull). Designer in Tokyo + dev in Prague need a meeting point.
- Existing collab tools (Liveblocks, PartyKit Cloud) are SaaS lock-ins; PartyKit framework's "run anywhere" claim falls apart on plain VPS (requires Cloudflare account).
- Hocuspocus exists and is production-tested but Yjs / Hocuspocus configuration is too much for a "I just want to share a canvas" user.
- Token management via CLI alone forces user to SSH/exec into the hub container to issue invites — friction-heavy first-run experience.

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
# One-time on a VPS or fly.io account (or AWS Lightsail, Hetzner, …)
maude hub deploy fly
# → emits fly.toml, runs `fly launch`, prints:
#   HUB_URL=https://maude-hub-foo.fly.dev
#   ADMIN_BOOTSTRAP=https://maude-hub-foo.fly.dev/admin?key=<one-time-bootstrap-key>
#   (bootstrap link is single-use, valid 24h)

# Open admin URL in browser → first-run flow → "Generate invite" button →
# modal shows one-time token + ready-to-copy command + QR code:
#   maude design link https://maude-hub-foo.fly.dev --token=mau_a3f9c8b2...

# Each peer pastes that command into their terminal, inside the repo:
maude design link https://maude-hub-foo.fly.dev --token=mau_a3f9c8b2...
# → tests connection, first-sync, writes .design/config.json.linkedHub
# → starts a linked maude design serve in background OR prompts to start

# Daily workflow stays the same
cd ~/repo
maude design serve              # browser opens; canvas live with hub
# Claude Code in another terminal:
/design:edit "make CTA red"     # writes to .design/screen.html locally
                                # → fs watcher detects → pushes to hub
                                # → hub broadcasts → Bob's agent writes Bob's disk
                                # → Bob's browser updates from his disk reload OR live Yjs update
```

## Migration from Phase 8 (loopback-only multi-tab) to Phase 9 (hub-linked)

A user who has been running Phase 8 (loopback multi-tab + git push/pull for cross-machine handoff) and now wants to enable hub federation goes through:

1. **Existing state**: Peer running Phase 8 has local `.design/_state/<slug>.ydoc.bin` files from prior multi-tab sessions (binary CRDT logs containing comment history, annotations). These are gitignored; each peer has their own.
2. **Deploy hub**: `maude hub deploy fly` (or AWS Lightsail / Hetzner / Docker compose anywhere) — creates empty hub, prints bootstrap URL.
3. **Open admin UI → generate first invite** → copy the `maude design link --adopt` command.
4. **Adopt from existing local state**:
   ```sh
   maude design link <url> --token=mau_... --adopt
   ```
   - Agent detects hub is empty AND local `.ydoc.bin` files exist for this project.
   - Pushes the entire Y.Doc state from local `.ydoc.bin` to hub (preserves comment history, annotations, layout).
   - Hub becomes seeded from this peer's local state.
   - JSON snapshot files (`.design/_comments/*.json`, `.design/<slug>.annotations.svg`) remain unchanged on disk — they were always the git-tracked source of truth.
5. **Other peers join**: They run `git pull` to get the `linkedHub` config commit (and any new JSON snapshots), then use admin UI to generate a per-peer invite token, paste the printed command:
   ```sh
   maude design link <url> --token=mau_...
   ```
   - Hub is now canonical; their local state reconciles via Yjs sync v2 (hub-wins default).
   - Commutative merge — no data loss expected for comments / annotations (additive operations).
   - HTML body conflicts (rare since Phase 8 was loopback-only and didn't co-edit HTML) resolved last-write-wins.

**No data loss expected.** The `_state/<slug>.ydoc.bin` is the migration vehicle — a complete CRDT log of the multi-tab session that hub adopts wholesale. Snapshots on disk (`.json`, `.svg`) remain authoritative reference for git history.

**Edge case — stale local state.** If a peer was in a Phase 8 session a long time ago and only now reconnects after the team has done much hub work: their `.ydoc.bin` is stale. `maude design link` triggers Yjs sync v2 → server-side state vector wins on conflicting attributes, but the peer's comments / annotations added during the gap are merged in additively. Document this in the linking command UX as "merging X local changes into hub state".

---

## Metadata

- **Type:** New Feature (largest in v1.1)
- **Complexity:** Very High
- **Depends on:** Phase 8 (Yjs runtime + Awareness layer already present), Phase 1 (workspace + bundler infra — `plugins/design/hub/` slot pre-reserved in Phase 1 Task 0)
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/hub/` (new workspace — `pnpm-workspace.yaml` extended)
    - `plugins/design/hub/package.json` (private; deps: `@hocuspocus/server`, `@hocuspocus/extension-sqlite`)
    - `plugins/design/hub/src/server.mjs` (entry — wraps Hocuspocus + admin routes)
    - `plugins/design/hub/src/auth.mjs` (token verification, rate limiting, bootstrap key)
    - `plugins/design/hub/src/admin/index.html` (admin UI shell — Task 2.5)
    - `plugins/design/hub/src/admin/app.js` (admin UI client logic — Task 2.5)
    - `plugins/design/hub/src/admin/style.css` (admin UI styles — Task 2.5)
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

### Task 0: Architectural DDR — Hocuspocus over PartyKit ✅ 2026-05-27

- **Do:** Record DDR explaining the rejection of PartyKit (research-collab.md § Self-hostable framework comparison): `partyserver` is hard-coupled to Cloudflare Workers / Durable Objects; "run anywhere" claim breaks on plain VPS. Hocuspocus chosen for: production-proven (TipTap's collab backend), Node-native, MIT, `extension-sqlite` for zero-config persistence, `extension-redis` available later if hub needs to scale horizontally.
- **Validate:** DDR in `.ai/archive/decisions/`, signed off.
- **Shipped:** `.ai/archive/decisions/DDR-052-hocuspocus-over-partykit-for-hub.md`.

### Task 1: Hub workspace + Hocuspocus skeleton ✅ 2026-05-27

- **Do:** Add `plugins/design/hub/` to `pnpm-workspace.yaml`. Stub `package.json` (`"private": true`, `"name": "@maude/hub"`). Install `@hocuspocus/server`, `@hocuspocus/extension-sqlite`. Write `src/server.mjs` that instantiates Hocuspocus with: SQLite persistence at `/data/<project-id>/`, token auth via `onAuthenticate`, awareness enabled. Listens on `$PORT` (default 1234). esbuild bundles to `dist/hub.bundle.mjs` so the published npm tarball ships the hub binary.
- **Pattern:** `https://tiptap.dev/docs/hocuspocus/server/configure` — copy the canonical setup.
- **Validate:** `node plugins/design/hub/dist/hub.bundle.mjs` boots on `localhost:1234`. Two `y-websocket` clients can connect and sync.
- **Shipped:** `plugins/design/hub/{package.json,src/server.mjs,build.ts,test/two-client-sync.test.mjs,.gitignore,README.md}` + `pnpm-workspace.yaml` (`better-sqlite3` `allowBuilds`) + `pnpm-lock.yaml` (regenerated). Bundle 333 KB (5 MB budget). Two-`HocuspocusProvider`-client convergence in 54 ms via `node --test --test-force-exit`. Runtime constraint discovered + recorded: hub is **Node-only** — Hocuspocus' `crossws` adapter rejects Bun/Deno, and `better-sqlite3` isn't Bun-compatible (Bun#4290). `bun build` for bundling stays. Bundler: Bun.build (not esbuild) per project convention (DDR-009 dev-server lineage).

### Task 2: `maude hub serve|deploy|token|status` (minimal CLI) ◐ 2026-05-27 (serve + token generate + status only — deploy + token rotate deferred)

- **Do:** `cli/commands/hub.mjs` exposes the minimum CLI surface for v1.1. Most users won't touch CLI tokens — they'll use the in-hub admin UI from Task 2.5. CLI exists for headless / scripted setup.
  - `maude hub serve [--port N] [--data <path>] [--secret <hex>] [--insecure-http]` — runs the bundled Hocuspocus locally (for testing, contributor dev, or self-hosted deploy). `--secret` sets `HUB_SECRET`; if unset, generates one and prints bootstrap link. `--insecure-http` allows non-TLS for localhost dev.
  - `maude hub deploy fly|docker` — emits the corresponding template, runs the deploy CLI if available (`fly launch`) or prints next steps. **Two targets only** for v1.1:
    - `fly` — primary one-command path (auto-cert, auto-restart, persistent volume).
    - `docker` — universal `docker-compose.yml` + `Caddyfile`. Works on AWS Lightsail / EC2 / Fargate, Hetzner, DigitalOcean, Coolify, home server, anywhere with Docker. Per-provider notes in `docs/site/content/docs/hub-deploy.mdx` (Fly, AWS Lightsail, AWS EC2 + ALB, Hetzner CX11, Coolify, Cloudflare Tunnel home-server appendix).
  - **`maude hub token generate [--label <name>]`** — generates 32-byte hex token (`mau_<32hex>` prefix), stores HMAC hash on hub side (SQLite `tokens` table with `created_at`, `label`, `last_used`), prints raw token ONCE. Same logic the admin UI calls internally.
  - **`maude hub token rotate <label>`** — invalidates the named token, generates replacement. Peers see "auth expired, re-link" notification.
  - `maude hub status [<url>]` — pings hub, shows uptime / persisted canvases / version / active connections.
- **Deferred to v1.2 backlog (not in v1.1):** `maude hub token list`, `maude hub token revoke`, `--project <id>` per-project scoping, additional deploy targets (`systemd`, `tailscale`, `cloudflare-tunnel`). All recoverable from in-hub UI (token rotation handles revoke; project scoping is a multi-project hub feature that has no v1.1 use case).
- **Pattern:** Token UX mirrors `gh auth token`. Each deploy target is a templated config file (substitutes `IMAGE_TAG`, `VOLUME_SIZE`, `REGION`) + a "what to run next" message.
- **Validate:** End-to-end: `maude hub deploy fly` on a clean fly.io account succeeds; `maude hub status <url>` returns OK; `maude hub token rotate` disconnects affected peers within 5s.

### Task 2.5: In-hub admin UI (vanilla-JS bootstrap + token management) ✅ 2026-05-27 (QR code deferred to v1.2 polish)

- **Do:** Bundle a single-HTML-page admin UI into the hub binary. Total budget ≤ 15KB gz (vanilla JS, no framework, no SPA router). Served at `GET /admin`. Page renders client-side via `fetch` calls to `/admin/api/*` JSON endpoints.

  **First-run bootstrap:**
  - On `maude hub serve` boot, if SQLite has no tokens, server generates a one-time `bootstrapKey` (32-hex, 24h TTL, single-use). Prints to logs:
    ```
    Maude Hub started on https://<public-url>
    First-run setup: https://<public-url>/admin?key=<bootstrapKey>
    (Single-use link, expires in 24h. After first use, /admin requires HUB_SECRET.)
    ```
  - User opens that URL → first-run wizard → sets/confirms admin display name → generates first invite token → done. `bootstrapKey` consumed; further `/admin` access requires `Authorization: Bearer <HUB_SECRET>` (or `?secret=` on URL for browser convenience; browser caches it in localStorage after first auth).

  **Admin page cards (after first-run):**
  1. **Generate invite** — text input "Label this invite" + button. POSTs `/admin/api/token` → returns `{ token, command, qr }`. Modal displays raw token (one-time, with copy button), full ready-to-paste command (`maude design link https://<hub> --token=<token>`), and a QR code (encoded command, for laptop→phone or laptop→tablet handoff).
  2. **Connected peers** — table polled every 5s via `/admin/api/peers`: name, color swatch, last-seen, active canvas. No actions — view-only.
  3. **Hub status** — uptime, persisted canvases count, version, `/data` disk usage. From `/admin/api/status` (same JSON the CLI `maude hub status` consumes).
  4. **Active tokens** — table of token labels (NOT raw token values), created date, last-used. Per-row "Rotate" button (POST `/admin/api/token/rotate`). No "Revoke" / "List raw" actions in v1.1 — rotation covers the kill-switch case.

  **Auth model:**
  - `GET /admin` returns the HTML shell (no auth — page is just static markup, all data fetched separately).
  - `GET|POST /admin/api/*` requires `Authorization: Bearer <HUB_SECRET>` header OR `?secret=` query string (first-run only).
  - First-run path: `?key=<bootstrapKey>` allows minting `HUB_SECRET` if unset.
  - Browser-side: localStorage caches secret after first paste; UI shows "Stored on this device only — clear localStorage to reset".

  **No CSS framework** — Tailwind / shadcn would blow the 15KB budget. Inline `<style>` block, plain semantic HTML, system fonts. Visual target: looks like a Stripe-era admin panel, not a 2010s phpMyAdmin.
- **Pattern:** Inspired by `htpasswd` interactive flow + Tailscale admin console. Bootstrap-key UX same as Jupyter Notebook's "token-in-URL on first launch".
- **Why:** Without this, every new team member onboarding requires (a) someone with shell access to the hub, (b) running `maude hub token generate`, (c) copying the output back to Slack. Hub UI removes friction: hub admin opens URL, clicks button, gets shareable command in 10 seconds. This is **the** difference between "deploy a hub feels like deploying a service" and "deploy a hub feels like Tailscale".
- **Bundle delivery:** Admin HTML/CSS/JS lives at `plugins/design/hub/src/admin/{index.html,app.js,style.css}`. esbuild text loader inlines them as strings into `dist/hub.bundle.mjs`. No `serve-static` package — server reads bundled strings + sets correct Content-Type.
- **Validate:**
  - Fresh `maude hub deploy fly` → logs print bootstrap URL → open in browser → wizard works → generate first token → token copies cleanly → second peer pastes command → first-sync handshake succeeds. **Total elapsed time from `fly deploy` exit to first peer linked: < 3 minutes.**
  - Token rotation via UI invalidates peer sessions within 5s.
  - Bundle size: `dist/hub.bundle.mjs` admin chunk ≤ 15KB gz (CI check).
  - Bootstrap key single-use enforced (reuse returns 401).
  - `/admin/api/*` unauthenticated request returns 401.
- **Shipped — INITIAL (then hardened per DDR-053 — see next bullet):** `plugins/design/hub/{src/admin/{index.html,style.css,app.js},src/admin-assets.mjs,src/admin-auth.mjs,src/bootstrap.mjs,test/{admin-api,admin-static,admin-size,bootstrap}.test.mjs}` + `src/server.mjs` (extended) + `src/tokens.mjs` (+ `rotateToken`/`listTokenLabels`/`recordTokenUse`) + `build.ts` (copies `src/admin → dist/admin`) + `cli/commands/hub.mjs` (help-text refresh). QR code deferred to v1.2 polish — copy-paste command covers the primary Slack-handoff path.
- **Shipped — DDR-053 hardening pass (after `/flow:validate` surfaced 12 security blockers + 8 a11y blockers via security-auditor + ethical-hacker + a11y-auditor agents — both attacker chains promoted HIGH):** [DDR-053](./.ai/archive/decisions/DDR-053-hub-admin-auth-architecture.md) pins the auth architecture; implementation follows. **Security:** Bearer-only admin auth (removed `?secret=` query); atomic single-use bootstrap via POSIX rename-to-consume (`bootstrap.json → bootstrap.used.json` — kernel-level exactly-one-winner semantics, no Promise-chain serialization needed); bootstrap no-reissue policy (`maybeIssueOnBoot` refuses after consumption OR expiry — operator falls back to `HUB_SECRET` env); scope-bound tokens (new `scope` field, default `scope = label`; `documentName` must equal label OR start with `label + "/"`; `scope: "*"` opts into wildcard for admin-on-Yjs / legacy compat; pre-DDR tokens grandfathered as wildcard); `onAuthenticate` enforces scope + documentName regex `^[A-Za-z0-9._/-]{1,256}$`; `addToken`/`rotateToken` enforce label regex `^[A-Za-z0-9 _.\-]{1,64}$` via shared `assertValidLabel`; `createHub` validates `publicUrl` is parseable http(s) URL without shell metacharacters at boot; `POST /admin/api/token/rotate` iterates `peers` Map + calls `connection.close()` for every session whose `user.name === label` (returns `disconnected: <count>` in response — eliminates rotate-doesn't-kick dwell-time window); CSP `default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'` + `X-Frame-Options: DENY` + `Referrer-Policy: no-referrer` + `X-Content-Type-Options: nosniff` on every `/admin*` response; per-IP rate limit (5 requests / 60s on `/admin/api/bootstrap` POST + on `/admin/api/*` 401 responses, `HUB_ADMIN_RATE_LIMIT=off` for dev); `readJsonBody` enforces strict `Content-Type: application/json` (closes `text/plain` CSRF gadget), 15s request timeout (defeats slow-POST DoS), rejects bodies containing `__proto__`/`constructor`/`prototype` keys; all log lines that interpolate user-controlled `documentName`/`label`/`user` go through `sanitizeForLog` (scrub control chars including CR/LF/0x7f, slice 256); atomic writes (writeFileSync to .tmp + renameSync) for tokens.json + admin.json + bootstrap.json (crash-safe + Windows-tolerant); new `GET /admin/api/identity` unauthenticated endpoint returns `{ publicUrl, version, hostFingerprint }` for phishing-claim-link defense. **Admin client:** strips `?key=` from URL immediately on load (before any network roundtrip — failed bootstrap POST or refresh doesn't leak); fetches `/admin/api/identity` on bootstrap view + shows `"Claiming <url> (fingerprint <16hex>)"` so operator can verify they're claiming the expected hub; `showInvite` saves `document.activeElement` + focuses `#token-copy` on `showModal()` + restores focus on `close` event; `#copy-status` sr-only `aria-live="polite"` region announces "Command copied to clipboard" (button-label mutations aren't re-announced by screen readers); error containers have `role="alert"` (assertive announcement on `.hidden=false` toggle); explicit `<label for="...">` pairing (no more wrapping-label pattern). **A11y:** `--muted` token darkened from `#78716c` → `#57534e` (light mode 4.48:1 → ~7:1 — clears 4 contrast blockers in one stroke; dark-mode equivalent `#a8a29e` → `#d6d3d1`); `<dialog>` gains `aria-labelledby="token-modal-title"`; decorative `.m` badge + `.dot` get `aria-hidden="true"`; "Skip to main content" link + `id="main-content"` landmark; tables get `<caption class="sr-only">` + `scope="col"` on every header `<th>` + sr-only "Actions" label on the rotate column; new `.sr-only` + `.skip-nav` utility classes. **Verification:** 85/85 hub-side tests via `node --test --test-force-exit` (15 pre-existing + 13 bootstrap + 5 admin-static + 16 admin-api + 2 admin-size + 10 scope + 21 admin-hardening + 3 rate-limit). 112/112 across full phase-9 surface combined with `cli/lib/hubs-config.test.mjs` + `cli/commands/hub.test.mjs` + `cli/commands/design-link.test.mjs`. Bundle release **176 KB** (was 172; +4 KB for the new admin code paths — under 5 MB ceiling). Admin assets **18 KB raw / ~6.4 KB gz** (≤ 15 KB ceiling, still 60% headroom for QR if it lands in v1.2). Biome lint clean across 18 touched files (one `noControlCharactersInRegex` rewrite: `sanitizeForLog` switched from regex to charCode loop to satisfy the rule without losing semantics). **Runtime gotchas:** (1) fetch keep-alive ECONNRESET across hub restarts on same port → per-test port allocator (admin-api `BASE_PORT + counter++`); (2) Port range needed to skip `cli/commands/design-link.test.mjs` (14396) → hub tests use 14598-14699 for admin-api, 14700+ for admin-hardening, 14800+ for rate-limit. (3) Rate-limit initial pass consumed budget on 401s but didn't enforce 429 — fix: 401 path now early-returns 429 when limit exceeded (single-line edit). **Files (DDR-053 pass — 7 new + 8 modified):** `.ai/archive/decisions/DDR-053-hub-admin-auth-architecture.md` (new), `plugins/design/hub/test/{bootstrap,admin-api,admin-static,admin-size}.test.mjs` (M — updated for DDR contract), `plugins/design/hub/test/{scope,admin-hardening,rate-limit}.test.mjs` (new), `plugins/design/hub/src/{server,admin-auth,bootstrap,tokens}.mjs` (M — full DDR-053 implementation), `plugins/design/hub/src/admin/{index.html,style.css,app.js}` (M — a11y + identity display + focus mgmt), `.changeset/phase-9-task-2.5-admin-ui-hardened.md` (new).

### Task 3: `maude design link|unlink|status|adopt` ✅ 2026-05-27

- **Do:** `cli/commands/design.mjs` extends:
  - `maude design link <url> --token <hex>` — pings hub, performs first-sync handshake. Conflict resolution: **two modes only** for v1.1:
    - **Default (hub-wins):** if hub has state, hub state replaces local disk. Use case: peer joining an already-active project. Confirmed via prompt before overwriting.
    - **`--adopt` flag:** push local up unconditionally. Use case: first-time bootstrap from a populated repo, or hub-was-wiped recovery. Refuses (with prompt) if hub already has state to overwrite.
  - Writes `.design/config.json.linkedHub`; stores token in `~/.config/mdcc/hubs.json`; prints "you're linked".
  - `maude design unlink` — removes linkedHub from config + drops the token; local files untouched
  - `maude design status` — shows hub URL, last successful sync, pending ops queue size, conflict state if any
  - `maude design adopt <url> --token <hex>` — alias of `link --adopt`, exposed as separate command for discoverability (same UX as `git remote add` followed by `git push --force --set-upstream`)
- **Deferred to v1.2 backlog (not in v1.1):** `--peer-wins` flag (third mode of conflict resolution). Hub-wins default + `--adopt` opt-in covers 95 % of real cases; `--peer-wins` is mostly a confusion vector.
- **Pattern:** Same UX rhythm as `git remote add` + `git push --set-upstream origin main` — familiar to engineers.
- **Validate:** Round-trip linking, unlinking, status all work locally against `maude hub serve`.

### Task 4: Bidirectional file sync agent (the hard part) ✅ 2026-05-27

- **Do:** In `plugins/design/dev-server/runtime/sync/`:
  1. **Yjs client** — connects to hub via Hocuspocus client lib (`@hocuspocus/provider`); per canvas a Y.Doc is loaded.
  2. **fs.watch / chokidar watcher** — observes `.design/*.html`, `.design/_comments/*.json`, `.design/_annotations/*.svg`. Debounced 250ms.
  3. **Echo prevention** — before writing a file from a Yjs update, agent records `sha256(bytes)` in `recentRemoteWrites: Map<filepath, { hash, expiresAt }>`. On fs.watch fire, agent computes `sha256(fileBytes)`; if it matches a pending entry within 1500ms, drop the event (it's our own write). If no match, treat as user/Claude edit; push to Y.Doc.
  4. **Atomic writes** — agent writes to `<filepath>.tmp` then `renameSync` to final path. Claude Code's `Write` tool does NOT currently use this pattern (writes are not atomic in Node by default); document this as known minor risk + accept (fs.watch usually fires after rename in macOS / Linux; Windows is more fragile — document).
  5. **Cold start** — on `maude design serve` boot with a linkedHub: open Y.Doc from hub, read disk into agent memory, compare hash with Y.Doc snapshot → either accept hub (default), accept disk (`--peer-wins` in link), or open a 3-way merge prompt.
  6. **Y.Doc → disk codec** — for v1.1, treat HTML body as `Y.Text` (no parse / serialize asymmetry). On Y.Doc text update → write to disk at 800ms quiescence. Comments/annotations stay as Y.Array → JSON snapshot.
- **Pattern:** Echo prevention is borrowed from Syncthing's "weak hash + sequence number" approach. Chokidar's `awaitWriteFinish` option handles partial writes.
- **Validate:** Stress test: `for i in {1..100}; do echo "<button>$i</button>" > .design/screen.html; sleep 0.1; done` → hub state matches final write; no echo loop; no missed events.
- **Shipped:** `plugins/design/dev-server/sync/{echo-guard,atomic-write,codec,fs-mirror,agent,hubs-config,index}.ts` (7 modules, ~900 LoC) + tests `test/sync-{echo-guard,atomic-write,codec,fs-mirror,agent,hubs-config,runtime}.test.ts` (75 tests). Config: `linkedHub` field added to `config.schema.json` + `DevServerConfig` interface; `@hocuspocus/provider` ^4.0.0 added to dev-server deps; sync runtime auto-boots in `server.ts` when linked (no-op for solo). Defaults: SHA-256 echo TTL = 1500ms, fs-mirror quiet window = 250ms, Y.Doc → disk debounce = 800ms (matches DDR-051 Phase 8 room flush). Adopt mode pushes local disk state to hub (one-shot, cleared after first reconcile). HocuspocusProvider import is dynamic so unlinked projects don't pay the load cost. **100-event stress (plan validate criterion): bounded `< 100` doc transitions, no echo loop, doc + disk + peer all converge on final write** — proven in `sync-agent.test.ts > 100-event scenario from plan validate`. **Deferred to follow-up:** real-hub WSS integration test (belongs in Task 11 stress matrix alongside hub-restart resilience, cross-continent, token rotation mid-session); bridging the existing Phase 8 dev-server collab room → hub Y.Doc (browser-tab Y.Doc currently uses the local room; linked-mode dual-source-of-truth needs a separate decision — likely DDR after Task 5 awareness work). 605/605 dev-server tests pass; full suite green.

### Task 5: Awareness layer on hub ✅ 2026-05-28

- **Do:** Same Awareness UX as Phase 8 (cursors, selections, viewport, "Claude is editing" banner) but now the hub is the relay. The dev server forwards browser Awareness frames to the Hocuspocus connection's awareness channel; receives others' frames back.
- **Validate:** Two peers linked to same hub from different cities: see each other's cursors within 100ms over WSS.
- **Shipped:** In linked mode each canvas has two in-process Awareness instances — the collab Room's (browser tabs ↔ dev-server, Phase 8 loopback WS) and the sync provider's (dev-server ↔ hub, HocuspocusProvider). Hocuspocus relays awareness between document peers out of the box, so the only missing link was in-process. New `collab/awareness-bridge.ts` `bridgeAwareness(a, b)` wires the two bidirectionally with shared-origin echo prevention + initial-state exchange (state identity preserved by relaying per-clientID, the standard y-websocket fan-out pattern). The collab `registry` owns the bridge lifecycle (rooms churn as tabs open/close; providers persist for the server lifetime): new `registry.attachHubAwareness(slug, awareness)` stores the hub Awareness per slug, wires on room create, tears down before `room.destroy()` runs `awareness.destroy()` (so a late relay never hits a dead instance), and re-wires automatically on room churn. The sync runtime exposes `provider.awareness` (default factory returns the HocuspocusProvider's), accepts an `AwarenessRegistry` (structural, no module cycle), attaches each provider's awareness on `start()`, detaches on `stop()`. `server.ts` passes `collab.registry` to `createSyncRuntime`. **No hub-side change** — Hocuspocus relays awareness by default. **F14 decision (was flagged blocking-before-code in DDR-054):** awareness is ephemeral — the bridge writes NO files, so it neither introduces nor resolves the comments/annotations file-ownership race. The doc-content bridge (Room doc ↔ provider doc) is intentionally NOT built here; disk stays the medium between the two docs (Task 4) and F14 remains a documented risk for the doc-content bridge work (Task 6/8). **Solo mode is a provable no-op:** `createSyncRuntime` returns null unlinked, and `wireBridge` early-returns when no hub awareness is attached (always, in solo) — canvas rendering path untouched. **Security hardening (after `/flow:validate` security gate — security-auditor + ethical-hacker):** Task 5 promotes awareness from loopback-trusted (Phase 8) to hub-untrusted, so remote `name`/`color`/`cursor`/`selection.cssPath`/`annotationSelection` now reach the browser cursor/participant render sinks. Auditors found the read chokepoint `useForeignAwareness` validated field *types* only, not *values* — 4 defender + 2 attacker blockers (2 chains). All fixed at that single chokepoint via a new exported `sanitizeForeignState`: **color wire value DISCARDED + re-derived locally via `colorForName()`** (kills the CSS-`url()` exfil beacon — chain 1 broken); **cssPath restricted to the locator grammar incl. functional-pseudo-class rejection** (`:has()`/`:is()`/`:not()` would trigger per-render subtree-walk DoS; the original charset allowlist was wider than the `cssPath()` generator); **name** control/zero-width/bidi-stripped (charCode scan, not a control-char regex — DDR-053 precedent) + length-capped 64; **cursor/viewport** finite-gated; **peer count** capped 64; **annotationSelection** per-id token check + length cap 256. DDR-054 trust table gained two rows (awareness sanitized; presence side-channel "by design, named") + an F1-residual note that Task 8's CSP must include `connect-src`/`img-src`. Accepted residual: legit-grammar cssPath still resolves locally → bounded DOM-recon oracle with no outbound channel (documented). Re-audit: defender 0 blockers; attacker's lone remaining blocker (functional-pseudo DoS) closed by the allowlist tightening with a proving test, both chains broken. **Verification:** 653/653 dev-server tests (+21 net: `test/collab-awareness-bridge.test.ts` 12 + `sync-runtime.test.ts` +1 attach/detach + `use-collab.test.ts` +8 hostile-input matrix incl. color-exfil / control-bidi-strip / `:has()`-bomb / cssPath-injection / count caps), incl. end-to-end cross-peer relay (Room A → simulated hub → Room B). tsc clean modulo the api.ts/runtime-bundle.ts baseline (DDR-026); biome clean. Dev-server boots clean in solo mode (no `[sync]` line, health OK); active canvas renders. **Files (1 new + 6 modified):** `plugins/design/dev-server/collab/awareness-bridge.ts` (new), `plugins/design/dev-server/{collab/registry.ts,sync/index.ts,server.ts,use-collab.tsx}` (M), `plugins/design/dev-server/test/{collab-awareness-bridge.test.ts (new),sync-runtime.test.ts (M),use-collab.test.ts (M)}`, `.ai/archive/decisions/DDR-054-…md` (M — trust-table rows).

### Task 6: Auth + transport hardening ✅ 2026-05-28

- **Do:** Hub-side: `onAuthenticate({ token, documentName }) → verifies token` (HMAC-SHA256 against `HUB_SECRET` env). Rate limit: 100 req/min per token. WSS mandatory unless `HUB_INSECURE_HTTP=1` env (for testing).
- **TLS** options documented:
  - Fly deploy uses Fly's auto-cert
  - Docker / VPS uses Caddy with `acme_email` env for auto-Let's Encrypt
  - Cloudflare Tunnel terminates TLS upstream
  - Tailscale Funnel ditto
- **Validate:** Wrong token rejected with HTTP 401 on WS upgrade. Rate limit kicks in. HTTP (non-WSS) refused on production deploys.
- **Shipped:** **Hub-side** — `src/tokens.mjs` rewritten from plaintext `tokens.json` to a SQLite `tokens` table (`label` PK, `hash`, `scope`, `dev`, `created_at`, `last_used_at`) at `<dataDir>/tokens.db`; `hash = hmac_sha256(rawToken, hubKey)` with a per-hub random key persisted in a `meta` table — the raw value is NEVER written to disk (proven by the "hash-at-rest" test reading the DB directly). A pre-Task-6 `tokens.json` is imported once on first open (each raw value hashed in, legacy scopes preserved) then renamed `tokens.json.migrated`. Public API unchanged (`addToken`/`rotateToken`/`verifyToken`/`listTokenLabels`/`recordTokenUse`/`matchesScope`/`assertValidLabel`/`generateToken`); `readTokensFile`→`readTokens` (metadata-only, no value/hash). `server.mjs` `onAuthenticate` adds a per-token connection rate limit (`CONN_RATE_LIMIT_MAX=100`/60s, keyed by label); `createHub` gains a WSS boot guard — throws when `publicUrl` is `http://` to a non-loopback host unless `insecureHttp` (HUB_INSECURE_HTTP=1). `authMode` literal `'tokens.json'`→`'tokens'`. **CLI-side (DDR-054 §3 deferred items)** — `cli/lib/design-link.mjs`: F2 trust gate on `link`/`adopt` against a non-loopback hub (interactive `[y/N]` showing URL/scheme/host, `--yes` non-interactive bypass, non-TTY-without-`--yes` refusal) + **per-machine** trust allowlist (`~/.config/maude/hubs.json` `trusted[]` via new `isHubTrusted`/`trustHub`; recorded only after a successful link) so re-linking a trusted hub doesn't re-prompt; F4 `--adopt` upload manifest + `adoptedAt` attestation written to `~/.config/maude/hubs.json` (via extended `addHub(url, token, extra)`); F3 DDR-054 linked-mode preview banner on every non-loopback link. Loopback hubs are exempt from all gating (solo/local-dev unchanged). **Verification:** 94/94 hub tests (`tokens.test.mjs` rewritten for SQLite + new hash-at-rest + legacy-migration cases; new `auth-hardening.test.mjs` — WSS boot guard ×4 + per-token rate limit ×3; `health.test.mjs` authMode updated) + 30/30 CLI tests (`hub.test.mjs` reads through `readTokens` not the file; `design-link.test.mjs` +3 F2/F4 cases) all green. Hub bundle 359 KB (≤ 5 MB). Biome clean across 10 touched files (2 `useTemplate` rewrites). Bundle boots, `/health` OK, `tokens.db` at 0600. **TLS docs** (deploy-target specifics — Fly auto-cert / Caddy ACME / Cloudflare / Tailscale) noted in the hub README transport-hardening section; full per-provider recipes are Task 7. **Security pass (`/flow:validate` step 6.5 — security-auditor + ethical-hacker):** defender 0 blockers. Attacker initially raised 2 HIGH chains, both hinging on a delivery vector I introduced: a **committable** `.maude/trusted-hubs` allowlist (with a "safe to commit" header) let a malicious PR pre-seed trust and bypass the F2 prompt — re-opening the exact chain F2 was meant to close. **Fixed:** trust moved to per-machine `~/.config/maude/hubs.json` `trusted[]` (committed config can no longer confer trust; the `cfg.linkedHub.url===normUrl` shortcut removed); legacy `tokens.json` is now **deleted** after migration (was kept as `.migrated` cleartext — negated hash-at-rest). Re-audit: **0 blockers, both chains broken.** Accepted residuals (documented): loopback exemption uses a literal host set (non-literal variants get gated — safe direction; `127.0.0.1` is an IP literal so no rebinding); rate-limit keyed by label (label is the token PK → effectively per-token); co-located HMAC key protects replay-from-stolen-store, not row-forgery (env/KMS key = v1.2). Report: `.ai/logs/security-reviews/phase-9-task-6-auth-transport-hardening.md`. **Deferred to Task 8 (per DDR-054):** the runtime cross-check of the `adoptedAt` attestation lives in the sync runtime (Task 4 surface) — the attestation is written here; reading it is a Task 8 follow-up. **Files (1 new + 9 modified):** `plugins/design/hub/test/auth-hardening.test.mjs` (new); `plugins/design/hub/src/{tokens,server,bootstrap}.mjs` (M), `plugins/design/hub/test/{tokens,health}.test.mjs` (M), `plugins/design/hub/README.md` (M), `cli/lib/{hubs-config,design-link}.mjs` (M), `cli/commands/{hub,design-link}.test.mjs` (M), `.changeset/phase-9-task-6-auth-transport-hardening.md` (new).

### Task 7: One-click deploy templates + docs ✅ 2026-05-28

- **Shipped:** Templates committed to `plugins/design/hub/`: `Dockerfile` (self-contained build context — Bun bundles in stage 1, node:20-bookworm-slim runtime installs only better-sqlite3, tini + /health HEALTHCHECK, USER node), `fly.toml.template` (`{{APP_NAME}}`/`{{REGION}}` placeholders, 256MB arm vm, persistent `maude_hub_data` mount, `force_https`, /health check), `docker-compose.yml.template` (`{{IMAGE_TAG}}`, hub + caddy services, `.env`-driven HUB_SECRET/PUBLIC_DOMAIN/ACME_EMAIL), `Caddyfile.template` (auto-ACME + transparent WS upgrade), `docker-compose.dev.yml` (local build, no Caddy, port 1234, HUB_INSECURE_HTTP=1). CLI: `maude hub deploy <fly|docker>` (emits templates with placeholders substituted into cwd/`--out`, prints exact next commands, never auto-runs fly/docker, `--force` overwrite guard, fly app-name/region/image-tag validated), `maude hub token rotate --label` (wraps `rotateToken`, prints new value once + live-session caveat). CI: `.github/workflows/hub-image.yml` builds multi-arch (amd64+arm64) `ghcr.io/1agh/maude-hub:vX.Y.Z` + `:latest` via buildx on `v*.*.*` tags. Docs: `site/content/docs/hub/{index,deploy,linking,pricing}.mdx` + `hub/meta.json` + root `meta.json` registration (Fly one-command + Docker on Lightsail/EC2+ALB/Hetzner/DO/Coolify/Cloudflare-Tunnel; pricing table; link/adopt/unlink/status + trust gate + gitignore + offline-mode UX). Verification: 13/13 `cli/commands/hub.test.mjs` (was 8 — +rotate ×2, +deploy ×4, help regex), biome clean. **Deferred (validation-only, needs external infra):** real `fly deploy` smoke + AWS Lightsail/Hetzner manual deploys are CI-nightly / per-release-manual (Task 11 surface). **Note:** `serve`/`token`/`deploy` still run from a source checkout only; production-install packaging (adding `plugins/design/hub` to `package.json` files) stays the deferred Task 2 sub-slice — production hubs run the Docker image, not the npm CLI.

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

- **Per-provider deploy docs** at `docs/site/content/docs/hub-deploy.mdx` cover the same `docker-compose.yml` running on different platforms. Each section is ≤ 30 lines, copy-paste reproducible:
  1. **Fly.io** — `maude hub deploy fly` (zero ops, $0.45/mo arm 256MB tier)
  2. **AWS Lightsail** — t4g.nano + 10GB block storage + Lightsail Container Service OR raw instance + Docker; ~$4–6/mo. Notes on Lightsail static IP, Route 53 DNS.
  3. **AWS EC2 + ALB** — for teams already on AWS. t4g.nano EC2 + EFS volume mount on `/data` + ALB with ACM cert (ALB supports WebSocket upgrade natively); ~$15–20/mo. Caveat about EFS perf if persisting per-keystroke (recommendation: use gp3 EBS instead unless multi-AZ HA is required).
  4. **Hetzner CX11 / DigitalOcean droplet / Vultr / Linode** — universal `docker-compose.yml` + Caddy story; $4–6/mo.
  5. **Coolify on $5 VPS** — for users who want a self-hosted PaaS layer; Coolify provides the deploy/restart/TLS layer, Maude hub is just a Docker app.
  6. **Cloudflare Tunnel home-server appendix** — for no-public-IP setups: `cloudflared tunnel` + local Docker. Marked as "advanced, only if you can't get a public IP". This is the **only** mention of tunnels in v1.1 (and only because it's user-driven, not Maude-provided).
- **Pricing analysis doc** at `docs/site/content/docs/hub-pricing.mdx`: Fly free tier behavior, AWS Lightsail flat $4/mo, Render free tier (sleep after 15min idle — not recommended for collab), Railway $5/mo trial, Coolify on $5 VPS as cheapest sovereign option.
- **Deferred to v1.2 backlog (not in v1.1):** `systemd/maude-hub.service.template`, dedicated `cloudflared.template`, `tailscale-funnel.md` recipe. Users on systemd can adapt the Docker `ENTRYPOINT` to a unit file in ~5 minutes; we'll add the template if demand materializes.
- **Validate:** Each recipe produces a working hub when followed end-to-end. CI smoke tests the Fly deploy on every release tag. AWS Lightsail + Hetzner deploys tested manually once per release.

### Task 8: Conflict resolution UX + hub-down graceful degradation ◐ 2026-05-28 (runtime + status surface + banner shipped; CSP/iframe-sandbox + interactive 3-way prompt deferred)

- **Shipped:** **Offline-mode runtime** — new `plugins/design/dev-server/sync/connection-state.ts` (`createConnectionMonitor`): pure, fully-injectable (clock + timers) state machine `online → connecting → offline → offline-long`. Aggregates per-provider WS status (any connected ⇒ online); `graceMs` 30s disconnect→offline (transient blips don't flash UI); `escalateMs` 24h offline→offline-long; `flashMs` 3s green "Synced" on reconnect; counts local edits made while offline (`queuedOps`), resets to 0 on reconnect. **Status surface** — new `sync/status.ts` (`createSyncStatusStore`): merges monitor snapshot + bounded conflict log, writes `.design/_sync.json` (atomic-ish, best-effort, never throws into hot path) + broadcasts `sync:status`. **Conflict detection** — `agent.ts` `reconcile()` now fires an injected `onConflict({slug, kind:'cold-start-hub-wins'})` when hub-wins overwrites *differing, non-empty* local HTML (clean first-sync of an absent/empty file is NOT a conflict); runtime routes it to `store.addConflict`. **Wiring** — `sync/index.ts` builds monitor+store in `start()` (canvas count known), subscribes each provider's new optional `onStatus(cb)`, counts agent-origin doc updates toward queuedOps, tears down on `stop()`; exposes `runtime.status()`. Default HocuspocusProvider factory wires `provider.on('status', …)`. **Browser surface** — `GET /_sync-status` endpoint (poll fallback, `{linked:false}` solo) + `ws.ts` `sync:status` → WS bridge + `client/app.jsx` `<SyncBanner>` (yellow offline w/ queued count, red offline-long w/ git-backup nudge, green 3s synced flash; null in solo). `fs-watch.ts` ignores `_sync.json` (runtime artifact). **CLI** — `maude design status` reads `_sync.json` and reports live state/queued/lastSync/conflict count (`idle` when serve not running). **Verification:** +25 tests (`test/sync-connection-state.test.ts` 8 fake-timer transitions, `test/sync-status.test.ts` 4, `test/sync-runtime.test.ts` +2 offline-transition + conflict integration); 680/680 dev-server + 14/14 design-link CLI green; tsc clean (modulo api.ts/runtime-bundle.ts DDR-026 baseline); biome clean; client bundle rebuilt (`MAUDE_SKIP_RUNTIME_BUILD=1`, runtime bundles restored — env-path churn only); solo-mode boot smoke OK (`/_sync-status`→`{linked:false}`, no `[sync]` line). **NOT visually verified:** the offline/online/escalation banner states need a live two-machine hub reconnect to drive — the rendering path is bundled but unproven against a real WS drop (no two-machine/Fly setup available; belongs in the Task 11 stress matrix). **Deferred (flagged, not in this slice):** interactive 3-way git-pull conflict prompt with 30s default-to-push (v1.1 resolution is hub-wins + notification; the prompt needs richer browser UX); DDR-054 F1-residual canvas-iframe CSP (`connect-src`/`img-src`) + iframe sandbox + per-canvas `.meta.json.syncable` `.tsx` opt-in (separate security-review surface — risky to do blind, tracked as Task 8 hardening follow-up); doc-content bridge / F14 file-ownership race stays a documented risk.

- **Do:** Scenarios with explicit handling:
  - **`git pull` brings new disk state while linked.** Agent detects file hash differs from last-known-Y.Doc snapshot. Prompts: "Local changes from git pull. Sync up to hub? [Push to hub / Discard local and accept hub / Abort]". Default 30s timeout → push.
  - **Hub disk wiped, restored from backup.** Peer reconnects, sees Y.Doc state-vector older than its local. Yjs sync v2 merges peer ops onto hub (peer-as-cold-backup pattern, automatic, no UX).
  - **Two peers offline + diverged via git.** When both come online, last-write-wins on hub (with Yjs merge); a notification surfaces to the disadvantaged peer.
  - **Token rotation.** `maude hub token rotate` invalidates the rotated token; affected peers see "auth expired, re-link" notification.
- **Do:** **Hub-down offline mode (NEW — explicit UX, not just "Yjs will sort it out"):**
  - Sync agent detects hub unreachable (WS close + 3 failed reconnect attempts over 30s). Transitions to **offline mode**.
  - Browser banner: yellow strip across canvas chrome — "Working offline · X edits queued · will sync when hub reconnects". Click banner → details panel showing queued op count, last successful sync timestamp, manual "Retry now" button.
  - Local edits continue working — Y.Doc accepts updates locally, sync agent buffers them in `_state/<slug>.ydoc.bin` until hub returns.
  - On reconnect: agent runs Yjs sync v2, banner flashes green "Synced" for 3s, then disappears.
  - **Hard-stop:** if offline for > 24h, banner escalates to red "Long offline — your changes may conflict with team. Consider `git commit && git push` as backup". This is the "your laptop has been on a plane" case.
- **Validate:** Each scenario walked through in test harness. Hub-down scenario specifically: kill hub container mid-session → make 5 edits → banner shows queued count → restart hub → all edits land within 2s of reconnect.

### Task 9: Gitignore strategy (single mode: `full`) ✅ 2026-05-28

- **Shipped:** [DDR-056](./.ai/archive/decisions/DDR-056-linked-mode-gitignore-strategy.md) (single `full` mode, no `commitStrategy` flag — alternatives deferred to v1.2). New `cli/lib/gitignore-block.mjs` owns the idempotent `# maude:begin`/`# maude:end` block writer (`buildBlock`/`applyBlock`/`hasBlock`/`writeGitignoreBlock`): replaces in place (never duplicates), preserves user content outside markers, `created`/`updated`/`unchanged` action report, `--dry-run` honored, custom-designRoot param. Ignored set = `_state/ _server.json _server.log _active.json _sync.json _history/ _canvas-state/ _chat/` (plan list + the two postdating runtime artifacts: Task 8's `_sync.json` + the undo-stack's `_canvas-state/`). Wired into **`maude design init`** (unconditional, end of scaffold) + **`maude design link --adopt`** (`[Y/n]` default-yes prompt when block absent; `--yes`/non-TTY auto-add; idempotent skip when present). `maude design unlink` leaves the block intact (harmless in solo). **Plan-vs-CLI retarget (documented in DDR):** plan/acceptance say "`maude init`" but that's the flow `.ai/` scaffolder in the current CLI; the design block belongs to `maude design init`. **Drive-by fix:** `maude design init --no-discovery` had a pre-existing `EISDIR` crash — its `core/preview` readdir read the `.archive` subdir as a file; fixed with `withFileTypes` + `isFile()` filter (the block-write is downstream of the scaffold loop, so this blocked the feature). **Verification:** +9 `cli/lib/gitignore-block.test.mjs` (create/idempotent/preserve-user-content/update-in-place/dry-run/append-no-newline/custom-root/marker-detect); 84/84 full CLI suite green; biome clean; e2e confirmed both `design init` (preserves `node_modules/`+`*.log`, appends block) and `design adopt --yes --force` (creates block) write correctly.

- **Do:** DDR + implementation for "what stays in git vs what doesn't" in linked mode. **One strategy only in v1.1: `full`.** Alternative strategies (`hub-only`, `manual`) deferred to v1.2 backlog unless concrete demand materializes.
- **Strategy `full`** (the only mode, no config flag needed):
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
- **Implementation:**
  1. `maude init` (or `maude design link --adopt`) writes the `.gitignore` rules between `# maude:begin` and `# maude:end` markers. Idempotent — re-running doesn't duplicate.
  2. Solo→linked transition (`maude design link --adopt`): if `.gitignore` lacks runtime rules, prompt "Add Maude gitignore block? [Y/n]". Yes → write block. User can edit anytime.
  3. Linked→solo (`maude design unlink`): leave `.gitignore` intact; runtime rules are harmless in solo mode (the gitignored files just don't exist).
- **DDR rationale:** Cold backup (hub down → git pull restores canvas), PR review value (designers review `.html` diffs in GitHub UI), bootstrap-from-clone (`git clone && maude init` yields a working project without hub access) — all argue for keeping `.html` in git. The `hub-only` alternative (live-only canvases, hub as source of truth) is a niche case for binary-heavy projects and adds significant UX surface; ship it when someone asks.
- **Deferred to v1.2 backlog (not in v1.1):** `collab.commitStrategy` config switch, `hub-only` mode, `manual` mode, `maude design sync-gitignore` regen command.
- **Validate:**
  - Fresh repo + `maude init` writes correct `.gitignore` block.
  - Idempotent — `maude init` twice doesn't duplicate the block.
  - `maude design unlink` doesn't touch user-authored gitignore content outside markers.

### Task 10: Local development workflow for hub ✅ 2026-05-28

- **Shipped:** `plugins/design/hub/CONTRIBUTING.md` — Level 1 (plain Node, `maude hub serve --dev --insecure-http` zero-config: mints `mau_dev_<hex>` token, prints connect command + admin bootstrap link; or `pnpm --filter @maude/hub dev` for `node --watch`) + Level 2 (`docker compose -f docker-compose.dev.yml up --build` — builds the local Dockerfile, port 1234, no Caddy/TLS) + 5 gotchas (macOS Docker volume perf → named volume; container fs.watch overlay-fs quirks; WS-upgrade header forwarding behind a proxy; `better-sqlite3` rebuild on Node-major switch; SQLite token store reset). Real-TLS testing = Fly preview deploy (`maude hub deploy fly --name maude-hub-pr-<n>` → `fly deploy` → `fly apps destroy`), Level-3 mkcert deferred to v1.2 per plan. `docker-compose.dev.yml` shipped in Task 7. **Drive-by fix:** `maude hub serve --dev` crashed (`Cannot open database because the directory does not exist`) when `--data` pointed at a fresh dir — `better-sqlite3` won't mkdir; added `existsSync`/`mkdirSync` guard (same fix as `token generate`). **Verification:** `maude hub serve --dev --insecure-http --port 4799` boots, prints token + `maude design link …` + `/admin` URL; 13/13 hub CLI tests green; biome clean. **Note:** the plan's "skip auth enforcement for `mau_dev_` tokens" is intentionally NOT implemented — `--dev` mints a real (dev-prefixed) token and prints it, which is equally zero-config without weakening the auth path (a `mau_dev_`-bypass would be a footgun if a dev hub were ever exposed).

- **Do:** End-to-end recipe for contributors testing the hub without a Fly account. **Two levels** of fidelity (Level 3 mkcert+Caddy local-TLS deferred to v1.2 backlog — Fly preview deploys give better TLS reality than local mkcert):

  **Level 1 — fastest iteration (no Docker, plain Node):**
  ```sh
  # Terminal A — run hub with auto-dev token
  pnpm --filter @maude/hub dev   # watch mode via esbuild + node --watch
  # OR: maude hub serve --dev (one-command, prints bootstrap URL + auto-token)
  # Hub serves on http://localhost:1234, --insecure-http accepted

  # Open printed admin URL → click "Generate invite" → copy command

  # Terminal B — peer with linked repo
  cd /tmp/test-project
  maude init
  echo '<button>test</button>' > .design/screen.html
  maude design link http://localhost:1234 --token mau_a3f9c8b2... --adopt

  # Terminal C — second peer simulating second user
  cd /tmp/test-project-2          # different clone of same repo
  git clone /tmp/test-project .
  maude design link http://localhost:1234 --token mau_a3f9c8b2...

  # Now edits in either terminal B or C propagate.
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

- **Bonus:** `maude hub serve --dev` shortcut that runs hub on `localhost:1234` with auto-generated dev token (`mau_dev_<random>`), prints the full `maude design link` invite plus the admin bootstrap URL, and skips authentication enforcement when token starts with `mau_dev_` (with red warning banner in logs). Reduces contributor onboarding to one command.
- **Contributor doc:** `plugins/design/hub/CONTRIBUTING.md` covers both levels + common gotchas (Docker on macOS volume perf, fs.watch behavior on Linux containers, WS upgrade behavior behind reverse proxies).
- **For real-TLS testing:** contributors run `fly launch --name maude-hub-pr-<n>` for a throwaway preview hub on Fly. Free-ish tier, real certs from Let's Encrypt, ~3 min to spin up, $0 if deleted within the day. Doc this as the canonical "test WSS" path.
- **Validate:**
  - Fresh contributor following Level 1 docs from `pnpm i` to first cross-terminal sync in < 5 minutes.
  - `maude hub serve --dev` works without any config files.

### Task 11: Stress + integration tests ◐ 2026-05-28 (in-process real-hub subset shipped; Fly/cross-continent/1h-soak/admin-browser deferred to CI-nightly/manual)

- **Shipped:** `plugins/design/hub/test/stress-integration.test.mjs` — 3 deterministic real-Node-hub integration tests (`createHub` + real `HocuspocusProvider` + SQLite): (1) **5 peers × 50 random ops converge** on identical Y.Text, no echo loop; (2) **hub-restart persistence** — write state, `server.destroy()`, recreate on same `dataDir`, fresh peer reloads it from SQLite; (3) **hub-down offline edit flushes on reconnect** — peer edits while the hub is down (edit held in local Y.Doc, the offline-buffer the sync agent relies on), hub returns, reconnecting peer flushes the buffered edit + a fresh peer sees both pre-outage (from SQLite) + offline edit. 97/97 hub tests green; biome clean. **Design note:** HocuspocusProvider's in-process *auto*-reconnect backoff is seconds-to-minutes scale (`pA.synced` stayed false for 20s after an in-process `server.destroy()` — proven in a debug spike), so test (3) models the reconnect with a fresh provider on the same doc; the flush GUARANTEE (an offline-buffered doc syncs up on the next successful connect) is what's asserted, deterministically. **Deferred to CI-nightly / manual (need external infra — flagged, not asserted here):** 5-peer × 1-hour soak (time budget); Fly deploy + cross-continent peers (needs a Fly account + two regions); token-rotation-mid-session kicking a *live cross-machine* WS (unit-covered by `rotate-kicks.test.mjs`; the real-machine reconnect is a manual check); admin-UI bootstrap end-to-end < 3 min (needs a browser). These are documented at the top of the test file.

- **Do:** Test matrix:
  - 5 peers × hub × 1 hour with random ops every 5s → hub stable, all peers converge, no echo loops
  - WS drop / reconnect 100× → ops queue and replay correctly
  - Hub restart with persistence intact
  - Hub deploy on Fly + 2 cross-continent peers connect successfully
  - Token rotation mid-session → peers gracefully reconnect with new token
  - **Hub-down offline mode** (NEW): kill hub container → continue local edits → restart hub → all queued edits sync within 2s of reconnect
  - **Admin UI bootstrap** (NEW): fresh deploy → bootstrap URL → generate token → peer link → end-to-end under 3 minutes
- **Validate:** All pass in CI nightly. Cross-continent test via two Fly preview deploys in different regions.

---

## Validation

1. **Static:** Bundle sizes — hub `dist/hub.bundle.mjs` ≤ 5MB (Hocuspocus + SQLite + admin UI + deps); admin UI chunk ≤ 15KB gz; agent sync delta in dev-server bundle ≤ 100KB gz.
2. **Functional:** Full flow `maude hub deploy fly` → open bootstrap URL → admin UI generates token → `maude design link` paste → cross-machine edit visible in <500ms.
3. **Stress:** 5 peers × 1 hour passes (no echo, bounded growth). Hub-down offline mode: 5 edits queue + sync on reconnect within 2s.
4. **Cross-platform scenario:** `hub-cross-continent-edit` web-desktop, web-mobile.
5. **A11y:** `maude design status` output is structured (parseable); `--json` flag for tooling. Admin UI keyboard-navigable + WCAG AA contrast.
6. **Security:** Token verification on every connection; rate limit verified. Bootstrap key single-use enforced. `/admin/api/*` rejects unauthenticated requests.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `hub-admin-ui-bootstrap` | Deploy hub → open printed bootstrap URL → first-run wizard → generate token via UI → peer pastes command → linked in <3 min total | 🆕 new |
| `hub-bootstrap-from-empty` | Deploy hub → first peer links from populated repo → second peer links empty → second peer's disk populated | 🆕 new |
| `hub-cross-continent-edit` | Two peers on different ISPs linked to same hub on Fly → A's `/design:edit` edit appears in B's disk + browser within 1s | 🆕 new |
| `hub-pull-conflict` | A linked, B does `git pull` introducing different file → conflict prompt → resolve via push | 🆕 new |
| `hub-restart-resilience` | Hub `fly machines restart` mid-session → peers see offline banner → restart completes → queued edits flush → no ops lost | 🆕 new |
| `hub-down-offline-mode` | Kill hub container → peer continues editing → yellow offline banner with queue count → restart hub → green sync flash → all 5 edits land | 🆕 new |
| `hub-unlink-resume-solo` | Peer `maude design unlink` → continues solo with local files intact → re-links later → state reconciles | 🆕 new |

---

## Acceptance criteria

- [ ] DDR signed off: Hocuspocus over PartyKit.
- [ ] `maude hub serve` boots locally; `maude hub deploy fly` produces a working hub.
- [ ] **In-hub admin UI** (Task 2.5) shipped: bootstrap-link flow works, "Generate invite" produces copy-paste command + QR, connected peers / status / rotation cards functional, ≤ 15KB gz bundle.
- [ ] `maude design link / unlink / status / adopt` all functional. Conflict resolution: hub-wins default + `--adopt` opt-in. (No `--peer-wins` in v1.1.)
- [ ] Bidirectional file sync passes 100-event stress test with no echo loops.
- [ ] Atomic write semantics documented; Windows fragility called out.
- [ ] Awareness layer over WSS works cross-continent in scenario test.
- [ ] Deploy templates: `fly` + `docker` — each tested end-to-end. Per-provider docs cover Fly, AWS Lightsail, AWS EC2+ALB, Hetzner, DigitalOcean, Coolify, Cloudflare-Tunnel home-server appendix.
- [ ] Pricing doc accurate (Fly free-tier behavior, AWS Lightsail flat tier, Render, Railway, Coolify).
- [ ] All seven scenarios pass (including `hub-admin-ui-bootstrap` and `hub-down-offline-mode`).
- [ ] Solo workflow regression-tested — unlinked repos behave identically to v1.0.
- [ ] `~/.config/mdcc/hubs.json` per-machine token storage works on macOS / Linux / Windows.
- [ ] Decision-trigger documented for moving to Phase 10 (structured CRDT) — record the kind of incident that would justify the v1.2 jump.
- [ ] `maude hub token generate|rotate` implemented; HMAC-hashed storage. (No `list|revoke|--project` in v1.1 — deferred to v1.2 backlog.)
- [ ] Gitignore strategy DDR signed off; single `full` mode shipped. (No `commitStrategy` config flag in v1.1.)
- [ ] **Hub-down offline mode** UX shipped: yellow banner during outage, green flash on reconnect, red escalation after 24h. Queued edits flush within 2s of reconnect.
- [ ] `maude hub serve --dev` works zero-config; contributor onboarding < 5 min to first cross-terminal sync.
- [ ] Multi-arch Docker image (`amd64` + `arm64`) published on every release tag to GHCR.
- [ ] Two-level local dev workflow (plain Node, Docker compose) documented in `plugins/design/hub/CONTRIBUTING.md`. Real-TLS testing via Fly preview deploys (not local mkcert).
- [ ] Phase 8 → Phase 9 migration scenario tested end-to-end (`.ydoc.bin` adoption preserves comment history + annotations from a Phase 8 multi-tab session).

## Deferred to v1.2 backlog

Items intentionally cut from v1.1 scope, recorded here so they don't get re-litigated:

- `maude hub token list` and `revoke` CLI commands (admin UI covers the use case; CLI symmetry not worth the duplication)
- `--project <id>` per-project token scoping (no multi-project hub use case in v1.1)
- `maude hub deploy systemd|tailscale|cloudflare` (Dockerfile + docs cover these provider matrices; templates if demand materializes)
- `--peer-wins` first-sync flag (third mode beyond hub-wins + adopt is a confusion vector)
- `collab.commitStrategy: "hub-only" | "manual"` (full mode covers 99% of teams)
- Level-3 mkcert + Caddy local-TLS contributor workflow (Fly preview deploys give better TLS reality)

## Retro (Tasks 7–11 close-out, 2026-05-28)

- **Scope decision held up.** Tackling 7→11 sequentially with a single `/validate` at the end worked because each task was independently testable; the only cross-task coupling was Task 8's `_sync.json` needing a Task 9 gitignore line + a fs-watch ignore — caught at write time, not after.
- **"Can't validate the UI, say so" paid off.** The offline banner + the full 5-platform scenario + real Fly/cross-continent are genuinely un-runnable here (no two machines, no Fly account, `platforms: []`). Building the runtime state machine as a pure, fake-timer-injectable unit (`connection-state.ts`) meant the load-bearing logic is deterministically tested even though the banner's live render isn't — the right split. The temptation to fake a green "scenario pass" was avoided.
- **Three latent bugs surfaced as drive-bys, all the same root cause shape:** `better-sqlite3` won't `mkdir` its parent (hit by `token generate`, `serve --dev`) and `design init --no-discovery` read the `.archive` dir as a file (EISDIR). None were in the plan; all blocked the feature path I was building. Lesson for `/plan`: when a task wires a new entry point onto existing scaffolding, budget for "the existing scaffolding has never been run on a fresh dir."
- **The security gate earned its keep.** The attacker found a real HIGH supply-chain chain (fresh dep resolution in the release Docker image) that tests/lint/tsc could never catch — it's a build-time/distribution concern, not a code concern. The fix (commit `bun.lock` + frozen install + copy-from-builder) is the kind of thing easy to get wrong by adding a Dockerfile without thinking about the trust boundary it crosses (this image is the one component DDR-054 calls "untrusted to peers"). Re-auditing the fix with the same agent (fresh spawn — SendMessage wasn't available) confirmed the chain broke rather than self-certifying.
- **Build churn is a tax.** `pnpm build` / dev-server build regenerate runtime bundles with an embedded absolute build path, and the site `prebuild` regenerates roadmap/stats/command-docs — all unrelated to the diff. Had to restore these twice to keep the commit focused. A `MAUDE_SKIP_RUNTIME_BUILD=1` + "restore env-path churn" dance is load-bearing; worth a helper or a `.gitattributes`/filter so the synth-comment path isn't diffable.
- **Plan-vs-CLI drift documented, not silently resolved.** The plan said "`maude init` writes the gitignore block" but that's the flow `.ai/` scaffolder now; the block belongs to `maude design init`. Recorded the retarget in DDR-056 rather than forcing the literal plan text.
