#!/usr/bin/env bash
# run.sh — build `kg` from source (once) into an isolated scratch home and run the
# kgai performance smoke test against this repo's DDR corpus. Nothing touches your
# repo working tree, ~/.kgai, or the Claude Code plugin install: the engine goes to
# $KGAI_SMOKE_HOME (default ./.smoke-home, gitignored) and the graph store to a temp dir.
#
# Requires: go (>=1.22) + a C compiler (cc). Re-runnable; rebuilds only when kgai src changes.
#
#   ./run.sh                 # clone kgai @ latest, build, run
#   KGAI_REF=v0.1.5 ./run.sh # pin a kgai release/branch/commit
#   STEPS=8 ./run.sh         # longer scaling curve
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

KGAI_REF="${KGAI_REF:-main}"
HOME_DIR="${KGAI_SMOKE_HOME:-$HERE/.smoke-home}"
SRC="$HOME_DIR/src-kgai"
export KGAI_HOME="$HOME_DIR/engine"          # kg binary + libkuzu land here (not ~/.kgai)
export KGAI_STORE="$(mktemp -d -t kgai-smoke-store)"
KG="$KGAI_HOME/bin/kg"

mkdir -p "$HOME_DIR"

if [ ! -d "$SRC/.git" ]; then
  echo "→ cloning kgaidev/kgai@$KGAI_REF"
  git clone --depth 1 --branch "$KGAI_REF" https://github.com/kgaidev/kgai.git "$SRC" 2>/dev/null \
    || git clone --depth 1 https://github.com/kgaidev/kgai.git "$SRC"
fi

# Build via the project's own install.sh (fetches the native Kuzu lib, builds from source).
# CLAUDE_PROJECT_DIR points at an empty temp dir so its ensure_store() never writes into this repo.
if [ ! -x "$KG" ]; then
  echo "→ building kg from source (one-time, ~20s)…"
  TMP_PROJ="$(mktemp -d)"; ( cd "$TMP_PROJ" && git init -q )
  CLAUDE_PLUGIN_ROOT="$SRC" CLAUDE_PROJECT_DIR="$TMP_PROJ" KGAI_HOME="$KGAI_HOME" \
    bash "$SRC/scripts/install.sh"
fi

echo "→ running bench (store: $KGAI_STORE)"
KG="$KG" KGLIB="$KGAI_HOME/lib" KGAI_STORE="$KGAI_STORE" \
  python3 "$HERE/bench.py"

echo "→ cleaning up temp store"
rm -rf "$KGAI_STORE"
