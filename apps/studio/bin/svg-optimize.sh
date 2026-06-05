#!/usr/bin/env bash
# svg-optimize.sh — CLI front for the draw engine's SVGO optimizer + validity
# gate (draw/optimize.ts). Reached via `maude design svg-optimize` (DDR-062),
# never a raw bin path.
#
# Usage:
#   svg-optimize.sh <in.svg> [--precision N]    # optimize a file
#   cat mark.svg | svg-optimize.sh              # or read from stdin
#
# Emits the optimized SVG to stdout; exits 1 if the input is not valid SVG (so
# it doubles as a parse gate the agent can `||` on).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v bun >/dev/null 2>&1; then
  echo "svg-optimize.sh: bun is required (hard dependency — see plugins/design/dependencies.json)." >&2
  echo "  Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

case "$1" in
  --help|-h) sed -n '2,12p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

exec bun run "$SCRIPT_DIR/_svg-optimize.mjs" "$@"
