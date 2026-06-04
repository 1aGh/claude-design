# maude — "Unified Pro Studio"

A from-scratch design language for Maude — the design-to-production-ready pipeline whose
heart is a FigJam-like infinite canvas you iterate on *with* an AI agent. This DS is the
chrome around that canvas: a deliberate, integrated instrument that frames the work
without ever competing with it.

> **Direction locked at the Stage-4 moodboard (variant B — "Zed × Webflow").** Built
> from scratch; nothing lifted from the sibling `project` DS. The visual contract lives in
> `_moodboard/maude-v2-variant-B.tsx` + its screenshot under `_history/_system/`.

## What this DS is for

The studio surface of a pro design tool: toolbars, layer trees, property inspectors,
command palettes, and the dotted canvas they frame. Audience: **profíci s citem pro
design** — people who live in the tool all day and feel chrome that gets in the way.

## The feeling

Take the GPU-sharp, dense, mono-tinged precision of a native code editor (Zed) and the
structured designer panels of a visual builder (Webflow) — then make it **more cohesive
than either**: one material, not an editor with panels bolted on. Confident, calm,
crafted. Řemeslnost · preciznost · klid · originalita.

## The three signature codes

1. **Material cohesion** — every chrome surface (panel · toolbar · inspector · layer tree)
   shares ONE material: the same 1px crisp hairlines (`--border-default`), the same radii
   (`--radius-sm/md`), the same elevation. Sameness *is* the signature.
2. **The dotted canvas** — a subtle radial dot-grid (`--canvas-dot` at `--canvas-grid`
   pitch) is the ambient backdrop everywhere and the full-strength surface in `.canvas`.
   The infinite-canvas tell, kept quiet so content leads.
3. **Mono as a first-class citizen** — `--font-mono` (JetBrains / Geist Mono) carries
   part-numbers, coordinate readouts, inspector fields and tabular numerics. The
   developer-tool DNA, not relegated to code blocks.

## Tokens

Authoritative: [`colors_and_type.css`](./colors_and_type.css). Dark is the default theme
(studio / canvas-browser); light is an equal-status secondary (reading / handoff).

- **Surfaces** — cool-neutral elevation ladder `--bg-0..4` (hue ~255), deepest is the canvas.
- **Accent** — a single confident indigo, `--accent` `oklch(0.60 0.19 268)` (dark) /
  `oklch(0.52 0.195 268)` (light). One accent, one job per surface.
- **Status** — success / warn / error / info. **Presence** — online / away / offline +
  `--presence-agent` (the AI agent's own cursor hue).
- **Type** — Inter (display + body) on a tight ~1.2 ladder, base 14 (dense); JetBrains
  Mono everywhere a number, coordinate or label wants tabular precision.
- **Motion** — crisp and snappy (`--dur-flip 140ms`, `--ease-out cubic-bezier(0.2,0,0,1)`);
  reduced-motion collapses every duration to 1ms.

## Hard rules (guardrails — sub-agents enforce these)

- **The accent has exactly one job per surface.** Primary action, current selection, or
  active tab — never a decorative fill. Accent-everywhere = nothing leads (see
  `colors-accent` good/wrong).
- **No decorative gradient backdrops.** The treatment is flat crisp panels + the dot-grid.
  No mesh / aurora / candy gradients competing with the canvas.
- **Chrome must not out-shout the canvas.** If a panel pulls the eye before the work does,
  it's wrong. Dense but calm; hairlines do the separating, not heavy fills or shadows.
- **No emoji in chrome.** Thin-stroke (1px) geometric SVG glyphs only — terminal/IDE heritage.
- **Tokens only.** No hardcoded hex / off-ladder type px in specimens. Layout dimensions
  (frame widths/heights) may be px; everything else is a `var(--*)`.

## Voice

A pro who knows what they're doing and doesn't show off. Terse, precise, quietly warm.
Real domain nouns — *canvas, artboard, frame, node, inspector, layers, mockup, iterate,
agent, hand off, properties* — never Lorem, never "Get Started", never "Acme".
