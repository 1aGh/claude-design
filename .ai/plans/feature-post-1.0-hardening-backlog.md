---
name: post-1.0-hardening-backlog
status: deferred
created: 2026-08-19
decisions:
  - kg:maude/debate-v1-gate-set (round 4, 2026-08-19 — everything here was 4-0 deferred OUT of the v1.0.0 gate)
---

# Feature: post-1.0 hardening backlog (deferred 4-0 from the v1.0.0 gate)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

Everything the original 5-phase hardening program (rounds 1–3, 2026-08-05) and the sync arc's open-findings list contain that does **NOT** gate the v1.0.0 tag. Deferred, not dropped — each item is named here so nothing silently disappears. Source of the full task detail: the pre-re-scope revision of `feature-production-grade-hardening.md` (`git log -p --follow` on that file) and `.ai/plans/archive/feature-sync-burn-down-and-shared-doc.md` § "Inherited security findings".

**Ordering guidance, not mandate**: the "Before first external users" block is BINDING debt (it was traded away in round 4 only because Maude has zero external users today); the rest is opportunistic 1.x work.

## Metadata

- **Type**: Refactor / hardening backlog
- **Complexity**: High (program), Medium per item
- **App/Package**: apps/studio, cli/, apps/hub, apps/cloud, packages/* (new), root CI

---

## Backlog

### Before first external users (BINDING — promoted debt, not optional)

- **A7 re-consent notice reaches a human** — the DDR-064 A7 shared-doc notice is a `console.warn` (`apps/studio/sync/index.ts:1567`, `:3234`) a terminal-free desktop user never sees. Binding **before Increment 8** (after the relay deletion there is no two-doc fallback) and before any real external population upgrades into `sharedDoc`/`syncFiles`/`propagateDeletes` ON.
- **Consent / first-upgrade dialog + UI toggles** for `syncFiles` / `propagateDeletes` / `resolveFirstAnchor` — today every breaker remediation string tells the user to edit `linkedHub.*` JSON with no UI control anywhere in `client/` (round-4 ADVOCATE finding). Includes surfacing per-file doručenka rows in the Sync panel (aggregates-only today) and the adopt/detach desktop dialog (CLI-only, DDR-177 posture).
- **`_trash/` retention + findable restore** (F-6) — quarantine-not-delete is only safe if discoverable; today nothing prunes or indexes it, and the product's copy points users at a hidden gitignored folder.
- **OIDC AppSec pass** — the hub browser-auth door (`handleOidc` + `oidc*.mjs`) explicitly "needs its own AppSec pass"; a re-review already found two "closed" blockers that weren't (grep green while `/admin/api/oidc/*` 404'd). Until done, OIDC stays labeled **beta** in release notes.
- **Remaining hub-trust findings** (burn-down list): F-4 (READ judges scope on lexical path, class on real), F-7/F-8/F-14 (`handleDelete` confirm semantics, seq echo, `x-maude-expect-hash: none` ambiguity), F-11/F-12 (re-anchor storm recovery, poke cooldown on reconnect), B6 (tombstone under degraded epoch), B11 (`settleOwnership` mutates `.gitignore`/index without asking in non-TTY), B13 (`parkedRemote` never expires), B14/B15 (DELETE precondition optional; session tokens wildcard-scoped; scope prefix matching vs file paths).

### Release-channel + detection (old Phase 5, re-scoped by round 4)

- **T21′ prerelease channel — tooling FIRST**: round 4 measured that no canary mechanism exists (`bump-version.sh:77` rejects prerelease strings, parity script same, `npm publish` has no `--tag`, updater endpoint has no channel dimension) and the `v*.*.*` globs would match an rc tag. Before any soak/promotion model: extend the version grammar, add `--tag next`, verify the site updater route's `releases/latest` prerelease exclusion, split the workflow globs. Then the written promotion rule + maintainer-on-canary from the original T21.
- **T22 nightly ecosystem-verify** — the repo still has zero `schedule:` workflows: clean-container `npm pack` → install → every `maude design <verb>`; upgrade-from-N-1 leg (the auto-updater code path has never been exercised); built-`.app` boot legs.
- **T23 local diagnostics + no-telemetry DDR** — ring-buffer boot log, Help ▸ Copy diagnostic report, `maude doctor --bundle`, redaction test; record the no-background-telemetry commitment; document the updater's outbound call in privacy.mdx.
- **T5b trusted publishing** — migrate the 8 npm packages off the long-lived `NPM_TOKEN` (`build-binaries.yml` ×2) to npm OIDC trusted publishing. (Do not conflate with hub end-user OIDC.)
- **Full studio suite → required**: flip A3's non-blocking full-suite job to required once clean-CI data names (or empties) the quarantine list. Includes triaging the `/_api/figma/import` cluster round 4's SHIPPER flagged as possibly real.

### Observability + hygiene (old Phase 1 residue)

- **T0b** delete the dead pre-DDR-009 `apps/studio/server.mjs` + loud no-bun refusal in `cli/commands/design.mjs`.
- **T0d′** wire `check-import-coherence.sh` per-PR (today it runs only inside `bump-version.sh`).
- **T0e** pin the bun version end-to-end (`bunVersion` field asserted by `check-version-parity.sh`; CI reads one source).
- **T3** remove the Biome client exclusion (`"!**/apps/studio/client"`) — format-only commit first, then errors-only ratchet over the 33k virgin lines.
- **T4** per-PR boot + bundle-parity gates on `client/**` PRs (v0.51.1 / v0.22.0 class).
- **T5** JSDoc `@ts-check` trial over `cli/lib` with the three named escalation triggers.
- **T2′** cloud/cells type gate (`wrangler types` + `tsc --noEmit` — cloud has no tsconfig at all today); **T15c** `apps/cells` → TypeScript (838 lines guarding tenant isolation).
- **T6** characterization tests + desktop-e2e scenarios for panels about to move (prerequisite for the decomposition below).

### Decompose + shared layer + unified UI (old Phases 2–4, unchanged verdicts)

- **T7–T10** `app.jsx` (15,936 lines) decomposition along the `client/panels/` seam — pure move-and-export commits, bundle byte-delta band, exit ≤ ~2,000 lines.
- **T11** duplication census (admission rule: ≥2 named real consumers); **T12** five-environment reachability canary + dep-surface freeze — blocks all content moves.
- **T13** `packages/tokens` (DTCG source, hand-written emitters, byte-identical first run); **T14** `packages/protocol` (runtime-state list generator, DDR-088 parity, slug conformance + property tests); **T15** `packages/crypto-portable` narrowed to token grammar + timing-safe compare; **T15b** hub COPY-manifest gate + published dep posture.
- **T16–T19** `@maude/ds-css` pilot (kill-switch), shell vocabulary convergence, handoff `--check` + self-containment, DiffView inversion pilot → written go/no-go incl. trust-boundary review.
- **T20** TypeScript policy DDR (checker-first ratchet) — record once the trial evidence exists.

### Desktop E2E harness residue (found running the v1.0.0 gate's e2e lane, 2026-08-19)

Both scenarios that were red on the branch are now fixed — the causes were **stale
tests, not product defects** (`timeline-manual-cut` asserted a band-mode storyline
its media-free fixture deliberately never renders; `canvas-text-editing` asserted
caret-at-click after the 2026-07-20 steer made the dblclick entry select-all, and
its drill budget of 5 was under the 3–4 dblclicks the ladder actually needs). What
is left is harness quality, not correctness:

- **E1 — the two write-through waits are load-sensitive.**
  `canvas-text-editing.e2e.ts:904` ("h1 edit never persisted through reload") and
  `:1028` (the `.map` card equivalent) both wait on commit → `/_api/edit-text`
  source rewrite → file-watcher HMR → re-render. Measured over ~15 consecutive
  runs: failure count tracks machine load (this box sits at 7–9 from concurrent
  sessions) and the specific test varies. **Do not "fix" by raising the timeout
  until it has been measured on an idle machine** — that would only move the
  ceiling, and the current number may be fine. This is
  `feedback_native_app_verification_ceiling` in its load form; the honest fix is
  either an idle-run measurement or a deterministic settle signal (an explicit
  "source rewritten + canvas rebuilt" event to await instead of polling the DOM).
- **E2 — a run leaves the VERSIONED fixture dirty on failure.**
  `canvas-text-editing` snapshots `ui/Smoke.tsx` + `ui-smoke.annotations.svg` in
  `before` and restores in `after`, but a crashed/killed run skips `after` — the
  tree is then dirty, and worse, the NEXT run snapshots the dirty state as its
  baseline and cascades (observed: one run reported 6 failures purely from this).
  It also broke a `git stash pop` mid-investigation. Restore should not depend on
  a clean exit.
- **E3 — the default `wdio.conf.ts` spec glob claims scenarios that have their own
  configs.** `specs: scenarios/**/*.e2e.ts` sweeps in `onboarding`, `cloud`,
  `git-*`, `acp-*`, `parity` — each of which has a dedicated conf supplying env
  those scenarios need. `pnpm test:e2e:desktop` therefore cannot be the "run
  everything" command it looks like. Either exclude the specialised specs from the
  default glob or make the suite self-skip without its env.

### DS specimen defects (found reading all 73 smoke PNGs, 2026-08-19)

All three are **pre-existing** — confirmed byte-identical to the previous cleared
smoke run, so none is a regression from the gate set. Cosmetic, none blocking.

- **S1** `colors-presence` §2 — the agent cursor's label overlaps its own name chip
  ("agent editi" + "Agent" collide) in the Group·Footer artboard.
- **S2** `iconography` §4 ("In the toolbar") — the seated glyphs render as empty
  boxes; §2's full set renders correctly, so it is specific to that specimen's
  toolbar mount.
- **S3** `commands_overview` — diagram nodes render as solid black boxes with no
  visible labels (draw-engine text). Also affects the same canvas in older runs.

### Sync arc residue (non-security)

- **Increment 8** — delete `agent.ts` + the two-doc relay (deliberately held so the `MAUDE_SHARED_DOC` flip keeps a config rollback; unblocks only after A7-notice ships).
- Two open RCA items in `.ai/logs/rca/issue-cloud-assets-open-findings.md` §3 + live half of §4.
- Duplicate DDR-223 file numbering; `maude kg record-log` ENOENT on `/` in derived names.

---

## Validation

Per-item, inherited from the original plan's per-task validation (see the pre-re-scope revision). Program-level: every item either ships in a 1.x release or carries a written rejection — nothing exits this list silently.

## Acceptance Criteria

- [ ] "Before first external users" block completed BEFORE any release is promoted to a real external population (or each item carries a recorded, dated waiver)
- [ ] Each remaining item scheduled into a 1.x plan or explicitly rejected with a DDR
- [ ] This file archived only when empty
