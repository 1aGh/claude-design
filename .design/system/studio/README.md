# studio — Design System

> The visual language for **md-claude** — a Claude Code marketplace shipping a canvas-first design plugin and an agentic workflow loop. One system serves two surfaces: the docs site (long-form reading, code blocks, embedded demos) and the dev-server UI (file tree, tabbed canvas iframe, inspector overlay).

## Purpose

Make `md-claude` legible at a glance. Docs that read like a respected pro tool — not a generic SaaS landing page. A dev server that feels like an instrument, not a CRUD form. The DS is the place where those two surfaces agree.

## Audience profile

- **Primary user:** Designers and developers who use Claude Code daily — comfortable with the terminal, opinionated about their tools, allergic to clutter.
- **Platforms:** Desktop only. The dev server is desktop (file-tree + iframe split-pane); docs are designed desktop-first.
- **Default theme:** Dark. There is no light variant in this scaffold — every specimen renders in dark.
- **Content tone:** Warm hacker. Direct, opinionated, occasionally dry. Names things. Doesn't apologize for opinions.

## Mood references

| Reference | What we steal |
|---|---|
| **Zed** | Dev-tool restraint. Mono-forward chrome. Tight radii. Fast `flip:120ms` motion. Status-bar at the bottom is non-negotiable. |
| **Affinity Studio** | Pro-tool prestige. Long elevation ladder. Dramatic shadows. A `--brand-amber` spotlight reserved for hero moments. Gradient discipline (rare, deliberate, never decorative). |
| **PostHog** | Voice. Hedgehog-warmth in copy that admits the product has a personality. The amber spotlight color is a wink to PostHog's hedgehog without dressing one. |
| **Figma** | Canvas-first surface logic. Sidebar density. Multiplayer cursor charm — `--presence-c1..5` exists so the dev-server can show co-editors. |

## Foundations

### The two-tier accent model

The components rule and the brand rule are different rules:

- **Components:** one accent family — `--accent` / `--accent-hover` / `--accent-active` / `--accent-fg`. The plasma violet (`oklch(68% 0.22 285)`). Used everywhere clickable: buttons, links, focus rings, sidebar-active, status bar accent text. No `--accent2` in components, ever.
- **Brand spotlight:** `--brand-amber` (`oklch(64% 0.18 50)`). Reserved for **marketing surfaces only** — docs hero gradient, signature-moment art, brand banner, `assets/logos/mark.svg`. **Never used in dev-server chrome.** Never paired with a button. If you find yourself wanting amber in a component, that's a signal the component should use plasma instead.

This is the Affinity playbook: one UI accent so the chrome reads as a coherent system, plus a brand color reserved for big moments so the wordmark has personality. The completeness-critic treats this as a single-accent family (only `--accent*` is checked for family membership) because `--brand-amber` is namespaced under `--brand-*`.

### Token contract

All visuals reference `var(--*)` tokens declared in `colors_and_type.css`. No hardcoded hex / px / rem in canvases or production code. Adding a new visual concept means **extending the tokens CSS first**, never inventing values inline.

### Active token families

- `accent` — plasma; components only
- `status` — success / warn / error / info; structural, never tied to brand
- `presence` — five collaborator cursor hues + online/away/busy/offline state dots; supports the multiplayer cursors in the dev-server
- `mono` — Geist Mono is treated as a first-class display surface (status bar, file paths, version labels, hero metadata)
- `brand` — `--brand-amber` only; marketing surfaces

## Hard rules (non-negotiable)

- **Accessibility:** WCAG 2.1 AA contrast at every visible surface. Focus-visible always rendered (`--ring`). Touch targets ≥ 44×44. `prefers-reduced-motion: reduce` collapses every duration to 1ms.
- **No off-token colors / radii / spacings** in canvases. Extend tokens; don't inline.
- **No placeholder copy.** Real product strings only — no "Lorem", no "Acme Corp.", no "Click here". Empty states name the actual missing thing.
- **Type ladder:** 8 steps from `--type-xs` (12px) to `--type-3xl` (44px), plus one `--type-display` (64px) reserved for hero only.
- **Motion:** every animation uses a `--dur-*` and `--ease-*` token. No magic numbers. Default ease is `--ease-out`; the one playful curve is `--ease-spring`, used sparingly.
- **Mono is a first-class display surface.** Status bars, file paths, version labels, port numbers, and hero metadata are mono — not body text styled mono.
- **The plasma–amber split is policy.** A graphic-design critic that sees `--brand-amber` inside a `components-*.html` file should flag it. Use plasma for chrome, amber for moments.

## Platform hard rules

- **Desktop only.** Specimens assume ≥ 1280px viewport. The `ui_kits-desktop-showcase.html` is the canonical "DS in use" composition: top nav (56px) · sidebar (248px) · main · status bar (28px).
- **Dev-server chrome lives in monospace.** The file tree, the tab bar, the inspector overlay — all `var(--font-mono)`. Body text inside the docs surface is the sans (Geist).

## Voice & tone

- **Direct, opinionated, occasionally dry.** "Empty states are an opportunity. Don't waste them on 'Nothing here yet'."
- **Mono in status copy.** `synced · 14:08:22` reads warmer than `Last synced: 2:08 PM`. Mono is the studio's house voice.
- **Specific over polite.** "Plasma was picked because PostHog warmth was already in the wordmark." beats "We chose a versatile color palette."
- **Empty states name what's missing.** "No canvases in this project yet — start with `/design:new`" beats "Nothing here yet."
- **Marketing copy can be warm.** Dev-server copy is terse. Docs copy can have personality — sentence-fragments, parenthetical asides, the occasional opinion.

## Iconography

`lucide` family at 1px stroke, rounded caps, 16px or 20px grid. The `iconography.html` specimen ships a developer-tool-flavored set: terminal, file, git-branch, search, plus, command, folder, settings, status-dot, ellipsis. No emoji in chrome (the dev-server status bar is mono — emoji break the rhythm).

## Where things live

| Path | Role |
|---|---|
| `colors_and_type.css` | Authoritative tokens |
| `preview/` | All specimens — one HTML file per token family / component class. Flat — no subdirectories. |
| `preview/_layout.css` | Shared specimen chrome |
| `preview/ui_kits-desktop-showcase.html` | The canonical "DS in use" composition |
| `preview/ui_kits-desktop-index.html` | Catalog of every desktop-specific specimen |
| `assets/logos/wordmark.svg` | Studio wordmark (Geist-derived) |
| `assets/logos/mark.svg` | Studio mark — plasma square with amber inset |
| `assets/glyphs/` | Domain icons for the dev-server (terminal, canvas, inspector) |

## Hard-stops the completeness-critic enforces

- Core tokens present (`--accent`, `--bg-0..4`, `--fg-0..3`, `--dur-flip`)
- Exactly one accent family in components (`--brand-*` is namespaced and exempt)
- `preview/` populated with at least 20 specimens (this scaffold ships ~30)
- `colors_and_type.css` linked from every specimen
- `prefers-reduced-motion: reduce` guard present in tokens CSS
- Wordmark claim → `assets/logos/wordmark.svg` exists
- Mark claim → `assets/logos/mark.svg` exists
- `ui_kits/desktop/` never scaffolded as empty (we use `preview/ui_kits-desktop-{index,showcase}.html` instead — flat layout)

See `plugins/design/agents/design-system-completeness-critic.md` for the full rule set.

## How to extend

1. Identify the missing concept (new component, new state, new platform).
2. **Extend `colors_and_type.css`** with any new tokens needed. If you're tempted to add `--accent2`, stop — use plasma or, if it's a brand moment, use `--brand-amber`.
3. **Add a specimen** under `preview/` with a SPECIMEN comment header so future agents learn from it.
4. Run `/design:critic --system-only` to confirm completeness.
5. Commit.

Never extend the system by inventing values inline in a canvas — that's how systems decay.
