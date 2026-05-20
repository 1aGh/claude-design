# Scene 03: TUI dry-run of /design:setup-ds.
# Viewer sees: real claude TUI booting in the scratch dir → user types the
# slash command + brief → Enter → Stage 1 first prose prompt starts to
# render. Tape ends BEFORE any answer is given.
#
# Plan task 7: "Wait 6 s for Stage 1 first prose prompt to render. Tape
# ends (no completion)."
#
# Why dry-run: full /design:setup-ds discovery is genuinely 2.5–4 h of
# compute and the resulting DS is not used (the scratch DS is the one
# copied from this repo's .design/system/project/ in Task 3). The marketing
# beat is "real onboarding exists" — the existence of the question + the
# Claude TUI rendering it is enough.

Output scripts/video/final/public/scene-tui-setup-ds-dryrun.mp4

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

Type `/design:setup-ds project "Recipe manager kde nastavis pocet porci a on prepocita ingredience. Pro me a 3 kamarady. Vibe: 80s cookbook, Berkeley-mono everywhere, hard-edges + amber-rust stamp accent."`
Sleep 800ms
Enter
Sleep 30s
