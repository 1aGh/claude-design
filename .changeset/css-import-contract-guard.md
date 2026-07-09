---
"@1agh/maude": patch
---

Catch canvases that use a design-system component without importing its stylesheet.

- When a canvas uses a component from a design system's `preview/` folder (a mascot, a brand logo, any shared specimen component), that component's animation and layout live in the DS's shared `_layout.css` — which the canvas has to import itself. Forgetting it used to render the component silently static and mispositioned (no animation, floating accessory layers), with no error at all.
- `/design:new` and `/design:edit` now write that required import up front when a canvas pulls in a `preview/` component, and the `design-system-keeper` audit warns if it's ever missing — so the "looks broken but the build is green" case gets caught instead of shipping.
