---
"@1agh/maude": minor
---

`flow:scenario` now reads a repo-owned `.ai/scenario-guide.md` (path configurable via `paths.scenarioGuide`) for project-specific overrides — device/platform lifecycle, selector conventions, infra-error classification, platform gotchas — mirroring how `/flow:release` already reads `.ai/release-guide.md`. Projects no longer need to hand-author a `.claude/skills/scenario/` wrapper skill for this; `maude init` now scaffolds the guide template. The base protocol also gained four upstreamed defaults: testID-first locator preference, an advisory-only vision selector tier, an `infra-error` result state distinct from `fail` (never a blocker, now tracked via a new `infra_errors` field in `scenario-runner`'s output), and a collaborative step-by-step scenario-authoring loop.
