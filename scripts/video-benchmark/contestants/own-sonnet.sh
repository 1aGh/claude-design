#!/usr/bin/env bash
# own-sonnet.sh — the "own solution" contestant. Algorithmic prep (ffmpeg keyframes
# + whisper transcript, already produced by prep-inputs.sh) → a frontier text model
# (Sonnet 5) reasons over them. Mirrors the real footage-analyst: Claude READS the
# keyframe PNGs + the transcript, no native video/audio model.
#
# Drives the local `claude` CLI in print mode (the user's subscription — no API
# key, no per-call billing surprise). Local CPU/RAM cost here is tiny (ffmpeg +
# whisper already done); the heavy compute is remote — that asymmetry IS the point.
#
# Usage: own-sonnet.sh <video> <inputs_dir> <out.md>
# Env:   MODEL (default sonnet)
set -uo pipefail

VIDEO="$1"; INPUTS="$2"; OUT="$3"
MODEL="${MODEL:-sonnet}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK="$(cat "$SELF_DIR/../lib/task-prompt.txt")"

FRAMES=("$INPUTS"/frames/*.png)
NFRAMES=${#FRAMES[@]}
TRANSCRIPT="$(cat "$INPUTS/transcript.txt" 2>/dev/null || echo '(none)')"
FRAME_LIST=$(printf '%s\n' "${FRAMES[@]/#/  - }")

PROMPT="$TASK

--- INPUTS ---
You are given $NFRAMES keyframes sampled at ~1 fps from a video clip, plus a
speech-to-text transcript of its audio track. READ each keyframe image below (use
the Read tool), then combine what you see across the frames (motion/continuity) with
the transcript to answer. Do NOT try to open the video file itself.

Keyframe images (in time order):
$FRAME_LIST

Audio transcript (whisper):
\"\"\"
$TRANSCRIPT
\"\"\"
"

RAW_FILE="$(mktemp)"
echo "$PROMPT" | claude -p --model "$MODEL" --allowedTools "Read" --output-format json > "$RAW_FILE" 2>&1

# Parse the JSON from a FILE (never interpolated into python source — the JSON's own
# quotes/apostrophes/newlines would corrupt it). Sonnet-via-claude-CLI carries the
# full Claude Code system prompt, so input tokens are inflated vs the MLX models —
# the cache_* + cost figures are the honest signal.
RAW_FILE="$RAW_FILE" OUT="$OUT" NFRAMES="$NFRAMES" MODEL="$MODEL" python3 <<'PY'
import json, os
raw = open(os.environ["RAW_FILE"]).read()
out, nframes, model = os.environ["OUT"], os.environ["NFRAMES"], os.environ["MODEL"]
try:
    d = json.loads(raw); text = d.get("result", raw); u = d.get("usage", {})
    inp = u.get("input_tokens", 0); outp = u.get("output_tokens", 0)
    cc = u.get("cache_creation_input_tokens", 0); cr = u.get("cache_read_input_tokens", 0)
    cost = d.get("total_cost_usd")
    tokline = (f"TOKENS prompt_in={inp} cache_creation={cc} cache_read={cr} "
               f"output={outp} total_in={inp+cc+cr} cost_usd={cost}")
except Exception as e:
    text = raw; tokline = f"TOKENS (parse failed: {e})"
with open(out, "w") as f:
    f.write(f"# Own pipeline — keyframes + whisper -> {model}\n\n")
    f.write(f"Inputs: {nframes} keyframes + whisper transcript. Model reads frames via Read tool.\n\n")
    f.write(tokline + "\n\n")
    f.write("```\n" + text.rstrip() + "\n```\n")
PY
rm -f "$RAW_FILE"
