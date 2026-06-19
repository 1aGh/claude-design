# DDR-119 — Native app owns the workspace; the web studio is a repo-bound companion

**Status:** accepted
**Date:** 2026-06-19
**Phase:** phase-29 (Native Maude E4 — onboarding wizard + repo/branch switcher + collab tour), follow-up FU-1
**Related:** DDR-106 (Tauri shell architecture), DDR-110 (three-lane collaboration + non-technical mental model), DDR-114 (GitHub OAuth-App boundary — `isNativeApp()` gating of the IdentityBar), DDR-118 (teach the action-cycle, plain-words vocabulary). Implemented across `client/panels/{RepoBranchSwitcher,GitPanel,IdentityBar,OnboardingWizard}.jsx` + `app.jsx`.

## Context

Phase-29 shipped the onboarding wizard, GitHub identity, and the `RepoBranchSwitcher` so a **non-technical** user can install `Maude.app`, sign in, and land in a project with zero terminal. But Maude is two surfaces from one codebase:

- **Native app (`Maude.app`)** — the standalone Tauri shell. The **app** owns the workspace: it onboards, signs you in, clones, and switches repos.
- **Web studio (`maude design serve`)** — launched from a terminal **inside a repo** (cwd-bound), as a companion to the developer's editor.

When the phase-29 surfaces first landed they rendered in **both** surfaces, gated only on `status.repo` (is this a git repo?), not on `isNativeApp()` (which surface am I?). That's wrong: the two surfaces have different owners, personas, mental models, and vocabularies, so the same toolset doesn't fit both. A plain-words "Add this draft to the Shared version" button in a developer's repo-bound preview would rewrite their working tree under their hands and collide with their IDE; the plain-words translation is friction for someone who already knows git.

## Decision

**Native = a self-contained workspace (Figma-like, plain words). Web = a repo-bound mirror of the current repo that defers ACTIONS to the terminal (Storybook-like, git vocab, read-only awareness).**

The deciding axis is **who owns the workspace**:

| | **Native app (`Maude.app`)** | **Web studio (`maude design serve`)** |
| --- | --- | --- |
| Workspace owner | the **app** (onboarding · sign-in · clone · switch repo) | the **IDE/terminal** — launched inside a repo (cwd-bound) |
| Persona | non-technical (designer, PM, stakeholder) | developer, already in their editor |
| Mental model | **Figma** — a standalone design environment | **Storybook / local preview** — a companion to the editor |
| Vocabulary | plain words ("draft", "Shared version", "Publish for everyone") | **real git** ("branch", "main", "push") — the dev knows it |

### Per-tool split (gate = `isNativeApp()`)

| Tool | Native | Web | Why |
| --- | --- | --- | --- |
| Onboarding wizard | ✅ | ✗ | web dev is already authed + already in a repo |
| GitHub sign-in / IdentityBar | ✅ | ✗ | web takes identity from git/SSH |
| Repo/project switcher | ✅ | ✗ | web is cwd-bound — switching repos = relaunching the CLI elsewhere |
| Branch/draft switcher | ✅ full (drafts · fold · plain-words) | ⚠️ **read-only badge**, git vocab | actions would rewrite the dev's tree under their hands |
| Save / Publish / Pull cycle | ✅ plain-words | ✗ | the dev commits/pushes in their terminal |
| Changes / Diff / History | ✅ | ✅ | awareness is useful in both |
| Inspector / CSS knobs / ⌘-click | ✅ | ✅✅ **killer feature** | the dev loop: inspect → copy CSS → edit in IDE |
| Presence / comments / annotations | ✅ | ✅ | collab works on both |
| Collab tour (the teaching) | ✅ | ✗ | a dev doesn't need "what is Publish" |
| Export / handoff | ✅ | ✅ | both |

### The branch nuance (resolved: read-only, not a switch)

In the web studio, branches get **awareness, not actions** — and that binding is already free: `collab/git-lifecycle.ts` watches `.git/HEAD`, and the `git-status` broadcast carries `branch`, so when the dev runs `git checkout` in their terminal the UI updates itself. So the web studio shows a **read-only `📁 repo · branch: main` badge** (git vocab), auto-updated from the terminal; **no** New-draft / fold / Publish / checkout from the UI (those would collide with the IDE). Native owns full draft management in plain words.

> We considered escalating the web badge to a "quick git-vocab switch" (a UI checkout with an explicit "this runs `git checkout` in your repo" warning) and **rejected it** for v1: a UI-driven checkout against a tree the developer is actively editing risks clobbering uncommitted work and racing the editor. Pure read-only is the safe, honest default. (Revisit if users ask.)

## Scope / what this governs

- `RepoBranchSwitcher` renders the full bottom-dock switcher only when `isNativeApp()`; on web it returns a compact read-only branch badge (git vocab, live from the `git-status` broadcast, no actions).
- `GitPanel` keeps Changes / Diff / History on web but drops every working-tree action (Save / Publish / Get latest / discard / file checkboxes) behind a `readOnly` prop (`!isNativeApp()`), with a footer hint pointing the dev to their terminal.
- The collab tour is native-only — both the post-onboarding nudge (already gated) and the Help ▸ "How sharing works" entry.
- Onboarding wizard + IdentityBar were already `isNativeApp()`-gated (DDR-114) — this DDR records the principle they followed and extends it to the switcher / GitPanel / tour.

## Consequences / follow-ups

- **"Open in editor" / "Reveal in Finder" (web-only) is deferred**, not dropped. The per-tool table assigns it to web (a companion-to-the-IDE affordance native has no use for), but it needs a new server endpoint that spawns `$EDITOR` / `open -R` / `xdg-open` with path validation (security surface), so it's tracked as its own small follow-up rather than bundled here.
- **`maude studio` rename of `maude design serve`** is an open product question, intentionally out of scope here.
- The split is now codified, so the next surface added to phase-29's family doesn't re-litigate "should this show on web too?" — answer from the axis (who owns the workspace) and the per-tool table.
