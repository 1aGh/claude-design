#!/usr/bin/env bash
# Bumps version in package.json AND every plugin's .claude-plugin/plugin.json
# together. Use this instead of `npm version` so files never drift.
#
# Plugins covered:
#   - plugins/design/.claude-plugin/plugin.json
#   - plugins/flow/.claude-plugin/plugin.json
#
# Usage:
#   scripts/bump-version.sh patch    # 0.4.0 → 0.4.1
#   scripts/bump-version.sh minor    # 0.4.0 → 0.5.0
#   scripts/bump-version.sh major    # 0.4.0 → 1.0.0
#   scripts/bump-version.sh 1.2.3    # explicit version
#
# After bumping, this script does NOT commit, tag, or push — review the diff,
# then run:
#   git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"
PLUGIN_PATHS=(
  "$ROOT/plugins/design/.claude-plugin/plugin.json"
  "$ROOT/plugins/flow/.claude-plugin/plugin.json"
)
# Per-platform sub-packages (Phase 3.4 / DDR-015) — versioned in lockstep with
# the main tarball because the main package's optionalDependencies pin them.
SUBPACKAGE_PATHS=(
  "$ROOT/packages/maude-darwin-arm64/package.json"
  "$ROOT/packages/maude-darwin-x64/package.json"
  "$ROOT/packages/maude-linux-x64/package.json"
  "$ROOT/packages/maude-linux-arm64/package.json"
  "$ROOT/packages/maude-linux-x64-musl/package.json"
  "$ROOT/packages/maude-linux-arm64-musl/package.json"
  "$ROOT/packages/maude-win32-x64/package.json"
)

if [ $# -ne 1 ]; then
  echo "usage: $0 <patch|minor|major|X.Y.Z>" >&2
  exit 2
fi

CURRENT=$(node -p "require('$PKG_PATH').version")

case "$1" in
  patch|minor|major)
    NEW=$(node -p "
      const [a,b,c] = '$CURRENT'.split('.').map(Number);
      const kind = '$1';
      kind === 'major' ? \`\${a+1}.0.0\` :
      kind === 'minor' ? \`\${a}.\${b+1}.0\` :
                         \`\${a}.\${b}.\${c+1}\`
    ")
    ;;
  *)
    if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "error: '$1' is not patch|minor|major or a valid X.Y.Z" >&2
      exit 2
    fi
    NEW="$1"
    ;;
esac

echo "$CURRENT → $NEW"

PATHS_JOINED=$(printf "'%s'," "$PKG_PATH" "${PLUGIN_PATHS[@]}" "${SUBPACKAGE_PATHS[@]}")
PATHS_JOINED="${PATHS_JOINED%,}"

node -e "
  const fs = require('fs');
  for (const p of [$PATHS_JOINED]) {
    if (!fs.existsSync(p)) continue; // sub-packages may be absent in early branches
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.version = '$NEW';
    // The main package pins its sub-packages via optionalDependencies — bump
    // those too so they always agree with the version we just wrote.
    if (j.optionalDependencies) {
      for (const k of Object.keys(j.optionalDependencies)) {
        if (k.startsWith('@1agh/maude-')) j.optionalDependencies[k] = '$NEW';
      }
    }
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
"

# Stamp any pending What's New entries (version:null) with the new version + date.
node "$ROOT/scripts/stamp-whats-new.mjs" "$NEW"

"$ROOT/scripts/check-version-parity.sh"
echo ""
echo "Review the diff, then:"
echo "  git commit -am 'chore: release v$NEW' && git tag v$NEW && git push --follow-tags"
