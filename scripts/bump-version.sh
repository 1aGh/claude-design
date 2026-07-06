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
# The native desktop shell (Phase 32) ships under the same release line — its
# tauri.conf.json `version` drives the auto-updater's `{{current_version}}`, so it
# MUST move in lockstep with package.json + the plugin manifests.
TAURI_CONF_PATH="$ROOT/apps/desktop/src-tauri/tauri.conf.json"
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

PATHS_JOINED=$(printf "'%s'," "$PKG_PATH" "${PLUGIN_PATHS[@]}" "${SUBPACKAGE_PATHS[@]}" "$TAURI_CONF_PATH")
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

# tauri.conf.json has short arrays (updater.endpoints / bundle.externalBin) that
# biome's formatter keeps on a single line, but the JSON.stringify writer above
# re-expands them onto multiple lines — which fails the `Lint (biome)` quality
# gate on EVERY release (regressed v0.38.1). Reformat it back to biome's style so
# the committed file stays clean. Best-effort: skip silently if biome is absent.
npx --no-install biome format --write "$TAURI_CONF_PATH" >/dev/null 2>&1 || true

# The desktop crate's Cargo.toml is TOML, not JSON — bump its [package] version
# (drives env!("CARGO_PKG_VERSION") in the native About box) so it never drifts
# from tauri.conf.json. Only the first `version = "…"` (the [package] one) is touched.
CARGO_TOML_PATH="$ROOT/apps/desktop/src-tauri/Cargo.toml"
if [ -f "$CARGO_TOML_PATH" ]; then
  NEW="$NEW" node -e "
    const fs = require('fs');
    const p = '$CARGO_TOML_PATH';
    const s = fs.readFileSync(p, 'utf8');
    const out = s.replace(/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/m, 'version = \"' + process.env.NEW + '\"');
    fs.writeFileSync(p, out);
  "
fi

# Cargo.lock records the workspace member's version too. Without this, the
# lockfile drifts after every release until the next cargo run rewrites it —
# outside the release commit, as a stray working-tree modification.
CARGO_LOCK_PATH="$ROOT/apps/desktop/src-tauri/Cargo.lock"
if [ -f "$CARGO_LOCK_PATH" ]; then
  NEW="$NEW" node -e "
    const fs = require('fs');
    const p = '$CARGO_LOCK_PATH';
    const s = fs.readFileSync(p, 'utf8');
    const out = s.replace(/(name = \"maude-desktop\"\nversion = )\"[0-9]+\.[0-9]+\.[0-9]+\"/, '\$1\"' + process.env.NEW + '\"');
    fs.writeFileSync(p, out);
  "
fi

# Stamp any pending What's New entries (version:null) with the new version + date.
node "$ROOT/scripts/stamp-whats-new.mjs" "$NEW"

"$ROOT/scripts/check-version-parity.sh"
echo ""
echo "Review the diff, then:"
echo "  git commit -am 'chore: release v$NEW' && git tag v$NEW && git push --follow-tags"
