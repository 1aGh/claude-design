#!/usr/bin/env bash
# fetch-asset.sh — hardened download-first image fetch. Thin shim over
# _fetch-asset.mjs; reached via `maude design fetch-asset` (DDR-062), never a
# raw bin path. See _fetch-asset.mjs for the full security rationale
# (DDR-147 § Security follow-up item 1).
#
# Usage:
#   fetch-asset.sh <https-url> --root <repo> [--design-root .design]
#                  [--max-bytes N] [--max-time S] [--json]
#
# stdout on success = the canvas reference path (e.g. /assets/a44d3d60.png).
# Exit: 0 ok · 2 usage · 3 SSRF/validation reject · 4 download/http error ·
#       5 unsupported media type · 6 write/containment error · 1 other.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,17p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

if ! command -v curl >/dev/null 2>&1; then
  echo "fetch-asset.sh: curl is required (hardened download uses fixed curl args)." >&2
  exit 1
fi

# Prefer node (always present with a maude install); fall back to bun in a dev
# tree that has bun but a shimmed node. The module is pure Node ESM — no .ts.
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_fetch-asset.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_fetch-asset.mjs" "$@"
else
  echo "fetch-asset.sh: node (or bun) is required." >&2
  exit 1
fi
