---
"@1agh/maude": minor
---

In-app "What's New" + guided tour for the Maude UI

- **What's New, in the canvas browser** — a `✦ New` badge in the menubar, a first-run toast, and a reopenable panel surface user-facing updates the moment your installed maude version ships them. Backed by a single source-of-truth feed (`plugins/design/dev-server/whats-new.json`, served at `GET /_api/whats-new`) that describes Maude's own product updates, resolved from the maude package root (not the served project) and main-origin only. The client compares the installed version against a `localStorage` marker to decide what's unseen. See DDR-086.
- **Guided tour** — a hand-rolled, zero-dependency overlay (spotlight cutout + accessible dialog with focus-trap, `Esc`/`←`/`→`, `prefers-reduced-motion`) powers both a per-feature spotlight launched from a What's New entry and an evergreen "how Maude works" walkthrough offered once on first run and replayable from Help. See DDR-087.
- **`/whats-new` on the docs site** — the same feed is mirrored to a committed `site/lib/whats-new.json` (Vercel-safe) and rendered as a release-notes page.
- **Mechanism** — closing a user-visible feature with `/flow:done` offers to append a feed entry via the repo-internal `whats-new-entry` skill (generic, opt-in `integrations.whatsNew` gate; no Maude paths in the flow plugin). Entries are written pending and stamped with the shipped version + date at release (`scripts/bump-version.sh`).
- `learnMore` URLs are constrained to `http(s)` at the schema + both render sites, and the feed is validated at site-build time (defense-in-depth).
