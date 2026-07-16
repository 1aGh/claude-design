#!/usr/bin/env bash
# gemma4.sh — Gemma 4 (E2B/E4B) local MLX contestant.
# Native audio + vision, but the JOINT video+audio call is broken in mlx-vlm
# (audio token silently dropped), so we run TWO passes and concatenate:
#   pass 1: --video clip.mp4 --fps 1   (visual understanding, native video sampling)
#   pass 2: --audio audio.wav          (native audio understanding)
#
# Usage: gemma4.sh <video> <inputs_dir> <out.md>
# Env:   MODEL (default mlx-community/gemma-4-e2b-it-4bit), MAX_TOKENS
set -uo pipefail

VIDEO="$1"; INPUTS="$2"; OUT="$3"
MODEL="${MODEL:-mlx-community/gemma-4-e2b-it-4bit}"
MAX_TOKENS="${MAX_TOKENS:-800}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$SELF_DIR/../lib/task-prompt.txt"
GEN=(python -m mlx_vlm.generate --model "$MODEL" --max-tokens "$MAX_TOKENS"
     --temperature 1.0)

VISUAL_TASK="$(cat "$PROMPT_FILE")
INPUT NOTE: this pass sees the VIDEO only. Still lead with the TLDR line. In the AUDIO section, write 'analyzed in a separate audio pass' — the audio is handled separately."
AUDIO_TASK="Listen to this audio track from a video clip. Describe in detail: any speech (transcribe the gist + name the language), music, ambience, and notable sound events with rough timing. If silent or unclear, say so."

{
  echo "# Gemma 4 — $MODEL"
  echo
  echo "## Pass 1 — VISUAL (native video, fps=${FPS:-2})"
  echo '```'
  "${GEN[@]}" --video "$VIDEO" --fps "${FPS:-2}" --prompt "$VISUAL_TASK" 2>&1 || echo "(exit $?)"
  echo '```'
  echo
  echo "## Pass 2 — AUDIO (native audio)"
  echo '```'
  if [ -f "$INPUTS/audio.wav" ]; then
    "${GEN[@]}" --audio "$INPUTS/audio.wav" --prompt "$AUDIO_TASK" 2>&1 || echo "(exit $?)"
  else
    echo "(no audio track)"
  fi
  echo '```'
} > "$OUT"
