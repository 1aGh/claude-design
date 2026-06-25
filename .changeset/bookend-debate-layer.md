---
"@1agh/maude": minor
---

Add an opt-in, capability-gated multi-agent **bookend debate layer** to the flow + design plugins (DDR-130). Debate fires at the loop's bookends — divergent at the start (`/flow:plan`, `/flow:setup-prd`, `/design:setup-ds`), adversarial at the end (`/flow:validate-security`, `/design:critic`), plus a research shape (`/flow:bug-rca`, `ux-research`); the middle (`execute`) stays solo.

Two tiers, auto-selected and degrading cleanly: a **reduce-pass floor** ships to every user with the experimental flag off — `/design:critic` now reconciles conflicting cross-discipline blockers into one ordered list instead of summing independent verdicts — and a native **agent-teams relay tier** (when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled) adds live stance revision. New `orchestration.*` config block (`mode` defaults to `auto`, degrades to today's behavior when teams are off — nothing to configure downstream). Five new project-agnostic debate seats (`builder`, `shipper`, `breaker`, `user-advocate`, `investigator`) and a shared `flow:debate-protocol` skill. This release ships the pilot (floor + `/flow:validate-security` proving ground); the broad `mode:auto` rollout is gated on an n=8 security eval.
