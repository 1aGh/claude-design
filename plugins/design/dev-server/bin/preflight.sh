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
# `bun --compile` standalone binary — that maps to /$bunfs/root.
#
# Resolution (DDR-061): in a MARKETPLACE install the plugin is copied alone into
# `cache/<marketplace>/<plugin>/<version>/` — there is NO sibling `$PKG_ROOT/cli/`.
# So: use the sibling `cli/lib` when it exists (running uncompiled from the repo
# or an npm package, where cli/ is present); otherwise reach the check through
# the on-PATH `maude` binary (a declared plugin dependency), which resolves the
# manifest from its own package root. Fixing a straggler — the relative-path
# crash (`Cannot find module …/cache/maude/cli/lib/preflight.mjs`) that the cache
# steps already avoid by calling on-PATH `maude`.
#
# Exit: 0 if all hard deps pass; 1 otherwise.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
PKG_ROOT="$(cd "$PLUGIN_ROOT/../.." && pwd)"

if [ -f "$PKG_ROOT/cli/lib/preflight.mjs" ]; then
  # Sibling cli/ present (repo / npm package). The Node lib needs cwd = package
  # root (it resolves `plugins/<plugin>/dependencies.json`). Subshell preserves
  # the caller's cwd.
  ( cd "$PKG_ROOT" || exit 1; exec node "$PKG_ROOT/cli/lib/preflight.mjs" --plugin design "$@" )
elif command -v maude >/dev/null 2>&1; then
  exec maude preflight --plugin design "$@"
else
  echo "preflight: no cli/lib beside the plugin and 'maude' not on PATH — install maude (npm i -g @1agh/maude)." >&2
  exit 1
fi
