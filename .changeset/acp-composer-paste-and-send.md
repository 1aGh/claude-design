---
"@1agh/maude": minor
---

The AI chat composer got three fixes and a new attachment affordance. Copy and paste now work in the native app (Cmd+C / Cmd+V / Cmd+X / Cmd+A — a proper Edit menu was missing), and Enter sends your message (Shift+Enter for a newline). Paste a file path, a URL, or an image straight from your clipboard and it collapses into a compact chip — `[file-1]`, `[link-1]`, `[image-1]` — with a reveal line under the composer showing exactly what each chip will send, so nothing hidden ever rides into Claude. A pasted screenshot is saved alongside the chat and Claude reads it on send, just like Claude Code.
