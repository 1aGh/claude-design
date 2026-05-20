# Scene "tui-edit": real /design:edit theater capture.
# Pairs with playwright/10b-canvas-edit.spec.ts.
#
# The actual /design:edit runs in a separate (non-VHS) claude subprocess
# kicked off before recording — claude inside VHS would die at tape end
# (~60–120 s) and abort the edit. VHS captures the slash command + initial
# spinner; the real file modification lands during the Playwright capture.

Output scripts/video/final/public/scene-tui-edit.mp4

Set FontSize 22
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 40
Set TypingSpeed 30ms

Hide
Type "cd /tmp/scratch-maude-demo-20260520" Enter
Sleep 200ms
Type "clear" Enter
Sleep 200ms
Show

Type "claude"
Sleep 300ms
Enter
Sleep 4s

Type `/design:edit "tighten the hero, drop one row from the metadata block"`
Sleep 800ms
Enter
Sleep 30s
