---
name: design-system
description: Background design-system knowledge for Dugmate — tokens, type, color, radii, shadows, density, layout constants, sport glyphs, and reference HTML specimens. Auto-load whenever generating, reviewing, or migrating UI for Dugmate (web or mobile). Content lives in .ai/design/system/ — this skill is a pointer.
---

# Dugmate design system — pointer skill

This skill is a **thin pointer**. The actual design-system content lives at:

```
.ai/design/system/
```

The split: this `SKILL.md` is metadata that Claude Code auto-loads when relevant; the heavy content (tokens, specimens, ui kits, assets, chats) is tracked as project content under `.ai/design/`. See `.ai/design/README.md` for the full layout and rationale.

This skill is non-user-invocable. Auto-loads when Claude is doing design work for Dugmate. The user-facing orchestrator is the sibling `design` skill.

## Where things live

| What | Path (from repo root) |
|---|---|
| Full design philosophy, content rules, hard-stops | `.ai/design/system/project/README.md` |
| **Design tokens (CSS vars) — authoritative** | `.ai/design/system/project/colors_and_type.css` |
| Original Claude Design skill descriptor (historical) | `.ai/design/system/project/SKILL.md` |
| Specimen pages (colors, type, components, motion, elevation, …) | `.ai/design/system/project/preview/*.html` |
| Desktop UI kit (Rail, TopBar, VideoPlayer, PlaybookEditor, Chat, LiveControlRoom, Surfaces, tweaks-panel) | `.ai/design/system/project/ui_kits/desktop/` |
| Mobile UI kit (MobileApp, ios-frame) | `.ai/design/system/project/ui_kits/mobile/` |
| Logos + sport glyphs | `.ai/design/system/project/assets/` |
| Sketches + scraps | `.ai/design/system/project/scraps/` |
| Original chat history (2 transcripts: Avatar kontrast, shadcn Setup) | `.ai/design/system/chats/` |
| Bundle handoff README (from Claude Design) | `.ai/design/system/_HANDOFF-BUNDLE-README.md` |

## When to read what

- **Generating a new screen** → read `.ai/design/system/project/colors_and_type.css` (tokens) + the relevant `.ai/design/system/project/ui_kits/{desktop,mobile}/*.jsx` for layout idioms.
- **Reviewing token compliance** → read `.ai/design/system/project/colors_and_type.css` + `.ai/design/system/project/preview/colors-*.html` to know the legal palette.
- **Picking radii / shadows / spacing** → `.ai/design/system/project/README.md` "v2 shadcn-style refresh" section is authoritative.
- **Matching brand voice / iconography stroke** → `.ai/design/system/project/README.md` content fundamentals + `.ai/design/system/project/assets/sport-glyphs/`.

## Hard rules (excerpted; full list in `.ai/design/system/project/README.md`)

1. **Dark by default.** Surfaces ladder: `--bg-0` page → `--bg-4` hover.
2. **Radii ladder:** xs 2 / sm 4 / md 6 / lg 8 / xl 12 / pill 999. Cards use `--radius-lg`, buttons `--radius-md`, chips `--radius-sm` or `--radius-pill`.
3. **Type:** IBM Plex Sans 600/700 for headings, Inter 400/500/600/700 for body, JetBrains Mono for timecodes/scores/IDs. `font-variant-numeric: tabular-nums` everywhere it matters.
4. **Accent is the only customizable token.** Override per team via `.team-cyan|indigo|emerald|rose` or `[data-team="<name>"]`. Never override neutrals.
5. **Lucide-style line icons, 1.5 stroke.** No filled, no colorful, no emoji in chrome.
6. **Live / on-air states are highest visual priority** — `#FF3B30`, never muted.
7. **Cards have borders + bg shift, never shadows.** Shadows only for floating overlays.
8. **Sub-100ms response.** Skeletons not spinners. Optimistic UI.

## Cross-links

- Design system v2 changelog → `.ai/design/system/project/README.md` (top of file)
- Token CSS → `.ai/design/system/project/colors_and_type.css`
- Live specimen browsable → `pnpm design:browse` (or `open .ai/design/system/project/preview/colors-surfaces.html`)
- Desktop UI kit composer → `.ai/design/system/project/ui_kits/desktop/index.html` (mounts all kits in one page via Babel/UMD React)
- Mobile UI kit composer → `.ai/design/system/project/ui_kits/mobile/index.html`
- Layout rationale + provenance → `.ai/design/README.md`

## Migration provenance

- Source: `.ai/design-import/ds/dugmate-design-system/` (gitignored Claude Design export, May 5 2026)
- Migrated 1:1 with no content edits
- Outer Claude-Design handoff README preserved as `.ai/design/system/_HANDOFF-BUNDLE-README.md`
- This `SKILL.md` is the pointer for Claude Code's skill discovery
