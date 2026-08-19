---
'@1agh/maude': patch
---

History now shows the versions that are actually being saved.

Connect a folder to Maude Cloud and the cloud starts saving it for you — every
few seconds, without being asked. The panel said so. Directly underneath, it
also said "No saved versions yet", while the same project open in a browser
listed three saved versions. Both sentences were true, about two different
places, and together they read as the one thing that was not true: that nothing
was being kept.

The panel was showing the history of the copy on your machine, which in that
mode nobody writes to. It now shows the cloud's — headed by the cloud project's
own name, so you can see which project the versions belong to — and clicking a
version opens the canvas as it was then, even for versions that only ever
existed in the cloud. If the cloud can't be reached, it says that, with a Retry,
instead of quietly looking empty.

While the cloud is saving, the app also stops keeping its own separate account
of the folder: no unsaved-file marks in the file tree, no draft switcher, no
background checks against a copy you are not editing through. Disconnect and all
of it comes straight back, in place, with no restart.

Your own `git` is untouched by any of this. Nothing is installed into the
project, nothing is written to its configuration, and a terminal behaves exactly
as it did before — including switching branches, which still updates what you
see on screen.
