#!/usr/bin/env bash
# specimen-render-and-edit / web-desktop runner
# Walks every .design/system/project/preview/*.tsx and verifies it boots
# cleanly through _canvas-shell.html. Designed to be idempotent — run again
# after any canvas-build / shell change to confirm 0 regressions.
#
# Usage:
#   bash runners/web-desktop.sh                # run, write report to .ai/device/scenario-runs/...
#   DESIGN_PORT=4500 bash runners/web-desktop.sh
#   DRY=1 bash runners/web-desktop.sh          # list specimens, don't open
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel)}"
cd "$REPO_ROOT"

# ---------- locate dev-server port ----------
PORT="${DESIGN_PORT:-}"
if [[ -z "$PORT" && -f .design/_server.json ]]; then
  PORT=$(node -e "const j=require('./.design/_server.json');process.stdout.write(String(j.port||''))" 2>/dev/null || true)
fi
PORT="${PORT:-4399}"

if ! curl -sf "http://localhost:$PORT/_health" >/dev/null; then
  echo "[FATAL] dev-server not reachable on http://localhost:$PORT" >&2
  echo "        boot it via: bun plugins/design/dev-server/server.ts --root . --port $PORT" >&2
  exit 2
fi

# ---------- enumerate specimens ----------
# (bash 3.2 compatible — macOS default has no `mapfile`)
SPECIMENS=()
while IFS= read -r line; do SPECIMENS+=("$line"); done < <(cd .design && ls system/project/preview/*.tsx 2>/dev/null | sort)
if [[ ${#SPECIMENS[@]} -eq 0 ]]; then
  echo "SKIPPED: no specimens under .design/system/project/preview/*.tsx"
  exit 0
fi
echo "[info] $((${#SPECIMENS[@]})) specimens under .design/system/project/preview"

if [[ "${DRY:-0}" == "1" ]]; then
  printf '  %s\n' "${SPECIMENS[@]}"
  exit 0
fi

# ---------- run dir ----------
TS="$(date +%Y-%m-%d-%H%M)"
RUN_DIR=".ai/device/scenario-runs/specimen-render-and-edit/$TS"
mkdir -p "$RUN_DIR/shots"

REPORT="$RUN_DIR/report.md"
{
  echo "# specimen-render-and-edit — $TS"
  echo
  echo "**Platform:** web-desktop ($PORT)"
  echo "**Scenario:** [\`spec.md\`](../../../../scenarios/canvas-format-tsx/specimen-render-and-edit/spec.md)"
  echo
} > "$REPORT"

# Per-spec query string. All specimens load the same DS chrome triplet.
QS_TAIL='&layout=system%2Fproject%2F_layout.css&components=system%2Fproject%2F_components.css&tokens=system%2Fproject%2Fcolors_and_type.css'

pass=0; fail=0; empty=0
declare -a ROWS

for rel in "${SPECIMENS[@]}"; do
  slug="${rel##*/}"
  slug="${slug%.tsx}"

  # urlencode the slashes only — the slug parts themselves are safe
  url_path="${rel//\//%2F}"
  url="http://localhost:$PORT/_canvas-shell.html?canvas=${url_path}${QS_TAIL}"

  agent-browser open "$url" >/dev/null 2>&1 || true
  sleep 1.5

  # capture console errors
  agent-browser errors --clear >/dev/null 2>&1 || true
  agent-browser open "$url" >/dev/null 2>&1 || true
  sleep 1.5
  err_raw="$(agent-browser errors 2>&1 || true)"
  # agent-browser prints a header / trailing summary; count any line that
  # looks like an actual error stack frame or "Error:" prefix
  err_count="$(printf '%s\n' "$err_raw" | grep -cE '^(Error:|TypeError:|ReferenceError:|SyntaxError:|Uncaught )' || true)"

  # probe DOM — also pluck #canvas-mount-error contents (the shell writes
  # dynamic-import / parse failures there as visible text, not console errors)
  probe="$(agent-browser eval "JSON.stringify({kids:document.body.children.length, txt:document.body.innerText.length, cdIds:document.querySelectorAll('[data-cd-id]').length, mountErr:(document.getElementById('canvas-mount-error')?.textContent||'').slice(0,200)})" 2>/dev/null || echo '{}')"
  # agent-browser wraps output in quotes — strip then re-parse
  probe="${probe%\"}"; probe="${probe#\"}"
  probe="${probe//\\\"/\"}"

  kids=$(printf '%s' "$probe" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{process.stdout.write(String(JSON.parse(d).kids||0))}catch{process.stdout.write("0")}})' 2>/dev/null || echo 0)
  txt=$(printf '%s' "$probe" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{process.stdout.write(String(JSON.parse(d).txt||0))}catch{process.stdout.write("0")}})' 2>/dev/null || echo 0)
  cdIds=$(printf '%s' "$probe" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{process.stdout.write(String(JSON.parse(d).cdIds||0))}catch{process.stdout.write("0")}})' 2>/dev/null || echo 0)
  mountErr=$(printf '%s' "$probe" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{process.stdout.write(String(JSON.parse(d).mountErr||""))}catch{process.stdout.write("")}})' 2>/dev/null || echo "")

  # screenshot
  agent-browser screenshot "$RUN_DIR/shots/${slug}.png" >/dev/null 2>&1 || true

  # classify — mount-error wins; then console errors; then DOM-empty.
  if [[ -n "$mountErr" ]]; then
    status='FAIL'
    fail=$((fail+1))
  elif [[ "$err_count" -gt 0 ]]; then
    status='FAIL'
    fail=$((fail+1))
  elif [[ "$cdIds" -lt 1 || "$txt" -lt 50 ]]; then
    status='EMPTY'
    empty=$((empty+1))
  else
    status='PASS'
    pass=$((pass+1))
  fi

  printf '  %-50s %s  (errs=%s kids=%s txt=%s cdIds=%s)' "$slug" "$status" "$err_count" "$kids" "$txt" "$cdIds"
  if [[ -n "$mountErr" ]]; then
    printf '  mountErr=%s' "${mountErr:0:80}"
  fi
  printf '\n'
  mountErrShort="${mountErr:0:100}"
  ROWS+=("$(printf '| %s | %s | %s | %s | %s | %s | %s |' "$slug" "$status" "$err_count" "$kids" "$txt" "$cdIds" "${mountErrShort//|/\\|}")")
done

# ---------- report ----------
{
  echo "## TL;DR"
  echo
  echo "- **PASS:** $pass"
  echo "- **EMPTY:** $empty"
  echo "- **FAIL:** $fail"
  echo "- **Total:** ${#SPECIMENS[@]}"
  echo
  if [[ "$fail" -eq 0 && "$pass" -ge $(( ${#SPECIMENS[@]} - 3 )) ]]; then
    echo "**Verdict:** ✅ PASS (≥ 35/38 specimens render cleanly, 0 console errors)"
  elif [[ "$fail" -eq 0 ]]; then
    echo "**Verdict:** ⚠️  PASS with EMPTY count > 3 — manual review needed"
  else
    echo "**Verdict:** ❌ FAIL — at least one specimen threw a console error"
  fi
  echo
  echo "## Per-specimen pivot"
  echo
  echo "| Specimen | Status | Errors | body.kids | innerText.len | data-cd-id count | Mount error (first 100) |"
  echo "| --- | --- | --- | --- | --- | --- | --- |"
  printf '%s\n' "${ROWS[@]}"
  echo
  echo "## Counter deltas"
  echo
  echo "| Counter | Pre | Post | Delta |"
  echo "| --- | --- | --- | --- |"
  echo "| specimens probed | 0 | ${#SPECIMENS[@]} | +${#SPECIMENS[@]} |"
  echo "| PASS count | 0 | $pass | +$pass |"
  echo "| FAIL count | 0 | $fail | +$fail |"
  echo
  echo "## Screenshots"
  echo
  echo "Captured to \`$RUN_DIR/shots/<slug>.png\` (one per specimen)."
  echo
  echo "## Follow-ups"
  echo
  if [[ "$empty" -gt 0 ]]; then
    echo "- $empty specimens flagged EMPTY (rendered, no errors, but suspect — < 50 chars text OR 0 data-cd-id):"
    for row in "${ROWS[@]}"; do
      if [[ "$row" == *"| EMPTY |"* ]]; then
        printf '  - %s\n' "$row" | sed 's/|//g; s/^ *- */  - /'
      fi
    done
  fi
  if [[ "$fail" -gt 0 ]]; then
    echo "- Investigate FAIL specimens in browser DevTools — start with \`agent-browser open <url> && agent-browser errors\`."
  fi
  if [[ "$empty" -eq 0 && "$fail" -eq 0 ]]; then
    echo "- None. Clean run."
  fi
} >> "$REPORT"

echo
echo "[done] report: $REPORT"

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
