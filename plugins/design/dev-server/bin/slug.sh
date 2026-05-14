#!/usr/bin/env bash
# slug.sh — normalize a canvas relative-path into a filesystem-safe slug.
# Canonical recipe for `_history/<slug>/` path computation. Sourced from
# `commands/edit.md` step 3 originally; now the single source of truth.
#
# Usage:  slug.sh "<path-relative-to-designRoot>"
# Output: lowercase kebab slug — e.g. "ui/showcase/Match Recap.html" -> "ui-showcase-match_recap"

if [ $# -lt 1 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: slug.sh <relative-path>" >&2
  echo "Example: slug.sh 'ui/showcase/Match Recap.html' -> ui-showcase-match_recap" >&2
  [ "$1" = "--help" ] || [ "$1" = "-h" ] && exit 0
  exit 1
fi

printf '%s' "${1#./}" \
  | tr '/' '-' \
  | tr ' ' '_' \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/\.html$//' \
  | sed 's/^\.\+//'
echo
