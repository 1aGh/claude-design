# Feature: setup-ds — moodboard direction gate + Batch-A hero preview (fail-fast on direction)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This plan changes the **design-plugin bootstrap spec** (markdown skill + command docs + research-agent contract), not an app feature — adapt the flow template's UI-centric sections accordingly.

## Description

`/design:setup-ds` invests **~30–40 min and ~15,000 LOC** of scaffold + a full critic panel **before the user sees a single pixel**. The StudyFi-v2 bootstrap (see source report below) generated a complete DS, passed the panel at **signature-moment 4.4/5**, and was then deleted in full — *"smaž úplně, to se mi vůbec nelíbí."* The loop's only direction checkpoint before that point was a **prose-only 3-sentence Confirm**. Aesthetic rejection is invisible to a prose echo and to structural critics; the user only discovered it after the whole investment.

This feature adds **two visual fail-fast gates** so the user approves the *direction* cheaply, before the expensive generation:

1. **Stage 4 — Design-language moodboard (direction gate).** After research + refinement (Stage 3) and the prose Confirm, the main agent assembles **one throwaway single-artboard canvas** — palette swatches, type pairing, the signature-treatment hero, a voice sample, domain nouns, and reference imagery surfaced by `ux-research-agent` (incl. images from the web). It screenshots it, reads it, and gates on user approval **before any token/specimen generation**. ~1–3 min vs 30–40 min. On approval the moodboard becomes the **locked direction contract** for the scaffold.
2. **Batch-A hero preview (token-fidelity gate).** Batch A already writes `colors_and_type.css` + `_layout.css`; it now also writes **one signature specimen**, screenshots it, and verifies the *real computed tokens* honored the approved moodboard **before** the costly Batch B+C fan-out. Lighter than the moodboard gate — it's a drift check ("did burnt-orange render as candy pumpkin?"), auto-screenshotted and only hard-prompting on divergence.

Plus a small **process-discipline** slice (autonomous-mode critic-coverage default; organic-seed skip logging; moodboard as a loggable deviation) so the autonomous path doesn't silently bypass these gates.

## User Story

As a **person bootstrapping a design system**, I want to **approve the visual direction in ~2 minutes before the long generation runs**, so that **I don't wait 30–40 minutes only to throw away a DS whose direction I never liked** — and so that the loop catches "hezké ale ne wow" *before* it spends the fan-out, not after.

## Problem

- First pixels appear only **after** the full scaffold (Batch A+B+C) → a direction the user dislikes costs the entire ~15k-LOC investment to discover.
- The pre-scaffold Confirm is **prose-only** — it cannot expose an aesthetic-direction mismatch.
- A 4.4/5 critic pass coexisted with a total user rejection → the critic panel measures *absence-of-badness + portfolio-worthiness*, not *this specific user's taste on this specific direction*. There is no cheap human-taste checkpoint.
- Under autonomous "pokracuj", coverage/seed `AskUserQuestion`s defaulted silently — the new gates must define an explicit, logged autonomous behavior or they'll be skipped the same way.

## Solution

Insert two visual gates into the bootstrap flow and wire the research agent to feed the moodboard:

```
Stage 0 scope → Stage 1 vision → Stage 2 research → Stage 3 refinement → Confirm (prose)
  → ★ Stage 4 — MOODBOARD (single-artboard canvas, web imagery) → screenshot → "Sedí ti tenhle design language?"
        ├ Jdeme do toho → lock moodboard as direction contract ↓
        ├ Uprav <co>    → cheap iterate on the moodboard only → re-screenshot → re-gate
        └ Začni jinak / Stop → bail / return to Stage 3 — BEFORE any token or specimen generation
  → Mapping → roster → Batch A (tokens + chrome + 1 hero specimen)
        → ★ HERO PREVIEW → screenshot → drift-check vs approved moodboard
              ├ honors moodboard → proceed
              └ drift detected   → surface + quick confirm before fan-out
  → Batch B+C fan-out (~15k LOC) → reconcile → assets → completeness → [draw] → visual sanity → 4-kola panel
```

The moodboard is the **headline direction lock**; the hero preview is a **secondary token-fidelity net** (the user opted into both — Q1 free-text + Q2). The moodboard supersedes the prose Confirm as the real direction approval; the prose Confirm stays as a cheap text echo that *leads into* the moodboard.

## Metadata

- **Ticket**: none (internal plugin improvement; dogfooded `.ai/`).
- **Type**: Enhancement (new bootstrap-flow stage + mid-scaffold gate).
- **Complexity**: Medium–High — spec change across 3 docs + research-agent contract + a new DDR; new UX stage; touches the most load-bearing design-plugin flow. **No app code, no required new dev-server binary** (reuses the existing canvas + `maude design screenshot` pipeline).
- **App/Package**: `plugins/design` (skill `design-system` + command `setup-ds` + agent `ux-research-agent`).
- **Affected Systems**: bootstrap discovery flow, scaffold sequencing, research payload schema, bypass-log discipline.
- **Dependencies**: existing `maude design screenshot` / `server-up` / dev-server canvas-render pipeline (no new dep). `ux-research-agent` WebSearch/WebFetch (already present).

---

## Context References

### Must-Read Files

> Read all of these in parallel at `/flow:execute` step 0.

- `plugins/design/skills/design-system/_bootstrap.md` — **the canonical bootstrap flow**; both gates land here. Key anchors: "Discovery (Round 0…confirm)" → `#### Confirm`, "### Mapping → file set", "#### Batch A — main agent writes serially", "### Seed organic artifacts (opt-in) → draw-agent", "### 4 kola značky — critic panel" (autonomous coverage default).
- `plugins/design/skills/design-system/SKILL.md` (lines 1–113) — router; mode-detection + flow summary. Update the BOOTSTRAP one-liner if the stage list changes.
- `plugins/design/commands/setup-ds.md` (lines 86–105) — "Step 3 — Skill runs its discovery + scaffold" numbered list; add the two gates to the user-facing flow summary.
- `plugins/design/agents/ux-research-agent.md` (lines 143–210, esp. 158, 193–198) — `discovery` payload; `reference_products[]` already carries `url` + `source_url_for_screenshots`. Extend for moodboard imagery.
- `plugins/design/dev-server/bin/screenshot.sh` (header/usage) + `server-up.sh` (boot contract) — the reused screenshot pipeline; confirm `--url` + `_canvas-shell.html?canvas=<rel>` path for a throwaway canvas.
- `plugins/design/skills/design-system/_bootstrap.md` "Spec-bypass discipline" block (lines 9–30) — the bypass-log contract the autonomous-mode rules must route through.

### Source report (the why)

- `/Users/iagh/git/worktrees/AI-StudyMate/fresh-turtle/AI-StudyMate/.ai/logs/execution-reports/new-studyfi-v2-design-system.md` — full revert despite 4.4/5; the originating evidence. Status: REVERTED.

### Files to Create

- `.ai/decisions/DDR-0XX-moodboard-direction-gate.md` — record the new pre-scaffold visual direction gate (verify next free number at record time; DDR-075 + DDR-077 are taken).
- *(No new helper script required for v1)* — the moodboard reuses the existing canvas-render + `maude design screenshot` pipeline. Only add a helper if execution proves the assembly recipe is duplicated across commands.

### Patterns to Follow

- **Throwaway canvas precedent:** `draw-proof.sh` writes a disposable proof canvas under `<designRoot>/_draw/<slug>.proof.tsx`, screenshots every artboard, prints the dir. Mirror this for the moodboard: write under `<designRoot>/_moodboard/<ds>-moodboard.tsx`, screenshot, Read into context. (See CLAUDE.md "Dev-server helpers" table → `draw-proof.sh`.)
- **Visual-sanity exit-code → recovery mapping** (`_bootstrap.md` "Handle helper exit codes" table) — the moodboard gate reuses the same "boot failed → AskUserQuestion, never silently elide" discipline.
- **AskUserQuestion availability fallback** (`_bootstrap.md` "Tool-availability check", lines 71–106) — the moodboard gate MUST honor the numbered-prose fallback when AskUserQuestion is unavailable.
- **Spec-bypass discipline** (`_bootstrap.md` lines 9–30) — every deviation (moodboard skip, hero-preview override, autonomous coverage default) writes a `<ds>-bypass-log.md` row at the moment of deviation.

---

## Design Decisions

> This is a flow/spec change, not an app-UI feature — the registry/icons/token tables below don't apply. The "decisions" here are the moodboard's shape and the gate semantics.

### Moodboard canvas — shape & contents

| Concern | Decision |
| --- | --- |
| **Location** | `<designRoot>/_moodboard/<ds>-moodboard.tsx` (new `_moodboard/` throwaway dir, mirrors `_draw/`). On approval, optionally retain a screenshot under `_history/_system/<ds>-moodboard-<ISO>.png`; the `.tsx` is disposable. |
| **Authoring** | **Main agent only, single artboard, NO fan-out.** Assembled purely from already-computed discovery + research payload — no new generation. Target < 3 min wall-clock. |
| **Contents** | (a) Proposed palette as OKLCH swatches (from `recommendations.palette` / `palette_options[]`), with the accent-in-context hero; (b) type pairing specimen (display + body + mono, real fonts); (c) the signature-treatment hero composition (Q9 treatment applied to one representative card/section); (d) a 1–2 line voice sample in the proposed tone, using real `domain_nouns`; (e) **reference imagery from the web** (see research-agent task) as a small mood collage. |
| **Reference images** | Embed `reference_images[]` (direct image URLs) as `<img>`; fall back to a labeled color/treatment block + the anchor name when an image fails to load (throwaway canvas → graceful degradation, never block on a broken hotlink). External-image reliability is an accepted risk (see Risks). |
| **Gate** | Screenshot via `maude design screenshot --url <_canvas-shell?canvas=_moodboard/...>`; **Read the PNG into context** (agent sees it); then `AskUserQuestion`: `Jdeme do toho` / `Uprav <co>` / `Začni jinak` / `Stop`. Numbered-prose fallback when AskUserQuestion unavailable. |
| **On "Jdeme do toho"** | Lock the moodboard's palette / type / treatment as the **direction contract**; Batch A consumes these verbatim (reduces the drift `_bootstrap.md` already warns about — burnt-orange-as-candy, restraint type ladder). |
| **On "Uprav"** | Iterate the **moodboard only** (swap a swatch / font / treatment), re-screenshot, re-gate. This is where taste gets dialed in for ~1 min instead of after 40 min. |
| **On "Začni jinak / Stop"** | Return to Stage 3 (refinement) or end — **before** roster/Batch A. Log the bail to the bypass-log. |
| **Gating conditions** | Interactive bootstrap only. **Skipped** in `maude design init --no-discovery` (no palette to ground — same gating as the draw organic-seed step). `--quick` defaults the gate to a single screenshot + auto-proceed but STILL surfaces the question (user can bail). |

### Hero-preview gate (post Batch-A)

| Concern | Decision |
| --- | --- |
| **What** | Batch A writes one `signature: true` specimen (default `colors-accent.tsx`; or the showcase hero) in addition to tokens + chrome. Screenshot it; agent compares against the approved moodboard. |
| **Relationship to moodboard** | Moodboard = *direction* approval (pre-token). Hero preview = *token-fidelity* check (post-token): "do the real computed tokens render what the moodboard promised?" Complementary, different fidelity. |
| **Gate weight** | **Light by default** — auto-screenshot + agent self-check. Hard-prompt (`Pokračovat / Uprav tokeny / Stop`) **only when the agent detects drift** from the approved moodboard (wrong hue lightness, treatment missing, type role inverted). No-drift → one-line "hero honors moodboard, pokračuju" + proceed to fan-out. Honors the Q2 selection ([y / upravit / stop]) without double-prompting after the moodboard already locked direction. |
| **Fail-fast value** | Catches token-substitution defects (the report's "burnt → candy", D-7 inverted type roles, D-8 melodramatic ladder) **before** the ~15k-LOC fan-out, when fixing is a token edit not a regen. |

### Autonomous-mode discipline (process slice)

| Gate | Autonomous default | Surfacing |
| --- | --- | --- |
| Moodboard direction gate | default **proceed** after screenshot **only if** the agent's own read finds no obvious mismatch with the brief; otherwise **stop and ask** | 1-line chat + bypass-log row. Never silently skip the screenshot+read. |
| Hero-preview gate | proceed on no-drift; ask on drift | bypass-log row on any drift override |
| Critic-panel coverage | default **Full 4 kola** (recommended) | bypass-log row (codifies the report's logged divergence #3 — autonomous "pokracuj" defaulted Full without firing the AskUserQuestion) |
| Organic-seed (`draw-agent`) | default **None** | 1-line chat + bypass-log row + the existing `recommend /design:draw "<brief>" --asset` next-step line (codifies report divergence "Skipped the draw-agent step") |

---

## Tasks

Execute in order. Each task is atomic and verifiable by re-reading the edited spec for internal consistency + cross-reference integrity.

### Task 1: UPDATE `ux-research-agent.md` — surface `reference_images[]`

- **Do**: Extend the `discovery` payload schema with an optional `reference_images[]` array (objects: `{ url, alt, anchor, source_query }`) — direct image URLs (og:image / screenshot URLs harvested during the existing WebFetch pass over the top anchors). 3–6 entries. Keep existing `reference_products[].url` + `source_url_for_screenshots` as the textual/link fallback. Note the moodboard consumes these.
- **Pattern**: mirror the existing `reference_products[]` shape (lines 193–198) and the "source_query logged for transparency" convention.
- **Gotcha**: Don't mandate images — niche/non-English anchors may have none. `reference_images[]` is best-effort; the moodboard degrades gracefully. Don't add WebSearch calls solely for images — harvest from the WebFetch passes the agent already runs (line 157).
- **Validate**: re-read the schema block; the `recommendations`/anchor sections remain consistent; the breadth checklist is unchanged.

### Task 2: ADD Stage 4 (Moodboard direction gate) to `_bootstrap.md`

- **Do**: Insert a new section **after `#### Confirm` and before `### Mapping → file set`**: `#### Stage 4 — Design-language moodboard (direction gate)`. Spec: location (`_moodboard/<ds>-moodboard.tsx`), main-agent single-artboard assembly from discovery+research payload, the 5 content blocks (palette / type / treatment hero / voice sample / reference-image collage), screenshot-and-Read step (reuse `maude design screenshot`), the `AskUserQuestion` gate (Jdeme/Uprav/Začni jinak/Stop) + numbered-prose fallback, the "approved moodboard = direction contract for Batch A" lock, the iterate-on-Uprav loop, the bail-before-scaffold path, gating (interactive-only, skip on `--no-discovery`, `--quick` auto-proceed-but-still-ask).
- **Pattern**: Reuse the visual-sanity exit-code recovery table + the "Read each captured PNG" discipline (lines 941–950). Reuse the AskUserQuestion availability fallback shape (lines 71–106).
- **Gotcha**: The moodboard MUST be cheap — assembled, not generated (no sub-agent fan-out). It must NOT pollute `system/<ds>/` (lives in `_moodboard/`). Keep the prose Confirm; the moodboard *follows* it.
- **Validate**: re-read the discovery→scaffold sequence end-to-end; the "Sequencing" diagram (lines 797–804) and any flow summary reflect the new stage.

### Task 3: ADD the hero-preview gate to `_bootstrap.md` Batch A

- **Do**: In `#### Batch A — main agent writes serially`, add: after tokens + `_layout.css` (+ `_components.css`) are written and read back, write **one `signature: true` specimen** (default `colors-accent.tsx`), screenshot it, agent compares vs the approved moodboard, and gate the start of Batch B+C on it. Light-by-default semantics (auto-proceed on no-drift, hard-prompt on drift). Update the "Sequencing" diagram to show the gate between Batch A and Batch B+C.
- **Pattern**: same screenshot+Read discipline as visual sanity; the drift check leans on the accent-in-context rule already in "Accent color heuristic" (lines 435–443, "always screenshot the accent in context before declaring the color final").
- **Gotcha**: Don't double-prompt — after the moodboard locked direction, this is a *drift* gate, not a fresh approval. Writing the hero specimen in Batch A means the roster's `colors-accent` row is `written` earlier; reconcile logic must still see it (it's a Batch B row today — either move it to Batch A or mark it pre-written; pick the lower-churn option and note it in the roster section).
- **Validate**: roster reconciliation still asserts the full expected set; no row is double-counted or orphaned.

### Task 4: UPDATE autonomous-mode discipline in `_bootstrap.md`

- **Do**: In "Spec-bypass discipline" table (lines 18–26) add rows for: moodboard gate under autonomous mode, hero-preview drift override, critic-coverage Full default. In "### 4 kola značky — critic panel" → "Panel-coverage gate", codify that autonomous "pokracuj" defaults to **Full + bypass-log row** (not a silent skip). In "### Seed organic artifacts" gating, codify autonomous default = **None + 1-line chat + bypass-log row + the recommend-`/design:draw` next-step line**.
- **Pattern**: the existing D-9 "bypass-log write is non-optional, happens on first deviation" rule (line 30).
- **Gotcha**: These are *defaults*, not removals — the user can always upgrade. The point is they're **logged**, never silent (the exact failure the bypass-log exists to kill).
- **Validate**: every new default routes through the bypass-log; no new silent path introduced.

### Task 5: UPDATE `setup-ds.md` + `SKILL.md` flow summaries

- **Do**: In `setup-ds.md` "Step 3" numbered list (lines 86–105), insert the moodboard gate (after Confirm) and the hero-preview gate (in scaffold). In `SKILL.md` BOOTSTRAP one-liner / frontmatter `description`, mention the moodboard direction gate if the stage list is enumerated there. Keep both as **pointers** to `_bootstrap.md` (the canonical spec) per the existing "this is a pointer" convention.
- **Pattern**: existing pointer style — `setup-ds.md` already says "See `_bootstrap.md` … for the canonical spec."
- **Gotcha**: Don't restate the full gate spec in two places — pointer only, to avoid the drift the CLAUDE.md "single source of truth" rule warns about.
- **Validate**: `grep` for the two gates across `plugins/design/` — exactly one canonical definition (`_bootstrap.md`), pointers elsewhere.

### Task 6: RECORD DDR for the moodboard direction gate

- **Do**: `/flow:record-ddr` (or hand-author) `.ai/decisions/DDR-0XX-moodboard-direction-gate.md`: the decision to add a pre-scaffold visual direction gate, the StudyFi-revert evidence, why prose Confirm + post-hoc critic panel were insufficient, the moodboard-vs-hero-preview split, and the cost tradeoff (1–3 min gate vs 30–40 min wasted scaffold). Cross-link DDR-033 (3-stage discovery), DDR-057 (4.0 pass bar), DDR-073 (aesthetic ambition).
- **Validate**: DDR number is unused (`ls .ai/decisions/ | grep DDR-0`); cross-links resolve.

### Task 7: (verify) Throwaway canvas renders through the dev-server

- **Do**: Confirm a `<designRoot>/_moodboard/*.tsx` canvas renders via `_canvas-shell.html?canvas=<rel>` and screenshots cleanly (it imports `@maude/canvas-lib` like any canvas; `_moodboard/` is a new sibling of `_draw/`). Verify external `<img src="https://…">` loads in the canvas iframe (or document the CSP/fallback). **No code change expected** — this is a render-path sanity check; if it fails, scope a minimal fix and note it.
- **Pattern**: `draw-proof.sh` already renders throwaway canvases under `_draw/`; `_moodboard/` should behave identically.
- **Gotcha**: Phase 23 (canvas images / link-unfurl) may affect external-image handling — check it doesn't block hotlinked images; if it does, the fallback block (Task 2) is the mitigation.
- **Validate**: a hand-written one-artboard moodboard canvas screenshots non-blank in a scratch `.design/`.

---

## Validation

This is a markdown-spec change (+ research-agent contract); the repo's heavy gates mostly don't apply, but run what's relevant:

1. **Spec self-consistency**: re-read the full `_bootstrap.md` discovery→scaffold→panel flow; the Sequencing diagram, stage list, and bypass-log table are internally consistent.
2. **Cross-reference integrity**: `grep -rn "moodboard\|Stage 4\|hero-preview" plugins/design/` — one canonical definition, pointers elsewhere; no dangling references.
3. **Format** (only if any `.ts`/`.tsx`/`.json` is touched — likely none): `pnpm format` (biome).
4. **Dev-server tests** (only if Task 7 forces a code change): `pnpm test:dev-server`.
5. **Plugin-cli reachability** (if any plugin markdown gains a bin call): `node cli/lib/plugin-cli-reachability.test.mjs` — moodboard screenshot MUST go through `maude design screenshot`, never a raw `bin/*.sh` path (DDR-062).
6. **Live dogfood (the real proof)**: run `/design:setup-ds <scratch-name> "<brief>"` in a scratch project (`/tmp/scratch`, NOT this repo) and confirm: moodboard renders + screenshots + gates before scaffold; "Uprav" iterates cheaply; "Stop" bails before Batch A; on approval the hero preview honors the moodboard. **This is the acceptance test** — the feature is about the live flow, not a unit.
7. **Roadmap regen** (STATE/plans touched): `pnpm --filter @maude/site gen:roadmap` and commit the `site/lib/roadmap.json` diff (CLAUDE.md "Site roadmap regen").

---

## Acceptance Criteria

- [ ] All tasks completed
- [ ] `_bootstrap.md` defines Stage 4 (moodboard) + the Batch-A hero-preview gate as the single canonical source; `setup-ds.md` + `SKILL.md` point to it without restating
- [ ] `ux-research-agent.md` payload carries optional `reference_images[]`; existing anchors/links preserved as fallback
- [ ] Every new autonomous default routes through the bypass-log — no new silent path
- [ ] AskUserQuestion-unavailable numbered-prose fallback covers both new gates
- [ ] Moodboard is interactive-only, skipped on `--no-discovery`, lives in `_moodboard/` (never pollutes `system/<ds>/`)
- [ ] DDR recorded + cross-linked (DDR-033 / DDR-057 / DDR-073)
- [ ] Live dogfood in a scratch project: direction approved/iterated/bailed **before** the fan-out; hero preview gates the fan-out on token drift
- [ ] STATE.md + roadmap.json updated in the same change

---

## Out of scope (explicitly deferred — not selected)

The source report surfaced more than this plan covers. The user scoped to **process discipline + the two visual gates**; the following are **deferred**, recorded here so they aren't lost:

1. **Scaffold-integrity gates** (high value, cheap, recommend as the immediate follow-up): post-reconcile **non-empty file gate** (roster trusts `status: written` but files were 0 B — both v1 and v2-mid-run masked empty files); **real-bundle gate** instead of `esbuild --bundle=false` transpile (it masked two source bugs the dev-server bundle caught); **CSS-comment-hygiene lint** (`*/` inside `/* */` closed a comment early → "Bundle failed"); **"React.* requires import" check**; **contrast-claim discipline** (generated `colors_and_type.css` asserted `✓ 4.5:1` ratios that were wrong — never assert a ratio without computing it). All are markdown/sub-agent-prompt level and would not touch dev-server code.
2. **Tooling & data-loss bugs** (touch dev-server `sync/` + `bin/` — which has **active WIP on a shared `main`** per STATE Phase 13; recommend a **separate bug-fix branch**, not this plan):
   - **`maude design serve` truncated local `.tsx` to 0 bytes** on a denied/empty hub sync (`linkedHub.syncTsx: true`, DDR-072) — wiped 42 specimens **and** the sibling DS. Highest severity (data loss). A failed/denied sync must NEVER write an empty body over local source. (`sync/index.ts` shared-doc "adopt local state (hub was empty)" path, ~lines 450–463.)
   - **`visual-sanity` / `server-up` boot crashes on missing `yjs`** (`bun server.ts` requires it) — the mandatory visual-sanity gate silently degraded to a manual workaround, the exact failure the gate's "fail loud" design forbids.

These deferrals are the natural Round 2 once the gates land.

---

## Notes on house style / constraints honored

- **Single source of truth**: `_bootstrap.md` owns both gate specs; other docs are pointers (CLAUDE.md convention; DDR-059 §).
- **Bias-free templates** (DDR-043): the moodboard is assembled from *discovered* values + *researched* imagery — no hardcoded aesthetic; skipped entirely on the neutral `--no-discovery` skeleton.
- **`maude design <verb>` only** (DDR-062): moodboard screenshots go through `maude design screenshot`, never a raw bin path.
- **Shared-`main` discipline** (memory `feedback-scope-flow-commands-to-repo-state`): this plan is markdown-only + a render sanity-check; it deliberately avoids the dev-server `sync/` code under active WIP. Commit only these files atomically.
