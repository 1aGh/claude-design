---
"@1agh/md-claude": minor
---

**Inspiration library expansion** — 46 new reference specimens, bringing `plugins/design/templates/design-system-inspiration/` to **70 files** total (up from 24 in v0.8). Plus removes the `/design` compat stub on schedule.

**Library additions (46 specimens):**

- **`foundations/` (8)** — radii, elevation, borders, focus, opacity, selection, grid, iconography. Universal — every project pulls from these.
- **`status/` (3)** — colors-status, components-status (badges + row indicators), skeletons. Active when `"status" ∈ activeFamilies` (default for almost every project).
- **`audience-pro/` (6)** — dense list, toast-menu, keyboard primitives, command palette, shortcuts overlay, presence colors. For pro tools with keyboard-first density.
- **`audience-consumer/` (5)** — marketing card, testimonial, feature grid, generous empty state, page banners. For consumer-facing surfaces.
- **`audience-developer/` (6)** — terminal pane, log stream, diff view, code block (with syntax-tinted token palette), monospace table, type-mono usage. For developer tools.
- **`platform-mobile/` (5)** — bottom sheet (3 snap states), pull-to-refresh, tab bar, segmented control, mobile UI kit index.
- **`platform-desktop/` (2)** — resizable 3-pane layout, desktop UI kit index.
- **`theme-both/` (1)** — dark + light side-by-side comparison (for `Q4 = both equal` projects).
- **`patterns/` (6)** — form layouts (4 variants), error pages (404/500/offline/maintenance), onboarding (welcome + tour + coachmark), auth (sign-in / sign-up / reset), pricing tiers, data density (sparse / default / compact).
- **`meta/` (4)** — tokens index (visual TOC), accessibility patterns (skip-link, sr-only, landmarks, focus trap, ARIA live), i18n (RTL flip, long-text overflow, pluralization, lang attribute), presence-multiplayer (forward-pointer to v1.1+ Yjs features).

Every specimen carries the `<!-- SPECIMEN: … -->` comment header (DEMONSTRATES / COMPOSITION / COPY VOICE / WHEN SCAFFOLDED / NOTES) — the bootstrap-mode agent reads these as references to learn what each pattern is and how to generate a project-flavored equivalent.

**Stub removal:**

- `plugins/design/commands/design.md` — the v0.8 one-version compat stub redirecting `/design` → `/design:edit` — **removed** as scheduled. Calling `/design` no longer resolves; use `/design:edit` directly.
- `site/content/docs/reference/design/design.mdx` — auto-generated reference page for the removed stub — also removed.
- Cross-references updated in `plugins/design/CATEGORIES.md`, `plugins/design/commands/help.md`, `CLAUDE.md`, `site/content/docs/design/index.mdx`, `site/content/docs/design/categories.mdx` — the rename history table gains a final row for the v0.9 removal.

Now-canonical command list: 11 (8 daily + 3 setup, no compat stub).

**Scaffold sizes (updated):**

| Project profile | Approx file count (was → now) |
| --- | --- |
| Consumer marketing | ~12 → ~18 (foundations, status, audience-consumer, patterns) |
| Pro-tool SaaS | ~22 → ~32 (foundations, status, audience-pro, platform-*, universal, meta) |
| Developer CLI dashboard | ~14 → ~22 (audience-developer + meta + foundations + status) |
| Consumer mobile | ~16 → ~22 (platform-mobile + consumer + foundations) |
| Enterprise admin | ~20 → ~30 (audience-pro + theme-both + patterns + meta) |

Skill `design-system` (bootstrap mode) reads `_MAPPING.md` to pick which subdirs apply per discovery — and now actually has the files to read.
