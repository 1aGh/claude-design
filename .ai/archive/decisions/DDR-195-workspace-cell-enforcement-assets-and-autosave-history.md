# DDR-195: A cell is the same server minus routes — plus content-addressed assets and an append-only autosave history

- **Date:** 2026-07-28
- **Status:** Accepted
- **Tags:** cloud, workspace, containment, assets, s3, r2, git, autosave, history, sync, security, onboarding, vocabulary
- **Related:** [DDR-192](./DDR-192-remote-workspace-server-architecture.md) §1/§6 (implements), [DDR-193](./DDR-193-maude-cloud-tenant-cells-and-containment-invariant.md) §2/§5 (enforces), [DDR-194](./DDR-194-hub-identity-and-durability-choices.md) §7 (same SigV4 reasoning), [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md), [DDR-063](./DDR-063-canvas-origin-split-default-on-tsx-sync-opt-in.md), [DDR-076](./DDR-076-empty-hub-doc-never-clobbers-local-canvas.md), [DDR-110](./DDR-110-three-lane-collaboration-model.md), [DDR-115](./DDR-115-per-user-camera-split-and-runtime-state-taxonomy.md), [DDR-119](./DDR-119-native-owns-the-workspace-web-is-a-repo-bound-companion.md), [DDR-148](./DDR-148-video-comp-remotion-authoring-capture-export.md) (corrected in place) · Plan: `.ai/plans/archive/cloud-phase-3-workspace-agent-s3.md`

## Context

Phase 3 built the three things that make "remote Maude" real: a server that can hold the authoritative checkout, a lane for heavy media that isn't git, and a way for a person to sign into a workspace. Four decisions inside it are not obvious from the code and would each be plausible to undo later.

## Decision

### 1. A cell is the SAME server with routes withheld — not a second implementation

The studio serves one route table, and most of it (sync, comments, annotations, assets, git) is exactly what a cell needs. So a cell runs that server with the forbidden surfaces **pruned**, rather than running a purpose-built cell server.

The alternative — a separate slimmer server — is the obvious design and is worse: it would drift from the thing it is meant to mirror, and DDR-192 §1's whole premise is that the cloud path and the self-host path are the same code with a different operator. A second implementation makes that sentence false the first time someone fixes a bug in one of them.

**The order is load-bearing: prune, then assert over what survived.** `assertContainment` runs against the pruned route table, which makes the boot-assert a *post-condition on the pruning* rather than a second, independently-maintained opinion about what is forbidden. Add a prefix to the vocabulary and it both prunes and is verified — the two cannot disagree.

The `fetch` fall-through owns paths that are not in the route table (`/_ws/acp`, `/_canvas-shell.html`, `/_canvas-runtime/*`), so pruning alone would leave them reachable; those are gated by the same predicate. **404, not 403** — a cell should look like it never had the feature, not like it is refusing one.

The canvas origin is not started at all in a cell. That second origin exists to render; there would be nothing left for it to serve.

### 2. Content addressing is the whole security model of the asset lane

Assets stay `assets/<sha8>[…]`. Every property the lane needs falls out of that one fact:

- **push is idempotent** — same bytes, same key, so a re-upload is a no-op;
- **no invalidation** — a key's content never changes, so a cached or proxied copy is never stale, and the proxy can answer `immutable`;
- **pull is verifiable** — bytes must hash back to the key they arrived under.

The third is the load-bearing one. The hub is semi-trusted (DDR-054): it can refuse to serve an asset, but it must not be able to **substitute** one. A pull whose bytes don't hash to their own name is refused rather than written to disk, where it would poison every peer that later mirrors from us.

**No presigned URLs in a canvas**, for two independent reasons: the canvas origin's CSP is `img-src 'self'` so media must arrive same-origin, and a presigned URL is a bearer credential — putting one inside tenant-authored content places a credential in the least-trusted thing in the system, still valid after the page closes. Media goes through the hub's authenticated proxy instead, which costs egress; R2's $0 egress is why that is affordable and is a place the DDR-193 §1 provider choice is load-bearing rather than incidental.

**The `assets/` prefix is NEVER garbage-collected and bucket lifecycle rules must be OFF for it.** A canvas in git history can reference an asset no current canvas does, so "unreferenced" never means "unreachable"; an expired object is a permanently broken canvas with no recovery path. `maude hub asset-check` exists to prove no reference dangles.

**A mirror failure never fails a local save.** The file is already on disk and in git; the bucket is the redundant copy, not the authority. Making the upload a precondition would turn a network blip into a failed save.

### 3. A cell commits, append-only, attributed to the human

On a laptop, autosave writing a file *is* the save — the developer's own git is the history and they commit when they mean to. In a cell nobody is at the keyboard, so an unwritten history means the only record of a design is its current bytes.

Three rules:

- **Append-only.** `git add` + `git commit`, ever. No amend, rebase, reset, checkout-over-dirty, and **never a force-push**. The history is allowed to be ugly; it is not allowed to lose a state that once existed.
- **Author = the editing human, committer = the bot.** git separates these precisely for this. `git blame` then answers "who designed this" rather than "the server did", which is the only reason to keep the history. An edit with no known author is **"Unknown editor", deliberately not the bot** — crediting a human's work to the server makes blame lie in a way nobody notices later.
- **Quiescence, not keystrokes.** A typing session is one commit.

**Ordering, again: the disk write happens FIRST.** A git failure re-queues rather than losing work. Making the commit a precondition of the save would turn a transient git error into data loss, which is precisely backwards.

Two supporting details: only the *noted* files are staged (`git add -A` in a cell would sweep in whatever else is in the tree), and presence-supplied identity is sanitized before reaching `--author` — it arrives over a semi-trusted hub and `Name <email>` is a format an embedded newline can forge trailers in.

`pushMirror` **refuses to resolve a rejection**. A non-fast-forward means someone else's commits are on the remote and the cell cannot know whether merging them is right; it stops and surfaces "someone else saved first". This is DDR-119's hazard arriving from the other direction, and it is the reason there is no force flag anywhere in this path — pinned by a test asserting the *absence* of one, since absence is what a future edit could add unnoticed.

### 4. The sign-in path is judged by its words, not only its mechanics

The persona is the invited teammate who has never used git (DDR-193 §5). A flow that says "paste your bearer token" has already told that person the product is not for them. So the vocabulary rule is tested, not merely intended: no `token`, `repository`, `oauth`, `bearer`, `crdt`, or `commit` reaches the person on this path.

Custody is unchanged from DDR-054 and the phase-29 A2 finding: the health probe is **tokenless** (a lookalike address must never receive a credential), the password goes to the typed address exactly once and is never stored, and the minted token never travels back to the UI layer — it has no use for it, and every surface that holds one is a surface that can leak one.

Failure modes are distinguishable and actionable rather than one generic error — including "answered, but isn't a Maude workspace", which catches the typo that would otherwise surface much later as a mysterious auth failure. **Bad credentials deliberately do not guess which half was wrong**: the hub refuses to be a user-existence oracle (DDR-194 §2), and a client that says "wrong password" for an account that may not exist reinvents the oracle the server just declined to be.

**The disclosure states what the operator CAN see** — designs, full edit history, when you are editing, comments — not only what they cannot. A disclosure listing only reassurances is marketing; the person can only decide with the uncomfortable half. It also names the operator (so "who can see this" has an answer), names the containment invariant in plain words, and promises the export — which is what makes the rest believable. The AI-less state is phrased as a fact, not an error: Phase 6's persona is an invitee with no Claude subscription, and that has to be a first-class product.

## Alternatives considered

- **A purpose-built cell server.** Rejected — see §1; it makes "the same code with a different operator" false.
- **403 for withheld routes.** Rejected in favour of 404: a refusal advertises a feature that exists elsewhere, which is an invitation to look for a way around it.
- **Presigned URLs for media.** Rejected — see §2. Cheaper on egress and wrong on both CSP and credential placement.
- **Squashing or rewriting autosave history.** Rejected: the value of the history is precisely that a state which existed is still reachable.
- **Attributing unknown edits to the workspace bot.** Rejected — it silently corrupts blame.
- **Keeping the AWS SDK for S3.** Rejected for DDR-194 §7's reasons; the studio's implementation is pinned byte-for-byte against the hub's by a test so the two independent copies cannot drift.

## Consequences

**Positive**
- The containment invariant is now something a process refuses to violate, not something a reviewer must remember.
- Heavy media stops entering git, and a second machine can actually resolve it.
- A cell's autosave produces a real, attributable, append-only history.
- The sign-in path is testable as *language*, which is the part that decides whether the target persona gets through it.

**Negative / accepted**
- Two SigV4 implementations exist (studio + hub). Justified by independent builds and defended by a conformance test, but it is duplication.
- The asset proxy puts media egress on the hub. Affordable on R2, a real cost anywhere else.
- Autosave history will be verbose. Accepted — the alternative loses states.
- `assets/` can only be gitignored once a bucket is configured, so a project without one still carries media in git. That is correct (the repo is then the only copy) but it means the git-bloat problem is only solved for bucket-backed projects.

## Implementation notes

`apps/studio/workspace-mode.ts`, `assets-s3.ts`, `sync/autocommit.ts`, `sync/workspace-signin.ts`, `sync/index.ts` (wiring), `apps/hub/src/assets.mjs`, `cli/commands/hub.mjs` (`asset-check`), `scripts/check-containment.sh` in `quality.yml`.

**Both live checks found things tests did not**, which is the note worth carrying forward:

- Booting with `MAUDE_WORKSPACE_MODE=1` against the real route table refused to start and named 13 offending routes — the vocabulary was right, but only a real table proved it.
- `maude hub asset-check` against this repo's own design root reported a dangling reference that wasn't. The real corpus contains `<sha8>-<label>.<ext>` and `<sha8>.<part>.json`; `sha8FromAssetPath` classified both as "not content addressed", so `verifyAssetBytes` would have refused **legitimate** assets. Every fixture had the tidy shape, so no test could have caught it.

DDR-148's "`.design/assets/` … ride git + hub sync" was corrected in place: the "+ hub sync" half described an intent that line never made true.
