# Feature: Docs site infographics + diagrams

## Description

Add a small library of **diagram primitives** to the docs site and
insert them into the highest-traffic pages. Today the docs are
text-heavy markdown tables — accurate but visually flat. Adding
SKU-stamped, hairline-bordered SVG/CSS diagrams in the project's
catalog aesthetic gives readers a second axis (visual scan) for the
same content and makes the site stop feeling like a markdown dump.

Scope is **diagram components + insertion points**, not a redesign.
No new fonts, no new colors, no animation libs. Pure React + SVG +
the existing `mdcc-tokens.css` token set.

## User Story

As a **first-time docs visitor**, I want **diagrams between the
text blocks** so that:

1. I can grasp the maude architecture (Claude Code + plugins + CLI
   + `.ai/` + `.design/`) at a glance instead of reading three
   paragraphs.
2. I see the **canvas loop** and **flow lifecycle** as cycles, not
   as tables of verbs.
3. I see the **install path** as a 4-step strip, not as four H2
   sections.
4. The Dev-server runtime contract (three JSON files + history
   folder) shows up as a labeled schema, not a markdown table.
5. The catalog vibe shows up in the docs too — diagrams carry SKU
   stamps like the landing page does.

## Problem

The docs side of the site lags the landing/about side visually.
Landing has SKU labels, the CATALOG header, hero install card, a
catalog grid. Docs pages have markdown body + tables + cards. The
brand identity stops at the docs sidebar.

Secondary problem: a few load-bearing concepts are hard to grasp
from prose alone — the `_server.json` / `_active.json` /
`_history/` runtime contract; the relationship between Claude
Code, the marketplace, the two plugins, and the CLI; the
distinction between setup-once and daily commands inside each
plugin.

## Solution

Two layers:

### Layer 1 — Diagram primitive library (`site/components/mdcc/diagrams/`)

Eight React components, all SVG- or CSS-only, all using the
`mdcc-tokens.css` token set, all carrying an optional SKU prop.

| Component | Purpose | Used on |
| --------- | ------- | ------- |
| `ArchitectureMap` | The big system map. Claude Code shell containing plugins (`design`, `flow`), CLI binary, `.ai/` + `.design/` folders. 1 px hairlines + accent annotations. | `docs/index.mdx` |
| `CommandFlow` | Horizontal numbered step strip. Each step is a bordered box with a step number, command, one-line caption. Arrow glyphs between. | `docs/getting-started.mdx`, `docs/cli.mdx` |
| `LoopDiagram` | Cycle diagram. N nodes arranged on a closed loop with arrowed segments. Each node = command + tiny caption. Pause / restart annotations welcome. | `docs/design/index.mdx`, `docs/flow.mdx` |
| `CommandTree` | Grouped command catalog. Lists slash commands by category as a stylized tree (Setup / Daily / Validate / Bug / …). Hairline guides, glyph leaves. | `docs/flow.mdx`, `docs/design/index.mdx` |
| `FileTree` | Pre-formatted ASCII-style folder tree. Berkeley Mono, optional row highlight (`data-highlight="add"` accent-tinted for "new" files). | `docs/getting-started.mdx`, `docs/cli.mdx` |
| `StatPanel` | SKU-stamped stat strip. Big number + label + small caption per cell. Hairline dividers between cells. Number-driven by build-stats. | `docs/index.mdx` |
| `InspectorDiagram` | Stylized canvas iframe with the Cmd+Click inspector overlay drawn on top. Halo around one element, selection annotation, `_active.json` callout. | `docs/design/index.mdx` |
| `DevServerSchema` | Three-pane schema of `_server.json`, `_active.json`, `_history/<slug>/`. Each pane lists keys; arrows show producer (server) → consumer (slash command). | `docs/design/index.mdx` |

Every component:

- Exports a typed React component, no `any`.
- Takes a required `caption` prop and optional `sku` prop. Default
  SKU = `MDCC-DGM/NN · ${component-slug}`.
- Renders semantic SVG with `role="img"` + `aria-label={caption}`.
  Tabular data inside the diagram is still announced via the
  surrounding markdown.
- Uses `var(--…)` tokens only. No hardcoded colors.
- Mobile reflow: on `< 640 px`, multi-column diagrams either
  stack vertically or scroll horizontally with a visible
  hint shadow.

### Layer 2 — Insertions

Per docs page, the planned insertions:

```
docs/index.mdx
  ↑ hero: <ArchitectureMap caption="maude at a glance" />
  ↓ above "License and source": <StatPanel /> (commands · critics · plugins · CLI · telemetry)

docs/getting-started.mdx
  after "## Init the workspace" tree fence:
    <FileTree variant=".ai/" highlight={['workflows.config.json']} />
  before "## Open the design browser":
    <CommandFlow steps=[install · marketplace · plugins · init] />

docs/design/index.mdx
  after intro paragraph:
    <InspectorDiagram caption="Cmd+Click scopes the next /design:edit" />
  inside "## Twelve commands" between Setup table and Daily table:
    <LoopDiagram nodes=[init → setup-ds → setup-docs → new → edit → critic → handoff] />
  inside "## Dev server runtime files":
    <DevServerSchema /> replacing the existing markdown table
  end of page:
    <CommandTree plugin="design" />

docs/flow.mdx
  after intro paragraph:
    <LoopDiagram nodes=[init → setup-prd → plan → execute → done → repeat] />
  end of page:
    <CommandTree plugin="flow" />

docs/cli.mdx
  after intro:
    <FileTree variant="cli-subcommands" />
  inside "## maude init":
    <CommandFlow steps=[install · maude init · /flow:init · ready] />
```

## Metadata

- **GitHub Issue**: (none — internal)
- **Type**: New Capability + Enhancement
- **Complexity**: Medium
- **App/Package**: `site` (Next.js + fumadocs)
- **Affected Systems**: `site/components/mdcc/`, `site/components/mdx.tsx`, content under `site/content/docs/`, `site/app/mdcc-tokens.css` (only if a new token surface is needed — try not to)
- **Dependencies**: none new. React + SVG. Token set already exists.

---

## Context References

### Must-Read Files

- `site/components/mdcc/roadmap-timeline.tsx` — reference for the
  catalog-aesthetic visual component pattern (SKU labels, status
  glyphs, hairline structure, status-driven token usage).
- `site/components/mdcc/sku-label.tsx` — SKU label primitive,
  reused inside every diagram.
- `site/components/mdcc/callout.tsx` — pattern for the simplest
  MDX-injected primitive.
- `site/components/mdx.tsx` — MDX registry. Diagrams are added
  here so they're auto-injected into every `.mdx` without an
  explicit import line.
- `site/app/mdcc-tokens.css` — authoritative token file. The
  "Hard NOs" header (no gradients, no blur, no shadow) constrains
  diagram aesthetics. Reuse `--border-subtle`, `--border-default`,
  `--bg-1`, `--accent`, `--fg-0`, `--fg-1`, `--fg-2`.
- `site/lib/stats.json` — build-stats output. `StatPanel` reads
  from this. Build step is `site/scripts/build-stats.mjs`.
- `site/app/(home)/page.tsx` — landing reference for catalog
  vocabulary (`mdcc-hero-sku`, `mdcc-cat-card`, `mdcc-eyebrow`,
  catalog footer). Diagrams should rhyme with these patterns
  visually.

### Files to Create

- `site/components/mdcc/diagrams/index.ts` — barrel
- `site/components/mdcc/diagrams/architecture-map.tsx`
- `site/components/mdcc/diagrams/command-flow.tsx`
- `site/components/mdcc/diagrams/loop-diagram.tsx`
- `site/components/mdcc/diagrams/command-tree.tsx`
- `site/components/mdcc/diagrams/file-tree.tsx`
- `site/components/mdcc/diagrams/stat-panel.tsx`
- `site/components/mdcc/diagrams/inspector-diagram.tsx`
- `site/components/mdcc/diagrams/dev-server-schema.tsx`
- `site/components/mdcc/diagrams/_frame.tsx` — shared `DiagramFrame`
  wrapper (SKU stamp + hairline border + caption row). All eight
  diagrams render inside this frame.
- `site/components/mdcc/diagrams/_diagrams.css` — diagram-scoped
  styles (grid templates, mobile reflow). Imported once from
  `mdx.tsx`.
- `site/lib/diagram-data.ts` — **konsolidovaný** data soubor pro
  `LoopDiagram` nodes, `CommandFlow` steps, `FileTree` rows
  a `CommandTree` source. Nahrazuje původně plánované oddělené
  `commands.ts` + `loops.ts` + `install-steps.ts` (review feedback —
  jeden zdroj místo tří).
- `<designRoot>/ui/docs-infographics.tsx` — canvas návrh všech
  osmi diagramů přes `/design:new` (Task 0). Slouží jako visual
  spec pro Tasks 3–10. **NEMAZAT v Task 17** — zůstává jako
  living design reference v design rootu.

### Files to Update

- `site/components/mdx.tsx` — register all eight components.
- `site/content/docs/index.mdx` — insert ArchitectureMap +
  StatPanel.
- `site/content/docs/getting-started.mdx` — insert FileTree +
  CommandFlow.
- `site/content/docs/design/index.mdx` — insert InspectorDiagram +
  LoopDiagram + DevServerSchema + CommandTree.
- `site/content/docs/flow.mdx` — insert LoopDiagram + CommandTree.
- `site/content/docs/cli.mdx` — insert FileTree + CommandFlow.

### Documentation

- [fumadocs MDX components](https://fumadocs.dev/docs/headless/components)
  — Why: confirms components registered through `getMDXComponents`
  are auto-available in every `.mdx` without an explicit import.
- [SVG `role="img"` + `aria-label`](https://www.w3.org/TR/SVG-AAM/)
  — Why: each diagram must be announced as an image with the
  caption as label.

### Patterns to Follow

From `roadmap-timeline.tsx`:

```tsx
// SKU + glyph + hairline + status-driven token use.
const STATUS_GLYPH: Record<Status, string> = {
  done: '[x]',
  'in-progress': '[~]',
  planned: '[ ]',
  icebox: '[*]',
};
function skuFor(phase: Phase): string {
  const key = phase.phaseKey ?? phase.id.replace(/[^a-z0-9]+/gi, '-').slice(0, 12);
  return `MDCC-RDM/${key}`;
}
```

Diagrams use the same `MDCC-XXX/NN` shape. Reserved prefixes:

- `MDCC-DGM/MAP` — ArchitectureMap
- `MDCC-DGM/FLW` — CommandFlow
- `MDCC-DGM/LP` — LoopDiagram
- `MDCC-DGM/TR` — CommandTree
- `MDCC-DGM/FT` — FileTree
- `MDCC-DGM/STT` — StatPanel
- `MDCC-DGM/INS` — InspectorDiagram
- `MDCC-DGM/SRV` — DevServerSchema

---

## Design Decisions

### Components (from registry)

| Component | Source | Notes |
| --------- | ------ | ----- |
| `SkuLabel` | `site/components/mdcc/sku-label.tsx` | Reused inside every diagram frame |
| `Callout` | `site/components/mdcc/callout.tsx` | Pattern reference for simplest MDX primitive |
| `RoadmapTimeline` | `site/components/mdcc/roadmap-timeline.tsx` | Pattern reference for catalog visual component |

### Tokens

| Purpose | Token | Notes |
| ------- | ----- | ----- |
| Diagram bg | `--bg-1` | Paper card surface |
| Border (default 1 px) | `--border-default` | Diagram outline + cell dividers |
| Border (subtle, nested) | `--border-subtle` | Inner gridlines on `ArchitectureMap`, `CommandTree` |
| Border (strong, focal) | `--border-strong` | Active node outline on `LoopDiagram`, highlighted file in `FileTree` |
| Primary text | `--fg-0` | Diagram body labels |
| Secondary text | `--fg-1` | Captions, helper hints |
| Tertiary text | `--fg-2` | SKU sub-text, units |
| Accent | `--accent` | One highlight per diagram (active node, new file row, "this is what just happened" pointer) |
| Mono font | inherited from `:root` | Berkeley Mono primary, JetBrains fallback |
| Radius | 0 / 2 px max | Hard-edges rule from tokens.css |
| Stroke | `1px solid` | Hairline rule — no fills, no blurs |

### Icons

No icon library. Diagrams use either:

- Pure typography (`> `, `└─`, `├─`, `→`, `↻`, `[x]`, `[ ]`, `[~]`)
- Inline SVG primitives (rect, circle, path) drawn at 1 px stroke

Rationale: icon libraries would force a dependency and a stroke
mismatch. The catalog aesthetic is intentionally typographic.

### Custom Components Needed

| Component | Reason |
| --------- | ------ |
| All eight diagrams | No diagram primitives exist in the project today. |
| `_frame.tsx` wrapper | Shared chrome (SKU stamp + hairline border + caption) avoids drift across the eight diagrams. |

---

## Tasks

Execute in order. Task 0 je **design gate přes maude design plugin**
(visual proposal → user approval). Tasks 1–2 jsou scaffolding.
Tasks 3–10 jsou diagram komponenty (nezávislé — dají se
paralelizovat, ale `DiagramFrame` z Task 2 je dependency).
Tasks 11–16 vkládají diagramy do stránek. Task 17 je validace.

### Task 0: GATE — visuální návrh přes `/design:new` (maude design)

> Review feedback: "halfway review po Task 12 je pozdě, scope bude
> už zacementovaný." Dogfooding maude design pluginu na vlastním
> docs situ — jediný správný start.

- **Do**: Před jakýmkoli scaffoldingem (Task 1+) vytvořit canvas
  návrh všech osmi diagramů v maude design pluginu:

  ```sh
  /design:new docs-infographics
  ```

  Canvas obsahuje **8 artboardů** (jeden per diagram component):
  `ArchitectureMap`, `CommandFlow`, `LoopDiagram`, `CommandTree`,
  `FileTree`, `StatPanel`, `InspectorDiagram`, `DevServerSchema`.
  Každý artboard ukáže jak komponenta bude vypadat ve final
  podobě — s realistickými daty (ne lorem), SKU stampy, hairline
  borders, token colors z `mdcc-tokens.css`.

- **Iterace**: Použít `/design:edit` na feedback rounds dokud
  layouty nesedí. Spustit `/design:critic` (panel) pro validaci
  proti DS hard-stops (no gradients, no blur, hairline rule).
  Cílit `signature-moment-critic` ≥ 4 / 5 (catalog aesthetic
  doopravdy zní).

- **Output**: `<designRoot>/ui/docs-infographics.tsx` (canvas
  soubor) + screenshoty per artboard přes `/design:screenshot
  --all-screens`. Screenshoty se použijí jako **visual spec**
  pro Tasks 3–10 — implementace musí matchovat finální canvas
  pixel-by-pixel-ish (token-level, ne pixel-level).

- **Validate**:
  - User signoff na canvas před Task 1. Bez signoff → STOP.
  - `/design:critic` panel: 0 blockerů, signature-moment ≥ 4/5.
  - Všech 8 artboardů má SKU stamp a realistic placeholder data
    (no Lorem, no `TODO`).
  - Screenshoty exportované do `<designRoot>/_history/docs-infographics/`.

- **Gotcha**:
  - Canvas používá `@maude/canvas-lib` (virtual specifier);
    dev-server resolvuje na `plugins/design/dev-server/canvas-lib.tsx`.
    NE-importovat z `_lib/`.
  - Design plugin pracuje s `.design/` rootem v repo. Pokud
    v repo `.design/` chybí, nejdřív `/design:init`.
  - Catalog aesthetic z landing page (`site/app/(home)/page.tsx`)
    je referenční. Canvas má rhymovat, ne tvořit nový jazyk.

- **Proč přes maude design, ne ASCII paper sketches**:
  Dogfooding. Plán předělává docs site, kterému chybí visual
  layer — ten samý problem maude design plugin řeší. Pokud
  design plugin nezvládne nadesignovat docs infografiku
  v reasonable scope, to je samo o sobě discovery (a DDR).

### Task 1: ADD `_diagrams.css` token-scoped stylesheet

- **Do**: Create `site/components/mdcc/diagrams/_diagrams.css`
  with `.mdcc-diagram` chrome rules (border, padding, font), grid
  templates for the multi-cell diagrams (`.mdcc-diagram-grid-2`,
  `…-grid-3`, `…-grid-loop`), and mobile reflow (`< 640 px`
  stacks vertically, except `CommandFlow` which scrolls
  horizontally with `overflow-x: auto` and a visible hint
  shadow). Import once from `site/components/mdx.tsx`.
- **Pattern**: Mirror token usage from `mdcc-tokens.css` "Hard
  NOs" section. Only `var(--…)` references, no hex.
- **Gotcha**: fumadocs scopes some default styles inside its
  prose container. Diagrams need to escape `prose-*` paragraph
  margins — use `:not(.prose *)` or a `.mdcc-diagram :where(…)`
  reset block.
- **Validate**: `pnpm --filter @maude/site lint:css` (if exists)
  or visual inspection in dev.

### Task 2: ADD `DiagramFrame` shared wrapper

- **Do**: Create `site/components/mdcc/diagrams/_frame.tsx`. Props:
  `{ sku: string, caption: string, ariaLabel?: string, children:
  ReactNode, dense?: boolean }`. Renders a `<figure>` with SKU
  stamp top-left, optional dense mode (smaller padding), caption
  row at bottom in `--fg-1`, and the `role="group"` + accessible
  name from caption.
- **Pattern**: `roadmap-timeline.tsx` SKU usage; `mdcc-hero-sku`
  pattern from `(home)/page.tsx`.
- **Validate**: Render in isolation by adding a smoke `.mdx` page
  at `site/content/docs/_smoke-diagrams.mdx` (delete in Task 17)
  with one `<DiagramFrame sku="MDCC-DGM/TEST" caption="smoke">…
  </DiagramFrame>`. Verify SKU + caption render.

### Task 3: CREATE `ArchitectureMap`

- **Do**: SVG component, `viewBox="0 0 800 360"`. Layout:
  - Top band: a "Claude Code" pill (rounded rect 4 px) spanning
    full width, hairline border, mono label.
  - Below Claude Code, two plugin tiles side by side
    (`/plugin design`, `/plugin flow`), hairline outline, SKU
    sub-label inside each.
  - To the right of the plugins: `maude` CLI badge — narrow
    vertical pill, mono label, dotted line connecting it to
    each plugin.
  - Below: two folder cards — `.ai/` (left, owned by flow) and
    `.design/` (right, owned by design). Each card lists ~4 key
    files using ASCII tree glyphs in mono.
  - Annotations: a curved arrow from `design` plugin → `.design/`,
    from `flow` plugin → `.ai/`, both in accent color.
- **Pattern**: Berkeley Mono inside `<text>` elements with
  `font-family: inherit` and `font-size: 12 / 14 / 16` for the
  three text scales. `stroke-width: 1` for all hairlines.
- **Gotcha**: Don't try to draw curves with `<path d="…">` from
  scratch — author them in a vector tool or use clean
  `M…Q…` two-point quadratics with control points on the grid.
- **Validate**: Diagram renders at 1280 / 768 / 375 px viewports.
  At 375 px the diagram switches to a stacked vertical layout
  (CSS `aspect-ratio` + container query).

### Task 4: CREATE `CommandFlow`

- **Do**: Props: `{ steps: Array<{ number: string, command: string,
  caption: string }>, sku?: string, caption: string }`. Horizontal
  strip of bordered cells with `→` glyph between. Each cell:
  step number top-left in `--fg-2`, mono `command` middle in
  `--fg-0`, `caption` bottom in `--fg-1`. Min cell width 180 px;
  4 cells on desktop, scroll on mobile.
- **Pattern**: Catalog-card-style cell using `--bg-1` +
  `--border-default`.
- **Validate**: Renders with 4 install steps from getting-started.

### Task 5: CREATE `LoopDiagram`

- **Do**: Props: `{ nodes: Array<{ command: string, caption: string,
  active?: boolean }>, sku?: string, caption: string, layout?:
  'circle' | 'horizontal' }`. Default `circle` for ≤ 6 nodes,
  `horizontal` (a wrap-around horizontal strip with a return arrow
  from last back to first) for > 6.
  - Circle mode: SVG, nodes positioned on a unit circle via
    `Math.cos(θ) * r`. Connecting arcs between adjacent nodes.
    Hairline strokes. Active node gets `--border-strong` outline.
  - Horizontal mode: row of bordered cells + a long return arrow
    bending under the row from rightmost to leftmost.
- **Pattern**: Compute `θ = (2π / n) * i - π/2` per node so the
  first node sits at the top.
- **Gotcha**: With < 3 nodes the circle layout looks silly. Fall
  back to horizontal if `nodes.length < 3`.
- **Validate**: Renders the design canvas loop (7 nodes) and the
  flow lifecycle (5 nodes) without overlap. SVG `viewBox` scales
  cleanly down to 375 px.

### Task 6: CREATE `CommandTree`

- **Do**: Props: `{ plugin: 'design' | 'flow', sku?: string,
  caption: string }`. Reads the catalog from `site/lib/diagram-data.ts`
  (the konsolidovaný data soubor — viz Files to Create). **Source-of-truth
  wiring je mandatory** (review feedback Risk #1): jako součást tohoto
  tasku PŘEPSAT `site/scripts/build-command-reference.mjs` aby
  importoval z `diagram-data.ts` místo re-parsování `name:`/`category:`
  frontmatter z `plugins/{flow,design}/commands/*.md`. Bez tohoto
  wiringu = guaranteed drift. **Žádný `// TODO: wire to
  build-command-reference` escape hatch** — review feedback explicitně
  zamítá snapshot variantu.

  Renders a stylized ASCII-tree-style list:

  ```
  /design:
  ├─ setup. (run once)
  │  ├─ init
  │  ├─ setup-ds
  │  └─ setup-docs
  ├─ daily. (canvas loop)
  │  ├─ new
  │  ├─ edit
  │  ├─ critic
  │  └─ … 5 more
  └─ validate. (regression)
     └─ smoke
  ```

  Each leaf is a link to the matching `commands-{plugin}/{name}`
  page. Hairline guide rules from group headers.
- **Pattern**: Pure Berkeley Mono + `<a>` per leaf. No collapsible
  state — docs context, all-visible is fine.
- **Gotcha**: `build-command-reference.mjs` rewrite je součást tohoto
  tasku (viz **Do** výše). Nepřeskakovat.
- **Validate**: Tree renders both plugins. Links navigate to the
  correct command pages. `node site/scripts/build-command-reference.mjs`
  generuje identický (nebo lepší) výstup z nového data zdroje.

### Task 7: CREATE `FileTree`

- **Do**: Props: `{ variant: '.ai/' | '.design/' | 'cli-subcommands'
  | { rows: Array<{ depth: number, label: string, hint?: string,
  highlight?: 'add' | 'change' }> }, sku?: string, caption: string }`.
  Pre-formatted ASCII-tree in Berkeley Mono inside a hairline
  frame. Per-row `highlight` paints the row background in a
  faint accent tint. Hints render right-aligned in `--fg-2`.
- **Pattern**: Use `<pre>` semantics; each row a `<div>` for
  highlight backgrounds. No paragraph margins.
- **Validate**: Renders the `.ai/` skeleton with
  `workflows.config.json` row highlighted (matches the prose's
  "the only file you usually edit" hint).

### Task 8: CREATE `StatPanel`

- **Do**: Props: `{ cells: Array<{ value: string | number,
  label: string, hint?: string }>, sku?: string, caption: string }`.
  Horizontal strip of `n` cells separated by hairline dividers.
  Cell: 32 / 36 px value (mono), 12 px label, 10 px optional hint.
  At `< 640 px`, wraps to 2 cells per row.
- **Pattern**: Numbers driven by `site/lib/stats.json` for the
  default landing usage. Component itself is data-agnostic.
- **Validate**: Renders the canonical 5 cells: commands · critics ·
  plugins · CLI · telemetry.

### Task 9: CREATE `InspectorDiagram`

- **Do**: SVG composition (`viewBox="0 0 720 420"`). Represents a
  stylized canvas iframe: outer frame = browser chrome (URL bar
  drawn as a flat rect with mono `localhost:4321` text), inner
  area shows three mock "artboard" rectangles with placeholder
  content (three labeled rects). One artboard's child element
  carries an accent halo (1 px accent stroke + offset shadow
  drawn as a second stroke ring). Annotation labels with thin
  leader lines: "Cmd+Click", "selection persists to
  `_active.json`", "`/design:edit` reads from here".
- **Pattern**: Three-tier nesting (chrome → canvas → element) all
  in hairline + mono. Leader lines: 1 px line + 6 px serif tick
  endpoint.
- **Gotcha**: Halo must read at zoom. Use two concentric strokes
  (inner = `--accent`, outer = transparent ring) instead of a
  CSS `box-shadow` (forbidden by token rules).
- **Validate**: Renders cleanly at 320 / 720 / 1080 px containers.

### Task 10: CREATE `DevServerSchema`

- **Do**: Three side-by-side panels, each labeled at top
  (`_server.json`, `_active.json`, `_history/<slug>/`). Each
  panel lists the keys in mono with hairline rows between.
  Below the row of panels, three thin arrows show flow direction
  with a caption between them: server-pid bootstrap → inspector
  push → snapshot stack. Replaces the existing markdown table on
  `design/index.mdx`.

  **A11y mandatory** (review feedback): protože Task 14 maže
  markdown tabulku, screen reader by jinak ztratil klíče. Komponenta
  MUSÍ obsahovat buď:
  - SVG `<desc>` element s plným textem všech klíčů a jejich rolí
    (producer/consumer), nebo
  - visually-hidden `<table>` (Tailwind `sr-only`) s identickou
    strukturou jako původní markdown tabulka.

  Doporučení: `sr-only` tabulka — pure HTML semantics, žádné
  custom ARIA, screen reader announces table navigation natively.

- **Pattern**: CSS Grid `grid-template-columns: 1fr 1fr 1fr` with
  hairline cell borders. Each cell `<details>`-collapsible on
  mobile (`< 640 px`) to save vertical space.
- **Validate**: Each pane lists the documented keys verbatim from
  CLAUDE.md "Dev server runtime contract" table. VoiceOver / NVDA
  pass over the diagram čte všechny klíče (test přes
  `a11y-auditor` subagent).

### Task 11: UPDATE `site/components/mdx.tsx` registry

- **Do**: Import all eight components from
  `mdcc/diagrams/index.ts`. Add to the object returned by
  `getMDXComponents`. Also import `_diagrams.css` once at the
  top.
- **Validate**: `pnpm --filter @maude/site dev` boots, every
  `.mdx` page renders without "component is not defined"
  errors.

### Task 12: INSERT diagrams into `docs/index.mdx`

- **Do**: Add `<ArchitectureMap caption="maude at a glance" />`
  between the lead paragraph (line 6) and "## Pick a direction".
  Add `<StatPanel caption="The catalog at a glance" />` just
  above the "## License and source" header.
- **Validate**: Both diagrams visible at desktop + mobile. SKU
  stamps land in top-left.

### Task 13: INSERT diagrams into `docs/getting-started.mdx`

- **Do**:
  - After the `## Init the workspace` `.ai/` tree fence (line 55),
    add `<FileTree variant=".ai/" highlight={['workflows.config.json']} caption="The .ai/ skeleton" />` — REPLACES the existing ASCII fence (drop the fence, the diagram supersedes).
  - Above `## Open the design browser`, add `<CommandFlow steps={INSTALL_STEPS} caption="Four steps and you're in" />`. Definuj `INSTALL_STEPS` v `site/lib/diagram-data.ts` (konsolidovaný data soubor, viz Files to Create).
- **Validate**: Replaced fence renders identically (no info lost)
  + the CommandFlow renders cleanly.

### Task 14: INSERT diagrams into `docs/design/index.mdx`

- **Do**:
  - After the inspector-overlay paragraph (line 8), add
    `<InspectorDiagram caption="Cmd+Click scopes the next /design:edit" />`.
  - After the "Setup" table and before the "Daily" table inside
    `## Twelve commands`, add `<LoopDiagram nodes={DESIGN_LOOP} caption="The canvas loop" />`. Definuj `DESIGN_LOOP` v `site/lib/diagram-data.ts`: `init → setup-ds → new → edit → critic → handoff → repeat`.
  - REPLACE the markdown table inside `## Dev server runtime
    files` (lines 41–52 of current file) with `<DevServerSchema caption="Three files. One contract." />`.
  - At end of page (after `## Configure`), add `<CommandTree plugin="design" caption="All twelve commands by group" />`.
- **Validate**: All four diagrams render; the replaced table's
  info now lives in the schema component.

### Task 15: INSERT diagrams into `docs/flow.mdx`

- **Do**:
  - After the intro paragraph (line 8), add `<LoopDiagram nodes={FLOW_LOOP} caption="The lifecycle" />`. Definuj `FLOW_LOOP` v `site/lib/diagram-data.ts`: `init → setup-prd → plan → execute → done → repeat`.
  - At end of page (after "## Naming history"), add `<CommandTree plugin="flow" caption="Thirty commands by group" />`.
- **Validate**: Both diagrams render; tree links resolve to
  `commands-flow/<name>` pages.

### Task 16: INSERT diagrams into `docs/cli.mdx`

- **Do**:
  - After the install snippet (line 11), add `<FileTree variant="cli-subcommands" caption="The five subcommands" />`. FileTree shows: `maude/ → init / config / design / version / help`.
  - Inside `## maude init` after the bullet list (line 33), add
    `<CommandFlow steps={INIT_FLOW} caption="From install to ready" />`. Definuj `INIT_FLOW` v `site/lib/diagram-data.ts`: `install · maude init · /flow:init · ready`.
- **Validate**: Both render cleanly inline.

### Task 17: VALIDATION + smoke cleanup

- **Do**:
  - Delete `site/content/docs/_smoke-diagrams.mdx` from Task 2.
  - **NEMAZAT** `<designRoot>/ui/docs-infographics.tsx` z Task 0
    — zůstává jako living design reference (viz Files to Create).
  - Run all validation commands below.
  - Visually walk every updated page at 1280 / 768 / 375 px.
  - Check `pnpm --filter @maude/site build` succeeds.
  - Open the built site, click through every internal link in
    `CommandTree` for both plugins — confirm 100 % land on a
    real page (no 404s).
  - Run an axe-core pass (via agent-browser) on the updated
    pages — expect SVGs with `role="img"` + `aria-label` to
    pass; expect no contrast regressions.

---

## Validation

1. **Lint**: `pnpm --filter @maude/site lint`
2. **Types**: `pnpm --filter @maude/site typecheck`
3. **Build**: `pnpm --filter @maude/site build`
4. **MDX compile**: included in build — verify no
   "component-not-defined" errors.
5. **Manual visual walk**: every diagram on every updated page,
   at desktop / tablet / mobile widths.
6. **A11y**: spawn the `a11y-auditor` subagent — live axe-core
   run over `/docs/`, `/docs/getting-started`, `/docs/design`,
   `/docs/flow`, `/docs/cli`. Expect 0 blockers. SVGs must have
   `role="img"` + `aria-label` matching `caption`.
7. **Design System Guard**: spawn the `design-system-guard`
   subagent — verify the diagrams respect token usage (no
   hardcoded colors, no shadows, no gradients, no rounded radii
   above 4 px).
8. **Link rot**: confirm every `CommandTree` leaf link resolves
   (no 404s).

---

## Scenario Coverage

A `flow:scenario` run over `docs-tour` exercises the new
diagrams as part of an end-to-end docs walk. **New scenario to
create**:

- `docs-diagrams` — flow: visit `/docs/`, `/docs/getting-started`,
  `/docs/design`, `/docs/flow`, `/docs/cli`. Per-step screenshot.
  Visual sanity: every page has at least one diagram visible
  above the fold. Persona: first-time visitor on web-desktop +
  web-mobile.

---

## Acceptance Criteria

- [x] All 17 tasks completed (Task 0 canvas + Tasks 1–17 site)
- [x] Static gates pass after the build batch (`types:check` clean,
      `biome check` clean — equivalent of `/flow:utils-verify`)
- [ ] `/validate` passes overall (deferred to `/done`):
  - [x] Static (types, lint)
  - [x] Build succeeds with all 8 components registered (`pnpm build`
        → 204 pages; every diagram statically rendered)
  - [ ] `scenario-runner` for `docs-diagrams`: 0 blockers,
        parity OK across web-desktop + web-mobile (scenario not yet
        authored — deferred to `/done`)
  - [ ] `design-system-guard`: 0 blockers (token compliance) —
        self-audited (0 hardcoded colors, all `var(--*)`); subagent
        pass deferred to `/done`
  - [x] `a11y-auditor` equivalents: decorative SVGs `aria-hidden`,
        figures labelled by `<figcaption>`, DevServerSchema carries
        an sr-only `<table>`, WCAG AA contrast verified by computation
- [x] All `CommandTree` leaf links resolve (catalog↔.md parity asserted
      in `build-command-reference.mjs` — drift fails the build)
- [x] No token-set extension needed (every value an existing `var(--*)`)
- [ ] Retro: "still a markdown dump?" — no; index/getting-started/
      design/flow/cli all carry diagrams now (capture in `/done` retro)

---

## Risks

1. **`CommandTree` source-of-truth drift.** The tree needs the
   same data the `build-command-reference.mjs` script reads.
   Mitigation: author `site/lib/commands.ts` as the shared
   source; update the build script to import from it instead of
   re-parsing frontmatter. If that refactor is too large for
   this phase, hand-author `commands.ts` as a snapshot and add
   a `// TODO: wire to build-command-reference` comment.
2. **Mobile reflow of SVG diagrams.** ArchitectureMap and
   DevServerSchema are layout-heavy. At 375 px they will need
   either container queries or a media-query stack fallback.
   Mitigation: build the mobile variant alongside the desktop
   variant for each layout-heavy diagram, not as an
   afterthought.
3. **Adding eight components inflates the MDX bundle.** All
   diagrams are tree-shakable React + SVG, no runtime libs, so
   the cost is small (≈ 20 kB minified estimate). Mitigation:
   verify after Task 11 that the docs route's JS bundle
   doesn't grow by more than ~30 kB.
4. **Token surface might need extension.** If a diagram needs a
   semantic that doesn't exist (e.g. "diagram-cell-bg"
   distinct from `--bg-1`), record it as a DDR + add the token
   to `mdcc-tokens.css`. Default assumption: existing tokens
   cover everything.
5. **SVG `<text>` font-loading FOUT.** Berkeley Mono is loaded
   via the site's font setup; SVG text inherits it via
   `font-family: inherit`. If FOUT shows up before font load,
   pre-render with a `font-display: block` setting only for
   the diagram pages. Likely already configured globally —
   verify in `site/app/layout.tsx`.
6. **Catalog vibe overdrive.** Eight diagram types across five
   pages could feel busy. Mitigation: page-level moderation —
   don't put more than two diagrams above the fold on any one
   page; benefit cards are not diagrams and don't count.

---

## Confidence

**8 / 10** for one-pass success.

- Token set is mature, SVG + React is well-trodden ground, no
  new libs needed, fumadocs MDX registration is one file.
- The eight components are concrete and bounded — each is < 200
  LoC of straightforward SVG + props.
- Main risk is the source-of-truth wiring for `CommandTree` and
  mobile reflow polish — both have explicit fallbacks listed.
- The "is this still a markdown dump" judgement is subjective;
  bake in a halfway review after Task 12 (ArchitectureMap +
  StatPanel land on the docs index) before authoring the
  remaining six pages of inserts.

---

## Review feedback (2026-05-25)

Review proběhl před schválením plánu. Shrnutí změn vlastněných
tímto plánem:

1. **Task 0** (NEW) — gate s **visuálním návrhem přes
   `/design:new`** (maude design plugin). Canvas se všemi 8
   artboardy v `<designRoot>/ui/docs-infographics.tsx`, validace
   přes `/design:critic` panel. Dogfooding maude na vlastním docs
   situ. Halfway review po Task 12 byl pozdě, paper sketches byly
   slabší signál než reálný canvas.
2. **Task 6** — `build-command-reference.mjs` rewrite je
   **mandatory součást** tasku, ne TODO. Snapshot variantu plán
   explicitně zamítá.
3. **Task 10** — `DevServerSchema` MUSÍ obsahovat `sr-only`
   tabulku (nebo SVG `<desc>`), protože Task 14 maže původní
   markdown tabulku a screen reader by jinak ztratil klíče.
4. **Konsolidace data files** — jeden `site/lib/diagram-data.ts`
   místo původně plánovaných `commands.ts` + `loops.ts` +
   `install-steps.ts`. Méně driftových míst.

Co bylo zváženo a zamítnuto:

- **9. komponenta `CommandEffects`** (matrix "co kterýkoli command
  zapisuje/mění") — odloženo. Subtree research z review fáze
  zachycen v Appendixu níže pro pozdější iteraci.

---

## Appendix A — Flow commands dependency subtree

Reference material zachycený během review. **Není scope tohoto
phase-17 planu** (review fáze, ne implementace). Slouží jako:

1. Validační podklad pro `CommandTree` (Task 6) — strom by měl
   strukturálně odpovídat skutečným command-to-command voláním.
2. Seed pro potenciální budoucí `CommandEffects` komponentu, pokud
   se rozhodneme přidat side-effects matrix do docs.

### Subtree

```
USER
├─ /flow:init                          [leaf] → Skill(flow:skill-loader)
├─ /flow:setup-prd                     spawns scenario-runner|a11y|ds-guard (spec)
│                                      WRITES .ai/prd.md, .ai/plans/*, STATE.md (seed)
├─ /flow:setup-context                 [leaf, read-only]
├─ /flow:setup-codebase-map            [leaf] → .ai/context/codebase-map.md
├─ /flow:status                        [leaf, read-only]
├─ /flow:plan                          Skill(skill-loader)
│                                      WRITES .ai/plans/<feature>.md, STATE.md
├─ /flow:execute                       ★ inner loop hub
│   ├─ /flow:utils-verify  ←──── max 3× retry (Edit-Verify Loop)
│   │   ├─ spawn: agent-browser | agent-device
│   │   └─ spawn: a11y-auditor, design-system-guard (volitelně)
│   ├─ /design:smoke                   (phase-end, DDR-021 trigger)
│   ├─ spawn: code-simplifier
│   └─ WRITES STATE.md (status, checkpoints)
├─ /flow:quick                         → /flow:release-changelog (post-merge)
├─ /flow:done                          ★★ fan-out hub
│   ├─ /flow:validate
│   │   ├─ /flow:validate-security
│   │   │   └─ spawn: security-auditor + ethical-hacker (parallel)
│   │   ├─ spawn: scenario-runner (5 platforms)
│   │   ├─ spawn: a11y-auditor
│   │   ├─ spawn: design-system-guard
│   │   └─ WRITES .ai/logs/security-reviews/<branch>-<ts>.md
│   ├─ /flow:review-code
│   │   ├─ spawn: security-auditor + ethical-hacker (cache reuse)
│   │   └─ spawn: code-simplifier
│   ├─ /flow:record-ddr (per unrecorded decision)
│   │   ├─ Skill(claude-md-keeper)
│   │   └─ WRITES .ai/archive/decisions/DDR-NNN-*.md + README.md index
│   ├─ /flow:release-changelog        → .changeset/*
│   ├─ /flow:record-retro             → Skill(claude-md-keeper)
│   ├─ Skill(ddr-keeper)
│   └─ WRITES STATE.md (phase=done, history)
│       archives .ai/plans/<x>.md → archive/
│       refreshes coverage-baseline.json
├─ /flow:pause                         WRITES HANDOFF.md, STATE.md (paused)
├─ /flow:resume                        reads HANDOFF.md; WRITES STATE.md (in-progress)
├─ /flow:validate-a11y                 [leaf] spawn: a11y-auditor
├─ /flow:validate-visual               [leaf] screenshot regression
├─ /flow:bug-rca                       [leaf] → logs/rca/issue-<id>.md
├─ /flow:bug-fix                       reads RCA; updates tracker MCP
├─ /flow:scenario                      [leaf] Skill(scenario) + agent-browser/device
├─ /flow:release                       [leaf] walks .ai/release-guide.md
├─ /flow:record-execution              [leaf] implementation report
├─ /flow:video-new-scene               [leaf] Remotion scaffold
├─ /flow:maintain-ai-health            [leaf, audit only]
├─ /flow:maintain-clean                [leaf]
├─ /flow:maintain-discover             [leaf]
├─ /flow:maintain-docs                 [leaf] Skill(skill-loader)
└─ /flow:help                          [leaf] parses name: frontmatter
```

### Load-bearing state writes

| Soubor | Producenti | Konzumenti |
|--------|------------|------------|
| `.ai/state/STATE.md` | `setup-prd` (seed), `execute` (in-progress + checkpoints), `done` (done + history), `pause` (paused), `resume` (in-progress) | `status`, `plan`, `done`, `pause`, `resume`, `maintain-ai-health` |
| `.ai/state/HANDOFF.md` | jen `/flow:pause` | jen `/flow:resume` (single P/C) |
| `.ai/plans/archive/` | jen `/flow:done` | + CLAUDE.md vyžaduje `pnpm gen:roadmap` po move |
| `.ai/archive/decisions/` | `/flow:record-ddr` | `/flow:done` (sweep), `/flow:validate` (drift) |
| `.ai/logs/security-reviews/` | `validate`, `validate-security`, `review-code` | mtime = cache klíč pro reuse window |
| `coverage-baseline.json` | `/flow:done` (jen na baselineBranch) | `/flow:validate` |

### Klíčové vlastnosti

- `/flow:done` je **fan-out hub** — 4 sub-commandy + 2 skills +
  tracker + archive + STATE transition.
- `/flow:validate` je **agent fan-out** — 5 subagentů, jediný
  sub-command `validate-security`.
- `/flow:execute ↔ /flow:utils-verify` je **inner loop** (3× retry).
- `STATE.md` má **5 producentů** — schema parity je load-bearing;
  změna v jednom musí ladit s ostatními čtyřmi.
- Leaf commands bez explicitních spawnů: `validate-a11y`,
  `validate-visual`, `maintain-clean`, `status`.


---

## Retro (2026-06-11)

- **The Task-0 canvas was the implementation.** Because the docs site's `mdcc-tokens.css`
  is generated from `system/maude`, the 8 site components were near-1:1 ports of the
  approved canvas (same token names, same `.di-*`→`.mdcc-dgm-*` structure). Dogfounding
  the design plugin on our own docs paid off concretely — the visual spec wasn't a
  reference, it was the source.
- **Task 6 (Risk #1) was the real complexity, and the constraint was non-obvious.** The
  prebuild runs `node` with no TS loader, so the single-source catalog *can't* live in
  `diagram-data.ts`. Resolved by splitting it into `command-catalog.mjs` (DDR-101) with a
  **build-time parity assertion** — drift now fails the build loud (positive-tested). This
  is stronger than the plan's "one consolidated file" because it's enforced, not hoped-for.
- **The plan's insertion points were stale** (line numbers + page content written before the
  2026-06-08 maude-DS migration). Adapting to the *actual* current pages mattered:
  `flow.mdx` already shipped `<FlowLoop/>`, so the planned redundant `LoopDiagram` was
  dropped (Risk #6 — catalog-vibe overdrive avoided). Lesson for `/plan`: a plan that names
  line numbers / specific prose is a snapshot; the executor must re-read current state, and
  a plan authored for one DS must not be run verbatim after a DS migration.
- **MDX stayed import-free via `variant` props** (`<CommandFlow variant="install"/>` instead
  of `steps={INSTALL_STEPS}`) — sidestepped fragile `@/lib` imports inside `.mdx`.
- **Mobile reflow (Risk #2) needed playwright, not agent-browser.** agent-browser's
  `--viewport` still doesn't resize (the 2026-06-08 limitation persists — byte-identical
  screenshots gave it away). Playwright with an explicit `viewport` is the working fallback
  for true-mobile renders; worth wiring into the smoke/scenario path.
- **"Still a markdown dump?" — no.** index / getting-started / design / flow / cli now each
  carry ≥1 diagram in the maude instrument-panel language. The docs read as a designed
  surface, not a table dump.
