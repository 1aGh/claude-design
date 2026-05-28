# Sub-agent prompt templates — `/design:setup-ds` Batch B + C

> **Why this file exists.** Per Phase 3.7 Task 4 (and DDR-049), the sub-agent prompt templates that drive Batch B + C fan-out used to live inline in `plugins/design/skills/design-system/SKILL.md` (lines 662-797 pre-extraction). SKILL.md is 1000+ LOC; the prompts were buried. Extracting them here lets us audit + extend the prompts (and especially the three MANDATORY safety blocks below) without scrolling through unrelated bootstrap logic. The skill's "Batches B + C" step loads + interpolates from this file instead of inlining the template.
>
> **Sync rule** — when this file changes, the SKILL.md reference must still resolve. The Phase 3.7 risk register mandates a CI grep check: `SKILL.md` must literally contain the string `SUB-AGENT-PROMPTS.md`. Don't rename the file without updating the skill.

The prompts are grouped by **slice** (matches the roster's `fanout:` block). Each section is a self-contained sub-agent brief — copy verbatim, substitute placeholders.

The three MANDATORY safety blocks (ANIMATION SAFETY, RELATIVE-URL SAFETY, PLACEHOLDER POLICY) appear once at the top because they apply to every slice; sub-agent prompts reference them by name (`Apply ANIMATION SAFETY below`) instead of inlining.

---

## MANDATORY SAFETY BLOCKS (apply to every slice; cited by name in prompts)

### ANIMATION SAFETY (mandatory — applies to motion specimen + any canvas with @keyframes / transitions)

- **Tooling contract first (DDR-049).** The authoritative rule for WHICH tool to use is the "Animation tooling contract" in `skills/design-system/SKILL.md`: the **default for both specimens and canvases is `<MotionDemo role>` / the canvas-lib vocabulary from `@maude/canvas-lib`** (wraps `motion/react`), NOT hand-rolled `@keyframes`. Pure-CSS `.motion-*` role classes are a justified-only zero-JS escape hatch. The CSS rules below apply to that escape hatch and to the bounded-geometry constraints the vocabulary already satisfies — they do NOT license reaching for `@keyframes` by default.
- **Bounded geometry.** Every tile that hosts a rotating / scaling animation MUST have `overflow: hidden`. Otherwise the bounding box extends ~√2× at 45°/135° rotations and overflows adjacent rows. **The motion specimen tiles all set `overflow: hidden` explicitly** — codify this with a CSS comment so future agents reading the file see the rationale.
- **Sparkle / pulse / twinkle = small only.** Keyframes that scale from `0 → 1 → 0` (or similar "appear-and-disappear" patterns) are for elements ≤56px. **Never apply to full-width tiles.** Demo sparkle on a 32×32 chip inside a tile, never on the tile itself. The studyfi imprint retro D-3 caught a sparkle-on-full-tile that exploded the whole row.
- **Loop motion = `infinite alternate`.** Specimens meant for continuous display use `animation: <kf> <dur> infinite alternate <easing>`. Single-shot animations finish in 150-200ms and leave the demo invisible on the second look — "looks dead until you hover" is the regression mode.
- **Compositor-only.** Animate `transform` + `opacity` only. Never `width`, `height`, `top`, `left`, `padding`, `margin`. Layout-dirty animations break adjacent geometry AND cost paint cycles.
- **Reduced motion is mandatory.** Tokens already collapse `--dur-*` to `1ms` when `@media (prefers-reduced-motion: reduce)` is set. Do NOT add `!important` overrides outside the motion specimen itself (the specimen has a `<ReducedMotionToggle>` chrome that reviewers use to flip both branches without OS settings — that's the only documented exception). If using `motion/react`, use `useReducedMotion()` and short-circuit the `animate` prop.
- **No bouncy springs by default.** Springs say "Toy", not "Pro Tool". Use `spring` role only when the DS brief explicitly asks for it (e.g. brief mentions "playful" / "tactile" / "physical" / "bouncy"). Default to `tween` with the standard easing tokens.

### RELATIVE-URL SAFETY (mandatory — applies to any specimen referencing assets, logos, glyphs)

- The dev-server serves canvases via `/_canvas-shell.html?canvas=<rel-path>`. **Relative URLs (`../foo.svg`, `./assets/logo.svg`) resolve against the SHELL's URL, not the canvas file's location.** Result: 404 / broken-image icon. Studyfi imprint retro D-4 was caught by the user mid-flow because of exactly this.
- **Always inline SVGs** in JSX. Use `useId()` for any `<filter id>` / `<linearGradient id>` so multiple instances of the same component don't collide on a single page. OR
- **Always use absolute paths rooted at `/assets/...`** served from the dev-server's static mount. The `system/<ds>/assets/` directory is mounted at `/assets/<ds>/` in production-handoff mode.
- **Forbidden:** `<img src="../foo.svg">`, `<image href="./logo.svg">`, `url('../bg.png')` inside inline `<style>` blocks. Any of these surviving in a specimen is a graphic-design-critic blocker.

### PLACEHOLDER POLICY (mandatory — applies to logo / mark / wordmark / mascot / glyph / illustration claims)

- Before writing a placeholder SVG, the orchestrator MUST have run the pre-scaffold real-asset sweep (`bin/asset-sweep.sh`). The sweep populates the roster's `assets:` block with `source: <production path>` for every noun where a real asset exists. **Sub-agents read the roster** — if `source:` is populated for a noun, COPY the asset; do NOT invent a placeholder.
- If the sweep returned zero candidates for a noun, only THEN may a placeholder be authored. **The placeholder file's name MUST contain `-placeholder`** (e.g. `logo-placeholder.svg`, `mascot-placeholder.svg`) so it's visually obvious in `ls` + `grep` and downstream sub-agents know not to promote it.
- **Never assume your own placeholder path is authoritative downstream.** When the roster row's `source:` is empty AND you wrote a placeholder, set `source: placeholder` in your roster update (not `source: written`). The brand-critic and the next bootstrap pass both look for `source: placeholder` rows as "consider revisiting later".
- **Forbidden:** authoring an `S`-shaped wordmark for a product whose first letter isn't S, authoring a "hedgehog mascot" SVG because the README copy mentioned hedgehog energy. The studyfi imprint retro D-2 caught both patterns. If the production-asset sweep returned nothing AND the discovery brief didn't explicitly request a mascot, **rewrite the copy** instead of inventing the artifact.

---

## Sub-agent prompt template (slice-agnostic — used by every Batch B + C slice)

```
You are scaffolding part of a design system. Write {{N}} specimen TSX files in
parallel with other sub-agents. Each file lands at the absolute path listed.

SHAPE — every specimen TSX is BARE — NO canvas-lib envelope. The shape:

  /** JSDoc header (see template) */
  import "./<slug>.css";  /* per-specimen bespoke CSS — sibling file */

  export default function <PascalName>() {
    return (
      <>
        <header className="specimen-hd">
          <span className="sku">MDCC-DSN/01.<slug></span>
          <span className="crumbs">...</span>
          <span className="theme-toggle" ...>...</span>
        </header>
        <main className="specimen">
          <section className="specimen-title">
            <h1>...</h1>
            <p className="lede">...</p>
          </section>
          {/* sections, h2 dividers, tables, etc. */}
        </main>
      </>
    );
  }

Specimens are FLOWING reference pages, not viewport mocks. Do NOT wrap in
`<DesignCanvas><DCSection><DCArtboard>` — `_layout.css` styles `<body>` as
a flex column directly. The original .html-era specimens had exactly this
shape; we keep it one-for-one in TSX.

Canvas-lib (`@maude/canvas-lib`) is reserved for UI mock canvases with
multiple fixed-px artboards (Docs Site, Canvas Viewport). Specimens do NOT
import it. Token/theme hooks (`useTokens`, `useTheme`) ARE available if a
specimen genuinely needs them — but bare CSS via `var(--*)` is the default.

**Motion specimens are the documented exception.** The motion specimen
(when scaffolded) imports motion helpers from `@maude/canvas-lib`:
`<MotionDemo role>`, `<MotionTrack>`, `<TokenPlayback>`, `<ReducedMotionToggle>`,
`useMotionTokens()`. Other specimens stay bare. See ANIMATION SAFETY above.

Per-specimen bespoke CSS lives in a sibling `<slug>.css`. The dev-server's
canvas-build.ts collects this and injects it as a `<style>` at module init
so the drop is self-contained.

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
- COMPONENTS (when emitted):  {{absolute path to _components.css OR "(not emitted — inline styles only)"}}
- DS README (hard rules):     {{absolute path to system/<ds>/README.md}}
- _MAPPING.md gating rules:   {{absolute path to _MAPPING.md}}
- inspiration library root:   {{absolute path to plugins/design/templates/design-system-inspiration/}}
- ROSTER (your slice + assets): {{absolute path to _scaffold-roster.yaml}}
{{if peer_DS_references_attached:}}
- PEER DS gold-standard:      {{absolute paths to system/<peer-ds>/preview/<file>.tsx}}
{{endif}}

DOMAIN_NOUNS (authoritative — every specimen MUST use only these nouns)
{{domain_nouns}}    # the 5–10 nouns from discovery payload's domain_nouns field — project-native vocabulary the specimen must use
{{if peer_DS_references_attached:}}
DOMAIN NOUN PURGE — peer DS references are COMPOSITION REFERENCES ONLY. The peer
DS uses different domain nouns (a peer DS built for a different product domain
will have nouns specific to that domain). When restructuring from a peer reference,
search-and-replace EVERY peer-DS noun in your output with a noun from this DS's
DOMAIN_NOUNS list. A single peer-DS noun surviving in your output is a copy-critic
blocker — leaked domain nouns from a peer reference (e.g. "publish <peer-noun>"
surviving into this DS's specimen) is the regression mode this purge step prevents.
{{endif}}

YOUR SLICE — write these {{N}} files (absolute paths):
1. {{abs path 1}}  — reference template: {{abs path to inspiration template 1}}
2. {{abs path 2}}  — reference template: {{abs path to inspiration template 2}}
… (etc.)

SAFETY BLOCKS — apply to every file in your slice:
- **ANIMATION SAFETY** (see SUB-AGENT-PROMPTS.md). Mandatory if your slice
  includes the `motion` specimen OR any file that uses `@keyframes` /
  `transition` / `animate`. Bounded geometry + sparkle-≤56px + infinite-alternate
  + compositor-only + reduced-motion + no-bouncy-springs.
- **RELATIVE-URL SAFETY** (see SUB-AGENT-PROMPTS.md). Mandatory if your slice
  references ANY asset (logo, glyph, illustration, background image). Inline
  SVG with `useId()`, OR absolute `/assets/<ds>/...` path. NEVER relative.
- **PLACEHOLDER POLICY** (see SUB-AGENT-PROMPTS.md). Mandatory if your slice
  scaffolds the `logo` / `empty-state` specimen or any brand-asset surface.
  Read the roster `assets:` block FIRST. If `source:` is populated, copy the
  real asset; do NOT invent. If `source:` is empty AND the noun is genuinely
  warranted, author a `-placeholder` SVG and set `source: placeholder` in your
  roster update.

CREATIVITY RUBRIC — do NOT token-swap. RESTRUCTURE.
- Read the reference template. Understand the SPECIMEN comment header (what it
  demonstrates). Then write a project-flavored equivalent of 1.5×–6× the reference
  LOC. Same demonstration intent, ORIGINAL composition, project's voice, project's
  domain nouns.
- Every specimen earns at least ONE compositional choice that's not in the
  template. Examples that landed well in the studio 2026-05-13 re-bootstrap (use
  these as gold-standard creativity moves):
    - colors-accent.tsx (48 LOC template → ~5× LOC): added a brand-spotlight
      hero with masked gradient border, a "wrong" anti-pattern teaching device,
      chroma annotations on swatches.
    - empty-state.tsx (~6× LOC): added a "Voice — keep or kill" panel
      comparing good vs corporate copy side by side; added a variants grid for
      multiple empty-state cases.
    - ui_kits-<platform>-showcase.tsx (~3× LOC): replaced the template's
      generic mock screens with project-specific reality from the discovery
      payload's domain_nouns; added a live-presence layer + a token-row
      inspector panel where the brief warranted it.
  Anti-example: a components-buttons.tsx at 1.3× the template LOC that kept
  the template's fake-state grid almost verbatim. **Don't do this.** Add
  icon-only + kbd-hint variants, push hierarchy contrast, surface the signature
  treatment on the primary's hover state.
- Copy is project-specific. NO "Lorem", NO "Acme Corp.", NO "Get Started". Use
  the project's actual nouns ({{domain_nouns}}). Match the voice — {{Q8 voice}}.
- Tokens only. No hardcoded hex / px / rem. If you reach for an off-ladder
  value, STOP and use the nearest `var(--*)` token. The typography-critic
  catches off-ladder px and will return a blocker.
- Hard NOs from Q10 are guardrails. {{if "no animations" in hard_nos: "Do not add hover/active transitions; static states only."}} {{if "no gradients" in hard_nos: "No linear-gradient / radial-gradient anywhere."}} (etc.)
- Carry the SPECIMEN comment header from the reference template at the top of
  your output so future agents can identify what each file demonstrates.

ANTI-PATTERNS (graphic-design-critic blockers — guaranteed rejection)
- Multiplayer cursors / annotation pins / presence avatars MUST anchor to
  SPECIFIC content (a toolbar button, a list row, a panel, a swatch). Pins
  floating over canvas void are a fail mode. If you don't have content for a
  pin to anchor, REDUCE the pin count to match available anchor count. (Caught
  on studio-2 showcase, retro BAD-8.)
- Cropmarks / signature framing devices must be visually thicker than internal
  panel borders, otherwise they read as "another panel" not "this is the
  staging frame".
- Sections in long specimens (≥ 4 sections) must vary in vertical weight — the
  hero / signature section earns 25–30%, not equal share with policy sections.

WHEN DONE
After writing all {{N}} files:
  1. Update each row in {{absolute path to _scaffold-roster.yaml}}: change
     `status: pending` → `status: written, loc: <line-count>`.
  2. **Do NOT add new rows.** If you discover a missing claim (e.g. wordmark
     referenced but no logo.tsx in roster), include "ROSTER GAP: <description>"
     in your completion message. The main agent reconciles new rows.
  3. Return a one-line confirmation per file with LOC.
```

Sub-agents are stateless — give each a complete brief, do not assume shared context. Three-line confirmation back is enough; the roster is the source of truth.

---

## Per-slice prompt addenda

The base template above applies to every slice. Each slice gets a small addendum to steer the sub-agent toward the slice-specific anti-patterns and the safety blocks that apply.

### Slice: `foundations` (color tokens, type + spacing, motion, radii/elevation/focus, iconography/borders/grid)

**Apply ANIMATION SAFETY in full.** The `motion` specimen is the highest-friction file in this slice — D-3 from the imprint retro landed here. Specifically:
- Motion specimen MUST use `<MotionDemo>` from `@maude/canvas-lib`, NOT inline `@keyframes` literals (DDR-049 enforces the canonical library).
- 4 duration tokens (`--dur-flip`, `--dur-panel`, `--dur-route`, `--dur-soft`) MUST each be referenced ≥ 1× by the motion specimen — completeness-critic asserts coverage post-scaffold.
- The specimen MUST animate on first paint. Hover-driven CSS transitions alone fail the "looks dead at rest" smell test.

**Apply RELATIVE-URL SAFETY in full.** The `iconography` specimen tends to reference glyph SVGs; the `focus` specimen sometimes references focus-ring fixtures. Inline ALL SVGs.

### Slice: `brand + voice` (empty-state, logo)

**Apply PLACEHOLDER POLICY in full.** This slice is the highest-risk for placeholder-bleed. The `logo` specimen MUST start by reading the roster's `assets:` block:
- If `assets.logo.source` is a real path, the specimen `<img>`s / inlines the real asset.
- If `assets.logo.source` is empty, fall back to a `-placeholder` SVG with the rationale in the JSX comment block. Set `source: placeholder` on roster update.

**Apply RELATIVE-URL SAFETY in full.** Logo specimens are 100% asset-bound. Inline SVG is the default; absolute `/assets/<ds>/logo.svg` is the alternative.

### Slice: `core components` (components-buttons, components-cards, components-inputs)

Buttons frequently get hover transitions — apply ANIMATION SAFETY (compositor-only). Cards frequently get a hover lift — same constraint, transform-only.

### Slice: `universal` / `audience-*` / `platform-*`

No slice-specific addenda — the base template covers them.

### Slice: `ui_kits-*-showcase` (main agent OR signature sub-agent)

**Apply ANIMATION SAFETY.** Showcase is the highest-density "DS in use" artifact; presence cursors, route transitions, and panel slides all show up here. Every animation must be bounded + reduced-motion-safe + token-derived.

**Apply RELATIVE-URL SAFETY.** Showcase often references domain product imagery. Inline SVG mocks, never `<img src="../assets/...">`.

---

## Cross-links

- Owner skill: `plugins/design/skills/design-system/SKILL.md` (BOOTSTRAP flow → "Batches B + C — parallel fan-out via sub-agents" section loads this file)
- Discovery probe templates (sibling): `plugins/design/skills/design-system/_pastier-probe-templates.md`
- Motion library decision: `.ai/decisions/DDR-049-motion-one-as-canonical-motion-library.md`
- Imprint-bootstrap retro (source of D-1 … D-5): `.ai/logs/system-reviews/imprint-bootstrap-review-2026-05-26.md`
- Asset sweep helper: `plugins/design/dev-server/bin/asset-sweep.sh`
- Visual sanity helper: `plugins/design/dev-server/bin/visual-sanity.sh`
