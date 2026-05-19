#!/usr/bin/env bash
# smoke.sh — batch-screenshot every UI canvas + preview specimen.
# Catches "build green ≠ user-visible green" regressions that bypass the
# per-canvas hooks in /design:edit step 7 / /design:new step 9 — typically
# dev-server infra changes or bulk multi-canvas migrations. See DDR-021.
#
# Usage:
#   smoke.sh [--root <repo>]
#            [--out-dir <dir>]
#            [--include-system 0|1]   (default 1)
#            [--timeout <secs>]       (default 8)
#            [--engine auto|agent-browser|playwright]
#
# Reads:
#   $DESIGN_ROOT/_server.json   (must exist — caller runs server-up.sh first)
#   $DESIGN_ROOT/ui/*.tsx       (canvases)
#   $DESIGN_ROOT/system/*/preview/*.tsx   (specimens, when --include-system 1)
#
# Writes:
#   <out-dir>/<slug>.png        (one screenshot per canvas)
#   <out-dir>/report.tsv        (machine-parseable summary)
#   <out-dir>/report.md         (human-readable summary, links every PNG)
#
# Stdout: one line per canvas, tab-separated:
#   STATUS \t FILE \t SCREENSHOT \t DETAIL
# Stderr: diagnostic / progress.
# Exit:   0 = all green / 3 = at least one blank/error / 1 = missing deps / 2 = bad args.

REPO=""
OUT_DIR=""
INCLUDE_SYSTEM=1
TIMEOUT=8
ENGINE="auto"

while [ $# -gt 0 ]; do
  case "$1" in
    --root)           REPO="$2"; shift 2 ;;
    --out-dir)        OUT_DIR="$2"; shift 2 ;;
    --include-system) INCLUDE_SYSTEM="$2"; shift 2 ;;
    --timeout)        TIMEOUT="$2"; shift 2 ;;
    --engine)         ENGINE="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,28p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "smoke.sh: unknown arg '$1' (try --help)" >&2
      exit 2
      ;;
  esac
done

# ---------- resolve repo + design root ----------
if [ -z "$REPO" ]; then
  REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
fi
DESIGN_ROOT="$REPO/.design"
[ -d "$DESIGN_ROOT" ] || { echo "smoke.sh: no .design/ under $REPO" >&2; exit 1; }

STATE="$DESIGN_ROOT/_server.json"
[ -f "$STATE" ] || { echo "smoke.sh: $STATE missing — run server-up.sh first" >&2; exit 1; }

if command -v jq >/dev/null 2>&1; then
  PORT=$(jq -r .port "$STATE" 2>/dev/null)
else
  PORT=$(sed -nE 's/.*"port"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$STATE" | head -n1)
fi
[ -n "$PORT" ] || { echo "smoke.sh: no port in $STATE" >&2; exit 1; }

# ---------- resolve out-dir ----------
if [ -z "$OUT_DIR" ]; then
  TS=$(date +%Y%m%d-%H%M%S)
  OUT_DIR="$DESIGN_ROOT/_history/_smoke/$TS"
fi
mkdir -p "$OUT_DIR"

# ---------- engine resolution ----------
if [ "$ENGINE" = "auto" ]; then
  if command -v agent-browser >/dev/null 2>&1; then
    ENGINE="agent-browser"
  else
    ENGINE="playwright"
  fi
fi
echo "→ smoke engine: $ENGINE | port: $PORT | out: $OUT_DIR" >&2

# ---------- collect canvases ----------
CANVASES=""
if [ -d "$DESIGN_ROOT/ui" ]; then
  while IFS= read -r f; do
    base=$(basename "$f")
    case "$base" in _*) continue ;; esac
    CANVASES="$CANVASES$f"$'\n'
  done < <(find "$DESIGN_ROOT/ui" -maxdepth 1 -type f -name '*.tsx' 2>/dev/null | sort)
fi

if [ "$INCLUDE_SYSTEM" = "1" ] && [ -d "$DESIGN_ROOT/system" ]; then
  while IFS= read -r f; do
    base=$(basename "$f")
    case "$base" in _*) continue ;; esac
    CANVASES="$CANVASES$f"$'\n'
  done < <(find "$DESIGN_ROOT/system" -type f -name '*.tsx' -path '*/preview/*' 2>/dev/null | sort)
fi

CANVASES=$(printf '%s' "$CANVASES" | sed '/^$/d')
COUNT=$(printf '%s' "$CANVASES" | grep -c .)
[ "$COUNT" -gt 0 ] || { echo "smoke.sh: no canvases found (ui/*.tsx or system/*/preview/*.tsx)" >&2; exit 1; }
echo "→ found $COUNT canvases" >&2

# ---------- helpers ----------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SLUG_HELPER="$SCRIPT_DIR/slug.sh"

urlencode_path() {
  # Encode spaces only — leaves /, ., etc alone. Server resolves these.
  printf '%s' "$1" | sed 's/ /%20/g'
}

# Probe a canvas via agent-browser. Returns three lines on stdout:
#   <status>   one of OK / BLANK / ERROR
#   <detail>   short summary string
#   <screenshot-path-or-empty>
probe_agent_browser() {
  local url="$1"
  local out_png="$2"

  agent-browser open "$url" >/dev/null 2>&1 || { echo "ERROR"; echo "open-failed"; echo ""; return; }

  # Poll for any DC marker — [data-dc-screen], [data-dc-slot], [data-cd-id].
  # Specimens may not have any of these, so we also accept body innerText > 0.
  local poll=0
  local mounted=0
  while [ $poll -lt "$TIMEOUT" ]; do
    sleep 1
    poll=$((poll + 1))
    local raw
    raw=$(agent-browser eval "document.querySelectorAll('[data-dc-screen],[data-dc-slot],[data-cd-id]').length + (document.body && document.body.innerText.trim().length > 0 ? 1000 : 0)" 2>/dev/null)
    raw=$(printf '%s' "$raw" | tr -d '[:space:]')
    case "$raw" in
      ''|*[!0-9]*) continue ;;
      0) continue ;;
      *) mounted=1; break ;;
    esac
  done

  # Capture screenshot regardless — the PNG is evidence even on failure.
  agent-browser screenshot --full "$out_png" >/dev/null 2>&1 || true

  if [ $mounted -eq 0 ]; then
    echo "BLANK"
    echo "no-dc-markers-no-text-after-${TIMEOUT}s"
    echo "$out_png"
    return
  fi

  # Probe for visible error overlays (react-error-overlay, common patterns).
  local err
  err=$(agent-browser eval "(() => {
    const sel = ['#__react-error-overlay', '.react-error-overlay', '[data-error-overlay]', 'pre.error-stack'];
    for (const s of sel) { const el = document.querySelector(s); if (el && el.innerText) return el.innerText.slice(0, 120); }
    const body = document.body && document.body.innerText || '';
    if (body.startsWith('Error:') || body.startsWith('SyntaxError:') || body.startsWith('ReferenceError:')) return body.slice(0, 120);
    return '';
  })()" 2>/dev/null)
  # Strip wrapping quotes that agent-browser eval adds for strings.
  err=$(printf '%s' "$err" | sed 's/^"//; s/"$//; s/^\\n//; s/\\n$//')

  if [ -n "$err" ] && [ "$err" != "null" ] && [ "$err" != "undefined" ]; then
    echo "ERROR"
    echo "$err"
    echo "$out_png"
    return
  fi

  # PNG size sanity — < 2 KB usually means blank background only.
  if [ -s "$out_png" ]; then
    local size
    size=$(wc -c < "$out_png" 2>/dev/null | tr -d ' ')
    if [ -n "$size" ] && [ "$size" -lt 2048 ]; then
      echo "BLANK"
      echo "png-${size}B"
      echo "$out_png"
      return
    fi
  fi

  echo "OK"
  echo "ok"
  echo "$out_png"
}

# ---------- iterate ----------
TSV="$OUT_DIR/report.tsv"
MD="$OUT_DIR/report.md"
printf 'status\tfile\tscreenshot\tdetail\n' > "$TSV"
{
  echo "# Smoke report — $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  echo "- repo: \`$REPO\`"
  echo "- port: $PORT"
  echo "- canvases: $COUNT"
  echo
  echo "| status | file | screenshot | detail |"
  echo "|---|---|---|---|"
} > "$MD"

FAILED=0
N=0
while IFS= read -r CANVAS; do
  [ -z "$CANVAS" ] && continue
  N=$((N + 1))
  REL="${CANVAS#$DESIGN_ROOT/}"
  REL_ENC=$(urlencode_path "$REL")
  URL="http://localhost:$PORT/$REL_ENC"
  SLUG=$(bash "$SLUG_HELPER" "$REL" 2>/dev/null || printf '%s' "$REL" | tr '/ ' '__' | tr '[:upper:]' '[:lower:]')
  OUT_PNG="$OUT_DIR/$SLUG.png"

  printf '  [%d/%d] %s … ' "$N" "$COUNT" "$REL" >&2

  if [ "$ENGINE" = "agent-browser" ]; then
    RESULT=$(probe_agent_browser "$URL" "$OUT_PNG")
  else
    # Playwright fallback — coarser: just screenshot, accept any PNG > 2 KB as OK.
    # See _screenshot-playwright.mjs for the underlying tool.
    bash "$SCRIPT_DIR/screenshot.sh" --url "$URL" --full --out "$OUT_PNG" --engine playwright --timeout "$TIMEOUT" >/dev/null 2>&1
    if [ -s "$OUT_PNG" ]; then
      SIZE=$(wc -c < "$OUT_PNG" | tr -d ' ')
      if [ "$SIZE" -lt 2048 ]; then
        RESULT=$'BLANK\npng-'"$SIZE"$'B\n'"$OUT_PNG"
      else
        RESULT=$'OK\nok\n'"$OUT_PNG"
      fi
    else
      RESULT=$'ERROR\nno-png\n'"$OUT_PNG"
    fi
  fi

  STATUS=$(printf '%s\n' "$RESULT" | sed -n '1p')
  DETAIL=$(printf '%s\n' "$RESULT" | sed -n '2p')
  SHOT=$(printf '%s\n' "$RESULT" | sed -n '3p')

  case "$STATUS" in
    OK)    SYM="✓"; echo "$SYM" >&2 ;;
    BLANK) SYM="✗"; FAILED=$((FAILED + 1)); echo "$SYM blank ($DETAIL)" >&2 ;;
    ERROR) SYM="⚠"; FAILED=$((FAILED + 1)); echo "$SYM error ($DETAIL)" >&2 ;;
    *)     SYM="?"; FAILED=$((FAILED + 1)); echo "? unknown ($STATUS)" >&2 ;;
  esac

  printf '%s\t%s\t%s\t%s\n' "$STATUS" "$REL" "$SHOT" "$DETAIL" >> "$TSV"
  printf '| %s %s | `%s` | [`%s`](%s) | %s |\n' "$SYM" "$STATUS" "$REL" "$(basename "$SHOT")" "$(basename "$SHOT")" "$DETAIL" >> "$MD"

  printf '%s\t%s\t%s\t%s\n' "$STATUS" "$REL" "$SHOT" "$DETAIL"
done <<< "$CANVASES"

{
  echo
  if [ $FAILED -eq 0 ]; then
    echo "**Result:** ✓ all $COUNT canvases rendered."
  else
    echo "**Result:** ✗ $FAILED / $COUNT canvases failed."
  fi
} >> "$MD"

echo "→ report: $MD" >&2
echo "→ tsv:    $TSV" >&2

if [ $FAILED -gt 0 ]; then
  echo "✗ smoke: $FAILED / $COUNT canvases failed" >&2
  exit 3
fi
echo "✓ smoke: all $COUNT canvases rendered" >&2
exit 0
