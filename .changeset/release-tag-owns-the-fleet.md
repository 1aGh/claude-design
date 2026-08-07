---
'@1agh/maude': patch
---

Follow-ups to the v0.58.0 release-pipeline work, found by running it for real.

**A push to `main` now touches nothing in the cloud fleet.** v0.58.0 made cell image builds tag-only but kept the branch run's Worker deploy, on the reasoning that the Worker is not the image. It is not that simple: the config *names* the container image, so deploying the Worker reconciles the container too — and on the release commit, which points at an image only the tag run builds, that failed after the Worker had already been uploaded. A branch push now runs the data-plane tests and stops.

**The post-deploy check reads the right field.** It looked for the served-bundle hash one level too deep in the health payload, so it could only ever time out — and it passed review because its own test fixture was written to the same wrong shape. The shape is now asserted where the payload is produced, not just mirrored in the test.

**A cell stops reporting its version as `0.0.0`.** The hub's manifest was never copied into the image, so the version lookup always failed quietly. It is staged now, and `/health` reports the real release on both fields.
