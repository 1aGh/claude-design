#!/usr/bin/env bash
# probe-footage.sh — thin shim over _probe-footage-playwright.mjs; reached via
# `maude design probe-footage` (DDR-062), never a raw bin path. Extracts keyframe
# PNGs from one clip in headless Chromium for the footage-analyst's vision pass
# (feature-footage-analysis-director, Task 4). See the .mjs for the rationale.
#
# Usage:
#   probe-footage.sh <assets/<sha8>.<ext>> --root <repo> [--design-root .design]
#                    [--frames N] [--out-dir DIR]
#
# stdout on success = a JSON manifest { asset, durationSec, width, height, frames }.
# Exit: 0 ok · 2 usage · 3 no browser · 4 decode/probe error · 1 other.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,14p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

# The probe imports `playwright` (Chromium). Prefer node (the runtime the other
# playwright shims run under); fall back to bun in a dev tree.
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_probe-footage-playwright.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_probe-footage-playwright.mjs" "$@"
else
  echo "probe-footage.sh: node or bun is required." >&2
  exit 1
fi
