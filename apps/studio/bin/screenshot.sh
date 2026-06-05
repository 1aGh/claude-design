#!/usr/bin/env bash
# screenshot.sh — canonical screenshot helper for the design plugin.
# Wraps agent-browser (preferred) or playwright (fallback). Replaces the
# inline `agent-browser navigate + screenshot` bash blocks previously
# duplicated across new.md / edit.md / setup-ds.md / screenshot.md / critics.
#
# Usage:
#   screenshot.sh [--port N | --url URL]
#                 [--screen <id> | --element <id> | --selector <css> | --full]
#                 [--all-screens] [--out <path>] [--out-dir <dir>]
#                 [--timeout 8] [--engine auto|agent-browser|playwright]
#                 [--root <repo>]
#
# Notes:
#   - Exactly one of --screen / --element / --selector / --full is required
#     (or --all-screens which loops over every [data-dc-screen]/[data-dc-slot]).
#   - --out required for single-shot modes; --out-dir required for --all-screens.
#   - URL resolution: --url > --port + _active.json > _server.json + _active.json.
#   - Stdout: written PNG paths, one per line (composable in for-loops).
#   - Stderr: diagnostic, engine choice, timing.
#   - Exit: 0 success / 1 missing dependency / 2 bad args / 3 capture failed.

MODE=""
SEL=""
URL=""
PORT=""
OUT=""
OUT_DIR=""
TIMEOUT=8
ENGINE="auto"
ALL_SCREENS=0
ROOT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --screen)   MODE="screen";   SEL="$2"; shift 2 ;;
    --element)  MODE="element";  SEL="$2"; shift 2 ;;
    --selector) MODE="selector"; SEL="$2"; shift 2 ;;
    --full)     MODE="full"; shift ;;
    --all-screens) ALL_SCREENS=1; shift ;;
    --url)      URL="$2"; shift 2 ;;
    --port)     PORT="$2"; shift 2 ;;
    --out)      OUT="$2"; shift 2 ;;
    --out-dir)  OUT_DIR="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    --engine)   ENGINE="$2"; shift 2 ;;
    --root)     ROOT="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,22p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "screenshot.sh: unknown arg '$1' (try --help)" >&2
      exit 2
      ;;
  esac
done

# ---------- arg validation ----------
if [ $ALL_SCREENS -eq 1 ]; then
  [ -z "$OUT_DIR" ] && { echo "screenshot.sh: --all-screens needs --out-dir" >&2; exit 2; }
else
  [ -z "$MODE" ]    && { echo "screenshot.sh: pick one of --full/--screen/--element/--selector or --all-screens" >&2; exit 2; }
  [ -z "$OUT" ]     && { echo "screenshot.sh: --out required for single-shot modes" >&2; exit 2; }
fi

# agent-browser ignores RELATIVE screenshot paths (it writes to its own
# ~/.agent-browser/tmp instead), which strands the PNG and trips the
# missing-file guard below. Canonicalize OUT / OUT_DIR to absolute up front so
# captures land where the caller asked.
if [ -n "$OUT" ]; then
  mkdir -p "$(dirname "$OUT")" 2>/dev/null || true
  OUT="$(cd "$(dirname "$OUT")" 2>/dev/null && pwd)/$(basename "$OUT")"
fi
if [ -n "$OUT_DIR" ]; then
  mkdir -p "$OUT_DIR" 2>/dev/null || true
  OUT_DIR="$(cd "$OUT_DIR" 2>/dev/null && pwd)"
fi

# TSX specimens cannot be opened via file:// — the browser would see raw JSX.
# They must go through the dev-server route (http://localhost:PORT/<rel>),
# which transpiles via _canvas-shell.html?canvas=<rel>. Phase 19 / DDR-044.
case "$URL" in
  file://*.tsx)
    echo "screenshot.sh: TSX specimens cannot be screenshot via file:// (the browser sees raw JSX)." >&2
    echo "  Use --port instead — the dev-server compiles TSX through _canvas-shell.html?canvas=<rel>." >&2
    echo "  Example: screenshot.sh --port 4399 --full --out shot.png  (set the active canvas in the browser first)" >&2
    exit 2
    ;;
esac

# ---------- url resolution ----------
if [ -z "$URL" ]; then
  REPO="${ROOT:-${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}}"
  STATE="$REPO/.design/_server.json"
  ACTIVE_JSON="$REPO/.design/_active.json"
  if [ -z "$PORT" ] && [ -f "$STATE" ]; then
    if command -v jq >/dev/null 2>&1; then
      PORT=$(jq -r .port "$STATE" 2>/dev/null)
    else
      PORT=$(sed -nE 's/.*"port"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$STATE" | head -n1)
    fi
  fi
  [ -z "$PORT" ] && { echo "screenshot.sh: no --url/--port given and _server.json not found (run server-up.sh)" >&2; exit 1; }

  if [ -f "$ACTIVE_JSON" ] && command -v jq >/dev/null 2>&1; then
    ACTIVE=$(jq -r '.active // empty' "$ACTIVE_JSON" 2>/dev/null)
  fi
  [ -z "$ACTIVE" ] && { echo "screenshot.sh: no active canvas in _active.json (open one in browser first)" >&2; exit 1; }

  # URL-encode spaces (rough); leave other chars alone.
  ACTIVE_ENC=$(printf '%s' "$ACTIVE" | sed 's/ /%20/g')
  # Canvases mount through the canvas shell. The bare `/<rel>` route 404s when
  # the canvas-origin sandbox is on (default since phase-9.1); only
  # `/_canvas-shell.html?canvas=<rel>` renders the canvas (valid in both
  # split-on and legacy same-origin modes).
  URL="http://localhost:${PORT}/_canvas-shell.html?canvas=${ACTIVE_ENC}"
fi

# ---------- selector mapping ----------
case "$MODE" in
  screen)   CSS_SEL="[data-dc-screen=\"$SEL\"], [data-dc-slot=\"$SEL\"]" ;;
  element)  CSS_SEL="[data-dc-element=\"$SEL\"]" ;;
  selector) CSS_SEL="$SEL" ;;
  full|"")  CSS_SEL="" ;;
esac

# ---------- engine resolution ----------
if [ "$ENGINE" = "auto" ]; then
  if command -v agent-browser >/dev/null 2>&1; then
    ENGINE="agent-browser"
  else
    ENGINE="playwright"
  fi
fi
echo "→ screenshot engine: $ENGINE | url: $URL" >&2

# ---------- engine: agent-browser ----------
ab_screenshot() {
  local css="$1"
  local out="$2"
  if [ -n "$css" ]; then
    agent-browser screenshot "$css" "$out" >&2 || return 1
  else
    agent-browser screenshot --full "$out" >&2 || return 1
  fi
  # agent-browser sometimes reports success without writing — verify size.
  if [ ! -s "$out" ]; then
    echo "✗ agent-browser reported success but output file missing/empty: $out" >&2
    return 1
  fi
  return 0
}

# ---------- engine: playwright ----------
pw_screenshot() {
  local css="$1"
  local out="$2"
  local script_dir
  script_dir="$(cd "$(dirname "$0")" && pwd)"
  local pw_script="$script_dir/_screenshot-playwright.mjs"
  if [ ! -f "$pw_script" ]; then
    echo "✗ playwright fallback shim missing at $pw_script" >&2
    return 1
  fi
  echo "→ playwright engine; first invocation may install chromium (~150MB, one-off)" >&2
  if [ -n "$css" ]; then
    npm exec --yes --package=playwright -- node "$pw_script" --url "$URL" --selector "$css" --out "$out" --timeout "$TIMEOUT" >&2 || return 1
  else
    npm exec --yes --package=playwright -- node "$pw_script" --url "$URL" --out "$out" --timeout "$TIMEOUT" >&2 || return 1
  fi
  [ -s "$out" ] || { echo "✗ playwright wrote no file: $out" >&2; return 1; }
  return 0
}

navigate_once() {
  if [ "$ENGINE" = "agent-browser" ]; then
    agent-browser open "$URL" >&2
    # Wait for canvas to mount — Babel/React canvases take 2–4s to settle.
    # Poll for [data-dc-screen] or [data-dc-slot] up to $TIMEOUT seconds; fall
    # through to a fixed sleep when the page isn't a DC canvas.
    local poll=0
    local got=0
    while [ $poll -lt "$TIMEOUT" ]; do
      sleep 1
      poll=$((poll + 1))
      local raw
      raw=$(agent-browser eval "document.querySelectorAll('[data-dc-screen],[data-dc-slot]').length" 2>/dev/null)
      # raw is a plain number on success — strip whitespace, validate.
      local has=$(printf '%s' "$raw" | tr -d '[:space:]')
      case "$has" in
        ''|*[!0-9]*) continue ;;
        0) continue ;;
        *) got=1; break ;;
      esac
    done
    if [ $got -eq 0 ]; then
      # Fallback: give static pages (specimens, non-canvas HTMLs) a chance.
      echo "→ no DC mount detected after ${TIMEOUT}s — proceeding (may be a non-canvas page)" >&2
      sleep 1
    fi
  fi
}

capture() {
  local css="$1"
  local out="$2"
  mkdir -p "$(dirname "$out")"
  if [ "$ENGINE" = "agent-browser" ]; then
    ab_screenshot "$css" "$out"
  else
    pw_screenshot "$css" "$out"
  fi
}

# ---------- --all-screens loop ----------
if [ $ALL_SCREENS -eq 1 ]; then
  mkdir -p "$OUT_DIR"
  navigate_once
  IDS=""
  if [ "$ENGINE" = "agent-browser" ]; then
    # agent-browser wraps string results in quotes and escapes newlines as
    # literal `\n`; comma-join + tr is simpler than parsing JSON for IDs.
    raw=$(agent-browser eval \
      "Array.from(document.querySelectorAll('[data-dc-screen],[data-dc-slot]')).map(e => e.getAttribute('data-dc-screen') || e.getAttribute('data-dc-slot')).filter(Boolean).join(',')" \
      2>/dev/null)
    # Strip surrounding quotes, then split on comma.
    IDS=$(printf '%s' "$raw" | sed 's/^"//; s/"$//' | tr ',' '\n')
  fi
  if [ -z "$IDS" ]; then
    echo "✗ no [data-dc-screen]/[data-dc-slot] elements found (or eval unavailable on this engine)" >&2
    exit 3
  fi
  N=0
  FAILED=0
  for ID in $IDS; do
    N=$((N + 1))
    NN=$(printf "%03d" "$N")
    OUT_FILE="$OUT_DIR/${NN}-screen-${ID}.png"
    if [ "$ENGINE" = "agent-browser" ]; then
      agent-browser eval "document.querySelector('[data-dc-screen=\"$ID\"], [data-dc-slot=\"$ID\"]').scrollIntoView({block:'center'})" >/dev/null 2>&1
      sleep 0.6
    fi
    if capture "[data-dc-screen=\"$ID\"], [data-dc-slot=\"$ID\"]" "$OUT_FILE"; then
      echo "$OUT_FILE"
    else
      echo "✗ failed: $ID" >&2
      FAILED=$((FAILED + 1))
    fi
  done
  [ $FAILED -gt 0 ] && exit 3
  exit 0
fi

# ---------- single-shot ----------
navigate_once
if capture "$CSS_SEL" "$OUT"; then
  echo "$OUT"
  exit 0
fi
exit 3
