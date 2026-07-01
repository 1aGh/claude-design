---
"@1agh/maude": minor
---

You can now start a project two new ways in the desktop app. **`File ▸ New Project…`** (`Cmd+N`) is in the native menu bar — the create flow was previously reachable only from onboarding and the account menu. And the New Project dialog gained a **"This computer only"** option: a plain local git repo (`git init` + `.design/` scaffold, no GitHub, no remote) that you can publish later — so you can design without a GitHub account. Signed out? The menu still opens the dialog; the GitHub option waits for sign-in, local is always available. Backed by a new local-only `POST /_api/project/create-local` endpoint that stays main-origin-only (dual-allowlist, asserted in the canvas-origin gate test). (DDR-137.)
