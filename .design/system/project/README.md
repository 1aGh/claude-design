# md-claude design system · MDCC-DSN/01

> **One-line:** a developer-friendly, lightly-retro design system shaped like a precision-instrument catalog — built to clothe both the `md-claude` plugin marketplace AND the `mdcc design` dev-server canvas browser in the same monospace voice.

The system you're looking at is not aiming to be neutral. Vercel's Geist is neutral. shadcn is neutral. They're excellent — go use them if neutral is what your project needs. **md-claude is the opposite move.** Plugins are framed as catalog products with part-numbers (`MDCC-DSN/01`, `MDCC-FLW/02`); type is mono everywhere; chrome is 1px hairlines and not a drop-shadow in sight; and the copy carries an `htmx.org`-flavoured dry-grin sitting on top of an `usgraphics.com`-grade typographic spine. That tension — serious type, irreverent copy — IS the brand.

If the canvas you're building isn't comfortable being called "a Berkeley Mono spec sheet that knows it's funny", you're probably on the wrong DS.

---

## What this DS is for

Two surfaces, one voice:

1. **Marketplace landing / READMEs** — long-form prose about plugins. Reading mode, paper-light by default, 72ch measure, ASCII rules as section dividers. The plugin is the catalog product; the page is its spec sheet.
2. **`mdcc design` dev-server canvas browser** — the in-browser tool that renders `.design/system/<ds>/preview/*.html` mocks with file tree, tabbed iframe preview, and the element inspector overlay. Phosphor-dark by default, dense panels, the chrome doesn't compete with what's being displayed inside the iframe.

Both surfaces share tokens, type, and the part-number framing language. Switching themes flips the canvas; nothing about identity changes.

---

## Mood + anchors

| Cluster | Anchors | Why for us |
|---|---|---|
| **Industrial Catalogue** | [U.S. Graphics Company](https://usgraphics.com), [JSR](https://jsr.io), Berkeley Mono FX-102 / FX-202 spec sheets | A plugin marketplace IS a catalog. The catalog metaphor isn't decoration — it's the cleanest way to render "browse 12 installable units, each with a SKU, tagline, version, and provenance" without re-inventing card-grid SaaS layout. |
| **Retro Irreverent** | [htmx.org](https://htmx.org), [Robb Owen](https://robbowen.digital), [redbean.dev](https://redbean.dev) | The voice. We're a developer-tool; we shouldn't sound like a Series-A pitch deck. The fake-90s confidence + dry humor of htmx is the register. |
| **Monospace Manifesto** | [The Monospace Web](https://owickstrom.github.io/the-monospace-web), [16colo.rs ANSI archives](https://16colo.rs), [Teletext revival](https://wepresent.wetransfer.com/stories/teletext-creative-legacy) | The grid. Mono character-width is the responsive unit; box-drawing handles diagrams; ASCII rules separate sections. Not as the gimmick — as the layout primitive. |

The full reference payload (anchors, OKLCH options, voice samples) lives at `<designRoot>/_history/_system/project-df4b0d27-domain-research-discovery.json` — read it before iterating on anything color- or voice-adjacent.

---

## The signature treatment

`MDCC-DSN/01-CHROME` (see `preview/_layout.css`):

```
┌─────────────────────────────────────────────────────────────────┐
│ MDCC-DSN/01      design system · project / colors-accent        │
│                                                       [LIGHT|DARK]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Accent — paper-stamp red                                        │
│ One amber-rust hue. No second accent. The accent never carries   │
│ identity by itself; it joins typography and rules to do the     │
│ work.                                                           │
│                                                                 │
│ ── 01 · WHEN TO USE ───────────────────────── 6 swatches ──     │
│                                                                 │
│ [primary] [hover] [active] [tint] [fg] [focus]                  │
│                                                                 │
│ ── 02 · WHEN NOT TO USE ──────────────────────────────────      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Three things make it ours:

1. **Part-numbers (SKUs).** Every specimen, plugin, and major composition gets one. `MDCC-DSN/01` for this DS; `MDCC-FLW/02` for the flow plugin; `MDCC-DSN/01.colors-accent` for individual canvases. Set in monospace, ALL CAPS, `tracking-sku` (0.12em). They live in the `.specimen-hd` part-number row at the top of every page and in the catalog-row of `ui_kits-desktop-showcase.html`.
2. **1px hairline rules.** Sections separate with `<hr>` or `border-bottom: 1px solid var(--border-default)`. H2 sections numbered `01 · WHEN TO USE` get the rule beneath them carrying through to the next h2. NO drop-shadows; depth comes from rules + type weight + slight bg-shift.
3. **Catalog grid.** Tile grids use overlapping 1px borders (the `-1px 0 0 -1px` margin trick) so you get the engineering-drawing feel without doubled borders. See `.grid > *` in `_layout.css`.

---

## Tokens — pillar values

| Family | Light (paper) | Dark (phosphor) |
|---|---|---|
| Surface base (`--bg-0`) | `oklch(97.5% 0.008 78)` warm cream | `oklch(13% 0.012 60)` phosphor canvas |
| Ink (`--fg-0`) | `oklch(20% 0.020 50)` near-black warm | `oklch(94% 0.014 80)` cream-on-canvas |
| Accent (`--accent`) | `oklch(56% 0.170 50)` amber-rust | `oklch(72% 0.160 55)` brighter for dark |
| Border default | `oklch(74% 0.016 65)` ink-hairline | `oklch(40% 0.022 60)` |

The accent is the **only** chromatic identity. There is no `--accent2`. If you need a second hue (a plugin category color, a per-team accent), retint via `[data-accent="…"]` attribute selector on `.mdcc` — same family slot, different OKLCH values — never via a new variable.

Type is mono. All of it. `--font-display`, `--font-body`, `--font-mono` all resolve to `'Berkeley Mono', 'JetBrains Mono', ui-monospace, …`. There is no humanist sans escape hatch — if a section feels "too tight" in mono, the answer is line-height + letter-spacing, not a font swap.

Radii collapse to `0 / 2px / 4px`. No `--radius-lg/xl` beyond clamp values; no `--radius-pill`. Hard-edges family — sharp corners are the look.

Spacing scale lives at 4px base; balanced-docs density means chrome lands at `--space-3` / `--space-4` (8/12px) by default.

Shadows are absent. `--shadow-sm/md/lg` are all `none`. `--shadow-focus` is the focus ring (2px accent) — the only place blur appears in the system. Depth in this DS = typography + 1px rules + small bg-shifts between `--bg-1` and `--bg-2`.

---

## Token usage guide

The pillar table above lists what the tokens *are*. This table lists what they're *for* — the role each token plays in the composition. Read it before reaching for `--accent-active` to silence a contrast warning, or `--bg-3` to "make the panel pop". Sibling tokens carry role conventions, not just lightness deltas.

| Token | Use for | Don't use for |
|---|---|---|
| `--accent` (light: 56% L · dark: 72% L) | Brand stamps, decorative borders, large-text CTAs (≥ 18px or ≥ 14px bold), filled buttons, h2 numerals, syntax-highlight accents, callout-tip rules | Body-text links on paper (fails 4.5:1) |
| `--accent-hover` (50% / 78%) | Hover state for `--accent`-filled elements (button bg on hover, stamp on hover) | Static / non-interactive surfaces |
| `--accent-active` (44% / 84%) | Body-text links on paper, breadcrumb tail, ≤ 12px SKU labels, sidebar active-item text — anywhere brand-on-paper text needs ≥ 4.5:1 | Solid fills, decorative stamps, button backgrounds (loses brand recognition — reads as "different brand color than the DS") |
| `--accent-fg` (98% / 14%) | Paper-on-stamp text — text inside `--accent`-filled buttons / chips | Anywhere outside an accent-filled surface |
| `--accent-tint` (92% / 28%) | Faint cell wash for accent-tagged rows / callout strips | Active / focused states (too low-contrast) |
| `--fg-0` (20% / 94%) | Primary ink — body text on paper, headings | Borders (use `--border-strong` for structural rules) |
| `--fg-1` (38% / 78%) | Secondary text, footer meta, sub-headers | Body paragraphs (washes out long-form reading) |
| `--fg-2` (52% / 60%) | Tertiary text, captions, code comments, muted labels | Headings, primary content |
| `--fg-3` (68% / 44%) | `:disabled` state ONLY (placeholder, disabled labels) | Live text (fails 4.5:1) |
| `--bg-0` (97.5% / 13%) | Page background — the paper / phosphor canvas | Cards, panels (those want a tone shift) |
| `--bg-1` (95.5% / 17%) | Card / panel background — first elevation step | Page bg, deeply nested popovers |
| `--bg-2` (93% / 20%) | Nested panel / popover bg — second elevation step | Page bg, primary cards |
| `--bg-3` / `--bg-4` (89.5–85% / 24–28%) | Hover / pressed surface states; subtle row-hover; input bg when fields need to read as "wells" | Static panels (reads as a hover state stuck on) |
| `--border-subtle` (86% / 28%) | Faint group separators, low-emphasis dividers inside dense lists | Anywhere a rule should be visible (vanishes on `--bg-1`) |
| `--border-default` (74% / 40%) | Card borders, panel dividers, input edges, the catalog-grid 1px lattice | Signature h2 underlines, hero rules (use `--border-strong`) |
| `--border-strong` (48% / 58%) | Signature 1px structural rules — h2 underline, hero divider, top-nav border, SKU header rule | Subtle group dividers (overpowers the field) |

**Why this table exists.** Without a role map, a11y mass-migrations swap `--accent` → `--accent-active` to chase contrast across every site of use — including fills, where contrast was never the issue. The result reads as "DS drift" even though both ends of the swap are tokens. See the Docs Site retro at `.ai/logs/system-reviews/docs-site-design-generation-review.md` for the incident this table patches. The `design-system-keeper` agent reads this section as its audit source.

---

## Voice — the htmx-grain

The microcopy register is **Irreverent developer voice**. The visual layout is catalog-grade serious; the words sit on top of it like Justine Tunney annotating a U.S. Graphics catalog.

| Do | Don't |
|---|---|
| "Pick a plugin. `mdcc` installs it. That's it." | "Discover the perfect plugin for your next project." |
| "`mdcc design serve` boots a server. You can guess what `mdcc design --help` does." | "Effortlessly preview your designs with our intuitive development server." |
| "Specimens, not screenshots. Edit one, the rest follow." | "We let you reimagine your design workflow." |
| Direct fragments. ALL-CAPS for emphasis is fine. Asides in `(parens)` are fine. | "We", "our", "you can", and any aspirational verb (`reimagine`, `supercharge`, `unlock`, `effortless`). |
| Reference the tool by name: "`mdcc init`", "`/design:edit`". | Marketing pronouns: "let us help you", "we believe". |

Sample microcopy from the discovery payload (use as register reference when writing specimen copy):

```
MDCC-DSN/01 — design. Canvas-first iteration on HTML/JSX mocks.
Zero-dep Node dev-server. Cmd+Click element inspector. Snapshot
stack per canvas. Published: 2026-05.
```

When in doubt: write the docs version. Then delete every word the docs version doesn't need.

---

## Hard rules (NOs)

Encoded in this DS by the absence of corresponding tokens and reinforced by `/design:critic` panel agents:

1. **No frosted-glass / glassmorphism.** Plugin cards and chrome are flat, hairline-bordered, ink-on-paper or cream-on-phosphor. There is no `backdrop-filter` token. If you reach for `backdrop-filter: blur(…)` in any new specimen, that's a critic blocker.
2. **No `border-radius` > 4px.** Hard-edges family. Status pills are squared chips, not pills. Avatar shapes still allowed at `999px` if you really need a circle, but anything else rounded over 4px is a regression.
3. **No drop-shadows on chrome.** `--shadow-sm/md/lg` are deliberately `none`. The ONLY place blur appears is `--shadow-focus`.
4. **No stock photography.** Especially "laptop on a desk" hero shots. The dev-server canvas screenshot, the ASCII tree, the SKU label — these are the brand. We don't borrow other surfaces.
5. **No magic-verbs.** `reimagine`, `supercharge`, `unlock`, `effortless`, `magical` — these get rewritten. The replacement is usually the literal verb (`change`, `make faster`, `enable`, `easy`, `surprising`).
6. **No animations beyond hover + reduced-motion-respecting tooltip fades.** No scroll-jacking, no parallax, no ambient drift, no auto-play marquees. `--dur-route` is `1ms` — route changes are instant.
7. **No emoji in chrome.** UI labels use ASCII / Unicode-glyph icons (`▸ ▹ ● ○ ▲ · → ✓ ✗`) or stroked SVG glyphs from `assets/glyphs/`. Emoji are fine inside user-generated content (README markdown bodies) but not in DS chrome.
8. **No purple/blue AI-launch gradient.** Gradients are reserved for data visualization (heatmaps, intensity legends). Never for hero bgs, never for buttons, never for "page background atmosphere".

`/design:critic` will reject any canvas that violates 1, 3, 6, or 8 (hard blockers). Violations of 2, 5, 7 are warnings; violations of 4 are a copy-critic blocker.

---

## Brand assets

The DS ships with three classes of brand asset under `assets/`:

| Path | What it is |
|---|---|
| `assets/logos/wordmark.svg` | The `md-claude` wordmark — Berkeley-mono uppercase set with the accent dot. Use at the top of marketplace landing + dev-server header. |
| `assets/glyphs/<name>.svg` | Domain-noun glyph set (plugin, canvas, slash-command, file-tree). 16×16 grid, 1px stroke, designed to sit inline with mono text at `--type-base`. Drop more here when you scaffold new noun surfaces. |
| `preview/iconography.html` | The specimen that catalogs all glyphs side-by-side; new glyphs MUST land in this index. |

Wordmark and glyphs are deliberately minimal — they're the kind of mark a single developer would commit at 1am, not the output of a brand sprint. That's on-purpose. The catalog-page typography does the heavy lifting; the marks are signatures, not crests.

---

## Density + reading rhythm

**Balanced docs-page density** — chrome lives on `--space-3` / `--space-4` (8 / 12px), prose runs to `--layout-prose` (72ch), and the type ladder is mono-tuned with looser line-heights than a sans equivalent would use (mono needs the air).

Marketplace landing surfaces should breathe — paragraphs at 72ch, h2 sections separated by `--space-7` (32px) plus a 1px rule. Dev-server canvas surfaces tighten — `--space-3` / `--space-4` everywhere, tile rows snap to a 220px-min `repeat(auto-fill, minmax(220px, 1fr))` grid.

There's no roomy variant. The DS is built for developer-designer hybrids who read code at 13px Berkeley Mono and don't need consumer-app padding.

---

## How to use this DS

1. **Build a canvas:** `/design:new "<Name>" "<brief>"` — scaffolds an HTML file under `.design/ui/` using these tokens.
2. **Iterate:** `/design:edit "<feedback>"` — edits the active canvas in-place, then auto-runs the critic panel.
3. **Critic alone:** `/design:critic` — runs the panel on the active canvas without editing. Use `--system-only` to check the DS itself.
4. **Hand off:** `/design:handoff` — migrates the canvas to production code (currently nothing wired; configure in `.design/config.json`).

When writing specimen copy yourself (without an agent), use `voice_tone_options[1]` from the payload — the irreverent-developer-voice sample microcopy section — as the register reference. If you find yourself typing "let us", stop and rewrite.

---

## Provenance

- Bootstrapped: **2026-05-14** via `/design:setup-ds project "<brief>"` against `md-claude@0.12.0`
- Round 0 research: 11 WebSearch queries; payload at `_history/_system/project-df4b0d27-domain-research-discovery.json`
- Anchor pool: U.S. Graphics Company, JSR, Berkeley Mono spec sheets, htmx.org, redbean.dev, The Monospace Web, 16colo.rs, Teletext revival, Robb Owen, tldraw, Vercel Geist (calibration floor)
- Inspiration library: `plugins/design/templates/design-system-inspiration/` @ md-claude v0.12.0
- Discovery answers: see `_history/_system/project-000-scaffold-roster.yaml` `discovery:` block

Re-bootstrap with `/design:setup-ds project --force` if the domain has moved (anchors stale, new heritage references surfaced). The cached payload will be refreshed.
