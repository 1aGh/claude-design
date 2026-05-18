#!/usr/bin/env bash
# canvas-edit.sh — AST-aware single-attribute edit on a canvas .tsx file.
# Wraps `plugins/design/dev-server/canvas-edit.ts` so /design:edit Step 3a can
# shell out without booting a Bun module loader inline. Phase 3.6 Task 5.
#
# Usage:  canvas-edit.sh <canvas-abs-path> <data-cd-id> <attr> <value>
#
#   <canvas-abs-path>  absolute path of the .tsx canvas file
#   <data-cd-id>       8-hex id from the inspector / _locator.json
#   <attr>             "className" | "style.<prop>" | any JSX attribute name
#   <value>            new value (bare string for className / plain attrs;
#                      a JS expression for style.<prop> — e.g. '"#facc15"',
#                      `14`, `"calc(100% - 2px)"`)
#
# Exit codes:
#   0   edit applied (or no-op when source already matched)
#   1   bad usage / missing file
#   2   AST edit failed (id not found, parse error, unsupported attribute shape)
#
# Output:
#   On success, prints one JSON line: {"canvas": "...", "id": "...", "delta": <int>}
#   On failure, prints the underlying error to stderr.
#
# This script intentionally has no fallback path — Bun is the only supported
# runtime (DDR-009). Callers should pre-flight `mdcc --version` if the
# environment is uncertain.

set -euo pipefail

if [ $# -lt 4 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: canvas-edit.sh <canvas-abs-path> <data-cd-id> <attr> <value>" >&2
  [ "$1" = "--help" ] || [ "$1" = "-h" ] && exit 0
  exit 1
fi

CANVAS="$1"
ID="$2"
ATTR="$3"
VALUE="$4"

if [ ! -f "$CANVAS" ]; then
  echo "canvas-edit: file not found: $CANVAS" >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")/.." && pwd)"

bun --silent run "$HERE/canvas-edit.ts" --invoke "$CANVAS" "$ID" "$ATTR" "$VALUE" 2>&1 || exit 2
