#!/usr/bin/env bash
# Post-rebrand cleanup: unpublish (within 72h window) + deprecate older versions
# of @1agh/md-claude and 7 per-platform sub-packages.
#
# Run interactively. You'll be prompted for OTP. The script enters OTP once per
# 30s window — npm sometimes accepts a single OTP for multiple commands within
# the same window, sometimes not. If a command fails with E401/OTP rejected,
# wait for the next 30s window and try a fresh OTP.
#
# DEADLINE: 0.14.0 unpublish must complete before 2026-05-23T00:45Z
# (72h from npm publish time of 0.14.0 → 2026-05-20T00:45Z).

set -uo pipefail

read -p "npm OTP (6 digits): " OTP
[ -z "$OTP" ] && { echo "no OTP, aborting"; exit 1; }

# Versions WITHIN 72h window → unpublish
UNPUBLISH=(
  "@1agh/md-claude@0.13.1"
  "@1agh/md-claude@0.14.0"
  "@1agh/md-claude-darwin-arm64@0.13.0"
  "@1agh/md-claude-darwin-arm64@0.13.1"
  "@1agh/md-claude-darwin-arm64@0.14.0"
  "@1agh/md-claude-darwin-x64@0.13.1"
  "@1agh/md-claude-darwin-x64@0.14.0"
  "@1agh/md-claude-linux-x64@0.13.0"
  "@1agh/md-claude-linux-x64@0.13.1"
  "@1agh/md-claude-linux-x64@0.14.0"
  "@1agh/md-claude-linux-arm64@0.13.0"
  "@1agh/md-claude-linux-arm64@0.13.1"
  "@1agh/md-claude-linux-arm64@0.14.0"
  "@1agh/md-claude-linux-x64-musl@0.13.1"
  "@1agh/md-claude-linux-x64-musl@0.14.0"
  "@1agh/md-claude-linux-arm64-musl@0.13.1"
  "@1agh/md-claude-linux-arm64-musl@0.14.0"
  "@1agh/md-claude-win32-x64@0.13.1"
  "@1agh/md-claude-win32-x64@0.14.0"
)

# Older versions (> 72h) → deprecate with redirect message
DEPRECATE=(
  "@1agh/md-claude@0.4.0"
  "@1agh/md-claude@0.6.0"
  "@1agh/md-claude@0.6.1"
  "@1agh/md-claude@0.7.0"
  "@1agh/md-claude@0.8.0"
  "@1agh/md-claude@0.9.0"
  "@1agh/md-claude@0.10.0"
  "@1agh/md-claude@0.10.1"
  "@1agh/md-claude@0.11.0"
  "@1agh/md-claude@0.12.0"
)

echo "=== unpublish (${#UNPUBLISH[@]} versions, all <72h) ==="
for pkg in "${UNPUBLISH[@]}"; do
  echo "→ npm unpublish $pkg"
  npm unpublish "$pkg" --otp "$OTP" 2>&1 | tail -3
  echo ""
done

echo "=== deprecate older versions (${#DEPRECATE[@]} versions, all >72h) ==="
for pkg in "${DEPRECATE[@]}"; do
  echo "→ npm deprecate $pkg"
  npm deprecate "$pkg" 'Renamed to @1agh/maude. Run: npm i -g @1agh/maude' --otp "$OTP" 2>&1 | tail -3
  echo ""
done

# Also deprecate the empty package shells (now that all versions are unpublished
# or deprecated, set a top-level deprecation on the whole package for npm UI)
echo "=== blanket-deprecate any remaining @1agh/md-claude* shells ==="
for pkg in @1agh/md-claude @1agh/md-claude-darwin-arm64 @1agh/md-claude-darwin-x64 \
           @1agh/md-claude-linux-x64 @1agh/md-claude-linux-arm64 \
           @1agh/md-claude-linux-x64-musl @1agh/md-claude-linux-arm64-musl \
           @1agh/md-claude-win32-x64; do
  echo "→ npm deprecate '$pkg@*'"
  npm deprecate "$pkg@*" 'Renamed to @1agh/maude. Run: npm i -g @1agh/maude' --otp "$OTP" 2>&1 | tail -2
done

echo ""
echo "=== verify ==="
for pkg in @1agh/md-claude @1agh/md-claude-darwin-arm64 @1agh/md-claude-darwin-x64 \
           @1agh/md-claude-linux-x64 @1agh/md-claude-linux-arm64 \
           @1agh/md-claude-linux-x64-musl @1agh/md-claude-linux-arm64-musl \
           @1agh/md-claude-win32-x64; do
  v=$(npm view "$pkg" version 2>/dev/null || echo "GONE")
  d=$(npm view "$pkg" deprecated 2>/dev/null || echo "")
  echo "  $pkg: latest=$v deprecated='$d'"
done
