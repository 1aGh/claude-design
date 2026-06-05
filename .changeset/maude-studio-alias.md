---
"@1agh/maude": patch
---

Add `maude studio` — a top-level alias for `maude design serve`

`maude studio [--port N] [--root <path>]` now boots the canvas studio (the design dev server), matching the runtime's new home under `apps/studio/`. `maude design serve` keeps working unchanged. Internally, the dev-server and collab hub moved out of `plugins/design/` to top-level `apps/studio/` + `apps/hub/` (DDR-095) — a pure relocation with no behavior change; `maude design serve` and every `maude design <verb>` behave identically.
