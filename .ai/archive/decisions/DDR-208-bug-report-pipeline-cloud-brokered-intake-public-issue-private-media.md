# DDR-208 — Bug-report pipeline: cloud-brokered intake, public issue + private media, consent-first

- **Date:** 2026-07-31
- **Status:** accepted
- **Area:** studio client / dev-server / cloud worker / desktop shell
- **Source:** `.ai/plans/feature-bug-report-button.md` (divergent debate 2026-07-30, reduce tier: BUILDER · SHIPPER · BREAKER) + owner override on destination; shipped across v0.51.0/v0.51.1

## Decision

The in-app **Report a Bug** flow (Studio menubar Help + Desktop native Help
menu) files through the **cloud control plane**, lands the issue on the
**public tracker `1aGh/maude`**, stores media in the **private
`1aGh/maude-reports`**, and transmits **nothing without a consent screen**.

Four load-bearing choices:

1. **Transport = cloud broker (`POST cloud.maude.sh/report`), never the user's
   GitHub token.** The keychain token is `repo`-scoped — putting it behind a
   reporting route makes a UI button a confused deputy over every private repo
   the user owns (BREAKER, accepted). The broker also serves exactly the
   reporters who matter most: signed-out, browser-only, `.deb` users. The
   client reaches it via a dev-server proxy (`/_api/report`, overridable
   `MAUDE_REPORT_URL`), so no CORS surface opens on the worker. Abuse posture
   for the anonymous endpoint: magic-byte sniffing, size caps, per-install +
   per-IP daily quotas in D1 (v8 migration), `REPORTS_DISABLED` kill switch.

2. **Split destination (owner override, 2026-07-30 — supersedes the debate's
   private-intake default).** The issue goes PUBLIC (`REPORTS_REPO`, default
   `1aGh/maude`, label `report`) so reports live with the project's issues.
   Screenshots and consented logs are COMMITTED to the private media repo
   (`REPORTS_MEDIA_REPO`, default `1aGh/maude-reports`) and only linked —
   GitHub's API cannot attach images to issues, and user canvas pixels/log
   lines must never enter a public repo's permanent history. The public JSON
   block strips `logs` entirely; the installation token is minted scoped to
   exactly the two repos (`mintInstallationToken` grew a `repositories[]`
   form). Accepted consequence: anonymous spam lands publicly — quotas + kill
   switch are the levers. Live-verified end-to-end (issues #1 intake-repo probe,
   #69 public-repo probe; byte-identical media round-trip).

3. **Consent-first, crash_reporter posture preserved.** The preview step IS
   the payload: per-item checkboxes (screenshot, scrubbed log tail, crash
   logs, canvas path, project name — default OFF), description the only
   mandatory field, in-dialog black-box redaction flattened into the PNG
   client-side. Server-side deterministic scrubber (`debug-bundle.ts`) with
   red/green tests; extended test-first, never "best-effort".

4. **`maude-report/v1` is a versioned contract** (`docs/report-schema.md`):
   fenced-JSON block (trusted block FIRST, reporter prose quoted+labelled
   below — DDR-207 hardening), additive-only evolution, label state machine
   (`report → fix-in-progress → pr-open | needs-human`) that the planned
   Mac-Mini fix agent (`.ai/plans/feature-bug-autofix-agent.md`) consumes.

## Alternatives rejected

- **User-token direct filing** — cannot deliver screenshots at all (no write
  access to any intake repo, no API attachment support) + confused-deputy.
  Kept only as the text-only offline fallback (prefilled `issues/new` URL +
  local `_reports/` bundle, gitignored per DDR-115 taxonomy).
- **R2 for media** — lifecycle expiry would break old issues; a private git
  repo is durable, access-controlled, and one credential for the fix agent.
- **Sentry-style auto-telemetry** — reverses the settled `crash_reporter.rs`
  invariant ("nothing leaves the machine"); rejected again.

## Consequences

- New privileged dev-server routes (`/_api/debug-bundle`, `/_api/report`,
  `/_api/report-fallback`) are MAIN-ORIGIN ONLY — asserted in
  `canvas-origin-gate.test.ts` per the DDR-088 dual-allowlist rule.
- `_reports/` joined the DDR-115 runtime-state taxonomy (all three lists).
- Desktop gained `list_crash_logs`/`read_crash_log` (traversal-safe, scrubbed)
  and a rotating sidecar `server.log` — the post-mortem log source a
  Finder-launched `.app` never had.
- The dialog rides the shell's `st-scrim`/`st-dialog` DS vocabulary (restyled
  2026-07-31 after the first dogfood report — fittingly, report #69's own
  screenshot was the evidence).
