# DDR-112: Staging model — simplified "select files to save", no git index

- **Date:** 2026-06-17
- **Status:** Accepted + **implemented** (phase-27, epic E2). `apps/studio/git/endpoints.ts` + `git/service.ts`.
- **Tags:** native-app, git, staging, commit, vocabulary, phase-27, E2
- **Related:** [DDR-107](./DDR-107-git-engine-isomorphic-git.md) (the engine under these stages), [DDR-110](./DDR-110-three-lane-collaboration-model.md) (single-register vocabulary — Save version / Publish / Get latest), [DDR-111](./DDR-111-managed-projects-directory.md) (which repos this Save runs in), [DDR-075](./DDR-075-canvas-activity-overlay-fs-watch-driven.md) (the M/A/D badge style the Changes panel mirrors). Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md) § E2.

## Context

"Save version" = `git commit`. Real git separates the **working tree**, the **index/staging area**, and the **commit** — `git add` moves changes into the index, `git commit` snapshots the index. That two-step staging model is a power-user concept and is exactly the kind of git jargon the native-app vocabulary contract forbids (DDR-110: Save version / Publish / Get latest / History — never commit/push/pull/add/stage).

So: when a non-technical user picks which changes to save, what does the **staging area** mean to them, and how much of git's index do we expose?

## Decision

**Expose a simplified, file-level "select which changes to save" — a checkbox per changed file. No `git add`, no index, no partial-hunk staging is ever surfaced.** The index is an internal implementation detail of how the commit is built, never a user-visible concept.

### Mechanics (as implemented)

- **Changes panel** lists each changed file grouped Modified / Added / Deleted / Untracked (M/A/D/U badges, DDR-075 hues). Each row has a checkbox.
- **Save version** takes the checked files + a message → `POST /_api/git/commit { message, files[] }`. The service stages exactly those paths (`git.add`, or `git.remove` for a deleted file) and lands **one** commit. The index is built fresh per commit from the selection and never left in a half-staged state the user could see.
- **Save all** = the same call with no `files[]` → every changed file in the design scope is committed.
- **Sidecar auto-staging** — selecting a canvas (`ui/Pricing v3.tsx`) auto-includes its **dirty same-stem sidecars** (`ui/Pricing v3.meta.json` layout/viewport state, `ui/Pricing v3.annotations.svg`, …). The `.`-delimited stem match (`expandSidecars`) prevents `ui/Pricing` from grabbing `ui/Pricing v3.*`. Rationale: a canvas and its metadata are one logical unit to the user; splitting them across two "versions" is a footgun and produces meaningless half-saved states.
- **Runtime state is never stageable** — `_server.json` / `_active.json` / `_sync.json` / `_history/` / `_trash/` are filtered out of status + "Save all" by `isMaudeRuntimeState` (and gitignored per DDR-111), so they can't be selected or swept in.
- **Input boundary** — every user-supplied path is validated with `isContainedRepoPath` (no traversal, no absolute, no NUL) before it reaches `git.add`, mirroring the `canvas-create.ts` security pattern.

### Why simplified over the full index

- **Vocabulary contract (DDR-110)** — "stage" / "index" / "add" have no place in a single-register, non-technical UI. "Pick which changes to save" is the whole mental model.
- **No half-staged ambiguity** — the index being a persistent, separately-mutable state between working tree and commit is a frequent source of "why didn't my change save?" confusion even for developers. Building the index per-commit from an explicit selection removes that state entirely from the user's world.
- **File-level is enough** — design changes are whole-canvas; partial-hunk staging (`git add -p`) has no meaningful unit for a `.tsx` mock and zero demand from the persona.

## Consequences

- **Positive:** the commit flow is "check boxes → type a message → Save", with metadata riding along automatically; no index state to explain, leak, or get wedged; the security boundary is one validated `files[]` list.
- **Negative / accepted:** a user who *wants* fine-grained partial-hunk staging can't get it in-UI (they drop to system git via the prefer-system path, DDR-107). Auto-staging sidecars means a user can't save a canvas's code without its metadata — accepted, because the split has no sane non-technical meaning.
- **Engine note (phase-27):** the service's system-git path is **opt-in via `MAUDE_USE_SYSTEM_GIT=1`**, not the auto-detect-and-prefer of DDR-107's eventual end-state — chosen for deterministic, fully-tested behavior in this first cut. Auto-detect-and-prefer is deferred (see DDR-107 addendum).

## Alternatives considered

- **Full git index exposed** (stage / unstage / staged-vs-unstaged columns, like a developer git client) — rejected: violates the vocabulary contract; the index is the #1 git-confusion source we're explicitly removing.
- **All-or-nothing commit** (no selection, Save always saves everything) — rejected: users legitimately want to save some changes and keep iterating on others; the per-file checkbox is cheap and matches the Changes-panel mental model.
- **Per-hunk staging** — rejected: no meaningful hunk unit for a rendered design mock; zero persona demand.
