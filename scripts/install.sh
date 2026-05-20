#!/usr/bin/env bash
# maude — environment check & dependency checklist.
#
# This script does NOT call `/plugin install` for you — those commands run
# inside Claude Code, not in your shell. It verifies prerequisites and prints
# the exact commands you should run next.

set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

ok()    { printf "${GREEN}✓${RESET} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$*"; }
fail()  { printf "${RED}✗${RESET} %s\n" "$*"; }
hdr()   { printf "\n${BOLD}%s${RESET}\n" "$*"; }
cmd()   { printf "  ${DIM}\$${RESET} %s\n" "$*"; }

errors=0

hdr "Environment"

# Node ≥ 20 (dev-server uses node:net, node:http, modern fetch — 18 minimum,
# 20 LTS recommended).
if command -v node >/dev/null 2>&1; then
  node_version=$(node -v | sed 's/^v//')
  node_major=${node_version%%.*}
  if [ "$node_major" -ge 20 ]; then
    ok "node v$node_version (≥ 20)"
  elif [ "$node_major" -ge 18 ]; then
    warn "node v$node_version — works, but 20+ recommended"
  else
    fail "node v$node_version — need ≥ 18 (20 LTS recommended)"
    errors=$((errors + 1))
  fi
else
  fail "node not found in PATH"
  errors=$((errors + 1))
fi

# Claude Code CLI presence — sanity check, not strictly required if user runs
# the desktop app.
if command -v claude >/dev/null 2>&1; then
  ok "claude CLI: $(command -v claude)"
else
  warn "claude CLI not in PATH (fine if you use Claude Desktop or the IDE extension)"
fi

if [ $errors -gt 0 ]; then
  hdr "Fix the failures above, then re-run this script."
  exit 1
fi

hdr "Next: install plugin dependencies inside Claude Code"

echo "Run these slash commands from any Claude Code session:"
echo
echo "  Required — Anthropic's official plugin marketplace:"
cmd "/plugin marketplace add anthropics/claude-code"
cmd "/plugin install frontend-design@claude-code"
echo
echo "  Optional — slider-based exploration for /design:explore:"
cmd "/plugin install playground@claude-code"

hdr "External tool — agent-browser"

cat <<'EOF'
Required for /design:screenshot and screenshot evidence in critic reports.
Standalone Rust CLI from https://agent-browser.dev — install with:

  npm install -g agent-browser            # all platforms
  # or
  brew install agent-browser              # macOS
  # or
  npx agent-browser open example.com      # try without installing

Then run once to fetch Chrome:

  agent-browser install

Without it: /design, /design:new, /design:critic still work — you just lose
screenshot evidence in critic reports.
EOF

hdr "Install this plugin"

cat <<'EOF'
From this directory (local development):
EOF
cmd "/plugin marketplace add $repo_root"
cmd "/plugin install design@maude"

cat <<'EOF'

From GitHub (once published):
EOF
cmd "/plugin marketplace add 1aGh/maude"
cmd "/plugin install design@maude"

hdr "Done."
echo "Then try:  /design \"make the header sticky\""
