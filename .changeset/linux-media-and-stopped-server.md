---
'@1agh/maude': patch
---

Canvas media plays on Linux, and a server that stops for good says so.

**Linux media (issue #105).** Opening a canvas containing audio or video on
Linux could take the whole view down with no message, twice over. WebKitGTK
plays media through GStreamer, and the plugin that registers an audio sink is
only an *optional* dependency of WebKitGTK on Arch and most non-Debian distros —
without it WebKit hits a release assertion and aborts the entire renderer rather
than playing silently. Past that, the GPU video path asks Mesa's `radeonsi`
driver for a colour buffer it rejects, and the pixel readback that follows
faults; on a 4 GB card the same path exhausts video memory and the driver aborts
outright. Both present identically to the person using it: the window opens, the
canvas starts loading, the view goes blank.

The `.deb` now declares the GStreamer plugin packages, so installing with `apt`
makes the first failure unreachable. For every other install route — a repacked
`.deb`, a distro package, an extracted tree — Maude looks for the audio sink at
startup and, when it is missing, says so with the install command for the distro
it is actually running on. On AMD graphics it sets WebKit's own
`WEBKIT_GST_DISABLE_GL_SINK` escape hatch for itself, routing video frames
through system memory; any value you set yourself wins, including `0` to keep
the GPU path. The desktop docs gained a Linux row, install step, and a section
covering all of it.

**A stopped server (found while auditing those crashes).** Two `maude-server`
cores from one afternoon turned out to share a byte-identical stack: a
divide-by-zero on a zero stride inside the Bun runtime, which is upstream and
not fixed here. What was ours is what happened next. The supervisor's restart
budget counted crashes for the lifetime of the session rather than a crash
*loop* — it only ever reset when you switched projects and came back — so three
unrelated crashes across a day retired the project permanently even though every
one of them had recovered. And reaching that limit printed to a terminal that an
app launched from the Dock, Finder or a desktop launcher does not have, leaving
the window showing a page whose server had stopped answering: no error, no
reason, no way back short of quitting.

A crash now only counts toward the limit if the server had not been up and
serving first, so an isolated fault costs nothing. When the limit really is
reached, Maude tells you which project stopped, confirms your files on disk are
untouched, and offers Try again — which restarts the server with a fresh budget
instead of making you relaunch.

**Also fixed:** the tarball-shape release gate could not run on npm 11 or newer,
which changed `npm pack --json` from an array to an object keyed by package
name. It accepts both shapes now.
