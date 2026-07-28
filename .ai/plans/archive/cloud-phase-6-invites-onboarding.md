# Cloud Phase 6 — Invites + onboarding (magic link, AI-less state, export, disclosure)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phase 5 (a live cell to invite people into). Still no money.

## Description

The invited zero-git teammate is the persona this product lives or dies by (user-advocate verdict). Build the cold-invite path: e-mail magic link → `maude://` deep-link into a freshly installed Maude Desktop → signed in, project open — no account form, no token paste, no GitHub anywhere. Make the AI-less state a dignified product, ship one-click export, and surface the operator-trust mechanics.

## Metadata

- **Type**: New Capability | **Complexity**: Medium-High
- **App/Package**: `apps/hub` (invite mint/redeem), `apps/desktop` (deep-link protocol handler), `apps/studio` (ChatPanel copy, disclosure panel), `site` (download page)
- **Dependencies**: Phase 5. E-mail sending (Resend/SES — pick at execution; goes through control plane later)

## Context References

### Must-Read Files

- `.design/ui/Onboarding.tsx`, `CreateProject.tsx`, `GitHubIdentity.tsx`, `ChatPanel.tsx` — Tier-0 canvas priors (incl. the not-connected explainer)
- `apps/studio/sync/hub-link.ts` + Phase-3 sign-in flow — what the magic link short-circuits
- `apps/desktop/src-tauri/` (deep-link/URL-scheme registration; `maude://` handler) + DDR-166 (zero-terminal cold start)
- `apps/studio/client/panels/ChatPanel.jsx` — the AI-less state surface
- DDR-054 + DDR-079 (in `.ai/archive/decisions/`) — the disclosure being made visible

## Tasks

### Task 1: ADD magic-link invite (cell-level v0)

- **Do**: Cell admin mints a single-use, expiring invite link (`https://<project>.cloud.maude.sh/join/<token>`, DDR-053 bootstrap pattern). Opening it: detects desktop → `maude://join?...` deep-link (registered URL scheme) → desktop redeems the token → per-user account created in the cell's users.db → signed in, project open. No desktop yet → download page first, link survives install (deferred deep-link via clipboard/relaunch token).
- **Gotcha**: invite token never appears in logs/Referer (POST redeem, no-store); DDR-110 vocabulary + the Phase-1 ban (`repo`, `GitHub username`) on every string.
- **Validate**: `desktop-e2e` scenario `cloud-invite-cold-start` — fresh machine profile, link → editing.

### Task 2: ADD AI-less first-class state

- **Do**: ChatPanel without `claude` installed/signed-in: "AI in Maude runs on your own Claude subscription — connect it, or keep designing" + connect CTA (DDR-166 flow). Edit/comment/presence/whiteboard/export fully functional without it; nothing on the onboarding path mentions AI as a requirement.
- **Validate**: e2e on a profile with no `claude` binary — zero error states, panel copy correct.

### Task 3: ADD one-click export + trust mechanics

- **Do**: "Download everything" in project settings: `git bundle` + assets tarball via short-lived signed R2 URL; verified by opening the export as a working local Maude project. Disclosure panel (from Phase 3) extended with operator identity + break-glass access log **visible to the tenant** (append-only, from cell logs).
- **Gotcha**: export must work for a `suspended` tenant too — data is never hostage (state-machine guarantee).
- **Validate**: exported bundle opens locally with full history + media; access-log entries appear on operator SSH.

## Exit gate (the make-or-break one — timed, real human)

- [ ] A genuinely non-technical Brno Alligators member, cold e-mail invite, own machine: **first edit < 5 minutes**, no terminal, no GitHub account, no help
- [ ] Same person's honest feedback recorded into `.ai/logs/` (feeds Phase 7 UI)
- [ ] Export bundle verified; AI-less state e2e green

**Status: CORE COMPLETE** (2026-07-29). See **DDR-196**.

Built + tested: `apps/hub/src/invites.mjs` + `/join` (GET looks, POST redeems), admin mint/list/revoke. Looking never consumes (a link-preview bot must not burn an invite); a failed signup never burns it either (a typo is a retry); single-use is enforced by the UPDATE's WHERE clause, not the read before it; redeeming signs you in, because a redeem that ends at a login form reintroduced the form. 23 tests, 8 end-to-end against a real hub, including one that asserts no developer vocabulary reaches the person.

Not done: the `maude://` deep link + desktop UI (Task 1's client half), the AI-less ChatPanel state (Task 2), one-click export (Task 3). The exit gate — a timed cold start by a real non-technical human — needs a human.
