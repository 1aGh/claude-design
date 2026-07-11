#!/usr/bin/env bash
# transcribe.sh — feature-ai-media-generation (Phase 2, DDR-164). Local, no-key
# speech-to-text for automatic subtitles: run whisper.cpp on an audio/video file
# and emit SRT/VTT through the shared captions.ts reflow. The DEFAULT subtitle
# path — free, offline, private, word-timestamped — with cloud STT (ElevenLabs
# Scribe / Groq Whisper) as the fallback when whisper.cpp isn't installed.
#
# Reached via `maude design transcribe` (never a raw bin path — DDR-062). No dev
# server needed; the work is a local whisper.cpp spawn (mirrors probe-footage).
#
# Usage:
#   transcribe.sh --source <assets/x.mp4|file> [--root <repo>]
#     [--provider whisper|elevenlabs|groq]
#     [--format srt|vtt|both] [--model <id>] [--whisper <bin>]
#     [--lang <code>] [--segments]
#
# The engine is an EXPLICIT user choice (Task 2.6, DDR-164), never an automatic
# fallback: --provider wins, else the project's generation.transcription.provider
# config, else local whisper — and it SAYS which it chose. A chosen cloud engine
# (elevenlabs / groq) needs the dev server running (the key is resolved
# server-side) and an assets/<sha8> source; whisper is local, free, no key.
#
# whisper.cpp is a SOFT dependency (plugins/design/dependencies.json). A ggml
# model is required (--model / $MAUDE_WHISPER_MODEL); whisper.cpp ships no default
# and does not auto-download. See _transcribe.mjs for the download pointer.
#
# Stdout (last line): the produced .srt path (for $(...) capture).
# Exit: 0 ok / 1 dependency-or-input problem / 3 transcription failed.

set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "transcribe.sh: bun is required (hard dependency — see plugins/design/dependencies.json)." >&2
  echo "  Install: curl -fsSL https://bun.sh/install | bash" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bun run "$SCRIPT_DIR/_transcribe.mjs" "$@"
