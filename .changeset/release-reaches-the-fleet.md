---
'@1agh/maude': patch
---

Tagging a release now deploys the cloud and proves it did — and you can see the running version without leaving the app.

**Only a release tag builds a cell image.** A push to `main` used to build one too, deriving it from `maude-hub:latest` — an image that is only ever rebuilt at release time. So the cell was built on the *previous* release's hub, and every workflow went green anyway: v0.57.0 put a cell tagged `v0.57.0` into production carrying a six-day-old hub layer, and a route added after v0.56.0 was simply missing from the live fleet. A branch push now runs the data-plane tests and deploys the Worker, and nothing else. It could never roll the fleet in the first place, and the one thing it *could* do was leave two different images under one tag.

**"Green" now means a live cell answered on the released version.** After deploying, the workflow polls a real tenant cell until it reports the version just released *and* the exact client bytes this run built. The two catch different failures and neither replaces the other: the hash catches "same tag, different bytes", and only the version catches "the layer underneath is a release behind" — that stale image was internally self-consistent, so a hash check alone would have waved it straight through.

**The version is now something you can read.** It shows in the Studio status bar (desktop, browser, and cloud — they all serve the same client), in the hub admin header next to the bundle hash, and at `/health` as `releaseVersion`. Both app manifests join the release line, so the hub stops reporting itself as `0.0.0`.

**And the release instructions agree with each other.** Three of the four places that tell you how to tag printed a lightweight `git tag vX.Y.Z`, which `git push --follow-tags` silently ignores — the tag stays on your laptop and not one release workflow fires. They all print the annotated form now, and a test fails if any of them drifts back.
