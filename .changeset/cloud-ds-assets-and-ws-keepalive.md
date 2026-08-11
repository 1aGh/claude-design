---
'@1agh/maude': patch
---

Design-system brand assets now render in the cloud, and the desktop status bar
stops flapping to "reconnecting" on an idle link.

- **Cloud images (completing the 0.58.3 fix).** The first pass only pushed a
  project's top-level `assets/` up to the cloud, but a design system keeps its
  logos, signs, fonts and photos under `system/<ds>/assets/…` and references
  them by their full path — served from the cell's checkout, not the asset
  bucket. Those 90-odd files never left the desktop, so every brand logo showed
  a grey "Preview:" placeholder. The desktop now pushes every asset directory to
  the cell over a new checkout-write route (symlink-contained, binary-extensions
  only, size-capped), so brand assets render in the cloud like everything else.

- **"Reconnecting" flap (desktop).** The status bar could sit on *reconnecting*
  while the cloud sync said *synced* — two different sockets. The local
  dev-server socket carries no traffic when you're idle, so it hit the 120-second
  idle-timeout, closed, and reconnected in a loop. It now sends a small keepalive
  every 25 seconds, so an idle link stays *live*.
