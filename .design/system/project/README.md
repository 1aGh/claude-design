# Maude design system · MDCC-DSN/01

> **One-line:** A small Claude Code marketplace, shaped like a precision-instrument catalog. Built to clothe both the plugin landing AND the `mdcc design` canvas browser in the same monospace voice. Two plugins, one CLI, some opinions about HTML mocks. I built it, mostly at night, because I kept needing it.

The system isn't aiming to be neutral. Vercel's Geist is neutral. shadcn is neutral. They're excellent. Go use them if neutral is what your project needs. **Maude is the opposite move.** Plugins are framed as catalog products with part-numbers (`MDCC-DSN/01`, `MDCC-FLW/02`); type is mono everywhere; chrome is 1px hairlines and not a drop-shadow in sight; and the copy carries a Bear-Blog-school dry-grin sitting on top of a U.S.-Graphics-grade typographic spine. That tension (serious type, person-voiced copy) IS the brand.

If the canvas you're building isn't comfortable being called "a Berkeley Mono spec sheet that knows it's funny", you're probably on the wrong DS.

---

## What this DS is for

Two surfaces, one voice:

1. **Marketplace landing / READMEs.** Long-form prose about plugins. Reading mode, paper-light by default, 72ch measure, ASCII rules as section dividers. The plugin is the catalog product; the page is its spec sheet.
2. **`mdcc design` dev-server canvas browser.** The in-browser tool that renders `.design/system/<ds>/preview/*.html` mocks with file tree, tabbed iframe preview, and the element inspector overlay. Phosphor-dark by default, dense panels, the chrome doesn't compete with what's being displayed inside the iframe.

Both surfaces share tokens, type, and the part-number framing language. Switching themes flips the canvas; nothing about identity changes.

---

## Mood + anchors

| Cluster | Anchors | Why for us |
|---|---|---|
| **Industrial Catalogue** | [U.S. Graphics Company](https://usgraphics.com), [JSR](https://jsr.io), Berkeley Mono FX-102 / FX-202 spec sheets | A plugin marketplace IS a catalog. The catalog metaphor isn't decoration. It's the cleanest way to render "browse 12 installable units, each with a SKU, tagline, version, and provenance" without re-inventing card-grid SaaS layout. |
| **Retro Irreverent** | [htmx.org](https://htmx.org), [Robb Owen](https://robbowen.digital), [redbean.dev](https://redbean.dev) | The voice. We're a developer-tool; we shouldn't sound like a Series-A pitch deck. The fake-90s confidence + dry humor of htmx is the register. |
| **Monospace Manifesto** | [The Monospace Web](https://owickstrom.github.io/the-monospace-web), [16colo.rs ANSI archives](https://16colo.rs), [Teletext revival](https://wepresent.wetransfer.com/stories/teletext-creative-legacy) | The grid. Mono character-width is the responsive unit; box-drawing handles diagrams; ASCII rules separate sections. Not as the gimmick, as the layout primitive. |

The full reference payload (anchors, OKLCH options, voice samples) lives at `<designRoot>/_history/_system/project-df4b0d27-domain-research-discovery.json`. Read it before iterating on anything color- or voice-adjacent.

---

## The signature treatment

`MDCC-DSN/01-CHROME` (see `preview/_layout.css`):

```
┌─────────────────────────────────────────────────────────────────┐
│ MDCC-DSN/01      design system · project / colors-accent        │
│                                                       [LIGHT|DARK]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Accent. Paper-stamp red                                         │
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

## Tokens. Pillar values

| Family | Light (paper) | Dark (phosphor) |
|---|---|---|
| Surface base (`--bg-0`) | `oklch(97.5% 0.008 78)` warm cream | `oklch(13% 0.012 60)` phosphor canvas |
| Ink (`--fg-0`) | `oklch(20% 0.020 50)` near-black warm | `oklch(94% 0.014 80)` cream-on-canvas |
| Accent (`--accent`) | `oklch(56% 0.170 50)` amber-rust | `oklch(72% 0.160 55)` brighter for dark |
| Border default | `oklch(74% 0.016 65)` ink-hairline | `oklch(40% 0.022 60)` |

The accent is the **only** chromatic identity. There is no `--accent2`. If you need a second hue (a plugin category color, a per-team accent), retint via `[data-accent="..."]` attribute selector on `.mdcc` (same family slot, different OKLCH values), never via a new variable.

Type is mono. All of it. `--font-display`, `--font-body`, `--font-mono` all resolve to `'Berkeley Mono', 'JetBrains Mono', ui-monospace, ...`. There is no humanist sans escape hatch. If a section feels "too tight" in mono, the answer is line-height + letter-spacing, not a font swap.

Radii collapse to `0 / 2px / 4px`. No `--radius-lg/xl` beyond clamp values; no `--radius-pill`. Hard-edges family. Sharp corners are the look.

Spacing scale lives at 4px base; balanced-docs density means chrome lands at `--space-3` / `--space-4` (8/12px) by default.

Shadows are absent. `--shadow-sm/md/lg` are all `none`. `--shadow-focus` is the focus ring (2px accent), the only place blur appears in the system. Depth in this DS = typography + 1px rules + small bg-shifts between `--bg-1` and `--bg-2`.

---

## Token usage guide

The pillar table above lists what the tokens *are*. This table lists what they're *for*. The role each token plays in the composition. Read it before reaching for `--accent-active` to silence a contrast warning, or `--bg-3` to "make the panel pop". Sibling tokens carry role conventions, not just lightness deltas.

| Token | Use for | Don't use for |
|---|---|---|
| `--accent` (light: 56% L · dark: 72% L) | Brand stamps, decorative borders, large-text CTAs (≥ 18px or ≥ 14px bold), filled buttons, h2 numerals, syntax-highlight accents, callout-tip rules | Body-text links on paper (fails 4.5:1) |
| `--accent-hover` (50% / 78%) | Hover state for `--accent`-filled elements (button bg on hover, stamp on hover) | Static / non-interactive surfaces |
| `--accent-active` (44% / 84%) | Body-text links on paper, breadcrumb tail, ≤ 12px SKU labels, sidebar active-item text. Anywhere brand-on-paper text needs ≥ 4.5:1 | Solid fills, decorative stamps, button backgrounds (loses brand recognition, reads as "different brand color than the DS") |
| `--accent-fg` (98% / 14%) | Paper-on-stamp text. Text inside `--accent`-filled buttons / chips | Anywhere outside an accent-filled surface |
| `--accent-tint` (92% / 28%) | Faint cell wash for accent-tagged rows / callout strips | Active / focused states (too low-contrast) |
| `--fg-0` (20% / 94%) | Primary ink. Body text on paper, headings | Borders (use `--border-strong` for structural rules) |
| `--fg-1` (38% / 78%) | Secondary text, footer meta, sub-headers | Body paragraphs (washes out long-form reading) |
| `--fg-2` (52% / 60%) | Tertiary text, captions, code comments, muted labels | Headings, primary content |
| `--fg-3` (68% / 44%) | `:disabled` state ONLY (placeholder, disabled labels) | Live text (fails 4.5:1) |
| `--bg-0` (97.5% / 13%) | Page background. The paper / phosphor canvas | Cards, panels (those want a tone shift) |
| `--bg-1` (95.5% / 17%) | Card / panel background. First elevation step | Page bg, deeply nested popovers |
| `--bg-2` (93% / 20%) | Nested panel / popover bg. Second elevation step | Page bg, primary cards |
| `--bg-3` / `--bg-4` (89.5-85% / 24-28%) | Hover / pressed surface states; subtle row-hover; input bg when fields need to read as "wells" | Static panels (reads as a hover state stuck on) |
| `--border-subtle` (86% / 28%) | Faint group separators, low-emphasis dividers inside dense lists | Anywhere a rule should be visible (vanishes on `--bg-1`) |
| `--border-default` (74% / 40%) | Card borders, panel dividers, input edges, the catalog-grid 1px lattice | Signature h2 underlines, hero rules (use `--border-strong`) |
| `--border-strong` (48% / 58%) | Signature 1px structural rules. H2 underline, hero divider, top-nav border, SKU header rule | Subtle group dividers (overpowers the field) |

**Why this table exists.** Without a role map, a11y mass-migrations swap `--accent` → `--accent-active` to chase contrast across every site of use, including fills, where contrast was never the issue. The result reads as "DS drift" even though both ends of the swap are tokens. See the Docs Site retro at `.ai/logs/system-reviews/docs-site-design-generation-review.md` for the incident this table patches. The `design-system-keeper` agent reads this section as its audit source.

---

## Voice

Catalog spine, person speaks. The microcopy register is Bear-Blog school dry-grin sitting on a U.S. Graphics catalog spine. Visual layout stays catalog-grade serious; the words stop impersonating the typography and start sounding like the person who made the catalog. Source register: Julia Evans's `jvns.ca` (delighted-first-person blogger), Maciej Cegłowski's Pinboard (dry European self-pisstake, "ex-painter and computer guy"), Bear Blog ("a privacy-first, no-nonsense, super-fast blogging platform"), Berkeley Mono spec sheets (catalog-noun precision), and `redbean.dev` (modest scope-naming). Historical root is the htmx commit-message register. That's where the bones come from. The active register is warmer.

Posture shift in one sentence: the catalog spine survives, the System voice doesn't. A person speaks. Once per page, sometimes twice. The rest of the chrome stays stamped, mono, hairline-bordered, but the prose is signed.

### English humour, specifically

The wit isn't deadpan-as-default. It's seven small disciplines, each rare per surface.

- **Load-bearing parenthetical.** The sentence carries the fact, the parens carry the warmth. `Three commands and you're in. (Maybe four. Depends on your shell.)`
- **Magic-admitted-as-magic.** Concede the part you don't fully understand, modestly, as a fact. `An agentic loop that ships things eventually.`
- **Generative stacking.** Frame the offer as "X & Y" not "X, not Y". `Plugins & Vibes.` not `Plugins, not vibes.`
- **Modest scope-naming.** The smallest possible frame. `A small Claude Code marketplace.` not `The complete plugin ecosystem for Claude Code.`
- **Anticipated-objection.** Write the reader's question into the copy, then answer it. `Nothing installed yet. Which is fine, you just got here.`
- **Anthropomorphize the product, not the user.** Human-ish predicates land on the tool. `mdcc. The plumbing the other two pretend not to need.`
- **Clean but a bit dirty.** No em dash. No en dash. No curly quotes. No ellipsis character. Comma splices and sentence fragments are fine. Imperfect punctuation is part of the register because a person typed it.

### The Michal layer

The system speaks; Michal signs. He appears in exactly two surfaces. Nowhere else. No first-person in tile bodies, error messages, empty states, tooltips, stamps, or button labels.

**Landing footer signature** (one line, sits above the colophon strip, prefixed by the catalog stamp `MDCC-MKR/01 · MICHAL`):

```
Hi I'm Michal, I made this. Open issues if it breaks.
```

**`/docs/about` page hero** (5 paragraphs, body-prose face, no decoration; metadata stamps `MDCC-MKR/01 · MICHAL · MAINTAINER SINCE 2025-12 · LOCATION PRAGUE · REACHABLE BY EMAIL` sit in the adjacent right column):

```
Hi I'm Michal and I build things.

maude is a small Claude Code marketplace. Two plugins, one CLI, some opinions about HTML mocks. I built it, mostly at night, because I kept needing it.

I don't fully understand why it works, but it works.

I like nerdy jokes and tools without analytics. Based in Prague. Reachable by email, ideally not Slack.

If it breaks it's almost certainly my fault. Open an issue. I read them.
```

The five paragraphs are: identity, scope, magic-admitted, identity-inventory, failure-mode-promise. This is the canonical home for the literal north-star sentence `I don't fully understand why it works, but it works.`. It ships here once and only here. Other surfaces approximate the technique. Only this paragraph reuses the words.

Chrome contract: no portrait, no signature-as-image, no handwritten-feel mono. Catalog stamp plus sentence-case mono carries the chrome. The prose carries the warmth.

### Do / Don't

| Do | Don't |
|---|---|
| `Plugins & Vibes.` | `Plugins, not vibes.` |
| `A Claude Code marketplace. Two plugins, one CLI, some vibes.` | `Two plugins. One CLI. No webinars.` |
| `Open issues if it breaks. Send PRs if you have a better idea. I read both.` | `Built in the open. PRs welcome.` |
| `design. Iterates canvases until they stop being embarrassing.` | `design — Canvas-first iteration.` |
| `flow. The agentic loop that ships things eventually.` | `flow — Plan, execute, done.` |
| `mdcc. The plumbing the other two pretend not to need.` | `mdcc — Three subcommands, no surprises.` |
| `maude, how it works mostly` | `maude documentation` |
| `You're probably here for design or flow. mdcc is the plumbing.` | `design handles X, flow handles Y, mdcc handles Z.` |
| `Three commands and you're in. (Maybe four. Depends on your shell.)` | `Getting started in 3 minutes` |
| `Nothing installed yet. Which is fine, you just got here.` | `You haven't installed anything yet.` |
| `That canvas is private. Or deleted. Or the snapshot id doesn't match.` | `That canvas is private.` |
| `That path doesn't exist. Or it used to and got renamed. /docs has a map.` | `404. Page not found.` |
| `Generation failed. Falling back to direct mode. The fact is in the final print. No silent downgrade.` | `Oops! Something went wrong.` |
| `Bootstrapped system/project/ with 36 specimens. Aesthetic critic gave it 4.1/5 (which is the highest it gives anything, so, solid).` | `Bootstrap successful.` |
| `Booting. (Usually about 800ms.)` | `Starting...` |
| `Scaffolds a docs site. (Yes, this one too.)` | `Scaffolds documentation site for your project.` |
| `Search anything. /commands work too.` | `Search docs, plugins, commands...` |
| `Buy me a coffee` | `Buy a coffee` |

### North-star sample lines (the cold-start register library)

Read these before writing any new copy. They cover the twelve surfaces a future agent encounters most. The `·` between label and value is a column-format separator inside this specimen, not prose punctuation.

```
hero subhead        · A Claude Code marketplace. Two plugins, one CLI, some vibes.
install instruction · One command: mdcc install MDCC-DSN/01. Come back here in five seconds.
primary CTA         · Hop in. Three commands.
error               · Generation failed. Falling back to direct mode. The fact is in the final print. No silent downgrade.
empty state         · Nothing installed yet. Which is fine, you just got here.
404                 · That path doesn't exist. Or it used to and got renamed. /docs has a map.
success             · Bootstrapped system/project/ with 36 specimens. Aesthetic critic gave it 4.1/5 (which is the highest it gives anything, so, solid).
deprecation         · Old flag, still works, but I'd rather you didn't.
tooltip             · Cmd-click an element to select it. The next /design:edit will know what you meant.
loading             · Booting. (Usually about 800ms.)
command description · design. Iterates canvases until they stop being embarrassing.
about-bio one-liner · Hi I'm Michal and I build things.
```

### Tone calibration ladder

The shift is visible in column 3. That's where iter 0 lived. Column 4 is the same factual content with one of: a parenthetical aside, an anticipated-objection clause, or a small specific detail. The on-tone version is always additive. The dry version is never wrong. The on-tone version just earns the slot.

| context | too safe | too dry (old register) | on-tone | too much |
|---|---|---|---|---|
| Error after a failed command | `An error occurred during installation.` | `Crashed. git pull and try again.` | `Generation failed. Falling back to direct mode. The fact is in the final print. No silent downgrade.` | `Whoopsie! Looks like the install gremlin escaped again!` |
| Empty state | `You haven't installed anything yet.` | `Nothing installed yet.` | `Nothing installed yet. Which is fine, you just got here.` | `Looks pretty lonely in here! Let's get you started with your first canvas!` |
| Hero subhead | `A collection of Claude Code plugins for design and workflow automation.` | `Two plugins. One CLI. No webinars.` | `A Claude Code marketplace. Two plugins, one CLI, some vibes.` | `Unleash your creative superpowers with our magical plugin ecosystem!` |
| Install instruction | `Please run the following command to install:` | `Run: mdcc install MDCC-DSN/01` | `One command: mdcc install MDCC-DSN/01. Come back here in five seconds.` | `Just paste this into your terminal and watch the magic happen!` |
| 404 | `Page not found.` | `404. Wrong door.` | `That path doesn't exist. Or it used to and got renamed. /docs has a map.` | `Oopsie-daisy! Looks like this page is playing hide and seek!` |
| Success toast | `Snapshot saved successfully.` | `Saved.` | `Bootstrapped system/project/ with 36 specimens. Aesthetic critic gave it 4.1/5 (which is the highest it gives anything, so, solid).` | `Boom! Snapshot locked in!` |
| Loading | `Loading...` | `Booting.` | `Booting. (Usually about 800ms.)` | `Blasting off to dev-land!` |
| Tooltip | `Click an element to edit it.` | `Cmd-click to select.` | `Cmd-click an element to select it. The next /design:edit will know what you meant.` | `Magic time! Cmd-click any element and watch the wizardry happen!` |

### Technique catalogue

Eleven techniques, ordered by leverage (number of surfaces each technique fixes across the 18 high-vis slot map).

**T1. Magic-admitted-as-magic.** Name the part of the system whose behaviour you don't fully understand, modestly, as a fact. The maker concedes the magic; the user inherits permission. Examples: `Aesthetic critic gave it 4.1/5 (which is the highest it gives anything, so, solid).`, `An agentic loop that ships things eventually.`. Use for: emergent-behaviour subsystems (agentic loops, critic panels, generation envelopes). Don't use for: plain CRUD. Quota: once per surface.

**T2. Load-bearing parenthetical.** Sentence carries the fact, parenthetical carries the warmth. Examples: `Three commands and you're in. (Maybe four. Depends on your shell.)`, `Booting. (Usually about 800ms.)`, `Scaffolds a docs site. (Yes, this one too.)`. Use almost anywhere a sentence carries a fact and a small additional honesty. Don't use in: confirmation dialogs, status badges, stamps. Highest-leverage technique in the catalogue.

**T3. Generative stacking.** Frame the offer as "X & Y" not "X, not Y". Examples: `Plugins & Vibes.`, `Two plugins, one CLI, some vibes.`, `Plain HTML, plain CSS, plain joy.`. Use for: headlines, sub-heroes, descriptions of what the product IS. Don't use for: lines naming what the product refuses to be. The corrective stack stays for that lone slot (`No telemetry, no signup, no book-a-demo button.`).

**T4. Modest scope-naming.** Describe what the tool IS using the smallest possible frame. Examples: `A small Claude Code marketplace.`, `mdcc. The plumbing the other two pretend not to need.`, `that's the entire support contract.`. Use for: product descriptions, taglines, "what is X" sections. Don't use for: specifications inside command docs.

**T5. Name-the-failure-mode.** When something might break or feel rough, name the rough edge directly. Specificity is the warmth. Examples: `That canvas is private. Or deleted. Or the snapshot id doesn't match.`, `That path doesn't exist. Or it used to and got renamed.`, `Iterates canvases until they stop being embarrassing.`, `Open issues if it breaks.`. Use for: ambiguous-failure empty states, 404s, deprecation notices, error messages. Don't use in: success states.

**T6. Anticipated-objection.** Write the reader's likely question or objection into the copy, then answer it casually. Examples: `You're probably here for design or flow. mdcc is the plumbing.`, `Nothing installed yet. Which is fine, you just got here.`, `Aesthetic critic gave it 4.1/5 (which is the highest it gives anything, so, solid).`. Use for: docs ledes, empty states, success states with non-obvious metrics. Don't use in: pure chrome, error messages where priority is action.

**T7. Anthropomorphize the product, not the user.** Human-ish predicates land on the system ("it pretends not to need", "it calls itself done", "it doesn't forget"), never on the user. Examples: `mdcc. The plumbing the other two pretend not to need.`, `It plans, executes, calls itself done, then validates.`, `flow. The agentic loop that ships things eventually.`. Use for: tile descriptions, product-tour bodies, feature explainers. Don't use in: error messages (anthropomorphizing a crash is twee).

**T8. Self-named-job-title.** Describe yourself with the smallest, most colloquial noun. The smallness is the credibility. Examples: `Hi I'm Michal, I made this.`, `Hi I'm Michal and I build things.`, `I'm a designer who got too into code.`. Use for: about page, landing footer signature, README opener. Once per page maximum. Don't use anywhere the user is buying or signing up.

**T9. One-pun-per-page discipline.** Absurdist or pun-shaped phrases are permitted but rationed to one per surface. Examples: `Hop in. Three commands.` (the landing's one allotted pun), `bear necessities` (Bear Blog), `chunky bacon` (why's poignant guide). Don't use a second instance on the same page. The discipline is the technique.

**T10. Shorter-wins-ties.** When two phrasings are equally clear, pick the shorter. Examples: `Saved.` not `Your changes have been successfully saved.`. `Open issues if it breaks.` not `Please file a bug report if you encounter any issues.`. Use for: toasts, button labels, status chips, stamps. Don't use when the longer carries warmth or an anticipated-objection that the shorter cuts. Ties only.

**T11. Calibrated `!`.** Exclamation marks permitted only after the whitelist verbs (works / fired / shipped / boots / saved-first-time) and only once per surface. Default punctuation is full stop. Examples: `It works!`, `Shipped!`, `Boots in 800ms!`. Forbidden: `Welcome!`, `Saved!` as default toast, `LIVE!`. Use for first-time-success states, deploy notifications, rare-path successes.

---

## Hard rules (NOs)

Encoded in this DS by the absence of corresponding tokens and reinforced by `/design:critic` panel agents:

1. **No frosted-glass / glassmorphism.** Plugin cards and chrome are flat, hairline-bordered, ink-on-paper or cream-on-phosphor. There is no `backdrop-filter` token. If you reach for `backdrop-filter: blur(...)` in any new specimen, that's a critic blocker.
2. **No `border-radius` > 4px.** Hard-edges family. Status pills are squared chips, not pills. Avatar shapes still allowed at `999px` if you really need a circle, but anything else rounded over 4px is a regression.
3. **No drop-shadows on chrome.** `--shadow-sm/md/lg` are deliberately `none`. The ONLY place blur appears is `--shadow-focus`.
4. **No stock photography.** Especially "laptop on a desk" hero shots. The dev-server canvas screenshot, the ASCII tree, the SKU label, these are the brand. We don't borrow other surfaces.
5. **No magic-verbs, no corporate pluralization warmth, no `we`/`our`, `I` only in permitted slots.** Magic-verbs (`reimagine`, `supercharge`, `unlock`, `effortless`, `magical`) get rewritten to the literal verb (`change`, `make faster`, `enable`, `easy`, `surprising`). No corporate pluralization warmth (`let's`, `together`, `we're so excited to`, `we're thrilled`). No `we` / `our` anywhere. `I` is permitted ONLY in: the about-page bio, the landing footer signature, the README opener, the `/docs/about` page, and deprecation notices that reflect a maker choice ("Old flag, still works, but I'd rather you didn't"). Anywhere else, `I` is forbidden. Severity: magic-verbs are warnings; pluralization warmth and `we`/`our` are blockers; `I` outside permitted slots is a blocker. Pluralization-warmth is the Notion anti-reference; `I`-in-chrome is the Slack-mascot anti-reference.
6. **No animations beyond hover + reduced-motion-respecting tooltip fades.** No scroll-jacking, no parallax, no ambient drift, no auto-play marquees. `--dur-route` is `1ms`. Route changes are instant.
7. **No emoji in chrome.** UI labels use ASCII / Unicode-glyph icons (`▸ ▹ ● ○ ▲ · → ✓ ✗`) or stroked SVG glyphs from `assets/glyphs/`. Emoji are fine inside user-generated content (README markdown bodies) but not in DS chrome.
8. **No purple/blue AI-launch gradient.** Gradients are reserved for data visualization (heatmaps, intensity legends). Never for hero bgs, never for buttons, never for "page background atmosphere".
9. **No comparative-mode headlines, no time-promise headlines, no rhetorical questions in headers, no winking parens that don't earn the slot.** No `X, not Y` headline shape (use generative stacking). No `X in N minutes` time promises. No `Tired of X?` rhetorical questions. One parenthetical per sentence, never two, never a wink-aside next to a parenthetical in the same sentence. Severity: warning. The corrective shape is the htmx-Tunney anti-reference; the time-promise is the SEO-marketing anti-reference.
10. **No system-rebukes-user posture.** Errors share puzzlement, they don't scold. The system is on the user's side; if something broke, the system says so and offers a way out. Tone: `Generation failed. Falling back to direct mode. No silent downgrade.` Not: `Invalid input. Try again.`. Severity: blocker. The htmx-Tunney corrective register applied to errors becomes hostility; the new register stays curt-AND-transparent.
11. **No AI-tell punctuation in prose.** No em dash (`—`). No en dash as separator (`–`). No ellipsis character (`…`); use three periods (`...`). No curly quotes (`"` `"` `'` `'`); use straight (`"` `'`). Interpunct (`·`) stays only in catalog SKU stamps and table-format column separators inside specimens, never in flowing prose. Excess emoji is a warning even in user-generated markdown when it lands in DS chrome. Comma splices, sentence fragments, and imperfect punctuation are preferred over perfect punctuation that reads AI-generated. Severity: blocker for em dash, en dash as separator, curly quotes, ellipsis character, and interpunct in prose; warning for emoji density in chrome. The em dash is the single strongest signal that copy was written by an LLM rather than a person.

`/design:critic` will reject any canvas that violates 1, 3, 6, 8, the blocker-tier of 5, 10, or 11. Violations of 2, 7, 9, and the warning-tier of 5 are warnings. Violations of 4 are copy-critic blockers.

---

## Brand assets

The DS ships with three classes of brand asset under `assets/`:

| Path | What it is |
|---|---|
| `assets/logos/wordmark.svg` | The `maude` wordmark. Berkeley-mono uppercase set with the accent dot. Use at the top of marketplace landing + dev-server header. |
| `assets/glyphs/<name>.svg` | Domain-noun glyph set (plugin, canvas, slash-command, file-tree). 16×16 grid, 1px stroke, designed to sit inline with mono text at `--type-base`. Drop more here when you scaffold new noun surfaces. |
| `preview/iconography.html` | The specimen that catalogs all glyphs side-by-side; new glyphs MUST land in this index. |

Wordmark and glyphs are deliberately minimal. They're the kind of mark a single developer would commit at 1am, not the output of a brand sprint. That's on-purpose. The catalog-page typography does the heavy lifting; the marks are signatures, not crests.

---

## Density + reading rhythm

**Balanced docs-page density.** Chrome lives on `--space-3` / `--space-4` (8 / 12px), prose runs to `--layout-prose` (72ch), and the type ladder is mono-tuned with looser line-heights than a sans equivalent would use (mono needs the air).

Marketplace landing surfaces should breathe. Paragraphs at 72ch, h2 sections separated by `--space-7` (32px) plus a 1px rule. Dev-server canvas surfaces tighten. `--space-3` / `--space-4` everywhere, tile rows snap to a 220px-min `repeat(auto-fill, minmax(220px, 1fr))` grid.

There's no roomy variant. The DS is built for developer-designer hybrids who read code at 13px Berkeley Mono and don't need consumer-app padding.

---

## How to use this DS

1. **Build a canvas:** `/design:new "<Name>" "<brief>"` scaffolds an HTML file under `.design/ui/` using these tokens.
2. **Iterate:** `/design:edit "<feedback>"` edits the active canvas in-place, then auto-runs the critic panel.
3. **Critic alone:** `/design:critic` runs the panel on the active canvas without editing. Use `--system-only` to check the DS itself.
4. **Hand off:** `/design:handoff` migrates the canvas to production code (currently nothing wired; configure in `.design/config.json`).

When writing specimen copy yourself (without an agent), use `voice_tone_options[1]` from the payload (the irreverent-developer-voice sample microcopy section) as the register reference. If you find yourself typing "let us", stop and rewrite.

---

## Provenance

- Bootstrapped: **2026-05-14** via `/design:setup-ds project "<brief>"` against `maude@0.12.0`
- Round 0 research: 11 WebSearch queries; payload at `_history/_system/project-df4b0d27-domain-research-discovery.json`
- Anchor pool: U.S. Graphics Company, JSR, Berkeley Mono spec sheets, htmx.org, redbean.dev, The Monospace Web, 16colo.rs, Teletext revival, Robb Owen, tldraw, Vercel Geist (calibration floor)
- Inspiration library: `plugins/design/templates/design-system-inspiration/` @ Maude v0.12.0
- Discovery answers: see `_history/_system/project-000-scaffold-roster.yaml` `discovery:` block

Re-bootstrap with `/design:setup-ds project --force` if the domain has moved (anchors stale, new heritage references surfaced). The cached payload will be refreshed.
