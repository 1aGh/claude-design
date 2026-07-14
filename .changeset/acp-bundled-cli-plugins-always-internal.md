---
"@1agh/maude": patch
---

Maude Desktop's Assistant chat panel now always runs the exact `maude` CLI and `design`/`flow` plugin versions that shipped with your installed app — never a separately installed copy.

Previously, if you had an older `maude` on your PATH (e.g. from `npm i -g @1agh/maude`) or `design@maude` already installed via the Claude Code plugin marketplace, the chat panel would silently defer to that older copy instead of the one bundled with the app you just updated. It now always uses the bundled, release-matched copy inside the chat panel specifically — your own terminal `claude` sessions are unaffected and still use whatever you have installed yourself.
