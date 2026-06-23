---
"@1agh/maude": patch
---

History view — click a saved version to preview it (Phase 27.1, epic E2 follow-up).

- The **History** tab is now interactive: with a canvas (or specimen) open, it lists that file's saved versions and each one is click/keyboard-activatable → opens the visual before/after at that version. With nothing open, it stays a read-only repo-wide list.
- The **visual diff** gains a **"Saved version" picker** — compare your current canvas against any earlier saved version, not just the last one; the "before" pane re-renders as you pick.
- Fix: the diff sheet is now vertically centered (a tall comparison no longer clipped its footer on shorter windows).

Server: the existing `GET /_api/git/log` takes an optional `?path=` to scope History to one canvas — design-tree-scoped, main-origin-only, `GIT_LITERAL_PATHSPECS` + `--`-terminated (no argument injection / pathspec magic).
