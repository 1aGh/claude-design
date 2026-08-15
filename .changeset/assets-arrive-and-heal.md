---
'@1agh/maude': patch
---

A picture you drop on a canvas now reaches your other machines while you
watch — and heals on screen the moment it lands, without a reload.

Four holes lined up behind one symptom (a broken-image frame that never
recovered):

- The cloud served pictures only from its durable object store, not from its
  own working copy — so a freshly uploaded file that the cloud itself was
  already displaying answered "not found" to every other machine asking for
  it. The working copy now serves first, the object store stays the fallback.
- One of the three upload doors never told the object-store mirror it had
  written anything, so files pushed through it survived only until the next
  cloud restart.
- When the mirror DID fail, it failed silently — no log line anywhere. It now
  says loudly what failed and why, and retries once on its own.
- Browsers never retry an image that failed to load. When the missing file
  finally arrives on disk, open canvases now get a signal and re-point the
  broken images at it — the glyph heals in place instead of waiting for a
  manual reload.
