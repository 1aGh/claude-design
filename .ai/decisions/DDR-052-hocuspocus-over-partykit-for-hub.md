# DDR-052: Hocuspocus, not PartyKit, as the Phase 9 self-hostable hub framework

**Status:** Accepted — 2026-05-27.
**Tags:** collab / phase-9 / hub / yjs / hocuspocus / self-host
**Related:** [DDR-047](DDR-047-collab-scope-cut-no-lan-mode-hub-admin-ui.md) (Phase 8 = loopback-only foundation, hub-only federation), [DDR-051](DDR-051-collab-persistence-json-snapshot-at-quiescence.md) (JSON canonical + `.ydoc.bin` cache), [Phase 9 plan](../plans/phase-9-self-hosted-hub-file-sync.md) Task 0 + Task 1, [research-collab.md §4](../docs/research-collab.md) Self-Hostable Framework Comparison.

## Context

Phase 9 ships `maude hub serve` / `maude hub deploy` — a long-running, self-hostable Yjs sync hub that lets two laptops on different ISPs share canvas state without SaaS lock-in and without exposing either laptop. The user explicitly framed the constraint: *"deploy a hub feels like Tailscale, not like configuring a Hocuspocus server."*

That requires a framework that:

1. Routes by `documentName` so a single WS connection multiplexes many canvases per project.
2. Ships first-class Yjs awareness (cursors, selections, "Claude is editing" banner from Phase 8 has to keep working over the WAN).
3. Persists Y.Doc state with zero plumbing (we are not writing a CRDT storage layer).
4. Runs on a plain VPS — Fly, AWS Lightsail, Hetzner CX11, Coolify, anywhere with Docker. **No cloud-vendor lock-in.**
5. MIT-or-similar permissive license; the published `@maude/hub` Docker image must be redistributable.
6. A horizontal-scale path exists if/when one hub fans out to >100 concurrent peers — we don't need it in v1.1, but the framework can't paint us into a corner.

Two candidates dominate the ecosystem in 2026: **PartyKit** (Cloudflare-owned since May 2024) and **Hocuspocus** (the TipTap team's open-source Yjs backend). The client explicitly asked to "deeply analyse whether `partykit` runs in Node-host mode" — meaning: can we ship PartyKit-the-framework as a Docker image users self-host? This DDR records the answer.

## Decision

**Hocuspocus.** `@hocuspocus/server` v4.x is the Phase 9 hub backbone. `@hocuspocus/extension-sqlite` is the canonical persistence; `@hocuspocus/provider` is the client used by the dev-server's sync agent (Task 4 in the Phase 9 plan).

PartyKit is rejected as a self-host target — adopted only conceptually (rooms, awareness, framework-managed persistence) via Hocuspocus, which provides the same primitives without the Cloudflare coupling.

## Rationale

### Why PartyKit fails the self-host requirement (#4)

`partyserver` — the framework half of PartyKit, since the Cloudflare acquisition in May 2024 — describes itself in its own README as *"Libraries / Examples / Documentation for building real-time apps with Cloudflare Workers. Powered by Durable Objects."* The Node-host story is:

- `partykit dev` runs the project locally via `workerd` (Cloudflare's open-source Workers runtime), but this is a developer-loop tool, not a deployment target.
- `partykit serve` for production on a plain VPS is **not documented**, not advertised, and `workerd` in standalone production deployment is a niche use case with minimal community track record.
- The framework's core abstraction (party = room = Durable Object) is tightly coupled to Durable Object semantics — storage API, single-instance routing, hibernation. Porting that to a plain Node process would be a significant fork we'd own forever.

Anyone deploying our hub on Hetzner CX11 or AWS Lightsail would hit this within minutes. Shipping PartyKit and then telling users *"but you need a Cloudflare account"* defeats the entire "no SaaS lock-in" thesis of Phase 9.

### Why Hocuspocus wins decisively

Cross-referencing research-collab.md §4 against the six constraints above:

| Constraint | Hocuspocus | PartyKit (Node-host) | y-websocket + y-leveldb | Custom |
| --- | --- | --- | --- | --- |
| 1. Multi-document routing | Native `documentName` — single server hosts thousands of docs | Yes (party = doc) — but on Workers | Yes — room = WS path | We design |
| 2. Awareness | Purpose-built | Via `y-partykit` | Canonical Yjs awareness | We embed `yjs` |
| 3. Persistence as extension | `extension-sqlite`, `extension-postgres`, `extension-s3`, `extension-redis` (horiz-scale) | Durable Object storage (cloud only) or KV / R2 / D1 | LevelDB only; user wraps adapters | We pick |
| 4. Runs on plain VPS | **Yes — Node 22+ / Bun / Deno / CF Workers all supported targets** | **No — production = CF Workers** | Yes (Node 18+) | Yes (we write it) |
| 5. License | MIT | MIT framework, CF lock for prod | MIT | MIT (ours) |
| 6. Horizontal scale path | `extension-redis` ships as a first-class option for multi-instance fanout | Durable Object sharding (CF-bound) | Roll-your-own | Roll-your-own |
| Maintenance | v4.0.0 April 2026, 2.3k★, 93 releases, 1948 commits, active issues | Owned by Cloudflare, active on Workers path | Steady but minimal; "starter code" | We maintain forever |

Five independent reasons to pick Hocuspocus, each sufficient on its own:

1. **Multi-document is free** — the client wants one hub per project (sometimes one hub for several projects of the same user). Hocuspocus routes by `documentName` natively. PartyKit would force a single hub = single party = single canvas, which collapses the whole model.
2. **Persistence is extension-shaped.** `@hocuspocus/extension-sqlite` ships a working schema and handles flush cadence. We add a thin "materialise to `.html` on quiescence" hook on top — the boundary the Phase 9 sync agent (Task 4) plugs into. No custom storage layer to author or maintain.
3. **Hooks where we need them.** `onAuthenticate({ token, documentName, requestHeaders }) → verify or throw` is the exact shape Task 6 (auth + transport hardening) needs. Custom auth in `onConnect` is documented; rate limiting, read-only flagging, per-document permission decisions are all hook-driven.
4. **Production-proven.** TipTap Collab — the commercial managed product — runs Hocuspocus under the hood at TipTap's scale. We inherit a battle-tested runtime instead of being the first production user.
5. **Horizontal scale has a known shape.** `extension-redis` exists today. If v1.2 needs multi-instance fanout, we drop in the Redis extension; no rewrite. PartyKit's equivalent path is "lean harder into Durable Objects" — i.e., further into the cloud lock-in we're rejecting.

### Why not a custom 500-LOC server

Tempting (full control, zero deps), but:

- Hocuspocus is MIT and already does everything in our acceptance criteria. Writing it ourselves is gratuitous reinvention.
- The 500 LOC is the *easy* part. The hard part — extension surface, awareness pong/timeout tuning, sync-v2 wire format edge cases, schema migration in the storage layer — is what Hocuspocus battle-tested for us.
- We **embed** the `yjs` and `y-protocols` packages directly in the dev-server already (Phase 8). The hub gets to lean on the same runtime; if we wrote a custom server it would be a second Yjs surface to keep in lockstep.

### Why not y-websocket + y-leveldb (canonical Yjs starter)

- `setupWSConnection` is "starter code" — the y-websocket README explicitly tells users to fork it for production. We'd own the fork.
- No built-in `onAuthenticate` hook. Token verification, rate limiting, project-scoping all require wrapping the WS upgrade by hand.
- No multi-extension story (SQLite, Postgres, S3, Redis are all separate Hocuspocus extensions; on y-websocket they're separate forks).
- Treat it as a **fallback if Hocuspocus is ever paywalled or abandoned** (see Risk below), not the primary target.

### Why not TipTap Collab (managed SaaS)

SaaS. Rejected by Phase 9's framing — the whole point is no SaaS lock-in.

## Consequences

- **Deps.** `plugins/design/hub/package.json` gains `@hocuspocus/server`, `@hocuspocus/extension-sqlite`. The peer's dev-server (`plugins/design/dev-server/`) gains `@hocuspocus/provider` (Task 4). All MIT.
- **Bundle.** `plugins/design/hub/dist/hub.bundle.mjs` packages Hocuspocus + SQLite driver + admin UI strings into ≤ 5 MB (Phase 9 plan Validation §1). esbuild bundles; SQLite is loaded as a native module at runtime (not bundled).
- **Storage layout.** SQLite at `<DATA_DIR>/hub.db` per-hub; canonical Y.Doc state in `documents` table keyed by `documentName`. Materialisation to `<designRoot>/*.html` for the file-sync agent is layered *on top* via a custom Hocuspocus extension (Phase 9 Task 4) — not inside `extension-sqlite`.
- **Wire format.** Hocuspocus protocol — Yjs sync v2 plus awareness, framed by Hocuspocus' own length-prefixed envelope. Peer clients use `@hocuspocus/provider` (drop-in replacement for `y-websocket`'s `WebsocketProvider`). The Phase 8 loopback-only collab path (`/_ws/collab/:slug` in the dev-server, raw y-websocket framing) stays — it's loopback-only and never crosses the hub. **Two parallel WS endpoints, not one shared protocol.** Documented in research-collab.md §6 "Three-tier mental model".
- **Horiz-scale.** Out of scope for v1.1. If v1.2 needs it, add `extension-redis` and a Redis container alongside the hub in `docker-compose.yml.template`. No code change in the dev-server peers — they don't care which hub instance answered.
- **TLS / transport.** Hocuspocus speaks plain WS; TLS is terminated upstream — Caddy (Docker target), Fly's auto-cert (Fly target), or ALB / Cloudflare Tunnel. Phase 9 Task 6 + Task 7 cover the deploy permutations. The hub binary itself never owns a cert.

## Risk

- **TipTap commercial pressure.** Hocuspocus is the TipTap team's open-source product, and TipTap has clear commercial interest in selling TipTap Collab (the managed SaaS that *also* runs Hocuspocus underneath). If a future release paywalls server-side features — limits multi-document, gates `extension-sqlite` behind a license, etc. — we need a clean exit.
  - **Mitigation:** pin via `package-lock.json` / `pnpm-lock.yaml`, vendor a tarball of the last-OSS version into the hub Docker image build, and keep y-websocket + y-leveldb in mind as the fallback (the Yjs runtime is fine — only the server is replaceable). research-collab.md §4.4 captures the same risk.
- **`workerd` standalone matures.** If Cloudflare ships a production-ready Node-equivalent `partyserver` runtime between this DDR and v1.2, the PartyKit calculus shifts. Worth re-evaluating at v1.2 planning. **Not at v1.1.** We need a decision now; PartyKit can't deliver one for self-host today.

## Acceptance test

This DDR is satisfied when Phase 9 Task 1's validate row passes: `node plugins/design/hub/dist/hub.bundle.mjs` boots on `localhost:1234`, two `@hocuspocus/provider` (or `y-websocket`-protocol-compatible) clients connect to the same `documentName`, mutate a `Y.Text`, and converge — with SQLite at `<DATA_DIR>/hub.db` persisting the state across a restart.
