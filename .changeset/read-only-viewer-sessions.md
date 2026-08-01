---
"@1agh/maude": patch
---

**Inviting someone as a "viewer" now does what the word says.** The role has existed since the People page shipped, and it enforced nothing — so the workspace refused those sign-ins outright rather than hand somebody a session it could not restrain. A viewer could be invited and then could not get in at all, while the invitation email promised they could look and comment.

They get in now, and genuinely cannot change anything: the session carries a read-only capability, the sync protocol drops their document edits rather than trusting the app to hide the buttons, and every route that changes something refuses. Signing out and downloading the work still do exactly what a viewer would expect. The editing UI itself is still on screen for them — that half is next, and until it lands a viewer will see buttons the server declines.

Alongside it, four defects found by walking the paid signup as a stranger rather than by testing it: every outbound email had been silently failing for two days (invitations, and the new pause and deletion notices), the pricing page promised €19 while the payment screen charged €22.99 including VAT, a project created by mistake could never be deleted because deleting requires a copy and an empty project has nothing to copy, and the deletion-warning email would have sent roughly fifty times instead of once.
