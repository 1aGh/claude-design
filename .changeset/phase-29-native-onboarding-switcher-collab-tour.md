---
"@1agh/maude": minor
---

Native onboarding, project/draft switcher & the "how sharing works" tour (Phase 29, epic E4) — a non-technical collaborator installs Maude, signs in, and lands in a working project with zero terminal.

- **First-run onboarding wizard** with three doors — **Sign in with GitHub** (open or create a shared project), **Open a local folder** (with a one-click "Set up Maude here" for a non-Maude folder), and an advanced **Connect to a team hub** door.
- **Project & draft switcher** — a compact bottom dock to switch projects (recent list + open another) and switch between the **Shared version** and your **drafts**, all in plain words (no `branch`/`checkout`/`main` jargon). Includes **"Add this draft to the Shared version"** — the one-button fold-back that merges, publishes, and tidies the draft; a moved-remote reuses the plain "Get latest first" prompt, never a merge dialog.
- **"How sharing works" tour** — a re-openable walkthrough (offered after onboarding, in Help) that teaches the **Save changes locally → Publish for everyone → Pull changes** cycle, with a two-layer infographic showing that being together live is automatic.
- **Native app vs. web studio split** — the standalone app owns the workspace (onboarding, sign-in, the full switcher, plain-words cycle); the terminal-launched web studio shows a read-only branch badge (git vocab) and Changes/Diff/History for awareness, deferring actions to your terminal.
