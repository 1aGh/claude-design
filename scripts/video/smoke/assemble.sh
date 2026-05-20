#!/usr/bin/env bash
# assemble.sh — normalize the three smoke MP4s to a common spec
# (h264 / 1280x720 / 30 fps / yuv420p / no audio) and concat into smoke.mp4.
#
# Lossless `-c copy` concat requires byte-identical codec/resolution/fps across
# inputs. VHS outputs 25 fps and Remotion adds a silent AAC track, so we
# pre-normalize each input. Concat itself is then `-c copy` (fast, lossless).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
W="$REPO_ROOT/scripts/video/.work/smoke"
N="$W/normalized"
mkdir -p "$N"

normalize() {
  local IN="$1"
  local OUT="$2"
  ffmpeg -y -i "$IN" \
    -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,fps=30" \
    -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
    -an \
    "$OUT" 2>/dev/null
}

for stage in terminal browser card; do
  if [ ! -f "$W/$stage.mp4" ]; then
    echo "assemble.sh: missing $W/$stage.mp4 — run the per-tool smoke first" >&2
    exit 1
  fi
  normalize "$W/$stage.mp4" "$N/$stage.mp4"
done

# Concat list (paths absolute so ffmpeg `-safe 0` is happy regardless of cwd).
printf "file '%s/terminal.mp4'\nfile '%s/browser.mp4'\nfile '%s/card.mp4'\n" \
  "$N" "$N" "$N" > "$W/concat.txt"

ffmpeg -y -f concat -safe 0 -i "$W/concat.txt" -c copy "$W/smoke.mp4" 2>/dev/null
echo "✅ Toolchain green — $W/smoke.mp4"
