#!/usr/bin/env bash
# prep-inputs.sh — derive the shared inputs every contestant needs from one clip.
#
#   <inputs_dir>/
#     frames/frame_0000.png ...   # N evenly-spaced keyframes (own-pipeline input)
#     audio.wav                    # 16kHz mono PCM (MLX audio pass + whisper input)
#     transcript.txt               # whisper.cpp transcript (own-pipeline input)
#     transcript.srt               # timestamped
#     meta.json                    # duration, resolution, fps, frame count, has_audio
#
# Usage: prep-inputs.sh <video> <inputs_dir> [frame_count]
#
# whisper is only a step of the OWN pipeline, but the .wav is reused by the MLX
# audio pass too (MLX can't read an mp4 container directly — bug confirmed).
set -euo pipefail

VIDEO="$1"; DIR="$2"; FRAMES="${3:-0}"
WHISPER_MODEL="${MAUDE_WHISPER_MODEL:-$HOME/.cache/whisper-models/ggml-base.bin}"

mkdir -p "$DIR/frames"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
RES=$(ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=p=0:s=x "$VIDEO")
HAS_AUDIO=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$VIDEO" | head -1)

# frame count: default BENCH_FPS (2) × duration, floor 6, cap 24 — unless given
if [ "$FRAMES" -eq 0 ]; then
  FRAMES=$(awk -v d="$DUR" -v f="${BENCH_FPS:-2}" 'BEGIN{n=int(d*f+0.5); if(n<6)n=6; if(n>24)n=24; print n}')
fi

echo "prep: $VIDEO  dur=${DUR}s res=$RES audio=${HAS_AUDIO:-none} frames=$FRAMES"

# --- evenly-spaced keyframes at EXACT timestamps, INCLUDING t=0 and t=end ---
# ffmpeg's fps filter does NOT guarantee the first frame — a sub-interval opening
# shot (e.g. a <0.2s game-action flash before an interview) gets skipped. Seeking
# each timestamp explicitly, endpoints inclusive, guarantees the opening AND closing
# beats are always represented.
i=1
for k in $(seq 0 $((FRAMES-1))); do
  t=$(awk -v k="$k" -v n="$FRAMES" -v d="$DUR" 'BEGIN{ if(n<=1){print 0} else {printf "%.3f", k*(d-0.04)/(n-1)} }')
  printf -v idx "%04d" "$i"
  ffmpeg -y -v error -ss "$t" -i "$VIDEO" -frames:v 1 "$DIR/frames/frame_${idx}.png" 2>/dev/null || true
  i=$((i+1))
done
NFRAMES=$(ls "$DIR/frames"/*.png 2>/dev/null | wc -l | tr -d ' ')

# --- 16kHz mono wav (MLX audio pass + whisper) ---
if [ -n "${HAS_AUDIO:-}" ]; then
  ffmpeg -y -v error -i "$VIDEO" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$DIR/audio.wav"

  # --- whisper transcript (own-pipeline audio input) ---
  if [ -f "$WHISPER_MODEL" ] && command -v whisper-cli >/dev/null 2>&1; then
    whisper-cli -m "$WHISPER_MODEL" -f "$DIR/audio.wav" -otxt -osrt \
      -of "$DIR/transcript" 2>/dev/null || true
    [ -f "$DIR/transcript.txt" ] || echo "(whisper produced no transcript)" > "$DIR/transcript.txt"
  else
    echo "(whisper model not found at $WHISPER_MODEL — no transcript)" > "$DIR/transcript.txt"
  fi
else
  echo "(clip has no audio track)" > "$DIR/transcript.txt"
fi

cat > "$DIR/meta.json" <<JSON
{ "video": "$VIDEO", "duration_sec": $DUR, "resolution": "$RES",
  "has_audio": $([ -n "${HAS_AUDIO:-}" ] && echo true || echo false),
  "frame_count": $NFRAMES, "whisper_model": "$WHISPER_MODEL" }
JSON

echo "prep done: $NFRAMES frames, transcript $([ -s "$DIR/transcript.txt" ] && echo ok)"
