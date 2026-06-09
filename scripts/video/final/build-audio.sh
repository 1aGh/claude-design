#!/usr/bin/env bash
# Mix V5 audio (VO + SFX + music bed) and mux onto the rendered video.
# Re-run after dropping in vo-90.mp3 and/or a real music bed (set BED=).
# VO start times are frame-aligned to each beat (see _audio-prompts.md).
set -euo pipefail
cd "$(dirname "$0")"

V=out/v5/V5.mp4
A=public/v5/audio
VO="$A/vo/_trim"          # trimmed VO
SFX="$A/sfx"
BED="${BED:-$A/music/bed.mp3}"   # override: BED=path/to/track.mp3 ./build-audio.sh
OUT="${OUT:-out/v5/V5-audio.mp4}"
BEDVOL="${BEDVOL:-0.16}"

# inputs: 0=video, 1=bed, 2..=vo, then sfx
args=(-i "$V" -i "$BED")
fc="[1:a]afade=t=in:st=0:d=3,afade=t=out:st=100:d=5,volume=${BEDVOL}[b];"
mixlabels="[b]"

add_a () { # file delay_ms volume
  local idx=${#args[@]}; idx=$((idx/2))   # rough; recompute below
  return 0
}

# Build explicit input list + filter. Keep order deterministic.
# VO: file:delay_ms
vo_list=(
  "vo-00:400" "vo-10:5700" "vo-20:14070" "vo-40:23070" "vo-50:30000"
  "vo-60:36970" "vo-65:47570" "vo-70:55070" "vo-80:63030" "vo-90:68930"
  "vo-92:76330" "vo-94:84600" "vo-96:88800" "vo-99:98530"
)
# SFX: file:delay_ms:volume
sfx_list=(
  "power-on:300:0.30" "scan-sweep:6000:0.28" "vortex:20300:0.30"
  "success:34500:0.30" "connect:48000:0.28" "draw-stroke:56500:0.30"
  "boot-playful:63100:0.32" "type-clicks:70500:0.28" "success:94200:0.30"
)

i=2
for entry in "${vo_list[@]}"; do
  f="${entry%%:*}"; d="${entry##*:}"
  [ -f "$VO/$f.mp3" ] || { echo "skip missing $f"; continue; }
  args+=(-i "$VO/$f.mp3")
  fc+="[${i}:a]adelay=${d}:all=1,volume=1.0[v${i}];"
  mixlabels+="[v${i}]"
  i=$((i+1))
done
for entry in "${sfx_list[@]}"; do
  f="$(echo "$entry" | cut -d: -f1)"; d="$(echo "$entry" | cut -d: -f2)"; vol="$(echo "$entry" | cut -d: -f3)"
  [ -f "$SFX/$f.mp3" ] || { echo "skip missing sfx $f"; continue; }
  args+=(-i "$SFX/$f.mp3")
  fc+="[${i}:a]adelay=${d}:all=1,volume=${vol}[v${i}];"
  mixlabels+="[v${i}]"
  i=$((i+1))
done

n=$((i-1))   # number of audio streams mixed
fc+="${mixlabels}amix=inputs=${n}:normalize=0:dropout_transition=0[mx];"
fc+="[mx]alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=11[outa]"

echo "→ mixing ${n} audio streams onto ${V} → ${OUT}"
ffmpeg -y "${args[@]}" -filter_complex "$fc" \
  -map 0:v -map "[outa]" -c:v copy -c:a aac -b:a 256k -shortest "$OUT" -loglevel error
echo "✓ $OUT"
ls -la "$OUT"
