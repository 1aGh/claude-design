# Feature: setup-ds hardening round 2 — reconciliation, aspiration bar, restraint

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This is **plugin-internal spec/prompt engineering** (markdown skills + commands + templates) — no runtime code, no UI, no tests/build to run. Validation is grep-based marker checks + a manual `/design:setup-ds` smoke on a scratch repo.

## Description

A second round of `/design:setup-ds` hardening driven by the `new-studyfi` bootstrap retro (`/Users/iagh/git/AI-StudyMate/.ai/logs/system-reviews/new-studyfi-bootstrap-review.md`, 2026-05-28) **and** the user's lived experience of that run. Phase 3.7 (archived) already added the motion subsystem, `SUB-AGENT-PROMPTS.md`, the bypass-log discipline, and the safety blocks. This round closes the gaps that **survived** phase 3.7 — most of which are not missing rules but **gates that exist in the spec yet got bypassed in practice**.

The user's three felt failures map to concrete spec defects:

1. **"Mobile showcase zapomenutý úplně"** → the roster template (`SKILL.md` lines 661–674) hard-lists **only desktop** showcase rows/slices. There is no mobile/tablet showcase row even when Q3 puts those platforms in scope, despite line 882 declaring ui_kits "not optional for any in-scope platform". The reconciliation gate (line 677) only asserts rows that *exist* in the roster, so a never-added mobile row passes silently — compounded by the D-1 socket failure that prevented reconciliation from running at all.
2. **"Hezké ale ne wow; typografii a pozadí jsem ladil sám"** → the aspiration gate passes at `≥ 3.5` (line 985). "Hezké ale ne wow" *is* a 3.5–3.8, and studyfi scored 3.8/3.7 → silent "passed". The bar measures absence-of-bad, not presence-of-wow. Plus the aesthetic panel is skippable mid-bootstrap and ran only post-hoc on user request (retro G-3).
3. **Typography/background self-tuned** → review D-7 (research said grotesque, scaffold picked Fraunces serif), D-8 (melodramatic 1.25 / opsz-144 / black scale), D-5 (mesh tokens dual-purposed as decorative fills).

## User Story

As a designer running `/design:setup-ds` on an existing product, I want the bootstrap to (a) never silently drop a mandatory per-platform showcase, (b) refuse to call "hezké ale ne wow" a pass, and (c) default to restrained, research-faithful typography — so that the first scaffold is the one I keep, not the one I spend an evening re-tuning.

## Problem

Six gates/defaults that the retro proved insufficient:

- Roster template omits non-desktop showcases → mobile silently dropped (P0).
- Reconciliation runs only on the happy path and only checks rows that exist → no enforcement when a batch fails or a row was never emitted (P0).
- No fan-out ceiling → 8 parallel long-running agents exhausted the socket budget, all 8 failed, which is what triggered the skipped reconciliation (P0).
- Aspiration "pass" at 3.5 lets mediocre-but-fine output ship as "complete" (P0).
- Bootstrap defaults to maximal editorial drama and lets open-source font availability flip the research's primary face role (P1).
- "DS in use" showcase invents UX instead of reading the real app (P1).
- Plus stickiness/cleanup gaps: `/design:edit` stale-CSS bundle, motion pre-flight, bypass-log enforcement, asset-path format, mesh-token role separation (P2).

## Solution

Edit the design plugin's authoritative spec files in place:

- **`SKILL.md`** — per-platform showcase rows in the roster template + fanout; failure-proof reconciliation with an explicit per-platform showcase checklist; fan-out ceiling 3–4; aspiration threshold reframe; restraint-default type scale; research type-fidelity rule; showcase-from-real-app rule.
- **`SUB-AGENT-PROMPTS.md`** — restraint + type-fidelity guidance in the type slice; showcase-from-real-app constraint in the ui_kit slice; reconcile asset-path format with the retro.
- **`commands/edit.md`** — touch paired `.tsx` after sibling `.css` edit; matchMedia-first motion pre-flight.

## Metadata

- **GitHub Issue**: n/a (retro-driven internal hardening)
- **Type**: Enhancement (spec hardening)
- **Complexity**: Medium — many small surgical edits across 3 markdown files, no code
- **App/Package**: `plugins/design`
- **Affected Systems**: `/design:setup-ds` (design-system skill), `/design:edit`, sub-agent prompt template
- **Dependencies**: none (builds on phase-3.7 / DDR-049, archived)

---

## Context References

### Must-Read Files

- `plugins/design/skills/design-system/SKILL.md` lines 645–714 — roster template (`scaffold:` rows + `fanout:` slices) + reconciliation rule (677) + fan-out section. The desktop-only omission lives here.
- `plugins/design/skills/design-system/SKILL.md` lines 880–950 — ui_kit handling ("not optional for any in-scope platform", line 882) + visual-sanity + bypass-log failure-mode table.
- `plugins/design/skills/design-system/SKILL.md` lines 952–1037 — 4-kola critic panel + aspiration threshold matrix (985–989) + next-steps print block.
- `plugins/design/skills/design-system/SKILL.md` lines 118–123 — Spec-bypass discipline (exists; enforcement gap).
- `plugins/design/skills/design-system/SKILL.md` lines 685–706 — Batch A serial writes (token + `_layout.css` gen — restraint default lands here).
- `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md` lines 13–46 — MANDATORY SAFETY BLOCKS (ANIMATION / RELATIVE-URL / PLACEHOLDER). Asset-path format reconciliation + new type/showcase guidance attach here.
- `plugins/design/commands/edit.md` lines 280–325 — step 5 (apply edit) + step 7 (post-write screenshot). D-2 touch-`.tsx` and D-3 matchMedia pre-flight attach around here + step 0 (lines 29–44).
- `/Users/iagh/git/AI-StudyMate/.ai/logs/system-reviews/new-studyfi-bootstrap-review.md` — the source retro (D-1…D-9 + G-1…G-3).

### Files to Create

- none — all edits are in-place. (Optional: a DDR under `.ai/decisions/` if the aspiration-threshold change is deemed DDR-worthy — see Task 4 Gotcha.)

### Documentation

- Phase 3.7 archived plan `.ai/plans/archive/phase-3.7-setup-ds-hardening-and-motion-subsystem.md` — Why: the immediate predecessor; mirror its discipline and avoid re-litigating its decisions (DDR-049).
- `plugins/design/templates/design-system-inspiration/_MAPPING.md` — Why: the canonical claim→file table + ui_kit inventory the roster is built from; the per-platform showcase fix must stay consistent with it.

### Patterns to Follow

The roster is YAML-in-markdown; reconciliation prose references it. Mirror the existing row shape exactly when adding mobile/tablet rows:

```yaml
# existing (desktop-only) — SKILL.md:661-662
- { path: "preview/ui_kits-desktop-showcase.tsx", batch: C, deps: [tokens, chrome, template, ALL], status: pending, signature: true }
- { path: "preview/ui_kits-desktop-index.tsx",    batch: C, deps: [ALL specimens written], status: pending }
```

Retro fix actions are already phrased as drop-in spec language — lift them verbatim where they fit (review lines 150–183).

---

## Tasks

Execute in order. P0 tasks first (they address the user's two hardest felt failures); P1 next; P2 cleanup. Each task is one coherent edit to one file.

### Task 1 (P0): UPDATE SKILL.md roster — per-platform showcase rows + fanout slices

- **Do**: In the `scaffold:` roster template (around lines 660–662) replace the hardcoded desktop-only showcase pair with a **per-in-scope-platform** block. For every platform in Q3 (`desktop`, `mobile`, `tablet`), emit a `ui_kits-<platform>-showcase.tsx` (`signature: true`) row and a `ui_kits-<platform>-index.tsx` row. In the `fanout:` block (around lines 663–674), add one showcase slice per in-scope platform (e.g. `{ batch: C, slice: "showcase-mobile", files: [ui_kits-mobile-showcase] }`) — do NOT lump all platforms into one slice (keeps each within the leaner-prompt budget from Task 3). Add a one-line comment above the block: `# one showcase+index PER in-scope platform (Q3) — desktop-only here is a template stub, expand at emit time`.
- **Pattern**: the existing desktop rows at 661–662; keep `deps`/`status`/`signature` fields identical.
- **Gotcha**: line 882 already declares ui_kits non-optional per platform — this task makes the roster *match* that declaration. Cross-check `_MAPPING.md` ui_kit inventory so platform slugs (`mobile`/`tablet`) match the library's `platform-<platform>/` convention. The `*-index.tsx` is always written LAST by the main agent (line 677), not a sub-agent — preserve that note per platform.
- **Validate**: `grep -nE "ui_kits-(mobile|tablet|desktop)-showcase" plugins/design/skills/design-system/SKILL.md` shows all in-scope platforms; manual read confirms fanout has a per-platform showcase slice.

### Task 2 (P0): UPDATE SKILL.md reconciliation — failure-proof + per-platform showcase checklist

- **Do**: Rewrite the reconciliation rule (line 677) so it (a) runs **regardless of batch outcome** — "after every batch attempt, including partial or failed fan-out, the main agent reconciles before proceeding"; (b) asserts an **explicit expected-set** derived from Q3, not just the rows that happen to exist — "for every in-scope platform there MUST be a `written` `ui_kits-<platform>-showcase` row; a missing-entirely showcase is the same hard-fail as a `pending` one"; (c) routes the D-1 socket-failure recovery path *into* reconciliation, not around it. Add to the failure-mode table near line 946 a row: socket-close / batch cohort failure → re-spawn the failed slices (≤ ceiling), then reconcile; never report complete with a pending or absent showcase.
- **Pattern**: existing reconciliation prose at 677 + the failure-mode table at 944–948.
- **Gotcha**: this is the gate that would have caught the missing mobile showcase. The bug was two-fold (row never emitted AND reconciliation skipped on failure) — fix BOTH or it recurs. Reference the retro: "Scaffold roster as contract ⚠️ never reconciled after socket failure (rows stayed pending)".
- **Validate**: `grep -nE "every in-scope platform|partial or failed|absent showcase" plugins/design/skills/design-system/SKILL.md` returns the new clauses.

### Task 3 (P0): UPDATE SKILL.md fan-out — cap 3–4 sub-agents, leaner prompts

- **Do**: In the fan-out section (line 710, "5–8 slices … Fire all slices in a single message") change the ceiling to **3–4 concurrent sub-agents per batch**, prompts **≤ ~2 KB**. Add the rationale verbatim from the retro D-1: "8 simultaneous long-running (15–40 min) general-purpose agents exceed the API socket budget and fail as a cohort; recovery with 3 leaner agents succeeded first try." If a batch has > 4 slices, the main agent dispatches them in **sequential waves of ≤ 4**, reconciling (Task 2) between waves.
- **Pattern**: the existing "Fire all slices in a single message" instruction at 710 — replace the count, keep the parallel-in-one-message mechanism (just bounded).
- **Gotcha**: line 683 also says "5–8 sub-agents in parallel" — update BOTH occurrences (683 and 710) or the cap is contradicted. `grep -n "5.\?8" SKILL.md` to find every instance.
- **Validate**: `grep -nE "5.?8 sub-agent|5.?8 slices" plugins/design/skills/design-system/SKILL.md` returns nothing; `grep -n "3.4 concurrent\|waves of" SKILL.md` returns the new ceiling.

### Task 4 (P0): UPDATE SKILL.md aspiration threshold — raise the bar + non-skippable aesthetic gate

- **Do**: In the threshold matrix (985–989): (a) raise the silent-pass line — only `aspiration_score ≥ 4.0` prints a clean "aesthetic check passed"; (b) add a middle band `3.0 ≤ score < 4.0` → still prints complete, but MUST append a "What would take this from hezké to wow" block surfacing the signature-moment critic's top 2 specific lifts (not a generic nag — the critic's actual notes, e.g. studyfi's "mesh never enters a product surface"); (c) keep `< 3.0` as the hard "does not match the quality bar" fail. Then in the panel-coverage gate (956–967): during a **first-bootstrap or additional-ds** run, the aesthetic kola (Kolo 2) is **not skippable** — `--quick`/imprint-only may trim Kolo 3 but Kolo 2 always runs, because "hezké ale ne wow" is invisible without it. Update the next-steps print block (1030–1036) to fire on the new `< 4.0` middle band, not just `< 3.0`.
- **Pattern**: existing matrix + `[IF aspiration < 3.0 …]` block at 1030.
- **Gotcha**: studyfi scored 3.8 and passed silently — that exact number must now trigger the "what would make it wow" block. Don't over-correct into nagging: the middle band still says *complete*, it just refuses to be silent. **DDR check**: raising a published quality threshold is a behavior change downstream users will feel — record a short DDR (`.ai/decisions/DDR-0NN-aspiration-pass-bar-raised-to-4.md`) capturing the 3.5→4.0 rationale (retro evidence: 3.8 felt "ne wow").
- **Validate**: `grep -nE "≥ 4.0|3.0 ≤|hezké to wow|to wow" plugins/design/skills/design-system/SKILL.md` returns the new bands; manual read of the panel-coverage gate confirms Kolo 2 non-skippable in bootstrap.

### Task 5 (P1): UPDATE SKILL.md + SUB-AGENT-PROMPTS.md — restraint-default type scale (D-8)

- **Do**: In Batch A token generation (SKILL.md ~691, the `colors_and_type.css` substitution step) add a restraint default: editorial/display DS defaults to a **restrained ladder — type scale ratio ≤ 1.2, optical-size ≤ 72, weight ≤ semibold for display, tracking ≥ -0.02em**, and the user opts UP via `/design:edit`, never down. In `SUB-AGENT-PROMPTS.md` type slice addendum, mirror the same ceiling so a sub-agent scaffolding type-scale.tsx doesn't reintroduce drama.
- **Pattern**: retro action 6 wording + D-8 prevention line ("Default editorial DS to a restrained ladder (1.2, ≤72 opsz); let user opt UP, not down").
- **Gotcha**: this is a *default*, not a hard-stop — discovery may legitimately call for drama; the rule is "start restrained, dial up on request", phrased as a default so it doesn't fight a high-confidence research recommendation that explicitly wants maximalism.
- **Validate**: `grep -nE "restrained ladder|opt UP|≤ 1.2|≤ ?72" plugins/design/skills/design-system/SKILL.md plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md`.

### Task 6 (P1): UPDATE SKILL.md + SUB-AGENT-PROMPTS.md — research type-fidelity (D-7)

- **Do**: Add a rule where the scaffold consumes the research payload's type recommendation: **mirror the research's PRIMARY display-face ROLE exactly — a "grotesque" direction must yield a grotesque display face even when an open-source serif is more convenient; do not let font availability flip the role.** If the named face is unavailable, substitute within the SAME role/classification (grotesque→grotesque), and log the substitution to the bypass-log. Put the consuming rule in SKILL.md near where research recommendations feed Batch A; put the enforcement reminder in the SUB-AGENT-PROMPTS type slice.
- **Pattern**: retro action 6 / D-7 prevention ("Mirror the research's PRIMARY display-face role exactly").
- **Gotcha**: the studyfi failure was "research said `display-grotesque-editorial-serif` (grotesque sans display WITH editorial serif for body accents); scaffold read 'serif' and picked Fraunces as the DISPLAY face, inverting it." The rule must distinguish *display role* from *body-accent role* — the serif was meant for body accents, not display.
- **Validate**: `grep -nE "display-face role|same role|grotesque.*serif" plugins/design/skills/design-system/SKILL.md`.

### Task 7 (P1): UPDATE SKILL.md + SUB-AGENT-PROMPTS.md — showcase-from-real-app (D-6)

- **Do**: Add a rule to the ui_kit handling section (~882) and the ui_kit slice in SUB-AGENT-PROMPTS.md: **when scaffolding a "DS in use" showcase for an EXISTING product, the showcase sub-agent MUST first read the app's real layout — `AppLayout` + primary nav components — and mirror that UX, restyling only; it must NOT invent a plausible product UX.** The orchestrator passes the real layout file paths into the showcase slice prompt (source-of-truth injection). For greenfield/no-existing-app DSes, the invent-a-plausible-UX path stays.
- **Pattern**: retro action 5 / D-6 prevention. The existing ui_kit handling at 882–884 is where the "full product mock" role is defined — attach the rule there.
- **Gotcha**: cost of getting this wrong in studyfi was a full rebuild of both showcases (~5500 LOC). The orchestrator must *detect* "existing product" (e.g. config flag, or the user's brief naming a shipped app) and only then enforce the read-first rule — otherwise it has nothing to read.
- **Validate**: `grep -nE "real layout|AppLayout|read the app|restyle only|restyling only" plugins/design/skills/design-system/SKILL.md plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md`.

### Task 8 (P2): UPDATE edit.md — touch paired .tsx after sibling .css edit (D-2)

- **Do**: In `commands/edit.md` step 5 (apply edit, ~280) add: "After editing any `<slug>.css` sibling, `touch <slug>.tsx` so the canvas-build re-inlines the CSS — the bundle cache keys on the `.tsx` mtime, so a CSS-only edit is otherwise invisible until a server restart." Put the actual `touch` in the step-7 pre-screenshot path (~314) so the confirmation screenshot reflects the CSS change.
- **Pattern**: step 7 screenshot block at 314–318.
- **Gotcha**: this is the retro's single highest-ROI fix (5 wasted identical screenshots). Only fires for `css_mode` canvases that have a sibling `.css` — Tailwind/inline modes don't apply.
- **Validate**: `grep -nE "touch .*tsx|re-inlines the CSS|keys on the .*mtime" plugins/design/commands/edit.md`.

### Task 9 (P2): UPDATE edit.md — matchMedia-first motion pre-flight (D-3)

- **Do**: In step 0 pre-flight (~29) or a new "motion-complaint fast-path" note: when the feedback mentions motion ("nehýbe se", "motion", "animace nefunguje", "not animating"), the FIRST diagnostic is `agent-browser eval "matchMedia('(prefers-reduced-motion: reduce)').matches"` — headless Chrome (and many user browsers) default reduced-motion=true, which correctly suppresses motion; don't chase the CSS until this is ruled out.
- **Pattern**: the runtime-bundle health-probe note at edit.md 120–128 (same "diagnose environment before code" spirit).
- **Gotcha**: studyfi burned ~2 user round-trips on this. The probe is cheap (~1 agent-browser call) and belongs before any code reading.
- **Validate**: `grep -nE "prefers-reduced-motion|matchMedia|reduced.motion" plugins/design/commands/edit.md`.

### Task 10 (P2): UPDATE SKILL.md + SUB-AGENT-PROMPTS.md — bypass-log enforcement, asset-path format, token-role separation

- **Do**: Three small stickiness fixes batched: (a) **Bypass-log enforcement (D-9)** — in the Spec-bypass discipline (118) add "the bypass-log write is non-optional and happens on the FIRST deviation, not retroactively; if no `<ds>-bypass-log.md` exists at end-of-bootstrap AND any of {visual-sanity skip, font substitution, `--quick`} occurred, that is itself a reconciliation failure." (b) **Asset-path format (D-4)** — reconcile the RELATIVE-URL SAFETY block in SUB-AGENT-PROMPTS.md (line 29) with the retro: the absolute form the canvas-shell actually serves; verify whether it is `/assets/<ds>/…` (current text) or `/.design/system/<ds>/assets/…` (retro prevention) by checking the dev-server static mount, and make the block state the ONE correct form unambiguously. (c) **Token-role separation (D-5)** — add a generic rule: decorative/background tokens (e.g. a mesh/gradient backdrop family) are single-role; specimens demonstrating tints use `--accent-muted`/surface tokens, never the backdrop family — no dual-purpose tokens.
- **Pattern**: existing Spec-bypass discipline (118) + RELATIVE-URL SAFETY (SUB-AGENT-PROMPTS 25–30).
- **Gotcha**: (b) requires VERIFYING the real mount before writing — do not guess the path. Check `plugins/design/dev-server/server.mjs` (or the Bun static-serve route) for how `system/<ds>/assets/` is exposed. The two candidate forms must be resolved to one truth, otherwise this fix re-introduces the bug it's meant to kill.
- **Validate**: `grep -nE "non-optional|first deviation|single-role|dual-purpose" SKILL.md`; for (b) confirm the asset path against the dev-server route before finalizing.

### Task 11: UPDATE CLAUDE.md design-plugin section (conditional)

- **Do**: Only if Task 4's DDR lands or the reconciliation/fan-out rules constitute a convention worth surfacing repo-wide: add a one-line pointer in CLAUDE.md "Design plugin" section to the new aspiration bar + per-platform-showcase reconciliation rule. Otherwise skip — these live in the plugin spec, not repo conventions.
- **Pattern**: existing "Pattern priors come first" / "Templates carry no visual priors" callouts in CLAUDE.md.
- **Gotcha**: don't duplicate spec into CLAUDE.md — a pointer at most. Per the retro's own "CLAUDE.md candidates: None proposed".
- **Validate**: manual read.

---

## Validation

This repo has **no test/lint/build for plugin markdown** (per CLAUDE.md). Validation is:

1. **Marker greps** — each task's `Validate` grep returns the expected new strings and the removed strings are gone.
2. **Sync rule (CI)** — `grep -c "SUB-AGENT-PROMPTS.md" plugins/design/skills/design-system/SKILL.md` ≥ 1 (the CI-enforced drift marker at SKILL.md:714 must survive any SKILL edits).
3. **Internal consistency** — no contradictory fan-out counts (`grep -n "5.\?8" SKILL.md` returns nothing in the fan-out context); aspiration thresholds consistent between matrix and print block.
4. **Asset-path truth check (Task 10b)** — the RELATIVE-URL SAFETY absolute form matches the actual dev-server static mount (verified against `server.mjs`/Bun route, not guessed).
5. **Manual smoke (end-to-end)** — run `/design:setup-ds smoke-ds` on a scratch repo with **mobile in scope (Q3)**, confirm: (a) roster contains a mobile showcase row, (b) reconciliation hard-fails if it's pending/absent, (c) fan-out dispatches ≤ 4 agents per wave, (d) a 3.5–3.8 aspiration score surfaces the "what would take this to wow" block instead of silent pass, (e) Kolo 2 runs without being skippable. This is the only true regression test for the user's three felt failures.
6. **Version parity** — not triggered (no version bump for spec-only edits) unless bundled into a release; if released, `scripts/check-version-parity.sh`.

---

## Acceptance Criteria

- [ ] Task 1: roster template + fanout emit a showcase+index per in-scope platform (mobile no longer omittable)
- [ ] Task 2: reconciliation runs on partial/failed batches and hard-fails on absent (not just pending) per-platform showcase
- [ ] Task 3: fan-out ceiling 3–4 with sequential waves; both 5–8 occurrences updated
- [ ] Task 4: aspiration silent-pass raised to ≥ 4.0; 3.0–4.0 middle band surfaces specific "to wow" lifts; Kolo 2 non-skippable in bootstrap; DDR recorded if warranted
- [ ] Task 5: restraint-default type ladder in Batch A + sub-agent type slice
- [ ] Task 6: research type-fidelity rule (display-face role preserved across substitution)
- [ ] Task 7: showcase-from-real-app rule (read AppLayout first for existing products)
- [ ] Task 8: edit.md touches paired `.tsx` after sibling `.css`
- [ ] Task 9: edit.md matchMedia-first motion pre-flight
- [ ] Task 10: bypass-log enforcement + asset-path format resolved to one verified truth + token-role separation
- [ ] Task 11: CLAUDE.md pointer added only if DDR/convention warrants it
- [ ] All marker greps pass; SUB-AGENT-PROMPTS.md sync marker survives; no contradictory fan-out counts
- [ ] Manual `/design:setup-ds` smoke with mobile in scope confirms the three felt failures are closed
- [ ] No DDR-worthy decision left unrecorded (aspiration bar change is the candidate)
