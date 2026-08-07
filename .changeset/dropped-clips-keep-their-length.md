---
'@1agh/maude': patch
---

A clip dropped onto the timeline keeps its own length instead of becoming three seconds.

Every drag-and-drop landed as a 3-second clip, whatever the source actually was, because the drop happened before anything had read the file's real duration and 3s was the fallback. The drop path now loads the media's metadata first and uses its true duration, so a 12-second take arrives as a 12-second clip and no longer has to be re-trimmed by hand.
