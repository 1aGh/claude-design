---
'@1agh/maude': minor
---

**Workspace mode, an asset lane that isn't git, and sign-in.**

- **Heavy media no longer has to ride git.** Point Maude at an S3-compatible bucket (R2 / MinIO / S3) and new images, video and audio are mirrored there instead of bloating every clone — a 60 MB clip stops being 60 MB in every checkout, forever. Assets stay content-addressed, so uploads are idempotent, cached copies are never stale, and bytes fetched back are verified against the name they arrived under: a hub can refuse to serve an asset, but it cannot substitute one.
- **`maude hub asset-check`** — every asset a canvas points at must resolve, locally or in the bucket. Reports anything dangling (a permanently broken canvas) and anything present locally but not yet mirrored. Exits non-zero, so it works as a CI step.
- **The hub can serve assets** at an authenticated `GET /assets/<sha8>`, so a second machine resolves media it doesn't have on disk. Deliberately not presigned URLs — a presigned URL is a credential, and it has no business inside a canvas.
- **Autosave becomes real history in a hosted workspace.** Edits are committed append-only, attributed to the person who made them (the workspace bot is only the committer), batched at quiescence so a typing session is one commit. Nothing is ever amended, rebased or force-pushed; if a mirror push is rejected because someone else saved first, it stops and says so rather than overwriting their work.
- **"Sign in to workspace"** — an address, an email and a password, instead of pasting a token. The password reaches only the address you typed and is never stored; what's kept is an expiring session. Failures say something useful ("couldn't reach that workspace", "that address answered, but it isn't a Maude workspace") instead of one generic error.
- **A disclosure panel** replaces the terminal banner for people who never open a terminal: who operates this workspace, what they can see (your designs, your edit history, when you're editing), what they can't (anything else on your computer — and your designs are never run on their servers), and that you can leave with everything in one click.

Under the hood: a hosted workspace now refuses to start if it exposes any surface that would render or execute a canvas. That's enforced by the process itself plus a CI gate, not by convention — designs render on your machine, never on a server.
