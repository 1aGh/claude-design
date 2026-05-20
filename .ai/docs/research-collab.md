# Research — Federated Self-Hosted Hub Architecture for `plugins/design/` Collaboration

**Status:** Deep research, decision-grade. Engineering-level depth.
**Date:** 2026-05-12
**Scope:** Design the federated collaboration topology that lets multiple Claude-Code-equipped engineers iterate on the same `.design/*.html` canvases via a long-running, self-hostable hub — while keeping every peer's local repo clone as the source of truth that Claude Code (and humans) read/write through normal filesystem semantics.
**Audience:** Implementers of Maude Phase 8/9/10, plus reviewers who decide what ships in v1.x.

> **Note on history:** A previous version of this document analysed a LAN-only peer-to-peer topology (single Node process per repo, `--bind 0.0.0.0`, Tailscale-as-recipe). That model was wrong for the client's intent and has been replaced. The CRDT/identity/sub-problem analysis from that draft is reused below where still load-bearing (data model in §6, Phase 9 structured-CRDT framing in §13). Everything else is rewritten from scratch.

---

## 1. Executive Recommendation

**Ship in three slices, with the heavy lift in the middle.**

- **v1.0 — Solo + LAN (no hub).** Keep the current `maude design serve` single-machine path exactly as it is. Add a `--bind 0.0.0.0` flag plus a `MDCC_DESIGN_TOKEN` shared secret so two laptops on the same LAN/Tailnet can already meet. No persistence layer, no file sync agent — just presence + comment broadcast over the existing WS. This unblocks "two designers on a coffee shop wifi" without committing to the federated architecture yet, and gives us a fallback if v1.1 slips.

- **v1.1 — Federated Hub + Bidirectional File Sync (the real work).** Introduce a long-running hub service that any user can self-host on a VPS, Fly Machine, Railway service, Coolify node, or home server behind Tailscale Funnel / Cloudflare Tunnel. The hub holds canonical Yjs state for every canvas in the project. Each peer laptop runs an `maude design link <hub-url>` daemon that (a) spawns the existing local dev server unchanged, (b) opens a WS to the hub, and (c) runs a **file-sync agent** that mirrors `.design/` bidirectionally between the hub's Yjs state and the peer's on-disk files. Claude Code on each peer continues to see `.design/screen.html` as a plain local file — never aware that a hub exists. **This is the headline feature.**

- **v1.2 — Structured CRDT for HTML co-edit (current Phase 9).** Once v1.1's transport is stable, replace the "treat HTML as opaque text" assumption with `Y.XmlFragment` parsing in the hub. Enables true concurrent inspector edits and Phase 8 cursors-inside-DOM. Doesn't change the user-visible UX of v1.1 — only the conflict semantics.

**Chosen tech stack (for v1.1):**

- **Hub framework:** **Hocuspocus** (`@hocuspocus/server`) — not PartyKit. PartyKit's server library (`partyserver`) is hard-tied to Cloudflare Workers / Durable Objects; running it on a plain VPS is not a supported configuration. Hocuspocus is MIT-licensed, Node-native, actively maintained (v4.0.0 shipped April 2026, 2.3k stars, 93 releases), and the canonical production Yjs backend in the ecosystem. See §4 for the full comparison.
- **Persistence:** `@hocuspocus/extension-sqlite` for the canvas state store, plus a thin layer that materialises every canvas's quiescent Yjs state as an `.html` file inside `<hubVolume>/.design/` — that materialised tree is what the file-sync agent on each peer mirrors.
- **Transport:** `wss://` only. TLS termination via Caddy / Cloudflare Tunnel / Tailscale Funnel — never the Node process directly.
- **Auth:** Shared-secret bearer token (32-byte hex, stored in peer's `~/.config/mdcc/hubs.json`, never committed). JWT optional in v1.2 if multi-user roles emerge.
- **File-sync algorithm:** **Origin-stamped writes** with a per-file write-suppression window (echo prevention) + chokidar's `awaitWriteFinish` + write-file-atomic (tempfile + rename) on both sides. See §5 for the full state machine.
- **CLI surface:** `maude hub serve`, `maude hub deploy <fly|railway|docker>`, `maude design link <url> [--token <t>]`, `maude design status`, `maude design unlink`. See §7.

**Top 3 risks (each gets a §15 mitigation):**

1. **HTML round-trip drift.** Today the canonical canvas state is a hand-written `.html` file. The moment a Yjs `Y.XmlFragment` becomes the canonical state on the hub, any peer-side serializer disagreement (entity encoding, attribute order, whitespace) causes spurious sync churn. **Mitigation:** in v1.1, the hub does **not** parse HTML into a structured CRDT. It treats each `.html` file as a single `Y.Text` blob with origin-stamped whole-file replacements. Structured CRDT is deferred to v1.2 with stable `data-cd-id` attributes.
2. **Bidirectional echo loops.** Claude Code writes `screen.html` via its `Write` tool → fs.watch fires → file-sync agent pushes to hub → hub broadcasts → agent receives → writes the same bytes back to disk → fs.watch fires again. **Mitigation:** the agent tracks every write it performs in a `recentWrites: Map<path, { hash, expiresAt }>` table; fs.watch events whose new file hash matches a recent write within 1500ms are dropped without push. Detailed in §5.1.
3. **Hub split-brain / restore.** User restores hub from a 3-day-old backup; meanwhile peers kept editing offline. On reconnect, hub state is older than peer state for some canvases, newer for others. **Mitigation:** every peer holds a local Yjs replica (`.design/_state/<slug>.ydoc.bin`, gitignored). Reconnect protocol is a Yjs sync v2 round-trip; the hub merges peer state instead of overwriting. The HTML file itself is rebuilt from the merged Yjs state, not transferred byte-wise. See §11.

**Recommended deploy template (the one we publish first):**

`maude hub deploy fly` — a `fly launch` wrapper that uses `ghcr.io/1agh/maude-hub:v<X.Y.Z>` (multi-arch image we publish from this repo on every tag), a 3GB volume mounted at `/data`, `shared-cpu-1x` machine (~$2/month), `auto_stop_machines = "stop"` so it suspends when idle, and prints the resulting `https://<app>.fly.dev` + a freshly-generated 32-byte token at the end. Fly is the recommended first target because: (a) free-allotment-killed-but-still-cheapest small Node WS hosting (~$2 compute + $0.45 storage = ~$2.50/month idle, ~$5/month active), (b) volumes work without ceremony, (c) WebSocket support is first-class, (d) `auto_stop_machines` gives free-tier-like economics for solo users. Secondary template: `maude hub deploy docker` emits a `docker-compose.yml` + `.env.example` for users with their own VPS / Coolify. Railway is supported but not the *primary* recommendation because its $5/mo trial credit burns down even when idle.

**Decision triggers — when to actually start v1.1:**

- "Two engineers in different cities want to live-iterate the same canvas" hits >2 user reports → start.
- A real customer says "we'd pay" → start.
- Phase 8 LAN-only ships and we see >50% of users running it cross-machine via Tailscale → strong signal the hub is the natural next step.
- If none of the above by v1.0 + 60 days, defer v1.1 indefinitely and invest in Phase 9 (structured CRDT, single-user) instead — that benefits everyone, hub or no hub.

Everything below defends those calls.

---

## 2. Reformulated Problem Statement (Federated Edition)

The previous research framed this as "two laptops on a LAN, the repo is the source of truth, no SaaS". The client's actual mental model is different and worth restating in their own words:

> "Three tiers. A long-running hub the user hosts themselves anywhere — Fly, Railway, Tailscale node, home server. Peer laptops `maude design link <hub>` and from then on `.design/*.html` is bidirectionally synced. Solo mode still works untouched. No SaaS, no PartyKit Cloud lock-in, plug-and-play deploy."

The engineering version:

> Build a self-hostable Yjs-backed hub that holds canonical state for N canvases per project, plus a peer-side daemon that maintains an **eventually-consistent mirror** between the hub's Yjs state and a directory of `.html` files on the peer's local disk — robust to: Claude Code's whole-file `Write` tool, atomic-rename editors (VS Code, `vim`'s swap-and-rename), `git pull` rewriting files mid-session, hub restarts, peer offline windows, two peers writing concurrently. With zero user awareness of Yjs, PartyKit, or sync primitives — the user types `maude design link <url>` and it just works.

**Distinct from the LAN P2P model in three ways:**

1. **Asymmetric topology.** Hub is the source of truth for live session state; peers are caches. (Whereas LAN P2P had every peer equal.) This is simpler to reason about — split-brain is bounded to "peer offline" not "two equal peers diverged".
2. **Persistence is centralised.** Hub has a volume; peers do not need to durably hold Yjs state (though they keep a local Yjs replica for offline tolerance).
3. **NAT / discovery is solved by the hub.** Peers always make outbound WS connections. No STUN, no signaling, no rendezvous protocol. Hub URL is the rendezvous.

**Repo as source of truth — still true, with a clarification.**

The git repo remains the persistent record of design state — it's where commits happen, what `git pull` materialises, what code review looks at. But the hub becomes the *live* source of truth for **sessions in progress**. The two reconcile at quiescence: when no peer has been editing for >5s, the hub flushes its current Yjs state to its own `.design/` materialised tree, peers' file-sync agents mirror that to local disk, and `git status` shows the change ready for the human to `git add` + commit. **Hub is volatile working memory; git is non-volatile committed memory.** This phrasing is the same as v1's "git as savepoint", just with the hub explicitly added as the live tier.

**Sub-problems, federated edition:**

| # | Sub-problem | Layer | Hardness |
|---|---|---|---|
| F1 | Hub bootstrap (deploy, TLS, token) | Hub deploy | Medium — recipes solve it |
| F2 | Peer auth + link handshake | Both | Easy — bearer token |
| F3 | First-sync conflict (peer has files, hub has files) | Sync agent | Hard — needs explicit policy |
| F4 | Echo-loop prevention | Sync agent | Hard — multiple known anti-patterns |
| F5 | Atomic write detection (Claude's Write tool, editors) | Sync agent | Medium — solved by chokidar `awaitWriteFinish` |
| F6 | Hub restart / state restore | Hub persistence | Medium — Yjs handles ops merge; HTML rebuild risk |
| F7 | Git interaction (`git pull` overwrites files) | Sync agent | Hard — same as v1 |
| F8 | AI agent as peer | Cross-cutting | Same as v1 — discussed §10 |
| F9 | Multiple repos one hub | Hub routing | Medium — namespaced doc names |
| F10 | TLS / NAT / public access | Deploy | Solved by Tunnel/Funnel + recipes |

The truly new hard problems vs the LAN model are **F3, F4, F5, F7** — all in the file-sync agent. §5 is the engineering core of this document.

---

## 3. Topology Diagram

```
                                  ┌──────────────────────────────────┐
                                  │             HUB                  │
                                  │  Long-running Node process       │
                                  │  Fly Machine / VPS / Coolify     │
                                  │                                  │
                                  │  ┌────────────────────────────┐  │
                                  │  │ Hocuspocus server          │  │
                                  │  │  - per-canvas Y.Doc (Y.Text│  │
                                  │  │    for HTML; Y.Map for     │  │
                                  │  │    metadata)               │  │
                                  │  │  - awareness (cursors,     │  │
                                  │  │    "X is editing")         │  │
                                  │  │  - JWT/token auth          │  │
                                  │  └─────────┬──────────────────┘  │
                                  │            │                     │
                                  │  ┌─────────▼──────────────────┐  │
                                  │  │ Persistence layer          │  │
                                  │  │  - @hocuspocus/extension-  │  │
                                  │  │    sqlite → /data/hub.db   │  │
                                  │  │  - debounced HTML          │  │
                                  │  │    materialiser → /data/   │  │
                                  │  │    projects/<slug>/.design/│  │
                                  │  └────────────────────────────┘  │
                                  │                                  │
                                  │  TLS via Caddy / CF Tunnel /     │
                                  │  Tailscale Funnel — never raw    │
                                  │  Node, wss:// only               │
                                  └──────────────▲───────────────────┘
                                                 │ wss://hub.example/<project>/<canvas>
                                                 │ Hocuspocus protocol
                                                 │ (Yjs sync v2 + awareness)
                       ┌─────────────────────────┼─────────────────────────┐
                       │                         │                         │
                       │                         │                         │
       ┌───────────────▼───────────────┐  ┌──────▼───────────────┐  ┌──────▼───────────────┐
       │       Peer laptop A            │  │   Peer laptop B      │  │ Future: CI / preview │
       │                                │  │   (same project)     │  │      peer             │
       │  ~/code/myproject/             │  │                      │  │                       │
       │   .design/                     │  │  ~/work/myproject/   │  │                       │
       │     screen.html  ◄──fs.watch──┐│  │   .design/...        │  │                       │
       │     hero.html                 ││  │                      │  │                       │
       │     _state/screen.ydoc.bin    ││  │                      │  │                       │
       │       (Y.Doc replica, gitign) ││  │                      │  │                       │
       │     _server.json (local dev   ││  │                      │  │                       │
       │       server PID, unchanged)  ││  │                      │  │                       │
       │                                ││  │                      │  │                       │
       │  Process: maude design link    ││  │                      │  │                       │
       │   ├─ local dev server (4399) ─┘│  │                      │  │                       │
       │   ├─ Hocuspocus provider ─────┼──┘                      │  │                       │
       │   │   (WS to hub)             │  │                      │  │                       │
       │   └─ File-sync agent           │  │                      │  │                       │
       │       ├─ chokidar watcher      │  │                      │  │                       │
       │       ├─ origin-stamp writer   │  │                      │  │                       │
       │       └─ recentWrites Map      │  │                      │  │                       │
       │                                │  │                      │  │                       │
       │  Claude Code (separate proc)   │  │  Claude Code         │  │                       │
       │   ├─ Read tool  ───────────────┤  │                      │  │                       │
       │   └─ Write tool ───────────────┤  │                      │  │                       │
       │      (writes plain files;      │  │                      │  │                       │
       │       fs.watch sees them)      │  │                      │  │                       │
       │                                │  │                      │  │                       │
       │  Browser (canvas iteration)    │  │  Browser             │  │                       │
       │   ├─ WS to local dev server    │  │                      │  │                       │
       │   └─ Inspector overlay (Cmd+   │  │                      │  │                       │
       │      Click → _active.json)     │  │                      │  │                       │
       └────────────────────────────────┘  └──────────────────────┘  └───────────────────────┘
```

**Arrow semantics:**

- `fs.watch ──►` agent: filesystem change detected (Claude wrote, `git pull` overwrote, human edited in VS Code).
- agent `──►` hub (wss): Yjs update emitted from a local change, after origin-stamp dedupe check passes.
- hub `──►` agent (wss): Yjs update originated from another peer (or a hub-internal materialiser tick).
- agent `──►` disk: atomic write (`tempfile → rename`) of the new canonical bytes, registered in `recentWrites` before the rename so fs.watch's resulting event is suppressed.

**Three layers of state, in order of authority for a given moment:**

1. **Hub Y.Doc** for a canvas where any peer is currently editing → wins.
2. **Hub's materialised `<volume>/.design/<canvas>.html`** when all peers idle for >quiesce window → equivalent to layer 1.
3. **Peer's local `<repo>/.design/<canvas>.html`** → eventually equal to layer 2; differs only during a sync window.

Git is orthogonal — `git pull` writes into layer 3 from outside the sync loop, and the agent treats that exactly the same as a Claude Code write (see §11).

---

## 4. Self-Hostable Framework Comparison

The client explicitly asked: "deeply analyse whether `partykit` runs in Node-host mode." Answer first, then comparison.

### 4.1 PartyKit Framework, Node-Host Mode — Honest Assessment

**Not production-ready as a self-host target.** The repo (`cloudflare/partykit` since the May 2024 Cloudflare acquisition) explicitly describes `partyserver` as "Libraries / Examples / Documentation for building real-time apps with Cloudflare Workers. Powered by Durable Objects." There is a `partykit dev` local dev mode that uses `workerd` (CF's open-source Workers runtime) to simulate the Workers environment on a developer machine — but `partykit serve` for production-on-VPS is **not documented**, not advertised, and `workerd` in standalone deployment is a niche use case with minimal community deployment guides.

A self-hosted production Cloudflare path *does* exist — "cloud-prem" deployment to the user's own Cloudflare account (still Workers, just billed to them). That fails our brief: it's still CF lock-in, requires a CF account, and the user explicitly does not want that.

A standalone-Node port of PartyKit doesn't exist. The framework's core abstraction (party = room = Durable Object) is so tightly coupled to Durable Object semantics (storage API, single-instance routing, hibernation) that emulating it on a plain Node process would be a significant fork.

**Verdict:** treat PartyKit as a non-option for self-host hub. We adopt the *idea* (rooms, awareness, framework-managed persistence) via Hocuspocus instead. Recommend explicitly calling this out in the README so users searching for "PartyKit alternative" find us.

(Needs verification before final commit: confirm by reading `cloudflare/partykit` `packages/partyserver/README.md` and any v2026 release notes; if a `partyserver` Node binary has shipped between this report and implementation, re-evaluate.)

### 4.2 Comparison Table

| Framework | Runtime | Persistence story | Yjs-native | Multi-doc | Auth hook | License | Recent activity | Verdict for hub |
|---|---|---|---|---|---|---|---|---|
| **Hocuspocus** (`@hocuspocus/server`) | Node 22+ / Bun / Deno / CF Workers | Built-in extensions: SQLite, Postgres, S3, custom Database driver. Stored as opaque Yjs binary updates per document. | Yes (purpose-built) | Yes — `documentName` routes inside one WS, single server can host thousands of docs (Connection Management docs) | `onAuthenticate` hook receives token, requestHeaders, documentName; can throw to deny or set `readOnly` | MIT | v4.0.0 April 2026; 2.3k★, 193 forks, 93 releases, active issues, 1948 commits | **Primary recommendation** |
| **y-websocket** + `y-leveldb` | Node 18+ | `YPERSISTENCE` env var → LevelDB dir. `y-leveldb` is the persistence adapter; pluggable to rocksdb/lmdb via `level`. | Yes (canonical) | Yes — room = WS path | None built-in; user wraps `setupWSConnection` | MIT | Steady but minimal — server is "starter code", users typically fork | Fallback if Hocuspocus disappears; loses extensions (auth, S3, hooks) |
| **PartyKit framework** (Node-host) | `workerd` (not Node) — production = CF Workers | Durable Object storage (cloud-only) or KV / R2 / D1 | Via `y-partykit` | Yes (party = doc) | Custom in `onConnect` | MIT (framework); CF lock for prod | Owned by Cloudflare since May 2024; active development on Workers path | **Rejected** — not a Node self-host target |
| **Liveblocks self-hosted** | N/A | N/A | N/A | N/A | N/A | Proprietary | Liveblocks remains a managed SaaS; no open-source self-host server | **Rejected** — defeats brief |
| **Custom (we write it)** | Node, ~500 LOC server | We pick (SQLite via `better-sqlite3`) | Yes (we embed `yjs` directly) | Yes (we design) | We design | MIT (ours) | We maintain | Possible but unnecessary given Hocuspocus exists and is MIT |
| **TipTap Collab (managed)** | TipTap's cloud | Proprietary | Yes (Hocuspocus underneath) | Yes | Yes | Proprietary | Active | **Rejected** — SaaS, not self-host |
| **y-redis** (Yjs + Redis pub/sub) | Node + Redis | Redis Streams as Yjs log | Yes | Yes | Custom | MIT | Active but aimed at horizontally-scaled deployments | Overkill for v1.1; revisit if hub needs multi-node |

**Why Hocuspocus wins decisively:**

1. **Multi-document is free.** The client wants one hub per project (sometimes one hub for several projects of the same user). Hocuspocus routes by `documentName` natively — a single WS connection multiplexes many docs.
2. **Auth is first-class.** `onAuthenticate(data)` runs before WS upgrade completes; we wire bearer-token check there. Five lines of code.
3. **Persistence is extension-shaped.** `@hocuspocus/extension-sqlite` ships a working schema and handles flush cadence. We add our own thin "materialise to `.html` on quiescence" extension on top — see §9.
4. **Documented hooks for everything we need.** `onLoadDocument`, `onChange`, `onDisconnect`, `onStoreDocument` — every state-machine seam already has a callback.
5. **MIT, no platform lock.** Same license terms as Yjs itself. Hub Docker image we ship is purely user's own (uses our published image OR they `npm i` and run their own).
6. **TipTap Collab is the managed version of the same code.** If someone gets cold feet on self-host, they have a documented upgrade path. Doesn't bind us to TipTap.

**The remaining risk:** Hocuspocus is the TipTap team's product, and TipTap has a clear commercial interest in selling TipTap Collab. If they ever paywall server features (read: limit `@hocuspocus/server`), we have a clean exit because Yjs itself is fine and the server is replaceable. Worth setting up a `package-lock.json` lockfile and vendoring an `.npm/` cache for the hub Docker image just in case.

---

## 5. Bidirectional File Sync — The Engineering Core

This is the section the rest of the report exists to support. Get it right and the federated model works. Get it wrong and we ship a corrupting toy.

### 5.1 Echo Loop Prevention — Origin-Stamped Writes

**The naïve trap.** Hub broadcasts an update for `screen.html`. Peer A's sync agent receives it, writes new bytes to `<repo>/.design/screen.html`. chokidar fires `change`. Agent reads the file, generates a Yjs update from the diff, pushes to hub. Hub broadcasts. Repeat forever, growing storage forever.

**The fix has two layers.**

**Layer 1 — Skip on identity.** When the agent receives a remote update and writes the resulting bytes to disk, it computes `sha256(bytes)` and stores `{ path, hash, ts: Date.now() }` in an in-memory `Map<string, { hash, ts }>` called `recentRemoteWrites`. When chokidar fires `change` for that path within `WRITE_SUPPRESS_WINDOW_MS` (default 1500ms), the agent re-hashes the on-disk bytes and **silently drops the event** if the hash matches the recently-applied remote write. After the window, the entry expires and the next write — regardless of source — is treated as a local change.

```ts
// pseudo
async function onLocalFsChange(path) {
  const buf = await fs.readFile(path);
  const hash = sha256(buf);
  const recent = recentRemoteWrites.get(path);
  if (recent && recent.hash === hash && (Date.now() - recent.ts) < WINDOW) {
    return; // ours, drop
  }
  // genuine local change — emit Yjs update for hub
  pushToHub(path, buf);
}
```

**Layer 2 — Idempotency at the Yjs level.** Even with the hash check, a near-miss (peer's CRLF vs hub's LF, trailing newline normalisation) could leak through. The hub-side `onChange` callback runs a *content equality check* (`Y.encodeStateAsUpdate` against the prior update) before broadcasting; if the new Y state is identical to the prior state, no broadcast. This catches the residual ~1% of leakage that hashing misses.

**Why 1500ms?** Empirical sweet spot. fs.watch on macOS (`FSEvents`) typically fires within ~50-200ms of `rename()`. Linux `inotify` is similar. Windows (`ReadDirectoryChangesW`) can be slower (~500ms under load). 1500ms gives 3x safety margin without making a real "human edited then quickly re-edited" change get dropped. Made configurable via `MDCC_SYNC_WRITE_SUPPRESS_MS`.

**Failure mode we tolerate:** if a human genuinely makes two distinct edits within 1500ms that happen to produce the same hash as a pending remote write (essentially impossible — sha256 collision), the second edit is dropped. Acceptable.

### 5.2 Atomic Writes — How Tools Actually Write Files

| Writer | Pattern | What fs.watch sees |
|---|---|---|
| Claude Code `Write` tool | (Needs verification — there's a recurring suspicion in Claude Code issue tracker that `Write` does full overwrite via direct write, not atomic rename. Evidence from #27137: writes use straight `fs.writeFile` semantics, no rename pattern.) | Single `change` event with partially-written then fully-written content; chokidar's `awaitWriteFinish` handles. |
| Claude Code `Edit` tool | Similar — surgical string replacement, written via single write. | Same as `Write`. |
| VS Code save | Configurable. Default on macOS/Linux = atomic write (tempfile + rename). | chokidar sees `add` (temp) → `unlink` (temp gone after rename) → `change` (target now has new contents). `atomic: true` (default) collapses these. |
| `vim` save | Write to `.<name>.swp`, then rename or copy. | Similar fragmentation; `atomic` option in chokidar exists for this. |
| `git pull` / `git checkout` | Write tree entries to working dir; usually `O_CREAT|O_TRUNC` then write, no rename. Multiple files in burst. | Multiple `change` / `add` events in <100ms. |
| `git restore` | Same as checkout. | Same. |
| `git stash apply` | Same. | Same. |
| `fs.rename` (npm `write-file-atomic`) | Write tempfile in same dir, fsync, rename. | One `add` (temp) + one `change` (target). chokidar `atomic: true` collapses. |

**Our writer.** The agent's own writes to disk use `npm/write-file-atomic`. This:
- Writes `<file>.<rand>` in the same directory.
- Optionally `fsync`s.
- Renames `<file>.<rand>` → `<file>` (POSIX atomic; on Windows fs.rename has a known EPERM issue under load, mitigated by retry — write-file-atomic handles it).

Crucially, this means **our writes look exactly like VS Code writes to other watchers**, but we know our hash before we rename, so we can pre-populate `recentRemoteWrites[path]` *before* the rename completes — eliminating the race where fs.watch fires before we register.

**Pre-rename registration pseudo:**

```ts
async function applyRemoteWrite(path, buf) {
  const hash = sha256(buf);
  recentRemoteWrites.set(path, { hash, ts: Date.now() + 0 });
  await writeFileAtomic(path, buf);
  // window starts NOW measured against ts, not pre-set
  recentRemoteWrites.get(path).ts = Date.now();
  scheduleExpiry(path);
}
```

### 5.3 Debounce / Quiescence Timing

Three different clocks:

1. **Local-edit → hub push debounce:** 300ms. Coalesces a burst of fs events (e.g. `git pull` writing 12 files) into reasonably-grouped Yjs updates. Yjs handles intra-update merge fine, but flooding the WS with 50 ops in 100ms is wasteful.
2. **Hub-side quiescence → materialise-to-disk:** 1500ms after last Y.Doc update, hub serializes the current Y.Text canvas state to `<volume>/.design/<canvas>.html` on its own disk (so backups capture the rendered HTML, not just Yjs binary blobs). Doesn't affect peer sync — peers already got the update via Yjs.
3. **awaitWriteFinish (chokidar):** stable-file detection, polls file size every 100ms, considers stable after 300ms unchanged. Catches the half-written-file case.

**Decision: debounces are configurable but defaults must work for both "fast typist" and "git pull dropping 20 files at once".**

### 5.4 Cold Start / First-Sync Conflict — Hub vs Peer vs Empty

The hardest case in the whole sync architecture. Three actors, each may have state. Eight combinations:

| Peer local `.design/` | Peer Y.Doc replica `_state/<canvas>.ydoc.bin` | Hub Y.Doc for `<canvas>` | Action |
|---|---|---|---|
| Empty | None | None | Idle. Peer creates files via `/design:new`, hub mirrors. |
| Empty | None | Has state | **Hub wins** — peer downloads hub state, materialises HTML. |
| Empty | Has state | None | Peer pushes Y.Doc to hub. (Hub was wiped; peer is the only survivor.) |
| Empty | Has state | Has state | Yjs sync v2 merges. After merge, materialise to disk. |
| Has files | None | None | Peer parses each `.html` as a `Y.Text` blob, pushes to hub. (First-time `maude design link` from solo project.) |
| Has files | None | Has state | **Conflict — must prompt.** See below. |
| Has files | Has state | None | Push Y.Doc state to hub; HTML is already correct. |
| Has files | Has state | Has state | Yjs sync v2 merges. If the merged Y.Text disagrees with the on-disk HTML, the on-disk HTML is overwritten with the merged result. (Peer's disk reflects the consensus.) |

**The "must prompt" case** (row 6) — peer has `.html` files on disk, no local Y.Doc replica, hub has state. This happens after:
- Fresh `git clone` of a repo that someone else linked to a hub.
- Peer's `_state/` directory was wiped.
- Peer's first `maude design link` to a hub that's already been seeded by another peer.

The agent **must not silently overwrite** local files. CLI prompts:

```
maude design link wss://hub.example.com (token: ********)

Hub state found for these canvases: screen, hero, settings
Local files found for these canvases: screen (modified 2h ago), hero (unchanged from hub), pricing (no hub state)

  screen:    hub differs from local. [k]eep local / [a]ccept hub / [d]iff / [s]kip
  hero:      local matches hub. [auto-accept]
  pricing:   no hub state. [will upload to hub]

Choose policy (h=hub-wins, l=local-wins, p=prompt-each): _
```

The `--strategy=` flag short-circuits this: `maude design link <url> --strategy=hub-wins` accepts everything from hub; `--strategy=local-wins` uploads everything; `--strategy=prompt` (default) is the interactive flow above.

After first-sync, the agent persists a `<repo>/.design/_state/<canvas>.ydoc.bin` for each canvas — gitignored, but it's the local Y.Doc replica that makes subsequent reconnects cheap (Yjs sync v2 deltas only).

### 5.5 Reference Architectures We Borrow From

- **Syncthing's BEP** ([docs.syncthing.net/specs/bep-v1.html](https://docs.syncthing.net/specs/bep-v1.html)). Block-level sync (128 KiB blocks), local model with hashes per block, mutual hash exchange to identify deltas. Inspires our hub-side hash check on quiescence (we hash the materialised HTML, peers' file-sync agents can `ETag`-style verify they're in sync). **We don't adopt** BEP's block-level granularity — files are small (canvases are 5-200KB), whole-file diffing is fine.
- **`braidfs` ([github.com/braid-org/braidfs](https://github.com/braid-org/braidfs))**. Filesystem-to-Braid-HTTP bidirectional sync. Alpha, but the *idea* — represent filesystem path as a Braid resource, patches both directions — is exactly our problem statement at a higher abstraction layer. We're not using Braid (HTTP-level CRDT is over-engineered for our case where a single WS works) but the *interface* is informative.
- **rsync / librsync (rolling hash delta)**. Not adopted directly because Yjs already gives us cheap deltas. But useful mental model for "what if the hub did want to compute a binary delta when materialising HTML changes"? Currently: no, we send Yjs updates over the wire, not file diffs.
- **Dropbox / iCloud Drive**. Convergent but proprietary. Key takeaways from public reverse-engineering write-ups: (a) always atomic rename on write, (b) hash-and-skip on receive, (c) per-file write lock with brief timeout to prevent two writers in same process. We do all three.
- **VS Code Remote Containers file sync.** Uses `inotify` on the container side, debounced rsync push. Less interesting because VS Code controls both ends; we control neither end.
- **Tonsky's CRDT-over-Dropbox proof of concept** ([tonsky.me/blog/crdt-filesync/](https://tonsky.me/blog/crdt-filesync/)). Most aligned. Tonsky proposes the file *is* the Yjs binary blob; peers exchange blobs via Dropbox. We invert this: the file is the *materialised* HTML (human-editable), Yjs blob is the canonical state on the hub. The choice is forced by our requirement that humans + Claude Code edit `.html` directly.
- **Coder workspace file sync.** Uses `fswatch` + `git pull/push` against an internal git remote per workspace. Inefficient for our latency needs.

### 5.6 Recommended Algorithm — Full State Machine

```
ON STARTUP (peer-side agent):
  1. Read .design/ tree → list of canvases.
  2. Load each <repo>/.design/_state/<canvas>.ydoc.bin if present → local Y.Doc replicas.
  3. Connect WS to hub with bearer token + project namespace.
  4. For each canvas:
     a. Hocuspocus does sync v2 → local replica + hub state converge.
     b. Compute merged Y.Text → bytes.
     c. If bytes !== current on-disk bytes:
        - Register hash in recentRemoteWrites.
        - Atomically rename-write to disk.
  5. Start chokidar on .design/, opts: { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }, atomic: true }.
  6. Mark sync_ready.

ON CHOKIDAR EVENT (path, type):
  if type === 'unlink': handleDelete(path); return;
  if type !== 'change' && type !== 'add': return; // ignore dir events
  buf = readFile(path);
  hash = sha256(buf);
  if (recentRemoteWrites.get(path)?.hash === hash &&
      Date.now() - recentRemoteWrites.get(path).ts < WRITE_SUPPRESS_WINDOW_MS) {
    return; // our own write echoing back
  }
  ydoc = ydocs.get(canvasOf(path));
  ydoc.transact(() => {
    const t = ydoc.getText('html');
    t.delete(0, t.length);
    t.insert(0, buf.toString('utf8'));
  }, /* origin = */ 'local-fs');

ON HOCUSPOCUS UPDATE (canvasName, update, origin):
  if (origin === 'local-fs') return; // don't echo back
  ydoc = ydocs.get(canvasName);
  Y.applyUpdate(ydoc, update);
  // ydoc 'update' listener already wrote to disk via materialiser

ON YDOC UPDATE LISTENER (ydoc, origin):
  // fires for both local-fs and remote origins
  const bytes = ydoc.getText('html').toString();
  const path = pathOf(ydoc);
  if (origin === 'local-fs') {
    // came from disk — push to hub (Hocuspocus provider does this automatically by listening to same update event)
    return;
  }
  // came from remote — write to disk
  applyRemoteWrite(path, Buffer.from(bytes, 'utf8'));

PERIODIC (every 60s):
  for (const [path, entry] of recentRemoteWrites) {
    if (Date.now() - entry.ts > WRITE_SUPPRESS_WINDOW_MS * 2) {
      recentRemoteWrites.delete(path);
    }
  }
  for (const ydoc of ydocs.values()) {
    if (ydoc.isDirty && timeSinceLastUpdate(ydoc) > 1500) {
      saveLocalReplica(ydoc);  // write .ydoc.bin
    }
  }
```

This is ~200 lines of code. Reviewable, testable, debuggable.

---

## 6. Hub Deployment Recipes

The deploy story is the *user-visible* differentiator vs other collab tools — every Yjs hub on the internet has the same trio of code; what makes us pleasant is `maude hub deploy fly` returning a URL + token in 90 seconds.

### 6.1 Recommended primary template: Fly.io

`maude hub deploy fly`:

```toml
# fly.toml emitted by maude
app = "maude-hub-<random6>"
primary_region = "fra"   # configurable, defaults nearest

[build]
  image = "ghcr.io/1agh/maude-hub:v<X.Y.Z>"

[env]
  PORT = "1234"
  HOCUSPOCUS_DB_PATH = "/data/hub.db"
  HUB_DATA_DIR = "/data"

[mounts]
  source = "hub_data"
  destination = "/data"

[[services]]
  internal_port = 1234
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  # Auto-stop when nobody's connected — keeps idle bill near zero
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

Pricing math (May 2026 Fly rates): `shared-cpu-1x` + 256MB = $2.02/month if always-on. With `auto_stop_machines = "stop"`, an idle hub costs ~$0.45/month for the 3GB volume + outbound bandwidth. First active hour wakes the machine in ~3s (WS handshake retries automatically). For two engineers iterating ~8 hours/day: $2-5/month total.

`maude hub deploy fly` execution flow:
1. Check `fly` CLI installed; if not, print install hint.
2. `fly auth whoami` — fail if not logged in.
3. Generate app name, region prompt (default = lowest-latency-to-user from `fly platform regions`).
4. Generate 32-byte hex token.
5. Write `fly.toml` to `~/.config/mdcc/hubs/<app>/`.
6. `fly launch --no-deploy --copy-config --yes`.
7. `fly volumes create hub_data --size 3 --region <r>`.
8. `fly secrets set HUB_TOKEN=<token>`.
9. `fly deploy`.
10. Print: `Hub deployed: wss://<app>.fly.dev` + `Token: <token>` + `To link a project: maude design link wss://<app>.fly.dev --token <token>`.

### 6.2 Docker Compose (self-host VPS, Coolify, home server)

`maude hub deploy docker` emits to `./maude-hub/`:

```yaml
# docker-compose.yml
services:
  hub:
    image: ghcr.io/1agh/maude-hub:v<X.Y.Z>
    restart: unless-stopped
    environment:
      - PORT=1234
      - HOCUSPOCUS_DB_PATH=/data/hub.db
      - HUB_DATA_DIR=/data
      - HUB_TOKEN_FILE=/run/secrets/hub_token
    volumes:
      - hub_data:/data
    secrets:
      - hub_token
    ports:
      - "127.0.0.1:1234:1234"   # bind localhost; user fronts with their own reverse proxy

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  hub_data:
  caddy_data:
  caddy_config:

secrets:
  hub_token:
    file: ./hub.token
```

`Caddyfile`:
```
hub.example.com {
  reverse_proxy hub:1234
}
```

User edits the domain, runs `docker compose up -d`, gets auto-Let's Encrypt + WSS. Works on any VPS, Coolify, Dokku.

### 6.3 Railway

`maude hub deploy railway` — uses `railway.json` + Nixpacks (no Dockerfile required, Railway auto-detects Node):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node hub/index.mjs",
    "healthcheckPath": "/healthz",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Railway auto-handles TLS, WSS, custom domains. Caveat: their $5/month Hobby tier credit burns down even on idle services (no auto-suspend). For a 24/7-idle hub, this is more expensive than Fly's auto-stop machines. We document this trade-off.

### 6.4 Render

`maude hub deploy render` — emits `render.yaml`. **Important caveat:** Render's free tier explicitly does not support persistent disks; the hub would lose state on every spin-down. We emit a `render.yaml` for the Starter tier ($7/month) only, and the CLI flow prints a warning before proceeding.

### 6.5 Coolify / Dokku / raw VPS

Two paths supported:

1. **Coolify "Docker Compose application":** point Coolify at a GitHub repo containing the docker-compose.yml above. Coolify auto-handles TLS via Caddy/Traefik and domain mapping. We document the GitHub template repo `1aGh/maude-hub-template` as a one-click button.
2. **Raw VPS + systemd:** `maude hub deploy systemd` emits `/etc/systemd/system/maude-hub.service`:

```ini
[Unit]
Description=maude collaboration hub
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/maude-hub/index.mjs
Restart=always
User=maude-hub
EnvironmentFile=/etc/maude-hub/env

[Install]
WantedBy=multi-user.target
```

Plus a Caddyfile snippet and `certbot` instructions. This is the "I have a $5/month Hetzner Cloud VPS" path.

### 6.6 Tailscale Funnel / Cloudflare Tunnel (no public IP at all)

Two appliances for the "home server" use case where the user has no public IP:

- **Tailscale Funnel:** `tailscale funnel 1234` exposes `https://<machine>.<tailnet>.ts.net` over WSS, certs auto-provisioned. Free for personal use. We document this as the recommended path for "I want my hub on my Mac mini at home". Limitation: Funnel only listens on 443/8443/10000.
- **Cloudflare Tunnel:** `cloudflared tunnel run` connects the home server outbound to CF Edge; CF gives us a `*.cfargotunnel.com` (or user's own domain) with auto-TLS. Free tier covers our usage. Optionally add CF Access for an SSO layer in front of the bearer token.

In both cases, the hub-side compose file binds to `127.0.0.1:1234` and the tunnel daemon does TLS termination + public exposure. No port-forwarding, no inbound firewall rules.

### 6.7 Pricing Summary

| Target | Idle (no peers active) | Active (~8h/day, 2 peers) | Notes |
|---|---|---|---|
| Fly.io (auto-stop) | ~$0.45/mo (3GB volume) | ~$2-5/mo | **Recommended primary** |
| Fly.io (always-on) | ~$2.50/mo | ~$2.50/mo | Easier debugging |
| Railway Hobby | ~$5/mo (credit burns) | ~$5/mo | Simpler UX, more expensive idle |
| Render Starter | $7/mo | $7/mo | No auto-suspend on paid |
| Hetzner CX11 + Coolify | €4.50/mo | €4.50/mo | Self-managed, can host many hubs |
| Home server + Tailscale Funnel | $0 (electricity only) | $0 | Personal use only per TS ToS |
| Home server + CF Tunnel | $0 | $0 | Commercial use allowed |
| TipTap Collab (managed) | — | $49+/mo | **Rejected** for v1.1 |

---

## 7. Pairing & Discovery UX

The CLI surface, in order of likely first-use.

### 7.1 Commands

```
maude hub serve [--port 1234] [--data-dir /var/lib/maude-hub]
    # Run hub locally for testing / dev / home server. Same Docker entrypoint.

maude hub deploy <target> [--name <appname>] [--region <r>]
    # target ∈ { fly, railway, docker, render, systemd }
    # Generates token, deploys, prints URL.

maude hub token [--rotate]
    # Print or rotate the deployed hub's token (requires platform credentials).

maude design link <hub-url> [--token <t>] [--strategy hub-wins|local-wins|prompt]
    # Run from inside a project repo. Establishes the link.
    # - Pings hub, version check.
    # - Auth handshake.
    # - First-sync (see §5.4).
    # - Writes <repo>/.design/config.json with hub URL (committed).
    # - Writes ~/.config/mdcc/hubs.json with hub URL + token (machine-local, never committed).
    # - Starts long-running daemon (local dev server + sync agent) via maude design serve.

maude design unlink
    # Stops daemon, removes hub URL from config.json. Local files unchanged.

maude design status
    # Shows: hub URL, connection state, last sync per canvas, pending conflicts.

maude design serve [--linked]
    # Replaces today's serve. If .design/config.json has linkedHub, connects automatically.
    # Otherwise solo mode (current behavior).

maude design adopt <hub-url>
    # Convenience: link an existing project to an existing hub that was previously seeded
    # by another peer. Implies --strategy=hub-wins. Used after `git clone`.
```

**Naming rationale:**
- `hub` vs `server` — picked `hub` because "server" is overloaded with the per-peer local dev server. `hub` reads naturally for the long-running shared service.
- `link` vs `connect` vs `pair` — `link` is the right verb (it's persistent, you do it once, not per-session).
- `adopt` for "this repo already exists locally, the hub already has state for it, just trust the hub" — common pattern after `git clone` + want to join.

### 7.2 What gets committed where

| File | Committed to git? | Why |
|---|---|---|
| `<repo>/.design/config.json` (contains `linkedHub` URL) | Yes | So `git clone` + `maude design serve` knows where to connect. |
| `<repo>/.design/<canvas>.html` | Yes | The materialised state — the artefact. |
| `<repo>/.design/_state/<canvas>.ydoc.bin` | **No** (.gitignored by `maude init`) | Machine-local Yjs replica. |
| `<repo>/.design/_server.json` (PID/port) | **No** | Runtime state. |
| `<repo>/.design/_active.json` (inspector's selected element) | **No** | Runtime state. |
| `<repo>/.design/_history/` (snapshots) | Opt-in | User decides. |
| `~/.config/mdcc/hubs.json` (token) | **N/A — outside repo** | Per-machine credentials. |
| `<hubVolume>/hub.db` (hub side) | N/A | Hub-side persistence. |
| `<hubVolume>/.design/<canvas>.html` (hub-side materialised tree) | N/A | Hub-side rendered HTML, for backups. |

### 7.3 Multiple hubs per repo

**Not supported in v1.1.** The complexity (which hub gets the write? merge across hubs?) is out of proportion to the use case. If someone really wants this, they can fork the repo with a different `.design/config.json`.

### 7.4 Multiple repos per hub

**Yes.** Hub's `documentName` is namespaced as `<project-id>/<canvas-slug>`. `.design/config.json` includes a `projectId` UUID generated at first `maude design link`. Same hub can host designs for many projects, each isolated by namespace.

---

## 8. Auth Model

### 8.1 v1.1 — Bearer token (shared secret)

Simplest thing that works.

- Hub generates a 32-byte hex token at first deploy (or rotation). Stored as `HUB_TOKEN` env var on the hub.
- Peer's `maude design link <url> --token <t>` writes `{ url, token }` to `~/.config/mdcc/hubs.json` (mode 0600).
- Hocuspocus provider sends token in `parameters.token`; hub's `onAuthenticate` compares against env.
- Read-only mode unused in v1.1 (everyone is read-write).

**Rotation:** `maude hub token --rotate` (uses platform CLI credentials to set new env var, prints new token, instructs peers to re-run `maude design link --token <new>`). Manual but acceptable.

### 8.2 v1.2 — JWT-per-user (optional, only if multi-user matters)

If we get a user with team-roles needs:

- Hub holds an HMAC secret.
- An `maude hub user add <email>` command issues a JWT signed by the secret. JWT claims: `{ sub: email, roles: ['editor'], exp }`.
- `onAuthenticate` verifies JWT and stores user info on `data.connection.context` for use in hooks.
- Peer awareness includes user identity → "Anna is editing" badge becomes meaningful, not just "someone is editing".

Strictly opt-in. v1.1 ships without it.

### 8.3 Network-layer auth wrappers

- **Tailscale ACLs:** If hub is on Tailnet (not Funneled), and peers join the Tailnet, the WS is already authenticated by Tailscale's mTLS. We document `--no-token` mode for this case — hub accepts unauthenticated connections, relies on Tailscale to gate access.
- **Cloudflare Access:** CF Tunnel + CF Access SSO can require Google/GitHub login before WS handshake. Adds a JWT in the `Cf-Access-Jwt-Assertion` header. We document but don't require it.

### 8.4 Rate limiting

Hub-side: per-IP connection rate limit (`express-rate-limit`-equivalent for WS) + max concurrent connections per token (default: 10). Prevents a leaked token from being weaponised into a denial-of-service for legitimate peers.

---

## 9. Hub Persistence

### 9.1 Volume layout

```
/data/                                       # mounted volume
  hub.db                                     # SQLite, @hocuspocus/extension-sqlite
                                             #   schema: documents (name TEXT PRIMARY KEY, data BLOB)
                                             #   one row per <project>/<canvas>
  projects/
    <project-id>/
      .design/
        screen.html                          # materialised on quiescence (HTML view, for backup readability)
        hero.html
        _state/
          screen.ydoc.bin                    # full Y.Doc snapshot (redundant with hub.db, but file-format-aware)
  meta.json                                  # { version, createdAt, lastBackup }
  audit.log                                  # append-only JSONL: { ts, peer, op, doc }
```

**Why SQLite + filesystem mirror?**

- SQLite (`hub.db`) is the **operational** store — Hocuspocus reads/writes binary Y.Doc updates here, transactionally, fast. Single-file, easy to back up.
- Filesystem mirror (`projects/*/.design/`) is for **human-readable backup** and **disaster recovery debugging**. If `hub.db` corrupts, the most recent quiescent HTML still exists.
- Filesystem mirror is what an `rsync /data root@host2:/data` backup actually captures.

### 9.2 Backup

Three layers:

1. **Continuous (hub.db):** for Fly users, enable Fly volume snapshots (~$0.50/mo per 3GB, daily). For VPS users, document a `cron` job: `rsync /data backup-host:/maude-backups/<date>/`.
2. **Quiescence-driven (filesystem mirror):** every time the hub flushes a canvas to HTML, the file is committed to a small bare git repo `/data/projects/<id>/.design/.git/`. Hub maintains a per-project git log. Optional, opt-in via `HUB_GIT_BACKUP=true`. Gives a free time-travel debugging story.
3. **Peer replicas:** every linked peer also holds a Y.Doc replica in `<repo>/.design/_state/<canvas>.ydoc.bin`. So *even if the hub volume is wiped*, any peer who reconnects can bootstrap the hub. Peer-as-cold-backup is a property of our design, not a feature we need to build.

### 9.3 Multi-project

Single hub can serve N projects. Hocuspocus `documentName` = `<projectId>/<canvasSlug>`. Permission check on `onAuthenticate`: token may be project-scoped (token format: `<projectId>:<random>`) or hub-wide (`hub:<random>`). In v1.1 we only ship hub-wide tokens; project-scoped tokens land if v1.2 introduces JWT.

### 9.4 Cleanup / GC

- Documents that haven't been touched in 90 days get compacted: `Y.encodeStateAsUpdate` → store single update, drop incremental updates. Reduces DB size.
- Configurable via `HUB_GC_DAYS`.

---

## 10. AI Agent + Phase 9 Implications

### 10.1 Claude Code as a peer (today's path)

Claude runs locally on a peer's machine. It reads `.design/screen.html` via the `Read` tool, edits via `Edit` or `Write`. Those writes hit the local filesystem; the sync agent picks them up via chokidar (subject to all the rules in §5); the Yjs delta propagates to hub and onward to other peers.

**Crucial property:** Claude doesn't know the hub exists. From Claude's perspective, `.design/screen.html` is just a file. That's the magic — and it's what makes the federated model compatible with arbitrary AI agents, not just Claude.

### 10.2 "Claude is editing" awareness

In v1.1 we want other peers to see "Anna's Claude is editing `screen.html`" while it happens (concurrent human edits cause less surprise).

Implementation: the sync agent inspects `pty` events / Claude Code's `~/.claude/sessions/` (needs verification — does Claude Code expose a hook on `Edit`/`Write` start?) and updates the local Y.Doc's awareness state with `{ user: <name>, agent: 'claude', editing: <path>, since: <ts> }`. Other peers see it through standard Hocuspocus awareness. If no hook is available, a coarser signal — "any unsuppressed write event whose source process matches `claude` in `lsof` output" — suffices.

**Fallback:** every write the sync agent processes is tagged with the originating process name (resolvable from chokidar event + `lsof -p`). Awareness broadcasts `lastWriter: { process, ts }`. Crude but works without Claude hooks.

### 10.3 Phase 9 (structured CRDT) — where it moves

Today: peer-side files are HTML. Hub-side state is `Y.Text(html)`. Concurrent edits to the same string risk garbled output if both peers diff the same line (the Y.Text-on-HTML problem from the prior research §3).

Phase 9 fix: replace `Y.Text` with `Y.XmlFragment` on the hub. Parse HTML at ingress (peer writes file → sync agent parses → emits Y.XmlFragment ops). Serialise to HTML at egress (hub broadcasts → peer applies → re-serialises tree → writes file). **The structured-CRDT logic lives on the hub** (or in a shared `@mdcc/canvas-codec` library used by hub + agent). The peer's local Y.Doc replica becomes `Y.XmlFragment` too.

**Three risks:**

1. **HTML round-trip drift.** Encoded entities, attribute order, self-closing tags, whitespace. The parse-serialise pipeline must be byte-stable for the no-op case (`parse → serialise === original`). We pre-canonicalise on ingress so subsequent serialisations always emit the canonical form — i.e. we *accept* that linking a project to a hub may rewrite `.html` files into canonical form on first sync, and we make sure that rewrite is idempotent.
2. **Stable element identity.** As in the prior research: every parsed element gets `data-cd-id="<uuid>"` on first ingress, persisted in the HTML. Survives round-trips. Cheap.
3. **AI bulk-write loss.** Claude's `Write` tool replaces the entire file. From the structured CRDT's perspective, this looks like "delete every element, insert all new elements", losing all the fine-grained merge benefit. **Mitigation:** sync agent has a smart-diff mode that, when a file is replaced wholesale, runs a tree-diff (similar to `morphdom`) against the previous version and emits the minimal set of XmlFragment ops. This restores merge fidelity for AI edits.

### 10.4 Conflicting AI runs across peers

Two peers both run `/design "<feedback>"` on the same canvas simultaneously. Both Claudes write the file. Sync agent on each emits Yjs ops. Hub merges. Result:

- With Y.Text (v1.1): garbage. Last-write-wins on disk in practice, with weird interleaving where the agents happen to converge.
- With Y.XmlFragment (v1.2): cleaner — two independent element insertions both land; same-element conflicts resolve by Yjs's per-element OT.

**v1.1 mitigation:** advisory soft-lock. When `/design` starts a run, the sync agent broadcasts awareness `{ aiLocked: <canvas>, by: <peerId>, since: <ts> }`. Other peers' `/design` commands warn before proceeding: "Anna's Claude is editing this canvas. Continue anyway? [y/N]". Same pattern as Phase 8's prior plan, just executed via hub awareness rather than LAN broadcast.

---

## 11. Conflict Edge Cases

| # | Scenario | Outcome | Reasoning |
|---|---|---|---|
| 1 | Peer A and B simultaneously change different elements via inspector | Merge cleanly (v1.2). In v1.1, last-fsync wins on overlapping byte ranges. | Standard CRDT. |
| 2 | Peer A edits offline; reconnects later | Yjs sync v2 catches up; merges with hub. No data loss. | Local Y.Doc replica is the safety net. |
| 3 | Peer A edits file in VS Code; agent picks up event; pushes; meanwhile B in browser inspector edited same canvas | Both ops land in hub Y.Doc; merge result reflected on disk for both. | Yjs handles. |
| 4 | `git pull` brings new `screen.html` while session active | Agent sees `change` event; pushes new bytes to hub; hub merges. **If git pull and hub state both have changes to same lines, the merge is by Y.Text — favors the later op.** | This is the v1's worry. v1.1 mitigation: `git pull` produces a single large change; agent debounces (300ms); pushes coherent state to hub; hub broadcasts merged result. Pathological case (two peers `git pull` different upstream branches at the same time) results in canvas reflecting whoever pushed last. Acceptable for v1.1. v1.2's structured CRDT improves but doesn't fully solve. |
| 5 | Hub wiped, restored from 3-day-old backup; peers had been editing | Peer reconnects with newer local Y.Doc; sync v2 merges peer's ops onto hub's older state; hub catches up. | Local replicas saved us. |
| 6 | Peer's local `_state/<canvas>.ydoc.bin` corrupted | Agent detects (Yjs throws on `applyUpdate`); deletes file; bootstraps from hub (effectively row 2 of §5.4 table). | Recoverable. |
| 7 | Hub disk full | Hocuspocus' `onStoreDocument` errors; in-memory state continues; restart loses unflushed updates. **Mitigation:** monitor disk; fly volumes auto-grow on signal; document the alert. | Operational risk, not a sync risk. |
| 8 | Two hubs (rare; user accidentally `maude design link` twice) | **Not supported.** `maude design link` errors if `.design/config.json` already has a `linkedHub`. Must `unlink` first. | Eliminates split-brain class. |
| 9 | Peer machine clock skew (NTP off by hours) | Awareness "since" timestamps wrong; no data corruption (Yjs is causal, not wall-clock). | Cosmetic only. |
| 10 | Network partition: peer thinks connected, hub thinks disconnected (zombie WS) | Hocuspocus' built-in pong/timeout (default 30s) drops; provider auto-reconnects. | Standard. |
| 11 | Claude Code mid-Edit when WS drops | Edit completes locally; agent queues op; on reconnect, pushed via sync v2. No loss. | Local Y.Doc holds the op. |
| 12 | User runs `maude design unlink` while another peer is editing | Local agent stops; other peers continue with hub. Local `.design/` frozen at last-synced state. | Clean. |
| 13 | User force-pushes git, rewriting committed `.html` | After `git push --force`, others `git pull --rebase` — their working dirs get the rewritten file; sync agent treats it as ordinary `change` event; hub catches up. | Same as row 4. |
| 14 | User edits `.design/_state/<canvas>.ydoc.bin` manually | Don't. Documented in `.gitignore` + README. Agent loads on next start; if parse fails, reverts to bootstrap from hub. | Out of contract. |

---

## 12. Migration Paths

### 12.1 Solo → federated

1. User has been working solo for weeks. `.design/` is full of canvases, committed to git regularly.
2. `maude hub deploy fly` — gets hub URL + token.
3. `maude design link wss://hub.example.com --token <t>` — first-sync with `--strategy=local-wins` (or default prompt, picks "upload all"). Hub gets seeded with current `.design/` contents.
4. Future peers `git clone` the repo, run `maude design adopt wss://hub.example.com --token <t>` (or just `maude design serve` if `.design/config.json` already has `linkedHub` — the daemon reads token from `~/.config/mdcc/hubs.json` after one-time `maude design link`).

### 12.2 Federated → solo

1. `maude design unlink` — sync agent stops, local `.design/` is whatever was last synced.
2. `maude design serve` — runs the local dev server unchanged; everything works without the hub.
3. The `_state/*.ydoc.bin` files become orphaned (no peer-to-peer sync). Either delete them or leave them — next `link` to a different hub will treat them as the source of truth.

### 12.3 Federated, hub migration (move from Fly to Hetzner)

1. `maude hub backup --target ./backup` on user's machine (uses platform CLI to dump hub volume to local tarball).
2. `maude hub deploy hetzner` (or `docker` template), restore tarball during init.
3. Each peer: `maude design unlink && maude design link wss://new-hub.example.com --token <t>`.

Friction but uncommon. We document but don't optimise.

### 12.4 Adding a peer mid-project

1. Existing peer running. Hub has state.
2. New peer `git clone`s repo. Repo has `.design/config.json` with `linkedHub`. New peer runs `maude design adopt wss://hub.example.com --token <t>` (or whichever the existing peer told them, ideally via Tailscale-shared `hubs.json` or a private wiki entry).
3. Sync agent first-syncs (`--strategy=hub-wins` because `_state/` is empty); materialises `.design/<canvas>.html` from hub state; ready.

---

## 13. Recommended Architecture in Detail

Pulling it all together for the implementer.

### 13.1 Components

**Hub-side (single Node process, packaged as Docker image):**
- `hub/index.mjs` — bootstrap. Reads env (`PORT`, `HUB_TOKEN`, `HUB_DATA_DIR`).
- `hub/server.mjs` — Hocuspocus instance with `SQLite` extension + custom `MaterialiseHtml` extension.
- `hub/auth.mjs` — `onAuthenticate` hook, bearer token compare.
- `hub/materialise.mjs` — debounced flush of each `Y.Doc` to `<HUB_DATA_DIR>/projects/<id>/.design/<canvas>.html`.
- `hub/audit.mjs` — append `{ts, peer, op, doc}` to JSONL.
- `Dockerfile` — `node:22-alpine`, copy hub/, npm ci, expose 1234.
- Published to `ghcr.io/1agh/maude-hub:vX.Y.Z` on every Maude tag.

**Peer-side (extends current `maude design serve`):**
- `cli/commands/design-link.mjs` — first-time handshake, writes config files, starts daemon.
- `cli/commands/design-serve.mjs` — extended to detect `linkedHub` and start sync agent.
- `cli/commands/design-status.mjs` — reads daemon state via local IPC (Unix socket or a `.design/_daemon.json`).
- `cli/commands/design-unlink.mjs` — clean shutdown.
- `cli/commands/hub-*.mjs` — deploy templates.
- `plugins/design/sync-agent/index.mjs` — new module: chokidar + Hocuspocus provider + recentRemoteWrites logic.
- `plugins/design/sync-agent/codec.mjs` — `Y.Text` ↔ HTML bytes for v1.1; placeholder for v1.2 `Y.XmlFragment` codec.

### 13.2 Where the local dev server fits

The existing `plugins/design/dev-server/server.mjs` is unchanged in v1.1. It still:
- Serves canvas HTML to the browser.
- Injects the inspector overlay.
- Writes `_active.json` on Cmd+Click.
- Handles `_history` snapshots.

The sync agent runs **alongside** it in the same `maude design serve` process (different module, shared event loop). The dev server's writes to `_active.json` etc. are *not* synced (they're gitignored runtime state). The sync agent only watches the canvas HTML files (`.design/*.html`).

### 13.3 Where the design plugin commands fit

`/design`, `/design:new`, etc. continue to issue file edits via Claude Code's `Edit`/`Write` tools. **No changes needed in v1.1.** The sync agent picks up those edits via fs.watch. The plugin remains hub-agnostic.

In v1.2, `/design` may opt into an "agent peer" mode where it bypasses fs.watch and writes Yjs ops directly via a peer process running locally. Optional optimisation.

### 13.4 Where Phase 9 (structured CRDT) plugs in

The codec module (`plugins/design/sync-agent/codec.mjs`) is the seam. In v1.1, it's:

```ts
export function bytesToYjsOps(buf, ydoc) {
  const t = ydoc.getText('html');
  ydoc.transact(() => {
    t.delete(0, t.length);
    t.insert(0, buf.toString('utf8'));
  });
}
export function yjsToBytes(ydoc) {
  return Buffer.from(ydoc.getText('html').toString(), 'utf8');
}
```

In v1.2, it's the structured codec — parse HTML to `Y.XmlFragment` with `data-cd-id` injection, serialise canonical HTML on egress. Same interface, different internals. Hub and agent ship the codec together, version-locked.

---

## 14. Phasing Plan

### v1.0 — Solo + LAN (no hub) — 2 weeks

Goal: ship "ambient multiplayer for two laptops on a coffee-shop wifi" without committing to the federated model.

- `maude design serve --bind 0.0.0.0` flag.
- `MDCC_DESIGN_TOKEN` env-var-shared-secret check on WS upgrade.
- Awareness layer in browser inspector (cursors, selections) over existing WS.
- Comments broadcast (`_comments/*.json` mirrored).
- Documented Tailscale recipe.

No Yjs, no file sync, no hub. Lowest risk. Buys time.

### v1.1 — Federated Hub + Bidirectional File Sync — 8 weeks

Goal: ship the architecture this document describes.

Week 1-2: Hub
- `hub/` directory, Hocuspocus + SQLite + auth.
- Dockerfile, GitHub Actions image publish.
- `maude hub serve` (local Node mode).

Week 3-4: Peer sync agent
- `chokidar` + write-file-atomic + `recentRemoteWrites` echo prevention.
- Hocuspocus provider integration in dev server.
- `Y.Text`-on-HTML codec (v1.1).

Week 5: First-sync + CLI
- `maude design link / unlink / status / adopt`.
- First-sync strategy logic (hub-wins/local-wins/prompt).
- `.design/config.json` schema + git tracking.

Week 6: Deploy templates
- `maude hub deploy fly|docker|railway`.
- README walkthroughs.

Week 7: Hardening
- Reconnect / partition tests.
- Multi-peer end-to-end test (3 peers + 1 hub, full conflict matrix).
- AI-agent awareness signalling.

Week 8: Docs + release
- Quick-start. Architecture diagram. Troubleshooting runbook.
- v1.1 tag + npm publish.

### v1.2 — Structured CRDT for HTML co-edit — 6 weeks

Goal: enable concurrent same-canvas inspector edits without garbling.

- `Y.XmlFragment` codec with `data-cd-id` injection.
- `morphdom`-style diff for AI bulk writes.
- Element-level awareness (cursor inside a specific div).
- Migration path from v1.1: hub-side codec swap with backward-compat `Y.Text` fallback per-canvas.

### Decision triggers per phase

- Ship v1.0 unconditionally — low cost, validates ambient-multiplayer demand.
- Ship v1.1 if any of: >2 users request, >50% of v1.0 users using cross-machine, ≥1 paying interest. Otherwise pause.
- Ship v1.2 if v1.1 ships AND >3 reports of "garbled inspector edits" in production. Otherwise the Y.Text-with-soft-lock UX is acceptable indefinitely.

---

## 15. Risks

### 15.1 HTML round-trip drift (highest)

**Risk:** Even in v1.1 with `Y.Text`-on-HTML, the materialiser writes the file with normalised line endings (LF), but if a user's editor saves CRLF, the file changes on every save → infinite sync traffic.

**Mitigations:**
- Ingress normalisation in sync agent: strip BOM, normalise CRLF→LF before computing hash and feeding Yjs.
- Document the constraint: `.design/*.html` is LF-only. `.gitattributes` enforces.
- Smoke test in CI for Windows.

### 15.2 Bidirectional echo loop bug (high)

**Risk:** The recentRemoteWrites logic has subtle race conditions (e.g. registering hash after rename completes vs before fs.watch fires).

**Mitigations:**
- Pre-register hash before rename (see §5.2 pseudo).
- Conservative window default (1500ms).
- Property-based test suite: 1000 random sequences of (local-edit, remote-edit, race) with assertion "no echo loop within 10 cycles".

### 15.3 Hub split-brain after restore (high)

**Risk:** Hub restored from old backup; peers had been editing; merge produces stale state.

**Mitigations:**
- Local Y.Doc replicas as cold backup.
- `maude design status` shows divergence warning if peer's Y state is N updates ahead of hub.
- Document recovery: `maude design unlink && maude design link --strategy=local-wins` re-seeds hub from a chosen peer.

### 15.4 Hocuspocus upstream changes (medium)

**Risk:** TipTap pivots commercials, deprecates `@hocuspocus/server`.

**Mitigations:**
- Lock to a specific major version.
- Vendor an `.npm/` mirror in the hub Docker image.
- Maintain a "rip cord" — `y-websocket` works for our use case; ~1 week to migrate if forced.

### 15.5 Deploy template breakage (medium)

**Risk:** Fly/Railway change their CLI/API; `maude hub deploy fly` breaks.

**Mitigations:**
- Pin to a specific `flyctl` version range; test in CI weekly via scheduled GH Action.
- Always offer the Docker template as the unchangeable fallback.

### 15.6 Token leakage (medium)

**Risk:** User commits `~/.config/mdcc/hubs.json` accidentally; or pastes token into a chat.

**Mitigations:**
- File mode 0600; warning on `maude design link` if not in `~/.config/mdcc/`.
- Token rotation is fast (`maude hub token --rotate`).
- Hub-side audit log shows IPs of recent connections; user can spot abuse.

### 15.7 Claude `Write` tool behaviour (medium, needs verification)

**Risk:** Claude Code's `Write` tool might not be atomic; partial writes could trigger fs.watch on half-written files.

**Mitigations:**
- `chokidar` `awaitWriteFinish` catches this.
- Empirical CI test: spawn Claude Code, instruct `Write`, observe chokidar events.
- If empirically problematic, document workaround: agent debounces fs events by 500ms on first signal.

### 15.8 Multi-project hub auth confusion (low)

**Risk:** User pastes hub token from project A into project B's `maude design link`. Project B silently joins project A's hub namespace.

**Mitigations:**
- `maude design link` validates `projectId` exists in hub; warns if peer's local `projectId` differs.
- v1.2 introduces per-project tokens.

### 15.9 SQLite contention at scale (low)

**Risk:** >100 concurrent peers writing to single SQLite hub.db.

**Mitigations:**
- WAL mode (default in `better-sqlite3`).
- If contention becomes real, swap to Postgres extension (`@hocuspocus/extension-database` supports drivers).
- Realistically, our scale is single-digit peers per hub.

### 15.10 git interaction (low-medium)

**Risk:** `git pull --rebase` mid-session rewrites `.html`; hub state from concurrent peer wins, user's local commit lost.

**Mitigations:**
- Documented in user-facing docs.
- `maude design status` warns if `git status` shows modified `.design/` files at link-time.
- Suggest workflow: `git pull` before starting `/design`, commit at end.

---

## 16. References

Yjs ecosystem and Hocuspocus:
- [Yjs Awareness & Presence docs](https://docs.yjs.dev/getting-started/adding-awareness)
- [Yjs awareness API](https://docs.yjs.dev/api/about-awareness)
- [y-websocket docs](https://docs.yjs.dev/ecosystem/connection-provider/y-websocket)
- [y-leveldb on GitHub](https://github.com/yjs/y-leveldb)
- [Y.XmlFragment docs](https://docs.yjs.dev/api/shared-types/y.xmlfragment)
- [Y.XmlFragment deserialization discussion](https://discuss.yjs.dev/t/y-xmlfragment-deserialization/1643)
- [Hocuspocus repo (ueberdosis)](https://github.com/ueberdosis/hocuspocus)
- [Hocuspocus getting started](https://tiptap.dev/docs/hocuspocus/getting-started/overview)
- [Hocuspocus SQLite extension](https://tiptap.dev/docs/hocuspocus/server/extensions/sqlite)
- [Hocuspocus database extension](https://tiptap.dev/docs/hocuspocus/server/extensions/database)
- [Hocuspocus auth guide](https://tiptap.dev/docs/hocuspocus/guides/authentication)
- [Hocuspocus hooks docs](https://tiptap.dev/docs/hocuspocus/server/hooks)
- [Hocuspocus 2.0 release post](https://discuss.yjs.dev/t/hocuspocus-2-0-0-and-tiptap-collab-release/1778)
- [Hocuspocus DeepWiki — connection management](https://deepwiki.com/ueberdosis/hocuspocus/2.5-connection-management)
- [Velt blog — Yjs WebSocket production guide 2025](https://velt.dev/blog/yjs-websocket-server-real-time-collaboration)

PartyKit (rejected for self-host):
- [PartyKit acquisition by Cloudflare HN thread](https://news.ycombinator.com/item?id=39941859)
- [partyserver README (Cloudflare/partykit)](https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md)
- [partykit issue #551 — self-host question](https://github.com/partykit/partykit/issues/551)
- [PartyKit deploy-to-own-Cloudflare guide](https://docs.partykit.io/guides/deploy-to-cloudflare/)
- [PartyKit how-it-works](https://docs.partykit.io/how-partykit-works/)

File sync, atomic writes, watchers:
- [chokidar repo](https://github.com/paulmillr/chokidar)
- [write-file-atomic npm](https://github.com/npm/write-file-atomic)
- [fs.rename atomicity discussion](https://github.com/jprichardson/node-fs-extra/issues/835)
- [Node EPERM on Windows fs.rename](https://github.com/nodejs/node/issues/29481)
- [Syncthing BEP v1 spec](https://docs.syncthing.net/specs/bep-v1.html)
- [Braid HTTP protocol draft](https://datatracker.ietf.org/doc/html/draft-toomim-braid)
- [Braid-Text & Braidfs](https://braid.org/braid-text/)
- [braidfs repo](https://github.com/braid-org/braidfs)
- [Tonsky — Local, first, forever (CRDT + filesync)](https://tonsky.me/blog/crdt-filesync/)
- [Ink & Switch — Local-first software](https://www.inkandswitch.com/local-first/)
- [Ink & Switch — Peritext (CRDT for rich text)](https://www.inkandswitch.com/peritext/)

Deploy targets:
- [Fly.io pricing 2025-2026](https://fly.io/pricing/)
- [Fly.io resource pricing docs](https://fly.io/docs/about/pricing/)
- [Railway pricing](https://railway.com/pricing)
- [Render free tier docs](https://render.com/docs/free)
- [Render pricing](https://render.com/pricing)
- [Coolify repo](https://github.com/coollabsio/coolify)
- [Coolify Docker Compose docs](https://coolify.io/docs/knowledge-base/docker/compose)
- [Tailscale Funnel docs](https://tailscale.com/kb/1223/funnel)
- [Tailscale Funnel examples](https://tailscale.com/kb/1247/funnel-examples)
- [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Cloudflare Tunnel + self-hosted apps + Access guide](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)

Claude Code tool semantics (for understanding peer-side writes):
- [Claude Code tools — Read/Write/Edit overview](https://callsphere.ai/blog/claude-code-tool-system-explained)
- [Claude Code Write vs Edit issue #27137](https://github.com/anthropics/claude-code/issues/27137)
- [Claude API — text editor tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/text-editor-tool)

---

## Appendix A — Why we are not (yet) building Phase 8 LAN-only with Yjs

A subtle bait we should avoid: "if we're going to land Yjs eventually, why not in v1.0?"

Because v1.0's scope is *presence + comments*, not co-editing. Adding Yjs for v1.0 would:
- Introduce the persistence question (where does the Y.Doc live?).
- Force the codec decision (`Y.Text` vs `Y.XmlFragment`) earlier than necessary.
- Risk shipping a v1.0 that quietly half-baked the v1.1 problem.

v1.0 stays Yjs-free. v1.1 introduces Yjs *and* the hub *and* the file sync agent as one architectural unit. Lower total risk than splitting them.

## Appendix B — Naming bikeshed (resolved)

| Concept | Name picked | Considered & rejected | Why |
|---|---|---|---|
| Long-running shared service | `hub` | `server`, `relay`, `room`, `coop` | "Server" overloads with dev server. "Hub" reads natively. |
| Per-peer process | `daemon` (in docs); `maude design serve` (in CLI) | `agent`, `client` | "Agent" overloads with AI agent. "Client" reads passive. |
| Connect peer to hub | `link` | `connect`, `pair`, `join` | `link` is persistent, the others are session-y. |
| One-shot join existing hub | `adopt` | `clone`, `attach`, `pull` | After `git clone`, you `adopt` the existing hub. |
| Token name | `HUB_TOKEN` | `MDCC_TOKEN`, `DESIGN_TOKEN` | Clear it's a hub credential. |
| Config in repo | `.design/config.json` `linkedHub` | new file | Existing file, single source of truth. |
| Peer-machine credentials | `~/.config/mdcc/hubs.json` | env vars | Multiple hubs supported; per-user; never committed. |
| Local Y.Doc replica | `.design/_state/<canvas>.ydoc.bin` | `.cache/`, `.design/_yjs/` | `_state/` matches the existing `_history/` prefix convention. |

## Appendix C — Open questions that need verification before implementation

1. **Claude Code's `Write` tool atomic-write semantics.** Verify empirically: instrument chokidar with `awaitWriteFinish: false` and observe whether Claude's writes produce single or multi-event sequences. Test on macOS, Linux, Windows. (Hypothesis: single direct write, not rename-pattern — but chokidar's `awaitWriteFinish` handles either case.)
2. **`partyserver` Node-standalone capability circa v2026.** Re-check `cloudflare/partykit` repo for any new `partyserver --standalone` mode that may have shipped. (Hypothesis based on current docs: no such mode exists; if it appears, reconsider §4.)
3. **Hocuspocus on Bun and Deno in production.** Current README claims support, but verify the SQLite extension specifically works on Bun (which has its own SQLite driver). Affects the deploy template flexibility.
4. **Fly.io `auto_stop_machines = "stop"` behavior with active WS clients.** Stress-test: do persistent WS connections keep the machine alive, or does Fly's auto-stop logic kill a connected machine? Documented intent suggests "keeps alive while traffic flows", but real-world wake-from-stop latency for WS reconnect needs measurement.
5. **`Y.applyUpdate` performance on 200KB Y.Text canvases at high concurrency.** Yjs is fast but `Y.Text` with whole-file replacement on every edit is the pathological pattern; benchmark before assuming v1.1 scales beyond ~5 concurrent peers per canvas.
6. **chokidar `atomic` option behavior with `git pull` bursts.** When `git pull` rewrites 12 files in 50ms, chokidar should emit 12 `change` events. Verify no events get coalesced into one.
7. **TipTap Collab pricing trajectory.** If TipTap moves Hocuspocus features behind a paywall mid-implementation, we need the y-websocket fallback ready. Track release notes.
