Output scripts/video/.work/smoke/terminal.mp4

Set FontSize 16
Set Width 1280
Set Height 720
Set Framerate 30
Set Theme "Dracula"
Set Shell "zsh"

Type "node cli/bin/mdcc.mjs --help"
Sleep 500ms
Enter
Sleep 2s

Type "clear"
Sleep 200ms
Enter

Type "ls .ai | head -5"
Sleep 300ms
Enter
Sleep 1500ms
