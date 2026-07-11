#!/usr/bin/env bash
# audio-search.sh — feature-ai-media-generation (Task 2.5, DDR-164). Reuse-before-
# you-pay for AUDIO: before generating a new music/SFX/VO track, search the
# project's own generated audio + the user's ElevenLabs history and prefer an
# existing suitable track over spending credits. The search + reuse run
# server-side (the key is resolved by the sidecar), so this is a pure fetch to
# the running dev server — mirrors generate.sh.
#
# Reached via `maude design audio-search` (never a raw bin path — DDR-062).
#
# Usage:
#   audio-search.sh --query "<text>" [--root <repo>] [--reuse <historyId>] [--json]
#
# Requires a running dev server (caller runs `maude design server-up` first).
#
# Stdout (last line, --reuse): the localized /assets/<sha8>.mp3 path.
# Exit: 0 ok / 1 server problem / 2 bad args / 3 search/reuse failed.

set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "audio-search.sh: bun is required (hard dependency — see plugins/design/dependencies.json)." >&2
  echo "  Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bun run "$SCRIPT_DIR/_audio-search.mjs" "$@"
