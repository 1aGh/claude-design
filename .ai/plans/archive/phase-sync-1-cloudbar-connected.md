# Phase sync-1: CloudBar — "Connect" becomes "Connected" for the linked project

> Part of [`feature-sync-completion-fixes-4-8.md`](./feature-sync-completion-fixes-4-8.md) (fix 7 of the 2026-08-10 RCA). Pure client change, no decision, no dependency — the cheap confidence-builder first.

## Description

The CloudBar project list renders every row as a `Connect <name>` button — including the project this folder is already linked to. Render a non-action "Connected" state for the linked+credentialed project instead, with a secondary Disconnect affordance.

## User Story

As a desktop user I want the CloudBar to show "Connected" for the project this folder is linked to, so that I trust the link state instead of wondering whether connecting again would duplicate something.

## Problem

`apps/studio/client/panels/CloudBar.jsx` (~L786-817) renders project rows without comparing them against `local.linkedHub` — the UI lies about an established link.

## Solution

Compare each row's `p.url` (normalized) against `local.linkedHub?.url`; when it matches AND `local.linkedHub.credentialed`, render the Connected state.

## Metadata

- **Type**: Bug Fix (UI)
- **Complexity**: Low
- **Depends on**: —
- **Parallel with**: any phase
- **Affected Files**: `apps/studio/client/panels/CloudBar.jsx`, `apps/studio/test/cloud-endpoints.test.ts`

## Must-read before implementing

- `apps/studio/client/panels/CloudBar.jsx` — L224-237 (linkedHub reassurance logic), L394-417 (local state), L786-817 (project rows).

---

## Tasks

### Task 1: UPDATE CloudBar project rows

- **Do**: In the project-row render (~L786-817), compare each `p.url` (normalized) against `local.linkedHub?.url`. For the matching project when `local.linkedHub.credentialed`, render a non-action "Connected" state (check icon, muted) instead of the `Connect <name>` button — with a secondary "Disconnect" affordance. Non-matching projects keep the Connect button.
- **Pattern**: the `linkedProject && linkedHubCredentialed` reassurance logic already at L234-237 — reuse `projectFromHubUrl` / `hostOf` for the match rather than raw string compare.
- **Gotcha**: `local.linkedHub` can be null (unlinked) and `credentialed` false (linked config but no stored token) — only the both-true case is "Connected"; a linked-but-uncredentialed row still offers Connect (it needs the sign-in).
- **Validate**: `cd apps/studio && bun test test/cloud-endpoints.test.ts` + a new assertion; manual: the linked project shows Connected, others show Connect.

### Task 2: ADD test assertion

- **Do**: Extend the hub-link / cloud-endpoints client tests with the three row states: linked+credentialed → Connected; linked-uncredentialed → Connect; unrelated project → Connect.
- **Validate**: `cd apps/studio && bun test test/cloud-endpoints.test.ts` green.

---

## Validation

1. **Static**: `pnpm lint`
2. **Tests**: `cd apps/studio && bun test test/cloud-endpoints.test.ts` — guard `git status apps/studio/dist/` before AND after.
3. **Manual smoke**: linked project row shows Connected (check icon, muted, Disconnect secondary); others show Connect.

> Client bundle rebuild is deferred to phase sync-5 close-out (single release-minified rebuild covers all client-touching phases). If sync-5 is skipped, rebuild here: `cd apps/studio && MAUDE_SKIP_RUNTIME_BUILD=1 bun run build.ts --release` and commit `dist/client.bundle.js` + `dist/styles.css`.

## Acceptance Criteria

- [x] Linked+credentialed project renders non-action "Connected" + Disconnect; all other rows keep Connect ✅ 2026-08-10
- [x] Linked-but-uncredentialed row still offers Connect ✅ (`isLinkedProjectRow` tests)
- [x] Test assertions added and green; touched-files lint clean ✅ (33 pass in cloud-endpoints; repo lint has 10 PRE-EXISTING errors in video scenes + another session's `_import-figma.mjs` — not this change)
- [x] No dist drift from test runs ✅

> Execution note (2026-08-10): Disconnect required the missing server half — new `POST /_api/cloud/detach` (cloud/endpoints.ts `detach()`, drops committed `linkedHub` + hub credential via new `deleteHubCredential`, mirrors `maude design unlink` default), `supervisor.restart(null)` = explicit unlink lane, route added to `READ_ONLY_ALLOWED_WRITES` (session-management class, same as `/_api/hub/link`), NOT in canvas-origin allowlists. Manual browser smoke deferred to phase sync-5's bundle rebuild (the served client is `dist/client.bundle.js`, rebuilt there).
