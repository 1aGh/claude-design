---
'@1agh/maude': minor
---

ACP chat: writes are scoped to the project, and chats survive reloads and project switches.

**The assistant now asks before writing outside your project.** Editing anything inside the project is unchanged — no prompt, exactly as before. A write to somewhere else (a shell profile, a launch agent, another repo) now shows a permission card naming the *resolved* absolute path, and that consent is per-call: there is no "always allow" on that path.

Being inside the project is necessary for the no-prompt path, but not sufficient. A handful of in-project files run code later without the assistant touching them again — `.git/` (a hook or a `core.*` config key), `.claude/`, `CLAUDE.md`, `.mcp.json`, `.envrc`, `.vscode/`, `.github/workflows/`, `node_modules/`, `package.json` and lockfiles — so those ask too, with a card that says the file is part of how the project *runs*.

As part of this, the read-only shell verbs (`ls`, `cat`, `head`, `tail`, `wc`, `tree`, `file`, `stat`, `pwd`) no longer run without asking: a permission rule matches the command name and cannot see what follows it, so `cat > ~/.zshenv` was an unrestricted write. `Read`, `Grep` and `Glob` are unaffected, so reading files is as frictionless as it was.

**A chat is no longer tied to its browser tab.** Reloading the page, switching branches, or switching projects used to kill a running turn silently. The agent now keeps working and the panel re-attaches to it, joining the live stream to the history it already has without repeating or dropping output. Switching to another project leaves the first one's chats running; switching back lands in the same conversation. Quitting the app still stops everything.

Switching branches while a chat is mid-turn now warns first — a checkout moves files under an agent that is actively editing them, and version history cannot undo a cross-branch mix-up.

This does not mean an ACP session can never write outside your project: `maude design <verb>` commands still run without prompting and can reach further. See the feature's decision record for the full, honest scope.
