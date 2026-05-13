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

### Scaffold (dynamic)

The inspiration library at `plugins/design/templates/design-system-inspiration/` has **11 category dirs** holding **~67 reference HTML specimens**. The skill walks the categories below in this order, picks files matching the project profile, and **GENERATES** project-flavored versions in `system/<ds>/preview/`. **Scaffold output is flat** — category prefixes (`foundations/`, `audience-developer/`, etc.) live only in the library; the scaffolded files all land directly under `preview/`. See `_MAPPING.md` for the full inventory and gating rules.

For each file in the computed set:

- **Core files** (under `core/`): substitute placeholders from the discovery payload into the `.tpl` files. If `mdcc` is available on PATH, shell out to `mdcc design init --discovery-payload <path>`. Else inline Write.
- **Specimen files** (under all preview-bearing dirs): read the corresponding reference in the inspiration library, then **GENERATE a fresh project-flavored version** — same layout/composition, project's tokens, project's copy voice. **No placeholder copy** ("Lorem Solutions Inc.", "Click here", etc.) in the output.

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
