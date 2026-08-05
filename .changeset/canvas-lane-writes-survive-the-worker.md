---
'@1agh/maude': patch
---

Cloud: drawing, artboard edits and media changes made inside a canvas actually save now.

Every write leaving the canvas iframe — annotation strokes, artboard layout, uploaded media — was silently converted to a bodyless GET at the platform's front door: the Worker rebuilt the request with an object spread, and a Request's method and body are invisible to spread, so nothing survived. The studio then answered the "write" from its read branches with a 200 the client took as "saved" — changes looked live, crossed as cursors, and vanished on reload. This is also why the v0.55.0 "canvas door refused every write" fix appeared not to work: the method never survived long enough to reach the door it repaired. The rebuild now carries the original request whole, the same rule is applied to the project-hostname marker strip, and both rebuilds are pinned by tests that assert a PUT crosses as a PUT, body intact.
