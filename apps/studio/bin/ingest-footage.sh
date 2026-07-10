#!/usr/bin/env bash
# ingest-footage.sh — thin shim over _ingest-footage.mjs; reached via
# `maude design ingest-footage` (DDR-062), never a raw bin path. See
# _ingest-footage.mjs for the full rationale (feature-footage-analysis-director).
#
# Usage:
#   ingest-footage.sh <dir> --root <repo> [--design-root .design]
#                     [--recursive] [--max-bytes N]
#
# stdout on success = a JSON manifest { clips, skipped, assetsDir }.
# Exit: 0 ok (even with skips) · 2 usage · 6 write/containment error · 1 other.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  --help|-h) sed -n '2,14p' "$0" | sed 's/^# \?//'; exit 0 ;;
esac

# Prefer node (always present with a maude install); fall back to bun in a dev
# tree that has bun but a shimmed node. The module is pure Node ESM — no .ts.
if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/_ingest-footage.mjs" "$@"
elif command -v bun >/dev/null 2>&1; then
  exec bun run "$SCRIPT_DIR/_ingest-footage.mjs" "$@"
else
  echo "ingest-footage.sh: node or bun is required." >&2
  exit 1
fi
