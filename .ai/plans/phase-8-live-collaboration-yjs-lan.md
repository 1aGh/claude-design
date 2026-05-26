# Phase 8: Live collaboration foundation (multi-tab + hub-ready)

> **Architectural note:** This phase ships the Yjs collab **foundation** — loopback-only multi-tab collab on a single machine, plus the runtime/persistence/Awareness layers that **Phase 9** (v1.1) builds on for cross-machine "deploy a hub" collab. There is **no LAN bind, no tunnel mode, no cross-machine networking** in this phase. v1.0 collaboration stories: (a) git push/pull handoff (works today), (b) loopback multi-tab/multi-Claude-Code preview (this phase). Cross-machine collab = Phase 9. **Phase 10** (v1.2, conditional) would add structured CRDT for true HTML element-level co-edit; only if Phase 9 incidents prove it's needed.

## Description

Lay down the Yjs runtime, Awareness protocol, and persistence layer that Phase 9 needs — and as a side-effect, enable **multi-tab collab on a single machine**: two browser tabs (or two Claude Code instances editing the same repo) see each other's cursors, share comment threads as commutative CRDT operations, see an "AI is editing" banner during `/design:edit` runs, and have draw annotations sync in real-time. All over loopback WebSocket — zero network exposure.

**This phase does NOT do live HTML co-editing.** That requires structured CRDT over a stable element-identity layer (`data-cd-id` tagging, HTML ↔ Y.XmlFragment round-trip fidelity, Write-tool→Y-op diffing) — deferred to Phase 10. Phase 8 ships ~10 days; Phase 9 takes ~4-5 weeks more.

Research grounding: see `.ai/docs/research-collab.md` (sub-problems S1-S9, prior-art survey, CRDT vs OT vs LWW analysis, Yjs vs Automerge vs Loro deep dive, AI-as-peer integration approaches).

## User Story

As a designer reviewing a canvas with the AI running `/design:edit` in another terminal, I want to see a "Claude is editing this canvas" banner so I know not to interfere, drop a pin-comment on a button without worrying about file-level race conditions, and have my annotations persist across page reloads — so that solo + AI workflow is safe, and the same primitives I use solo will let me add live remote peers in v1.1 by deploying a hub.

## Problem

- Canvas review today has no awareness layer. When `/design:edit` is running, the user can be looking at stale HTML in another tab, or hand-editing the same file from another terminal — and silently lose work.
- Comments stored as JSON files (Phase 6) face naïve last-write-wins conflicts when two Claude Code instances on the same repo write at once.
- Without Yjs in the runtime, we can't add cross-machine collab in Phase 9 without a foundational refactor — the runtime needs to be Yjs-aware before we add a hub binary.

## Solution

Layer **Yjs + y-protocols** over the existing `Bun.serve` dev server. Three logical layers:

1. **Awareness layer (ephemeral)** — Yjs Awareness protocol for cursors, selections, viewport, typing indicators, "X is here" presence chips. Nothing persisted; lives only in connected-peer memory.
2. **Shared state layer (persisted CRDT)** — One Y.Doc per canvas. Contains: comments (Y.Array of comment objects), draw annotations (Y.Array of SVG ops), per-canvas presentation metadata. Persisted to `.design/_state/<slug>.ydoc.bin` (gitignored by default; serialized to existing JSON file formats at quiescence for human-readable git diffs).
3. **AI activity layer (broadcasted notice)** — When `/design:edit` slash command starts, dev server emits a `canvas.editing { author: "Claude", lastHeartbeat: <ts> }` Awareness frame. Other peers see a soft banner; HTML write happens normally and on completion server emits `canvas.editing.cleared`. Banner auto-clears 30s after last heartbeat (crash recovery). **No HTML co-editing.** No CRDT on the HTML body in this phase.

Transport: existing dev-server WebSocket on **loopback only**. Cross-machine collab = Phase 9 (deploy a hub).

## Metadata

- **Type:** New Feature (foundational — Phase 9 builds on this)
- **Complexity:** Medium (downgraded from "Medium-High" after LAN/tunnel scope cut)
- **Depends on:** Phase 4 (canvas v2 substrate), Phase 6 (existing JSON-comment format to migrate)
- **Parallel with:** —
- **Affected files:**
  - `plugins/design/dev-server/server.mjs` (Yjs room manager + y-websocket protocol handler; loopback-only host-header check)
  - `plugins/design/dev-server/runtime/collab/` (new — Y.Doc registry, room lifecycle, persistence)
  - `plugins/design/dev-server/client/collab/` (new — cursor renderer, presence chips, AI banner, comment binding to Y.Array)
  - `plugins/design/dev-server/config.schema.json` (extend `collab` block: `enabled` only — networking is Phase 9)
  - `plugins/design/dev-server/package.json` (Phase 1 stub fills with: `yjs`, `y-protocols`; bundled into `dist/server.bundle.mjs`)
  - `.design/_state/.gitkeep` + `.gitignore` entry for `_state/*.ydoc.bin`

---

## Tasks

### Task 0: Persistence DDR

- **Do:** DDR for persistence: `.ydoc.bin` is **gitignored by default**. Snapshot to existing JSON files (`.design/_comments/<slug>.json`) at quiescence (debounce 800ms). The JSON is the git-friendly artifact; `.ydoc.bin` is the live state and is regenerated from JSON on cold open if missing.
- **Note:** No threat model in this phase — server is loopback-only. Cross-machine threat model lives in Phase 9 DDR (Hocuspocus auth + WSS).
- **Validate:** DDR exists in `.ai/decisions/`. README clearly states "v1.0 = git handoff or loopback multi-tab; live cross-machine collab is v1.1 via Phase 9 hub deploy."

### Task 1: Yjs + y-protocols integration (server)

- **Do:** Add `yjs` (~32KB gz) + `y-protocols` (~5KB) to `plugins/design/dev-server/package.json`. esbuild bundles them into `dist/server.bundle.mjs` (still zero runtime deps from end user's POV — workspace deps are inlined). Server registers a new path `WS /ws/collab/<canvas-slug>` speaking the y-websocket binary protocol (sync step 1, sync step 2, update messages, awareness updates). **Loopback-only:** WS upgrade handler rejects any request whose `host` header is not `127.0.0.1`, `[::1]`, or `localhost` (any port) — returns HTTP 403 with body `"cross-machine collab requires Phase 9 hub deploy"`.
- **Pattern:** Reference implementation: `y-websocket/bin/server.cjs` (140 lines). Adapt inline; don't bundle the npm `y-websocket` package — its CLI binary isn't what we want.
- **Validate:** Two browser tabs to same canvas → Y.Doc updates from tab A appear in tab B within 50ms. `curl -H 'host: example.com' http://127.0.0.1:4399/ws/collab/foo` → 403.

### Task 2: Cursor + selection awareness

- **Do:** Each client publishes its Yjs Awareness state: `{ name, color, cursor: {x, y}, selection: { cssPath, bounds }, viewport: { x, y, zoom } }`. Color derived from hash of `git config user.name`; fallback to `anonymous-<short-pid>` if unset (so fresh-clone users still get a stable color per session). Cursor render = colored SVG arrow + name label on the Pixi.js stage (so it pans / zooms with viewport). Throttle send rate to 30Hz; receiver lerps to next position.
- **Pattern:** Excalidraw multiplayer architecture; tldraw cursor rendering.
- **Validate:** Two cursors visible simultaneously; both 60fps smooth. Unset `git config user.name` → anonymous fallback renders correctly.

### Task 3: Comments backed by Y.Array

- **Do:** Migrate Phase 6 comments from raw `.design/_comments/<slug>.json` reads to Y.Array of comment objects inside the Y.Doc. Comment add / reply / resolve are Y.Array ops — commutative, no LWW conflicts. On 800ms quiescence the server writes a JSON snapshot back to `.design/_comments/<slug>.json` for git visibility. Reverse path: cold open reads the JSON and seeds the Y.Doc if `.ydoc.bin` is missing.
- **Validate:** Add comment in tab A → appears in tab B within 200ms. Both add comments simultaneously → both appear, neither lost.

### Task 4: AI activity awareness with heartbeat ("soft lock")

- **Do:** When `/design:edit` starts, the orchestrator (slash command) POSTs `/api/ai/start` with `{ canvas, author: "Claude (acting for <git-user>)" }`. Server broadcasts an Awareness frame `ai.editing`. Clients render a yellow banner "Claude is editing this canvas — your changes may conflict".
- **Heartbeat:** Slash command pings `/api/ai/heartbeat` every 10s while running. Server tracks `lastHeartbeat`; broadcasts updated Awareness frame. Banner auto-clears if `now - lastHeartbeat > 30s` (handles crashed slash command).
- **Explicit end:** On normal completion or error, slash command POSTs `/api/ai/end`. Banner clears immediately.
- **Pattern:** This is Approach B from `.ai/docs/research-collab.md` § AI agent integration models. Approach A (AI emits structured Yjs ops) is correct on the merits but moves to v2 (Phase 10).
- **Validate:** Trigger `/design:edit` from one tab; second tab shows banner within 200ms. Banner stays during 90s+ edits (heartbeat refresh works). Kill slash command mid-run (SIGKILL); banner clears within 30s. Normal completion clears banner immediately.

### Task 5: Draw annotation sync

- **Do:** Phase 5's `.design/<slug>.annotations.svg` becomes a Y.Array of stroke ops. Add stroke / erase = Y.Array ops. Quiescence snapshot writes SVG file for git.
- **Validate:** Pen-circle an element in tab A → appears in tab B in <200ms.

### Task 6: Participant chrome

- **Do:** Top-right of canvas chrome shows colored avatars of connected peers (initials in colored circle). Hover for full name + git identity. Click "Follow" pins your viewport to theirs (broadcasts a `follow.target` Awareness key; their viewport.update events get applied as your viewport).
- **Validate:** Follow mode pans + zooms in lockstep.

### Task 7: Persistence + reconciliation (no-data-loss git lifecycle)

- **Do:** On disk: `.design/_state/<slug>.ydoc.bin` is the binary Y.Doc state (gitignored). Server loads on canvas open; saves on every Y.Doc update (debounced 200ms write). On cold open with no `.ydoc.bin` but existing JSON snapshots (comments, annotations) → seed Y.Doc from those JSON files (recover from "git pull, but I haven't run collab yet" case).
- **Do:** **Git lifecycle (no-data-loss):** server watches `.git/HEAD` via `fs.watch`. On branch switch or pull mid-session: **first force-snapshot Y.Doc → disk JSON synchronously** (bypassing the 800ms debounce), then prompt peers "Repo state changed — reload to sync?". On confirm, reload Y.Doc from disk JSON. Force-snapshot guarantees in-flight edits are already on disk before user makes the reload choice — no data loss.
- **Validate:** Edit comments → close browser → reopen → comments preserved. Edit comments → `git pull` brings new commits → peer prompted to reload. Inspect `.design/_comments/<slug>.json` between branch switch and reload — must contain the latest in-flight comment (force-snapshot fired).

### Task 8: Multi-tab smoke + persistence stress

- **Do:** Harness in `plugins/design/dev-server/test/collab-multitab.mjs` spawns 2 browser tabs on the same Y.Doc, broadcasts cursor at 30Hz for 2 minutes, monitors server RSS + Y.Doc size growth. Pass criteria: < 20MB RSS growth, < 500KB Y.Doc growth (with autoCompact enabled).
- **Validate:** Test passes locally and in CI (quality.yml).

---

## Validation

1. **Static:** Bundle size delta: Yjs+y-protocols ≈ 37KB gz added to `dist/server.bundle.mjs`. Acceptable.
2. **Functional:** Two-browser-tab smoke test on `localhost`. Two Claude Codes editing same `.design/screen.html` see each other via Awareness banner.
3. **Stress:** 2 tabs × 2 minutes × 30Hz cursor — no memory leak; bounded Y.Doc growth.
4. **Cross-platform scenario:** `collab-multitab-cursors` web-desktop only (mobile out of scope per PRD).
5. **Security:** Server refuses non-loopback `host` header on `/ws/collab/*`. No `--bind 0.0.0.0` flag exists in CLI surface (Phase 9 reintroduces network exposure through the hub binary, not through dev-server).
6. **Git lifecycle:** Branch-switch detection fires; pull mid-session force-snapshots before reload prompt (no data loss).

## Scenario coverage

| Scenario | Covers user flow | Status |
|----------|------------------|--------|
| `collab-multitab-cursors` | Two browser tabs on same canvas → both cursors visible → A selects element → B sees "Alice is looking at <button>" pill | 🆕 new |
| `collab-comment-sync` | A adds pin-comment → B sees pin within 200ms → B replies → A sees reply → A resolves → B sees resolved | 🆕 new |
| `collab-follow-mode` | A clicks "Follow Bob" → B pans / zooms → A's viewport follows in lockstep | 🆕 new |
| `collab-ai-banner` | A invokes `/design:edit "..."` → B sees yellow "Claude is editing" banner → completion → banner clears. Long edit (60s+) → banner stays via heartbeat. Kill mid-run → banner clears in 30s | 🆕 new |
| `collab-branch-switch` | A and B collab → A does `git checkout other-branch` → force-snapshot fires → both see reload prompt → on confirm Y.Doc reseeds from new disk state, no comment lost | 🆕 new |

---

## Acceptance criteria

- [ ] Persistence DDR signed off.
- [ ] Cursors, selections, viewport sync within 50ms on loopback.
- [ ] Comments survive simultaneous adds from 2+ tabs (no LWW loss).
- [ ] Annotations sync bidirectionally.
- [ ] AI activity banner fires on `/design:edit` start. Heartbeat refresh keeps banner alive during long edits. Crash recovery clears banner within 30s of last heartbeat. Normal completion clears immediately.
- [ ] Participant list + follow mode functional.
- [ ] `.ydoc.bin` gitignored by default; JSON snapshot path preserved for git diff visibility.
- [ ] Branch-switch / git pull triggers force-snapshot → reload prompt → no data loss.
- [ ] WS upgrade rejected for non-loopback `host` header on `/ws/collab/*`.
- [ ] All five scenarios pass.
- [ ] Stress test passes (2 tabs × 2 min × 30Hz, < 20MB RSS growth, < 500KB Y.Doc growth).
- [ ] **No HTML co-editing in this phase** — confirmed via Phase 10 plan existence.
- [ ] **No LAN/tunnel mode** — confirmed by absence of `--bind` flag and by Phase 9 plan being the only cross-machine path.
