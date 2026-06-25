---
"@1agh/maude": minor
---

Make the bookend debate layer **opt-out** (on by default) and document it on the docs site. An absent `orchestration` block in `.ai/workflows.config.json` is now treated as `mode:auto`, and `designTeam.enabled` defaults to `true` — so the debate engages everywhere out of the box: a cheap read-only `reduce` panel on any install, and the live native-agent-team `relay` debate the moment `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is enabled. You add the `orchestration` block only to dial it **down** (`mode:reduce`) or **off** (`mode:off`); nothing to configure to turn it on.

No premium cost is imposed on installs that never enabled the experimental agent-teams flag — without it, `auto` degrades to the reduce panel. New docs page: **Multi-agent debate** (`/docs/orchestration`) covering the bookend model, the two tiers, the opt-out config, the cast, and the injection/trifecta security posture.
