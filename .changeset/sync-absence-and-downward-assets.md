---
'@1agh/maude': patch
---

Deleting a canvas now means it is deleted, and a picture you add in the browser
arrives on your other machines.

Two things were wrong for the same reason: sync could say what a project HAS and
had no way to say what it no longer has, or to send a picture in the direction
nobody had built.

Deleting a canvas only ever moved it to the trash on the machine you were
sitting at. Nothing told the project, and every machine treats the project as
the authority on what exists — so the canvas came straight back. It looked like
deleting was ignored: the canvas vanished for a second and reappeared. Deleting
is now something the project is told, and every machine puts its own copy in the
trash where you can still get it back. Making a new canvas with a name you
deleted earlier works too.

Pictures only ever travelled one way. An image you dropped onto a canvas on your
desktop reached the cloud; one you added in the browser never came down, so the
canvas showed the picture's frame — right place, right size, right caption — and
no picture, on every machine but the one that made it. Each machine now fetches
the pictures it can see are missing.
