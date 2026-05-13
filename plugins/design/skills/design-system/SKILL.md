---
name: design:design-system
description: Owns all design-system work. (1) READ mode (default) — loads the active canvas's declared DS (tokens, philosophy, hard-stops) so the agent iterates against the correct context. (2) BOOTSTRAP mode — runs when invoked via /design:setup-ds, or auto-loaded by /design:edit / /design:new on a missing target. Hard-deps pre-flight, 8-question discovery (2 rounds of AskUserQuestion) in one of 3 sub-modes (first-bootstrap / additional-ds / re-bootstrap), consults _MAPPING.md to compute scaffold set, generates project-flavored files using design-system-inspiration as reference, runs design-system-completeness-critic, and prints next-step block.
user-invocable: true
---

# design-system — pointer + bootstrap

This skill has **two responsibilities** with **mode-switched flows**:

1. **READ flow** (default) — load the project's design-system context (tokens, philosophy, hard-stops, active families) so any agent iterating on a canvas respects the system.
2. **BOOTSTRAP flow** — scaffold a new design system (first one, an additional one alongside an existing DS, or re-bootstrap an existing DS with `--force`).

The mode is **auto-detected** at invocation (see `## Mode-detection` below).

---

## Mode-detection (which flow to run)

At every invocation, decide which flow to execute:

- Invoked via `/design:setup-ds <name>` → **BOOTSTRAP**, `target_ds = <name>`
- Invoked via `/design:edit "..."` or `/design:new "..."` AND no `<designRoot>/system/*/` exists → **BOOTSTRAP**, `target_ds = "project"`, Q1 prefilled from `$ARGUMENTS` / `$BRIEF`
- Invoked via `/design:setup-ds <existing-name> --force` → **BOOTSTRAP** (re-bootstrap), `target_ds = <existing-name>`
- Otherwise (active canvas exists, `system/*/` exists) → **READ** (default)

When in BOOTSTRAP mode, classify into sub-modes:

- `first-bootstrap` — `.design/config.json` does not exist (or `designSystems[]` is empty)
- `additional-ds` — config exists, `target_ds` is NOT in `designSystems[]`
- `re-bootstrap` — config exists, `target_ds` IS in `designSystems[]`, `--force` passed (else refuse)

If both modes seem plausible, **prefer READ** — bootstrap should be the explicit choice.

---

## Read flow (canvas iteration)

When you're generating, reviewing, or migrating UI:

1. **Resolve `designRoot`** from `<repo>/.design/config.json` (or fall back to `.design`).
2. **Look up the canvas's declared DS.** Read `<canvas>.meta.json.designSystem` to know which DS to load. Fall back to `config.json.defaultDesignSystem` if no canvas meta. Fall back to `system/project/` if neither is set (single-DS layout).
3. **Read the tokens CSS** at `<designRoot>/<resolvedDsPath>/colors_and_type.css` (or the path declared in `config.json.tokensCssRel` for single-DS layouts). These are the only legal colors / fonts / radii / shadows.
4. **Read the DS README** at `<designRoot>/<resolvedDsPath>/README.md` — it contains the project-specific aesthetic, hard-stop rules, and rationale that override anything generic you'd otherwise default to.
5. **Read the DS SKILL.md** at `<designRoot>/<resolvedDsPath>/SKILL.md` — terse load-bearing summary the agent should treat as authoritative for hard rules + voice.
6. **Browse specimens** at `<designRoot>/<resolvedDsPath>/preview/` — concrete examples of legal swatches, typography pairings, density ladders, component compositions.
7. **Reference UI kits** at `<designRoot>/<resolvedDsPath>/ui_kits/{desktop,mobile}/` (when present) — idiomatic component compositions to learn the project's patterns.

### Multi-DS lookup pattern

When `config.json.designSystems[]` has more than one entry:

- Each canvas's `.meta.json.designSystem` field names which DS that canvas was built against (kebab-case slug, matches `designSystems[].name`).
- The skill loads **only that DS**, not all of them. Tokens and rules don't blend across DSes — a marketing canvas built against `marketing` DS uses marketing tokens, period.
- Subagents (`design-critic`, `design-system-completeness-critic`, etc.) scope to the same DS by reading the canvas's meta first.
- If `.meta.json.designSystem` is missing on a canvas in a multi-DS project, treat it as a warning (canvas drift) and fall back to `defaultDesignSystem` while flagging the gap.

### What you must never do (READ flow)

- **Never invent tokens.** If a color, font, radius, or shadow isn't in the tokens CSS, ask the user before adding it.
- **Never mix tokens between DSes.** A canvas's DS is single-valued; don't blend.
- **Never silently restyle a canvas to a different aesthetic** — token-family violation is a hard-stop the design-stack critics flag as a blocker.

---

## Bootstrap flow (create / extend / re-bootstrap a DS)

### Pre-Flight (light)

Bootstrap-mode Pre-Flight is **minimal** — checks only hard deps + presence of skeleton config. Rich environment onboarding (soft dep hints, install offers, CLAUDE.md / .ai/ recommendations) is the responsibility of `/design:init` (which the bootstrap entry-point auto-invokes when needed).

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Hard deps (abort on miss)
NODE_OK=false; command -v node &>/dev/null && \
  [[ "$(node -v | sed 's/v//;s/\..*//')" -ge 20 ]] && NODE_OK=true
GIT_OK=false; git -C "$REPO_ROOT" rev-parse &>/dev/null && GIT_OK=true
[[ -w "$REPO_ROOT" ]] || WRITE_OK=false

# Skeleton config check — if missing, auto-invoke init first
if [[ ! -f "$REPO_ROOT/.design/config.json" ]]; then
  echo "→ .design/config.json missing. Running /design:init first…"
  # Slash command body auto-invokes /design:init; skill proceeds after it returns.
fi
```

Hard-stops: missing Node → abort with install hint; missing git → abort with `run git init first`; no write permission → abort.

### Discovery (Round 1 + Round 2 + confirm)

**Detect target first.**

- Read `<repo>/.design/config.json`. Compute `designRoot` (default `.design`).
- For `first-bootstrap`: check that `<designRoot>/system/` is empty (or `designSystems[]` is empty). Target dirname is `project` (literal — never `<slug-of-project>/`).
- For `additional-ds`: target dirname is the kebab-case slug of the user-provided name (`<name>`).
- For `re-bootstrap`: target is the existing `system/<name>/` dir; refuse unless `--force`.

#### `first-bootstrap` (8 Qs across 2 rounds)

**Round 1 — Identity** (4 Qs via one AskUserQuestion call):

- Q1 product one-liner (sketch / reuse from PRD / skip)
- Q2 audience (pro tool / consumer app / developer tool)
- Q3 platforms (desktop only / mobile + desktop / tablet-first)
- Q4 theme default (dark / light / both equal)

**Round 2 — Brand + content** (4 Qs via a second AskUserQuestion call):

- Q5 mood references (Linear+Figma+posthog / Stripe+Vercel+Notion / Zed+Raycast+Arc)
- Q6 brand color (pick-for-me / I have a hex / cyan|indigo|emerald|amber default)
- Q7 typography (Inter+Plex+JetBrains / Geist+GeistMono / system+JetBrainsMono)
- Q8 content tone (direct-terse / explanatory-friendly / formal-B2B)

**Confirm.** Echo 2-sentence proposed direction. Wait for explicit yes / corrections. On "no", restart Round 2 only (max 2 retries before "scaffold-with-current and iterate via /design:edit").

#### `additional-ds` (8 Qs, different shape)

- **Q_purpose** — "What is this DS for, distinct from your existing DS?" (replaces Q1)
- Q2–Q8 same as first-bootstrap (with "Inherit from `<existing-ds>`" Recommended option on Q7 and Q8)

After Q8, surface an **inheritance picker** (multiSelect AskUserQuestion):

```
Inherit from <existing-ds>? (multi-select; "None" = define fresh)
  [x] Typography (font_display, font_body, font_mono)
  [ ] Voice / content tone
  [ ] Iconography family
  [x] Motion durations
  [ ] None
```

Inherited values are pre-baked into the new DS's `colors_and_type.css`; discovery answers for inherited fields are ignored.

#### `re-bootstrap` (8 Qs, pre-filled)

Read `system/<ds>/colors_and_type.css` + `system/<ds>/README.md` to pre-fill answers. User hits enter on each to keep current; only changed answers cause re-generation of affected files.

### Mapping → file set

**Consult `_MAPPING.md`** at `plugins/design/templates/design-system-inspiration/_MAPPING.md` (the contract for which files to scaffold). Compute the file set based on Q2 (audience) / Q3 (platforms) / Q4 (theme), and bake Q1 / Q5 / Q6 / Q7 / Q8 into the content of every generated file.

Compute `activeFamilies[]`:

- `accent` — always
- `status` — always unless project explicitly opts out (rare)
- `presence` — IF audience = pro tool AND Q1 mentions multiplayer / live / collab
- `mono` — IF audience = developer tool, OR Q7 includes a monospace pairing

### Scaffold (dynamic)

For each file in the computed set:

- **Core files** (README.philosophy.md, README.orchestration.md, SKILL.md, INDEX.md, config.json, colors_and_type.css): substitute placeholders from the discovery payload into the `.tpl` files in `templates/design-system-inspiration/core/`. If `mdcc` is available on PATH, shell out to `mdcc design init --discovery-payload <path>` (which uses the CLI's copy-tree helper). Else inline Write.
- **Specimen files** (under `core/preview/` and `universal/`): read the corresponding reference in the inspiration library, then **GENERATE a fresh project-flavored version** — same layout/composition, project's tokens, project's copy voice. **No placeholder copy** ("Lorem Solutions Inc.", "Click here", etc.) in the output.

Write `<designRoot>/config.json` with `extensions: []`, `completenessProfile: "standard"`, computed `activeFamilies[]`, and the new DS entry in `designSystems[]`.

Write `<designRoot>/system/<ds>/SKILL.md` with `name: ${ds}-design` (or similar slug derived from the project label).

**Run completeness-critic.** Spawn `design-system-completeness-critic` as a subagent with:

```
config_path: <repo>/.design/config.json
ds_name:     <target_ds>
ds_root:     <designRoot>/system/<target_ds>/
output_path: <designRoot>/_history/_system/000-bootstrap-completeness.md
all_ds:      false
```

The critic emits a JSON verdict. If it returns **blockers**, the bootstrap flow surfaces them in the next-step block and recommends the user re-run with `--force` after addressing each. Warnings are listed in the completion message but do NOT block. Tier 3 (free-form) acknowledgements are listed informationally.

### Post-Flight (slim)

Bootstrap-mode Post-Flight is **slim** — only DS-specific follow-ups (no environment offers; those belong to `init`):

- Optionally surface a one-shot AskUserQuestion offering `mdcc design serve` if not already running, so the user can browse the freshly-generated specimens.

Everything else (CLAUDE.md, .ai/, agent-browser install hints) was handled during `init` BEFORE bootstrap ran.

### Always-print next steps

```
Bootstrap complete. .design/ scaffolded at <repo>/.design/system/<ds>/.
  <N> specimen pages under preview/ (audience: <Q2>, platforms: <Q3>)
  config.json: 14 fields populated (incl. extensions, completenessProfile, activeFamilies, designSystems[])
  completeness-critic: 0 blockers, <N> warnings

Daily verbs:
  /design:edit "<feedback>"   — iterate on a specimen
  /design:new "<Name>" "..."  — add a new full canvas
  /design:browse              — open the dev server tab
  /design:critic              — run all critics on active canvas
  /design:help                — grouped command index
```

---

## Companion skills

- `design` — user-facing orchestrator (canvas-first iteration loop)
- `ui-kit` — pointer to project-specific reference surfaces / components
- `frontend-design` (external plugin) — generates new canvas files using these tokens

## Cross-links

- Inspiration library: `plugins/design/templates/design-system-inspiration/`
- Mapping contract: `plugins/design/templates/design-system-inspiration/_MAPPING.md`
- Tokens (authoritative, post-scaffold): `<designRoot>/<tokensCssRel>` (single-DS) or `<designRoot>/system/<ds>/colors_and_type.css` (multi-DS)
- Live specimen browse: dev server at `http://localhost:<port>/<designRoot>/system/...`
- Per-repo config: `.design/config.json`
- Completeness-critic (when added): `plugins/design/agents/design-system-completeness-critic.md`
