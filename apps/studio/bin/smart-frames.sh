#!/usr/bin/env bash
# smart-frames.sh — thin shim over _smart-frames.mjs; reached via
# `maude design smart-frames` (DDR-062), never a raw bin path. Scene-AWARE keyframe
# extraction for the footage-analyst's vision pass (feature-scene-aware-keyframes):
# picks frames at scene cuts + semantic beats + endpoints instead of a blind frame
# rate. Three tiers, auto-detected — gemma (opt-in) → ffmpeg (default) → blind
# (probe-footage / Chromium floor). See _smart-frames.mjs + skill footage-keyframes.
#
# Usage:
#   smart-frames.sh <assets/<sha8>.<ext>> [--root <repo>] [--out-dir DIR]
#                   [--frames N] [--engine auto|gemma|ffmpeg|blind]
#                   [--scene-thresh 0.3] [--scout-fps 4]
#
# stdout on success = a JSON manifest (superset of probe-footage's).
# Exit: 0 ok · 2 usage · 3 forced-engine dep missing · 4 decode/extract error · 1 other.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,18p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

# Pure JS (no .ts imports) — prefer node like probe-footage; fall back to bun.
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_smart-frames.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_smart-frames.mjs" "$@"
else
  echo "smart-frames.sh: node or bun is required." >&2
  exit 1
fi
