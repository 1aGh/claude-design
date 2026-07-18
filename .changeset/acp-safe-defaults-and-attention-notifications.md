---
"@1agh/maude": minor
---

The ACP chat panel now auto-approves the actions that dominated real design-workflow friction — `agent-browser` calls (via a new hardened `agent-browser-safe` wrapper), checking your own localhost dev servers (via a new `maude design curl-local` verb, loopback-only with DNS-rebinding protection), read-only filesystem inspection (`ls`/`cat`/`pwd`/`head`/`tail`/`wc`/`tree`/`file`/`stat`), and `WebSearch`/`WebFetch` — without widening the session's raw Bash surface. Also: Maude now fires a system notification whenever a chat is waiting on your approval or an answer (not just when a turn finishes), so a stalled session doesn't go unnoticed when the window isn't focused.
