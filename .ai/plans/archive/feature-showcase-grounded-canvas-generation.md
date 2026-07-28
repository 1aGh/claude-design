# Feature: Showcase-grounded canvas generation (`/design:new` + `/design:edit` reuse platform showcase layouts)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. **This is a design-plugin spec (markdown) change — no runtime code, no tests, no build step.** The plugin commands/skills/agents are pure markdown executed by Claude Code; the "implementation" is editing those instruction files so the orchestrator behaves differently.

## Description

Make `/design:new` and `/design:edit` adhere more strictly to the **selected design system's specimens** — specifically the platform **showcase layouts** (`ui_kits-<platform>-showcase.tsx`, the "DS in use" full product mock). Today, when the orchestrator scaffolds or extends a feature canvas, it re-derives the product shell (where nav / sidebar / main / status bar go) from scratch even though the DS already ships a canonical layout skeleton for that platform. The user wants new functionality to **slot into the established mobile/desktop showcase shell** instead of being re-invented, and the design skills to **always** consult reusable components AND showcases before inventing layout.

## User Story

As a designer iterating in the Maude design plugin, I want `/design:new` and `/design:edit` to ground every new feature canvas in my DS's existing mobile/desktop **showcase layout**, so that placement ("kde to bude") and chrome reuse the system I already established instead of being reinvented per canvas.

## Problem

The DS scaffold produces the highest-leverage artifact — `ui_kits-<platform>-showcase.tsx` ("Full product mock — multi-screen composition (nav + sidebar + main content + status bar)", per `_MAPPING.md` line 106) — but **nothing on the consuming side reads it**:

- **`/design:new` step 5a** (pattern-priors collection, `new.md:468`) globs **only** `preview/components-*.tsx`. It explicitly excludes `ui_kits-*-showcase.tsx` / `ui_kits-*-index.tsx`, so the layout skeleton never enters the envelope.
- **`/design:new` step 5b** (envelope `## Pattern priors` heredoc, `new.md:503-517`) has subsections for *existing canvases* and *preview components* but **no platform-showcase subsection** and **no directive** to adopt the showcase's spatial shell.
- **design skill "Generation envelope"** (`SKILL.md:797-838`) references `{designRoot}/ui/` "existing canvases as reference" and a "wrapper pattern" — but the *wrapper* means `DesignCanvas`/`DCArtboard`, not the **product shell**. The platform showcase is never named.
- **`/design:edit` step 1.5** (`edit.md:66-154`) pre-loads `_components.css` + `colors_and_type.css` + canvas-lib, but **not** the platform showcase TSX — so an edit that *adds* a surface ("add a settings panel") has no view of the shell to place it consistently.
- **`design-system-keeper`** audits per-**class** reinvention (`.dc-card` re-derived as `.pcard`) but has **no layout/shell reuse check** — re-inventing the entire product shell instead of reusing the showcase passes silently.

Confirmed by grep: `ui_kit`/`showcase` appears **zero** times in `new.md`, `edit.md`, the design `SKILL.md` generation path, and `design-system-keeper.md` (one incidental example in `edit.md:270`).

## Solution

Wire the platform showcase in as a **first-class, highest-priority prior** on both the generate (`/design:new`) and extend (`/design:edit`) paths, plus a generation directive that tells `frontend-design` to **adopt the showcase's spatial shell** for full-screen surfaces (reinvent only with a one-line justification). Add a lightweight shell-reuse note to `design-system-keeper` so divergence is *visible* (warning, not blocker). Update the CLAUDE.md "Pattern priors come first" rule and record a DDR.

Design principle preserved: **priors are reference, not prescription** (envelope discipline, `SKILL.md:840-860`). Showcase grounding raises the *default* to "lift the shell" but stays a creative brief, not a wireframe lock — the generator still owns element-level decisions and the signature moment.

### Platform → showcase resolution rule (canonical, used by every task)

Canvas platform is resolved per-canvas as today (`new.md` step 4: `--mobile` flag / name contains `Mobile`/`iOS`/`Android`; `edit.md` reads `.meta.json.platform`). Map to the showcase file in `<DS_ROOT>/preview/`:

| Canvas platform | Primary showcase | Fallback chain |
|---|---|---|
| `desktop` | `ui_kits-desktop-showcase.tsx` | → any `ui_kits-*-showcase.tsx` present → skip-with-note |
| `mobile` | `ui_kits-mobile-showcase.tsx` | → `ui_kits-desktop-showcase.tsx` (shell reference only) → skip-with-note |
| `tablet` | `ui_kits-mobile-showcase.tsx` (per `_MAPPING.md:97` tablet rides the mobile family) | → `ui_kits-desktop-showcase.tsx` → skip-with-note |

- **Absent-showcase case is graceful, never fatal.** A DS scaffolded desktop-only (like this repo's `maude` + `project` DSes — no `ui_kits-mobile-showcase` exists) means a mobile canvas falls back to the desktop showcase *as a general chrome/material reference* with an explicit note, or skips the showcase subsection entirely if no showcase exists at all. Surface the resolution in the envelope footer + final print so the user sees why grounding did or didn't apply.
- Also collect `ui_kits-<platform>-index.tsx` (the catalog/launcher) as a **secondary** prior — useful for "what surfaces does this platform already ship", lower priority than the showcase.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel in a single message (independent context loads).

- `plugins/design/commands/new.md` (steps 4, 5, 5a, 5b, 9.5, 12) — pattern-priors collection + envelope heredoc + keeper spawn + print. The primary edit target.
- `plugins/design/commands/edit.md` (steps 1.5, 7.5, 8b) — DS-context pre-load + keeper precheck. Secondary edit target.
- `plugins/design/skills/design/SKILL.md` (lines 797-870: "Generation envelope", "Aspiration directives", "Envelope discipline") — the shared envelope spec both commands defer to.
- `plugins/design/agents/design-system-keeper.md` (Pass A, Pass A.5, Severity rules) — where the optional shell-reuse pass slots in.
- `plugins/design/templates/design-system-inspiration/_MAPPING.md` (lines 92-114) — the authoritative description of what `ui_kits-<platform>-{index,showcase}` are and the platform gating. Read for vocabulary fidelity; **do not edit** (templates are bias-free per DDR-043 and this change is consumer-side).
- `plugins/design/skills/design-system/SKILL.md` (Post-scaffold gate / per-in-scope-platform showcase set) — confirm the producer-side invariant so the consumer-side names match.
- `CLAUDE.md` (line 136, "Pattern priors come first") — rule to extend.

### Files to Create

- `.ai/archive/decisions/DDR-127-showcase-grounded-canvas-generation.md` — records the decision (showcase as first-class prior + platform-resolution rule + reference-not-prescription stance). Next free number after DDR-105.

### Design canvases

> The `.design/` showcases ARE the subject of this change — they're the layout skeletons being wired in, not mockups of the change itself. Reference for shape/vocabulary:

| Canvas | Status | Role | Notes |
| ------ | ------ | ---- | ----- |
| `.design/system/maude/preview/ui_kits-desktop-showcase.tsx` | shipped specimen | "THE SIGNATURE 'DS in use' artifact" (header comment) | Desktop full-bleed shell: toolbar + layers tree + dotted canvas + inspector + status bar. The canonical placement skeleton a new maude-DS desktop canvas should adopt. |
| `.design/system/maude/preview/ui_kits-desktop-index.tsx` | shipped specimen | Catalog/launcher | Secondary prior. |
| `.design/system/project/preview/ui_kits-desktop-{showcase,index}.tsx` | shipped specimen | Same roles for `project` DS | Confirms the naming is stable across DSes. |

### Documentation

- `_MAPPING.md` §"Always-on (ui_kit — the 'DS in use' artifacts)" — the producer contract this consumer-side change pairs with. Keep the two descriptions consistent.

### Patterns to Follow

The existing **pattern-priors collection** (`new.md:442-477`) is the exact idiom to extend — same `find`/`ls` + `jq` shape, same "interpolate verbatim into the envelope heredoc" pattern. The new showcase block mirrors the existing `PREVIEW_LIST` loop but globs `ui_kits-*` and tiers the output:

```bash
# EXISTING idiom (new.md step 5a) — extend, don't replace:
PRIOR_PREVIEW=$(ls "$DS_ROOT/preview/components-"*.tsx 2>/dev/null)   # components only — the gap

# NEW (this change) — platform-matched showcase, resolved per the table above:
PLATFORM_SHOWCASE=$(ls "$DS_ROOT/preview/ui_kits-${PLATFORM}-showcase.tsx" 2>/dev/null)
[ -z "$PLATFORM_SHOWCASE" ] && PLATFORM_SHOWCASE=$(ls "$DS_ROOT/preview/ui_kits-"*-showcase.tsx 2>/dev/null | head -1)  # fallback
```

The `edit.md` step 1.5 pre-load idiom (resolve abs path → note "→ pre-loading …" → orchestrator `Read`s it) is the pattern for loading the showcase on the edit path.

---

## Design Decisions

### Specimens reused (the whole point)

| Specimen | Source | Notes |
| --- | --- | --- |
| `ui_kits-<platform>-showcase.tsx` | `<DS_ROOT>/preview/` | **Primary placement skeleton.** New top tier of pattern priors. |
| `ui_kits-<platform>-index.tsx` | `<DS_ROOT>/preview/` | Secondary prior (surface catalog). |
| `components-*.tsx` | `<DS_ROOT>/preview/` | Existing component-level priors — unchanged, still collected. |
| existing `ui/*.tsx` canvases | `<DESIGN_ROOT>/<newCanvasDir>/` | Existing canvas priors — unchanged. |

### Priors tiering (new mental model)

1. **Tier 0 — Platform showcase shell** (new): "where things go" — adopt the spatial skeleton.
2. **Tier 1 — Existing same-DS canvases** (existing): real product surfaces to mirror.
3. **Tier 2 — Component specimens** (existing): `components-*` shapes to lift.

The envelope's `## Pattern priors` section gets a new **first** subsection (`### Platform showcase layout — the canonical shell`) above the existing two, with the grounding directive attached.

### Custom logic needed

| Logic | Reason | Notes |
| --- | --- | --- |
| Platform→showcase resolver + fallback chain | No `platforms` field in `config.json`; platform is per-canvas | Pure shell (`ls` + the resolution table). Lives in `new.md` step 5a and `edit.md` step 1.5. |
| Shell-reuse note in keeper | Make layout divergence visible (warning, not blocker) | Stretch task — see Task 5 risk note. |

---

## Tasks

Execute in order. Tasks 1–4 are the core ask; Task 5 is a stretch; Tasks 6–7 are coherence/record-keeping.

### Task 1: ADD platform→showcase resolution + collection to `/design:new` step 5a

- **Do**: In `plugins/design/commands/new.md` step 5a (the pattern-priors collection block, ~line 442-477), add showcase resolution. Resolve `$PLATFORM` (already computed in step 4 as mobile|desktop; map tablet→mobile). Glob `$DS_ROOT/preview/ui_kits-${PLATFORM}-showcase.tsx` with the fallback chain from the resolution table. Also collect `ui_kits-${PLATFORM}-index.tsx` as secondary. Build a `SHOWCASE_BLOCK` string: the resolved showcase path + its `.meta.json` subtitle (or the header `SPECIMEN:` comment line if no meta — the maude showcases have **no** `.meta.json`, so fall back to grepping the `* SPECIMEN:` / `* COMPOSITION:` header lines), plus the index path. Record the resolution outcome (`matched <platform>` | `fell back to <other> as shell reference` | `none — DS ships no showcase`) for the print step.
- **Pattern**: Mirror the existing `PRIOR_PREVIEW` / `PREVIEW_LIST` loop immediately above; same `jq -r '.subtitle'` with header-comment fallback.
- **Gotcha**: maude/project showcases have **no `.meta.json` sidecar** (verified — `cat ...ui_kits-desktop-showcase.meta.json` returns empty). The role must come from the `/** SPECIMEN: ... */` header block, not a meta read. Don't assume a sidecar exists.
- **Gotcha**: `$PLATFORM` may be unset if step 4 didn't run for the mode in play — guard with `${PLATFORM:-desktop}` (desktop is the documented default).
- **Validate**: Re-read the edited block; confirm the fallback chain matches the resolution table and the no-showcase path emits a note rather than erroring.

### Task 2: ADD `### Platform showcase layout` subsection + grounding directive to the envelope heredoc (`/design:new` step 5b)

- **Do**: In `new.md` step 5b (`000-envelope.md` heredoc, ~line 503-517), insert a new subsection **above** "Existing canvases" inside `## Pattern priors`:
  ```
  ### Platform showcase layout — the canonical shell (adopt this skeleton)
  <SHOWCASE_BLOCK: path · role-from-header · index path>
  This specimen is the DS's authoritative <platform> product shell — the established
  arrangement of chrome (nav / sidebar / toolbar / main / status). For any full-screen
  surface in this canvas, ADOPT its spatial skeleton and chrome material: same region
  placement, same shell framing. Do NOT re-derive a new product shell. Reinventing the
  shell is the exception — leave a one-line JSX comment explaining what this surface needs
  that the showcase shell couldn't give. (If the line above reads "none — DS ships no
  showcase", there is no shell prior; compose freely from the DS readme + component priors.)
  ```
  Also extend the envelope's `## Constraints` block with a `- platform_showcase: <path or "none">` line so the generation prompt carries the resolved reference path.
- **Pattern**: The existing `### Existing canvases` / `### Existing preview components` subsections directly below — same heredoc interpolation style.
- **Gotcha**: Keep envelope discipline (`SKILL.md:840`) — this is a *directive to adopt a reference*, not a wireframe. Do **not** enumerate the showcase's regions as a required checklist; point at the file and say "adopt the skeleton". Over-listing regions would re-introduce the over-prescription the envelope test forbids (~30-50 line target).
- **Validate**: Confirm the new subsection is reference-framed, the heredoc still closes cleanly (`EOF`), and the "first canvas / no priors" note still reads correctly when both showcase and component lists are empty.

### Task 3: UPDATE design skill "Generation envelope" to name the platform showcase (`design/SKILL.md`)

- **Do**: In `plugins/design/skills/design/SKILL.md` "Generation envelope" (line ~811, "Reference layouts (read at least one for the wrapper pattern)"), distinguish **wrapper pattern** (canvas-lib `DesignCanvas`/`DCArtboard`) from **product shell** (the platform showcase). Add a line: "Product shell — for any full-screen surface, adopt the spatial skeleton of `{designRoot}/system/{ds}/preview/ui_kits-{platform}-showcase.tsx` (the DS's canonical 'DS in use' layout). Reinvent the shell only with a one-line justification." Add a matching bullet to "Envelope discipline → DO" ("Reference the platform showcase as the shell skeleton when the brief is a full-screen surface").
- **Pattern**: The numbered envelope contract (items 1-8) + aspiration directives (9-15) — match the existing voice; this is a reference directive, not a new aspiration axis (don't renumber the signature-moment axes).
- **Gotcha**: This skill is the *shared* spec both `/design:new` and `/design:edit` defer to — keep it platform-token-generic (`{platform}`, `{ds}`), not hardcoded to desktop.
- **Validate**: Grep the file for the new `ui_kits` reference; confirm it reads as reference-not-prescription and doesn't contradict "Envelope discipline → DON'T".

### Task 4: ADD platform-showcase pre-load to `/design:edit` step 1.5 (structural/add-surface edits)

- **Do**: In `plugins/design/commands/edit.md` step 1.5, extend the DS-context pre-load to also resolve + `Read` the platform showcase **when the edit adds a surface** — heuristic: feedback matches add/new-surface verbs (`add`, `new`, `přidej`, `nová obrazovka/sekce/panel/stránka/screen/section/panel/page/view/layout`) OR the AST fast-path did NOT fire (structural change) OR a new artboard is implied. Resolve via the same platform→showcase table (platform from `.meta.json.designSystem`-sibling `.meta.json.platform`). Add a `→ pre-loading platform showcase: <path>` note and feed it to `frontend-design` as the placement reference. Skip the load for surgical single-attribute edits (AST fast-path, step 3a) — those don't place new surfaces.
- **Pattern**: The existing `_components.css` / canvas-lib pre-load idiom in the same step (resolve abs path → echo "→ pre-loading …" → orchestrator `Read`s).
- **Gotcha**: Don't bloat token-cheap edits. The showcase TSX is large (the maude one is a full shell) — gate the load behind the add-surface heuristic, not every edit. A class-tweak or copy edit must NOT trigger it.
- **Gotcha**: Reuse the step-1.5 DS-context cache key scheme if practical, but the showcase is a distinct file — fold its sha into the existing `TOKENS_SHA` only if it's loaded unconditionally; since it's conditional, a separate cheap `Read` is fine.
- **Validate**: Trace the heuristic against three feedback samples — "add a settings panel" (loads), "make this button ghost" (skips, AST path), "tighter row density" (skips, cosmetic). Confirm each routes correctly.

### Task 5 (stretch): ADD Pass A.6 shell-reuse note to `design-system-keeper`

- **Do**: In `plugins/design/agents/design-system-keeper.md`, add a **Pass A.6 — Product-shell reuse** between Pass A.5 and Pass B. When the candidate canvas declares a top-level product shell (≥ 2 of: a nav/toolbar region, a sidebar/layers region, a main/content region, a status-bar region — detect via `data-dc-element` region tags or shell-grade class roots) AND a platform showcase exists in `preview_components_root`, grep the showcase's shell class roots and surface an **info/warning** when the candidate's shell roots don't overlap (re-invented the shell). Keep it a **warning** (not blocker) — promotion only on the existing stacked-reinvention thresholds. Pass the resolved showcase path as a new optional input (`platform_showcase_path`) from `new.md` step 9.5 + `edit.md` step 7.5 keeper-spawn prompts.
- **Pattern**: Pass A.5 (motion-reinvention) is the exact severity/format template — one warning per divergence, fenced-JSON verdict unchanged (add `top_warnings[].category = "shell-reinvention"`).
- **Gotcha**: This is the **higher-risk** task — shell detection is fuzzier than per-class matching and a false-positive "you re-invented the shell" warning is annoying. Keep the trigger conservative (require ≥ 2 shell regions present) and the output **info-by-default**. If detection proves noisy in review, ship Tasks 1-4 + 6-7 and defer this. **Recommend gating this task on the user confirming they want keeper enforcement vs. priors-only grounding.**
- **Validate**: Run the keeper (manually, via its documented spawn) against a maude-DS canvas that reuses the showcase shell (should be silent) vs. one that invents a parallel shell (should warn once). Confirm zero false-positives on non-shell canvases (a single-artboard component canvas).

### Task 6: UPDATE CLAUDE.md "Pattern priors come first" rule

- **Do**: Extend the rule (line 136) to name showcases explicitly: priors now include the **platform showcase layout** for *placement/shell*, not just "preview library for similar shapes" for components. One sentence: "When the canvas is a full-screen surface, the platform showcase (`ui_kits-<platform>-showcase`) is the canonical shell prior — adopt its layout skeleton before inventing chrome." Keep it a pointer; the authoritative spec is the plugin docs.
- **Pattern**: The existing rule's voice (lifting is default, reinventing needs a one-line comment).
- **Gotcha**: Don't duplicate the full spec into CLAUDE.md — it's a context-loaded summary; the plugin markdown is authoritative.
- **Validate**: Re-read line 136; confirm it now covers shell/placement, not only compositional elements.

### Task 7: RECORD DDR-127

- **Do**: Write `.ai/archive/decisions/DDR-127-showcase-grounded-canvas-generation.md` capturing: the gap (showcases produced but never consumed), the decision (showcase as Tier-0 prior + platform-resolution rule + reference-not-prescription stance + warning-not-blocker keeper), alternatives considered (hard-blocking shell reuse — rejected as over-prescriptive; a `platforms` config field — rejected, platform stays per-canvas), and the link to DDR-010 (design-system-keeper) + DDR-043 (bias-free templates, unaffected since this is consumer-side).
- **Pattern**: An existing recent DDR (e.g. DDR-105) for structure.
- **Validate**: DDR number is unique (DDR-105 is current max); cross-links resolve.

---

## Validation

> No test suite / lint / build exists in this repo (CLAUDE.md: "There is **no test suite, lint config, or build step**"). Validation is spec-coherence + the one guardrail test + a live dogffood.

1. **Plugin-reachability guard**: `node cli/lib/plugin-cli-reachability.test.mjs` — confirms no edit introduced a banned direct `bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/*.sh"` invocation (this change adds none, but run it since `new.md`/`edit.md` were touched).
2. **Naming-convention sanity**: confirm no `name:` frontmatter changed (this change edits bodies only — `design:new`, `design:edit`, `design:design-system-keeper` slugs unchanged).
3. **Heredoc integrity**: grep the edited `new.md` step 5b block for balanced `EOF`/`REPORT` fences; a broken heredoc silently corrupts the envelope artifact.
4. **Dogfood — generate** (live, against this repo's `.design/`): run `/design:new "Showcase Reuse Probe" "single desktop artboard exercising the maude studio shell" --quick` and confirm the written `_history/<slug>/000-envelope.md` contains the new `### Platform showcase layout` subsection pointing at `ui_kits-desktop-showcase.tsx`. (`--quick` keeps cost ~30k tokens.)
5. **Dogfood — edit** (live): on an active canvas, run `/design:edit "add a settings panel to the right of the canvas"` and confirm the orchestrator's pre-load step logs `→ pre-loading platform showcase: …ui_kits-desktop-showcase.tsx` and the placed panel reuses the showcase's inspector/sidebar chrome rather than a new shell.
6. **Fallback path**: confirm a `--mobile` canvas in this repo (which has **no** `ui_kits-mobile-showcase`) emits the "fell back to desktop showcase as shell reference" note in both the envelope footer and the final print — not an error, not silence.
7. **Manual read-through**: verify the four spec edits stay within envelope-discipline (the envelope still reads as a brief, not a wireframe; ~30-50 line target preserved).

---

## Scenario Coverage

> N/A — this feature edits **plugin instruction markdown**, not app UI. There are no routes/screens to run cross-platform scenarios against. The `scenario-runner` / `design-system-guard` / `a11y-auditor` subagents have no UI surface to inspect here. The behavioral verification is the two live dogfood runs (Validation 4-6), which exercise the changed orchestrator behavior end-to-end against this repo's real `.design/` DSes.

---

## Acceptance Criteria

- [x] Tasks 1-4 + 6-7 completed (Task 5 completed — conservative, info-by-default).
- [x] `/design:new` collects the platform showcase as a Tier-0 prior and the envelope artifact carries the `### Platform showcase layout` subsection + grounding directive.
- [x] `/design:edit` pre-loads the platform showcase for add-surface edits and skips it for cosmetic/AST-path edits.
- [ ] Platform→showcase resolution + graceful fallback (desktop-only DS, no-showcase DS) verified live (Validation 4-6). _← deferred to a user dogfood run; static path-resolution logic verified via `bash -n` only._
- [x] `design/SKILL.md` "Generation envelope" + "Envelope discipline" name the showcase as the shell prior, reference-framed.
- [x] CLAUDE.md "Pattern priors come first" covers shell/placement, not only components.
- [x] DDR-127 recorded; cross-links to DDR-010 / DDR-043 / DDR-061 resolve.
- [x] `node cli/lib/plugin-cli-reachability.test.mjs` passes; no `name:` frontmatter changed; heredoc fences balanced.
- [x] Every new directive stays within envelope discipline (no wireframe-spec regression).
- [x] No edits to `plugins/design/templates/**` (consumer-side change only; templates stay bias-free per DDR-043).

---

## Retro

- **What worked:** the gap was nailed before any edit — a grep proving `ui_kit`/`showcase` appeared **0×** in the four consuming files turned a vague "be stricter" ask into a surgical, bounded change. The "reference, not a wireframe" framing let the showcase become a strong default without re-introducing the over-prescription the envelope discipline forbids.
- **Surprise:** the platform showcases carry **no `.meta.json` sidecar** (unlike `components-*.tsx`) — the role had to be read from the `/** SPECIMEN: */` header comment. Easy to have assumed a sidecar and shipped a silently-empty role line. Caught because Task 1's gotcha was written from a real `cat …meta.json` check, not an assumption.
- **Recurring class — "produced but never consumed":** the DS bootstrap hard-fails on a missing per-platform showcase (producer enforced) yet nothing on the generate/edit side ever read it. When a producer is made to emit an artifact, `/plan` should add a consumer-side check that *something reads it* — the asymmetry hid the highest-leverage specimen for many releases.
- **Pre-existing cleanup surfaced (not fixed here):** `_MAPPING.md` lines 18-19 still name the showcases `.html` (predates the TSX migration). Out of scope for this consumer-side change; left as a one-line doc follow-up so the diff stays clean.
- **Verification gap (carried):** live dogfood (plan Validation 4-6) deferred — the platform→showcase resolution + fallback is `bash -n` clean but unproven against a running dev-server. The one Acceptance criterion left unchecked. Worth a single `/design:new` + `/design:edit` run next time the server is up.
- **Process note:** `/flow:done` ran on a markdown-only plugin-spec change — the security fan-out + code-simplifier + 5-platform scenario were correctly scoped out as N/A; a single focused diff reviewer (PASS) substituted for the security pair. Good template for "spec-only" closes.
