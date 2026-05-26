#!/usr/bin/env bash
# asset-sweep.sh — pre-scaffold real-asset sweep for `/design:setup-ds`.
# Greps a target repo for production sources of logo/mark/wordmark/mascot/glyph/
# illustration BEFORE Batch A authors any placeholder. Single hit at a
# conventional path → copy 1:1. Multiple hits → caller asks user via
# AskUserQuestion. Zero hits → THEN placeholder authorship is permitted.
#
# Closes D-2 in the studyfi imprint-bootstrap retro (placeholder bleed).
# Spec: `.ai/plans/phase-3.7-setup-ds-hardening-and-motion-subsystem.md` Task 1.
#
# Usage:
#   asset-sweep.sh --root <repo> [--query "logo,mark,wordmark,mascot,glyph,illustration"]
#                                [--depth 6] [--ext "svg,png"]
#
# Defaults:
#   --query  "logo,mark,wordmark,mascot,glyph,illustration"
#   --depth  6      (`find -maxdepth`; capped to keep monorepo sweeps < 2s)
#   --ext    "svg"  (svg-only by default — production marks are vector)
#
# Output: one JSON object on stdout, e.g.
#   { "logo": ["packages/ui/src/components/ui/logo/logo.svg"],
#     "mark": [],
#     "wordmark": [],
#     "mascot": [],
#     "glyph": ["packages/ui/.../glyphs/sparkle.svg",
#               "packages/ui/.../glyphs/check.svg"],
#     "illustration": [] }
#
# Paths are relative to --root. Sorted lexicographically. Duplicates removed.
# Excludes: node_modules/, .git/, .design/_history/, .next/, dist/, build/.
#
# Exit: 0 always (zero hits is a valid result, not an error). 2 = bad args.

ROOT=""
QUERY="logo,mark,wordmark,mascot,glyph,illustration"
DEPTH=6
EXT="svg"

while [ $# -gt 0 ]; do
  case "$1" in
    --root)  ROOT="$2";  shift 2 ;;
    --query) QUERY="$2"; shift 2 ;;
    --depth) DEPTH="$2"; shift 2 ;;
    --ext)   EXT="$2";   shift 2 ;;
    --help|-h)
      sed -n '2,30p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "asset-sweep.sh: unknown arg '$1' (try --help)" >&2
      exit 2
      ;;
  esac
done

if [ -z "$ROOT" ]; then
  echo "asset-sweep.sh: --root <repo> required" >&2
  exit 2
fi
if [ ! -d "$ROOT" ]; then
  echo "asset-sweep.sh: --root '$ROOT' is not a directory" >&2
  exit 2
fi

# Resolve --root to an absolute path so the relative-path strip below is stable
# regardless of caller cwd.
ROOT_ABS=$(cd "$ROOT" && pwd)

# Build the find -name predicate for the extension list.
# EXT="svg,png" → \( -name "*.svg" -o -name "*.png" \)
ext_predicate=()
IFS=',' read -r -a EXT_ARR <<< "$EXT"
ext_predicate+=("(")
first=1
for e in "${EXT_ARR[@]}"; do
  e_trim=$(echo "$e" | tr -d '[:space:]')
  [ -z "$e_trim" ] && continue
  if [ $first -eq 1 ]; then
    ext_predicate+=("-name" "*.$e_trim")
    first=0
  else
    ext_predicate+=("-o" "-name" "*.$e_trim")
  fi
done
ext_predicate+=(")")

# Single find pass; bucket by noun in-memory. Earlier per-noun-find walked the
# tree N times (6× for default query) — ~4s on a 20k-file repo. Single pass
# pushes us under the 2s/50k budget from the phase plan.
#
# Match policy (case-insensitive): a file is bucketed under noun N if N appears
# as a substring of the basename OR as a path segment in the parent chain
# (catches `packages/ui/.../logo/logo.svg` AND `assets/glyphs/foo.svg`).

# Normalize nouns once.
IFS=',' read -r -a NOUNS <<< "$QUERY"
declare -a NOUNS_LC=()
for n in "${NOUNS[@]}"; do
  n_trim=$(echo "$n" | tr -d '[:space:]')
  [ -z "$n_trim" ] && continue
  NOUNS_LC+=("$(printf '%s' "$n_trim" | tr '[:upper:]' '[:lower:]')")
done

# Buckets keyed by noun. Bash 4+ supports declare -A; macOS ships bash 3.2
# by default — fall back to a per-noun delimiter-joined string in flat vars.
declare -a BUCKETS=()
for _ in "${NOUNS_LC[@]}"; do BUCKETS+=(""); done

# Walk once. Prune vendor/build dirs to keep the tree small.
while IFS= read -r f; do
  [ -z "$f" ] && continue
  rel="${f#"$ROOT_ABS"/}"
  base="${f##*/}"
  base_lc=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')
  parent="${f%/*}"
  parent_lc=$(printf '%s' "$parent" | tr '[:upper:]' '[:lower:]')
  i=0
  for noun in "${NOUNS_LC[@]}"; do
    matched=0
    case "$base_lc" in *"$noun"*) matched=1 ;; esac
    if [ $matched -eq 0 ]; then
      case "$parent_lc" in
        *"/$noun"*|*"/$noun"|*"/${noun}s"*|*"/${noun}s") matched=1 ;;
      esac
    fi
    if [ $matched -eq 1 ]; then
      if [ -z "${BUCKETS[$i]}" ]; then
        BUCKETS[$i]="$rel"
      else
        BUCKETS[$i]="${BUCKETS[$i]}"$'\n'"$rel"
      fi
    fi
    i=$((i + 1))
  done
done < <(
  find "$ROOT_ABS" \
      -maxdepth "$DEPTH" \
      \( \
        -path "*/node_modules" -o \
        -path "*/.git" -o \
        -path "*/.design/_history" -o \
        -path "*/.next" -o \
        -path "*/dist" -o \
        -path "*/build" -o \
        -path "*/coverage" -o \
        -path "*/.turbo" -o \
        -path "*/.cache" \
      \) -prune -o \
      -type f \
      "${ext_predicate[@]}" \
      -print 2>/dev/null
)

# JSON emission. Avoid jq as a hard dep (matches server-up.sh's defensive
# posture) — the JSON shape is small + predictable.
printf '{'
first=1
i=0
for noun in "${NOUNS_LC[@]}"; do
  if [ $first -eq 0 ]; then printf ','; fi
  first=0
  printf '\n  "%s": [' "$noun"
  if [ -n "${BUCKETS[$i]}" ]; then
    # Sort + dedupe, then JSON-emit.
    printf '\n'
    ln_first=1
    while IFS= read -r hit; do
      [ -z "$hit" ] && continue
      esc=$(printf '%s' "$hit" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
      if [ $ln_first -eq 0 ]; then printf ',\n'; fi
      ln_first=0
      printf '    "%s"' "$esc"
    done < <(printf '%s\n' "${BUCKETS[$i]}" | sort -u)
    printf '\n  ]'
  else
    printf ']'
  fi
  i=$((i + 1))
done
printf '\n}\n'
