---
'@1agh/maude': minor
---

design: in-place FigJam-style comments — pins, composer, thread popover, @mention autocomplete

The comment composer + chip strip moved off the shell BottomBar and into the canvas iframe itself. Clicking an element in the Comment tool now opens a small DS-styled composer bubble anchored to the click point; pins render as 24×24 accent-fill badges at the target element's top-right corner; clicking a pin opens a thread popover with replies, resolve / reopen / delete, and an `@`-trigger autocomplete fed by the local repo's `git shortlog`.

Schema additions (back-compatible — legacy comments default-fill on read, persist on next write):

- `Comment.author` — defaults to `git config user.name` at create time
- `Comment.thread: Reply[]` — `{ id, author, body, created }`
- `Comment.mentions: string[]` — `@handle` tokens parsed across body + thread

New HTTP endpoints (Bun runtime, per DDR-009):

- `POST /_api/comments/<id>/reply` — append to thread, fold @mentions into the union
- `GET /_api/git-committers` — committer list for the @mention popup, cached 60 s server-side

Architecture: the overlay renders as a `position: fixed` sibling of `.dc-canvas` (NOT portaled into `.dc-world`) so its z-index actually competes with `SelectionHalos`. Pins stay 24 px at every zoom level, FigJam-style. See [DDR-034](.ai/decisions/DDR-034-comments-overlay-screen-coord-fixed-position.md) for the architectural rationale.

A11y: comment pin is a `<button>` with `aria-label`; thread popover is `role="dialog"` with focus management + Esc-to-close + focus-restore to the originating pin; mention popup uses the WAI-ARIA combobox-with-listbox pattern.
