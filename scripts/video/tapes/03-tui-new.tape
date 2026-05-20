# Scene "tui-new": real /design:new --quick in the scratch sandbox.
# Pairs with playwright/06b-canvas-appears.spec.ts to form a split-screen
# composite (VHS terminal on left, dev-server iframe on right).
#
# Plan task 9: "wait ~60 s for completion (the tape's Sleep covers this)".
# Bumped to 180 s — real --quick with frontend-design + 1 critic + 2 fix
# iterations takes 60-150 s in practice. The tape captures the full arc;
# Remotion clips the relevant window via playbackRate + endAt.

Output scripts/video/final/public/scene-tui-new.mp4

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

Type `/design:new "Recipe Recap" "Multi-artboard hero + portion scaler + ingredient list + cookbook print preview" --quick`
Sleep 800ms
Enter
Sleep 180s
