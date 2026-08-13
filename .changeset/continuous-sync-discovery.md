---
'@1agh/maude': patch
---

A canvas made anywhere now shows up everywhere, without anyone restarting
anything — and the cloud keeps its own images.

Each side used to look for new canvases exactly once, when it started up. Your
desktop restarts all the time, so a canvas you made there eventually turned up
in the cloud; a cloud project runs for days, so a canvas you made in the browser
never turned up anywhere at all. Sync looked one-directional, and a canvas that
did arrive had no cursors and no live edits in it. Both sides now keep looking:
a new canvas is picked up as it appears, arrives on the other machine, and is
live in it — cursors, comments, annotations and all.

The cloud also stops losing pictures. When it moved your project between
machines, photographs could come back as grey boxes and the only repair was
re-uploading everything from your laptop; it now restores them itself from the
copy it already had. Resync is a desktop control again — in the cloud it never
could work, and offering it there only produced an error nobody could act on.

Finally, `maude doctor` notices when your `.gitignore` is quietly dropping work
Maude considers yours to keep — a stale rule could keep every annotation out of
git forever, visible in the app and in no clone of it.
