---
'@1agh/maude': patch
---

Typing a height for an artboard in the Inspector does something again.

Width worked; Height silently did nothing whenever the artboard was in Hug mode, where the height is a content-driven floor rather than an exact size — so the value you typed was simply dropped, with no message. A typed height now promotes the artboard to Fixed at that height: the same "freeze the height" write the Hug/Fixed toggle already performed, just seeded from your number instead of the last measured one. In Fixed mode it stays an ordinary resize, exactly as before.
