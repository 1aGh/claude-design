---
'@1agh/maude': minor
---

Maude tells you when a chat finishes or needs input — even in a project you're not looking at.

**A native notification now fires for a background project, not just the one on screen.** The desktop app polls every project it's keeping alive in the background (up to two others beyond the one you're viewing) and sends a real OS notification the moment a turn finishes or gets stuck waiting on you — including a chat that outlived its browser tab entirely. The notification never names the chat, its title, or anything it said: only the project's own folder name plus a fixed line ("Claude finished" / "Maude needs your input"), because a chat title is generated from whatever the model read, and a lock screen is the wrong place to show that.

**A permission or question prompt raised in a project you're not looking at now has a real chance of reaching you before it times out.** Previously that signal only ever showed up in the in-app badge — silent if the window wasn't focused, and invisible entirely for a chat with no open tab.

The visible project's own "you weren't looking" notification (window unfocused or the panel closed) now goes through the same native path under the desktop app, with a Web-notification fallback outside it — same policy as before, just routed through the OS reliably.

No new setting: turn Maude's notifications off from your OS's own per-app notification controls if you'd rather not get them — an in-app toggle risked becoming the one switch that silently loses the awaiting-input signal too.
