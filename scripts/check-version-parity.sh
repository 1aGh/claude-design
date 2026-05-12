#!/usr/bin/env bash
# Ensures package.json and every plugin's .claude-plugin/plugin.json carry the
# same version. All files must move together — the npm CLI and the Claude Code
# plugins ship under one release line.
#
# Plugins covered:
#   - plugins/design/.claude-plugin/plugin.json
#   - plugins/flow/.claude-plugin/plugin.json
#
# Run before tagging, before publishing, and in CI.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"
PLUGIN_PATHS=(
  "$ROOT/plugins/design/.claude-plugin/plugin.json"
  "$ROOT/plugins/flow/.claude-plugin/plugin.json"
)

if [ ! -f "$PKG_PATH" ]; then
  echo "error: missing $PKG_PATH" >&2
  exit 2
fi

PKG_VER=$(node -p "require('$PKG_PATH').version")

mismatches=0
for plugin in "${PLUGIN_PATHS[@]}"; do
  if [ ! -f "$plugin" ]; then
    echo "error: missing $plugin" >&2
    exit 2
  fi
  PLUGIN_VER=$(node -p "require('$plugin').version")
  if [ "$PKG_VER" != "$PLUGIN_VER" ]; then
    rel="${plugin#$ROOT/}"
    echo "error: version mismatch" >&2
    printf "  %-50s %s\n" "package.json:" "$PKG_VER" >&2
    printf "  %-50s %s\n" "$rel:" "$PLUGIN_VER" >&2
    mismatches=$((mismatches + 1))
  fi
done

if [ $mismatches -gt 0 ]; then
  echo "" >&2
  echo "Bump all files to the same version before release:" >&2
  echo "  scripts/bump-version.sh patch    # 0.4.0 → 0.4.1" >&2
  echo "  scripts/bump-version.sh minor    # 0.4.0 → 0.5.0" >&2
  echo "  scripts/bump-version.sh X.Y.Z    # explicit" >&2
  exit 1
fi

echo "version parity OK: $PKG_VER"
echo "  package.json"
for plugin in "${PLUGIN_PATHS[@]}"; do
  echo "  ${plugin#$ROOT/}"
done
