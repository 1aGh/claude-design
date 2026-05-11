#!/usr/bin/env bash
# Ensures package.json and plugins/design/.claude-plugin/plugin.json carry the
# same version. Both files must move together — the npm CLI and the Claude Code
# plugin are two faces of the same release.
#
# Run before tagging, before publishing, and in CI.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"
PLUGIN_PATH="$ROOT/plugins/design/.claude-plugin/plugin.json"

if [ ! -f "$PKG_PATH" ]; then
  echo "error: missing $PKG_PATH" >&2
  exit 2
fi
if [ ! -f "$PLUGIN_PATH" ]; then
  echo "error: missing $PLUGIN_PATH" >&2
  exit 2
fi

PKG_VER=$(node -p "require('$PKG_PATH').version")
PLUGIN_VER=$(node -p "require('$PLUGIN_PATH').version")

if [ "$PKG_VER" != "$PLUGIN_VER" ]; then
  echo "error: version mismatch" >&2
  echo "  package.json:                              $PKG_VER" >&2
  echo "  plugins/design/.claude-plugin/plugin.json: $PLUGIN_VER" >&2
  echo "" >&2
  echo "Bump both to the same version before release. Suggested:" >&2
  echo "  npm version <new-version> --no-git-tag-version" >&2
  echo "  # then manually edit plugin.json to match, OR use scripts/bump-version.sh" >&2
  exit 1
fi

echo "version parity OK: $PKG_VER"
