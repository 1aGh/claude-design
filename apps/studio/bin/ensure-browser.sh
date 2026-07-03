#!/usr/bin/env bash
# ensure-browser.sh — resolve (and if needed download) a headless Chromium for
# screenshots; prints the browser executable path to stdout. Reached via
# `maude design ensure-browser` (DDR-062), never a raw bin path.
#
# Usage:
#   ensure-browser.sh [--no-download] [--json] [--quiet]
#
# --no-download resolves an already-present browser only (never fetches ~94 MB) —
# use it from readiness probes. Default may download chrome-headless-shell into
# the Maude browsers cache (~/.maude/browsers, override MAUDE_BROWSERS_DIR).
# Exit 0 with the path on stdout when a browser is available; exit 1 otherwise.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,12p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_ensure-browser.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_ensure-browser.mjs" "$@"
else
  echo "ensure-browser.sh: node or bun is required to resolve/download the screenshot browser." >&2
  exit 1
fi
