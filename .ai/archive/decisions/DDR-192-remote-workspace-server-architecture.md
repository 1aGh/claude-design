# DDR-192: Remote workspace server architecture — the server owns the checkout, and the desktop stays the only editing surface

- **Date:** 2026-07-28
- **Status:** Accepted
- **Tags:** cloud, architecture, sync, workspace-agent, hub, collaboration, trust-model, acp, s3, umbrella
- **Related:** [DDR-110](./DDR-110-three-lane-collaboration-model.md) (amended), [DDR-119](./DDR-119-native-owns-the-workspace-web-is-a-repo-bound-companion.md) (amended — its hazard dissolves), [DDR-053](./DDR-053-hub-admin-auth-architecture.md) (amended), [DDR-123](./DDR-123-acp-chat-runs-on-users-claude-cli-subscription.md) + [DDR-125](./DDR-125-acp-multichat-parallel-and-security-posture.md) (reaffirmed + hard boundary), [DDR-079](./DDR-079-tsx-sync-default-on.md) (banner → UI disclosure), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md), [DDR-122](./DDR-122-collab-session-window-anchored-across-hot-swap.md), [DDR-076](./DDR-076-empty-hub-doc-never-clobbers-local-canvas.md), [DDR-063](./DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md) · Plan: `.ai/plans/cloud-phase-1-safety-gates.md` (Task 1), `.ai/plans/cloud-phase-0-economics-and-architecture.md` · Sibling: DDR-193 (tenant cells + containment invariant)

## Context

Everything Maude has shipped so far assumes the **workspace is a folder on the user's own machine**. The hub (DDR-047, DDR-053) relays Y.Docs between peers but has, in its own source comment, "no repo/branch concept"; the sync agent (`apps/studio/sync/agent.ts`) turns autosave into file writes against a checkout the *user* owns; the desktop app is the shell around that folder.

The Maude Cloud arc (`cloud-phase-0-economics-and-architecture.md`) inverts this: a vendor-operated **cell** holds the authoritative checkout, and the desktop becomes a client of it. That inversion touches — and partially contradicts — five standing decisions. This DDR records the amendments **on paper before any of the arc's code lands**, because the breaker seat's precondition for the whole arc was exactly that: *"superseding DDRs written before code."*

This is the **workspace-server** half of the arc's architecture. The **tenancy/commercial** half — cells, the containment invariant, the tenant state machine, operator trust — is DDR-193.

## Decision

### 1. The server may own the checkout; it becomes the workspace authority (amends DDR-110)

DDR-110's three-lane collaboration model (Y.Doc lane / file lane / awareness lane) stands **unchanged as vocabulary**. What changes is *where the file lane's authoritative copy lives*: in workspace mode it is a **server-side git checkout owned by a headless workspace agent**, not a per-developer working tree.

- The workspace agent inherits `sync/agent.ts`'s spine **verbatim** — the same debounces, the same fail-closed snapshot rule, the same DDR-076 "empty remote is not authoritative blank" cold-start table. It is a relocation, not a rewrite.
- Autosave becomes **append-only commits**. Never a force-push, never a history rewrite, never a destructive checkout against a dirty tree.
- **Binary assets move to an S3-compatible lane (R2)**, additive to DDR-110 — heavy media stops entering git at all. The Y.Doc lane and the awareness lane are untouched by this.

### 2. Server-owned checkout dissolves DDR-119's hazard — the affirmative argument (amends DDR-119)

DDR-119 ("native owns the workspace, web is a repo-bound companion") was grounded in a concrete hazard: **a remote actor rewriting a developer's working tree under their hands** while their editor and their tools held it open. That hazard is a property of *whose disk it is*, not of remoteness.

A server-owned checkout has **no developer sitting on it**. Nothing else has the file open; there is no `$EDITOR` racing the writer; there is no uncommitted local work to clobber. The hazard does not survive the move — so DDR-119's *conclusion* (native owns the workspace) is reaffirmed for the local case and does **not** extend to forbidding a server-side checkout.

Hard limit carried forward: **no `$EDITOR` endpoint, ever.** The cell exposes sync, git, and asset storage. It never exposes "run this editor / this command against the checkout." (DDR-193 makes the executable-content half of this a testable invariant.)

### 3. User identity mints peer tokens; the admin Bearer is unchanged (amends DDR-053)

DDR-053's bootstrap-token + admin-Bearer split stays exactly as-is. What is **added** is a layer above it: once the hub has a real user model (Phase 2), an authenticated **user session mints peer tokens** — scoped, expiring, revocable — instead of a human copying a long-lived string out of a terminal.

- The admin Bearer remains the operator credential. It is not a user credential and never becomes one.
- Peer tokens gain `expires_at` + revocation. The existing HMAC token spine is extended, not replaced.
- DDR-053's prefix-scoping finally means something: with §5's namespace, a prefix scope *is* a workspace scope.

### 4. DDR-123/125 reaffirmed, with a hard boundary: no chat surface in any browser UI

DDR-123 (ACP chat drives the user's **own** `claude` CLI subscription) and DDR-125 (parallel repo-level multi-chat) are reaffirmed without modification. The arc adds one boundary that was previously implicit and is now **load-bearing**:

> **Editing and AI are desktop-only. No chat surface, and no editing surface, is ever exposed in a browser UI — vendor-hosted or otherwise.**

Two independent reasons, either sufficient:

- **Licensing/ToS.** DDR-123's whole point is that AI runs on each member's own subscription, on their own machine. A vendor-hosted browser chat would either need vendor-side API billing (a different product) or would route a user's personal subscription through vendor compute (the ToS trap DDR-123 exists to avoid).
- **Containment.** A browser editing surface implies the vendor renders/evaluates tenant-authored TSX. DDR-193's containment invariant forbids exactly that.

The consequence is deliberate and must be designed *for*, not apologized for: an invited teammate without a Claude subscription gets a **first-class AI-less state**, not a broken one (Phase 6).

### 5. The hub gets a repo/branch document namespace

`docName` stops being a flat slug. It becomes `ws/<workspace-id>/<branch>/<slug>`.

Rationale: a flat slug means two projects — or two branches of one project — that happen to contain `ui-screen.tsx` land in the **same Y.Doc**. On a single-tenant local hub that was merely surprising. On a multi-project hub it is **silent cross-project data loss**, and it is the second half of the breaker's precondition ("flat slugs + autosave = silent data loss").

- Rollout is flagged (`MAUDE_HUB_NAMESPACED`), default-on in workspace mode, off for legacy hubs, with a flat-slug shim.
- **The DDR-076 rule is the load-bearing constraint here**: namespacing *changes doc identity*, so every freshly namespaced doc looks empty on first connect. An empty namespaced doc is "not seeded yet" and must **never** clobber local files.

### 6. DDR-079's terminal banner becomes a UI disclosure

DDR-079 made TSX sync default-on and disclosed it via a **terminal banner**. In a cloud workspace the person whose files are syncing may never see a terminal — invitees run Maude Desktop and nothing else. The disclosure moves into the UI where the affected human actually is, and gains the DDR-054 trust-model content (what the hub sees, what it can do, who operates it). The banner stays for terminal users; it is no longer the *only* disclosure.

## Alternatives considered

- **Keep the checkout on a developer machine and proxy remote peers to it.** Rejected: it makes availability a function of one laptop's lid, and it reinstates precisely the DDR-119 hazard (a remote actor writing a tree a human has open) that a server-owned checkout removes.
- **Browser editing (drop the desktop-only boundary).** Rejected for v1 on both grounds in §4. Recorded as deferred, gated behind a structured non-executable synced unit (DDR-193's "Direction B") — not behind a product decision.
- **Namespace by project only, not project+branch.** Rejected: branch-scoped multiplayer is already shipped behavior (phase-30 — same branch = collaborate). Dropping `<branch>` from the key would merge two branches' docs, which is the same data-loss class the namespace exists to close.
- **A new token system instead of extending the HMAC spine.** Rejected: the spine already carries scope semantics and is covered by `apps/hub/test/tokens.test.mjs`; expiry + revocation are additive fields, not a new design.

## Consequences

**Positive**
- The self-host path and the cloud path run the **same code**. A cloud cell is the self-host stack with a different operator — which is what keeps the Phase-4 self-host story first-class rather than a courtesy.
- Autosave becomes real version history (append-only commits) instead of a debounced overwrite.
- Peer tokens stop being forever-secrets.
- Cross-project doc collisions become structurally impossible rather than statistically unlikely.

**Negative / accepted**
- The desktop-only boundary **costs reach**. "Just send me a link" is the thing every competitor does and Maude will not. Phase 6 has to make the invite path (magic link → deep link → open project) fast enough that the download is not the funnel's grave.
- The namespace is a **migration**, and migrations of doc identity are the highest-risk kind. The DDR-076 fresh-doc rule plus a legacy shim are the mitigation; the flag is the escape hatch.
- A server-owned checkout concentrates a new class of failure: if the cell's disk is wrong, it is wrong for everyone. Phase 2's tested restore and Phase 5's persistence spike are direct consequences of this line.

## Implementation notes

Landed in this DDR's own phase (Cloud Phase 1), as the arc's entry gate:

- **`apps/studio/collab/origins.ts`** (new) + `collab/room.ts` + `collab/protocol.ts` + `use-collab.tsx` + `ws.ts` + `server.ts` — the **DDR-122 follow-up origin gate**, dual-lock. Untrusted canvas-realm script can no longer write the canvas SOURCE lanes (`html`/`css`/`meta`/`syncMeta`) into a doc the sync agent materializes to every peer's disk. Lock 1 is client-side (trusted origin sentinels, WeakSet-backed so a forged marker object fails); lock 2 is server-side (canvas-origin sockets are validated against a mirror doc before touching the room doc, and refused wholesale on a body-lane write). Covered by `apps/studio/test/collab-origin-gate.test.ts`.
- The namespace (§5) and its shim ship in the same phase; identity/durability (§3), the workspace agent + S3 lane (§1), and the UI disclosure (§6) ship in Phases 2–3.

**The mirror-doc detail is load-bearing and must not be "simplified" away:** `Y.decodeUpdate` reveals a struct's parent type *only* when the struct has neither a left nor a right origin — yjs writes the parent key only in that case. An insert into existing text therefore does not name the lane it targets anywhere in the update bytes; the lane is resolvable only against a doc that already holds the referenced items. Any future rewrite of the gate that tries to classify an update from its bytes alone will pass its unit tests on fresh docs and silently fail on the exact case the attacker uses.
