# Feature: Sharpen maude.sh's core positioning + a repo skill to keep saying it right

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports.

## Description

The current hero line, "Maude, how it works mostly.", is a fun wink but does zero positioning work: it doesn't say what Maude is or why anyone needs it. It's also a known SEO gap (`project_maude_sh_seo_aeo` audit, 2026-06-25: "The H1 is 'Maude, how it works mostly' — SEO-empty, no 'Claude Code' in it").

The real hook, per Michal: Maude's biggest wow-factor is that it's a *design tool built around AI from day one*, not a human tool with AI bolted on (Figma), and not a chat box pretending to be a tool (Claude Design). Because nothing here fights the grain, it just works. That's the insight the new copy needs to sell, then quickly widen out to the rest of the ecosystem (`flow`'s agentic loop, the self-hosted hub) as the secondary beat, exactly like the site already structures itself (hero -> spotlight -> full catalog).

This plan rewrites the homepage hero, adds a short visible "why not Figma / why not Claude Design" comparison section, tightens the docs index opening + description, and creates a new repo-internal skill (`.claude/skills/maude-positioning/`) that captures this message architecture so future copy (README, changelog posts, social) doesn't have to re-derive it from scratch every time. Actual sentence-level phrasing goes through the existing `michal-voice` skill (EN-dev mode) at execution time; this plan drafts publish-ready candidate copy but execution should still run a tic-pass against the voice-corpus before landing it.

**Direction already chosen with Michal** (asked live during planning, not guessed): hero headline says *"The design tool that finally stops fighting the AI."*, the old line survives as a small wink caption underneath, and the punchline explains the "real files, real git, real tokens" mechanism.

## User Story

As a visitor landing on maude.sh (dev or non-technical stakeholder evaluating the tool) I want the first sentence to tell me what Maude is and why it's different, so that I don't have to read three paragraphs to figure out if this is worth ten more minutes.

## Problem

- Hero H1 is a joke with no information content and no target keyword ("Claude Code" is absent from it).
- The actual differentiator (built-around-AI vs bolted-on-AI vs chat-box-with-no-persistence) exists only in Michal's head and in this plan, nowhere on the site.
- There's no durable, reusable artifact capturing "how to talk about Maude" for the next time copy needs writing (README, a changelog post, a tweet, an elevator pitch to a non-technical friend) — every future rewrite starts from zero.

## Solution

1. New hero headline + wink caption + punchline on the homepage (direction B, confirmed with Michal).
2. A new, visible "Why not just Figma? Why not just Claude Design?" comparison block on the homepage, reusing existing catalog-card CSS (no new tokens/components).
3. Tightened docs index (`site/content/docs/index.mdx`) opening paragraph + meta description carrying the same insight for readers who land on `/docs` directly instead of `/`.
4. A new repo-internal skill, `.claude/skills/maude-positioning/SKILL.md`, that documents the core insight, a formal positioning statement, a differentiation table (Figma / Claude Design / Maude), a plain-language mode for non-technical audiences, proof points, and guardrails (accuracy, don't sneer, `flow`/hub always secondary, compose with `michal-voice`).
5. `flow` and the self-hosted hub stay explicitly present as the secondary beat in every rewritten block (per Michal: "samozrejme by tam mela byt zminka i o flow pluginu a celem eco systemu s hub multiplayer atd. Ale to je az druhotne vzdy") — nothing here narrows Maude's story down to "just a design tool."

**Explicitly out of scope for this pass** (would need its own plan if wanted later): a full copywriting sweep of every docs page (`docs/design/*`, `docs/flow.mdx`, `docs/cli.mdx`, recipes, hub docs), and the root `README.md` top blurb. Both are legitimate future uses of the new `maude-positioning` skill, not required to land this fix. Flagging instead of silently skipping.

**Divergent-debate step skipped deliberately.** `/flow:plan` step 5.5 would normally fan out BUILDER/SHIPPER/BREAKER on an architectural fork. This isn't one, it's a subjective creative/brand call with no maintenance-horizon risk, so the one real fork (headline direction) was resolved directly with Michal via `AskUserQuestion` instead of a multi-agent relay. Disproportionate machinery for four candidate taglines.

## Metadata

- **Ticket**: none (ad-hoc copywriting request, not tracked in GitHub issues)
- **Type**: Enhancement
- **Complexity**: Medium (multiple files across one package + one new repo-internal file; no new deps; public-facing/brand risk, not technical risk)
- **App/Package**: `site` (Next.js marketing + docs) and repo-root `.claude/skills/`
- **Affected Systems**: maude.sh homepage, docs index, repo-internal skill registry
- **Dependencies**: none new

---

## Context References

### Must-Read Files

> Read these in parallel in a single assistant message during execution.

- `site/app/(home)/page.tsx` (lines 82-186) — Why: the hero + spotlight + catalog markup being edited; reuse `.mdcc-hero-sku`, `.mdcc-cat-grid`, `.mdcc-cat-card`, `.mdcc-section-head`, `.mdcc-hero-fineprint` classes, don't invent new CSS.
- `site/app/global.css` (lines 204-500ish, the `.mdcc-hero-*` / `.mdcc-spotlight*` / `.mdcc-cat-*` / `.mdcc-section-head*` blocks) — Why: confirm exact styling before reusing a class in a new context (e.g. `.mdcc-cat-card` is currently always a `<Link>`; verify it still looks right as a static `<div>`).
- `site/app/layout.tsx` (lines 76-92) — Why: site-wide `<title>`/description/OpenGraph/JSON-LD metadata. Read to confirm it already says "Claude Code" (it does, in `description`) so it does NOT need a rewrite, only a consistency check after the hero copy changes.
- `site/content/docs/index.mdx` (whole file, 71 lines) — Why: the docs-home opening paragraph + frontmatter `description` being edited.
- `.claude/skills/whats-new-entry/SKILL.md` — Why: the exact structural convention a repo-internal skill (frontmatter: `name` + `description` only, no `category`/plugin-namespace) must follow. Mirror this shape for the new skill, don't invent a new convention.
- `/Users/iagh/.claude/skills/michal-voice/SKILL.md` (personal skill, not in this repo) — Why: the tone rules the new skill must explicitly defer to. In particular: **no em-dash as a clause separator, ever** (already enforced in every copy block drafted below), short declaratives, dry self-deprecation, no corporate gloss.

### Files to Create

- `.claude/skills/maude-positioning/SKILL.md` — the message-architecture skill (full content drafted in Design Decisions below).

### Design canvases

No match. `.design/ui/Docs Site.meta.json` (`.design/ui/Docs Site.tsx`) is the original visual mockup that established the "MDCC catalog" aesthetic (SKU labels, card grid) the real `site/` code already implements 1:1 — useful as *visual* background, but it's a static mockup, not live code; editing it would not affect the deployed site. Not touched by this plan.

### Documentation

- `project_maude_sh_seo_aeo` memory (this session's persistent memory, 2026-06-25 audit) — Why: confirms the H1-has-no-"Claude-Code" gap is a known, previously-flagged SEO issue this plan directly closes.

### Patterns to Follow

Existing hero markup (`site/app/(home)/page.tsx:96-101`) for the H1 + accent-span pattern:
```tsx
<h1 id="land-h1">
  Maude, how it <span style={{ color: 'var(--accent)' }}>works mostly</span>.
</h1>
```
Existing catalog card pattern (`site/app/(home)/page.tsx:200-227`, `CATALOG.map`) for the card-grid shape to reuse (as static `<div>`s, no `href`) in the new comparison section.

---

## Design Decisions

> No `.ai/maude-design-system.md` or `.ai/maude-prd.md` exist in this repo (paths declared in `workflows.config.json` but never populated, this project dogfoods flow on itself rather than running a formal PRD). Design grounding comes from the live site code + `global.css` tokens directly, per Design System Discovery's reuse-first rule.

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `.mdcc-hero-sku` (class) | `site/app/global.css:233` | Mono, small, muted eyebrow style. Reused for the "(maude, how it works mostly.)" wink caption under the new H1 — no new CSS. |
| `.mdcc-cat-grid` / `.mdcc-cat-card` (class) | `site/app/global.css:489+`, used in `CATALOG.map` | Reused for the new 3-card Figma / Claude Design / Maude comparison. Currently always rendered as `<Link>`; the new usage renders plain `<div>`s (no click target, no "read docs" footer row). Verify visually it still looks right without the hover/link affordance. |
| `.mdcc-section-head` (class) | `site/app/global.css:459+` | Reused for the new section's `<h2>` + small eyebrow tag row, matching "The catalog." heading pattern. |
| `.mdcc-hero-fineprint` (class) | `site/app/global.css:257+` | Reused for the closing flow/hub tie-in sentence under the comparison cards. |

### Tokens

No new tokens. Every new bit of copy uses only classes/CSS vars already defined in `site/app/global.css` (`--accent`, `--fg-0/1/2`, `--space-*`, `--font-*`).

### Custom Components Needed

None. This is a copy + reuse-existing-classes change only.

---

### The core insight (protect this sentence through every rewrite)

Figma is a human-first tool with an AI panel bolted onto the side. Claude Design (claude.ai/design) is AI-first but ephemeral, a chat box with no git, no real files, no persistent design system to check against. Maude is a real, professional-grade tool (canvases are `.tsx` files, history is git, tokens are CSS variables gated by critics) whose entire substrate was built for how an AI coding agent actually works. Nothing fights the grain. That's the "built around AI, not bent to fit one" hook.

### Copy block 1 — Homepage hero (`site/app/(home)/page.tsx`)

Replace the H1 + add a wink line + replace the punchline. **Leave the paragraph after the punchline (the `design`/`flow`/`maude` explainer) and the fineprint paragraph completely unchanged** — they already carry `flow` + `maude` as the secondary beat correctly.

```tsx
<h1 id="land-h1">
  The design tool that finally stops <span style={{ color: 'var(--accent)' }}>fighting the AI</span>.
</h1>
<p className="mdcc-hero-sku" style={{ marginTop: 0 }}>
  (maude, how it works mostly.)
</p>
<p className="mdcc-hero-punchline">
  Real files. Real git. Real tokens. Nothing here pretends Claude Code doesn&apos;t exist. That&apos;s why it just works.
</p>
```
(existing `design`/`flow`/`maude` paragraph stays exactly as-is right after this)

### Copy block 2 — New "why not Figma / Claude Design" section

Insert as a new `<section>` between the closing `</section>` of `mdcc-hero` and the existing `mdcc-spotlight` "LATEST DROP" section:

```tsx
<section aria-labelledby="why-h">
  <div className="mdcc-section-head">
    <h2 id="why-h">Why not just Figma? Why not just Claude Design?</h2>
    <span className="mdcc-eyebrow">the short version</span>
  </div>
  <div className="mdcc-cat-grid">
    <div className="mdcc-cat-card">
      <h3>Figma</h3>
      <p>A human-first design tool with an AI panel bolted onto the side. The AI is a guest in someone else&apos;s house.</p>
    </div>
    <div className="mdcc-cat-card">
      <h3>Claude Design</h3>
      <p>A chat box that forgets everything by morning. No git, no files, no design system to check new work against.</p>
    </div>
    <div className="mdcc-cat-card">
      <h3><code>maude</code></h3>
      <p>Built around Claude Code from day one. Real <code>.tsx</code> files, real git history, a real dev server. That&apos;s the whole trick.</p>
    </div>
  </div>
  <p className="mdcc-hero-fineprint" style={{ marginTop: 'var(--space-4)' }}>
    And it&apos;s not just the canvas. <code>flow</code> runs the same repo-native loop for planning and shipping the whole feature, and the optional self-hosted hub brings the team into the same <code>.design/</code> in real time.
  </p>
</section>
```

Task must verify during execution: does `.mdcc-cat-card` render acceptably as a plain `<div>` (no `<a>` semantics, no hover-lift needed since there's nothing to click)? If the hover/cursor styling looks wrong on a non-link card, add a minimal modifier (e.g. `.mdcc-cat-card--static`) rather than fighting the existing link-oriented styles. Check via screenshot before calling this done.

### Copy block 3 — Docs index (`site/content/docs/index.mdx`)

Frontmatter `description` (title unchanged, keep the brand-recall line as the page `<title>`):
```
description: The design tool built around Claude Code, not bolted onto one. Two plugins (design + flow), one CLI, an optional self-hosted hub. No telemetry, no signup.
```

Prepend this paragraph before the existing opening line ("Two plugins, one CLI, and the `.ai/` workspace..."), which stays unchanged right after it:
```
Most design tools bolt AI onto a human workflow. Claude's own canvas is a chat box that forgets everything by morning. Maude is built around Claude Code from day one, so canvases are real files, and the same repo-native model runs `flow`'s plan-to-ship loop too. That's the whole pitch.
```

### Copy block 4 — `layout.tsx` metadata

No rewrite needed. `metadata.description` already says "Vibe-design & vibe-code workflows for Claude Code..." (has the "Claude Code" keyword the SEO audit flagged as missing from the H1, specifically). Task 5 below is a **verification-only** step: re-read after the hero/docs changes land and confirm nothing in `openGraph`/JSON-LD now contradicts the new hero framing (e.g. still calling it "vibe-design & vibe-code" is fine, still accurate, still consistent).

### New skill — `.claude/skills/maude-positioning/SKILL.md` (full content to create)

```markdown
---
name: maude-positioning
description: Message architecture for talking ABOUT Maude the product (what it is, why it's great, how it differs from Figma / Claude Design). Use whenever writing copy that pitches Maude itself: the homepage/docs intro, a README top blurb, a changelog announcement, a social post introducing the project, an elevator pitch for a non-technical person, or any "why is this different from Figma / Claude" explanation. Composes with michal-voice (that skill is the HOW/tone; this one is the WHAT/argument). Repo-internal, not shipped via the marketplace or npm.
---

# maude-positioning — the message architecture for pitching Maude

Repo-internal skill (Maude-specific, lives in `.claude/skills/`, not shipped via the marketplace or npm — same convention as `whats-new-entry` and `desktop-e2e`). This is the **WHAT** to say about Maude the product. Pair it with the personal `michal-voice` skill for the **HOW** (tone, tics, EN-dev mode) whenever the output is copy Michal is publishing himself.

## When to use

Any time you're about to write copy that pitches Maude itself, not a feature inside it: the homepage hero, a docs intro paragraph, the README top blurb, a changelog announcement post, a tweet/LinkedIn post introducing the project, an elevator pitch for a non-technical friend, or anything answering "what is this and why would I use it" or "how is this different from Figma / Claude Design."

Not for: internal command/skill descriptions, DDRs, code comments, or anything that isn't audience-facing marketing copy.

## The core insight

Every other design tool treats AI as an addition. **Figma** is a human-first, cursor-and-mouse tool that bolted a copilot panel onto the side; the cloud file is still the source of truth. **Claude Design** (claude.ai/design and the wider chat-canvas family) is AI-first but ephemeral: a chat box rendering a preview, no git, no real files on disk, no persistent design system to check new work against, gone when the conversation scrolls past it.

Maude starts from the other direction. It's a real, professional-grade tool (canvases are `.tsx` files, history is git, design tokens are CSS variables checked by critics) whose entire substrate was built for how an AI coding agent actually works: a dev-loop, a filesystem, a repo. Nothing here strains against the grain. That's the "wet dream for designers" feeling: the tool was built around the AI instead of the AI being bent to fit the tool.

**Protect this one sentence through every rewrite:** built around AI, not bent to fit one.

## Positioning statement

For someone already living inside Claude Code (a developer, or a designer pairing with one) who wants to design and ship UI without leaving the agent loop, Maude is a canvas-first design toolkit and agentic workflow system that treats the repo, not a proprietary cloud or a chat scroll, as the source of truth. Unlike Figma, the AI isn't a bolted-on feature. Unlike Claude Design, the work doesn't evaporate when the chat does.

## Differentiation (cite only real, checkable facts)

| Axis | Figma | Claude Design (claude.ai/design) | Maude |
| --- | --- | --- | --- |
| Where the AI sits | Bolted-on copilot panel | Is the whole product | Native substrate: every canvas, critic, and command is built for an agent loop |
| Source of truth | Figma's proprietary cloud | The chat scroll (ephemeral) | Your git repo (`.tsx` canvases, `.ai/` decisions, real commits) |
| Persistence | Cloud file, vendor lock-in | None. Gone when the thread does | Git history, `/design:rollback`, snapshots per canvas |
| Design system enforcement | Manual, or a paid plugin | None | Built-in critics (a11y, brand, tokens, motion...) gate every edit |
| Team sync | Figma's hosted multiplayer (paid) | None | Optional **self-hosted** Yjs hub, no SaaS tier |
| Beyond design | N/A (design-only) | N/A (chat-only) | `flow` runs the same repo-native loop for planning and shipping the whole feature, not just the mock |
| Cost / lock-in | Seat-based SaaS | Bundled into a Claude plan | Open-source, MIT, self-hostable, zero telemetry |

Keep `flow` and the hub as the closing row of every version of this table: secondary to the design-tool hook, never dropped entirely.

## Plain-language mode (non-technical audience)

Skip "canvas," "dev server," "critics." Use this shape instead: *"Most design tools let you sketch a screen, then a developer has to rebuild it from scratch. AI chat tools let you describe a screen, but the second the conversation ends, so does the work. Maude designs the real screen with AI, and a developer can ship it as-is, because it was never a mockup to begin with. It's already the real thing."* Anchor on the rebuild-cost pain a non-technical stakeholder actually feels, not on technical plumbing.

## Proof points (cite only shipped features, never a roadmap item)

- Cmd+Click any element in a live canvas and edit it; it writes straight back to the source `.tsx`.
- Full history/rollback per canvas (`/design:rollback`), because it's git underneath.
- A critic panel (a11y, brand, typography, motion...) grades every AI edit against the project's own design system before a human sees it.
- Optional self-hosted sync hub for team multiplayer, Docker or Fly, no SaaS tier, no cloud middleman.
- Open-source, MIT, zero telemetry, no signup.

## Guardrails

- **Accurate only.** Every claim above must map to a shipped feature. If some copy describes something not yet shipped, that's a bug in the copy, not a marketing choice: fix it or cut the claim.
- **Confident, not sneering.** Contrast Figma and Claude Design on real, checkable differences (git, persistence, self-hosting). Never mock the products or their makers. "Different tool, different job" beats "the other guy sucks."
- **Never claim to replace Figma outright.** Maude doesn't do freeform vector editing or a from-scratch visual design practice. It's for the AI-agent-native slice: prototyping, iterating, and shipping UI from inside Claude Code.
- **`flow` and the hub are always secondary, never absent.** The design-tool insight is the hook (the clearest wow factor). Every piece of copy should still surface `flow` and the self-hosted hub after the hook, not instead of it.
- **Compose with `michal-voice`.** This skill decides the argument. `michal-voice` (EN-dev mode, for anything published in English) decides the sentence shapes: short declaratives, dry self-deprecation, **no em-dash as a clause joiner, ever**, no corporate gloss.
```

---

## Tasks

Execute in order. Each task is atomic and testable.

Keywords: CREATE, UPDATE, ADD, REMOVE, REFACTOR, MIRROR

### Task 1: CREATE `.claude/skills/maude-positioning/SKILL.md` — ✅ completed

- **Do**: Write the file with exactly the content drafted in Design Decisions above.
- **Pattern**: `.claude/skills/whats-new-entry/SKILL.md` (frontmatter shape: `name` + `description` only, no `category`/plugin-namespace, single-file skill).
- **Gotcha**: This is a repo-internal skill. Do not add it to `plugins/design/` or `plugins/flow/` (those ship via the marketplace to every downstream user; Maude's own brand positioning is not their concern).
- **Validate**: File exists, frontmatter parses (valid YAML), `name: maude-positioning` matches the directory name.

### Task 2: UPDATE homepage hero (`site/app/(home)/page.tsx`) — ✅ completed

- **Do**: Replace the `<h1>` and the `mdcc-hero-punchline` `<p>` per Copy block 1. Insert the new `mdcc-hero-sku` wink-caption `<p>` between them. Leave every other paragraph in the hero section (the `design`/`flow`/`maude` explainer, the fineprint, the CTAs, the install snippet) untouched.
- **Pattern**: existing `<h1 id="land-h1">` block being replaced (lines ~96-101).
- **Gotcha**: run a tic-pass of the exact wording against `michal-voice`'s anti-pattern list before landing (no em-dash as a clause joiner, already avoided in the drafted text; watch for any AI-tell phrasing creeping in during implementation).
- **Validate**: visual screenshot of the hero (see Task 6).

### Task 3: ADD "why not Figma / Claude Design" section (`site/app/(home)/page.tsx`) — ✅ completed

- **Do**: Insert the new `<section aria-labelledby="why-h">` from Copy block 2, placed between the closing `</section>` of the hero (`mdcc-hero`) and the opening `<section className="mdcc-spotlight" ...>` (the "LATEST DROP" block).
- **Pattern**: `CATALOG.map` card rendering (lines ~200-227) for the card shape, `mdcc-section-head` usage right above it (lines ~192-199) for the heading row shape.
- **Gotcha**: the three comparison cards are static `<div>`s, not `<Link>`s (no page to link a Figma/Claude Design comparison card to). Check visually whether `.mdcc-cat-card`'s hover/cursor styling looks odd without a click target; if so, add a minimal `.mdcc-cat-card--static` modifier in `global.css` that only overrides `cursor`/hover, don't rebuild the card from scratch.
- **Validate**: visual screenshot (Task 6); confirm heading hierarchy doesn't skip a level (`h2` here follows the hero's `h1`, matches the existing pattern where "The canvas talks back" and "The catalog" are also `h2`s at the same nesting depth).

### Task 4: UPDATE docs index (`site/content/docs/index.mdx`) — ✅ completed

- **Do**: Update the frontmatter `description` per Copy block 3. Prepend the new opening paragraph before the existing "Two plugins, one CLI..." line; leave that existing line and everything below it (the `<Cards>`, the "Why both plugins together?" section, etc.) unchanged.
- **Pattern**: existing frontmatter + opening paragraph (lines 1-6 of the file).
- **Gotcha**: this file is hand-authored, not one of the files regenerated by `pnpm --filter @maude/site gen:reference`/`gen:stats` (those generate the `commands-design/`/`commands-flow/`/`config-schema.mdx` reference pages and `stats.json`, not `index.mdx`). Confirm this stays true in Task 5's validation so the `site-content` quality gate doesn't flag or revert this edit.
- **Validate**: `pnpm --filter @maude/site gen:reference && pnpm --filter @maude/site gen:stats` then `git diff -- site/content/docs/index.mdx` shows only the hand-made edit, nothing regenerated on top of it.

### Task 5: VERIFY `site/app/layout.tsx` metadata stays consistent (no edit expected) — ✅ completed (verified, no edit needed)

- **Do**: Re-read `metadata.title`/`metadata.description`/`metadata.openGraph`/the JSON-LD block after Tasks 2-4 land. Confirm none of it now contradicts the new hero/docs framing. Expected outcome: no change needed, since `description` already contains "Claude Code" and the existing wording ("Vibe-design & vibe-code workflows...") is still accurate and not contradicted by the new hero copy.
- **Gotcha**: if you do find a real inconsistency, fix it minimally, don't do a speculative rewrite of metadata that isn't broken.
- **Validate**: manual read-through, no automated check.

### Task 6: Manual visual QA — ✅ completed

- **Do**: Run `pnpm --filter @maude/site dev`, open the homepage, screenshot the hero + new comparison section + docs index page (`/docs`). Confirm: spacing around the new wink caption doesn't look cramped against the H1 above it or the punchline below it; the 3-card comparison grid reads cleanly at desktop width and doesn't break at the existing `880px` hero breakpoint; text contrast is fine (only existing `--fg-0/1/2` tokens are used, should already pass whatever contrast bar the rest of the page passes).
- **Gotcha**: `data-theme="light"` is hardcoded on `<html>` in `layout.tsx` (no dark-mode toggle on this marketing site), so no dark-mode variant to check.
- **Validate**: screenshots look right, no layout breakage, no leftover unused CSS classes referenced that don't exist.

---

## Validation

Run these commands to confirm zero regressions. (This repo's actual configured gates, from `.ai/workflows.config.json` -> `quality`; there is no `typecheck` gate in this repo, don't invent one.)

1. **Format**: `pnpm format`
2. **Lint**: `pnpm lint`
3. **Build**: `pnpm --filter @maude/site build`
4. **Site-content regen check**: `pnpm --filter @maude/site gen:reference && pnpm --filter @maude/site gen:stats`, then `git diff --quiet -- site/content/docs/ site/lib/stats.json` must stay clean (confirms Task 4's hand-edit isn't a generated file and wasn't clobbered).
5. **Tests (safety net)**: `pnpm test && pnpm test:dev-server` (unaffected by this change, run to confirm no regression).
6. **Manual**: Task 6's visual QA (hero, new section, docs index, at desktop width and just under the `880px` hero breakpoint).

**Not applicable to this change** (with reasoning, not a silent skip):
- **Cross-platform scenario runner**: this project's `workflows.config.json` declares `platforms: ["web-desktop"]` only, and this change adds zero new interactivity (no new component state, no new user flow) — it's static marketing copy. No `.ai/scenarios/` entry needed.
- **`a11y-auditor` subagent / `design-system-guard` subagent**: no new interactive elements, no new tokens, no new components; Task 6's manual check (contrast via existing tokens, heading hierarchy) covers the actual risk surface for a copy-only change.

---

## Scenario Coverage (UI tasks)

Not applicable. This is a static-content change to a marketing/docs site with a single declared platform (`web-desktop`) and no new interactive flow. No new scenario required; Task 6 (manual visual QA) is the validation backbone for this plan instead.

---

## Acceptance Criteria

- [x] All 6 tasks completed
- [x] Format, lint, and `@maude/site` build all pass
- [x] `site-content` quality gate stays clean (Task 4 validation — `git diff --stat` after regen showed only the hand-authored `index.mdx` edit)
- [x] `pnpm test` passes (163/163). `pnpm test:dev-server` 1977 pass / 1 skip / 1 fail — the 1 failure (`git-api.test.ts` "status?token= is ignored") is pre-existing flakiness unrelated to this change (untouched `apps/studio` code); re-ran in isolation, 32/32 pass. Not a regression from this plan.
- [x] Manual visual QA (Task 6) done via agent-browser screenshots of `/` and `/docs`, reviewed inline, no layout breakage
- [x] `/flow:validate` fan-out (scenario-runner, a11y-auditor, design-system-guard, security-auditor, ethical-hacker) all green. The fan-out caught 2 real design-system blockers execute-phase manual QA missed: (1) the wink caption's `<p>` tag collided with `.mdcc-hero-copy p`'s CSS specificity and silently lost its intended mono/small/muted styling — fixed by switching to `<div>`, matching the pattern already used for the same class elsewhere on the page; (2) the static comparison cards inherited the clickable-card hover lift/border-glow — fixed with `cursor: 'default'`, matching an existing precedent in `site/app/(home)/desktop/page.tsx`. Both fixes verified live via computed-style probes post-fix. a11y also flagged the same card issue (now resolved) as a warning, not a blocker. Security (defender + ethical-hacker) both PASS, 0 blockers; ethical-hacker raised one process-level (not diff-level) observation about future `.claude/skills/**` review scrutiny, surfaced to the user as a follow-up, not acted on in this plan.
- [x] Hero copy, new comparison section, and docs index opening all avoid the em-dash-as-clause-joiner anti-pattern (checked by construction while drafting)
- [x] `flow` and the self-hosted hub are still explicitly present (as the secondary beat) in every rewritten block, per Michal's explicit instruction
- [x] No DDR-worthy decision left unrecorded (the headline-direction choice is captured in this plan's Solution section, no separate DDR needed for a copy decision)
- [x] Code follows project conventions, no regressions

## Retro

- **What worked:** resolving the one genuinely subjective decision (headline direction) with a live `AskUserQuestion` before writing the plan, instead of guessing or leaving it as a TODO, made execution fully mechanical. Drafting publish-ready copy directly in the plan (not just a description of what copy should say) meant execute had almost nothing to invent.
- **What worked:** running the full `/flow:validate` fan-out (scenario/a11y/design-system/security/ethical-hacker) instead of assuming a "just a copywriting change" is low-risk enough to skip it. It caught 2 real bugs (a CSS specificity collision that silently broke the new caption's styling, and a misleading hover affordance on static cards) that manual screenshot review during `/execute` completely missed — screenshots don't catch "the font/color computed to the wrong value for the right-looking reason." The design-system-guard's use of live computed-style probes (not source-grep) was the difference-maker.
- **What to change next time:** budget for a second screenshot+computed-style pass after `/execute`'s own manual QA, specifically checking any place a CSS class is reused in a *new* structural position (different parent, different tag) — that's exactly the shape of bug that surfaced here (`.mdcc-hero-sku` reused as `<p>` instead of `<div>`, landing inside a different parent selector's cascade).
- **What to change next time:** for a static/informational card grid that deliberately reuses a *clickable*-card class, proactively add `cursor: 'default'` (or a dedicated static modifier) at draft time rather than waiting for a11y/design-system-guard to catch it — this is now a known gotcha for the `.mdcc-cat-card` class specifically.
- **Process note (not this plan's job):** ethical-hacker flagged that `.claude/skills/**` diffs get the same review scrutiny as a doc typo fix, with no CODEOWNERS/CI distinction for "this is a standing instruction a future agent session will treat as authoritative." Worth a future DDR or CONTRIBUTING.md addition; out of scope here.
