# DDR-092 — Theme-aware ink reads chrome theme (data-maude-theme), not DS theme (data-theme)

**Date:** 2026-06-04  
**Status:** accepted  
**Feature:** annotation-tooling-polish (items 3, 5, 6)

## Decision

The live-default ink color for annotation tools (`color` state in
`AnnotationsLayer`) follows `data-maude-theme` on `document.documentElement`
(the canvas-shell **chrome** theme), **not** `data-theme` (the design-system
artboard palette theme).

Implemented via `useCanvasChromeTheme()` — a local hook that reads
`document.documentElement.dataset.maudeTheme` and watches it via
`MutationObserver`.

## Context

The canvas has **two separate theme attributes** (intentional, per
`canvas-shell.tsx`):

| Attribute | Owner | Purpose |
|---|---|---|
| `data-maude-theme` | canvas-shell chrome | Maude HUD dark/light (default: dark) |
| `data-theme` | design system | Artboard palette (user's DS tokens) |

The first attempt (using `useTheme()` from `canvas-lib.tsx`) read `data-theme`
— the DS artboard palette. On the default dark canvas, `data-theme` resolves to
`'dark'` too, but the intended split is: `data-maude-theme` controls the
**background the ink sits on** (the canvas grid), while `data-theme` controls
the **artboard content colors**.

## Why `data-maude-theme` is correct

The annotation ink is drawn on the canvas background (the grid), not inside an
artboard. The user sees it as "dark" or "light" based on whether the Maude
chrome is in dark or light mode — which is `data-maude-theme`. An annotation
drawn on a dark canvas should be light; one on a light canvas should be dark.
This is independent of whether the artboard inside uses a dark or light DS
palette.

## Parse fallback stays `DEFAULT_COLOR = '#1f1f1f'`

The parse-time default is never theme-dependent (determinism + back-compat).
Stored strokes keep their literal hex. Only the live un-touched draw default
follows the theme; once the user picks a swatch, it sticks (`colorTouchedRef`).
