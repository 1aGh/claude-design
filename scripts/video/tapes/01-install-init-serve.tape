# Scene 02: install + init + serve.
# Three commands chained — `bun add -g @1agh/maude` (npm/cli#4828 → bun-add),
# `maude init --name recipe-recap`, `maude design serve --port 4400`.
#
# In the Final composition this clip is shown ~7s (storyboard "install" slot).
# Raw tape runs ~25–35s; Remotion `playbackRate` / `endAt` clip it.
#
# Pre-flight: kill any process on 4400 before invoking (the scratch dev-server
# from Task 4 binds 4400 — caller is responsible for restoring it after).

Output scripts/video/final/public/scene-install-init-serve.mp4

Set FontSize 22
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 40
Set TypingSpeed 30ms

Hide
Type "cd /tmp/vhs-install-demo" Enter
Sleep 200ms
Type "clear" Enter
Sleep 200ms
Show

# 1. install — bun-add per memory rule (npm/cli#4828: npm i -g claude can
#    leave broken native bindings on macOS arm64; bun-add avoids the issue).
Type "bun add -g @1agh/maude"
Sleep 500ms
Enter
Sleep 12s

# 2. init scratch workspace
#    NB(v2.1): the third intended command — `maude design serve --port 4400`
#    — is omitted. v0.16.0 has a packaging bug (postinstall side-channel
#    not written under `bun add -g`, and fallback path imports
#    `magic-string` which only lives in the dev-server workspace devDeps).
#    The viewer's mental model "install → init → see canvas appear" is
#    preserved in Final.tsx by the xfade straight into the DS-reveal scene.
Type "maude init --name recipe-recap"
Sleep 500ms
Enter
Sleep 6s
