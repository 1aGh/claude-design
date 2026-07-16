#!/usr/bin/env bash
# qwen3-omni.sh — Qwen3-Omni local MLX contestant. The genuine native audio+video
# omni model (Thinker/Talker + audio encoder). Attempts a JOINT video+audio call.
# It's a large MoE — may OOM on a 16GB Mac; the harness records the failure and
# moves on. Use the smallest available checkpoint.
#
# Usage: qwen3-omni.sh <video> <inputs_dir> <out.md>
# Env:   MODEL (default mlx-community/Qwen3-Omni-30B-A3B-Instruct-4bit), MAX_TOKENS
set -uo pipefail

VIDEO="$1"; INPUTS="$2"; OUT="$3"
MODEL="${MODEL:-mlx-community/Qwen3-Omni-30B-A3B-Instruct-4bit}"
MAX_TOKENS="${MAX_TOKENS:-600}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SELF_DIR/../lib/task-prompt.txt"
TASK="$(cat "$PROMPT_FILE")"

AUDIO_ARG=()
[ -f "$INPUTS/audio.wav" ] && AUDIO_ARG=(--audio "$INPUTS/audio.wav")

{
  echo "# $MODEL (native audio+video)"
  echo
  echo '```'
  python -m mlx_vlm.generate --model "$MODEL" --max-tokens "$MAX_TOKENS" \
    --video "$VIDEO" --fps 1 "${AUDIO_ARG[@]}" --prompt "$TASK" 2>&1 || echo "(exit $?)"
  echo '```'
} > "$OUT"
