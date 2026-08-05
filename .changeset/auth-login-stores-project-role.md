---
'@1agh/maude': patch
---

Cloud: signing in through the desktop/API door now yields a session that can actually write.

`/auth/login` (the token-exchange door the desktop app and API clients use) minted sessions with only the one-bit read-only projection of the member's role — never the role itself. The hub deliberately treats a role-less session as no session at all, so every HTTP write from such a session answered 401 "sign in to open this project" while reads and live cursors kept flowing — the same wall stale pre-v0.55.0 browser sessions hit. The door now stores the translated project role at mint, exactly as the browser sign-in door does, and a guard test holds both doors to the same contract.
