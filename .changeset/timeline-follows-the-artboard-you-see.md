---
'@1agh/maude': patch
---

The Timeline plays the artboard you're actually looking at.

- **Fixed: scrub and playback moved the wrong comp.** On a canvas with more than
  one video-comp, the Timeline drew the rows of the artboard you had panned to,
  but Play, scrub, mute and loop drove the *first* artboard's composition.
  Underneath, the panel picked its target comp by matching clip length — so two
  compositions of the same duration (the ordinary case) collapsed onto whichever
  one happened to mount first. Every comp now says which artboard it belongs to,
  and the transport follows that, not the length.

- **The Timeline says which artboard it's on.** On a multi-comp canvas the panel
  head shows the scoped artboard's name, so "these rows belong to *that* board"
  is visible instead of inferred. Pan to another artboard to switch.

- The clip length is still used as a fallback when the artboard isn't known, but
  only when it identifies exactly one comp — never by silently taking the first.
  The same targeted comp now backs the frame readout and the frame math behind
  drop, split, and the +Title / +Image / +AI clip inserts.
