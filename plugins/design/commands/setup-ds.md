---
name: design:setup-ds
category: setup
description: Create a new design system (first one, an additional one alongside an existing DS, or re-bootstrap an existing one with --force). Thin wrapper that loads skill `design-system` in bootstrap mode with the given target. Auto-invokes /design:init first if .design/config.json is missing.
argument-hint: "<name> [\"<brief>\"] [--force] [--quick]"
---

# /design:setup-ds — create / extend a design system

Dedicated entry point for **creating a design system** in this project. Three modes the underlying skill auto-detects:

- **first-bootstrap** — `.design/config.json` does not exist (or `designSystems[]` is empty). The skill runs **3-stage discovery** (Stage 0 scope picker → Stage 1 vision prompts → Stage 2 research → Stage 3 refinement), scaffolds `system/<name>/`, writes `config.json` with `designSystems: [{ name, path, description }]`.
- **additional-ds** — `config.json` exists and `<name>` is **not** in `designSystems[]`. The skill runs the same 3 stages plus a Q_purpose prompt at the start and an inheritance picker between Stage 2 and Stage 3.
- **re-bootstrap** — `<name>` already exists in `designSystems[]` AND `--force` was passed. Stage 1 is lossy-inferred from the existing DS README + tokens + `_layout.css`; user confirms / corrects in a single chat message; Stage 2 always re-runs; Stage 3 + Confirm proceed identically.

This command **does NOT create a canvas** — use `/design:new` for that. It also does NOT prepare the project environment (deps, CLAUDE.md, .ai/) — that's `/design:init`'s job.

## Arguments

- `<name>` — required. Kebab-case slug (`marketing`, `admin`, `consumer-mobile`, …). For the first DS in a **single-DS project**, the literal value `project` is the conventional default — every `/design:edit` / `/design:new` auto-detects it without `--ds=<name>` flag. **Name-validation rule (Phase 19 / DDR-044):** when first-bootstrap is detected AND `<name>` exactly matches the repo basename (e.g. user typed `/design:setup-ds my-repo` from `~/git/my-repo`), the skill warns: `You passed '<name>'; for first-bootstrap projects the conventional default is 'project' (auto-detected by /design:edit). Continue with '<name>'? [Y/n]` and proceeds on Y/enter. The user-supplied name is honored either way — the warning is informational, not gating. The completeness-critic's C2 dirname check (`system/<name>/` vs `system/project/`) reads `vision-brief.json#name_source` to distinguish `user`-supplied from `default`-applied names; user-supplied names do NOT trigger C2.
- `<brief>` — optional. If absent, Stage 1 asks all 11 prompts. If present, the skill pre-fills the matching `vision-brief.json` fields (typically P1 elevator pitch, sometimes P5 lineage / P10 OST hypothesis) and prints a one-line `→ Skipping P<N> (covered in brief)` per skipped prompt so the user can correct misfires.
- `--force` — required for re-bootstrap of an existing DS. Without it, an existing-DS target produces an error pointing at the right verb (`/design:edit` for incremental change, `/design:setup-ds <new-name>` to add a sibling DS).
- `--quick` — opt out of Stage 1's full 11 prompts. The skill collapses Stage 1 to 4 prompts (P1 elevator + P5 lineage + P8 primary emotion + P10 OST hypothesis) and runs Stage 2 + Stage 3 normally. Output is structurally valid but typically scores ~3.5/5 aspiration instead of the 4.0+/5 the full 3-stage flow targets. Use when scaffolding a throwaway DS or when the user explicitly wants the fast path.
- `--imprint` — steer Stage 2 research toward an explicit brand prior (rare; usually used when the brief already names a strong gold-standard, e.g. "use the studyfi imprint pattern"). The skill still runs Stage 1 + Stage 2 + Stage 3 in full BUT seeds the research agent's payload with the prior. **Phase 3.7 / DDR-049:** the post-scaffold critic panel is gated by an explicit `AskUserQuestion` (Full 4 kola / Imprint-only / Custom) regardless of `--imprint` — the flag does NOT silently skip Kolo 2 + 3. `motion-critic` is always-on whenever `motion.tsx` is scaffolded, regardless of `--opt-out=motion`. See SKILL.md "Spec-bypass discipline" — any deviation from spec routes through `<designRoot>/_history/_system/<ds>-bypass-log.md`.

## Examples

```
/design:setup-ds project "Je to recept manager kde nastavíš počet porcí a on přepočítá ingredience. Pro mě a 3 kamarády. Chci aby to vypadalo jako kuchařka z 80s, ne jako moderní food app s velkými fotkami."
/design:setup-ds marketing "<paragraph describing what this marketing surface is for, the audience, the primary action, voice direction>"
/design:setup-ds admin --force                                          # re-bootstrap
/design:setup-ds quickdraft "<one-paragraph brief>" --quick             # collapse Stage 1 to 4 prompts
```

**Brief content guidance:**
- Stage 1 of discovery is conversational — the skill leads you through 11 small prompts, each with an example. You don't need to know anything in advance.
- If `<brief>` is just a one-liner, it pre-fills P1 only; the remaining 10 prompts get asked.
- If `<brief>` is a paragraph, the skill pattern-matches lineage / OST / audience cues and skips the corresponding Stage 1 prompts (each skip is printed inline so you can correct). Stages 2 + 3 always run.
- No Pastier vocabulary required — the skill handles the internal mapping to his chapters silently.

## Process

### Step 1 — Detect environment

One pre-flight call resolves config presence + the known-DS set in a single pass (instead of a bare `.design/config.json` read):

```bash
eval "$(bash "$CLAUDE_PLUGIN_ROOT/dev-server/bin/prep.sh" --shell-export --shape setup-ds)"
# → CONFIG_PRESENT, KNOWN_DS, DEFAULT_DS, REPO_ROOT, DESIGN_ROOT, ACCENT_STRATEGY, COLOR_SPACE
```

If `CONFIG_PRESENT=false`:

```
→ .design/config.json missing. Running /design:init first to initialize the project…
```

Then auto-invoke `/design:init --skip-prompts` so the user isn't double-prompted. After it returns, continue.

If config exists (`CONFIG_PRESENT=true`), skip onboard. `KNOWN_DS` already tells you whether `<name>` collides with an existing DS (drives the first-bootstrap / additional-ds / re-bootstrap sub-mode decision in Step 2).

### Step 1.5 — Cache inspiration library inventory

Before the skill runs any `find` calls against the inspiration library, capture the library tree once and hold it in context:

```sh
ls -R plugins/design/templates/design-system-inspiration/ | head -200
```

This avoids the false-negative template-drop the studio-2 retro caught (BAD-6) where `find` from the wrong cwd returned exit-code-1 and a template (`audience-developer/type-mono.html`) was incorrectly classified as missing. Subsequent `find` calls during scaffold MUST use absolute paths anchored at the repo root.

### Step 2 — Invoke skill `design-system` in bootstrap mode

Call `Skill design-system` with the input envelope:

```
mode: bootstrap
target_ds: <name>
brief:     <brief or empty>
force:     true|false
quick:     true|false           # --quick → collapse Stage 1 to 4 prompts
```

The skill detects the sub-mode internally (first-bootstrap / additional-ds / re-bootstrap) based on `.design/config.json` state.

### Step 3 — Skill runs its discovery + scaffold

See `plugins/design/skills/design-system/SKILL.md` "Bootstrap flow" for the canonical spec. Briefly:

1. Pre-Flight (light) — node ≥ 20, git, write permission, config exists (else auto-onboard). **AskUserQuestion availability probe** (Phase 19 / DDR-044): the skill fires one trivial AskUserQuestion before Stage 0; if it returns `InputValidationError` or permission denial (e.g. don't-ask mode), Stages 0 + 3 switch to numbered-prose-in-chat for the rest of the session. Spec + copy-paste prose templates in `plugins/design/skills/design-system/SKILL.md` ("Tool-availability check" callout, just before Stage 0).
2. Discovery — **3 stages** (DDR-033). Stage 0 = single AskUserQuestion (scope) OR numbered-prose fallback. Stage 1 = 11 plain-prose prompts in 3 batches, free-text + skip. Stage 2 = `ux-research-agent` runs on the full `vision-brief.json`, ~30–90s wall-clock. Stage 3 = adaptive 0–N AskUserQuestion picks driven by per-decision research confidence (numbered-prose fallback when AskUserQuestion is unavailable). `--quick` collapses Stage 1 to 4 prompts.
3. Confirm — **3-sentence echo** (one per stage); on "něco upravit" return to Stage 3 (not Stage 1).
4. Mapping — consult `_MAPPING.md` for file set, `activeFamilies[]`, per-file `dependency_closure` (drives batching).
5. **Pre-scaffold roster** — emit `_history/_system/000-scaffold-roster.yaml` listing every file with `batch: A|B|C` + `status: pending`.
6. **Scaffold (fan-out)** — Batch A by main agent (tokens + chrome + READMEs + config); Batches B + C **fired in parallel via sub-agents** (5–8 slices). Sub-agents read tokens CSS + chrome + reference template, then RESTRUCTURE per the creativity rubric. Each updates its rows to `status: written`.
7. Reconcile — main agent reads roster, asserts no pending rows remain.
7.5. **Animation-contract gate (fail closed — DDR-049).** If `system/<ds>/preview/motion.tsx` was scaffolded, grep it: it MUST import `@maude/canvas-lib` AND reference the vocabulary (`<MotionDemo` or `<MotionTrack`). A specimen that is pure-CSS `@keyframes` only (no canvas-lib import) violates the Animation tooling contract (`skills/design-system/SKILL.md`). On miss → either **regenerate the specimen** against the contract, or, if a zero-JS specimen is genuinely intended, record the deviation in `_history/_system/<ds>-bypass-log.md` with a one-line reason. Do NOT accept a silently-pure-CSS motion specimen. (`motion-critic` in step 10 also blocks it; this gate catches it before the panel so the regen happens once.)
8. Copy-claim → asset-receipt sweep, then auto-run completeness-critic.
9. Visual sanity — 3 signature specimen screenshots via `dev-server/bin/screenshot.sh`.
10. **4 kola značky panel** — **Kolo 1 (Srozumitelnost: completeness + a11y) runs first** (the structural floor must hold before aesthetics matter, and Kolo 2 reads Kolo 1's blocker count to set severity). After Kolo 1 returns, **Kola 2 + 3 fire together as one parallel batch** (single assistant message, multiple Agent calls): Kolo 2 (Atraktivita: graphic-design + signature-moment) + Kolo 3 (Konzistence: typography + brand + copy). Honest verdicts surface in the completion block. Canonical spec (gating + verdicts + parallelism) lives in `plugins/design/skills/design-system/SKILL.md` post-scaffold gate — this is a pointer.
11. Post-flight — print next-step block.

### Step 4 — Return

The skill prints its "Bootstrap complete" block. This command body has no Post-flight of its own.

## Failure modes

- **`<name>` already exists AND `--force` was NOT passed** → fail with:
  ```
  Error: design system "<name>" already exists at .design/system/<name>/.
  To iterate on it:  /design:edit "<feedback>"
  To replace it:     /design:setup-ds <name> "<new brief>" --force
  To add a sibling:  /design:setup-ds <new-name> "<brief>"
  ```
- **`<name>` is not a valid kebab-case slug** (must match `^[a-z][a-z0-9-]*$`) → fail with the regex hint.
- **`<name>` collides with a reserved dir** (`preview`, `assets`, `ui_kits`) → fail with "reserved name; pick another".
- **Hard-dep missing (node < 20 / no git / no write permission)** → the skill's Pre-Flight aborts with the specific install hint.

## What `/design:setup-ds` does NOT do

- **No canvas creation.** Use `/design:new "<Name>" "<brief>" --ds=<this-name>`.
- **No environment init.** That's `/design:init` (auto-invoked here when needed).
- **No incremental edits to an existing DS.** That's `/design:edit "<feedback>"` against a specimen file, or hand-editing `colors_and_type.css` directly.
