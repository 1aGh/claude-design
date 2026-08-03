---
'@1agh/maude': patch
---

**The browser door is early access, and the release note now says so.** The
first cloud release described a browser door that shows the full Maude Studio.
What shipped is a simplified view — your project opens, roles and comments work,
but Files, Layers, Inspector and search are the desktop's for now, and a
project's own images and fonts are not served yet. The next release hosts the
real studio in the cloud rather than a browser-shaped stand-in.

Everything under it is real and verified in production: per-tenant storage
credentials, the segregated render origin, the role model enforced at the cell,
mirror-as-pull-request, and a cell that now reaches the internet by dialling out
— so a broken platform link between the router and a project can no longer take
that project offline.
