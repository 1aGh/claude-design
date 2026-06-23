#!/usr/bin/env bash
# Ensures package.json, every plugin's .claude-plugin/plugin.json, and every
# per-platform sub-package (DDR-015) carry the same version. All files must
# move together — the npm CLI, the Claude Code plugins, and the platform
# binaries ship under one release line.
#
# Also enforces that the main package's `optionalDependencies` pin every
# sub-package to that same version (otherwise npm won't fetch the matching
# binary at install time).
#
# Run before tagging, before publishing, and in CI.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"
PLUGIN_PATHS=(
  "$ROOT/plugins/design/.claude-plugin/plugin.json"
  "$ROOT/plugins/flow/.claude-plugin/plugin.json"
)
SUBPACKAGE_PATHS=(
  "$ROOT/packages/maude-darwin-arm64/package.json"
  "$ROOT/packages/maude-darwin-x64/package.json"
  "$ROOT/packages/maude-linux-x64/package.json"
  "$ROOT/packages/maude-linux-arm64/package.json"
  "$ROOT/packages/maude-linux-x64-musl/package.json"
  "$ROOT/packages/maude-linux-arm64-musl/package.json"
  "$ROOT/packages/maude-win32-x64/package.json"
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

for sub in "${SUBPACKAGE_PATHS[@]}"; do
  # Sub-packages may not yet exist on older branches — skip in that case.
  [ ! -f "$sub" ] && continue
  SUB_VER=$(node -p "require('$sub').version")
  if [ "$PKG_VER" != "$SUB_VER" ]; then
    rel="${sub#$ROOT/}"
    echo "error: version mismatch" >&2
    printf "  %-50s %s\n" "package.json:" "$PKG_VER" >&2
    printf "  %-50s %s\n" "$rel:" "$SUB_VER" >&2
    mismatches=$((mismatches + 1))
  fi
done

# Native desktop shell (Phase 32) — tauri.conf.json drives the auto-updater's
# {{current_version}}; Cargo.toml drives the native About box. Both ship under the
# same release line and must equal package.json. May be absent on older branches.
TAURI_CONF_PATH="$ROOT/apps/desktop/src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONF_PATH" ]; then
  TAURI_VER=$(node -p "require('$TAURI_CONF_PATH').version")
  if [ "$PKG_VER" != "$TAURI_VER" ]; then
    echo "error: version mismatch" >&2
    printf "  %-50s %s\n" "package.json:" "$PKG_VER" >&2
    printf "  %-50s %s\n" "apps/desktop/src-tauri/tauri.conf.json:" "$TAURI_VER" >&2
    mismatches=$((mismatches + 1))
  fi
fi

CARGO_TOML_PATH="$ROOT/apps/desktop/src-tauri/Cargo.toml"
if [ -f "$CARGO_TOML_PATH" ]; then
  CARGO_VER=$(grep -m1 '^version = ' "$CARGO_TOML_PATH" | sed -E 's/version = "(.*)"/\1/')
  if [ "$PKG_VER" != "$CARGO_VER" ]; then
    echo "error: version mismatch" >&2
    printf "  %-50s %s\n" "package.json:" "$PKG_VER" >&2
    printf "  %-50s %s\n" "apps/desktop/src-tauri/Cargo.toml:" "$CARGO_VER" >&2
    mismatches=$((mismatches + 1))
  fi
fi

# optionalDependencies pin parity — every @1agh/maude-* entry must equal PKG_VER.
mismatches=$((mismatches + $(node -e "
  const j = require('$PKG_PATH');
  const od = j.optionalDependencies || {};
  let n = 0;
  for (const [k, v] of Object.entries(od)) {
    if (!k.startsWith('@1agh/maude-')) continue;
    if (v !== j.version) {
      console.error('error: optionalDependencies pin mismatch:');
      console.error('  package.json version:', j.version);
      console.error('  ' + k + ':', v);
      n++;
    }
  }
  console.log(n);
")))

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
for sub in "${SUBPACKAGE_PATHS[@]}"; do
  [ -f "$sub" ] && echo "  ${sub#$ROOT/}"
done
[ -f "$TAURI_CONF_PATH" ] && echo "  apps/desktop/src-tauri/tauri.conf.json"
[ -f "$CARGO_TOML_PATH" ] && echo "  apps/desktop/src-tauri/Cargo.toml"
