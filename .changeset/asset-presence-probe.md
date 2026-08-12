---
'@1agh/maude': patch
---

Your project's assets stop re-uploading themselves every time you open Maude.

The desktop asked the cloud about each file separately, with a request the
cloud quietly rewrote on the way in — so the answer never came back as "already
there", and a design system's logos, fonts and photos were uploaded again on
every launch. Maude now asks about the whole project in one go: a project whose
assets are already up there settles in a second instead of minutes, and nothing
travels twice.
