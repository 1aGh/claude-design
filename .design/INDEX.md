# md-claude — Canvas index

> Auto-maintained by `/design:setup-docs`. Lists every canvas + DS specimen under `.design/` with a one-line hook.

## Design system — `studio`

The single design system in this project. Path: `system/studio/`. Default DS in `config.json`.

### Tokens & philosophy

| File | Role |
|---|---|
| [system/studio/colors_and_type.css](system/studio/colors_and_type.css) | Authoritative tokens |
| [system/studio/README.md](system/studio/README.md) | Philosophy, mood references, hard rules |
| [system/studio/SKILL.md](system/studio/SKILL.md) | Agent-loaded skill pointer |

### Specimens (28 HTML files in `system/studio/preview/`)

**Composition (start here)**
- `ui_kits-desktop-showcase.html` — full product mock: top nav · sidebar · 3 switchable screens · status bar · accent picker. The canonical "DS in use" composition.
- `ui_kits-desktop-index.html` — catalog of every specimen below.

**Foundations**
- `colors-accent.html` — plasma + amber two-tier policy demo (critic target).
- `colors-text.html` — fg-0..3 ladder.
- `colors-surfaces.html` — bg-0..4 + border ladder.
- `colors-status.html` — semantic success/warn/error/info.
- `colors-presence.html` — 4 state dots + 5 cursor hues.
- `type-scale.html` — 8 steps + display tier.
- `type-mono.html` — Geist Mono as display surface.
- `spacing-scale.html` — 4px base, 9 steps.
- `motion.html` — 4 durations · 3 easings · reduced-motion guard.
- `radii.html` — xs..xl + pill.
- `elevation.html` — 4 ambient + 2 glow shadows.
- `focus.html` — `--ring` on every surface.
- `iconography.html` — lucide 1px-stroke domain set.

**Components — core**
- `components-buttons.html` — 4 variants × 3 sizes × 6 states.
- `components-cards.html` — 5 card shapes (default · hoverable · with-thumb · signature · with-stat-row).
- `components-inputs.html` — text · search · textarea · select · states.

**Components — universal**
- `components-toggles.html` — switch · checkbox · radio · segmented.
- `components-dialogs.html` — modal · drawer · destructive.
- `components-tooltips.html` — near-black chrome above chrome.
- `components-tables.html` — dense · mono numerals · sortable.
- `components-callout.html` — info · note · warn · success · brand-amber.

**Components — pro-tool**
- `components-command-palette.html` — ⌘K · grouped · fuzzy match.
- `components-shortcuts-overlay.html` — ? key · 18 shortcuts.
- `components-keyboard.html` — kbd conventions.
- `components-list.html` — dense · multi-line · selectable.
- `components-toast-menu.html` — transient surfaces.
- `components-resize-panels.html` — split-pane · drag handle.

**Status loading**
- `components-status.html` — pills · dots · banners.
- `skeletons.html` — shimmer · reduced-motion safe.

**Brand**
- `logo.html` — wordmark + mark + no-go zone.
- `empty-state.html` — voice moment with brand-amber glow.

### Assets

| File | Role |
|---|---|
| [system/studio/assets/logos/wordmark.svg](system/studio/assets/logos/wordmark.svg) | studio wordmark — Geist 600 + plasma slash + mono subscript |
| [system/studio/assets/logos/mark.svg](system/studio/assets/logos/mark.svg) | studio mark — plasma square with amber inset |
| [system/studio/assets/glyphs/canvas.svg](system/studio/assets/glyphs/canvas.svg) | canvas glyph (chrome icon) |
| [system/studio/assets/glyphs/terminal.svg](system/studio/assets/glyphs/terminal.svg) | terminal glyph |
| [system/studio/assets/glyphs/inspector.svg](system/studio/assets/glyphs/inspector.svg) | inspector glyph |

## Canvas projects (`ui/`)

No canvases scaffolded yet. Run `/design:new "<Name>" "<brief>"` to create one — it will land under `ui/studio/<Name>.html` and inherit studio tokens automatically.

The natural first canvases for md-claude:
1. **`dev-server-shell`** — the file-tree + tabbed-iframe + status-bar composition this DS is built for.
2. **`docs-landing`** — long-form docs hero where `--brand-amber` lives.
3. **`marketing-hero`** — the homepage that pitches md-claude to passersby.

## Open warnings (from last completeness-critic run)

Four foundations were intentionally deferred at bootstrap and remain warnings under `completenessProfile: standard`:

- `borders.html` — derived border ladder demo.
- `grid.html` — 56/248/main/28 desktop skeleton illustrated.
- `opacity.html` — alpha ladder for shadows / tints.
- `selection.html` — text-selection styling.

Run `/design:edit` against any of them to scaffold the missing specimen.

## Last updated

2026-05-13 — initial bootstrap. Iter 2: retro CRT pass (`_layout.css` + showcase). Iter 3: showcase components (chunky beveled buttons, LED, license-plate pills, hardware-tile cards). Iter 4: **propagated retro anatomy across the DS** — new shared `preview/_components.css` (canonical `.btn`, `.pill`, `.tile`, `.input`, `.seg`, `.switch`, `.avatar`, `.eyebrow`, `.led`) now linked from 11 specs: components-{buttons, cards, inputs, toggles, dialogs, status, tables, callout}, colors-accent, empty-state, ui_kits-desktop-index. Single source of truth for primitive anatomy.
