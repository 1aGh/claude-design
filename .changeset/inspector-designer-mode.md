---
"@1agh/maude": minor
---

Inspector "Designer mode" — a Figma-vocabulary view of the CSS panel, for designers who don't think in raw CSS.

- The CSS inspector panel now has two modes, switchable from a small toggle in the panel's own corner (and remembered in Settings → Appearance → "Inspector vocabulary"): **Advanced** keeps the honest CSS property names (`border-radius`, `flex-direction`, `box-shadow`…), and **Designer** regroups the exact same controls into Figma-familiar clusters — Fill, Stroke, Corner radius, Auto layout, Effects, Opacity, Text — and relabels the rows (Direction / Alignment / Gap / Sizing…). Same controls, same live-edit behavior underneath; only the labels and grouping change, and a value set in one mode reads back correctly in the other.
- Designer mode is tuned for a cleaner, calmer read: it drops the per-row status dots for inherited values (keeping them only where a value is actually customized), and uses quiet title-case section headers instead of the developer-facing monospace labels.
- Two new style controls are available in both modes: **Blur** (`filter: blur()`) and **Blend** (`mix-blend-mode`).
- The auto-layout alignment is now a single 9-point pad (one click sets both axes), the first use of the shared inspector `AlignPad`.
