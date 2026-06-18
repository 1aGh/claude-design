---
"@1agh/maude": minor
---

In-UI git layer (Phase 27, epic E2) — see, save, publish your design work without a terminal.

- **Changes panel** (`View ▸ Changes` / `⌘⇧G`): every changed canvas grouped Modified / Added / Deleted / Untracked, with live M/A/D/U dirty badges in the file tree (updated reactively as you edit). Two-line rows (name + path), per-file select + discard.
- **Save version** (commit) with a message + per-file selection or "Save all"; metadata sidecars auto-save with their canvas.
- **Publish changes** (push) + **Get latest** (pull) — token-optional in this release: a system-git credential helper publishes today, GitHub sign-in lands in a later phase. Clean-but-unpublished work surfaces a "ready to publish" state.
- **History** timeline of saved versions.
- **Visual diff** (the Maude differentiator): a *rendered* before/after of the actual canvas — both panes live, with locked synced zoom/pan, side-by-side or an overlay/slider wipe — plus a plain-language Keep mine / Keep theirs / Keep both conflict picker (Keep both is the default, zero data loss). The "before" pane renders the canvas at its past version.
- Vocabulary is non-technical throughout (Save version / Publish / Get latest / History / Unsaved) — never commit/push/pull.

Server: `isomorphic-git`-backed `/_api/git/*` endpoints (main-origin only, mirroring the canvas-create security pattern) + a rate-limited historical-canvas render path.
