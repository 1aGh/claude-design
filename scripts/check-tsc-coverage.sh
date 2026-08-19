#!/usr/bin/env bash
# Every tracked, non-test TypeScript source under apps/studio must be REACHED by
# the typechecker.
#
# WHY THIS EXISTS. `apps/studio/tsconfig.json` used to list its roots by hand and
# the list had no `*.tsx` entry, so 52 tracked files — `canvas-lib.tsx` (the
# library every canvas imports), every overlay, `commands/**`, two `sync/` modules
# — were checked by NOTHING. Not a lax rule: no rule at all. Driving the surface
# to zero errors is worthless if the surface can quietly shrink again, so this is
# the ratchet: `include` is now broad (`**/*.ts` / `**/*.tsx`), and this asserts
# that what tsc actually loads still covers what git actually tracks.
#
# Uses `tsc --listFiles`, i.e. the checker's OWN answer about what it read —
# never a re-implementation of tsconfig's include/exclude globs.
#
# Exit 0 = every tracked source is checked. Exit 1 = orphans, listed by name.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
STUDIO="$ROOT/apps/studio"

cd "$STUDIO"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# What the checker read, restricted to this package and normalized to paths
# relative to apps/studio.
#
# `--listFiles` exits non-zero when the program has type errors; coverage is a
# separate question from correctness (quality.yml runs `tsc --noEmit` for that),
# so the exit code is deliberately ignored here and only the file list is used.
bunx tsc --noEmit --listFiles 2>/dev/null \
  | grep "^$STUDIO/" \
  | grep -v '/node_modules/' \
  | sed "s|^$STUDIO/||" \
  | sort -u > "$TMP/covered.txt" || true

if [ ! -s "$TMP/covered.txt" ]; then
  echo "check-tsc-coverage: tsc --listFiles produced nothing — is the toolchain installed?" >&2
  exit 1
fi

# What git tracks: TypeScript sources, minus tests (excluded from the program on
# purpose) and minus build output.
git ls-files '*.ts' '*.tsx' \
  | grep -v '\.test\.ts$' \
  | grep -v '\.test\.tsx$' \
  | grep -v '^dist/' \
  | sort -u > "$TMP/tracked.txt"

ORPHANS=$(comm -23 "$TMP/tracked.txt" "$TMP/covered.txt")

if [ -n "$ORPHANS" ]; then
  COUNT=$(printf '%s\n' "$ORPHANS" | wc -l | tr -d ' ')
  echo "✗ $COUNT tracked source file(s) under apps/studio are reached by NO typechecker:" >&2
  printf '%s\n' "$ORPHANS" | sed 's/^/    /' >&2
  echo "" >&2
  echo "  Fix apps/studio/tsconfig.json 'include' (or 'exclude') so the checker sees them." >&2
  echo "  Do not silence this by deleting the file from git — that is the same hole." >&2
  exit 1
fi

TOTAL=$(wc -l < "$TMP/tracked.txt" | tr -d ' ')
echo "✓ tsc coverage: all $TOTAL tracked non-test sources under apps/studio are checked"
