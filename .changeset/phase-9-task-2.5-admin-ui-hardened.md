---
'@1agh/maude': minor
---

feat(design/hub): phase-9 task 2.5 — in-hub admin UI with DDR-053 security hardening

Adds a vanilla-JS single-page admin at `/admin` bundled into the hub binary (no framework, ~6 KB gz). First-run bootstrap URL printed to logs lets the operator claim the hub without shell access; subsequent visits authenticate via `Authorization: Bearer <secret>`. Four cards: Generate invite (mint copy-paste `maude design link …` command), Connected peers (poll), Hub status (uptime/version/data dir), Active tokens (rotate). One-time bootstrap key is **single-use** (POSIX-atomic rename-to-consume) and **never regenerated** after consumption or expiry — operator falls back to `HUB_SECRET` env on recovery.

Security architecture pinned in [DDR-053](./.ai/decisions/DDR-053-hub-admin-auth-architecture.md): Bearer-only auth (no `?secret=` query), scope-bound tokens (default `scope = label`; `documentName` must match), session-kick on rotate, per-IP rate limit (5/60s), CSP + X-Frame-Options + Referrer-Policy on `/admin*`, strict `Content-Type: application/json` on POSTs, proto-pollution + body-timeout guards, all log lines scrubbed of CR/LF for log-forging defense, server-side label + documentName + publicUrl validation.

A11y: WCAG 2.1 AA — `--muted` token darkened to clear 4 contrast blockers, `role="alert"` on error containers, `<dialog>` focus management + `aria-labelledby`, `aria-live` announcement for "Copied ✓", `aria-hidden` on decorative icons, skip-nav link, semantic table captions + `scope="col"`.

CLI: `maude hub serve` usage refreshed to mention the admin UI + bootstrap flow.
