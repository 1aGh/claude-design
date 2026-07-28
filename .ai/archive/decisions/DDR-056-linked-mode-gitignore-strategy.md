## DDR-056 — Linked-mode gitignore strategy (single `full` mode)

- **Status:** Accepted — 2026-05-28
- **Authors:** 1aGh
- **Phase:** phase-9-self-hosted-hub-file-sync (Task 9)
- **Supersedes:** —
- **Superseded by:** —
- **Related:**
  - [DDR-052](./DDR-052-hocuspocus-over-partykit-for-hub.md) — the hub this linked mode talks to
  - [DDR-054](./DDR-054-linked-mode-trust-model-and-task-4-hardening.md) — linked-mode trust model + what `.design/config.json` commits (the `linkedHub.url` the block keeps in git)

## Context

When a repo links to a hub (Phase 9 Task 3/4), the `.design/` directory holds two very different kinds of file:

1. **Source of truth, git-tracked** — `*.html` canvases, `*.layout.json`, `*.annotations.svg`, `_comments/*.json`, `system/` tokens, and `config.json` (which now carries the `linkedHub` URL). These are the artifacts a teammate reviews in a PR and the thing `git clone && maude design serve` must reproduce.
2. **Per-machine runtime state, regenerable** — `_server.json` / `_server.log` (dev-server PID/port), `_active.json` (selected element), `_history/` (snapshot stack), `_canvas-state/` (undo/redo), `_chat/` (ACP transcripts), `_state/` (binary CRDT logs), and `_sync.json` (Task 8 offline status). None of these should be committed; in linked mode the CRDT log is regenerable from the hub, and the rest are local-only.

Without a managed `.gitignore`, the runtime files leak into commits — noisy diffs, merge conflicts on `_server.json` ports, and accidental sharing of per-machine paths.

The research (`.ai/docs/research-collab.md`) and the phase-9 plan considered three strategies — `full` (canvases in git), `hub-only` (canvases live-only, hub is source of truth), and `manual`. Only one ships in v1.1.

## Decision

**Ship a single gitignore strategy: `full`. No `commitStrategy` config flag.**

`full` keeps canvases + their JSON snapshots in git and ignores only regenerable per-machine runtime state. The ignored set, written between idempotent `# maude:begin` / `# maude:end` markers:

```gitignore
# maude:begin
# Maude design plugin runtime — gitignored even in linked mode (DDR-056).
.design/_state/
.design/_server.json
.design/_server.log
.design/_active.json
.design/_sync.json
.design/_history/
.design/_canvas-state/
.design/_chat/
# maude:end
```

**Why `full` over the alternatives:**

- **Cold backup.** Hub down → `git pull` still restores every canvas. `hub-only` would leave a dead repo when the hub is unreachable.
- **PR review value.** Designers + reviewers read `.html` diffs in the GitHub UI. Live-only canvases are invisible to code review.
- **Bootstrap-from-clone.** `git clone && maude design serve` yields a working project with zero hub access. A new contributor doesn't need a token just to look.
- **`hub-only` is a niche** (binary-heavy projects) and adds real UX surface (what happens on clone-without-hub?). Ship it when someone asks, not speculatively.

**Writers + idempotency.** `cli/lib/gitignore-block.mjs` owns the block. It replaces the content between the markers in place (re-running never duplicates) and preserves everything the user authored outside them. Two entry points write it:

1. `maude design init` — writes it unconditionally as part of scaffolding `.design/` (the design root the rules target).
2. `maude design link --adopt` — the solo→linked transition. If the block is absent it prompts `[Y/n]` (default yes); `--yes` / non-TTY auto-adds. A repo that already has the block is left untouched.

`maude design unlink` deliberately does **not** remove the block — the rules are harmless in solo mode (the ignored files simply aren't created), and stripping them would churn the user's `.gitignore` on every link/unlink cycle.

> **Plan-vs-CLI note:** the phase-9 plan and acceptance criteria say "`maude init` writes the block." In the current CLI surface `maude init` scaffolds the **flow** plugin's `.ai/` workspace (project-agnostic, no `.design/`), so the design-runtime gitignore block belongs to `maude design init` instead. Writing `.design/` rules from the generic `.ai/` scaffolder would pollute non-design repos. This DDR records the deliberate retarget.

## Consequences

- One code path, one block, no config matrix. Less to test, less to explain.
- `_sync.json` + `_canvas-state/` were added to the ignored set beyond the plan's original list — both are per-machine runtime artifacts that postdate the plan text (Task 8 + the undo-stack work).
- A custom `designRoot` (≠ `.design`) is supported by the writer (`designRel` param) but both current callers pass `.design` — the v1.1 default. A non-default design root would need the caller to thread its configured root through; out of scope until a project needs it.
- `hub-only` / `manual` strategies + a `collab.commitStrategy` switch + a `maude design sync-gitignore` regen command are explicitly deferred to the v1.2 backlog (recorded in the plan's "Deferred to v1.2 backlog" section).
