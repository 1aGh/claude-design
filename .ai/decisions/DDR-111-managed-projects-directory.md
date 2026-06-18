# DDR-111: Managed projects directory — `~/Documents/Maude Projects/`

- **Date:** 2026-06-17
- **Status:** Accepted (phase-27, epic E2). The **layout** is decided + the runtime-state gitignore is enforced now; the **clone-into-managed-dir** flow (background clone with progress, repo picker) lands with GitHub remote support in **E3 / phase-28** — recorded here so E3 builds on a stable layout.
- **Tags:** native-app, git, projects-dir, gitignore, phase-27, phase-28, E2, E3
- **Related:** [DDR-107](./DDR-107-git-engine-isomorphic-git.md) (the git engine that clones here), [DDR-108](./DDR-108-github-auth-oauth-device-flow.md) (the token a clone authenticates with), [DDR-109](./DDR-109-native-shell-security-model.md) (secrets live in the keychain, never in a project dir), [DDR-106](./DDR-106-tauri-v2-native-shell-architecture.md) (File ▸ Open Project switches the active root in-process), [DDR-056](./DDR-056-self-hostable-hub-gitignore-strategy.md) + `cli/lib/gitignore-block.mjs` (the `# maude:begin/end` ignore-block writer reused here), [DDR-112](./DDR-112-simplified-staging-model.md) (what a Save in one of these repos stages). Epic: [`epic-native-collab-app.md`](../docs/epic-native-collab-app.md) § E2.

## Context

A non-technical collaborator who clones a shared design repo from inside Maude should **not** be asked to choose a filesystem path — "where do you want to save this?" is exactly the developer-shaped friction the native app exists to remove. The app needs ONE predictable home for cloned projects, a collision rule when two repos share a name, and a guarantee that Maude's own runtime/state files never get committed into a freshly cloned repo.

The dev-server resolves the **git working directory** (`repoDir`, the dir that holds `.git`) independently of the **designRoot** (`<repoDir>/.design` or, for a design-only repo, `repoDir` itself). The git service (`apps/studio/git/service.ts`) scopes status/diff to the designRoot prefix so unrelated repo churn never reaches the Changes panel.

## Decision

**Cloned projects land in a single managed directory — `~/Documents/Maude Projects/<repo-name>/` on macOS** (and the platform-appropriate Documents equivalent elsewhere: `~/Documents/Maude Projects/` on Windows, `${XDG_DOCUMENTS_DIR:-~/Documents}/Maude Projects/` on Linux). The directory is created on first clone.

- **Naming collisions** — if `<repo-name>/` already exists and is a *different* repo (different `origin` URL), append ` (2)`, ` (3)`, … (`Acme Brand`, `Acme Brand (2)`). If it's the **same** origin, offer "Open the existing copy" instead of re-cloning. Never silently overwrite or merge into an existing directory.
- **gitignore strategy** — on clone/adopt, write the managed `# maude:begin … # maude:end` block (the idempotent `cli/lib/gitignore-block.mjs` writer, DDR-056) into the project's `.gitignore` so Maude's runtime/state (`_server.json`, `_active.json`, `_sync.json`, `_preflight.json`, `_history/`, `_trash/`, …) is ignored. This is the *primary* guard that those files never get versioned; the git service's `isMaudeRuntimeState` filter (phase-27) is the **backstop** for a repo that predates or lacks the block.
- **Secrets stay out of the dir** — the GitHub token lives in the OS keychain (DDR-108/109), never written under a project dir or into `_server.json`.
- **Active project** — File ▸ Open Project (DDR-106) points the sidecar's `repoDir` at one of these clones (in-process switch); the directory is just the clone target + a discoverable "my projects" home.

### Why a managed directory (not a user-chosen path)

- **Zero path-picking** for the persona — "your projects live in *Maude Projects*" is one sentence; a file picker on first clone is a developer concept.
- **Discoverable** — Documents is where non-technical users already look for "my files"; the projects are real folders they can find, back up, or open in Finder, not hidden app state.
- **Predictable collision + ignore behavior** — one rule, enforced in code, instead of per-clone prompts.

## Consequences

- **Positive:** clone is one click with no path question; runtime state is gitignored by construction; the layout is stable for E3's clone-with-progress + repo picker to build on.
- **Negative / accepted:** a fixed home is less flexible than an arbitrary path (a power user wanting a clone elsewhere uses system git + File ▸ Open Project on the result — the prefer-system-git escape hatch, DDR-107). Documents-dir resolution is platform-specific (handled at clone time, not in the dev-server).
- **Phase-27 scope:** the git layer operates on the **already-open** project (the current `repoDir`); no clone UI yet. DDR-111 records the destination + ignore + collision rules so phase-28's clone flow is a mechanical add, not a fresh design.

## Alternatives considered

- **Ask the user for a path each clone** — rejected: the exact developer-shaped friction the app removes.
- **Hidden app-data dir** (`~/Library/Application Support/Maude/projects/`) — rejected: users can't find or back up their own work; "where did my design go?" is worse than a visible Documents folder.
- **Clone next to the app / into a temp dir** — rejected: non-obvious, easy to lose, and temp dirs get reaped.
