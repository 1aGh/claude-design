---
"@1agh/maude": minor
---

Publish, Get-latest, and "Add to Shared version" now work on SSH remotes and open a pull request on protected branches, plus a proactive "Get latest" nudge in the dock.

- **SSH remotes work.** Publishing, getting the latest, and adding a draft to the Shared version over an `ssh://` / `git@github.com:…` remote no longer fail with `unrecognized transport protocol: "ssh"`. The write paths now route SSH remotes through the system `git` binary (using your own key), matching how Refresh already worked — a plain file/local remote is handled too, and a non-github or command-executing remote is refused.
- **"Add to Shared version" opens a pull request.** On a GitHub project, adding a draft to the Shared version pushes your draft branch and opens a pull request into `main` — the merge happens on GitHub after review, so it works even when `main` is protected and a direct push would be rejected. The pull-request link is shown right in the dialog (opens in your browser, or copies to the clipboard as a fallback). A local-only project still merges directly. If Publish hits a protected branch, the message now points you at the pull-request flow instead of showing a raw git error.
- **Proactive "Get latest" nudge.** When a teammate publishes and the shared version moves ahead, a blue "Get latest — N new on main" button now appears in the bottom dock (not just buried in the Changes panel), so you're told to pull without hunting for it. Clicking it gets the latest; a content conflict opens the visual resolver.
