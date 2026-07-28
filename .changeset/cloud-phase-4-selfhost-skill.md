---
'@1agh/maude': minor
---

**`maude hub workspace-up` — self-host a workspace in one command, and know it works.**

A *workspace* is a hub that owns the project: it holds the authoritative copy, turns autosave into real version history attributed to whoever made each edit, and keeps images and video in object storage instead of git. Teammates sign in with an email and password — no token to paste, no git.

```sh
maude hub workspace-up --dry-run --domain design.acme.com --admin-email alice@acme.com \
  --s3-endpoint https://<account>.r2.cloudflarestorage.com --s3-bucket acme-assets ...
```

`--dry-run` shows exactly what it would write and check; every configuration problem is reported at once, so you fix them in one pass. Without it, the command renders `docker-compose.yml`, `Caddyfile` and `.env` (mode 0600), brings the stack up, and then **verifies it**: the workspace answers, the operator credential works, the first person can sign in, a canvas survives a round trip, autosave produced a commit, media reaches the bucket, no lifecycle rule will expire it, and a backup can actually be restored. A check it can't automate is reported as skipped — never as passed.

Re-running is the upgrade path and reuses the secrets already in `.env`, so peers who already have tokens keep working.

It does not pretend to own your deployment afterwards. Every successful run prints what stays yours — rotating the operator secret, scheduling restore drills, pinning the image tag off `latest`, upgrades, the bill, and never putting an expiry rule on the `assets/` prefix.

Also available conversationally as **`/design:hub-workspace`**, and documented at [Workspace mode](https://maude.sh/docs/hub/workspace).
