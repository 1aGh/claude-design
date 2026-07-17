---
"@1agh/maude": minor
---

Print artboards (`kind="print"`) are now genuinely print-ready. Pick a paper size (A6–A0, US Letter/Legal/Tabloid, DL/C5 envelopes, business cards) from the Inspector and it resolves to the correct bleed-inclusive pixel size automatically. Toggleable on-canvas bleed/trim/margin guides follow the pro-tool color convention (red bleed, solid trim, magenta margins). Export a 300–600 DPI PNG, or a print-ready PDF with correct MediaBox/BleedBox/TrimBox nesting and optional vector crop/registration marks — PDF export also gained an independent "Image quality" DPI control for embedded raster content (e.g. a photo on a large-format piece authored at a fraction of its physical size). RGB only — CMYK/PDF-X conversion stays your print shop's job. No new dependencies. The Artboard Inspector panel also now shares the same token-bindable controls as the CSS panel, so Bg/Pad/Gap accept `var(--color-*)`/`var(--space-*)` bindings.
