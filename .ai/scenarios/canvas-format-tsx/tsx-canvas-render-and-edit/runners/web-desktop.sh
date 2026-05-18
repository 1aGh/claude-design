#!/usr/bin/env bash
# canvas-format-tsx / tsx-canvas-render-and-edit — web-desktop runner.
#
# Status: STUB. The scenario spec lives at ../spec.md but the agent-browser
# piloting step (Cmd+Click on a data-cd-id element inside an iframe) has not
# yet been recorded. This runner exists so /flow:scenario can discover the
# scenario; full piloting + selector capture lands when /flow:done runs
# /validate against this branch.
#
# Contract this runner upholds when piloted:
#   - Boots the dev-server via plugins/design/dev-server/bin/server-up.sh
#   - Drives agent-browser through the spec's 5 steps
#   - Writes per-step screenshots + a tiny result JSON to $OUT_DIR
#   - Exits 0 on PASS, non-zero on FAIL, 77 on SKIPPED (autotools convention)

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/.ai/device/scenario-runs/canvas-format-tsx/tsx-canvas-render-and-edit/$(date -u +%Y-%m-%d-%H%M)/web-desktop}"
mkdir -p "$OUT_DIR"

# ── Precondition gates ────────────────────────────────────────────────────────

CANVAS_PATH="$REPO_ROOT/.design/ui/Docs Site.tsx"
META_PATH="$REPO_ROOT/.design/ui/Docs Site.meta.json"

if [ ! -f "$CANVAS_PATH" ]; then
  echo "SKIPPED: codemod not run — $CANVAS_PATH missing" | tee "$OUT_DIR/result.txt"
  exit 77
fi

CSS_MODE=$(jq -r '.css_mode // "unknown"' "$META_PATH" 2>/dev/null || echo "unknown")
if [ "$CSS_MODE" != "inline" ]; then
  echo "SKIPPED: css_mode=$CSS_MODE (scenario assumes inline)" | tee "$OUT_DIR/result.txt"
  exit 77
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "SKIPPED: bun not on PATH" | tee "$OUT_DIR/result.txt"
  exit 77
fi

if ! command -v agent-browser >/dev/null 2>&1; then
  echo "SKIPPED: agent-browser not installed (pilot the scenario via /flow:scenario new during /done)" | tee "$OUT_DIR/result.txt"
  exit 77
fi

# ── Boot dev-server ───────────────────────────────────────────────────────────

PORT=$(bash "$REPO_ROOT/plugins/design/dev-server/bin/server-up.sh" --root "$REPO_ROOT")
if [ -z "$PORT" ]; then
  echo "FAIL: server-up.sh did not return a port" | tee "$OUT_DIR/result.txt"
  exit 1
fi
echo "→ dev-server on port $PORT" | tee -a "$OUT_DIR/result.txt"

# Sanity probe.
if ! curl -sf "http://localhost:$PORT/_health" >/dev/null; then
  echo "FAIL: /_health probe rejected on port $PORT" | tee -a "$OUT_DIR/result.txt"
  exit 1
fi

# ── Pilot stub ────────────────────────────────────────────────────────────────
# Concrete agent-browser steps drop in here at first pilot run. For now we
# capture only the open + canvas-tree screenshot so reports can still display
# something useful.

agent-browser navigate "http://localhost:$PORT/" \
  --screenshot "$OUT_DIR/01-shell.png" \
  --viewport 1440x900 \
  >> "$OUT_DIR/agent-browser.log" 2>&1 || true

echo "SKIPPED: scenario not yet piloted — see ../spec.md 'Pilot status'" | tee -a "$OUT_DIR/result.txt"
exit 77
