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

PATHS_JOINED=$(printf "'%s'," "$PKG_PATH" "${PLUGIN_PATHS[@]}")
PATHS_JOINED="${PATHS_JOINED%,}"

node -e "
  const fs = require('fs');
  for (const p of [$PATHS_JOINED]) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.version = '$NEW';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
"

"$ROOT/scripts/check-version-parity.sh"
echo ""
echo "Review the diff, then:"
echo "  git commit -am 'chore: release v$NEW' && git tag v$NEW && git push --follow-tags"
