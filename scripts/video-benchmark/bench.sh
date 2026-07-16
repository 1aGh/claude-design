#!/usr/bin/env bash
# bench.sh — video analysis benchmark harness.
#
# Takes ONE clip, has each contestant produce visual+audio metadata + a "what is
# this about" report, and measures wall-clock / peak RAM / CPU load per contestant.
# Qualitative outputs are saved verbatim for the human to read; metrics go into a
# comparison table.
#
#   ./bench.sh [video] [contestant ...]
#
# Default video: .design/assets/caaftv-local.mp4 (8s, real foreign-language speech
#   — so the audio track actually tests something).
# Default contestants: gemma4-e2b gemma4-e4b qwen25-vl own-sonnet
#   (add `qwen3-omni` explicitly — large MoE, may OOM on 16GB).
#
# Contestant registry: name -> "script.sh | ENVVAR=val ..."
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
VENV="${MAUDE_BENCH_VENV:-/tmp/gemma4-test-venv}"
export BENCH_FPS="${BENCH_FPS:-2}"   # keyframe/video sampling density
export FPS="$BENCH_FPS"              # gemma native --fps

VIDEO="${1:-$REPO/.design/assets/caaftv-local.mp4}"
[ $# -gt 0 ] && shift
CONTESTANTS=("$@")
[ ${#CONTESTANTS[@]} -eq 0 ] && CONTESTANTS=(gemma4-e2b gemma4-e4b qwen25-vl own-sonnet)

declare -A REG=(
  [gemma4-e2b]="gemma4.sh|MODEL=mlx-community/gemma-4-e2b-it-4bit"
  [gemma4-e4b]="gemma4.sh|MODEL=mlx-community/gemma-4-e4b-it-4bit"
  [qwen25-vl]="qwen-vl.sh|MODEL=mlx-community/Qwen2.5-VL-7B-Instruct-4bit"
  [qwen3-vl]="qwen-vl.sh|MODEL=mlx-community/Qwen3-VL-8B-Instruct-4bit"
  [qwen3-omni]="qwen3-omni.sh|MODEL=mlx-community/Qwen3-Omni-30B-A3B-Instruct-4bit"
  [own-sonnet]="own-sonnet.sh|MODEL=sonnet"
  [hybrid]="hybrid.sh|MODEL=sonnet"
)

[ -f "$VIDEO" ] || { echo "video not found: $VIDEO" >&2; exit 1; }
[ -d "$VENV" ] && source "$VENV/bin/activate"

SLUG=$(basename "$VIDEO" | sed 's/\.[^.]*$//' | tr -c 'A-Za-z0-9' '-')
STAMP=$(date +%Y%m%d-%H%M%S)
RUN="$ROOT/results/${SLUG}-${STAMP}"
mkdir -p "$RUN/inputs"
echo "→ run dir: $RUN"

# --- shared inputs (keyframes + wav + whisper transcript) ---
bash "$ROOT/lib/prep-inputs.sh" "$VIDEO" "$RUN/inputs"

# --- pre-fetch MLX weights OUTSIDE the measured window (one-time download) ---
prefetch() {
  local model="$1"
  case "$model" in
    sonnet|opus|haiku) return 0 ;;
  esac
  python - "$model" <<'PY' 2>/dev/null || echo "  (prefetch failed for $model — will download during run)"
import sys
from huggingface_hub import snapshot_download
snapshot_download(sys.argv[1])
PY
}

# --- run each contestant under measurement ---
for name in "${CONTESTANTS[@]}"; do
  spec="${REG[$name]:-}"
  [ -z "$spec" ] && { echo "unknown contestant: $name (skipping)"; continue; }
  script="${spec%%|*}"; env_kv="${spec#*|}"
  model="${env_kv#MODEL=}"

  echo
  echo "════════ $name ($model) ════════"
  echo "  prefetching weights (not measured)…"
  prefetch "$model"

  out="$RUN/$name.out.md"
  metrics="$RUN/$name.metrics.json"
  log="$RUN/$name.log"

  echo "  running + measuring…"
  env "$env_kv" bash "$ROOT/lib/measure.sh" "$name" "$metrics" "$log" -- \
    bash "$ROOT/contestants/$script" "$VIDEO" "$RUN/inputs" "$out"
  ec=$?

  # enrich metrics with mlx-reported peak mem + throughput parsed from the output
  peak_gpu=$(grep -oE 'Peak memory: [0-9.]+ GB' "$out" 2>/dev/null | grep -oE '[0-9.]+' | sort -rn | head -1)
  toks=$(grep -oE 'Generation: [0-9]+ tokens, [0-9.]+ tokens-per-sec' "$out" 2>/dev/null | grep -oE '[0-9.]+ tokens-per-sec' | grep -oE '^[0-9.]+' | head -1)
  python - "$metrics" "${peak_gpu:-null}" "${toks:-null}" <<'PY' 2>/dev/null || true
import json,sys
p=sys.argv[1]
try: m=json.load(open(p))
except: sys.exit()
m["mlx_peak_gpu_gb"]=None if sys.argv[2]=="null" else float(sys.argv[2])
m["gen_tokens_per_sec"]=None if sys.argv[3]=="null" else float(sys.argv[3])
json.dump(m,open(p,"w"),indent=2)
PY
  echo "  → exit=$ec  $(python -c "import json;m=json.load(open('$metrics'));print(f\"wall={m['wall_sec']}s rss={m['max_rss_gb']}GB gpu={m.get('mlx_peak_gpu_gb')}GB cpu_avg={m['sample_avg_cpu_pct']}%\")" 2>/dev/null)"
done

# --- build REPORT.md ---
python3 "$ROOT/lib/report.py" "$RUN" > "$RUN/REPORT.md"
echo
echo "✓ done. Report: $RUN/REPORT.md"
