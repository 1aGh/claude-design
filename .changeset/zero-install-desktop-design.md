---
"@1agh/maude": minor
---

Zero-install design in the Maude Desktop chat. With only Claude Code installed, the desktop app's chat panel now auto-loads the `design` plugin for its session — `/design:*` commands just work, with no marketplace to add and no `/plugin install` (power users who already installed it see a no-op, no double-load). And the design critics can now actually SEE your artboards: the app bundles a screenshot engine (agent-browser) and provisions a headless Chromium (chrome-headless-shell) on first use, so `/design:critic` / `/design:screenshot` capture renders zero-install. The web `maude design serve` path is unchanged and keeps the manual marketplace flow.
