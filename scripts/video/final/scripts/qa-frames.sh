#!/usr/bin/env bash
# Visual QA frame-grid for a rendered Remotion composition.
#
# Workflow:
#   1. Render the composition (if MP4 missing or older than 24h, or --render forced).
#   2. Extract N evenly-spaced JPG frames at half resolution into __qa__/<comp>/.
#   3. Produce a 4×3 contact sheet PNG for human eyeballing.
#   4. Print the JPG paths so an agent (Claude) can batch-Read them.
#
# Why this exists:
#   The Final composition assembles real VHS terminal capture + Playwright browser
#   capture + Remotion cards into one MP4. Each capture has its own subtle
#   issues (VHS setup commands leaking, browser viewport mismatch, etc) that
#   only show up in the assembled output. Per-scene goldens cannot catch these
#   because the captures are external inputs that change. This script is the
#   integration-smoke layer: render, sample, eyeball.
#
# Usage:
#   bash scripts/qa-frames.sh                       # default: Final composition, 12 frames
#   bash scripts/qa-frames.sh Demo                  # different composition
#   bash scripts/qa-frames.sh Final 20              # more frames
#   bash scripts/qa-frames.sh Final 12 --render     # force re-render even if MP4 exists
#
# Output paths printed to stdout in a stable, agent-friendly format:
#   QA_FRAME __qa__/Final/t01.jpg
#   QA_FRAME __qa__/Final/t02.jpg
#   ...
#   QA_CONTACT_SHEET __qa__/Final/contact-sheet.png

set -euo pipefail

cd "$(dirname "$0")/.."

COMP="${1:-Final}"
NFRAMES="${2:-12}"
FORCE_RENDER=0
for arg in "$@"; do
  case "$arg" in
    --render) FORCE_RENDER=1 ;;
  esac
done

OUT_MP4="out/${COMP}.mp4"
QA_DIR="__qa__/${COMP}"

mkdir -p "${QA_DIR}"

# 1. Render if MP4 missing or forced
if [ "$FORCE_RENDER" = "1" ] || [ ! -f "$OUT_MP4" ]; then
  echo "→ rendering ${COMP} (force=${FORCE_RENDER})"
  pnpm exec remotion render src/index.ts "${COMP}" "${OUT_MP4}" >/dev/null
fi

# 2. Probe duration so frame extraction is even
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT_MP4")
echo "→ ${COMP}: duration ${DURATION}s, extracting ${NFRAMES} frames"

# Clear previous extraction
find "${QA_DIR}" -maxdepth 1 -name "*.jpg" -delete
rm -f "${QA_DIR}/contact-sheet.png"

# 3. Extract N evenly-spaced JPGs at half resolution (960×540)
FPS=$(echo "scale=6; ${NFRAMES} / ${DURATION}" | bc -l)
ffmpeg -y -loglevel error -i "$OUT_MP4" \
  -vf "fps=${FPS},scale=960:540" \
  -frames:v "${NFRAMES}" \
  "${QA_DIR}/t%02d.jpg"

# 4. Contact sheet — 4 cols × ceil(N/4) rows
COLS=4
ROWS=$(( (NFRAMES + COLS - 1) / COLS ))
ffmpeg -y -loglevel error -i "${QA_DIR}/t%02d.jpg" \
  -filter_complex "tile=${COLS}x${ROWS}:padding=8:color=black" \
  "${QA_DIR}/contact-sheet.png"

# 5. Print agent-friendly paths
echo ""
echo "→ ${NFRAMES} frames + contact sheet ready:"
for f in "${QA_DIR}"/t*.jpg; do
  echo "QA_FRAME ${f}"
done
echo "QA_CONTACT_SHEET ${QA_DIR}/contact-sheet.png"
echo ""
echo "Agent: read each QA_FRAME via Read tool; check intro / capture scenes / outro / transitions for layout glitches."
echo "Human: open ${QA_DIR}/contact-sheet.png to eyeball all frames in one image."
