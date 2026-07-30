#!/usr/bin/env bash
# Pre-tag guard: every relative import in a tracked source file must have a
# tracked target. See kgai `pre-tag-import-coherence-guard` — twice in the
# v0.51.0 release a `git add` of a shared file carried a parallel session's
# in-flight import into main while the module itself stayed untracked, which
# is green locally and fatal in CI.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
missing=0
while IFS= read -r f; do
  d=$(dirname "$f")
  while IFS= read -r imp; do
    [ -z "$imp" ] && continue
    if ! git ls-files --error-unmatch "$d/$imp" >/dev/null 2>&1; then
      echo "MISSING $f -> $imp"
      missing=1
    fi
  done < <(grep -a -oE "from '\./[A-Za-z0-9_.-]+\.(ts|tsx|mjs|jsx)'" "$f" 2>/dev/null | sed "s|from '\./||;s|'||")
done < <(git ls-files '*.ts' '*.tsx' '*.mjs' '*.jsx' | grep -v node_modules | grep -v '/test/')
[ "$missing" = 0 ] && echo "import coherence: OK"
exit $missing
