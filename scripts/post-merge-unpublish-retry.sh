#!/usr/bin/env bash
# Retry the 7 sub-package 0.14.0 unpublishes that failed in the first run.
# Theory: when only one version remains in a scoped package, npm refuses
# unpublish without --force (the "this removes the entire package" path).
#
# Usage:
#   NPM_TOKEN=npm_xxx bash scripts/post-merge-unpublish-retry.sh

set -uo pipefail

if [ -z "${NPM_TOKEN:-}" ]; then
  echo "error: set NPM_TOKEN" >&2
  exit 1
fi

NPM_RC=$(mktemp)
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "$NPM_RC"
trap 'rm -f "$NPM_RC"' EXIT
NPM=(npm --userconfig "$NPM_RC")

PACKAGES=(
  "@1agh/md-claude-darwin-arm64@0.14.0"
  "@1agh/md-claude-darwin-x64@0.14.0"
  "@1agh/md-claude-linux-x64@0.14.0"
  "@1agh/md-claude-linux-arm64@0.14.0"
  "@1agh/md-claude-linux-x64-musl@0.14.0"
  "@1agh/md-claude-linux-arm64-musl@0.14.0"
  "@1agh/md-claude-win32-x64@0.14.0"
)

echo "=== retry unpublish with --force (last-version constraint) ==="
for pkg in "${PACKAGES[@]}"; do
  echo "→ npm unpublish $pkg --force"
  "${NPM[@]}" unpublish "$pkg" --force --loglevel=verbose 2>&1 | tail -8
  echo ""
done

echo "=== verify ==="
for pkg in @1agh/md-claude-darwin-arm64 @1agh/md-claude-darwin-x64 \
           @1agh/md-claude-linux-x64 @1agh/md-claude-linux-arm64 \
           @1agh/md-claude-linux-x64-musl @1agh/md-claude-linux-arm64-musl \
           @1agh/md-claude-win32-x64; do
  versions=$(curl -s "https://registry.npmjs.org/${pkg//\//%2f}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('versions',{}).keys()) if 'versions' in d else 'GONE')" 2>/dev/null)
  echo "  $pkg: $versions"
done
