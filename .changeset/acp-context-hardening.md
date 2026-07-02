---
"@1agh/maude": minor
---

ACP chat context hardening: per-canvas selection memory, frozen-at-send chat context, and a session bootstrap brief. Switching canvases while an agent runs no longer loses what you had selected — each canvas remembers its own selection, and every chat message carries the canvas + selection frozen at send time as a visible, removable attachment chip. New agent sessions get a studio-environment brief so Claude knows where it's running without any project CLAUDE.md setup.
