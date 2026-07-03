---
"@1agh/maude": patch
---

Fix the ACP chat panel losing conversational memory across an app restart. Killing and reopening Maude (or a dev-server restart) now resumes the actual `claude` session instead of silently starting a fresh one while showing the old transcript — closing the DDR-125 "cross-restart resume" gap.
