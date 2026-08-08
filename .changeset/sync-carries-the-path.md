---
'@1agh/maude': patch
---

Sync now carries a canvas's folder, so a project arrives whole.

A canvas synced but its **location** did not: the document name is a flattened
slug (`ui/2026/social/summer-camp.tsx` → `ui-2026-social-summer-camp`) and
`/` → `-` is not reversible, so both the desktop and the cloud wrote the body
flat at the design root — where the file tree lists nothing and nothing syncs it
onward. Three canvases sat on a live hub with their full bodies and appeared
nowhere in the cloud, while the desktop's log correctly said `76/76 synced`.

The path now travels with the document and is checked rather than trusted: it is
believed only because it slugs back to the very document carrying it, which makes
a path aimed anywhere else stop addressing that document. A path that fails the
check — or an older peer that sends none — still gets its canvas, now inside a
canvas group instead of at the design root, and at a path that still resolves to
the same document rather than forking it.

Also: a fresh process no longer serves the previous one's sync verdict, so
`/_sync-status` can't report `0 synced · 73 rejected` for a link the hub is
accepting.
