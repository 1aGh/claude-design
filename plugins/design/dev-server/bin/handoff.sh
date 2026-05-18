#!/usr/bin/env bash
# /design:handoff CLI wrapper — emits <Slug>.registry.json sidecar next to a
# canvas TSX. Thin shell-out so /design:handoff doesn't have to spin up Bun
# from the orchestrator side.
#
# Usage:
#   bin/handoff.sh <canvas-abs-path> [designRoot]
#
# Output (stdout, line 1): JSON {"dest":"...","files":N,"deps":M}
# Exit code 0 on success, 2 on any failure (with reason on stderr).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: handoff.sh <canvas-abs-path> [designRoot]" >&2
  exit 2
fi

CANVAS="$1"
DESIGN_ROOT="${2:-}"

DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -n "$DESIGN_ROOT" ]; then
  exec bun run "$DIR/handoff.ts" --emit "$CANVAS" "$DESIGN_ROOT"
else
  exec bun run "$DIR/handoff.ts" --emit "$CANVAS"
fi
