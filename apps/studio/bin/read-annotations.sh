#!/usr/bin/env bash
# read-annotations.sh — thin wrapper around read-annotations.mjs (the headless
# SVG → JSON annotation reader). Reached via `maude design read-annotations`
# (DDR-062), never a raw bin path. The reader is zero-dep Node, so we exec under
# `node` (always present — maude itself runs on Node), not Bun.
#
# Usage:
#   read-annotations.sh <rel-path> [--root <repo>] [--canvas-state <path>]
#   (see read-annotations.mjs --help for the full contract)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/read-annotations.mjs" "$@"
