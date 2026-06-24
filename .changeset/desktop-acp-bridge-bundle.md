---
"@1agh/maude": patch
---

Desktop: fix the AI chat panel showing "The Claude agent bridge is not installed in this build" in the packaged app (v0.31.0–v0.32.0). The desktop bundle now stages the ACP adapter's JS dependency closure (`@agentclientprotocol/claude-agent-acp` + its JS deps, ~11 MB) into its runtime, and the bridge pins the adapter to your own installed `claude` CLI via `CLAUDE_CODE_EXECUTABLE` — so chat runs on your Pro/Max subscription without shipping the ~210 MB native Claude binary. Adds a build-time gate that fails the desktop build if the adapter isn't staged, and an honest "Claude agent bridge" row in the readiness checklist. AI chat now works in the released `.app`, not only under `pnpm dev:desktop`.
