---
'@1agh/maude': minor
---

Cloud: signing in from the desktop app actually opens your browser, and "Open in Maude" now says what it is about to connect.

**Sign-in no longer dead-ends.** In the desktop app the button that was supposed to open your dashboard did nothing at all — WKWebView drops `window.open` silently — while the dialog claimed a browser had opened. You were left holding a short code with nowhere to type it. The app now reaches the OS browser through a narrow, host-locked command, the dialog says what to do rather than what supposedly already happened, and the activation address is always shown as something you can click or copy. That address already carries the code, so confirming is one click. The same fix covers the two other buttons on that path — "View in the browser" and "Open the dashboard" — which were equally inert in the app.

**"Open in Maude" is now a decision, not a one-line strip.** The old prompt asked "Connect this project to X?" without ever saying which project "this" was — the one thing the answer depends on. It now names both sides, states in one sentence what syncs (this folder's `.design/` canvases, and nothing else in the repo), and checks whether the folder you have open actually looks like the workspace the link names. If it doesn't, connecting is demoted behind an explicit "Connect anyway" with an explanation and a way out. Only an exact match, or a folder already signed in to that workspace, passes without comment — a name that merely resembles yours is called out, because a project name is something anyone can choose. Declining stays free: the dashboard mints a fresh link whenever you press the button again.

Everything that made the old flow safe is unchanged: a link is parked and asked about rather than acted on, a second link never replaces the one you are reading, the code is only ever exchanged against the address the app is configured for, and a link that names one project but opens another is still refused outright.
