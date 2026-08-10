---
'@1agh/maude': patch
---

A cloud link renews itself instead of silently dying after 12 hours.

The desktop held a never-expiring account sign-in next to a ≤12-hour cell
session token and nothing connected the two — so every cloud workspace link
stopped syncing within half a day, every canvas was refused with `invalid
token`, and the status bar sat on `connecting…` indefinitely. Re-pressing
Connect was the only cure, and nothing told you to.

Now the sync runtime renews the session token in place from the account
you're already signed into — on a timer before it expires, and immediately
when a refusal proves it already has. No re-login chore, and the 12-hour
revocation window is unchanged: a renewal only ever mints a fresh token
through the cloud, so being signed out, revoked, or removed from a project
makes it fail exactly where it should.

Two honesty fixes ride along: the hub's rate-limited refusal of an invalid
token now says so (a peer no longer mistakes it for a transient limit and
retries forever into the bucket refusing it), and a link that has synced
nothing for five minutes reads as **stalled** with a reconnect prompt
instead of a permanent `connecting…`. Renewal itself is rate-disciplined —
a floor plus a no-progress cap — so it can never become the retry storm it
exists to end.
