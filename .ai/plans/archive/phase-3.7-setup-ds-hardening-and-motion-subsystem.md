# Phase 3.7 — `/design:setup-ds` hardening + motion subsystem unification

> **Position.** Sits after Phase 3.6.1 (canvas envelope + DS specimens as TSX). Closes two gaps that were exposed by the `studyfi-imprint` bootstrap retro (`/Volumes/D/git/AI-StudyMate/.ai/logs/system-reviews/design-system-imprint-bootstrap-review.md`):
>
> 1. **`/design:setup-ds` ships first-pass regressions that one screenshot would have caught.** Three of four bad divergences (logo placeholder, sparkle overflow, broken-image relative URL) were structural-critic blind spots — the loop has no visual-sanity gate.
> 2. **Motion is CSS-only and reactive.** The motion specimen is hover-driven so on initial paint it looks dead. There's no canonical library, no playground, no AI-readable motion vocabulary — sub-agents ship sparkle keyframes on full-width tiles because nothing in the prompt says "sparkle is for ≤56px elements." Production handoff via `registry-item.json` has no place to declare a motion dep.
>
> Mirrors the discipline of Phase 3.6 (canvas TSX format): one runtime, one library, one preview shape, AST-readable, handoff-clean, screenshot-verified. **Motion becomes a first-class subsystem like the canvas TSX format itself, not a per-canvas CSS afterthought.**

## Description

Two interlocked workstreams, one phase, because the visual-sanity gate (workstream A) is the same screenshot pass that catches the motion regressions workstream B prevents — splitting them would re-introduce the very loop the retro flagged.

**A. `/design:setup-ds` hardening (5 review-driven changes):**

- **A1 — Pre-scaffold Real-Asset Sweep.** Before Batch A writes any placeholder asset, grep the target repo for production sources of `{logo, mark, wordmark, mascot, glyph, illustration}`. Single hit at a conventional path → copy 1:1. Multiple hits → `AskUserQuestion`. Zero hits → only THEN write a placeholder. Eliminates placeholder-bleed (D-2 in the review).
- **A2 — Mandatory post-scaffold visual sanity.** Currently "Visual sanity check" is in the spec but treated as a soft gate that gets skipped when `dev-server` boot looks heavy. Flip it: dev-server boot is mandatory, failure surfaces as an `AskUserQuestion` ("dev-server boot failed: <reason> — skip visual sanity or fix and retry?"), never silently elided. Three screenshots minimum: `colors-*`, `motion`, and the logo specimen if scaffolded. Each PNG is `Read` back into context so the agent actually sees what shipped. Closes D-3 and D-4.
- **A3 — Sub-agent prompt template `ANIMATION SAFETY` block.** Add to the foundations slice prompt (and any slice that scaffolds a motion specimen) a hard-rule callout: sparkle/pulse/twinkle keyframes are for ≤56px elements; rotating elements need `overflow: hidden`; loop animations meant for continuous display use `infinite alternate`, never single-shot; relative URLs in dev-server context resolve against `_canvas-shell.html`'s location, not the file location — inline SVG or absolute paths only. Closes D-3 mechanically.
- **A4 — Bypass-surfacing rule.** When the agent infers permission to deviate from the skill spec (user said "pokracuj autonomně" earlier, brief contradicts spec, `--quick` flag), the deviation MUST be posted as a 1-line "Deviating from skill spec because <reason> — say `stop` to abort" and `_history/_system/<ds>-bypass-log.md` records it. The autonomy permit covers execution speed, not scope renegotiation. Closes D-1 and D-5.
- **A5 — 4 kola critic panel enforcement (configurable, not silently skip-able).** The skill currently lets imprint mode skip Kolo 2-3 (Atraktivita + Konzistence) by inference. Replace with an `AskUserQuestion` at scaffold-end: "Run full 4 kola critic panel (recommended) | Skip — imprint only | Custom subset". If user picks "Skip", reason is recorded to the bypass log. `motion-critic` becomes **mandatory** whenever the motion specimen exists (overrides scope opt-out for that single critic).

**B. Motion subsystem — Motion One (motion/react) + canvas-lib helpers + TSX playground specimen:**

- **B1 — Adopt `motion/react` as the canonical motion library.** Motion One (`npm i motion`) is framer-motion's successor by the same author (Matt Perry). ~10 KB gz vs ~30 KB framer-motion. Native React 19. Same API surface, so any sub-agent that knows framer-motion writes valid code by default. Shadcn registry items in 2026 routinely depend on `motion`. Production handoff parity (v0, Lovable, Next.js targets all consume it natively). Per-canvas opt-in: `meta.motion: "css" | "motion-one"` — default flips to `motion-one` when a canvas-lib motion helper is imported. **Phase 3.7 ships motion-one as a dependency of the canvas-lib + a peer dep in handoff manifests; it does not force every canvas to use it.**
- **B2 — `canvas-lib` motion helpers.** Add to `plugins/design/dev-server/canvas-lib.tsx`:
  - `<MotionDemo role="flip|panel|route|soft|spring|scroll|drag|presence" loop?: "always" | "hover" | "once">` — the foundational building block. Wraps `motion.div` from `motion/react` with the correct duration/easing token applied + `prefers-reduced-motion` handled. Default `loop="always"` so initial paint shows motion (closes the "looks dead on first load" failure mode).
  - `<MotionTrack>` — a row that hosts multiple `<MotionDemo>` children with staggered entries (children stagger 40 ms by default).
  - `<TokenPlayback duration="--dur-panel" easing="--ease-in-out">` — single-shot replay-on-click chip; click to fire, label shows the token name. Used in the motion specimen so the user can probe a single role without hovering a card.
  - `useMotionTokens()` hook — returns `{ flip, panel, route, soft }` parsed from CSS custom props (so canvases can plug numeric values into `motion`'s `transition.duration`).
  - `<ReducedMotionToggle>` — chrome control on the motion specimen that flips a `data-reduced-motion` attribute on the host; for AI inspection (the spec invariant is OS-level `prefers-reduced-motion`, but the toggle lets reviewers eyeball both branches without OS settings).
- **B3 — Motion specimen as a playground TSX.** Migrate `plugins/design/templates/design-system-inspiration/core/preview/motion.html` → `motion.tsx.tpl`. New shape:
  - **8 role tiles** (flip, panel slide, route enter, soft fade, spring snap, scroll-link, drag-spring, presence-arrival), each as a `<MotionDemo>` looping by default with `alternate infinite`. **Initial paint = full motion vocabulary playing.** No hover required.
  - **Token chip rail** — 4 `<TokenPlayback>` chips for the duration tokens. Click → replay. Label shows token name + numeric value.
  - **Easing curve graphs** — 2 small SVG curves for `--ease-out` and `--ease-in-out`, generated from the token values (not hand-drawn).
  - **`<ReducedMotionToggle>` chrome.**
  - **Inline a11y note** — the standing `@media (prefers-reduced-motion: reduce)` block + the toggle, side by side.
  - **Bounded geometry** — every demo card has `overflow: hidden`. Sparkle role explicitly demo'd on a 32×32 chip, NOT the full card. Codified as a comment.
- **B4 — Setup-ds template + scaffolder.** `plugins/design/templates/design-system-inspiration/core/preview/motion.tsx.tpl` ships as TSX. Foundations slice's sub-agent prompt template imports it verbatim. The motion-specimen Roster row uses extension `.tsx`. Tokens `colors_and_type.css.tpl` unchanged (motion tokens already live there).
- **B5 — Handoff: motion in `registry-item.json`.** `/design:handoff` walks canvas imports via `Bun.Transpiler.scanImports()`. If the canvas imports a motion helper from `@maude/canvas-lib`, the resulting `registry-item.json` declares `"motion"` in `dependencies` and the AST-stripped TSX exported into `files[0].content` rewrites the `@maude/canvas-lib` motion import to `motion/react` directly (so the dropped component has no canvas-lib runtime dependency on the target side). The non-motion canvas-lib primitives (DesignCanvas, DCArtboard) are still inlined per Phase 3.6.1's handoff rule.
- **B6 — Canvas Viewport + Smoke TSX motion fixes.** Canvas Viewport already uses `prefers-reduced-motion`-guarded animation in canvas-lib's pan/zoom hook (`animateTo`). Audit + tighten: ensure all 6+ artboards on a single canvas keep transforms compositor-only, no `width/height` keyframes leak through. Smoke TSX gets a single `<MotionDemo role="flip">` so the smoke suite covers the motion path.

**C. AI-readability + auto-routing:**

- **C1 — `motion-critic` auto-routes when motion specimen exists.** `/design:critic` panel routing currently looks at canvas content. Extend: any DS scaffold with `system/<ds>/preview/motion.tsx` present automatically queues `motion-critic` in Kolo 2, regardless of opt-out scope (the only universally-mandatory critic alongside `a11y-critic`).
- **C2 — `design-system-completeness-critic` adds 2 motion checks:**
  - Motion specimen renders without console errors (Bun.build smoke).
  - Every `--dur-*` token is referenced at least once by the motion specimen (catches "the token exists but nothing demonstrates it").
- **C3 — `design-system-keeper` learns motion patterns.** When auditing a new canvas, the keeper also greps `_lib/canvas-lib.tsx` exports + the motion specimen for motion helpers. If the new canvas hand-rolls a `@keyframes` block that has a 1:1 canvas-lib equivalent, raises a "pattern reinvention" warning (≥1 reinvention promotes to blocker, matching the existing rule).
- **C4 — `_components.css` motion role classes.** Optional shared anatomy for canvases that don't want full `motion/react` (CSS-only escape hatch): `.motion-flip`, `.motion-panel`, etc. preset to the right token + easing. So a canvas can opt into the vocabulary with `<div className="motion-flip">` without importing `motion/react`. Decouples vocabulary from runtime.

**Out of scope:**

- Page-level route-transition orchestration via `motion`'s `LayoutGroup` / `AnimatePresence` at the canvas-shell level. Per-canvas motion is enough for the design-time loop; the shell-level orchestration belongs to Phase 5+ work on canvas-tab transitions.
- Lottie / Rive integration. Token-driven motion only.
- Scroll-trigger libraries (GSAP/ScrollTrigger). Motion One's `useScroll` covers the common case; richer scroll-linked work is out.
- New motion tokens. The existing 4-duration + 2-easing ladder is sufficient and matches `motion-critic`'s expectations.

## User Story

As Claude running `/design:setup-ds studyfi --imprint` on a fresh repo, I want (1) the agent to grep `packages/ui/` for an existing logo before inventing a placeholder, (2) the motion specimen to scaffold as a playground that's already moving on first paint and that's safe-by-construction (overflow-bounded, looping, token-derived), and (3) the post-scaffold panel to be three screenshots + four critics so the studyfi user doesn't have to be the visual-regression suite. As Claude later writing `/design:handoff` on a canvas that uses `<MotionDemo role="panel">`, I want the registry-item to drop into a Next.js + shadcn project with `bunx shadcn add` and have the panel animation Just Work because `motion` is already declared as a dep.

## Problem

| Symptom | Current cause | Impact |
| --- | --- | --- |
| `/design:setup-ds` ships placeholder logo when production logo exists in repo | No pre-scaffold asset sweep; placeholder bleeds through sub-agent prompts | User has to manually point the agent at `packages/ui/.../logo/` mid-fix-pass (D-2) |
| Motion specimen explodes on first paint (sparkle on full-width tile) | Sub-agent prompt lists sparkle alongside fade/slide as uniform "demos"; no animation-safety callout; no bounded geometry rule | Two fix passes to land a working specimen; specimen quality dictates first user impression of the DS (D-3) |
| Logo specimen broken-image after fix-pass | Relative URL `../assets/logo.svg` resolves against `_canvas-shell.html`'s URL not file location; structural critic doesn't render | One more fix pass (D-4) |
| Skipping 4 kola critic panel ships untested DS | Imprint inference path silently elides Kolo 2-3; no surfacing to user | Quality drops without user knowing the safety net is off (D-5) |
| Motion specimen looks dead until you hover | Hover-driven CSS transitions only; passes structural critic | Reviewer thinks DS has no motion; sub-agents replicate the "dead specimen" pattern in their UI canvases |
| No canonical motion library | Canvas-lib has pan/zoom hook, but no exposed motion primitive; sub-agents reach for `@keyframes` literals every time | Each canvas re-invents motion; sparkle-on-tile and stale-once-only animations recur |
| `/design:handoff` registry-item has no place to declare motion | `Bun.Transpiler.scanImports()` only sees `@maude/canvas-lib` — opaque to the target project; production drop has no animation | Handoff lands "production-ready" components that are visibly static in the target Next.js app |
| `motion-critic` is opt-in | Auto-routing currently fires only when canvas already has `@keyframes` — a specimen-less DS slips past | A DS with broken motion specimen merges if the user doesn't manually request `--agent motion-critic` |

## Solution

Six task blocks. Each block atomic; A and B can run in parallel after Task 0/1 land the foundation.

**A. Setup-ds hardening (5 tasks):** real-asset sweep helper, visual-sanity gate, sub-agent prompt template animation-safety callout, bypass-surfacing rule, 4-kola panel enforcement.

**B. Motion subsystem (5 tasks):** add `motion` dep, canvas-lib helpers, TSX playground specimen, handoff motion declaration, codemod migrate AI-StudyMate + reference repo specimens.

**C. AI/critic plumbing (3 tasks):** motion-critic auto-route, completeness-critic motion checks, keeper motion priors.

**D. Cross-cutting (1 task):** DDR-049 records motion-library decision.

## Metadata

- **GitHub Issue**: (none — internal architecture phase)
- **Type**: Refactor + new capability (high impact — touches setup-ds, every DS bootstrap, every motion-using canvas, handoff path)
- **Complexity**: High
- **App/Package**: `plugins/design` (skills, agents, commands, templates, dev-server canvas-lib)
- **Affected Systems**:
  - `plugins/design/skills/design-system/SKILL.md` — pre-scaffold asset sweep, visual sanity gate, bypass surfacing, 4-kola enforcement
  - `plugins/design/commands/setup-ds.md` — thin wrapper; mostly skill changes, but `--imprint` flag handling for A4
  - `plugins/design/templates/design-system-inspiration/core/preview/motion.tsx.tpl` (new, replaces `.html`)
  - `plugins/design/templates/design-system-inspiration/core/preview/_components.css` (motion role classes added)
  - `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md` (or inline in SKILL.md) — `ANIMATION SAFETY` block
  - `plugins/design/dev-server/canvas-lib.tsx` — `<MotionDemo>`, `<MotionTrack>`, `<TokenPlayback>`, `<ReducedMotionToggle>`, `useMotionTokens`
  - `plugins/design/dev-server/canvas-build.ts` — motion-one externals + virtual-module resolution if needed
  - `plugins/design/dev-server/handoff.ts` — motion import rewrite (`@maude/canvas-lib` → `motion/react`)
  - `plugins/design/agents/motion-critic.md` — gains "specimen-present" auto-route trigger
  - `plugins/design/agents/design-system-completeness-critic.md` — 2 new motion checks
  - `plugins/design/agents/design-system-keeper.md` — motion-pattern lift-first rule
  - `plugins/design/dev-server/bin/asset-sweep.sh` (new) — production-asset grep helper
  - `plugins/design/dev-server/bin/visual-sanity.sh` (new) — boots dev-server + screenshots N specimens + reads PNGs back
  - `scripts/migrate-motion-specimen.ts` (new, one-shot) — codemod for any project still holding `motion.html`
  - `.design/system/project/preview/motion.tsx` (this repo's own DS — dogfood the new specimen first)
  - `.ai/decisions/DDR-049-motion-one-as-canonical-motion-library.md` (new)
- **Dependencies**:
  - **Hard-blocks-on Phase 3.6.1** (canvas envelope + DS specimens as TSX). Specimens must already render as TSX for this phase to plug into the lib.
  - New runtime dep in canvas-lib package: `motion ^11` (Motion One). Added as a peer-dep of `@maude/canvas-lib` so handoff registry-item declares it cleanly.
  - No new dev-time toolchain. Uses existing `oxc-parser` + `magic-string` from Phase 3.6 for handoff import rewrite.
- **Blocks**: nothing critical. Phase 5+ shell-level transitions get easier; Phase 12 in-canvas CSS editor reads cleaner motion vocabulary; Phase 10 Yjs co-editing benefits from bounded specimen geometry.
- **Does NOT block**: Phase 4 (Pixi canvas), Phase 7-9 (collab) — orthogonal.

## Performance budgets

| Metric | Target | Measurement |
| --- | --- | --- |
| Motion specimen first paint (cold dev-server, no cache) | **< 350 ms** to first motion frame | `performance.timeOrigin` + animationFrame marker injected by `<MotionDemo>` |
| Motion specimen total weight (TSX + lib motion code shipped) | **< 18 KB** raw / **< 6 KB** gz typical | `du` on bundled output |
| `motion/react` bundle delta on a canvas that imports one helper | **< 12 KB** gz over baseline canvas | Compare `Bun.build` output size pre/post `<MotionDemo>` add |
| Setup-ds real-asset sweep wall clock | **< 2 s** for a 50k-file monorepo | `time scripts/asset-sweep.sh /tmp/large-repo` |
| Setup-ds visual sanity sweep (3 PNGs + 3 Reads) | **< 25 s** end-to-end | `time` over `visual-sanity.sh` |
| `motion-critic` auto-route detection (does the canvas use motion?) | **< 50 ms** per canvas | grep-pattern check on `_locator.json` + canvas TSX |
| Handoff motion-import rewrite (one canvas) | **< 5 ms** | bench `handoff.ts emitRegistryItem()` with a motion-using fixture |

Regression on any gate → revert before merge.

## Context References

### Must-read files

- `/Volumes/D/git/AI-StudyMate/.ai/logs/system-reviews/design-system-imprint-bootstrap-review.md` — **the source-of-truth for workstream A**. D-1 through D-5 + the "Specific improvement actions" section map 1:1 to Tasks A1–A5.
- `plugins/design/skills/design-system/SKILL.md` (955 LOC) — bootstrap + iteration spec. Lines around "Pre-scaffold" + "Visual sanity check" + "4 kola critic panel" are the surgical edits.
- `plugins/design/commands/setup-ds.md` (115 LOC) — thin wrapper that delegates to the skill. `--imprint` + `--quick` flag handling.
- `plugins/design/agents/motion-critic.md` (143 LOC) — current motion critic. Becomes mandatory + gains specimen-presence auto-trigger.
- `plugins/design/agents/design-system-completeness-critic.md` — gets 2 motion checks added.
- `plugins/design/agents/design-system-keeper.md` — motion-pattern lift-first rule.
- `plugins/design/dev-server/canvas-lib.tsx` — host for `<MotionDemo>` and friends. Existing `prefers-reduced-motion` handling (line 163, 540, 554, 711) is the canonical pattern to mirror.
- `plugins/design/templates/design-system-inspiration/core/preview/motion.html` — the artifact being replaced. Read first; the 4-role grid + token mapping carries over verbatim to the TSX version.
- `plugins/design/templates/design-system-inspiration/core/colors_and_type.css.tpl` (lines 96-115) — duration + easing tokens + reduced-motion guard. Unchanged. Source of truth for `useMotionTokens()`.
- `.ai/plans/archive/phase-3.6-canvas-tsx-format.md` — **structural parallel**. This phase mirrors its discipline: one runtime, one toolchain, AST-readable, screenshot-verified, handoff-clean.
- `.ai/plans/archive/phase-3.6.1-canvas-envelope-and-ds-specimens.md` — the canvas-lib + specimen-as-TSX foundation. The motion specimen rewrite plugs into the same envelope.
- `.ai/decisions/DDR-043-bias-free-design-plugin-templates.md` — template bias-freedom rule. Motion tokens stay generic via `{{dur_*}}` placeholders; no aesthetic priors baked into the specimen.
- `plugins/flow/skills/motion-rules/SKILL.md` (117 LOC) — flow plugin's motion hard-stops. The maude-side spec must stay consistent with this skill; reference it from `motion-critic` and the new sub-agent prompt block.

### Files to create

- `plugins/design/dev-server/bin/asset-sweep.sh` — new helper. ~40 LOC bash. Args: `--root <repo> --query <noun list>`. Returns JSON `{ logo: [paths], mark: [paths], ... }`. Used by SKILL.md pre-scaffold step.
- `plugins/design/dev-server/bin/visual-sanity.sh` — new helper. ~60 LOC bash. Args: `--ds <name> --specimens <list>`. Boots dev-server if not running, screenshots each specimen URL into `_history/_system/<ds>-visual-sanity-<ts>/`, exits non-zero on any failure. SKILL.md calls + Reads the PNGs.
- `plugins/design/templates/design-system-inspiration/core/preview/motion.tsx.tpl` — new TSX specimen template (replaces `.html`). ~150 LOC. Uses `<DCArtboard>` envelope + canvas-lib motion helpers.
- `plugins/design/templates/design-system-inspiration/core/preview/_motion-readme.md.tpl` — short author-facing doc explaining the 8 roles + the loop policy + the bounded-geometry rule. Shipped alongside the specimen so a future Claude reading the DS folder cold has the rationale.
- `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md` — extract the foundations / brand / inputs slice prompt templates from SKILL.md into a single file. Add `ANIMATION SAFETY` block + `RELATIVE-URL SAFETY` block + `PLACEHOLDER POLICY` block to the foundations + brand slices specifically. **Why extract**: SKILL.md is 955 LOC and the sub-agent prompts are buried; splitting them out lets us audit + extend the prompts without scrolling through unrelated bootstrap logic.
- `scripts/migrate-motion-specimen.ts` — one-shot codemod. Walks `**/preview/motion.html` under a target `.design/` root, rewrites to `motion.tsx` using the new template + project-specific token values, archives the `.html` to `_history/_migration-2026-06-XX/`.
- `.ai/decisions/DDR-049-motion-one-as-canonical-motion-library.md` — DDR. Records: motion-one vs framer-motion vs CSS-only options considered; production handoff parity as the deciding factor; same-author API compatibility as risk mitigation; canvas-lib as the abstraction layer so canvases can drop motion-one without touching imports.

### Documentation (external — opened during research)

- [Motion One docs](https://motion.dev/docs) — `motion/react` API surface, `<motion.div>`, `useAnimate`, `useScroll`, `useInView`, `useMotionValue`.
- [Motion One bundle-size analysis](https://motion.dev/blog/motion-one-bundle-size) — ~10 KB gz comparison vs framer-motion.
- [shadcn registry-item.json motion declaration example](https://ui.shadcn.com/r/styles/new-york/animated-list.json) — reference for how production registry items declare `"motion"` in dependencies.
- [framer-motion → motion migration guide](https://motion.dev/docs/migrate-from-framer-motion) — API surface is 100% compatible.
- [Web Animations API + prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) — fallback path for CSS-only canvases.

### Patterns to follow

Canvas-lib motion helper sketch (lives in `canvas-lib.tsx`):

```tsx
// plugins/design/dev-server/canvas-lib.tsx (new exports)
import { motion, type Variants } from "motion/react";

const ROLE_DEFAULTS = {
  flip:     { duration: "--dur-flip",  easing: "--ease-out",      keyframes: { y: [0, -12, 0] } },
  panel:    { duration: "--dur-panel", easing: "--ease-in-out",   keyframes: { x: [-80, 0, -80] } },
  route:    { duration: "--dur-route", easing: "--ease-out",      keyframes: { opacity: [0, 1, 0], scale: [0.92, 1, 0.92] } },
  soft:     { duration: "--dur-soft",  easing: "--ease-out",      keyframes: { opacity: [0, 1, 0] } },
  spring:   { duration: "--dur-panel", easing: "spring",          keyframes: { y: [0, -16, 0] } },
  scroll:   { duration: "--dur-route", easing: "--ease-in-out",   keyframes: { x: [0, 24, 0] } },
  drag:     { duration: "--dur-flip",  easing: "--ease-out",      keyframes: { rotate: [0, 4, 0] } },
  presence: { duration: "--dur-soft",  easing: "--ease-out",      keyframes: { opacity: [0, 1], scale: [0.9, 1] } },
} as const;

export function MotionDemo({
  role,
  loop = "always",
  children,
}: { role: keyof typeof ROLE_DEFAULTS; loop?: "always" | "hover" | "once"; children?: React.ReactNode }) {
  const cfg = ROLE_DEFAULTS[role];
  const tokens = useMotionTokens();
  const repeat = loop === "always" ? Infinity : loop === "once" ? 0 : 0;
  const repeatType = loop === "always" ? "reverse" : "loop";

  return (
    <div className="motion-demo" data-role={role} style={{ overflow: "hidden" }}>
      <motion.div
        animate={cfg.keyframes}
        transition={{
          duration: tokens[role] / 1000, // ms → s
          ease: cfg.easing === "spring" ? undefined : easingFromToken(cfg.easing),
          type: cfg.easing === "spring" ? "spring" : "tween",
          repeat,
          repeatType,
        }}
        className="motion-demo__target"
      >
        {children ?? <div className="motion-demo__chip" />}
      </motion.div>
    </div>
  );
}
```

The crucial discipline: **every helper is reduced-motion-aware via `useReducedMotion()`** from `motion/react`. When reduced-motion is preferred, helpers swap the keyframes to a no-op transition (per the existing `--dur-*: 1ms` collapse in tokens). Same DS contract as the CSS-only path; the library just enforces it programmatically.

Sub-agent prompt block (lives in `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md`):

```markdown
### ANIMATION SAFETY (mandatory — applies to motion specimen + any canvas with @keyframes)

- **Bounded geometry.** Every tile that hosts a rotating / scaling animation MUST have `overflow: hidden`. Otherwise the bounding box extends √2× at 45°/135° and overflows adjacent rows.
- **Sparkle / pulse / twinkle = small only.** These keyframes (`scale: 0 → 1 → 0`) are for elements ≤56px. Never apply to full-width tiles. Demo sparkle on a 32×32 chip, never on the card itself.
- **Loop motion = `infinite alternate`.** Specimens meant for continuous display use looping animations. Single-shot animations finish in 150-200ms and leave the demo invisible on the second look.
- **Compositor-only.** Animate `transform` + `opacity`. Never `width`, `height`, `top`, `left`, `padding`. Layout-dirty animations break adjacent geometry + cost paint.
- **Reduced motion is mandatory.** Tokens already collapse `--dur-*` to 1ms when `prefers-reduced-motion: reduce`. Do NOT add `!important` overrides. If using motion/react, use `useReducedMotion()` and short-circuit the animate prop.
- **No bouncy springs by default.** Springs say "Toy", not "Pro Tool". Use `spring` role only when the DS brief explicitly asks for it (e.g. brief mentions "playful" / "tactile" / "physical").

### RELATIVE-URL SAFETY (mandatory — applies to any specimen referencing assets)

- Dev-server serves canvases via `/_canvas-shell.html?canvas=<rel>`. Relative `../foo.svg` resolves against the SHELL's URL, not the canvas file location. Result: 404.
- **Always inline SVGs** in JSX (use `useId()` for filter IDs to avoid collisions across instances), OR
- **Always use absolute paths** rooted at `/assets/...` served from the dev-server's static mount.

### PLACEHOLDER POLICY (mandatory — applies to logo / mark / wordmark / mascot / illustration claims)

- Before writing a placeholder SVG, the orchestrator MUST have run the pre-scaffold real-asset sweep (`asset-sweep.sh`). If a production asset exists at a conventional path (e.g. `packages/ui/.../logo/`), the placeholder is forbidden — copy the real asset.
- If the sweep returned zero candidates, only THEN may a placeholder be authored. The placeholder file's name MUST contain `-placeholder` so it's visually obvious in greps.
- **Never assume your own placeholder path is authoritative downstream.** When passing an asset path to another sub-agent, also pass a flag indicating `placeholder: true` so the downstream agent doesn't promote it to production.
```

---

## Design Decisions

### Motion runtime: **Motion One (`motion/react`)** is the canonical library; CSS-only is an opt-in escape hatch

| Mode | When | Trade-off |
| --- | --- | --- |
| `meta.motion: "motion-one"` (default for new canvases that import a motion helper) | Any canvas using `<MotionDemo>`, `<MotionTrack>`, `useMotionTokens()`, etc. | ~10 KB gz, production handoff parity (shadcn registry-items routinely use `motion`), React 19 native, framer-motion-compatible API. |
| `meta.motion: "css"` (default for canvases that don't import a helper) | Canvases doing simple `@keyframes` work via `_components.css` role classes (`.motion-flip`, `.motion-panel`). | Zero JS dep; less expressive; bounded to the 4 + 8 vocabulary covered by helper classes. |

**Rationale**: production handoff via `registry-item.json` is the deciding factor. shadcn / v0 / Lovable / Next.js ecosystem all consume `motion` as a peer dep. Bundling motion-one with the canvas-lib AND declaring it in handoff manifests means "drop the registry-item, run `bunx shadcn add`, animations work" with zero manual wiring. Framer-motion was the previous default in the React ecosystem; motion-one is its successor by the same author, same API. Choosing motion-one = future-proof + smaller + faster. CSS-only stays available because some canvases legitimately need zero JS deps (e.g. a static hero with one hover transition).

### Visual sanity gate: **mandatory, fail-loud, not silently skip-able**

The current spec language ("skip dev-server boot if Bun unavailable") was interpreted as a soft default. New language: dev-server boot is required; failure surfaces as an `AskUserQuestion`. The cost of booting dev-server (~10s) is dramatically smaller than the cost of a fix-pass round-trip with the user (~3-5 min). Three screenshots minimum (`colors-*`, `motion`, logo if scaffolded); each is `Read` back into context so the model actually sees the result.

### 4-kola critic panel: **`motion-critic` is non-opt-out-able when motion specimen exists**

Scope-opt-out flags (`--opt-out=palette` etc.) still apply to most critics, but `motion-critic` is in the same "always runs" bucket as `a11y-critic` whenever a `motion.tsx` specimen exists. Rationale: motion is one of the highest-friction surfaces (per the studyfi retro D-3 + D-4 both happened in motion-adjacent code). The cost of running `motion-critic` is ~30s; the cost of shipping a broken motion specimen is "user catches it visually in seconds" + 1-2 fix-pass round-trips.

### Sub-agent prompt extraction into `SUB-AGENT-PROMPTS.md`

SKILL.md is 955 LOC. Sub-agent prompts (foundations / brand / inputs / buttons / cards slices) are buried inside it. Extract them into a sibling file so the prompts can be audited + extended without scrolling through unrelated bootstrap logic. The new file is one of the imports of SKILL.md's scaffold-time step; logically equivalent, surface-area improved.

---

## Tasks

Execute in order. A and B can run in parallel after Task 0 + Task 1 + Task 2 land the foundation.

### Task 0 — ARCHIVE retro evidence + ADD DDR-049

- **Do**: Copy the studyfi imprint review (`/Volumes/D/git/AI-StudyMate/.ai/logs/system-reviews/design-system-imprint-bootstrap-review.md`) into `.ai/logs/system-reviews/imprint-bootstrap-review-2026-05-26.md` (so the plan's source-of-truth lives in this repo). Write `.ai/decisions/DDR-049-motion-one-as-canonical-motion-library.md` per `.ai/decisions/template.md`. Cover: status quo (CSS-only, no library); decision (motion-one default + CSS escape hatch); alternatives (framer-motion, GSAP, CSS-only, Animations API); consequences (~10 KB gz canvas-lib bump, production handoff cleanup, framer-motion-compat for sub-agent training data).
- **Validate**: DDR opens cleanly; cross-links to this plan; review-copy lives at expected path.

### Task 1 — CREATE `asset-sweep.sh` + WIRE into SKILL.md pre-scaffold

- **Do**: Implement `plugins/design/dev-server/bin/asset-sweep.sh`. Args: `--root <repo> --query "logo,mark,wordmark,mascot,glyph,illustration"`. Implementation: for each query noun, `find <root> -name "*.svg" -path "*<noun>*" -not -path "*/node_modules/*" -not -path "*/.design/_history/*"`. Output: JSON to stdout, `{ "logo": ["packages/ui/.../logo/logo.svg"], "mark": [...], ... }`. Update `plugins/design/skills/design-system/SKILL.md` Pre-scaffold section: insert a new step before Batch A that runs the sweep, parses JSON, and for any noun with exactly 1 hit, COPIES the asset into the DS folder. Multiple hits → `AskUserQuestion`. Zero hits → continues to placeholder authorship (with the new `-placeholder` filename suffix rule from the sub-agent prompt).
- **Pattern**: Mirror existing `bin/slug.sh` style — POSIX bash, no Node deps, JSON via `printf`. Add to `package.json` `files` for npm distribution.
- **Gotcha**: `find` on monorepos can be slow. Cap depth at 6 (`-maxdepth 6`) + exclude `_history/`, `node_modules/`, `.git/`. Document the cap in the helper's `--help`.
- **Validate**: `bash plugins/design/dev-server/bin/asset-sweep.sh --root /Volumes/D/git/AI-StudyMate --query "logo,mark" | jq .` returns the studyfi production logo. `time` on the same call < 2 s.

### Task 2 — CREATE `visual-sanity.sh` + WIRE into SKILL.md post-scaffold

- **Do**: Implement `plugins/design/dev-server/bin/visual-sanity.sh`. Args: `--ds <name> --specimens "colors-accent,motion,logo"`. Implementation: call `server-up.sh` (existing helper) to ensure dev-server is alive, then for each specimen call `screenshot.sh --full --url "/system/<ds>/preview/<specimen>.tsx"` into `_history/_system/<ds>-visual-sanity-<ISO>/`. On screenshot failure, exit non-zero with the failure mode (server-not-up, specimen-missing, render-error). Update SKILL.md post-scaffold section: replace soft "visual sanity check" with a mandatory call to this helper, and instruct the agent to `Read` each generated PNG into context. Failures surface as `AskUserQuestion` ("dev-server failed: <reason>; skip visual sanity or fix and retry?").
- **Pattern**: Same shape as `screenshot.sh`. Reuse it; don't duplicate.
- **Gotcha**: Specimens may not all exist for every DS (e.g. logo specimen exists only if brand slice ran). Iterate over the actual specimens written, not a hardcoded list — read the roster from `.design/system/<ds>/_roster.json` (or whatever this repo's equivalent is, post-3.6.1).
- **Validate**: `bash visual-sanity.sh --ds project --specimens motion,colors-accent` produces two PNGs in `_history/_system/project-visual-sanity-<ts>/`, each Read'able by the Read tool.

### Task 3 — UPDATE `SKILL.md` for A4 (bypass-surfacing) + A5 (4-kola enforcement)

- **Do**: Two surgical edits to `plugins/design/skills/design-system/SKILL.md`:
  - **A4**: Add a new section "Spec-bypass discipline" near the top (under "When the user grants autonomy"). Rule: any deviation from spec must post a 1-line "Deviating from spec because <reason> — say `stop` to abort" + append a row to `_history/_system/<ds>-bypass-log.md`. Examples: imprint mode skipping Stage 2 research, `--quick` skipping Kolo 2-3 critics, dev-server boot failure skipping visual sanity.
  - **A5**: Replace the "Post-scaffold critic panel" section. Current: implicit panel based on canvas content. New: explicit `AskUserQuestion` at scaffold-end with 3 options ("Full 4 kola (recommended)" / "Imprint-only (Kolo 1 + a11y + motion only)" / "Custom subset — pick critics"). Selection is recorded; "Imprint-only" still includes `motion-critic` if `motion.tsx` exists.
- **Pattern**: Existing `AskUserQuestion` usage in the skill (Round 0-3 discovery) is the template. Three options + recommended-first ordering.
- **Gotcha**: The bypass log file is per-DS to avoid noise across DSes in multi-DS projects. Path: `<designRoot>/_history/_system/<ds>-bypass-log.md`.
- **Validate**: Walk through SKILL.md sections; verify the new wording reads cohesively against the existing 3-stage discovery + scaffold flow. Run a dry `--quick` setup on a scratch DS; observe the bypass post + the panel question.

### Task 4 — CREATE `SUB-AGENT-PROMPTS.md` + EXTRACT prompts from SKILL.md (A3)

- **Do**: Create `plugins/design/templates/design-system-inspiration/SUB-AGENT-PROMPTS.md`. Move the foundations / brand / inputs / buttons / cards slice prompt templates from SKILL.md into this file (each as an `## H2` section). Add the three new MANDATORY blocks shown in "Patterns to follow" above (ANIMATION SAFETY, RELATIVE-URL SAFETY, PLACEHOLDER POLICY) — only to slices where they apply (animation-safety + relative-url to foundations; placeholder to brand + foundations; relative-url to brand too). Update SKILL.md scaffold-time step to load + interpolate from this file instead of the inline prompts.
- **Pattern**: Existing `_pastier-probe-templates.md` is the precedent — sibling template file referenced from the skill. Same structure.
- **Gotcha**: Don't lose the existing per-slice rules embedded in SKILL.md's prompt text (e.g. "ANTI-PATTERNS (graphic-design-critic blockers)"). Move them verbatim; the new blocks go alongside.
- **Validate**: `grep -c '^## ' SUB-AGENT-PROMPTS.md` ≥ 5 (one section per slice). SKILL.md no longer contains the prompt-body text (only the load + interpolate reference). Re-run a scaffold; output of one slice contains the ANIMATION SAFETY block.

### Task 5 — UPDATE `canvas-lib.tsx` — add motion helpers + `motion` dep

- **Do**: Install `motion` (Motion One) as a peer dep of the canvas-lib package: add to `plugins/design/dev-server/package.json` (or wherever canvas-lib resolves its imports post-3.4/3.6 — pre-flight read those plans to confirm). Add to `canvas-lib.tsx`:
  - `import { motion, useReducedMotion } from "motion/react"` (or equivalent React 19 entry point)
  - `<MotionDemo role loop>` per the sketch in "Patterns to follow"
  - `<MotionTrack>` — flex row, applies 40 ms stagger via `motion`'s `staggerChildren` transition
  - `<TokenPlayback duration easing>` — chip with click-to-fire single-shot replay
  - `<ReducedMotionToggle>` — chrome toggle setting `data-reduced-motion="true"` on document.documentElement
  - `useMotionTokens()` — reads CSS custom props via `getComputedStyle(document.documentElement)`, parses ms → number
  - `easingFromToken(token)` helper that maps `--ease-out` → motion-one's `cubicBezier(0, 0, 0.2, 1)` (the standard).
- **Pattern**: Match the existing canvas-lib export style. Test in isolation with `bun:test` covering keyframe selection + reduced-motion short-circuit + token parsing.
- **Gotcha**: `motion/react` exports both `motion` (component) and `Motion` (the lib). Use the lowercase `motion.div` pattern; the uppercase is a v10 legacy name.
- **Validate**: `bun test plugins/design/dev-server/test/canvas-lib-motion.test.ts` — covers (a) role config selection, (b) reduced-motion short-circuit, (c) token parsing roundtrip. Manual smoke: drop a `<MotionDemo role="flip" />` into Smoke TSX, open in dev-server, observe continuous animation.

### Task 6 — REPLACE motion specimen with `motion.tsx.tpl` (B3)

- **Do**: Author `plugins/design/templates/design-system-inspiration/core/preview/motion.tsx.tpl`. ~150 LOC. Imports `<DesignCanvas>`, `<DCArtboard>`, motion helpers from `@maude/canvas-lib`. Renders 8 role tiles + 4 token chips + 2 easing-curve SVGs + `<ReducedMotionToggle>` + a11y note. Every tile `overflow: hidden`. Loop default = `always`. Use the existing `colors_and_type.css` tokens (no new tokens introduced). Author the sibling `_motion-readme.md.tpl` explaining the 8 roles + the loop policy + the bounded-geometry rule. Delete the old `motion.html` (move to `.archive/` for grep parity).
- **Pattern**: Other TSX specimens written by Phase 3.6.1 (`colors-accent.tsx`, `components-buttons.tsx`) are the structural template. Match envelope shape.
- **Gotcha**: The easing-curve SVG should derive from the token's actual cubic-bezier values, parsed from the CSS custom prop at render time — not hardcoded. Helper: `bezierToSvgPath(cubicBezier(x1, y1, x2, y2))`.
- **Validate**: Open `motion.tsx` in dev-server. All 8 demos loop. Token chips fire on click. Reduced-motion toggle short-circuits all to 1 ms. `bin/visual-sanity.sh --ds <test> --specimens motion` produces a PNG that, when Read'd, shows visible motion mid-frame.

### Task 7 — UPDATE `handoff.ts` — motion import rewrite (B5)

- **Do**: Extend `plugins/design/dev-server/handoff.ts` (per Phase 3.6 Task 7). When AST-stripping `data-cd-id` from the canvas TSX, ALSO rewrite `import { ... } from "@maude/canvas-lib"` to either:
  - Keep `@maude/canvas-lib` for non-motion primitives (`DesignCanvas`, `DCArtboard`), OR
  - Rewrite to `motion/react` for motion primitives (`<MotionDemo>` etc. are NOT exported standalone — they get inlined into the registry-item's `files[]`).
  Actually — re-think: the cleanest path is to **inline `<MotionDemo>` and friends** into the registry-item's `files[]` array as a separate `motion-demo.tsx` file with `type: "registry:component"`, and let the consumer's TSX still import from a relative path. This mirrors how shadcn handles its own primitive layer. Both `motion` and `react` end up in `dependencies`. Document the choice in DDR-049.
- **Pattern**: Same `oxc-parser` + `magic-string` tool from Phase 3.6.
- **Gotcha**: The consumer's `tsconfig.paths` may or may not have `@maude/canvas-lib`. Be conservative: NEVER ship `@maude/canvas-lib` references in the registry-item's output — always inline or rewrite to npm specifiers.
- **Validate**: `bunx shadcn add file:///tmp/test-motion-canvas.registry.json` in a scratch Next.js project resolves `motion` from npm, inlines `motion-demo.tsx` if used, and the canvas renders with motion working out of the box.

### Task 8 — UPDATE `motion-critic.md` — specimen-presence auto-route (C1)

- **Do**: Edit `plugins/design/agents/motion-critic.md` "When to run" section. Currently: triggers on @keyframes / transitions / drag / route / presence in canvas. Add: ALSO triggers automatically when invoked from `/design:setup-ds` post-scaffold IF `system/<ds>/preview/motion.tsx` exists, regardless of opt-out scope. Document in the critic's preamble that it's in the "always-on" bucket alongside `a11y-critic` for DS bootstrap flows.
- **Pattern**: `a11y-critic.md`'s mandatory-runs documentation is the model.
- **Gotcha**: Critic agents don't have permission state; the orchestrator (`/design:critic` panel) reads opt-out scope. So this change is actually in the orchestrator OR in the SKILL.md post-scaffold critic-routing logic. Make the edit in SKILL.md (Task 3's A5 implementation) — refer to it from motion-critic.md docs.
- **Validate**: Scaffold a scratch DS that opts out of `motion` via brief; observe motion-critic still queued in the panel because `motion.tsx` exists.

### Task 9 — UPDATE `design-system-completeness-critic.md` (C2)

- **Do**: Add two checks to `plugins/design/agents/design-system-completeness-critic.md`:
  - **Motion specimen renders.** Spawn `bin/visual-sanity.sh --ds <ds> --specimens motion` as a sub-step; if non-zero exit, raise a Conventional-tier warning (Core-tier blocker if `motion.tsx` is part of the always-on Core set, which it is per the SKILL.md spec).
  - **Token coverage.** Parse `motion.tsx` for `--dur-*` references. If any duration token defined in `colors_and_type.css` is unreferenced, raise a Conventional warning.
- **Pattern**: Existing structural checks (file-exists, token-defined) are the model. Same severity ladder.
- **Gotcha**: The render check needs the dev-server alive; the critic should call `server-up.sh` first. If the dev-server can't boot, the check is N/A (warning, not blocker), to avoid blocking the user in environments without Bun.
- **Validate**: Add a synthetic test fixture (DS with broken motion specimen) → critic raises blocker. Remove the motion specimen entirely → critic raises Core blocker.

### Task 10 — UPDATE `design-system-keeper.md` (C3)

- **Do**: Add a motion-pattern lift-first rule to `plugins/design/agents/design-system-keeper.md`. When the keeper audits a new canvas for "pattern reinvention", ALSO grep for `@keyframes` literals + `transition:` literals in the canvas; if any of those have a 1:1 canvas-lib equivalent (e.g. canvas defines `@keyframes flip { ... }` but `<MotionDemo role="flip" />` exists), raise a pattern-reinvention warning. Standard ≥3-reinvention-promotes-to-blocker rule applies.
- **Pattern**: Existing pattern-reinvention scan is the model.
- **Gotcha**: Some canvases legitimately need bespoke motion (e.g. a one-off marketing animation). The warning is a warning, not a blocker, unless it stacks.
- **Validate**: Add a test canvas with hand-rolled `@keyframes flip` → keeper raises 1 warning. Add 3 more → keeper promotes to blocker.

### Task 11 — CREATE `scripts/migrate-motion-specimen.ts` + RUN on this repo + AI-StudyMate (B6)

- **Do**: Implement the one-shot codemod. Walks `**/preview/motion.html` under a `--root` arg. For each match: parse the inline `<style>` block, extract token references (`--dur-*`, `--ease-*`) to preserve any project-specific overrides; write `motion.tsx` from the new template with those values; archive the `.html` to `_history/_migration-2026-06-XX/`. Run on this repo's `.design/system/project/preview/motion.html` (if it exists) and document the migration command for downstream users.
- **Pattern**: Mirror Phase 3.6 codemod shape — `oxc-parser` + `magic-string` for any TSX touchups; dry-run mode + per-file diff.
- **Gotcha**: The studyfi project's motion specimen was already rewritten manually during the fix-passes (per the retro turn 12). Don't auto-migrate if the file is already TSX. Check extension first.
- **Validate**: Dry-run on AI-StudyMate; expected output = "already TSX, skipping" (because the user manually fixed it). Dry-run on a fresh scaffold; expected output = full HTML→TSX diff.

### Task 12 — ADD `_components.css` motion role classes (C4 — CSS escape hatch)

- **Do**: In `plugins/design/templates/design-system-inspiration/core/preview/_components.css` (post-3.6.1 — the shared anatomy file), add 8 role classes: `.motion-flip`, `.motion-panel`, `.motion-route`, `.motion-soft`, `.motion-spring`, `.motion-scroll`, `.motion-drag`, `.motion-presence`. Each preset to its role's duration + easing + a baseline keyframe. Reduced-motion guard at the bottom. Document each class's intent with a one-line CSS comment.
- **Pattern**: Existing `.btn`, `.tile`, `.sku` shared-anatomy classes are the model. Same role-naming convention.
- **Gotcha**: These should NOT override anything inside `motion.tsx` (that's the specimen, which uses `motion/react`). They're for canvases that opt into vocabulary without the JS dep. Test: a canvas using `<div className="motion-panel">` should animate via CSS; the motion specimen still uses `<MotionDemo>` and is unaffected.
- **Validate**: Drop `<div className="motion-flip"></div>` in Smoke TSX; observe CSS animation. Inspect canvas-lib bundle size with + without — `motion/react` is tree-shakeable from the CSS-only path.

### Task 13 — UPDATE all related slash commands + critic-agent docs for the new flow

- **Do**: Sweep `plugins/design/commands/{setup-ds,new,edit,critic}.md` for references to motion + visual sanity + asset sweep. Update:
  - `setup-ds.md`: document the `--imprint` flag's interaction with the new bypass-surfacing rule
  - `new.md`: when scaffolding a canvas that will use motion, the envelope should import from `@maude/canvas-lib`; mention the role list
  - `edit.md`: when feedback names a motion role (e.g. "make the panel snappier"), the AST-edit path can target the `<MotionDemo>` prop directly (faster than full-file rewrite)
  - `critic.md`: document the new `motion-critic` always-on bucket
- **Pattern**: `grep -rn 'motion\|sanity\|asset.sweep' plugins/design/commands/` — enumerate; touch case-by-case.
- **Validate**: `/design:help` lists all commands correctly. `grep -rn 'motion.html' plugins/design/commands/` returns zero outside of archive references.

### Task 14 — ADD tests + RUN end-to-end smoke

- **Do**: Add `bun:test` cases:
  - `canvas-lib-motion.test.ts` — `<MotionDemo>` role selection, reduced-motion short-circuit, `useMotionTokens()` parsing
  - `asset-sweep.test.ts` — sweep over a fixture repo with seeded logos at conventional + non-conventional paths
  - `visual-sanity.test.ts` — server-up check, screenshot success, screenshot failure surface
  - `handoff-motion.test.ts` — registry-item.json correctly declares `motion`; canvas-lib imports rewritten/inlined; no `@maude/canvas-lib` survives
  - `completeness-critic-motion.test.ts` — synthetic broken motion specimen raises blocker; missing motion specimen raises Core blocker
- **Do (manual end-to-end)**: Run `/design:setup-ds smoke-ds` on a scratch project. Observe: asset sweep ran, bypass-log present if `--quick`, motion specimen TSX scaffolds with live animation, visual sanity PNGs in `_history`, 4-kola critic panel question surfaced, `motion-critic` ran, completeness-critic motion checks passed. Then `/design:handoff` the motion specimen → registry-item.json drops cleanly into a scratch Next.js + shadcn project.
- **Validate**: All bun:tests pass. Manual smoke produces the artifact set above. Capture timing — total setup-ds wall clock should not exceed pre-phase baseline by more than 30 s (the visual-sanity cost).

---

## Validation

Run these commands to confirm zero regressions:

1. **Types**: `bun run tsc --noEmit -p plugins/design/dev-server`.
2. **Tests**: `bun test plugins/design/dev-server/test/` — all new + existing tests pass.
3. **Build**: `bun run plugins/design/dev-server/build.ts` produces `dist/maude-<platform>` binaries.
4. **Manual `/design:setup-ds` smoke**: scratch DS bootstrap end-to-end; observe artifacts listed in Task 14.
5. **Manual `/design:handoff` smoke**: motion-using canvas → registry-item.json → `bunx shadcn add` in scratch Next.js project; motion works.
6. **`canvas-format-tsx` scenario** (carried from Phase 3.6): still passes; motion specimen now included in the click-through.
7. **`design-system-guard` subagent**: 0 blockers on the migrated motion specimen.
8. **`design-system-completeness-critic`**: passes on a fresh DS scaffold (motion specimen present + token coverage complete).
9. **`motion-critic`**: passes on the new motion specimen (a11y reduced-motion guard present, bounded geometry, compositor-only properties, infinite-alternate loop policy).
10. **`a11y-auditor`**: 0 blockers (reduced-motion handling carried forward).

---

## Risk register

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| `motion/react` peer-dep version mismatch in handoff target | Med (consumer's Next.js may pin older motion) | DDR-049 documents the minimum supported version; registry-item declares `^11`; document in handoff README. |
| Motion specimen renders but motion-one is tree-shaken away in a canvas that doesn't use it (false-positive bundle bloat) | Low (Bun.build tree-shake is reliable) | Bundle-size budget gate in Task 5; canvas with zero motion-lib imports has < 2 KB delta. |
| Sub-agent prompts in SUB-AGENT-PROMPTS.md drift from SKILL.md as the skill evolves | Med (the split increases surface area) | DDR-049 documents the split + the "always edit both" rule. Add a CI grep check: SKILL.md must reference SUB-AGENT-PROMPTS.md by exact filename. |
| Asset-sweep helper false-positives on monorepos with unrelated `*-logo*` files | Med (any repo with marketing/) | Document the rule in helper output: "if multiple hits, the agent should ask the user, NOT auto-pick the first". A5's `AskUserQuestion` path handles this. |
| Visual-sanity adds 25s to every `/design:setup-ds` run | High (it's the design) | Acceptable per retro lesson #2 ("Visual sanity is not optional"). Document in SKILL.md: "the 25s up front saves 2 fix-pass round-trips downstream." |
| Existing AI-StudyMate motion specimen breaks on upgrade | Low (already manually fixed during retro fix-pass) | Codemod in Task 11 detects already-TSX and skips. Manual diff if user opts to re-migrate. |
| `motion-one` API changes between minor versions | Low (motion is API-stable post v11) | Pin exact version. Track upstream changelog via Dependabot. |
| Bypass-surfacing rule annoys users on every `--quick` run | Med (UX friction) | Rule outputs a 1-line note, not an `AskUserQuestion` for the common bypass cases. `AskUserQuestion` only when the bypass is non-routine (dev-server boot failure, spec/brief conflict). |
| 4-kola critic enforcement promotes graphic-design-critic to mandatory and slows DS bootstrap | Low (graphic-design-critic runs ~20s) | Acceptable; the user-facing dialog (A5) lets the user pick "Imprint-only" to skip Kolo 2-3 in known-safe cases. |

---

## Scenario Coverage (UI tasks — required)

Dev-server-internal architecture; user-facing surface = "setup-ds + motion specimen + handoff path work end-to-end". One new scenario:

| Scenario | Covers | Status |
|----------|--------|--------|
| `setup-ds-motion-handoff` | `/design:setup-ds scratch --quick` on a fresh repo → asset sweep runs → motion specimen scaffolds as TSX with live animation → visual sanity 3-PNG sweep → 4-kola panel question surfaces → user picks "Full 4 kola" → all 5 critics run (including motion-critic) → `/design:handoff` motion specimen → registry-item.json valid → `bunx shadcn add` in scratch Next.js project → motion works | 🆕 new — web-desktop only (dev-server is web-only) |

Skip the 5-platform matrix — dev-server has no mobile/native surface.

---

## Acceptance Criteria

- [ ] All 14 tasks completed
- [ ] DDR-049 written + cross-linked from this plan
- [ ] Retro evidence archived at `.ai/logs/system-reviews/imprint-bootstrap-review-2026-05-26.md`
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iterations)
- [ ] `/flow:validate` passes overall:
  - [ ] Types (`bun tsc --noEmit` on `plugins/design/dev-server`)
  - [ ] Tests (`bun test plugins/design/dev-server/test/`)
  - [ ] Build (`bun run plugins/design/dev-server/build.ts`)
  - [ ] `setup-ds-motion-handoff` scenario passes (web-desktop)
  - [ ] `design-system-guard` subagent: 0 blockers
  - [ ] `design-system-completeness-critic`: 0 blockers on fresh scaffold
  - [ ] `motion-critic`: 0 blockers on the new motion specimen
  - [ ] `a11y-auditor`: 0 blockers (reduced-motion carried forward)
- [ ] Performance budgets met (per gates table above)
- [ ] Motion specimen renders live motion on first paint (no hover required) — verified by screenshot mid-frame
- [ ] `/design:handoff` of a motion-using canvas drops into scratch Next.js + shadcn project with `bunx shadcn add` and animations work — no manual wiring
- [ ] No `\.html` references to motion specimen remain in `plugins/design/templates/` outside archive
- [ ] Asset-sweep helper catches the studyfi production logo when run against `/Volumes/D/git/AI-StudyMate`
- [ ] Bypass-log writes correctly on `--quick` setup runs
- [ ] No DDR-worthy decision left unrecorded

---

## Notes for `/flow:execute`

- Tasks 0, 1, 2 are foundation — run sequentially.
- Tasks 3-7 (workstream A + start of B) can fan out as parallel sub-agents — each is self-contained.
- Tasks 8-13 (critic + agent doc updates) are read-mostly-write-little — single agent can sweep them.
- Task 14 (tests + manual smoke) is the validation gate — runs last.
- Token-cost expectation: this phase is ~12 files touched + 6 new files. With AST-aware edit paths from Phase 3.6, individual task cost should average ~30-50 K tokens; total phase ~600 K. Split across 2 sessions if context pressure hits.

---

## Retro (2026-05-26, commit `38b299f`)

Closed across 2 sessions per plan's "split if context pressure hits" guidance. Session 1 (`1ff39de`) landed T0–T2 + project-DS motion specimen rewrite (`0f6b847`); session 2 (`38b299f`) landed T3–T14.

**What worked**
- Extracting `SUB-AGENT-PROMPTS.md` out of SKILL.md *with* the three MANDATORY safety blocks bundled was the right shape — adding them inline to SKILL.md would have buried them under bootstrap orchestration. The sibling-file pattern matches `_pastier-probe-templates.md` so cold readers grok the convention.
- `<MotionDemo>` design — bounded geometry baked into the component (inline `overflow: hidden` on the root) makes the sparkle-on-tile regression structurally impossible. A future agent CANNOT ship the studyfi-imprint failure mode through this surface.
- Test choice — locked the 8-role vocabulary with a structural assertion against the source string AND the `buildLibMap` walk. Pattern catches both renames (vocabulary stays grep-able for critics) and refactors that lose transitive deps.
- `_components.css.tpl` motion role classes — same 8-role vocabulary at the CSS layer means a canvas can opt into the discipline without the JS dep. Tree-shake-friendly default.

**What didn't**
- Phase 3.7 added `motion` + `motion/react` to `RUNTIME_PACKAGES` (the externals list) but **forgot to update the importmap in `_shell.html`** — the two are hand-maintained, not derived. Smoke ran clean structurally (all PNGs reported OK because agent-browser's mount probe passes for non-canvas pages too) but the actual canvas iframe got `TypeError: Failed to resolve module specifier "motion/react"`. Caught only because user ran a motion-using canvas live. **Fix: when adding to `RUNTIME_PACKAGES`, ALSO add to `_shell.html` importmap. A future refactor should derive the importmap from RUNTIME_PACKAGES at server-start to make the two impossible to drift apart.** DDR-worthy if the importmap is touched again.
- Concurrent commit `3f586e4` (phase-20 follow-up bug fix) silently reverted my canvas-lib.tsx motion additions mid-session. Recovery was straightforward (re-apply via Edit; tests pin shape) but cost ~15 min of confusion. Lesson: when working alongside an active concurrent commit train, `git status` checks more often than the heartbeat of completed tasks would suggest.
- DDR-049 slug double-claim — same date, same phase number conflict. Both files coexist; cross-links work; but the next time DDR numbers are claimed, the script should verify uniqueness before write. Optional CI check.

**What to change next time**
- **For `/flow:plan`:** when a phase touches `RUNTIME_PACKAGES`, the plan template should add an explicit "importmap also updated?" line item. The two-list-must-stay-in-sync pattern is dev-server-internal load-bearing knowledge that's invisible from the file diff alone.
- **For `/flow:execute`:** the DDR-021 smoke gate fires on dev-server changes but uses agent-browser's mount probe as success criterion. That probe is too lenient — it returns `OK` when ANY body text is present (acceptable for non-canvas pages, false-positive for canvases that loaded the shell but failed mid-import). Add a console-error probe to the agent-browser path (already in playwright fallback). Bug class: "build green ≠ canvas actually mounted" — exactly what DDR-021 was meant to prevent.
- **For `/flow:done`:** ran the smoke gate via the slash skill at the end, NOT during `/flow:execute` step 3.5 (which the plan invocation should have triggered). The auto-fire path should be tightened so executors don't end up with the gate as a manual afterthought.
