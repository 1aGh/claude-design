---
"@1agh/maude": minor
---

design: showcase-grounded canvas generation — `/design:new` and `/design:edit` now reuse the design system's platform showcase layout (`ui_kits-<platform>-showcase`) as the canonical product shell, so a new feature canvas slots into the established nav/sidebar/main/status arrangement instead of re-deriving "where things go". The showcase is collected as a Tier-0 pattern prior (above existing canvases + component specimens) and fed to generation as a reference (not a wireframe); `/design:edit` pre-loads it on add-surface edits; `design-system-keeper` gains a conservative product-shell-reuse audit (Pass A.6). Graceful fallback when a platform ships no showcase — never fatal. See DDR-127.
