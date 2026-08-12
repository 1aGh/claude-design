---
'@1agh/maude': minor
---

Import a Figma file with no Figma account.

`maude design import-figma --fig <path>` reads a `.fig` or `.jam` you exported,
entirely offline — no network, no token, no seat. It is the only import door
that works when you have none of those, and the only one whose images travel
inside the file, so nothing expires and nothing is rate-limited.

The decoder is ours and adds no dependency: a narrow ZIP reader and a Kiwi
schema/data decoder over `node:zlib` alone. That matters beyond tidiness — a
`.fig` carries its own schema, so a Figma schema change is a non-event rather
than something to chase, and the door works identically on the npm CLI and in
the packaged app.

Pictures come out of the archive itself, including vector icons: the path
geometry is in the file, so an icon is rebuilt locally as real SVG instead of
being requested from Figma. The archive's own prelude decides whether it is a
board or a design file, so there is no mode to pick and no way to ask for the
wrong translator.

It refuses rather than guessing. A design importer that half-reads a file it
does not understand produces plausible, subtly wrong geometry that you discover
three canvases later, so an unrecognised prelude or a broken chunk stops the
import and names what it saw. The one thing a local export genuinely cannot
reproduce — a percent line-height, which needs font metrics the file does not
carry — is reported, not silently dropped, and so is every node that degrades.
