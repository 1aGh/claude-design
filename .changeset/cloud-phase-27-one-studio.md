---
'@1agh/maude': patch
---

**Open a cloud project in a browser and you now get the real Maude Studio.** The
simplified view is gone. Files, Layers, Inspector, search, the toolbar and the
branch/LIVE status are the same code the desktop runs — because it *is* the same
code: a cell now serves the actual studio behind an authenticating proxy rather
than a hand-written stand-in.

Your designs look like your designs. Photographs, club logos, sponsor marks and
webfonts load on a rendered canvas — a canvas references its assets by absolute
path, and until now every one of those came back unauthorized, so the page
rendered with everything that makes it a design missing.

**A design system's component styles load again — on the desktop too.** Any
canvas whose design system ships a `preview/_components.css` was rendering
without it. That was every project with a bootstrapped design system.

**You are told which account you are signed in as, and can sign out.** A browser
tab carries no window title and no app switcher, so a project that said VIEW ONLY
gave no way to tell whether the role was wrong or the account was — and no way to
change either.

Also: the owner of a project is an owner again (a session used to store a
one-bit projection of its role, computed once and frozen for twelve hours), and
opening a cloud project no longer asks the server for two things it refuses by
design.
