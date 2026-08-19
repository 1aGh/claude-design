---
'@1agh/maude': patch
---

Six silent bugs, found by pointing a typechecker at code nothing was checking.

`apps/studio/tsconfig.json` listed its roots by hand and the list had no `*.tsx`
entry. Fifty-two tracked files were therefore read by no checker at all — not
loosely checked, not checked. Among them: `canvas-lib.tsx`, which every canvas
imports; every overlay; the whole `commands/` directory. Completing the list and
driving it to zero errors turned up six real defects, each one quiet enough to
have survived a full test suite and a visual smoke sweep.

Curved connectors imported from FigJam arrived broken. The importer mapped
Figma's `CURVED` to the string `curve`, and nothing in the renderer has ever
known that word — the arrow type is `curved`. Every curved connector silently
fell back to a straight line.

A context-menu entry inside a submenu could be permanently dead. Leaf items
resolve a function-form `disabled` against the thing you right-clicked; submenu
items were handed the function itself, which is always truthy — so any such item
rendered greyed out and swallowed every click, whatever the rule actually said
about that target.

Design-system motion specimens were not demonstrating their own easing. They
passed a CSS `cubic-bezier(...)` string to the animation runtime, which accepts a
named curve or four numbers and silently ignores anything else — so the tiles ran
on the library default while claiming to show the system's tokens.

The canvas geometry manifest dropped each artboard's `kind`, so the whiteboard
tooling that reads it lost the print/web/video distinction. The artboard element
carries the attribute; the reader simply never copied it across.

Pre-warming the canvas runtime bundles passed the array index as an options
object (`.map(fn)` hands its callback three arguments), so every warm-up after
the first ran with nonsense settings. Invisible, because a failed pre-warm just
means the real build happens on first use.

And an inline media player dereferenced a context that can legitimately be
absent — the overlay beside it already guarded the same value.

The repair is pinned: a coverage check now asserts that every tracked source
still reaches the checker, so the surface cannot quietly shrink again.
