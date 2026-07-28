---
'@1agh/maude': minor
---

**Maude Cloud — the workspace stack, end to end.**

- **Invite a teammate with a link.** They click it and they are editing: no account form, no token to paste, no git. Looking at an invite never uses it up (a mail scanner following the link would otherwise burn it), a mistyped password never burns it either, and an invite can only ever be used once.
- **A hosted workspace refuses to run your designs.** It stores and syncs them; it never renders, builds or executes one — enforced by the process refusing to start, by a container image with no browser in it, and by a CI gate that fails if either protection is removed.
- **Your data is never hostage.** Suspension stops a workspace without deleting it, and an export is delivered before any teardown. That is a state machine, not a policy: the code makes "purged" reachable only through "exported", and if the retention window elapses without the export having actually arrived, it holds and re-sends.
- **Mirror to your own GitHub repository** — one way, never forced. If the mirror has commits Maude did not create, it stops and says so rather than overwriting them.
- **A Trust page whose claims are checked**, at [maude.sh/docs/cloud/trust](https://maude.sh/docs/cloud/trust): what the operator can see, what it cannot, subprocessors, breach and deletion timelines — each one naming the mechanism behind it, with a test that fails the build if a cited mechanism disappears or an aspirational sentence creeps in.

Self-hosting stays free forever and stays the same software: `maude hub workspace-up` runs the identical stack on your own box.
