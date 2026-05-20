#!/usr/bin/env bash
# run.sh — full smoke orchestrator.
#   1. Boot the design dev server (or reuse the running one).
#   2. Render Remotion card.
#   3. Record VHS terminal.
#   4. Capture Playwright browser + transcode WebM → MP4.
#   5. Concat all three via assemble.sh.
# Idempotent: safe to re-run; clears .work/smoke/ to avoid stale artifacts.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

W="scripts/video/.work/smoke"
mkdir -p "$W"

# Clean stale outputs so the validation gate measures THIS run, not a previous one.
rm -f "$W/terminal.mp4" "$W/browser.mp4" "$W/card.mp4" "$W/smoke.mp4" "$W/concat.txt"
rm -rf "$W/playwright" "$W/normalized"

echo "→ 1/4 Remotion card"
pnpm exec remotion render \
  scripts/video/smoke/card/index.tsx SmokeCard \
  "$W/card.mp4" \
  --mute \
  --log=error

echo "→ 2/4 VHS terminal"
vhs scripts/video/smoke/terminal.tape >/dev/null

echo "→ 3/4 Playwright browser"
PORT=$(bash plugins/design/dev-server/bin/server-up.sh 2>/dev/null)
DEV_SERVER_URL="http://localhost:${PORT}/_canvas-shell.html?canvas=ui%2FCanvas+Viewport.tsx&designRel=.design&tokens=system%2Fproject%2Fcolors_and_type.css&components=system%2Fproject%2Fpreview%2F_components.css" \
  pnpm exec playwright test \
  --config scripts/video/smoke/playwright.config.ts \
  --reporter=line >/dev/null

# Glob the hashed test-output dir Playwright writes to.
WEBM=$(find "$W/playwright" -name "video.webm" | head -1)
if [ -z "$WEBM" ]; then
  echo "run.sh: no Playwright video.webm produced" >&2
  exit 1
fi
ffmpeg -y -i "$WEBM" -c:v libx264 -pix_fmt yuv420p -r 30 -an "$W/browser.mp4" 2>/dev/null

echo "→ 4/4 Stitch"
bash scripts/video/smoke/assemble.sh
