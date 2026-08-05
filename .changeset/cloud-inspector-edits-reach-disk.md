---
'@1agh/maude': patch
---

Cloud: Inspector and artboard edits made in the browser now actually save.

Inside a cell the editing shell could annotate and comment but nothing else — every CSS-knob change, artboard resize/style/kind, insert, delete, reorder, and text/attribute edit was refused with "local request required (DNS-rebinding guard)". The guard on ~97 studio routes checks for a loopback `Host`, but the cloud proxy deliberately rewrites `Host` to the project's public name, so it could never pass in a cell; annotations and comments were spared only because their handlers carry no such guard. The check is now mode-aware — verbatim loopback locally, and in a cell it accepts the proxy's unforgeable role vouch instead (the same signal the collaboration sockets already trust). A separate one-line inversion is fixed too: the Local/Shared badge lookup was filed as a write and answered 405 for every role. Both are pinned by tests — a helper matrix and a manifest guard that fails the build if a write-classified route is ever a read-only handler again.
