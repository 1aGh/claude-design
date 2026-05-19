---
"@1agh/md-claude": minor
---

**Design plugin — Phase 3.6.1: canvas envelope hygiene, reusable canvas-lib, HMR, and DS specimens as TSX.**

- **`@mdcc/canvas-lib`** — shared canvas library (`<designRoot>/_lib/canvas-lib.tsx`) resolved virtually at build time. Ships the frame envelope (`DesignCanvas`, `DCSection`, `DCArtboard`, `DCPostIt`), specimen helpers (`SpecimenHeader`, `SpecimenMeta`, `TokenChip`, `ColorSwatch`, `TypeScaleRow`, `KbdHint`, `ThemeToggle`) and hooks (`useTokens`, `useTheme`, `useArtboardBounds`). Authored once, imported by canvases and specimens — `/design:handoff` inlines used exports per-canvas so the emitted registry-item stays self-contained.
- **HMR** — `fs-watch` change events now broadcast `canvas-hmr` messages over the existing inspector WebSocket. CSS sibling edits hot-swap via `<link>` cache-bust; `_lib/**` edits trigger hard iframe reload; canvas `.tsx` edits do a module reload. Target p50 < 200 ms click-to-paint, p99 < 400 ms.
- **DS specimens are now TSX**, not HTML. `/design:setup-ds` scaffolds bare-TSX specimens via the new `ds-specimen.tsx.template`; the `design-system-completeness-critic` and `design-system-keeper` agents read `.tsx`. The legacy `system/<ds>/preview/*.html` set is archived under `_history/_migration-2026-05-15/`.
- **`/design:edit` Step 1.5** now also pre-loads `<designRoot>/_lib/canvas-lib.tsx` for every `.tsx` canvas so iteration prompts see the authoring vocabulary instead of re-inventing helpers.
- **Fixes** the white-page regression in `Docs Site.tsx` / `Canvas Viewport.tsx` introduced by the Phase 3.6 codemod (which referenced `<DesignCanvas>` JSX identifiers that were undefined in TSX-land) and rebuilds `Smoke TSX.tsx` against the new envelope.
- Adds `canvas-lib-resolver`, `canvas-lib-inline`, and `hmr-broadcast` modules to `plugins/design/dev-server/` with full Bun-test coverage.
