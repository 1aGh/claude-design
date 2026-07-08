---
"@1agh/maude": patch
---

Fix `/design:new` so canvases are reliably generated with both light and dark theme support on dual-theme design systems.

The prior dual-theme enforcement mechanism checked `config.json`'s `themeDefault` field for the literal value `"both"` — a value that field's schema (`dark | light` only) can never actually hold, so the check silently never fired. This let canvases ship with a token frozen at its default-theme value and invisible or low-contrast in the un-audited theme.

- `designSystems[].themes` is now the one authoritative signal for "this DS ships more than one theme" (schema + docs updated); bootstrap persists it going forward instead of leaving it to free-text description.
- `design-system-completeness-critic`'s V18 check now reads the correct field; a new V18c check catches a token declared in one theme block but silently missing from the other.
- `/design:new`'s post-write reality check now captures a second screenshot pass in the alternate theme whenever the target design system declares more than one, so both themes are visually confirmed before the canvas is considered done.
