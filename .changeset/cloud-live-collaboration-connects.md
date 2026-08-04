---
"@1agh/maude": patch
---

**Live collaboration connects in the cloud browser door.** The per-canvas collab socket — cursors, presence names, live annotations, comment sync — could never reach a cloud cell: the studio's loopback-only gate refused every proxied upgrade, and the hub's session gate refused the cookieless canvas origin. The hub now carries a capability-authenticated WebSocket lane on the canvas origin (the same render token the canvas already rides, so a same-site connect just works), the studio accepts proxy-vouched collab upgrades in workspace mode, and the collab room enforces roles at the socket: a viewer's cursor and comments cross, but only editors and owners write annotations — and nobody writes canvas source from the canvas realm, same as always. Presence now introduces members by name instead of `anonymous-…`, and a collab socket that keeps being refused backs off and says so instead of retrying silently forever.
