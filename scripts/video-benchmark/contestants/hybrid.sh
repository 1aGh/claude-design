#!/usr/bin/env bash
# hybrid.sh — scene-AWARE frame selection + Sonnet. The "understand the dynamics"
# pipeline: instead of blind frame-rate screenshots, find the moments that carry
# meaning, extract only those, and let Sonnet analyze that tight, context-rich set.
#
# Two signals decide WHERE to screenshot:
#   1) ffmpeg scene detection  — precise shot-boundary cuts (where the picture
#      genuinely changes).
#   2) Gemma semantic scout    — watches the video natively and flags action beats
#      that are NOT hard cuts (a snap, a run, a reveal within one continuous shot).
# Merge (+ always the true first & last frame), dedup, extract exact frames, and
# hand them to Sonnet WITH their real timestamps (so its shot times are accurate,
# not hallucinated). Fewer, smarter frames → fewer Sonnet Read turns → cheaper AND
# sharper than 16 evenly-spaced blind frames. Audio: unchanged (whisper, like the rest).
#
# Usage: hybrid.sh <video> <inputs_dir> <out.md>
# Env: SCENE_THRESH (0.3), SCOUT_FPS (4), MAX_SHOTS (12),
#      GEMMA_MODEL (gemma-4-e4b-it-4bit), SONNET_MODEL (sonnet)
set -uo pipefail

VIDEO="$1"; INPUTS="$2"; OUT="$3"
SCENE_THRESH="${SCENE_THRESH:-0.3}"
SCOUT_FPS="${SCOUT_FPS:-4}"
MAX_SHOTS="${MAX_SHOTS:-12}"
GEMMA_MODEL="${GEMMA_MODEL:-mlx-community/gemma-4-e4b-it-4bit}"
SONNET_MODEL="${SONNET_MODEL:-sonnet}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK="$(cat "$SELF_DIR/../lib/task-prompt.txt")"

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
SMART_DIR="$INPUTS/hybrid-frames"; rm -rf "$SMART_DIR"; mkdir -p "$SMART_DIR"
SCOUT_LOG="$INPUTS/hybrid-scout.txt"
TRANSCRIPT="$(cat "$INPUTS/transcript.txt" 2>/dev/null || echo '(none)')"

# --- 1. ffmpeg scene cuts (precise shot boundaries) ---
CUTS=$(ffmpeg -i "$VIDEO" -vf "select='gt(scene,$SCENE_THRESH)',showinfo" -f null - 2>&1 \
  | grep -oE "pts_time:[0-9.]+" | cut -d: -f2 | tr '\n' ' ')

# --- 2. Gemma semantic scout (native video → action-beat timestamps) ---
SCOUT_PROMPT="You are a shot-list scout watching a ${DUR}-second video clip. List the KEY moments an editor must see: the start of each distinct shot AND any peak action beat (a snap, a catch, a big movement, a reveal) — even inside a continuous shot. Do NOT space them evenly; pick only moments where something meaningful happens or changes. Output ONE line per moment, formatted EXACTLY as: TIME=<seconds> | <a few words>. Seconds must be real numbers between 0 and ${DUR}."
GEMMA_OUT=$(python -m mlx_vlm.generate --model "$GEMMA_MODEL" --max-tokens 300 \
  --video "$VIDEO" --fps "$SCOUT_FPS" --prompt "$SCOUT_PROMPT" 2>&1)
echo "$GEMMA_OUT" > "$SCOUT_LOG"
# parse beat timestamps — accept both TIME=<sec> and the M:SS format Gemma tends to emit
BEATS=$(GEMMA_OUT="$GEMMA_OUT" DUR="$DUR" python3 <<'PY'
import os, re
t = os.environ["GEMMA_OUT"]; dur = float(os.environ["DUR"]); out = []
for m in re.finditer(r"TIME=([0-9.]+)", t): out.append(float(m.group(1)))
for m in re.finditer(r"(?m)^\s*(\d+):(\d{2}(?:\.\d+)?)\s*\|", t):
    out.append(int(m.group(1))*60 + float(m.group(2)))
print(" ".join(f"{x:.3f}" for x in out if 0 <= x <= dur))
PY
)
GEMMA_PIN=$(echo "$GEMMA_OUT" | grep -oE 'Prompt: [0-9]+ tokens' | grep -oE '[0-9]+' | head -1)
GEMMA_POUT=$(echo "$GEMMA_OUT" | grep -oE 'Generation: [0-9]+ tokens' | grep -oE '[0-9]+' | head -1)

# --- 3. Merge → final timestamp set (endpoints + cuts-inside-new-shot + long-shot
#        midpoints + gemma beats), dedup within 0.4s, sort, cap MAX_SHOTS ---
TIMES=$(DUR="$DUR" MAX_SHOTS="$MAX_SHOTS" CUTS="$CUTS" BEATS="$BEATS" python3 <<'PY'
import os
dur=float(os.environ["DUR"]); cap=int(os.environ["MAX_SHOTS"])
cuts=[float(x) for x in os.environ["CUTS"].split()]
beats=[float(x) for x in os.environ["BEATS"].split() if 0<=float(x)<=dur]
pts=set([0.0, round(max(0.0,dur-0.05),3)])
bounds=sorted(set([0.0]+cuts+[dur]))
for i in range(len(bounds)-1):
    a,b=bounds[i],bounds[i+1]
    pts.add(round(min(a+0.05,dur),3))          # just INSIDE each shot
    gap=b-a
    if gap>3:                                    # sample long shots more
        n=int(gap//3)
        for k in range(1,n+1):
            pts.add(round(a+gap*k/(n+1),3))
for t in beats: pts.add(round(t,3))
# dedup within 0.4s
xs=sorted(pts); out=[]
for t in xs:
    if not out or t-out[-1]>=0.4: out.append(t)
# cap: keep evenly if too many
if len(out)>cap:
    out=[out[int(i*(len(out)-1)/(cap-1))] for i in range(cap)]
print(" ".join(f"{t:.3f}" for t in out))
PY
)

# --- 4. extract exact frames at the chosen timestamps ---
i=1; FRAME_LINES=""
for t in $TIMES; do
  printf -v idx "%02d" "$i"
  mmss=$(awk -v t="$t" 'BEGIN{printf "%02d:%05.2f", int(t/60), t-60*int(t/60)}')
  dst="$SMART_DIR/s${idx}_${mmss//[:.]/_}.png"
  ffmpeg -y -v error -ss "$t" -i "$VIDEO" -frames:v 1 "$dst" 2>/dev/null && \
    FRAME_LINES="${FRAME_LINES}  - ${mmss} → ${dst}"$'\n'
  i=$((i+1))
done
NF=$(ls "$SMART_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

# --- 5. Sonnet analyzes the smart frames (WITH real timestamps) + whisper ---
PROMPT="$TASK

--- INPUTS ---
You are given $NF keyframes that were NOT sampled evenly — each was chosen at a
scene cut or a meaningful action beat, so together they map the clip's real
dynamics. Each is labelled with its true source timestamp. READ each image (Read
tool), reason across them in time order, and combine with the transcript. Do NOT
open the video file itself.

Keyframes (timestamp → path):
$FRAME_LINES
Audio transcript (whisper):
\"\"\"
$TRANSCRIPT
\"\"\"
"

RAW_FILE="$(mktemp)"
echo "$PROMPT" | claude -p --model "$SONNET_MODEL" --allowedTools "Read" --output-format json > "$RAW_FILE" 2>&1

RAW_FILE="$RAW_FILE" OUT="$OUT" NF="$NF" TIMES="$TIMES" SCOUT_LOG="$SCOUT_LOG" \
CUTS="$CUTS" GP="${GEMMA_PIN:-0}" GO="${GEMMA_POUT:-0}" GMODEL="$GEMMA_MODEL" python3 <<'PY'
import json, os
raw=open(os.environ["RAW_FILE"]).read()
out=os.environ["OUT"]; nf=os.environ["NF"]; times=os.environ["TIMES"]
cuts=os.environ["CUTS"].strip(); scout=open(os.environ["SCOUT_LOG"]).read()
gp=os.environ["GP"]; go=os.environ["GO"]; gmodel=os.environ["GMODEL"]
try:
    d=json.loads(raw); text=d.get("result",raw); u=d.get("usage",{})
    inp=u.get("input_tokens",0); outp=u.get("output_tokens",0)
    cc=u.get("cache_creation_input_tokens",0); cr=u.get("cache_read_input_tokens",0)
    cost=d.get("total_cost_usd")
    tok=f"TOKENS prompt_in={inp} cache_creation={cc} cache_read={cr} output={outp} total_in={inp+cc+cr} cost_usd={cost}"
except Exception as e:
    text=raw; tok=f"TOKENS (parse failed: {e})"
# pull just the scouts's TIME= lines for readability
scout_lines="\n".join(l for l in scout.splitlines() if "TIME=" in l) or "(scout emitted no parseable TIME= lines)"
with open(out,"w") as f:
    f.write(f"# Hybrid — Gemma scout + scene-detect → smart frames → Sonnet\n\n")
    f.write(f"{tok}\n")
    f.write(f"GEMMA_SCOUT_TOKENS prompt_in={gp} output={go} ({gmodel})\n\n")
    f.write(f"**Chosen {nf} smart frames** at: `{times}`\n\n")
    f.write(f"**ffmpeg scene cuts:** `{cuts or '(none)'}`\n\n")
    f.write("**Gemma scout beats:**\n```\n"+scout_lines+"\n```\n\n")
    f.write("**Sonnet analysis of the smart frames:**\n```\n"+text.rstrip()+"\n```\n")
PY
rm -f "$RAW_FILE"
