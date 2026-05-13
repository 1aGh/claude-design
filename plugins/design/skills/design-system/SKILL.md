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
7. **Reference UI kits** at `<designRoot>/<resolvedDsPath>/preview/ui_kits-{desktop,mobile}-{index,showcase}.html` (when present) — `index` is the catalog/launcher, `showcase` is the full product mock with theme/accent switching. These flatten into the `preview/` dir at scaffold time; the source convention in the inspiration library is `platform-<platform>/ui_kits-<platform>-*.html`.

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

### Discovery (Round 1 + Round 2 + Round 3 + confirm)

**Detect target first.**

- Read `<repo>/.design/config.json`. Compute `designRoot` (default `.design`).
- For `first-bootstrap`: check that `<designRoot>/system/` is empty (or `designSystems[]` is empty). Target dirname is `project` (literal — never `<slug-of-project>/`).
- For `additional-ds`: target dirname is the kebab-case slug of the user-provided name (`<name>`).
- For `re-bootstrap`: target is the existing `system/<name>/` dir; refuse unless `--force`.

#### `first-bootstrap` (12 Qs across 3 rounds)

> **Why 12, not 8.** The 8-Q baseline gets you a working DS; it does not get you a pro-grade DS. Round 3 (Q9–Q12) captures the inputs a pro designer would gather from a stakeholder before opening Figma: signature treatment, hard-NO list, iconography vibe, density preference. The retro on the studio 2026-05-13 re-bootstrap (`.ai/logs/system-reviews/setup-ds-studio-rebootstrap-review.md`) recommends Round 3 as the cheapest single intervention to lift output from "structurally valid" to "portfolio-worthy". Opt out via the slash command's `--quick` flag if the user explicitly wants the 8-Q baseline.

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

**Round 3 — Pro-designer inputs** (4 Qs via a third AskUserQuestion call):

- **Q9 signature visual treatment** — single select: `none / restrained` · `gradient discipline (Affinity)` · `CRT scanlines + phosphor glow` · `glassmorphism (frosted blur)` · `brutalism (hard edges, no shadows)` · `soft-shadow depth ladder (Stripe / Notion)` · `neumorphism (inset shadows)` · `pick-for-me`. Pre-fill the Recommended from Q5 mood (e.g. "Affinity" mood → "gradient discipline"). The chosen treatment is baked into `_layout.css` chrome (body background, h1 text-shadow, sectioning rules) AND surfaces in at least one signature specimen (typically `colors-accent.html` brand-spotlight + `ui_kits-*-showcase.html` hero).
- **Q10 hard NO list** — multi-select: `no decorative gradients` · `no animations beyond hover` · `no emoji in chrome` · `no rounded corners > 12px` · `no centered hero layouts` · `no marketing-style CTAs` · `anything goes (skip)`. Every checked item becomes a guardrail surfaced in the DS README and the per-DS SKILL.md. Sub-agents authoring specimens MUST read this list before writing.
- **Q11 iconography vibe** — single select: `terminal glyphs (1px stroke, ASCII-leaning — Zed/Raycast)` · `product icons (lucide rounded, balanced — Linear/Notion)` · `industry-specific (sports/recipes/finance — domain nouns dominant)` · `flat-illustrative (Phosphor / Heroicons solid)` · `pick-for-me`. Drives `iconography.html` specimen content + the 3–5 example SVGs scaffolded into `assets/glyphs/`.
- **Q12 density preference** — single select: `dense pro-tool (Affinity / Linear / Zed — chrome at space-2/3, dense tables)` · `balanced (Figma / Vercel — chrome at space-3/4)` · `roomy SaaS (Stripe / Notion — chrome at space-4/5, more whitespace)` · `pick-for-me (derive from Q2 audience)`. Sets `--space-*` usage conventions and the default padding values in `_layout.css`.

**Confirm.** Echo a **3-sentence** proposed direction (one sentence per round: identity + brand + visual signature). Wait for explicit yes / corrections. On "no", restart the affected round (max 2 retries each before "scaffold-with-current and iterate via /design:edit").

#### `additional-ds` (12 Qs, different shape)

- **Q_purpose** — "What is this DS for, distinct from your existing DS?" (replaces Q1)
- Q2–Q12 same as first-bootstrap (with "Inherit from `<existing-ds>`" Recommended option on Q7, Q8, Q11, Q12)

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

#### `re-bootstrap` (12 Qs, pre-filled)

Read `system/<ds>/colors_and_type.css` + `system/<ds>/README.md` + `_layout.css` to pre-fill answers (Round 3 derived from `_layout.css` body background + body::before/::after presence + iconography.html curation). User hits enter on each to keep current; only changed answers cause re-generation of affected files.

### Mapping → file set

**Consult `_MAPPING.md`** at `plugins/design/templates/design-system-inspiration/_MAPPING.md` (the contract for which files to scaffold). Compute the file set based on Q2 (audience) / Q3 (platforms) / Q4 (theme), and bake Q1 / Q5 / Q6 / Q7 / Q8 into the content of every generated file.

Compute `activeFamilies[]`:

- `accent` — always
- `status` — always unless project explicitly opts out (rare)
- `presence` — IF audience = pro tool AND Q1 mentions multiplayer / live / collab
- `mono` — IF audience = developer tool, OR Q7 includes a monospace pairing

### Accent color heuristic (Q6 "pick for me")

When the user lets the skill pick the OKLCH accent, **read the mood cues in Q1 + Q5 + Q6 label before picking lightness**:

| Mood cue | Target L | Target C | Notes |
|---|---|---|---|
| "burnt", "lava", "warm", "hedgehog", "amber", "rust", "fire" | **L 60–66** | C 0.16–0.20 | Saturated but not bright — reads as deep, not candy |
| "electric", "vibrant", "neon", "highlighter" | L 72–80 | C 0.18–0.24 | Bright, sits forward on dark |
| "muted", "earthy", "natural", "stone" | L 55–62 | C 0.08–0.13 | Low chroma; reads quiet |
| "pastel", "soft", "creamy" | L 75–85 | C 0.08–0.12 | High L, low C |
| default (no mood cue) | L 68–72 | C 0.14–0.18 | Mid-range, "tasteful default" |

**Why this exists:** the studio bootstrap (2026-05-13) picked `oklch(72% 0.18 55)` for an "amber/lava PostHog-warmth" brief; the result rendered as candy/pumpkin orange because L was too high for the "burnt" cue. See `.ai/logs/system-reviews/setup-ds-studio-review.md`. Always **screenshot the accent in context** (step 7 below) before declaring the color final.

### Namespace + parameterization patterns (when to use)

The reference templates use a `.app` root class on `<body>` for namespacing. Two patterns the skill can opt into for richer DSes:

**1. `.{project-slug}` root scoping (dugmate-style).** When the DS is meant to be **reusable across multiple host apps** (e.g. embedded as a widget, shared across a monorepo, or shipped as a standalone CSS bundle), scope every selector under a project-named class:

```css
.dugmate          { /* base reset + body font */ }
.dugmate h1, .dugmate h2 { font-family: var(--font-display); }
.dugmate .btn--primary  { background: var(--accent); }
```

This prevents token leakage when the DS coexists with another design system on the same page. The trade-off: every selector gains a prefix, and consumers must wrap their app in `<div class="dugmate">`. Set `config.json.rootClass` to the project slug if you opt in.

**Default:** single-DS projects use `class="app"` — simple, no prefix needed.

**2. `[data-team="<accent-variant>"]` retint (dugmate-style team accents).** When the DS supports **multiple branded variants** (per-team color in a sports app, per-tenant color in B2B, per-product color in a portfolio), declare each variant as an attribute selector that overrides the accent family:

```css
[data-team="cyan"]    { --accent: oklch(72% 0.16 220); --accent-hover: oklch(68% 0.16 220); --accent-fg: oklch(14% 0.04 220); }
[data-team="emerald"] { --accent: oklch(70% 0.16 150); --accent-hover: oklch(66% 0.16 150); --accent-fg: oklch(14% 0.04 150); }
```

This honors the one-accent rule (only `--accent*` family is overridden, never adds `--accent2`), but lets the live UI pick from a small palette. The `platform-desktop/ui_kits-desktop-showcase.html` reference template includes an accent picker that flips `data-team` on `<html>`.

**Default:** skip this section unless the discovery brief explicitly mentions "per-team", "per-tenant", or "multi-brand". Most DSes don't need it.

**3. `[data-theme="dark|light"]` parameterization.** Always emit at least `[data-theme="dark"]` (or `[data-theme="light"]`, whichever is the default). When `config.json.themeDefault == "both"`, emit both blocks with identical token shapes but different surface/text values. The completeness-critic V18 enforces this.

### Pre-scaffold — emit `_scaffold-roster.yaml`

Before any file is written, the main agent emits a **roster** to `<designRoot>/_history/_system/000-scaffold-roster.yaml`. The roster lists every file the scaffold will produce, plus its dependency closure and batch assignment. **The roster is the contract.** Sub-agents write their slice, then update `status: written` on each row. Main agent reconciles at the end — any row stuck in `pending` is a regression flag.

```yaml
# 000-scaffold-roster.yaml — emitted before scaffold; sub-agents update status as they write
discovery:
  product: "{{Q1 product one-liner}}"
  audience: "{{Q2}}"
  platforms: ["{{Q3}}"]
  theme_default: "{{Q4}}"
  mood: "{{Q5}}"
  accent_oklch: "{{Q6 → computed OKLCH}}"
  typography: "{{Q7}}"
  voice: "{{Q8}}"
  signature_treatment: "{{Q9}}"
  hard_nos: ["{{Q10 picks}}"]
  iconography_vibe: "{{Q11}}"
  density: "{{Q12}}"
files:
  # Batch A — main agent writes serially (tokens are the dependency root)
  - { path: "colors_and_type.css",       batch: A, deps: [], status: pending }
  - { path: "README.md",                 batch: A, deps: [tokens], status: pending }
  - { path: "SKILL.md",                  batch: A, deps: [tokens], status: pending }
  - { path: "preview/_layout.css",       batch: A, deps: [tokens, Q9], status: pending }  # signature treatment lives here
  - { path: "../../README.md",           batch: A, deps: [], status: pending }            # designRoot orchestration README
  - { path: "../../INDEX.md",            batch: A, deps: [], status: pending }
  - { path: "../../config.json",         batch: A, deps: [], status: pending }
  # Batch B — fan out (token-only specimens; depend only on tokens + chrome)
  - { path: "preview/colors-text.html",      batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/colors-surfaces.html",  batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/colors-accent.html",    batch: B, deps: [tokens, chrome],          status: pending, signature: true }
  - { path: "preview/type-scale.html",       batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/spacing-scale.html",    batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/motion.html",           batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/radii.html",            batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/elevation.html",        batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/focus.html",            batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/iconography.html",      batch: B, deps: [tokens, chrome, Q11],     status: pending }
  - { path: "preview/borders.html",          batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/grid.html",             batch: B, deps: [tokens, chrome, Q3],      status: pending }
  - { path: "preview/opacity.html",          batch: B, deps: [tokens, chrome],          status: pending }
  - { path: "preview/selection.html",        batch: B, deps: [tokens, chrome],          status: pending }
  # Batch C — fan out (components + compositions; depend on tokens + chrome + reference template)
  - { path: "preview/components-buttons.html",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-cards.html",        batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-inputs.html",       batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-toggles.html",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-dialogs.html",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-tooltips.html",     batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-tables.html",       batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/components-callout.html",      batch: C, deps: [tokens, chrome, template], status: pending }
  - { path: "preview/empty-state.html",             batch: C, deps: [tokens, chrome, template], status: pending, signature: true }
  - { path: "preview/logo.html",                    batch: C, deps: [tokens, chrome, assets], status: pending, signature: true }
  # … gated entries appended based on Q2/Q3 (audience-pro/*, audience-developer/*, status/*, presence, etc.)
  # … always ends with the highest-leverage composition:
  - { path: "preview/ui_kits-desktop-showcase.html", batch: C, deps: [tokens, chrome, template, ALL], status: pending, signature: true }
  - { path: "preview/ui_kits-desktop-index.html",    batch: C, deps: [ALL specimens written], status: pending }   # written LAST so it can link to peers
# Batch B fan-out groups — sub-agents claim these slices
fanout:
  - { batch: B, slice: "color tokens",        files: [colors-text, colors-surfaces, colors-accent] }
  - { batch: B, slice: "type + spacing",      files: [type-scale, spacing-scale] }
  - { batch: B, slice: "motion + foundations a", files: [motion, radii, elevation, focus] }
  - { batch: B, slice: "foundations b",       files: [iconography, borders, grid, opacity, selection] }
  - { batch: C, slice: "core components",     files: [components-buttons, components-cards, components-inputs] }
  - { batch: C, slice: "universal a",         files: [components-toggles, components-dialogs, components-tooltips] }
  - { batch: C, slice: "universal b",         files: [components-tables, components-callout] }
  - { batch: C, slice: "brand + voice",       files: [empty-state, logo] }
  - { batch: C, slice: "audience-pro",        files: [components-command-palette, components-shortcuts-overlay, …] }   # only if Q2 = pro
  # … plus other gated slices
```

Reconciliation rule: after Batch C completes, the main agent reads the roster, asserts every row is `written`, and rejects the bootstrap as incomplete otherwise. The `ui_kits-*-index.html` is always last because it links every peer — written after the rest by the main agent, not a sub-agent.

### Scaffold (3-batch fan-out)

The inspiration library at `plugins/design/templates/design-system-inspiration/` has **11 category dirs** holding **~67 reference HTML specimens**. The skill walks the categories, picks files matching the project profile, and **GENERATES** project-flavored versions in `system/<ds>/preview/`. **Scaffold output is flat** — category prefixes live only in the library; the scaffolded files all land directly under `preview/`. See `_MAPPING.md` for the full inventory, gating rules, and the `dependency_closure` column that drives batching.

**Scaffold is fan-out work, not serial work.** Independent file writes are pure leaves of a DAG: every specimen depends only on `colors_and_type.css` + `_layout.css` (chrome) + zero or one reference template. Serial scaffold of 25–30 specimens in the main agent burns context and produces quality drift (early specimens get full creative attention; late specimens get token-swapped). Fan-out fixes both: 5–8 sub-agents in parallel, each with a fresh attention budget per specimen slice.

#### Batch A — main agent writes serially

The dependency root. Main agent writes these **in order, alone** because every later file imports them.

1. `colors_and_type.css` — tokens. Substitute discovery values (accent OKLCH, fonts, density-derived `--space-*` defaults, Q9-derived shadow/treatment tokens like `--shadow-glow` or `--scanline-alpha`).
2. `<designRoot>/system/<ds>/preview/_layout.css` — chrome. **Bakes Q9 signature treatment into the body background + h1 treatment.** Examples:
   - Q9 = `gradient discipline` → soft accent halo at top-right, light vignette at bottom
   - Q9 = `CRT scanlines + phosphor glow` → repeating-linear-gradient scanlines + h1 text-shadow with accent glow + body::before SVG film-grain + body::after CRT roll animation (reduced-motion safe)
   - Q9 = `glassmorphism` → backdrop-filter blur on cards; `.specimen` gets a faint frosted backdrop
   - Q9 = `brutalism` → no shadows at all; thick `--border-strong` outlines; sharp corners override on key elements
   - Q9 = `soft-shadow depth ladder` → richer `--shadow-md/lg` with longer offsets; cards float higher
   - The treatment is **the project's first impression** — every specimen inherits it via `_layout.css`.
3. **`<designRoot>/system/<ds>/preview/_components.css`** — shared component anatomy. **Emit when Q9 ≠ `none / restrained` AND the signature treatment repeats across 3+ components** (typical: bevel on button + tile + segmented + switch; recessed bay on input + checkbox + radio). Promotes `.btn`, `.tile`, `.input`, `.switch`, `.seg`, `.pill`, `.led` etc. out of per-specimen `<style>` blocks into one authoritative file. Specimens then carry only their demonstration-specific CSS inline. **Skip** when Q9 = `none / restrained` AND Q12 = `roomy SaaS` — inline styles are fine and `_components.css` adds noise. Sub-agents in Batch C MUST receive this file (when present) as part of their reference bundle and reference its class names instead of re-implementing the anatomy. Studio 2026-05-13 example: `.btn` (4 variants + 3 sizes + bevel math), `.tile` (gradient fill + phosphor corner + lift on hover), `.input` (recessed bay + inset shadow), `.switch` (chunky hardware toggle), `.seg` (recessed bay + raised chip), `.led` (the primary-CTA power-on dot) — all live in `_components.css`; specimens consume them.
4. `<designRoot>/system/<ds>/README.md` — philosophy (substitutes mood references + hard-NOs from Q10 + signature treatment summary + voice block).
5. `<designRoot>/system/<ds>/SKILL.md` — the per-DS skill pointer.
6. **`<designRoot>/README.md`** — designRoot orchestration README. **Mandatory Tier 1 file** per `_MAPPING.md`; missing this is the most common bootstrap blocker.
7. **`<designRoot>/INDEX.md`** — canvas + specimen index.
8. `<designRoot>/config.json` — per-repo plugin config with all 14 fields populated.

After Batch A writes, the main agent reads the freshly-written `colors_and_type.css` + `_layout.css` + `_components.css` (when emitted) back into context — those files are passed verbatim to every Batch B/C sub-agent as authoritative reference.

#### Batches B + C — parallel fan-out via sub-agents

Group the remaining files into **5–8 slices** (per the `fanout:` block of the roster). For each slice, spawn one `general-purpose` sub-agent. **Fire all slices in a single message** (multiple Agent tool calls in parallel) — that's the whole point.

**Sub-agent prompt template** (use verbatim, substitute the slice details):

```
You are scaffolding part of a design system. Write {{N}} specimen HTML files in
parallel with other sub-agents. Each file lands at the absolute path listed.

PROJECT
- name: {{project_label}}
- DS slug: {{ds_dirname}}
- one-liner: {{Q1}}
- audience: {{Q2}} · platforms: {{Q3}} · theme default: {{Q4}}
- voice: {{Q8}} ("{{voice_one_line_summary}}")
- signature treatment: {{Q9}} ({{Q9_one_line_summary}})
- hard NOs: {{Q10 csv}}
- iconography vibe: {{Q11}}
- density: {{Q12}}

REFERENCES (verbatim — read first, do not skim)
- TOKENS (authoritative):     {{absolute path to colors_and_type.css}}
- CHROME (signature):         {{absolute path to _layout.css}}
- DS README (hard rules):     {{absolute path to system/<ds>/README.md}}
- _MAPPING.md gating rules:   {{absolute path to _MAPPING.md}}
- inspiration library root:   {{absolute path to plugins/design/templates/design-system-inspiration/}}

YOUR SLICE — write these {{N}} files (absolute paths):
1. {{abs path 1}}  — reference template: {{abs path to inspiration template 1}}
2. {{abs path 2}}  — reference template: {{abs path to inspiration template 2}}
… (etc.)

CREATIVITY RUBRIC — do NOT token-swap. RESTRUCTURE.
- Read the reference template. Understand the SPECIMEN comment header (what it
  demonstrates). Then write a project-flavored equivalent of 1.5×–6× the reference
  LOC. Same demonstration intent, ORIGINAL composition, project's voice, project's
  domain nouns.
- Every specimen earns at least ONE compositional choice that's not in the
  template. Examples that landed well in the studio 2026-05-13 re-bootstrap (use
  these as gold standard, in the same `_history/` folder):
    - colors-accent.html (48 LOC template → 238 LOC): added a brand-spotlight
      hero with masked gradient border, a "wrong" anti-pattern teaching device,
      chroma annotations on swatches.
    - empty-state.html (34 → 217): added a "Voice — keep or kill" panel comparing
      good vs corporate copy side by side; added a variants grid for search-empty
      and inspector-empty.
    - ui_kits-desktop-showcase.html (302 → 1052): replaced the template's
      sports-roster screens with project-specific reality; added a live-cursor
      presence layer + a token-row inspector panel.
  Anti-example from the same run: components-buttons.html (83 → 105) — kept the
  template's fake-state grid almost verbatim. **Don't do this.** Add icon-only
  + kbd-hint variants, push hierarchy contrast, surface the signature treatment
  on the primary's hover state.
- Copy is project-specific. NO "Lorem", NO "Acme Corp.", NO "Get Started". Use
  the project's actual nouns ({{domain_nouns}}). Match the voice — {{Q8 voice}}.
- Tokens only. No hardcoded hex / px / rem. If you reach for an off-ladder
  value, STOP and use the nearest `var(--*)` token. The typography-critic
  catches off-ladder px and will return a blocker.
- Hard NOs from Q10 are guardrails. {{if "no animations" in hard_nos: "Do not add hover/active transitions; static states only."}} {{if "no gradients" in hard_nos: "No linear-gradient / radial-gradient anywhere."}} (etc.)
- Carry the SPECIMEN comment header from the reference template at the top of
  your output so future agents can identify what each file demonstrates.

WHEN DONE
After writing all {{N}} files, update each row in
{{absolute path to _scaffold-roster.yaml}} (status: pending → status: written),
then return a one-line confirmation per file.
```

Sub-agents are stateless — give each a complete brief, do not assume shared context. Three-line confirmation back is enough; the roster is the source of truth.

#### Sequencing

```
Batch A (main agent, serial)         ← ~7 files, 2-3 minutes
  ↓ blocks all of B + C
Batch B (5 sub-agents, parallel)     ← ~12-14 files in ~4-6 minutes wall-clock
Batch C (3-5 sub-agents, parallel)   ← ~10-15 files in ~4-6 minutes wall-clock
  ↓ blocks ui_kits-*-index.html
Index files (main agent, serial)     ← 1-2 files linking every peer; written LAST
```

Batch B and Batch C can also fire **simultaneously** — they have disjoint dependency sets. The wall-clock total drops to ~4-6 minutes vs the 15-25 minutes of serial scaffold.

For each file in the computed set the sub-agent:

- **Core `.tpl` files** (under inspiration `core/`): substitute placeholders from the discovery payload. If `mdcc` is available on PATH, shell out to `mdcc design init --discovery-payload <path>`. Else inline Write.
- **Specimen files**: read the corresponding reference in the inspiration library, then **RESTRUCTURE** following the creativity rubric above. **No placeholder copy** in the output, ever.

Scaffold sources (walk in order, apply gate, generate):

1. **`core/preview/*`** — always-on. 10 preview specimens (colors-{text,surfaces,accent}, type-scale, spacing-scale, motion, components-{buttons,cards,inputs}) + `_layout.css` chrome.
2. **`foundations/*`** — always-on for any `completenessProfile != minimal`. 8 specimens: borders, elevation, focus, grid, iconography, opacity, radii, selection. **Re-curate iconography** to project domain (developer → terminal/file/branch; consumer → home/search; pro → roster/calendar).
3. **`universal/*`** — always-on. 6 components (toggles, dialogs, tooltips, tables, callout, empty-state) + `logo.html` IF wordmark/logotype claim exists.
4. **`status/*`** — IF `"status" ∈ activeFamilies` (default-on). 3 files: colors-status, components-status, skeletons.
5. **`audience-<q2>/*`** — gated on Q2 audience. Pick exactly ONE of audience-developer / audience-pro / audience-consumer. 5–6 files each.
6. **`platform-<q3>/*`** — gated on Q3 platforms. desktop is default-on (2 components + 2 ui_kit entries). mobile adds 4 components + 2 ui_kit entries.
7. **`theme-both/*`** — IF Q4 theme = `both equal`. 1 file: colors-themes-side-by-side.
8. **`patterns/*`** and **`meta/*`** — opt-in only. Not auto-scaffolded; user requests them explicitly via `/design:new` or `config.extensions[]`.

**ui_kit handling** — `platform-<platform>/ui_kits-<platform>-{index,showcase}.html` is **not optional** for any in-scope platform. The two files serve distinct roles:
- `ui_kits-<platform>-index.html` — **catalog/launcher** (links to platform-specific specimens)
- `ui_kits-<platform>-showcase.html` — **full product mock** (multi-screen + theme/accent picker — the highest-leverage "DS in use" artifact)

Both flatten into `system/<ds>/preview/` at scaffold time. **Never scaffold a platform-* directory as an empty stub.** Empty `ui_kits/<platform>/` is the regression the studio bootstrap produced — completeness-critic V12/V13 enforces non-emptiness.

Typical output: 18–30 scaffolded files (10 core + 8 foundations + 6 universal + 5–6 audience + 2–4 platform/ui_kit + 0–3 conditional family). See `_MAPPING.md` "Typical scaffold sizes" for per-profile counts.

Write `<designRoot>/config.json` with `extensions: []`, `completenessProfile: "standard"`, computed `activeFamilies[]`, and the new DS entry in `designSystems[]`.

Write `<designRoot>/system/<ds>/SKILL.md` with `name: ${ds}-design` (or similar slug derived from the project label).

### Copy claim → asset receipt

Before finishing scaffold, **scan the generated README + SKILL.md + specimen ledes for these substrings**: `mascot`, `glyph`, `logotype`, `wordmark`, `illustration`, `hedgehog`, `character`. For every match:

- If `assets/glyphs/` is empty AND no `*.svg` exists in `assets/`, **generate at least one minimal SVG** to back the claim. A simple geometric mark (8–16 lines of SVG) is enough — the goal is "claim has an artifact behind it", not "world-class illustration".
- Alternative: rewrite the copy to remove the claim if no asset is reasonable. Never let "hedgehog mascot energy" survive in copy with an empty `assets/glyphs/`.

This catches the self-injected-puffery drift the studio bootstrap produced.

**Run completeness-critic.** Spawn `design-system-completeness-critic` as a subagent with:

```
config_path: <repo>/.design/config.json
ds_name:     <target_ds>
ds_root:     <designRoot>/system/<target_ds>/
output_path: <designRoot>/_history/_system/000-bootstrap-completeness.md
all_ds:      false
```

The critic emits a JSON verdict. If it returns **blockers**, the bootstrap flow surfaces them in the next-step block and recommends the user re-run with `--force` after addressing each. Warnings are listed in the completion message but do NOT block. Tier 3 (free-form) acknowledgements are listed informationally.

### Visual sanity check (mandatory — agent-browser screenshots)

> **This step exists because completeness-critic is structural only.** It cannot see that the rendered output looks like a generic shadcn page. The screenshots feed the aesthetic critics in the next step AND give the user a fast visual proof.

**If `agent-browser` is not on PATH**, surface this as a warning in the next-step block ("install agent-browser for visual verification") and skip to the aesthetic critic step using only the source HTML — but make the gap explicit to the user.

**agent-browser CLI cheat-sheet** (it is NOT Playwright):

| Goal | Command |
|---|---|
| Open a URL | `agent-browser open "<url>"` |
| Full-page screenshot | `agent-browser screenshot --full <abs-path.png>` |
| Wait for content | `agent-browser wait <selector-or-ms>` |
| Resize viewport | not a top-level command — use `agent-browser eval "window.resizeTo(W, H)"` or pass `--viewport WxH` when supported by your build |
| Help on any cmd | `agent-browser <cmd> --help` |

The studio 2026-05-13 re-bootstrap wasted a Bash turn calling `agent-browser resize` (invalid). Don't.

When available:

1. **Boot the dev server** (or reuse if running). Read `<designRoot>/_server.json` for a live port; otherwise spawn `node plugins/design/dev-server/server.mjs --root <repo>` on the first free port from 4321 with `NO_OPEN=1`. Wait 1.5s, hit `/_health`, confirm `project` matches.
2. **Screenshot 3 signature specimens** to `<designRoot>/_history/_system/000-bootstrap-screenshots/`:
   - `colors-accent.png` — proves the accent color renders as intended
   - `empty-state.png` — proves the brand/personality moment (mascot, copy voice) lands
   - `ui_kits-desktop-showcase.png` — proves the DS works on a real product surface (the multi-screen showcase, not the catalog launcher)

   ```bash
   agent-browser open "http://localhost:<port>/.design/system/<ds>/preview/colors-accent.html"
   agent-browser screenshot "<designRoot>/_history/_system/000-bootstrap-screenshots/colors-accent.png"
   # … repeat for the other two
   ```

3. **Read each screenshot back** with the `Read` tool so they're in your visual context. Direct visual scrutiny BEFORE you spawn the aesthetic critics — if the accent is obviously the wrong hue or the layout is obviously broken, fix it in source NOW rather than asking critics to confirm what you can already see.

### Aesthetic critic panel (mandatory)

> **The completeness-critic does not catch aesthetic gaps.** It returns `pass` for shadcn-generic output. This step is non-negotiable, especially when discovery captured strong references (PostHog, Zed, Linear, Figma, Affinity, Vercel, Raycast, etc.).

Spawn these critics **in parallel** (single message, multiple Agent calls) on one signature specimen — default target is `colors-accent.html` (the accent showcase). When the bootstrap produced a `ui_kits-desktop-showcase.html` (the full product mock), run a second pass on it too — it's the highest-fidelity "DS in use" artifact and the most useful target for graphic-design + signature-moment evaluation.

| Critic | Subagent type | What it catches |
|---|---|---|
| `signature-moment-critic` | `design:design:signature-moment-critic` | Brand prominence, hero moments, mock fidelity, specificity — the "is this portfolio-worthy?" axis |
| `graphic-design-critic` | `design:design:graphic-design-critic` | Composition, hierarchy, balance, density, rhythm, white-space discipline |
| `typography-critic` | `design:design:typography-critic` | Add when DS has dedicated `type-mono.html` or display-typography moments |
| `copy-critic` | `design:design:copy-critic` | Add when discovery Q8 chose a distinctive voice (hacker flair / B2B formal / explanatory-friendly) — catches claim-vs-content drift |

**Surface their verdicts in the next-step block.** Use this threshold matrix:

| Outcome | Action |
|---|---|
| All critics pass, aspiration_score ≥ 3.5 | Print "Bootstrap complete — aesthetic check passed" |
| Any graphic-design blocker, OR aspiration_score < 3.0 | Print "Bootstrap complete with aesthetic warnings — DS scaffold is structurally valid but does NOT match the brief's quality bar yet. Run `/design:edit` on the flagged specimens before calling this done." Surface the top 3 blockers verbatim. |
| Both completeness AND aesthetic critics flagged blockers | Print "Bootstrap produced a structurally broken AND aesthetically weak DS. Recommend `/design:setup-ds <name> --force` after revising the brief." |

**Never silently report "Bootstrap complete" when aspiration_score < 3.0.** That's the regression mode the studio bootstrap landed in.

### Post-Flight (slim)

Bootstrap-mode Post-Flight is **slim** — only DS-specific follow-ups (no environment offers; those belong to `init`):

- Optionally surface a one-shot AskUserQuestion offering `mdcc design serve` if not already running, so the user can browse the freshly-generated specimens.

Everything else (CLAUDE.md, .ai/, agent-browser install hints) was handled during `init` BEFORE bootstrap ran.

### Always-print next steps

```
Bootstrap complete. .design/ scaffolded at <repo>/.design/system/<ds>/.
  <N> specimen pages under preview/ (audience: <Q2>, platforms: <Q3>)
  <M> ui_kit compositions under ui_kits/ (the "DS in use" artifacts)
  config.json: 14 fields populated (incl. extensions, completenessProfile, activeFamilies, designSystems[])

Structural gate — design-system-completeness-critic:
  <N> blockers, <N> warnings

Aesthetic gate — critic panel (run on <signature specimen>):
  signature-moment:    aspiration <X.Y>/5  (blockers: <N>, warnings: <N>)
  graphic-design:      <N> blockers, <N> warnings
  typography:          <N> blockers, <N> warnings    [if applicable]
  copy:                <N> blockers, <N> warnings    [if applicable]

Visual proof — screenshots saved to .design/_history/_system/000-bootstrap-screenshots/:
  colors-accent.png · empty-state.png · ui_kits-desktop-index.png

[IF aspiration < 3.0 OR any graphic-design blocker:]
⚠ Aesthetic gate did NOT pass. The DS is structurally valid but does not match the brief's quality bar.
  Top blockers:
    1. <blocker 1 summary>
    2. <blocker 2 summary>
    3. <blocker 3 summary>
  Recommended: /design:edit "<specific fix>" --perfect, then re-run /design:critic to confirm.

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
