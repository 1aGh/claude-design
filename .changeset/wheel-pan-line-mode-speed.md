---
'@1agh/maude': patch
---

Mouse-wheel panning on the canvas is smoother and faster.

The wheel handler fed the browser's raw `WheelEvent` delta straight into the
pan distance, but a wheel event isn't always reported in pixels — a physical
mouse (notably on Firefox, and on some browser/OS driver combinations
elsewhere) reports "line" units instead, a few small integers per notch.
Treating that as pixels moved the canvas only a few pixels per wheel notch,
which read as almost frozen; trackpad panning was unaffected because
trackpads already report pixel units.

Wheel deltas are now normalized against the unit the browser actually
reports before they're applied, so a physical mouse wheel pans at a normal,
visible speed again.
