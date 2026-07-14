---
"@1agh/maude": minor
---

Inspector controls redesign — one shared control library for the CSS and Photo panels.

- The CSS and Photo panels now share one control library (`NumberField`, `Slider`/`SliderField`, `Segmented`, `Swatch`, and more) instead of six-plus separately hand-rolled field factories, fixing a set of long-standing inspector papercuts: dragging to scrub now grabs the field's icon/label handle instead of fighting a click-to-edit; clicking a number field selects the whole value (click again to place the caret); arrow keys step values (Shift for ×10); bounded photo adjustments (brightness, contrast, saturation, grain, pattern, mask) are now real linked slider + numeric pairs instead of plain numeric fields; the CSS border row and the Photo duotone/pattern rows no longer overflow the panel at its default width; and the design-tokens/variables popover now stays anchored to its trigger at any scroll position or canvas zoom.
- Every primitive is documented in a new design-system specimen (`components-inspector-controls`) alongside the shipped panels, so the two stay in lockstep.
- Accessibility hardening: the rotation dial is now keyboard-operable (arrow keys, Home/End) and exposes a proper slider role; number fields expose spinbutton semantics; fixed a couple of invalid ARIA attributes and low-contrast labels in the new specimen.
