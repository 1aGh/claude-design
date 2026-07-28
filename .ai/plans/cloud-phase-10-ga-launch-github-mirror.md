# Cloud Phase 10 — GA launch + GitHub mirror (production release on maude.sh)

Part of the Maude Cloud arc — read `cloud-phase-0-economics-and-architecture.md` first. Requires Phase 9. The production-release phase.

## Description

Open self-serve signup (cap lifted), ship the optional GitHub mirror via a customer-installed GitHub App, finish docs + migration guides, and launch on maude.sh.

## Metadata

- **Type**: New Capability + Launch | **Complexity**: Medium
- **App/Package**: `apps/cloud`, `apps/studio` (mirror settings UI), GitHub App registration, `site` (launch content)
- **Dependencies**: Phase 9 complete (fleet ops + trust). GitHub App registered under the Maude org

## Context References

### Must-Read Files

- `.ai/archive/decisions/DDR-162*` — SSH-remote publish + PR flow ("Add to Shared version" opens a PR) — the vocabulary + flow the mirror handoff reuses
- `.ai/archive/decisions/DDR-108*`, `DDR-114*` — GitHub App/OAuth boundary precedent (installation token custody)
- Phase-3 workspace agent — where the push-mirror hook lands (append-only, never force-push already guaranteed)
- `site/` — launch page, changelog, `whats-new-entry` skill (user-visible feature ⇒ What's New entry on `/flow:done`)

## Tasks

### Task 1: ADD GitHub App mirror (optional, push-only)

- **Do**: Customer installs the Maude GitHub App on their org/account; the **cell** (never the control plane) holds the repo-scoped installation token; settings toggle "Also keep a copy in your GitHub" → workspace agent pushes after each autosave batch (append-only; on rejection the Phase-3 plain-words conflict state). Mirror is never authoritative — get-latest still comes from the cell.
- **Gotcha**: vocabulary — the toggle lives in settings, never on the create/purchase path (Phase-1 ban); DDR-162's "Send for review" naming for any PR handoff.
- **Validate**: mirror round-trip to a test org; token revocation (App uninstalled) degrades gracefully to a visible "mirror paused" state.

### Task 2: OPEN self-serve GA

- **Do**: remove the tenant cap; production Stripe live; onboarding e-mail sequence; status page (Fly + Vercel status composition or simple self-hosted); support inbox + runbook linkage.
- **Validate**: **stranger test** — someone outside the project completes signup → pay → create → invite → mirror → export with zero human help; recorded.

### Task 3: LAUNCH content + docs

- **Do**: maude.sh launch page + cloud docs section complete (what's stored where, region, export, disclosure); migration guides **both directions** (self-host → cloud, cloud → self-host — the export bundle is the bridge); changelog + What's New entry (`whats-new-entry` skill); roadmap regen.
- **Validate**: site builds; docs links checked; `/flow:done` closes the arc with the full validate gate.

## Exit gate (= production release)

- [ ] Stranger test passed end-to-end, unaided
- [ ] GitHub mirror live incl. graceful revocation
- [ ] Docs + migration guides published; What's New entry stamped
- [ ] `/flow:validate` full pipeline green; security pass on the final diff
- [ ] Post-launch: cost/margin telemetry reviewed against Phase-0 §2 after 30 days (record a retro)
