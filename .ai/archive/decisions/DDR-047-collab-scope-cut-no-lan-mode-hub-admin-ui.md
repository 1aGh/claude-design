# DDR-047: Collab scope — cut LAN/tunnel mode, add in-hub admin UI, two clean paths only

**Status:** Accepted — 2026-05-26.
**Tags:** collab / phase-8 / phase-9 / scope-cut / yjs / hocuspocus / admin-ui / yagni
**Related:** [Phase 8 plan](../plans/phase-8-live-collaboration-yjs-lan.md) (loopback foundation), [Phase 9 plan](../plans/phase-9-self-hosted-hub-file-sync.md) (hub + sync), [`.ai/docs/research-collab.md`](../docs/research-collab.md) (Yjs/CRDT research baseline).

## Context

Phase 8 (v1.0) was originally specified as "ambient multiplayer on LAN with no hub" — Yjs runtime + `--bind 0.0.0.0` flag + Tailscale/Cloudflare Tunnel recipes + LAN threat model. Phase 9 (v1.1) layered a Hocuspocus hub on top with five deploy targets, a four-mode commitStrategy config, full token CRUD CLI, and three-level local-dev workflows.

Pre-execution review surfaced two distinct concerns:

1. **The LAN/tunnel middle ground has no real audience.** Solo devs use git for handoff. Two-people-in-one-office cases are < 5 % of users and have screenshare available. Remote pairs found Tailscale setup (instal+ACL+Magic DNS on both sides) genuinely *harder* than `maude hub deploy fly` because the latter is one command and the former is two installs plus DNS. Cloudflare Tunnel's quick-tunnel emits a fresh random URL each restart — unusable for daily collab. The LAN mode is **the awkward third option** between "git push" and "deploy a hub" that no real workflow needs.

2. **Hub token management was CLI-only.** A team admin had to SSH/exec into the hub container to run `maude hub token generate`, then paste the output back to Slack. For a "deploy your own collab server" product whose marketing competes with Tailscale and Liveblocks, that's a friction floor we can't ship.

Several smaller items also accumulated as scope-creep risk: full token CRUD before any product feedback (`list`, `revoke`, `--project` scoping), three commitStrategy modes (`full` / `hub-only` / `manual`), five deploy targets including `systemd` + tunnel templates, three-level local-dev fidelity (Level 3 = mkcert + Caddy + Docker for contributors).

## Decision

**Phase 8 (v1.0): loopback-only foundation.** Yjs runtime + Awareness + comments-as-Y.Array + annotations-as-Y.Array + AI activity banner + persistence + branch-switch detection. No network exposure. No `--bind` flag. No tunnel docs. WS upgrade on `/ws/collab/*` rejects any non-loopback `host` header with HTTP 403.

**Phase 9 (v1.1): hub-deployed = the only cross-machine path.** Hocuspocus + SQLite + bidirectional file sync + **in-hub vanilla-JS admin UI** for token + setup + status. Two CLI deploy targets only (`fly`, `docker` universal compose). Per-provider docs cover Fly / AWS Lightsail / AWS EC2+ALB / Hetzner / DigitalOcean / Coolify / Cloudflare-Tunnel-home-server-appendix using the same Dockerfile. Single `full` commitStrategy. Token CLI = `generate` + `rotate` only. Two-level local dev (plain Node + Docker compose). Real-TLS testing via throwaway Fly preview deploys instead of local mkcert.

**v1.0 collaboration story: (a) git push/pull, OR (b) loopback multi-tab on one machine. Cross-machine = deploy a hub (v1.1).** No middle ground.

Additional hardening surfaced during the review and folded into the plans:

- **AI banner heartbeat** (Phase 8 Task 4) — replace fixed `until: <ts+30s>` TTL with `/api/ai/heartbeat` every 10 s + 30 s grace after last ping. Fixes silent banner-clear when `/design:edit` takes > 30 s.
- **Force-snapshot before git-pull reload prompt** (Phase 8 Task 7) — eliminates the "in-flight edits discarded on reload" data-loss vector noted in the original plan.
- **Hub-down offline mode UX** (Phase 9 Task 8) — yellow banner + queue counter + reconnect flash + 24 h red escalation. Plan previously assumed "Yjs handles it"; that's true for ops convergence but the user-facing state needs explicit chrome.
- **In-hub admin UI** (Phase 9 Task 2.5, NEW) — ≤ 15 KB gz vanilla JS bundled into the hub binary. Bootstrap-link printed to logs on first boot, single-use 24 h TTL. After bootstrap, `Authorization: Bearer <HUB_SECRET>`. "Generate invite" button returns one-time token + copy-paste `maude design link` command + QR code. Removes shell-into-container friction.

## Rationale

Reasons to ship the foundation in Phase 8 (don't skip Yjs entirely until Phase 9):

- Phase 9 hub work needs the runtime + Awareness + persistence layers already in place. Skipping Phase 8 wholesale would force a foundational refactor inside the Phase 9 timeline.
- Loopback multi-tab has genuine standalone value: two browser tabs collab, two Claude Code instances on the same repo see each other, AI banner during `/design:edit`. Ships as "Yjs is now in the runtime, multi-tab works".
- Forcing the loopback constraint at the WS upgrade layer (not just "don't document the flag") makes the cross-machine story unambiguous: you can't accidentally expose your dev-server to the LAN.

Reasons the LAN/tunnel mode loses:

- Three weeks of UX work for a use case captured by two cheaper alternatives (git push, deploy a hub).
- Threat model burden — once `--bind 0.0.0.0` exists, it has to be defended forever even when no one uses it.
- Tailscale/CFT setup complexity exceeds `maude hub deploy fly` for the typical remote-pair case.

Reasons the in-hub admin UI wins (despite "Phase 9 is already big"):

- Without it, every hub admin needs shell access to issue invites. That alone makes Maude feel like "self-hosted infra" instead of "a product you deploy". Tailscale and similar competitors normalized "open URL → click button → invite generated" as table stakes.
- Vanilla JS at 15 KB gz is a one-day implementation. The token APIs already exist (Task 2). The UI is a wrapper.
- Removes the most-likely first-touch frustration point from the Phase 9 launch story.

Reasons the YAGNI cuts in Phase 9 win:

- Full token CRUD (`list`/`revoke`/`--project`) is dwarfed by `rotate` in real ops. Rotation IS the kill-switch; explicit revoke is symmetric-but-unused.
- `commitStrategy: hub-only|manual` solves a binary-heavy project problem that we have zero evidence of in the user base.
- Five deploy targets means five maintenance burdens; two (`fly`, `docker`) cover all credible deploys via docs-level per-provider notes.
- Level-3 mkcert+Caddy contributor flow is a 2-hour-onboarding tax for a quality signal that Fly preview deploys give for free (real Let's Encrypt cert, actual WSS).

## Alternatives considered

- **(A) Keep Phase 8 LAN mode but drop only the tunnel docs.** Rejected: `--bind 0.0.0.0` without tunnel guidance produces worse UX (users get the flag, can't figure out how to actually reach across NAT, and we own the support burden). The flag is the surface; cutting it is the cleanest move.

- **(B) Skip Phase 8 entirely; jump straight from solo to Phase 9 hub.** Tempting but rejected: foundational Yjs work (Awareness machinery, comment-as-Y.Array migration from Phase 6, persistence + branch-switch reconciliation) must land somewhere before the hub. Phase 8 IS the place. The product framing changes from "Phase 8 ships LAN collab" to "Phase 8 lays the runtime; Phase 9 ships THE collab story" — better marketing arc anyway.

- **(C) Defer in-hub UI to v1.2.** Rejected: token onboarding friction is the dominant first-touch experience for Phase 9. Shipping v1.1 without it means the launch demo has a "now SSH into your hub container" beat in it. The UI is < 1 day's work given that token APIs already exist.

- **(D) Build the admin UI with shadcn / React.** Rejected on bundle-size grounds (would push the hub binary from ~5 MB to ~10 MB+) and on deploy-surface grounds (Maude's hub is a Node app, not a Next.js app; introducing a frontend toolchain to the hub workspace expands what contributors must understand). Vanilla HTML/CSS/JS at 15 KB gz is the right scale for an admin panel — Stripe-era panel, not phpMyAdmin.

- **(E) Keep `--peer-wins` first-sync flag.** Rejected: hub-wins default + `--adopt` opt-in covers the two real cases (joining an active project; bootstrapping from a populated repo). A third mode adds a decision point at link time that users will get wrong; ship the simpler model and add the third mode only if real cases surface.

## Consequences

**Schedule impact (positive):**
- Phase 8: ~2 weeks → ~10 days (loopback-only foundation, no network surface to debug).
- Phase 9: ~6-8 weeks → ~4-5 weeks (single commitStrategy, two deploy targets via CLI, admin UI replaces full token CRUD, dropped Level 3 dev).
- Combined v1.0 + v1.1 collab work: ~8-10 weeks → ~5-6 weeks. Cuts ~3 weeks without losing capability that anyone will miss.

**Marketing arc (positive):**
- v1.0 = "canvas + AI, multi-tab preview, git handoff" — clean, no asterisks.
- v1.1 = "deploy your own collab server, open URL, invite via UI" — clean Tailscale-style demo.
- v1.0 release notes need an explicit "live cross-machine collab is v1.1; here's the hub preview" call-out so early adopters know it's coming.

**Lock-in / future flexibility:**
- The cut features (LAN bind, hub-only commit strategy, `list`/`revoke` tokens, additional deploy targets, `--peer-wins`, Level 3 mkcert) are all **additive** if demand surfaces. None of them are precluded; they go to the v1.2 backlog explicitly listed at the bottom of Phase 9.
- The added features (heartbeat, force-snapshot, hub-down UX, admin UI) are all **on the critical path** for product quality — they would have been added in v1.1 retros anyway. Doing them up front avoids the "v1.1 shipped, immediately needed v1.2" cycle.

**Risks:**
- **Some user genuinely needs LAN mode.** Mitigation: they can run `maude hub serve --insecure-http` on a local machine and treat it as their own hub. Not as smooth as a built-in LAN flag, but functional.
- **In-hub UI scope creeps.** Mitigation: ≤ 15 KB gz CI guard. Vanilla-JS-only commit guard (no React/SPA framework imports allowed in `plugins/design/hub/src/admin/`).
- **AWS users expect `maude hub deploy aws`.** Mitigation: docs cover Lightsail + EC2+ALB + Fargate paths via the existing `docker` recipe; if demand materializes for a CDK-emitting one-shot, add in v1.2.

**Decision triggers for revisiting:**
- Three or more support requests for "I want LAN-only collab without deploying anything" → reopen LAN mode in v1.2 with a tighter UX (probably an mDNS-based discovery + ZeroTier-style token model, not raw `--bind`).
- Token-management complaint about `rotate` being insufficient → add `revoke` + `list` in v1.2.
- A team running > 3 projects per hub asking for namespace isolation → add `--project` scoping in v1.2.

## References

- Phase 8 plan revision: `.ai/plans/phase-8-live-collaboration-yjs-lan.md` (this commit).
- Phase 9 plan revision: `.ai/plans/phase-9-self-hosted-hub-file-sync.md` (this commit).
- Research baseline: `.ai/docs/research-collab.md` § Self-hostable framework comparison (Hocuspocus vs PartyKit), § AI agent integration models (Approach B = soft-lock banner adopted; Approach A = structured CRDT deferred to Phase 10).
- Phase 10 (v1.2, conditional): structured CRDT for HTML element-level co-edit — only triggered by Phase 9 incidents proving `Y.Text` opaque body is insufficient.
