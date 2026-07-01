---
"@1agh/maude": patch
---

`/design:setup-ds`'s Stage-4 design-language moodboard is now saved as a **persistent, commentable UI canvas** at `.design/ui/<ds>-moodboard.tsx` instead of a throwaway file that was discarded after the direction gate. It shows up in `/design:browse` and the canvas list, survives the bootstrap so you can revisit it, and takes comments like any other canvas. In variant mode the 2–3 explored directions are composed as `<DCArtboard>`s **side by side in that one canvas**, so you can compare and comment per-direction. The moodboard is still never written under `system/<ds>/`. (DDR-136, amends DDR-080.)
