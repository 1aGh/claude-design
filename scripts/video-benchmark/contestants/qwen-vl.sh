#!/usr/bin/env bash
# qwen-vl.sh — Qwen2.5-VL / Qwen3-VL local MLX contestant. VISION-ONLY (no audio).
#
# NOTE: mlx-vlm's NATIVE --video path is broken for Qwen2.5-VL-4bit (degenerates to
# junk / empty). The model is excellent on stills, so this contestant feeds the
# keyframes as MULTIPLE --image inputs. The 4bit build degenerates once the vision
# TOKEN count gets large (junk-loop at ~5k+, empty at ~9k+). Root cause is token
# count, not frame count: 720p frames are ~1200 tok each. Fix = DOWNSCALE each
# frame to IMG_WIDTH px (≈340 tok) so we can still feed MAX_IMAGES of them and stay
# coherent. Trade-off: fine text (jersey numbers) is harder to read at 512px.
# For full-res dense Qwen, use the 8-bit build or a Qwen3-VL checkpoint (follow-up).
#
# Usage: qwen-vl.sh <video> <inputs_dir> <out.md>
# Env:   MODEL, MAX_TOKENS, MAX_IMAGES (default 8), IMG_WIDTH (default 512),
#        REP_PENALTY (default 1.15)
set -uo pipefail

VIDEO="$1"; INPUTS="$2"; OUT="$3"
MODEL="${MODEL:-mlx-community/Qwen2.5-VL-7B-Instruct-4bit}"
MAX_TOKENS="${MAX_TOKENS:-700}"
MAX_IMAGES="${MAX_IMAGES:-8}"
IMG_WIDTH="${IMG_WIDTH:-512}"
REP_PENALTY="${REP_PENALTY:-1.15}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SELF_DIR/../lib/task-prompt.txt"

ALL=("$INPUTS"/frames/*.png)
TOTAL=${#ALL[@]}
# evenly sub-sample down to MAX_IMAGES, then downscale each to IMG_WIDTH px
SMALL_DIR="$INPUTS/qwen-small"; mkdir -p "$SMALL_DIR"
FRAMES=()
for i in $(seq 0 $((MAX_IMAGES-1))); do
  if [ "$TOTAL" -le "$MAX_IMAGES" ]; then idx=$i; [ "$idx" -ge "$TOTAL" ] && break
  else idx=$(awk -v i="$i" -v n="$MAX_IMAGES" -v t="$TOTAL" 'BEGIN{printf "%d", i*(t-1)/(n-1)}'); fi
  src="${ALL[$idx]}"; dst="$SMALL_DIR/$(printf 'q_%02d.png' "$i")"
  ffmpeg -y -v error -i "$src" -vf "scale=${IMG_WIDTH}:-1" "$dst" && FRAMES+=("$dst")
done
NF=${#FRAMES[@]}

TASK="$(cat "$PROMPT_FILE")
INPUT NOTE: you are given $NF keyframes sampled in time order from the clip (you cannot hear audio). Treat them as a time sequence — reason about what changes between them. For the AUDIO section, state that you have no audio access. Use frame index → approximate MM:SS where helpful."

{
  echo "# $MODEL (vision-only, $NF of $TOTAL keyframes @ ${IMG_WIDTH}px — 4bit token cap)"
  echo
  echo '```'
  python -m mlx_vlm.generate --model "$MODEL" --max-tokens "$MAX_TOKENS" \
    --repetition-penalty "$REP_PENALTY" \
    --image "${FRAMES[@]}" --prompt "$TASK" 2>&1 || echo "(exit $?)"
  echo '```'
} > "$OUT"
