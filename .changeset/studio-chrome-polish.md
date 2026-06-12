---
"@1agh/maude": minor
---

Studio chrome polish — DS-parity + behavioral pass across the canvas browser

A specimen-by-specimen audit of the studio shell against the maude design system, fixing both look and behavior, each change verified live via agent-browser + the full design smoke (89/89 styled) and the studio test suite (1471 pass).

- **Resizable panels** — drag the file tree and the right dock to resize (8px grip, accent seam on hover/focus/drag), or nudge with the arrow keys (Home/End to min/max, double-click resets); widths persist per panel. Keyboard-operable + `role="separator"` with `aria-value*`.
- **Loading skeleton** — a calm `.skel` pulse card shows on the stage while a canvas compiles, cleared by the iframe's `loaded` message (180ms appearance delay so warm canvases never flash it).
- **Keyboard shortcuts** — a new `?` cheat-sheet (the DS shortcuts-overlay: four dense mono-headed columns, 24 real bindings); `F1` keeps the deep Help modal; Help is now a dropdown. Collisions fixed: Inspector moved to `⌘⇧I` (bare `I` stays the canvas highlighter), New canvas is bare `N` (the browser reserves `⌘N`), and `⌘⇧E`/`⌘⇧H` are now bound. `⌘R`/`⌘⇧I/M/E/H` forwarded from the canvas iframe so they work wherever focus is — `⌘R` with canvas focus no longer browser-reloads the whole shell.
- **Presence** — collaborator + agent cursors match the design system: the plain triangle pointer glyph, hue pill label (mono, dark text), and the agent rides `--presence-agent` exclusively (human peer hues now exclude the agent + accent bands so attribution is unambiguous).
- **Annotations snap to the dot grid** — drags fall back to the 24px lattice per-axis when no smart-guide candidate wins; `⌘` still suppresses.
- **Menubar truth pass** — View ▸ Layers and View ▸ Zoom (In/Out/Fit/Actual) are wired to the live viewport (were disabled as "Phase 4/12" after they shipped); File ▸ Close canvas added; empty shortcut pills hidden; dropdowns layer above the sync banner.
- **Consistency** — unified focus rings (the DS focus recipe), styled `[data-tip]` tooltips replacing native `title=`, thin scrollbars, the DS selection-handle recipe, Inter/Inter Tight loaded, and a `127.0.0.1` `frame-ancestors` fix so opening the shell via the IP no longer blanks every canvas iframe.
