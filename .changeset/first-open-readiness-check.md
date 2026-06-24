---
"@1agh/maude": minor
---

Desktop app: a first-open AI-editing readiness check. The welcome screen, the Assistant panel, and a new **Help → Check AI editing readiness…** menu item now show exactly what AI editing needs — the `claude` CLI, the `maude` CLI, and the Maude plugins in your Claude Code — with a copy-paste fix for anything missing. Nothing blocks the rest of the app, which works with no setup. Also fixes AI editing silently failing in the packaged app: the dev server now inherits your shell PATH when Maude is launched from Finder/Dock.
