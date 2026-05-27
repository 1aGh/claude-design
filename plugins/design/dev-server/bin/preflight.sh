#!/usr/bin/env bash
# preflight.sh — design plugin dependency health check.
# Thin shell wrapper over `node cli/lib/preflight.mjs --plugin design`.
# Keeps the detection logic in one place (the .mjs lib) while exposing the
# bash-friendly modes (--shell-export, --warn-only) that init.md and the
# SessionStart hook need.
#
# Usage:
#   preflight.sh                    # text table (humans)
#   preflight.sh --json             # machine-readable envelope
#   preflight.sh --shell-export     # `export DEPS_OK=... DEPS_MISSING=...`
#   preflight.sh --quiet            # silent on success, one-liner on miss
#   preflight.sh --warn-only        # same as --quiet (SessionStart hook)
#
# Resolution (DDR-045): never compute paths from `dirname $0` inside a
# `bun --compile` standalone binary — that maps to /$bunfs/root. The CLI
# entry stays Node, so we resolve via $CLAUDE_PLUGIN_ROOT first, with the
# script-dir fallback only used when running uncompiled from the repo.
#
# Exit: 0 if all hard deps pass; 1 otherwise.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PKG_ROOT="$(cd "$PLUGIN_ROOT/../.." && pwd)"

# The Node lib needs cwd to be the package root (it resolves dependencies.json
# via `plugins/<plugin>/dependencies.json`). Subshell so we don't mutate the
# caller's cwd.
(
  cd "$PKG_ROOT" || exit 1
  exec node "$PKG_ROOT/cli/lib/preflight.mjs" --plugin design "$@"
)
