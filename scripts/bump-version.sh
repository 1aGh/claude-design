#!/usr/bin/env bash
# Bumps version in package.json AND plugins/design/.claude-plugin/plugin.json
# together. Use this instead of `npm version` so the two files never drift.
#
# Usage:
#   scripts/bump-version.sh patch    # 0.3.2 → 0.3.3
#   scripts/bump-version.sh minor    # 0.3.2 → 0.4.0
#   scripts/bump-version.sh major    # 0.3.2 → 1.0.0
#   scripts/bump-version.sh 1.2.3    # explicit version
#
# After bumping, this script does NOT commit, tag, or push — review the diff,
# then run:
#   git commit -am "chore: release vX.Y.Z" && git tag vX.Y.Z && git push --follow-tags
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
PKG_PATH="$ROOT/package.json"
PLUGIN_PATH="$ROOT/plugins/design/.claude-plugin/plugin.json"

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

node -e "
  const fs = require('fs');
  for (const p of ['$PKG_PATH', '$PLUGIN_PATH']) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.version = '$NEW';
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
"

"$ROOT/scripts/check-version-parity.sh"
echo ""
echo "Review the diff, then:"
echo "  git commit -am 'chore: release v$NEW' && git tag v$NEW && git push --follow-tags"
