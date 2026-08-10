# DDR-218 — Cloud-linked repo commit model: the desktop GitPanel withdraws to the cloud-managed posture

**Status:** Accepted — 2026-08-10.
**Related:** the cell-side precedent ("in a cloud cell the Changes panel withdraws to History — the hub already committed it", `GitPanel.historyOnly` / `cfg.cloud`, Cloud Phase 27), DDR-119 (web studio read-only posture), the 2026-08-10 sync RCA (fix 8: the dual commit model), [DDR-217](DDR-217-cloud-asset-transport-desktop-push.md) (the same RCA's asset leg).
**Instruments:** `apps/studio/client/panels/GitPanel.jsx` (`cloudManaged` prop), `apps/studio/client/panels/CloudBar.jsx` (`onLinkedHub` lift), `apps/studio/client/app.jsx` (the gate).

## Context

A repo linked to Maude Cloud still shows the desktop `GitPanel`'s full local-commit surface (Changes / Save / Publish / discard) while the cell auto-commits every edit ~3 s after it lands. The user sees TWO save mechanisms and edits that look "uncommitted" locally — the RCA's reported confusion. The server side already decided this question for the cell: `historyOnly` withdraws the working-tree half because "an 'unsaved changes' list is not a to-do, it is a lie about work that is already saved."

## Decision

**When the open repo is cloud-linked AND credentialed (`linkedHub && credentialed`, the same corroboration rule CloudBar's Connected state uses — B2: config.json alone is attacker-authorable), the desktop GitPanel renders the cloud-managed posture**: the `historyOnly` withdrawal (History stays — it is the point) **plus** a "Cloud is saving — changes sync automatically" note naming the one save mechanism that is active. The gate reacts LIVE to connect/disconnect (the linked state is lifted from CloudBar, which owns both actions), not only at boot.

**De-emphasise, never suppress.** The user's `.git` is untouched: no hook is installed, no config is written, `git` in a terminal behaves exactly as before, and the server routes (`/_api/git/commit` …) keep their own gates unchanged — this is PRESENTATION, not a control, the same rule the cell-side flag documents. The escape hatch is Disconnect (the CloudBar affordance shipped with fix 7): the panel returns in full, live, without a reload.

- **vs. suppressing local git** (blocking commits, installing hooks): rejected — touching a user's `.git` on their behalf is a trust violation, and a power user's terminal workflow must survive whatever the panel shows.
- **vs. merely re-wording the Changes tab**: rejected — the offer itself ("Save", a count of "unsaved" files) is the lie; only withdrawal removes it.
- **vs. a config flag as the escape hatch**: not needed in v1 — Disconnect already restores local-first behaviour and is discoverable in the same UI; a `linkedHub.localCommits: true` opt-out can ship later without conflicting with this decision.

## Consequences

- One save mechanism visible at a time: cell browser (existing `historyOnly`), cloud-linked desktop (this `cloudManaged` posture), unlinked desktop (full panel).
- The gate's data source is `/_api/cloud/status`' `linkedHub.credentialed` — lifted once from CloudBar rather than fetched twice; CloudBar reports link changes (initial resolve, attach, detach) to the app shell.
- A linked-but-uncredentialed repo (config travels with the repo, no local sign-in) keeps the FULL panel — same reasoning as its Connect button: the machine has no cloud relationship to defer to.
