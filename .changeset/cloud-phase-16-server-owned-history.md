---
"@1agh/maude": minor
---

**Your hosted workspace now keeps its own history.** Until now, autosave-to-git ran only on a desktop — so a project you opened from a phone, from a browser, or simply with no computer attached kept no history at all: its only record was its current bytes. The workspace itself now commits, using the same append-only engine the desktop uses, so a commit made for you is indistinguishable from one you made. Your name is on the commit; the workspace is only the committer. History is never rewritten.

Alongside it: media in your workspace is mirrored to your object storage without needing a desktop online, `MAUDE_SEED_REPO` actually clones your existing project on first boot (it had been rendered into every deployment and read by nothing), and a workspace that is shut down or moved mid-session flushes its pending commit first instead of losing the last few seconds of your work.

`maude hub workspace-up` now proves six of its eight checks for real rather than two — including "autosave produced a commit" and "media reaches the bucket" — and a fresh workspace with nothing in it yet is reported as *not yet proven*, not as a failure.
