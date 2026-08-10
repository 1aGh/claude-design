---
'@1agh/maude': patch
---

A cloud-linked project now matches your desktop exactly — same files, same
canvases, same images — and connecting means one save mechanism, not two.

This closes the remaining faults from the desktop↔cloud sync RCA (fixes 4–8;
fixes 1–3 shipped alongside the self-renewing link):

- **No more duplicates or broken canvases.** The hub used to memoise a flat
  fallback path before the canvas's real path was stamped, so a body that
  arrived first was pinned to the wrong location forever — a stub that failed
  its dynamic import in the cloud, and a duplicate file next to the real one.
  The path is now stamped before the first sync, and the hub relocates a
  fallback in place when the real path arrives (never moving a file another
  peer actually owns). A one-shot migration quarantines the duplicate flat
  copies earlier versions already wrote to `_trash/`, never deleting them.

- **Images show up instead of grey boxes.** The sync lanes carried text only,
  so a linked project's `assets/` never reached the cell. The desktop now
  pushes them over the existing authenticated asset route — streamed,
  size-capped, and contained to the design root — so the cloud serves the real
  bytes.

- **The cloud picker tells the truth.** The project this folder is linked to
  reads **Connected** (with a Disconnect), not another **Connect** button.

- **One place your work is saved.** Once a repo is linked and signed in, the
  desktop's local-commit panel steps back to a read-only History with a
  "Cloud is saving — changes sync automatically" note, so you're not choosing
  between two save mechanisms. Your git is untouched; Disconnect brings the
  panel back.
