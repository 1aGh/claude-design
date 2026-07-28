---
'@1agh/maude': minor
---

**Hub identity + durability.** The self-hosted hub gains a real user model — the same code the future cloud login runs on.

- **Sign in instead of pasting a forever-token.** `POST /auth/login` mints a scoped, **expiring** peer token (30 days by default, `HUB_USER_TOKEN_TTL_HOURS`); `/auth/logout` and `/auth/session` manage it. Passwords are scrypt at OWASP parameters, and every login failure returns one opaque message with matched timing, so neither the body nor the clock says whether an account exists.
- **Offboarding that actually offboards.** Deleting, disabling, or changing the password of a user revokes their live credentials and kicks their open sessions — it does not merely block the next login. Revocation is scoped to that user exactly: machine tokens, the admin Bearer, and lookalike addresses are untouched.
- **The permissive dev-auth path is closed** the moment a hub has any user (or under `HUB_WORKSPACE_MODE=1`). Previously an empty token store with no `HUB_SECRET` meant *any* token authenticated.
- **Rate limiting works behind a reverse proxy.** New `HUB_TRUSTED_PROXIES` (CIDRs) — X-Forwarded-For is honoured only from configured proxies, rightmost-untrusted-hop first, so one attacker's login flood no longer rate-limits every other user (and a spoofed header still cannot buy budget). Set by default in the Docker Compose and Fly deploy templates. The limiter is now a SQLite sliding window, so restarting the hub no longer resets an attacker's counter.
- **Backups with a restore drill.** Scheduled `VACUUM INTO` snapshots of the document store to S3-compatible storage (R2 / MinIO / S3) or a local directory, with retention. `maude hub backup` takes one now; `maude hub restore-drill` restores the newest generation into a throwaway directory and verifies it — SQLite integrity check, document count, and an optional sentinel document — exiting non-zero on failure. It runs in CI, because a backup nobody has restored is a hypothesis.

Also: hub documents can now be namespaced per project and branch (`ws/<workspace-id>/<branch>/<slug>`, opt-in via `linkedHub.workspaceId` or `MAUDE_HUB_NAMESPACED=1`), so two projects that both contain `ui-screen.tsx` can no longer share one document. And untrusted canvas script can no longer write a canvas's own source through the collaboration document.
