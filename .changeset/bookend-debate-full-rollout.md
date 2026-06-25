---
"@1agh/maude": minor
---

Wire the bookend debate layer (DDR-130) into **all** loop bookends, not just the security pilot. The opt-in multi-agent debate now fires across:

- **START / divergent** — `/flow:plan` (BUILDER/SHIPPER/BREAKER draft competing approaches before the plan is written), `/flow:setup-prd` (USER-ADVOCATE/SHIPPER contest product direction + MVP scope), `/design:setup-ds` (aesthetic direction).
- **END / adversarial** — `/flow:validate-security` (attacker↔defender), plus the `/design:critic` + `/design:new` panel merge now reconciles conflicting cross-discipline blockers into one ordered list (reduce-pass, every user) and escalates to a live design-team that revises stances when `orchestration.designTeam` is enabled.
- **RESEARCH** — `/flow:bug-rca` competes candidate root causes as falsifiable hypotheses, and `ux-research-agent` recommendations can be cross-checked.
- **Tripwire** — `/flow:quick` escalates a load-bearing check on changes that only look trivial.

Every wiring is a guarded branch: with `orchestration.mode:off` or the experimental agent-teams flag absent, behavior is byte-for-byte unchanged (plus the always-available reduce-pass). The reduce-vs-relay invariant holds — relay is native agent-teams only, never hand-rolled in markdown.
