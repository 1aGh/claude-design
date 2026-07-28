# Feature: Redesign the docs site → "Studio Docs" (maude DS)

Validate docs and codebase patterns before implementing. Pay attention to existing naming, utils, and imports. This re-skins the **live `site/` Fumadocs app** to match the approved `maude`-DS **Studio Docs** canvases — it does not invent new design; it ports finished pixels.

## Description

The public docs site (`site/`, Next 16 + Fumadocs UI 16.9 + Tailwind v4) is currently themed with the **`project` DS** — "MDCC-DSN/01", warm stock-paper light, catalog-stamp **red** accent, hard 0/2/4 radii. We have approved canvases that re-imagine it under the **`maude` DS** — "Unified Pro Studio": dark-first cool-neutral (hue 255), ONE confident **indigo** accent (`oklch(0.60 0.19 268)`), dotted-canvas backdrop, mono-first, soft radii, two-theme-equal (dark studio / light reading-handoff). This feature switches the site's token foundation to `maude` and re-skins the landing, the docs reader chrome, command-reference pages, search, plus three new surfaces from the canvases: the **flow infographic embedded inline in `/docs/flow`**, a **combined Changelog & Roadmap** timeline, and the **intro-video** placement on the landing.

## User Story

As a visitor to maude's docs I want the site to look and read like the Maude studio itself — one cohesive, calm, dark-first instrument — so that the docs feel like part of the product, not a separate marketing skin.

## Problem

- The live site and the product (the canvas browser, themed `maude`) look like two different products — different palette (red vs indigo), different temperature (warm vs cool), different radii.
- Infographics don't exist on the site at all; the flow lifecycle is a prose table.
- `/roadmap` and `/whats-new` are two thin separate pages; the canvas merges them into one timeline.
- There is no intro-video placement.

## Solution

1. **Token foundation** — retarget the token-sync pipeline so `site/app/mdcc-tokens.css` is generated from `.design/system/maude/colors_and_type.css` (transformed to the site's `.mdcc`/`html.dark` scoping), and rewrite the `global.css` theme bridge to the maude dark/light blocks. One change flips the entire palette/type/radius/spacing foundation site-wide.
2. **Re-skin** the landing (`mdcc-*` classes in `global.css` + `(home)/page.tsx`), the Fumadocs DocsLayout chrome (CSS + `baseOptions`), the command-reference pages, and the dotted-canvas backdrop.
3. **New surfaces** — port `FlowLoopDiagram` from the canvas into an MDX component used inline in `flow.mdx`; build a combined Changelog & Roadmap timeline reusing the existing `roadmap-timeline.tsx` + `whats-new-feed.tsx` data; add the intro-video player to the landing.

## Metadata

- **Type**: Enhancement (visual redesign of an existing app)
- **Complexity**: High
- **App/Package**: `@maude/site` (the `site/` workspace member) — single package, but broad surface within it
- **Affected Systems**: token sync pipeline, `global.css` theme bridge, Fumadocs layout config, landing page, docs reader, command-ref MDX template, MDX component registry, roadmap/whats-new pages
- **Dependencies**: no new npm deps (Fumadocs + Tailwind v4 already present). New build-time coupling: site token sync now reads `system/maude` instead of `system/project`.

---

## Context References

### Must-Read Files

> During `/flow:execute`, read these in parallel (one assistant message, multiple Read calls).

- `site/scripts/sync-mdcc-tokens.mjs` (whole file) — Why: the token pipeline; `SRC = .design/system/project/colors_and_type.css → DST = site/app/mdcc-tokens.css`, with a `--check` drift gate wired into the `site-content`/`tokens` quality gates. **This is the load-bearing file** — retargeting + selector transform happens here.
- `site/app/global.css` (lines 1–120 for the bridge; 129 `mdcc-*` rules total) — Why: the `@import` chain (`tailwindcss` → fumadocs neutral+preset → `mdcc-tokens.css`), the **hardcoded `html.dark.mdcc` dark block** (DDR-011 bridge), the fumadocs `--color-fd-*` slot mapping, and all landing/chrome classes.
- `site/app/mdcc-tokens.css` (whole) — Why: current generated token file (`:root` light + `.mdcc[data-theme]`); shows the exact token names the site consumes (`--bg-0..4`, `--fg-0..3`, `--accent*`, `--radius-*`, `--space-*`, `--status-*`, `--mono-*`).
- `.design/system/maude/colors_and_type.css` (whole) — Why: the **new source of truth**; note its scoping is `:root, .maude[data-theme="dark"]` + `.maude[data-theme="light"]` and it adds tokens the site doesn't have yet (`--canvas-bg/--canvas-dot/--canvas-grid`, `--presence-*`, `--dur-*`, `--ease-*`, `--font-*`, `--lh-*`, `--type-*`, `--tracking-*`, `--shadow-*`). Diff the token NAME sets — any name the site uses but maude lacks (e.g. `--mono-cell-bg`, `--mono-rule`, `--shadow-focus`) must be added to the transform or aliased.
- `site/app/layout.tsx` — Why: `<html className="… mdcc">` wrapper + `mdcc-skip-link` + `RootProvider` + JetBrains font var. The `.mdcc` wrapper class is the site-internal scope we keep.
- `site/lib/layout.shared.ts` — Why: `baseOptions()` (fumadocs nav links, logo) shared by `HomeLayout` + `DocsLayout`; where the menubar nav (Docs/Roadmap/What's New/About) is configured.
- `site/app/(home)/page.tsx` — Why: the landing (`mdcc-landing` / `mdcc-hero` / `mdcc-cat-card` / install snippet). Re-skin target + intro-video insertion point.
- `site/app/docs/layout.tsx` + `site/app/docs/[[...slug]]/page.tsx` — Why: Fumadocs `DocsLayout` (sidebar tree + TOC) and the article renderer; the "studio chrome" reskin is mostly CSS over these.
- `site/components/mdcc/roadmap-timeline.tsx` + `site/components/mdcc/whats-new-feed.tsx` — Why: existing components for the two data sources (`site/lib/roadmap.json`, `whats-new.json`); the combined timeline builds on these.
- `site/components/mdx.tsx` (+ wherever `mdx-components` is exported) — Why: the MDX component registry where `<FlowLoop>` gets registered for use in `flow.mdx`.
- `site/content/docs/flow.mdx` — Why: where the embedded infographic goes (replace/augment the prose table with `<FlowLoop />`).
- `scripts/build-command-reference.mjs` + `scripts/build-schema-reference.mjs` (in `site/scripts/`) — Why: command/schema doc pages are AUTO-GENERATED from frontmatter; the command-ref **template** (property table + "source of truth") is emitted here, so reskinning command pages = editing the generator + its CSS, not the `.mdx`.

### Files to Create

- `site/components/mdcc/flow-loop.tsx` — the `FlowLoopDiagram` ported from `.design/ui/Studio Docs.tsx` as a real MDX-usable React component (server component; no canvas-lib deps).
- `site/components/mdcc/intro-video.tsx` — the landing intro-video player (poster + play + scrubber chrome) from `Studio Intro Video.tsx` board A.
- `site/components/mdcc/changelog-timeline.tsx` — combined Now/Shipped/Next timeline (merges roadmap.json + whats-new.json), if the combine decision is taken (see DDR below).
- `site/app/(home)/changelog/page.tsx` — the combined page (only if combining; else restyle the existing `/roadmap` + `/whats-new`).
- `.ai/archive/decisions/DDR-099-site-token-retarget-maude.md` — record the project→maude token retarget + selector-transform approach.

### Design canvases

> The authoritative mockups. These are the finished pixels; the implementation grounds itself here, not in re-derivation. Both are `maude` DS.

| Canvas | DS | Artboards | Notes |
| ------ | -- | --------- | ----- |
| `.design/ui/Studio Docs.tsx` | maude | 7 | **The primary reference.** landing · docs-home · article (+light reading inset) · command-ref · ⌘K search · **flow-docs (infographic embedded inline as Figure 1)** · **changelog & roadmap (combined timeline)**. Sibling `Studio Docs.css` is the class-level spec (`.sd-*`). Envelope: `.design/_history/studio-docs/000-envelope.md`. |
| `.design/ui/Studio Intro Video.tsx` | maude | 2 | main-page player placement (hero + Play CTA + 16:9 player) · storyboard/script. Sibling `Studio Intro Video.css`. |
| `.design/ui/Docs Site.tsx` | project | (legacy) | The OLD project-DS docs redesign — superseded by Studio Docs; ignore for visual reference, keep only for IA diffing. |

> Baseline screenshots: `.design/_history/studio-docs/*.png` (001–007 final set) + `iter5/v2-flow-docs.png`, `iter5/pw-changelog.png`; `.design/_history/studio-intro-video/00{1,2}-*.png`.

### Documentation

- Fumadocs theming — https://fumadocs.dev/docs/ui/theme — Why: how `--color-fd-*` slots map to a custom palette + `DocsLayout`/`HomeLayout` customization surface (sidebar, TOC, nav). Use context7 `fumadocs-ui` for the 16.9 API.
- Fumadocs layouts — https://fumadocs.dev/docs/ui/layouts/docs — Why: `baseOptions`, `tree`, sidebar/nav slots; confirm which chrome is CSS-only vs requires layout props.
- Tailwind v4 `@theme` — Why: tokens are consumed as CSS vars + Tailwind utilities; confirm the `@theme inline` bridge so `bg-background`/`text-foreground` resolve to `--bg-*`/`--fg-*`.

### Patterns to Follow

- **Token source-of-truth stays in `.design/`** — never hand-edit `site/app/mdcc-tokens.css`; it's generated. Mirror the existing `sync-mdcc-tokens.mjs` SRC/DST + `--check` pattern (extend it, don't replace it).
- **No hardcoded colors** in components — every value a `var(--*)` token or Tailwind class bound to one (the canvases already obey this; the `.sd-*` CSS is the reference).
- **Generated doc pages** — command/schema pages come from `build-*-reference.mjs`; edit the generator, never the emitted `.mdx`.
- **Theme bridge** (DDR-011) — `.mdcc` wrapper + fumadocs `.dark` className on `<html>`; keep this mechanism, swap the values.

---

## Design Decisions

> UI feature — populated from the canvases + maude DS.

### Token bridge (the central decision — DDR-worthy)

**Approach:** keep the site's `.mdcc` wrapper class name (avoids touching `layout.tsx` + all 129 `mdcc-*` rules), and **extend `sync-mdcc-tokens.mjs`** to:
1. Read `SRC = .design/system/maude/colors_and_type.css` (retarget; make it a const at top, optionally `--ds=<name>`).
2. **Transform selectors** during sync: `:root, .maude[data-theme="dark"]` → `html.dark.mdcc, html.dark .mdcc`; `.maude[data-theme="light"]` → `:root, .mdcc, .mdcc[data-theme="light"]`. (Light is the site's default `:root`, matching the current file; dark rides fumadocs `.dark`.)
3. Then **delete the hardcoded `html.dark.mdcc` block in `global.css`** (the synced file now carries dark) and keep only the `--color-fd-*` slot mapping.

This keeps `.design` authoritative, the gate green (`--check` compares the transformed output), and the blast radius inside `mdcc-tokens.css` + a ~40-line `global.css` deletion.

### Token name reconciliation

Diff `system/maude` token names against what the site consumes. Maude **adds** `--canvas-*`, `--presence-*`, `--dur-*/--ease-*`, full `--type-*/--lh-*/--font-*/--tracking-*`, `--shadow-*`. The site may consume names maude lacks: `--mono-cell-bg`, `--mono-cell-fg`, `--mono-rule`, `--shadow-focus`. **Add aliases** in the transform (e.g. `--mono-cell-bg: var(--bg-2)`, `--mono-rule: var(--border-subtle)`, `--shadow-focus: 0 0 0 2px var(--accent)`) so no site class breaks. Enumerate the exact missing set during Task 1.

### Components (reuse first)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `roadmap-timeline` | `site/components/mdcc/roadmap-timeline.tsx` | reuse the `roadmap.json` read; restyle to the canvas timeline (spine + status dots). |
| `whats-new-feed` | `site/components/mdcc/whats-new-feed.tsx` | reuse the `whats-new.json` read; fold into the combined timeline's "Shipped" group. |
| Fumadocs `DocsLayout` / `HomeLayout` | `fumadocs-ui` | reuse; restyle via tokens + CSS, do NOT fork the layout. |
| `Cards`/`Card` (Fumadocs MDX) | `fumadocs-ui` | the "Pick a direction" grid already uses these in `index.mdx`; restyle. |

### Custom Components Needed

| Component | Reason | Extends |
| --------- | ------ | ------- |
| `FlowLoop` (`flow-loop.tsx`) | no infographic component exists; port `FlowLoopDiagram` from the canvas | none (plain RSC + CSS) |
| `IntroVideo` (`intro-video.tsx`) | landing player placement | none |
| `ChangelogTimeline` (`changelog-timeline.tsx`) | merge two data sources into one timeline | composes roadmap + whats-new data |

### Icons

Match the canvas icon language — thin-stroke (1.4) single-weight line glyphs, **no emoji**. The canvases inline small SVG sets; on the site, prefer the existing icon approach (check `components/mdcc/` for an icon set; if none, inline the same SVGs from the canvas). Record exact glyph names during Task 5.

### Tokens (site-consumed → maude)

| Purpose | Token | Tailwind / usage |
| ------- | ----- | ---------------- |
| Page bg (dark studio default) | `--bg-0` | `bg-background` / `--color-fd-background` |
| Panel/card | `--bg-1` | `--color-fd-card` |
| Primary ink | `--fg-0` | `text-foreground` / `--color-fd-foreground` |
| Accent (indigo, one job/surface) | `--accent` | `--color-fd-primary`, links, active nav |
| Dotted canvas backdrop | `--canvas-bg`/`--canvas-dot`/`--canvas-grid` | radial-gradient on landing + docs shells (NEW tokens) |
| Hairline | `--border-default` | `--color-fd-border` |

### Theme default decision

Maude is **dark-first** (studio default), light = reading/handoff. The current site defaults to **light** (`:root` = paper) with a `.dark` toggle. **Decision to confirm:** keep light as the site default (lower SEO/first-paint risk, fumadocs default) but ship both equally — OR flip the site to dark-default to match the studio. Recommend: **keep the fumadocs toggle, default = system, ensure both themes are first-class** (the canvas shows both). Flag in the DDR; don't silently change default.

---

## Tasks

Execute in order. Each is atomic and testable.

### Task 1: REFACTOR `sync-mdcc-tokens.mjs` → maude source + selector transform

- **Do**: change `SRC` to `.design/system/maude/colors_and_type.css`; add a transform that rewrites maude `.maude[data-theme]` scoping to the site's `:root`/`html.dark.mdcc` scoping (see Design Decisions); append alias declarations for site-consumed token names maude lacks (`--mono-cell-bg/-fg`, `--mono-rule`, `--shadow-focus`, any others found). Keep the `--check` mode comparing the transformed output.
- **Pattern**: mirror the existing read/transform/write + `--check` structure already in the file.
- **Gotcha**: the `tokens`/`site-content` quality gates run `--check`; after this task run `pnpm --filter @maude/site sync:tokens` to regenerate `mdcc-tokens.css` and commit it, or the gate reds.
- **Validate**: `pnpm --filter @maude/site sync:tokens && pnpm --filter @maude/site sync:tokens:check`

### Task 2: UPDATE `global.css` theme bridge

- **Do**: delete the hardcoded `html.dark.mdcc { … }` project-palette block (now carried by the synced file); verify the `--color-fd-*` slot mapping still resolves to `--bg-*`/`--fg-*`/`--accent`; add the `--canvas-*` dotted-backdrop helper (a reusable `.mdcc-canvas` class: `background-color/image/size` from the new tokens).
- **Gotcha**: specificity — confirm `html.dark.mdcc` (from the synced file) wins over `:root`. Re-check the DDR-011 note.
- **Validate**: `pnpm --filter @maude/site build` renders both themes without unresolved `var()`.

### Task 3: RESKIN landing (`(home)/page.tsx` + `mdcc-*` landing classes in `global.css`)

- **Do**: match `Studio Docs` board A — hero ("Maude, how it works mostly."), install snippet, catalog SKU cards (design/flow/maude/hub), dotted-canvas backdrop, the watch-intro chip. Most changes are CSS-value updates (the structure exists); align radii/spacing/type to maude. Reference `.design/ui/Studio Docs.css` `.sd-hero*`/`.sd-cat-*`/`.sd-install*`.
- **Validate**: visual diff vs `_history/studio-docs/001-screen-landing.png`.

### Task 4: RESKIN docs reader chrome (Fumadocs `DocsLayout` via CSS + `baseOptions`)

- **Do**: match board B/C — left nav tree, content column, right "On this page" TOC, breadcrumb, the dotted backdrop behind content, the light **reading** inset behavior (theme toggle). Adjust `--color-fd-*` + fumadocs sidebar/TOC CSS to the maude chrome (hairlines, mono section labels, accent active row). Update `baseOptions()` nav (Docs/Roadmap/What's New/About) + logo to the maude wordmark.
- **Gotcha**: Fumadocs 16.9 owns the layout DOM — restyle via its CSS vars + slots; do not fork `DocsLayout`. Confirm available slots via context7.
- **Validate**: visual diff vs `002-screen-docs-home.png` + `003-screen-article.png`.

### Task 5: RESKIN command-reference template (`build-command-reference.mjs` + CSS)

- **Do**: match board D — property table (Command/Category/Arg hint/Source), invocation block, "source of truth → .md" callout. Edit the generator's emitted markup/classes + the `.mdcc` table/callout CSS. Re-run `gen:reference`.
- **Gotcha**: pages are generated — edit `build-command-reference.mjs`, not the `.mdx`; the `site-content` gate checks the regen diff is committed.
- **Validate**: `pnpm --filter @maude/site gen:reference` then diff a generated command page vs `004-screen-command-ref.png`.

### Task 6: CREATE `<FlowLoop>` MDX component + embed in `flow.mdx`

- **Do**: port `FlowLoopDiagram` (+ its `.sd-fl*`/`.sd-ai-band`/`.sd-fl-return` CSS) from `Studio Docs.tsx` into `site/components/mdcc/flow-loop.tsx` as a server component; register it in the MDX components map (`components/mdx.tsx`); use `<FlowLoop />` inside `content/docs/flow.mdx` as a `<figure>` (board F). The 30-command lifecycle data lives in the component.
- **Pattern**: existing `roadmap-timeline.tsx` is the model for an `mdcc/` component consumed by the site.
- **Gotcha**: keep it dependency-free (no `@maude/canvas-lib`); inline the icons. Ensure it reads well at the docs content width (the canvas figure variant parks ghost numerals top-right).
- **Validate**: visual diff vs `iter5/v2-flow-docs.png`; render `/docs/flow` in dev.

### Task 7: BUILD combined Changelog & Roadmap (decision-gated)

- **Do**: per the DDR (combine vs keep-separate), build `changelog-timeline.tsx` merging `roadmap.json` (Now/Next) + `whats-new.json` (Shipped) into one spine timeline (board G — status dots + segmented filter + dot legend), mount at `/changelog` (and redirect/restyle the old `/roadmap` + `/whats-new`, or keep them as filtered views). Update `baseOptions` nav.
- **Gotcha**: `roadmap.json` + `whats-new.json` are generated (`build-roadmap.mjs` / `build-whats-new.mjs`) — consume them read-only; don't change their shape without updating the generators.
- **Validate**: visual diff vs `iter5/pw-changelog.png`.

### Task 8: ADD intro-video to the landing

- **Do**: port `IntroVideo` board-A player (poster + play + scrubber chrome) into `intro-video.tsx`; place it on `(home)/page.tsx` per the canvas. The actual 38s film is a **content follow-up** — ship the player with a poster + disabled/"coming soon" or a placeholder `<video>` slot; note it.
- **Validate**: visual diff vs `studio-intro-video/001-screen-landing.png`.

### Task 9: A11y + responsive sweep

- **Do**: verify both themes hit WCAG AA contrast (maude tokens are pre-computed AA; confirm after the fumadocs slot remap), focus rings on nav/cards/player, `prefers-reduced-motion`, mobile docs nav drawer + landing reflow.
- **Validate**: `a11y-auditor` subagent + responsive scenario.

---

## Validation

1. **Lint**: `pnpm lint` (biome)
2. **Types**: `pnpm --filter @maude/site types:check` (`fumadocs-mdx && next typegen && tsc --noEmit`)
3. **Tokens drift**: `pnpm --filter @maude/site sync:tokens:check`
4. **Site content drift**: `pnpm --filter @maude/site gen:reference && gen:stats` then `git diff --quiet site/content/docs site/lib/stats.json`
5. **Build**: `pnpm --filter @maude/site build`
6. **Cross-platform scenario**: spawn `scenario-runner` — landing + docs article + changelog across web-desktop, web-mobile (+ ios/android via emulation). 0 blockers, parity OK.
7. **Design System Guard**: spawn `design-system-guard` — verify the rendered site matches the maude DS (indigo accent one-job, hairlines, no red, dotted canvas) against scenario screenshots + the Studio Docs canvases.
8. **A11y**: spawn `a11y-auditor` — live axe-core over `/`, `/docs/*`, `/docs/flow`, `/changelog` in both themes.
9. **Manual**: theme toggle (dark↔light), Cmd-K search, the embedded flow figure at narrow widths, command-ref pages, the light reading inset.

---

## Scenario Coverage (UI — required)

**New scenarios to create:**

- `docs-redesign-landing` — flow: load `/` → toggle theme → click a catalog card → "Read the docs"; persona: first-time visitor; fixtures: none (static site).
- `docs-redesign-reader` — flow: `/docs` → open Getting Started → open `/docs/flow` (assert the embedded `<FlowLoop>` figure renders) → Cmd-K search; persona: developer evaluating maude.
- `docs-redesign-changelog` — flow: `/changelog` → segmented filter Now/Shipped/Next; persona: returning user checking what shipped.

`/done` runs `scenario-runner` across 5 platforms; these block `/done` if missing runners.

---

## Acceptance Criteria

- [ ] Token sync retargeted to `maude`; `mdcc-tokens.css` regenerated + committed; `sync:tokens:check` green
- [ ] `global.css` project-palette dark block removed; both themes resolve all `var()`s
- [ ] Landing, docs reader, command-ref reskinned to match the Studio Docs canvases (visual diff ≤ minor)
- [ ] `<FlowLoop>` renders inline in `/docs/flow`
- [ ] Combined Changelog & Roadmap shipped per DDR (or keep-separate decision recorded)
- [ ] Intro-video player on the landing (film asset noted as content follow-up)
- [ ] `/flow:utils-verify` passes after each task (Edit-Verify Loop, max 3 iters)
- [ ] `/validate` overall: static + types + **tokens + site-content drift** + build + `scenario-runner` (0 blockers, parity_ok) + `design-system-guard` 0 blockers + `a11y-auditor` 0 blockers
- [ ] Scenario report linked in PR
- [ ] DDR recorded for the token retarget + the combine + the theme-default decisions
- [ ] No hardcoded colors; no `project`-DS red anywhere; no regressions

---

## Retro (2026-06-08)

**What worked**
- Porting via the `.sd-*` canvas CSS as the literal spec made the reskin mechanical and high-fidelity — every new component (`FlowLoop`, `IntroVideo`, `ChangelogTimeline`, `MaudeMark`) lifted classes 1:1, no re-derivation.
- The token-sync **selector transform** (one `SRC` swap + 3 selector rewrites + a reconciliation block) flipped the entire site palette/type/radius with the blast radius staying inside `mdcc-tokens.css` + a ~40-line `global.css` deletion, exactly as the plan predicted.
- Verifying each surface with axe + agent-browser screenshots in BOTH themes caught real issues (2 serious a11y) before commit.

**What didn't / friction**
- **agent-browser viewport/device resize was unavailable** this session (stuck at 1280px) → could not visually verify the mobile reflow. Mitigated by authoring per-component breakpoints + a desktop no-overflow probe; full mobile parity deferred to a real scenario run.
- **Turbopack served stale CSS** for a large `global.css` addition (the intro-video block computed as `position:static`) — a clean dev-server restart fixed it. Lesson (reinforces `[[css-var-alias-scope-trap]]`): verify new CSS with a `getComputedStyle` probe, not just a screenshot; restart the dev server after big `global.css` edits.
- First cut of the brand mark used the canvas `BrandMark` **caret** glyph; the authoritative mark is the **spark-on-bubble** in `system/maude/preview/logo.tsx`. Lesson: when a DS ships a dedicated `logo`/signature specimen, that's the source of truth for the mark — check `system/<ds>/preview/` before lifting an incidental glyph from a UI canvas.

**For next /plan or /execute**
- A docs/web-only target should state up front that the 5-platform `scenario-runner` reduces to web-desktop + web-mobile (no native), so `/done` doesn't read as a gate miss.
- Add a "brand assets" line to design-port plans pointing at `system/<ds>/preview/logo.*` so the mark/favicon aren't reverse-engineered from a UI board.
