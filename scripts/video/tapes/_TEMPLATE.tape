# VHS tape template for phase-15.5-style terminal scenes.
# Copy this file, rename, fill in the typed commands.
#
# CONVENTIONS (load-bearing, debug-discovered the hard way 2026-05-20):
#
# 1. Canvas dimensions = 1280×720. Do NOT use 1920×1080 — terminal output
#    rarely fills more than 60% width / 25% height of 1080p, leaving huge
#    empty bg. Remotion <OffthreadVideo> upscales 1280×720 cleanly via
#    objectFit inside scene wrappers.
#
# 2. Hiding setup commands needs `Type "clear" Enter` BEFORE `Show`. VHS's
#    `Hide`/`Show` controls FRAME CAPTURE, not the shell buffer — the terminal
#    still holds whatever was typed during Hide, and `Show` captures from that
#    state. Without `clear`, the supposedly-hidden cd/setup lines leak.
#
# 3. Output path is relative to repo root (VHS rejects absolute paths).
#    Conventionally write to scripts/video/final/public/scene-<id>.mp4 so the
#    Final composition can pick it up via staticFile().
#
# 4. VHS emits 25fps for MP4 regardless of `Set Framerate` (known limitation).
#    Don't fight it — Remotion <OffthreadVideo> resamples on ingest. The 30fps
#    Final composition pulls frames as needed.
#
# 5. FontSize 22 is the sweet spot at 1280×720 — fits ~80 cols × ~30 rows of
#    real content. Smaller fonts blur on streaming compression; bigger fonts
#    truncate long output.

Output scripts/video/final/public/scene-CHANGE-ME.mp4

Set FontSize 22
Set Width 1280
Set Height 720
Set Theme "Dracula"
Set Padding 40
Set TypingSpeed 30ms

# --- Setup block (HIDDEN from capture) ---
# Use this to cd into the scratch dir, set env vars, prep state.
# The trailing `clear` is MANDATORY — without it the typed-but-hidden
# commands leak into the captured frames.

Hide
Type "cd /tmp/CHANGE-ME-recording" Enter
Sleep 200ms
Type "clear" Enter
Sleep 200ms
Show

# --- Demo block (captured) ---
# This is what the viewer actually sees. Keep it short — 1-2 commands max
# per tape. If a flow needs many commands, split into multiple tapes and
# stitch in Remotion.

Type "echo 'replace this with your demo command'"
Sleep 600ms
Enter
Sleep 3s
