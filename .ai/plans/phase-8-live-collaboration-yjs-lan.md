# Phase 8: Live collaboration — "Ambient multiplayer" (LAN, no hub)

> **Architectural note:** This phase ships LAN-only peer-to-peer collab as v1.0 MVP. **Phase 9** (v1.1) introduces the self-hostable hub + bidirectional file sync — that's where the "deploy your own collab server" story lives. Phase 8 is the foundation: Yjs + Awareness over the existing dev server, no remote hub.

## Description

Add Figma-grade live collaboration **for ephemeral and add-only state** — multi-cursor presence, selection awareness, viewport sync, and Yjs-backed comment threads — implemented as a **local-first** WebSocket gateway on top of the existing dev server. Two collaborators on the same LAN (or via a user-provided tunnel like Tailscale / Cloudflare Tunnel) join the same dev server, see each other's cursors / selections / pin-comments / draw annotations sync in real-time. No SaaS dependency.

**Crucially, this phase does NOT do live HTML co-editing.** That requires structured CRDT over a stable element-identity layer (`data-cd-id` tagging, HTML ↔ Y.XmlFragment round-trip fidelity, Write-tool→Y-op diffing) — deferred to Phase 9. Phase 8 ships in ~2 weeks; Phase 9 takes 6-8 more.

Research grounding: see `.ai/docs/research-collab.md` (sub-problems S1-S9, prior-art survey, CRDT vs OT vs LWW analysis, Yjs vs Automerge vs Loro deep dive, AI-as-peer integration approaches).

## User Story

As a designer pairing with a developer reviewing a canvas, I want to see their cursor and selection in real-time, drop a pin-comment on a button, see them respond in the same thread, and have the AI agent's `/design "<feedback>"` run show up as a "Claude is editing this canvas" banner so that we don't trip over each other or switch to Slack mid-review.

## Problem

- Canvas review today is one-person-at-a-time. Pair review requires screen-share.
- The "look at my pin-comment" experience requires Slack screenshots — no in-context awareness.
- Figma solves this but requires a SaaS account per participant. maude's value prop is repo-local — we need parity without the SaaS.
- Comments stored as JSON files (Phase 6) face naïve last-write-wins conflicts when two peers add at once.
- AI agent (`/design "<feedback>"`) can clobber another peer's local edits today — there's no awareness of in-flight writes.

## Solution

Layer **Yjs + y-protocols** over the existing `node:http` server. Three logical layers:

1. **Awareness layer (ephemeral)** — Yjs Awareness protocol for cursors, selections, viewport, typing indicators, "X is here" presence chips. Nothing persisted; lives only in connected-peer memory.
2. **Shared state layer (persisted CRDT)** — One Y.Doc per canvas. Contains: comments (Y.Array of comment objects), draw annotations (Y.Array of SVG ops), per-canvas presentation metadata. Persisted to `.design/_state/<slug>.ydoc.bin` (gitignored by default; serialized to existing JSON file formats at quiescence for human-readable git diffs).
3. **AI activity layer (broadcasted notice)** — When `/design` slash command starts, dev server emits a `canvas.editing { author: "Claude", until: <ts> }` Awareness frame. Other peers see a soft banner; HTML write happens normally and on completion server emits `canvas.editing.cleared`. **No HTML co-editing.** No CRDT on the HTML body in this phase.

Transport: existing dev-server WebSocket, extended with `y-websocket`-compatible binary protocol. Discovery: `--bind 0.0.0.0` opt-in flag (refuses non-loopback unless `MDCLAUDE_LAN=1` env). Cross-NAT pairing: user-provided Tailscale / Cloudflare Tunnel (recipes in docs).

## Metadata

- **Type:** New Feature (foundational — Phase 9 builds on this)
- **Complexity:** Medium-High (downgraded from "Very High" by scope cut)
- **Depends on:** Phase 4 (canvas v2 substrate), Phase 6 (existing JSON-comment format to migrate)
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/dev-server/server.mjs` (Yjs room manager + y-websocket protocol handler)
  - `plugins/design/dev-server/runtime/collab/` (new — Y.Doc registry, room lifecycle, persistence)
  - `plugins/design/dev-server/client/collab/` (new — cursor renderer, presence chips, AI banner, comment binding to Y.Array)
  - `plugins/design/dev-server/config.schema.json` (extend `collab` block: enabled, autoBind, secret)
  - `plugins/design/dev-server/package.json` (Phase 1 stub fills with: `yjs`, `y-protocols`; bundled into `dist/server.bundle.mjs`)
  - `cli/commands/design.mjs` (extend `serve` with `--bind <addr>` + `--collab-token <token>`)
  - `.design/_state/.gitkeep` + `.gitignore` entry for `_state/*.ydoc.bin`
  - `.design/_collaborators.json` (new — opt-in list of git identities for the project; commits to repo)
  - `docs/site/content/docs/collaboration.mdx` (Phase 2 page covering Tailscale / CFT recipes + threat model)
  - `docs/SECURITY.md` (extend with collab threat model)

---

## Tasks

### Task 0: Threat model + persistence DDR

- **Do:** Document the network model loudly:
  - LAN binding = trust the LAN.
  - Authentication = shared-secret query token (`?token=<random>`); not crypto-grade. Anyone with the token can read+write.
  - Refuse non-loopback bind without `MDCLAUDE_LAN=1` env opt-in.
- **Do:** DDR for persistence: `.ydoc.bin` is **gitignored by default**. Snapshot to existing JSON files (`.design/_comments/<slug>.json`) at quiescence (debounce 800ms). The JSON is the git-friendly artifact; `.ydoc.bin` is the live state and is regenerated from JSON on cold open if missing.
- **Validate:** DDR exists in `.ai/decisions/`. README + docs site has prominent "this is not a SaaS, you own your network model" callout.

### Task 1: Yjs + y-protocols integration (server)

- **Do:** Add `yjs` (~32KB gz) + `y-protocols` (~5KB) to `plugins/design/dev-server/package.json`. esbuild bundles them into `dist/server.bundle.mjs` (still zero runtime deps from end user's POV — workspace deps are inlined). Server registers a new path `WS /ws/collab/<canvas-slug>` speaking the y-websocket binary protocol (sync step 1, sync step 2, update messages, awareness updates).
- **Pattern:** Reference implementation: `y-websocket/bin/server.cjs` (140 lines). Adapt inline; don't bundle the npm `y-websocket` package — its CLI binary isn't what we want.
- **Validate:** Two browser tabs to same canvas → Y.Doc updates from tab A appear in tab B within 50ms.

### Task 2: Cursor + selection awareness

- **Do:** Each client publishes its Yjs Awareness state: `{ name, color, cursor: {x, y}, selection: { cssPath, bounds }, viewport: { x, y, zoom } }`. Color derived from hash of `git config user.name`. Cursor render = colored SVG arrow + name label on the Pixi.js stage (so it pans / zooms with viewport). Throttle send rate to 30Hz; receiver lerps to next position.
- **Pattern:** Excalidraw multiplayer architecture; tldraw cursor rendering.
- **Validate:** Two cursors visible simultaneously; both 60fps smooth.

### Task 3: Comments backed by Y.Array

- **Do:** Migrate Phase 6 comments from raw `.design/_comments/<slug>.json` reads to Y.Array of comment objects inside the Y.Doc. Comment add / reply / resolve are Y.Array ops — commutative, no LWW conflicts. On 800ms quiescence the server writes a JSON snapshot back to `.design/_comments/<slug>.json` for git visibility. Reverse path: cold open reads the JSON and seeds the Y.Doc if `.ydoc.bin` is missing.
- **Validate:** Add comment in tab A → appears in tab B within 200ms. Both add comments simultaneously → both appear, neither lost.

### Task 4: AI activity awareness ("soft lock")

- **Do:** When `/design "<feedback>"` starts, the orchestrator (slash command) POSTs `/api/ai/start` with `{ canvas, author: "Claude (acting for <git-user>)", until: <ts+30s> }`. Server broadcasts an Awareness frame `ai.editing`. Clients render a yellow banner "Claude is editing this canvas — your changes may conflict". On completion (or timeout): `POST /api/ai/end`. Banner clears.
- **Pattern:** This is Approach B from `.ai/docs/research-collab.md` § AI agent integration models. Approach A (AI emits structured Yjs ops) is correct on the merits but moves to v2.
- **Validate:** Trigger `/design` from one tab; second tab shows banner within 200ms; banner clears on completion.

### Task 5: Draw annotation sync

- **Do:** Phase 5's `.design/<slug>.annotations.svg` becomes a Y.Array of stroke ops. Add stroke / erase = Y.Array ops. Quiescence snapshot writes SVG file for git.
- **Validate:** Pen-circle an element in tab A → appears in tab B in <200ms.

### Task 6: Participant chrome

- **Do:** Top-right of canvas chrome shows colored avatars of connected peers (initials in colored circle). Hover for full name + git identity. Click "Follow" pins your viewport to theirs (broadcasts a `follow.target` Awareness key; their viewport.update events get applied as your viewport).
- **Validate:** Follow mode pans + zooms in lockstep.

### Task 7: Persistence + reconciliation

- **Do:** On disk: `.design/_state/<slug>.ydoc.bin` is the binary Y.Doc state (gitignored). Server loads on canvas open; saves on every Y.Doc update (debounced 200ms write). On cold open with no `.ydoc.bin` but existing JSON snapshots (comments, annotations) → seed Y.Doc from those JSON files (recover from "git pull, but I haven't run collab yet" case).
- **Do:** **Git lifecycle:** server watches `.git/HEAD` via `node:fs.watch`. On branch switch or pull mid-session: prompt peers "Repo state changed — reload to sync"; on confirm, reload Y.Doc from disk JSON (discards any in-flight edits not yet snapshotted). No automatic reconcile across branch boundaries — explicit user choice.
- **Validate:** Edit comments → close browser → reopen → comments preserved. Edit comments → `git pull` brings new commits → peer prompted to reload.

### Task 8: Discovery + transport docs

- **Do:** `docs/site/content/docs/collaboration.mdx` documents:
  1. **LAN happy path**: `maude design serve --bind 0.0.0.0 --collab-token <random>` → share `http://<lan-ip>:<port>/?token=<random>` with peer.
  2. **Tailscale recipe**: install Tailscale → server stays `--bind 0.0.0.0` → share Magic DNS URL.
  3. **Cloudflare Tunnel recipe**: `cloudflared tunnel --url http://localhost:<port>` → share resulting URL.
  4. **Why no auto-relay**: explicit non-goal statement.
- **Do:** `cli/commands/design.mjs` extends `serve` with `--bind` + `--collab-token`; if `--bind 0.0.0.0` without `--collab-token`, prompt user (security gate).
- **Validate:** Follow Tailscale recipe; two machines collab successfully.

### Task 9: Performance + stress test

- **Do:** Harness in `plugins/design/dev-server/test/collab-stress.mjs` spawns 5 simulated clients on the same Y.Doc, broadcasts cursor at 30Hz for 5 minutes, monitors server RSS + Y.Doc size growth. Pass criteria: < 50MB RSS growth, < 1MB Y.Doc growth (with autoCompact enabled).
- **Validate:** Stress test passes locally and in CI (quality.yml).

---

## Validation

1. **Static:** Bundle size delta: Yjs+y-protocols ≈ 37KB gz added to `dist/server.bundle.mjs`. Acceptable.
2. **Functional:** Two-browser smoke test on `localhost`; LAN smoke test on two machines; Tailscale smoke on two machines.
3. **Stress:** 5 simulated clients × 5 minutes × 30Hz — no memory leak; bounded Y.Doc growth.
4. **Cross-platform scenario:** `collab-two-cursors` web-desktop only (mobile out of scope per PRD).
5. **Security:** Server refuses `--bind 0.0.0.0` without `MDCLAUDE_LAN=1`; refuses incoming WS without valid `?token=` query.
6. **Git lifecycle:** Branch-switch detection fires; pull mid-session triggers reload prompt.

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `collab-two-cursors` | Two participants join same canvas → both cursors visible → A selects element → B sees "Alice is looking at <button>" pill | 🆕 new |
| `collab-comment-sync` | A adds pin-comment → B sees pin within 200ms → B replies → A sees reply → A resolves → B sees resolved | 🆕 new |
| `collab-follow-mode` | A clicks "Follow Bob" → B pans / zooms → A's viewport follows in lockstep | 🆕 new |
| `collab-ai-banner` | A invokes `/design "..."` → B sees yellow "Claude is editing" banner → completion → banner clears | 🆕 new |
| `collab-branch-switch` | A and B collab → A does `git checkout other-branch` → both see reload prompt → on confirm Y.Doc reseeds from new disk state | 🆕 new |

---

## Acceptance criteria

- [ ] Threat model + persistence DDR signed off.
- [ ] Cursors, selections, viewport sync within 50ms on LAN.
- [ ] Comments survive simultaneous adds from 2+ peers (no LWW loss).
- [ ] Annotations sync bidirectionally.
- [ ] AI activity banner fires reliably on `/design` start and clears on completion / timeout.
- [ ] Participant list + follow mode functional.
- [ ] `.ydoc.bin` gitignored by default; JSON snapshot path preserved for git diff visibility.
- [ ] Branch-switch detection triggers reload prompt.
- [ ] Non-loopback bind requires `MDCLAUDE_LAN=1` + `--collab-token`.
- [ ] Cross-NAT docs include working Tailscale + Cloudflare Tunnel recipes.
- [ ] All five scenarios pass.
- [ ] Stress test passes (5 clients × 5 min × 30Hz, < 50MB RSS growth, < 1MB Y.Doc growth).
- [ ] **No HTML co-editing in this phase** — confirmed via Phase 9 plan existence.
