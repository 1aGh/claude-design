#!/usr/bin/env bash
# measure.sh — run a labeled command, capture wall-clock + peak RSS + CPU load.
#
# Usage:
#   measure.sh <label> <metrics_out.json> <log_out.txt> -- <command> [args...]
#
# Emits <metrics_out.json>:
#   { label, wall_sec, exit_code,
#     max_rss_gb,          # authoritative peak RSS of the main process (/usr/bin/time -l)
#     cpu_user_sec, cpu_sys_sec, cpu_total_sec,
#     sample_peak_rss_gb,  # peak summed RSS across the process TREE (0.5s sampler)
#     sample_avg_cpu_pct, sample_peak_cpu_pct,  # %CPU summed across the tree
#     samples }            # number of samples taken
#
# No sudo. GPU/Metal (unified-memory) work is NOT captured here — MLX offloads to
# the GPU, so a low CPU% with a busy wall-clock is expected and honest. The
# mlx-reported "Peak memory" line (parsed separately from the log) is the accurate
# GPU-side number for the MLX contestants.

set -uo pipefail

LABEL="$1"; METRICS_OUT="$2"; LOG_OUT="$3"; shift 3
[ "$1" = "--" ] && shift

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- background sampler: sums RSS + %CPU across the target process group ---
sampler() {
  local pgid="$1" out="$2"
  local peak_rss=0 sum_cpu=0 peak_cpu=0 n=0
  while kill -0 "-$pgid" 2>/dev/null; do
    # ps over the whole process group; sum RSS(kb) and %CPU across members
    local line
    line=$(ps -o rss=,%cpu= -g "$pgid" 2>/dev/null | awk '{r+=$1; c+=$2} END{printf "%d %.1f", r, c}')
    local rss_kb cpu
    rss_kb=${line% *}; cpu=${line#* }
    [ -z "$rss_kb" ] && rss_kb=0
    [ -z "$cpu" ] && cpu=0
    if [ "$rss_kb" -gt "$peak_rss" ] 2>/dev/null; then peak_rss=$rss_kb; fi
    sum_cpu=$(awk -v s="$sum_cpu" -v c="$cpu" 'BEGIN{print s+c}')
    peak_cpu=$(awk -v p="$peak_cpu" -v c="$cpu" 'BEGIN{print (c>p)?c:p}')
    n=$((n+1))
    sleep 0.5
  done
  local avg_cpu=0
  [ "$n" -gt 0 ] && avg_cpu=$(awk -v s="$sum_cpu" -v n="$n" 'BEGIN{printf "%.1f", s/n}')
  awk -v pr="$peak_rss" -v ac="$avg_cpu" -v pc="$peak_cpu" -v n="$n" \
    'BEGIN{printf "%.3f %s %s %d", pr/1024/1024, ac, pc, n}' > "$out"
}

TIME_OUT=$(mktemp)
SAMP_OUT=$(mktemp)

# Run the command in its OWN process group so the sampler can see the whole tree.
START=$(python3 -c 'import time; print(time.time())')
set -m
/usr/bin/time -l "$@" >"$LOG_OUT" 2>"$TIME_OUT" &
CMD_PID=$!
PGID=$(ps -o pgid= -p "$CMD_PID" | tr -d ' ')
set +m

sampler "$PGID" "$SAMP_OUT" &
SAMP_PID=$!

wait "$CMD_PID"; EXIT_CODE=$?
wait "$SAMP_PID" 2>/dev/null
END=$(python3 -c 'import time; print(time.time())')

WALL=$(awk -v s="$START" -v e="$END" 'BEGIN{printf "%.2f", e-s}')

# /usr/bin/time -l on macOS: "<n>  maximum resident set size" (bytes),
# plus a "<sec> real <sec> user <sec> sys" line at the top.
MAXRSS_BYTES=$(awk '/maximum resident set size/{print $1}' "$TIME_OUT" | head -1)
[ -z "$MAXRSS_BYTES" ] && MAXRSS_BYTES=0
MAXRSS_GB=$(awk -v b="$MAXRSS_BYTES" 'BEGIN{printf "%.3f", b/1024/1024/1024}')
CPU_USER=$(awk '/real.*user.*sys/{for(i=1;i<=NF;i++) if($(i+1)=="user") print $i}' "$TIME_OUT" | head -1)
CPU_SYS=$(awk '/real.*user.*sys/{for(i=1;i<=NF;i++) if($(i+1)=="sys") print $i}' "$TIME_OUT" | head -1)
[ -z "$CPU_USER" ] && CPU_USER=0
[ -z "$CPU_SYS" ] && CPU_SYS=0
CPU_TOTAL=$(awk -v u="$CPU_USER" -v s="$CPU_SYS" 'BEGIN{printf "%.2f", u+s}')

read -r S_PEAK_RSS S_AVG_CPU S_PEAK_CPU S_N < "$SAMP_OUT" 2>/dev/null
[ -z "${S_PEAK_RSS:-}" ] && { S_PEAK_RSS=0; S_AVG_CPU=0; S_PEAK_CPU=0; S_N=0; }

# Append the raw /usr/bin/time -l block to the log for auditing.
{ echo; echo "=== /usr/bin/time -l ==="; cat "$TIME_OUT"; } >> "$LOG_OUT"

cat > "$METRICS_OUT" <<JSON
{
  "label": "$LABEL",
  "wall_sec": $WALL,
  "exit_code": $EXIT_CODE,
  "max_rss_gb": $MAXRSS_GB,
  "cpu_user_sec": $CPU_USER,
  "cpu_sys_sec": $CPU_SYS,
  "cpu_total_sec": $CPU_TOTAL,
  "sample_peak_rss_gb": $S_PEAK_RSS,
  "sample_avg_cpu_pct": $S_AVG_CPU,
  "sample_peak_cpu_pct": $S_PEAK_CPU,
  "samples": $S_N
}
JSON

rm -f "$TIME_OUT" "$SAMP_OUT"
exit "$EXIT_CODE"
