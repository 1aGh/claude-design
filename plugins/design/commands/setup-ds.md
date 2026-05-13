---
name: design:setup-ds
category: setup
description: Create a new design system (first one, an additional one alongside an existing DS, or re-bootstrap an existing one with --force). Thin wrapper that loads skill `design-system` in bootstrap mode with the given target. Auto-invokes /design:init first if .design/config.json is missing.
argument-hint: "<name> [\"<brief>\"] [--force] [--quick]"
---

# /design:setup-ds — create / extend a design system

Dedicated entry point for **creating a design system** in this project. Three modes the underlying skill auto-detects:

- **first-bootstrap** — `.design/config.json` does not exist (or `designSystems[]` is empty). The agent runs the full 12-question discovery (3 rounds — identity / brand / pro-designer inputs), scaffolds `system/<name>/`, and writes `config.json` with `designSystems: [{ name, path, description }]`.
- **additional-ds** — `config.json` exists and `<name>` is **not** in `designSystems[]`. The agent runs 11 questions + Q_purpose + inheritance picker, then scaffolds `system/<name>/` next to the existing DS.
- **re-bootstrap** — `<name>` already exists in `designSystems[]` AND `--force` was passed. The agent pre-fills 12 questions with the current values and re-generates affected files.

This command **does NOT create a canvas** — use `/design:new` for that. It also does NOT prepare the project environment (deps, CLAUDE.md, .ai/) — that's `/design:init`'s job.

## Arguments

- `<name>` — required. Kebab-case slug (`marketing`, `admin`, `consumer-mobile`, …). For the first DS in a single-DS project, the literal value `project` is the conventional default.
- `<brief>` — optional. One-line description used to pre-answer Q1 (first-bootstrap) or Q_purpose (additional-ds). If absent, the skill asks the question interactively. **A rich brief (a paragraph naming references + audience + voice) materially lowers the discovery round count** — strong briefs get pre-filled Recommended options that the user just confirms.
- `--force` — required for re-bootstrap of an existing DS. Without it, an existing-DS target produces an error pointing at the right verb (`/design:edit` for incremental change, `/design:setup-ds <new-name>` to add a sibling DS).
- `--quick` — opt out of Round 3 (pro-designer inputs). Discovery falls back to the 8-Q baseline. Output is structurally valid but typically scores ~3.5/5 aspiration instead of the 4.0+/5 the 12-Q flow targets. Use when scaffolding a throwaway DS or when the user explicitly wants the fast path.

## Examples

```
/design:setup-ds project "team scouting + match-day pro tool"
/design:setup-ds marketing "consumer-facing marketing site for product launch"
/design:setup-ds admin --force                                          # re-bootstrap
/design:setup-ds quickdraft "throwaway exploration" --quick             # skip Round 3
/design:setup-ds studio "docs + dev-server, vibe: Zed × Affinity × PostHog warmth × Figma canvas, dark-first, mono-forward, signature CRT-glow on dark"
```

A rich brief (last example) carries enough mood + voice + visual-treatment cues that most Recommended pre-fills land on the first try; user just confirms.

## Process

### Step 1 — Detect environment

Read `<repo>/.design/config.json`. If it doesn't exist:

```
→ .design/config.json missing. Running /design:init first to initialize the project…
```

Then auto-invoke `/design:init --skip-prompts` so the user isn't double-prompted. After it returns, continue.

If config exists, skip onboard.

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
quick:     true|false           # --quick → skip Round 3, fall back to 8-Q baseline
```

The skill detects the sub-mode internally (first-bootstrap / additional-ds / re-bootstrap) based on `.design/config.json` state.

### Step 3 — Skill runs its discovery + scaffold

See `plugins/design/skills/design-system/SKILL.md` "Bootstrap flow" for the canonical spec. Briefly:

1. Pre-Flight (light) — node ≥ 20, git, write permission, config exists (else auto-onboard).
2. Discovery — **3 rounds** of AskUserQuestion (4 Qs each): identity → brand → pro-designer inputs. `--quick` skips Round 3.
3. Confirm direction — **3-sentence echo** (one per round); user yes / corrects / retries affected round.
4. Mapping — consult `_MAPPING.md` for file set, `activeFamilies[]`, and per-file `dependency_closure` (drives batching).
5. **Pre-scaffold roster** — emit `_history/_system/000-scaffold-roster.yaml` listing every file with `batch: A|B|C` + `status: pending`.
6. **Scaffold (fan-out)** — Batch A by main agent (tokens + chrome + READMEs + config); Batches B + C **fired in parallel via sub-agents** (5–8 slices). Sub-agents read tokens CSS + chrome + reference template, then RESTRUCTURE per the creativity rubric. Each updates its rows to `status: written`.
7. Reconcile — main agent reads roster, asserts no pending rows remain.
8. Copy-claim → asset-receipt sweep, then auto-run completeness-critic.
9. Visual sanity — agent-browser screenshots of 3 signature specimens.
10. **Aesthetic critic panel** — signature-moment + graphic-design + typography + copy fired in parallel on signature specimens. Honest verdicts surface in the completion block.
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
