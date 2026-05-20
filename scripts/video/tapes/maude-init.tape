# Real terminal capture — `maude init --dry-run` in a scratch dir.
# Used by the Final composition in scripts/video/final/.
#
# Canvas sized 1280x720 (not 1920x1080) so the output fills the frame
# instead of leaving 60% empty bg. Remotion <OffthreadVideo> scales it
# back up via objectFit inside the scene.
#
# Hide/Show brackets the recording-setup `cd` so the viewer only sees the
# real maude command + its output. Without Hide, the cd /tmp/... leaks.

Output scripts/video/final/public/scene-terminal.mp4

Set FontSize 22
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 40
Set TypingSpeed 30ms

Hide
Type "cd /tmp/maude-vhs-recording" Enter
Sleep 200ms
Type "clear" Enter
Sleep 200ms
Show

# Run the demo command — this is what the viewer sees
Type "maude init --name demo --dry-run"
Sleep 600ms
Enter
Sleep 4s
