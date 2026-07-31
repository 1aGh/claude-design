# `maude-report/v1` — the bug-report contract

The contract between the **Report a Bug** dialog (Studio + Desktop), the cloud
intake route, and the autonomous fix agent
(`.ai/plans/feature-bug-autofix-agent.md`) that consumes those issues.

**Split destination** (owner decision 2026-07-30): `POST cloud.maude.sh/report`
opens the issue on the **public tracker `1aGh/maude`** (label `report`), while
screenshots and consented logs are committed to the **private
`1aGh/maude-reports`** repo and only *linked* from the issue — user canvas
pixels and log lines never enter a public repo's permanent history. Overridable
via worker env: `REPORTS_REPO` (issues), `REPORTS_MEDIA_REPO` (media).

## Versioning

The schema is **additive-only**. New optional fields may appear in `v1`
without a version bump; removing or re-typing a field requires `maude-report/v2`
and a consumer that still parses `v1`. Consumers MUST ignore unknown fields.

## Where the block lives

The GitHub issue body contains a human-readable section followed by exactly one
fenced code block tagged `json` whose first key is `"schema"`:

````markdown
## What happened

<user's description, verbatim>

## Report data

```json
{
  "schema": "maude-report/v1",
  ...
}
```

## Attachments (private — maintainer access)

- [screenshot-1](https://github.com/1aGh/maude-reports/blob/main/media/2026-07/<id>-1.png)
- [logs](https://github.com/1aGh/maude-reports/blob/main/media/2026-07/<id>-logs.txt)
````

Consumers locate the block by scanning fenced ```json blocks for
`"schema": "maude-report/v1"` — never by position. Issues labeled `report`
**without** any such block are legal (hand-written reports); consumers fall
back to prose parsing (degraded mode).

## Fields

```json
{
  "schema": "maude-report/v1",
  "reportId": "r-8f3a2c1d",
  "installId": "i-4f9d2b7c81a0",
  "createdAt": "2026-07-30T12:00:00Z",

  "app": {
    "maudeVersion": "0.50.0",
    "surface": "native",
    "platform": "darwin",
    "arch": "arm64"
  },

  "context": {
    "projectName": "acme-web",
    "activeCanvas": "ui/Dashboard.tsx",
    "route": "canvas"
  },

  "description": "Clicking export freezes the app",

  "attachments": {
    "screenshots": 1,
    "serverLogTail": true,
    "crashLogs": 0
  },

  "logs": {
    "serverLogTail": "…last ≤200 scrubbed lines…",
    "crashLogs": [{ "name": "crash-1753872000.log", "body": "…scrubbed…" }]
  }
}
```

| Field | Required | Notes |
| ----- | -------- | ----- |
| `schema` | ✅ | literal `maude-report/v1` |
| `reportId` | ✅ | client-generated `r-<8 hex>`; dedupe key |
| `installId` | optional | stable per-install random id (localStorage); quota bucket — never identifies a person |
| `createdAt` | ✅ | ISO-8601 UTC |
| `app.maudeVersion` | ✅ | from the design-plugin manifest (`resolveMaudeVersion`) |
| `app.surface` | ✅ | `native` (Tauri shell) \| `browser` (plain dev-server) |
| `app.platform` / `app.arch` | ✅ | `process.platform` / `process.arch` |
| `context.projectName` | opt-in | `config.json` `name`; user checkbox, default **off** |
| `context.activeCanvas` | opt-in | slug/relative path ONLY — never canvas content |
| `context.route` | optional | which UI surface the dialog was opened from |
| `description` | ✅ | the only mandatory user input |
| `attachments.*` | ✅ | counts/flags of what the user consented to send |
| `logs.serverLogTail` | opt-in | ≤ 200 lines, **already scrubbed server-side** (see below) |
| `logs.crashLogs[]` | opt-in | desktop only; scrubbed `crash-*.log` bodies, max 3 |

`logs.*` travel in the POST body but are **stripped from the public issue's
JSON block** — the worker writes them to `media/<yyyy-mm>/<id>-logs.txt` in the
private media repo and links that file from the issue instead.

## Privacy invariants (enforced upstream, asserted by consumers)

1. Nothing in the payload is collected without the consent screen; every
   optional field has its own checkbox in the dialog.
2. `logs.*` values pass through the deterministic scrubber
   (`apps/studio/debug-bundle.ts` `scrub()`): home dirs → `~`, repo-absolute
   paths → `<project>/…`, token/bearer/key material → `[redacted]`,
   emails → `[email]`. The scrubber has red/green tests — extend the tests
   when extending the scrubber.
3. Canvas **content** never enters a report. Screenshots are the user-reviewed
   (and optionally redacted) PNG only.

## Transport limits (enforced by the cloud route)

- max 3 screenshots, PNG/JPEG only, ≤ 5 MB each
- `report` JSON ≤ 256 KB
- quota: 5 reports / install / day (+ IP rate limit)
- kill switch: `REPORTS_DISABLED=1` → `503 {"error":"reporting is paused"}` →
  clients fall back to the local bundle path

## Label taxonomy (state machine on `1aGh/maude` issues)

| Label | Set by | Meaning |
| ----- | ------ | ------- |
| `report` | cloud route | fresh intake; the fix agent's poll filter |
| `fix-in-progress` | fix-agent runner | claimed by a run (crash-safe: stale claims > 24 h are re-claimable) |
| `pr-open` | fix-agent runner | PR opened on `1aGh/maude`; link in issue comment |
| `needs-human` | fix-agent runner / skill | escalated — transcript tail attached as comment |
| `wontfix-auto` | maintainer | agent must never pick this up again |

Labels are the ONLY cross-run state; the GitHub UI doubles as the ops
dashboard and the manual override surface.

## Media layout in `1aGh/maude-reports` (private)

`media/<yyyy-mm>/<reportId>-<n>.png` + `media/<yyyy-mm>/<reportId>-logs.txt` —
committed by the cloud route with the GitHub App installation token (scoped to
exactly the two repos). Referenced from the public issue via `github.com/...`
blob links — resolvable only to authenticated collaborators and the fix
agent's identity.
