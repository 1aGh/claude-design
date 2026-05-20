---
"@1agh/maude": minor
---

flow: Add security review subagents — defender (`security-auditor`) for OWASP-class static scans + attacker (`ethical-hacker`) for adversarial threat modeling including AI/MCP attack surface (prompt injection, MCP tool poisoning, confused-deputy, the trifecta). New skill `security-rules` (67 hard-stops across classic + AI-era), new command `/flow:validate-security`, and hooks into `/flow:validate` (step 6.5), `/flow:review-code`, `/flow:done`. New config: top-level `security.{severityFloor,scope,includeAi}` + `skills.securityRules.enabled` (defaults sane; downstream projects get it for free via `mdcc init`).
