#!/usr/bin/env bash
# Idempotent GitHub repo administration. Re-runnable; serves as documentation
# for "what state should this repo's settings be in".
#
# Requirements:
#   - gh CLI logged in with `repo` admin scope (`gh auth status`)
#   - jq available (only used for the labels loop)
#
# What it applies to 1aGh/md-claude:
#   1. Branch protection on `main` (from scripts/github/main-protection.json)
#   2. Repo settings (squash-only merge, auto-merge, delete branch on merge,
#      issues + discussions enabled)
#   3. Labels (from scripts/github/labels.json — additive; never deletes)
#   4. CODEOWNERS sanity (warns if .github/CODEOWNERS missing)
#   5. NPM_TOKEN secret presence (warns if missing — secret value set manually)
#   6. Discussions categories (best-effort; logs and continues on failure)
set -euo pipefail

REPO=${REPO:-1aGh/md-claude}
ROOT=$(cd "$(dirname "$0")/.." && pwd)

note()  { printf '\033[36m▸\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m⚠\033[0m %s\n' "$*" >&2; }
ok()    { printf '\033[32m✓\033[0m %s\n' "$*"; }
fail()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v gh >/dev/null || fail "gh CLI is not installed (https://cli.github.com)"
command -v jq >/dev/null || fail "jq is not installed (brew install jq)"
gh auth status -h github.com >/dev/null 2>&1 || fail "gh CLI is not logged in (run: gh auth login)"

note "Target repo: $REPO"

# --- 1. Branch protection on main -----------------------------------------
note "Applying branch protection on main"
gh api -X PUT "repos/$REPO/branches/main/protection" \
  --input "$ROOT/scripts/github/main-protection.json" >/dev/null
ok   "Branch protection applied"

# --- 2. Repo settings ------------------------------------------------------
note "Applying repo settings (merge mode, auto-merge, branch cleanup, issues, discussions)"
gh repo edit "$REPO" \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --enable-auto-merge \
  --delete-branch-on-merge \
  --enable-issues \
  --enable-discussions >/dev/null
ok   "Repo settings applied"

# --- 3. Labels (additive — does not delete) -------------------------------
note "Seeding labels (existing labels are updated; nothing is deleted)"
COUNT=0
jq -c '.[]' "$ROOT/scripts/github/labels.json" | while read -r row; do
  name=$(echo "$row" | jq -r .name)
  color=$(echo "$row" | jq -r .color)
  desc=$(echo "$row" | jq -r .description)
  gh label create "$name" --color "$color" --description "$desc" --repo "$REPO" --force >/dev/null
  COUNT=$((COUNT+1))
done
ok "Labels seeded"

# --- 4. CODEOWNERS sanity --------------------------------------------------
if [ -f "$ROOT/.github/CODEOWNERS" ]; then
  ok "CODEOWNERS present"
else
  warn "CODEOWNERS missing at .github/CODEOWNERS"
fi

# --- 5. NPM_TOKEN secret check --------------------------------------------
if gh secret list --repo "$REPO" 2>/dev/null | grep -q '^NPM_TOKEN'; then
  ok "NPM_TOKEN secret is set"
else
  warn "NPM_TOKEN secret is NOT set — publish workflow will fail until it is"
  warn "  Create a token: https://www.npmjs.com/settings/~/tokens"
  warn "  Then: gh secret set NPM_TOKEN --repo $REPO --body '<token>'"
fi

# --- 6. Discussions categories (best-effort) ------------------------------
note "Seeding Discussions categories (best-effort — failures are logged, not fatal)"
for cat in "Q&A:QUESTION_ANSWER" "Show & tell:OPEN_ENDED" "Ideas:OPEN_ENDED" "Announcements:ANNOUNCEMENT"; do
  name="${cat%%:*}"
  format="${cat##*:}"
  if gh api graphql -f query='
      query($owner:String!,$name:String!){
        repository(owner:$owner, name:$name){
          discussionCategories(first:50){ nodes{ name } }
        }
      }' \
    -F owner="${REPO%%/*}" -F name="${REPO##*/}" 2>/dev/null \
    | jq -r '.data.repository.discussionCategories.nodes[].name' \
    | grep -Fxq "$name"; then
    ok "Discussion category '$name' already exists"
  else
    warn "Discussion category '$name' missing — create manually in repo settings (GraphQL mutation requires admin token + isn't always permitted)"
  fi
done

note "Done. Re-run any time: bash scripts/setup-github.sh"
