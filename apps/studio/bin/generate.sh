#!/usr/bin/env bash
# generate.sh — feature-ai-media-generation (Phase 0, DDR-16x). Headless BYOK
# AI-media generation: POST a GenRequest to the running dev server's privileged
# /_api/generate-jobs route, poll the job to completion, and print the produced
# content-addressed asset path (`/assets/<sha8>.<ext>`).
#
# The thin, non-browser sibling of the studio generate dialog — the provider call
# happens SERVER-SIDE (the sidecar resolves the key from the OS keychain /
# ~/.config/maude/keys.json and calls the provider directly), so this verb is a
# pure JSON curl + poll, exactly like photo-adjust.sh. No client-side inference,
# so a harness canvas + agent-browser would be pure overhead.
#
# Reached via `maude design generate` (never a raw bin path — DDR-062).
#
# Usage:
#   generate.sh --prompt "<text>" [--provider gemini] [--model <id>]
#     [--modality image] [--aspect 1:1] [--root <repo>] [--timeout <sec>]
#
# The key is NEVER passed here — it lives server-side. Add it in Settings
# (⌘,) or drop it into ~/.config/maude/keys.json (mode 0600).
#
# Requires a running dev server (caller runs `maude design server-up` first);
# reads the port from <designRoot>/_server.json.
#
# Stdout (last line): the produced asset path `/assets/<sha8>.<ext>` (for $(...)).
# Stderr: progress / diagnostics.
# Exit:   0 ok / 1 server problem / 2 bad args / 3 generation failed.

set -euo pipefail

PROMPT="" PROVIDER="gemini" MODEL="" MODALITY="image" ASPECT="" REPO="" TIMEOUT="180"

while [ $# -gt 0 ]; do
  case "$1" in
    --prompt)   PROMPT="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --model)    MODEL="$2"; shift 2 ;;
    --modality) MODALITY="$2"; shift 2 ;;
    --aspect)   ASPECT="$2"; shift 2 ;;
    --root)     REPO="$2"; shift 2 ;;
    --timeout)  TIMEOUT="$2"; shift 2 ;;
    --help|-h)  sed -n '2,29p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "generate.sh: unknown arg '$1'" >&2; exit 2 ;;
  esac
done

[ -n "$PROMPT" ] || { echo "generate.sh: --prompt is required" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "generate.sh: jq is required" >&2; exit 1; }

if [ -z "$REPO" ]; then
  REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
fi
DESIGN_ROOT="$REPO/.design"
[ -d "$DESIGN_ROOT" ] || { echo "generate.sh: no .design/ under $REPO" >&2; exit 1; }

STATE="$DESIGN_ROOT/_server.json"
[ -f "$STATE" ] || { echo "generate.sh: no _server.json (start the dev server first)" >&2; exit 1; }
PORT=$(jq -r '.port // empty' "$STATE" 2>/dev/null)
[ -n "$PORT" ] || { echo "generate.sh: could not read port from $STATE" >&2; exit 1; }

BASE="http://127.0.0.1:$PORT/_api/generate-jobs"

# Build the request body — jq handles all prompt escaping. Omit empty optionals.
BODY=$(jq -n \
  --arg modality "$MODALITY" --arg provider "$PROVIDER" --arg model "$MODEL" \
  --arg prompt "$PROMPT" --arg aspect "$ASPECT" '
  { modality: $modality, provider: $provider, prompt: $prompt }
  + (if $model  != "" then { model: $model }        else {} end)
  + (if $aspect != "" then { aspectRatio: $aspect } else {} end)')

echo "generate.sh: submitting to $PROVIDER ($MODALITY)…" >&2
RESP=$(curl -s -X POST -H 'Content-Type: application/json' -d "$BODY" "$BASE")
JOB_ID=$(printf '%s' "$RESP" | jq -r '.jobId // empty' 2>/dev/null || echo "")
if [ -z "$JOB_ID" ]; then
  echo "generate.sh: enqueue rejected: $RESP" >&2
  exit 3
fi
echo "generate.sh: job $JOB_ID queued — polling…" >&2

# Poll the job list until this job is done/failed, or the timeout elapses.
DEADLINE=$(( $(date +%s) + TIMEOUT ))
while :; do
  JOBS=$(curl -s "$BASE" 2>/dev/null || echo '{}')
  JOB=$(printf '%s' "$JOBS" | jq -c --arg id "$JOB_ID" '.jobs[]? | select(.id == $id)' 2>/dev/null || echo "")
  STATUS=$(printf '%s' "$JOB" | jq -r '.status // empty' 2>/dev/null || echo "")
  case "$STATUS" in
    done)
      ASSET=$(printf '%s' "$JOB" | jq -r '.assets[0] // empty' 2>/dev/null || echo "")
      [ -n "$ASSET" ] || { echo "generate.sh: job done but produced no asset" >&2; exit 3; }
      # Normalize to the leading-slash canvas-relative form writers use.
      printf '/%s\n' "${ASSET#/}"
      exit 0 ;;
    failed)
      ERR=$(printf '%s' "$JOB" | jq -r '.error // "unknown error"' 2>/dev/null || echo "unknown")
      echo "generate.sh: generation failed: $ERR" >&2
      exit 3 ;;
  esac
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then
    echo "generate.sh: timed out after ${TIMEOUT}s (job still $STATUS)" >&2
    exit 3
  fi
  sleep 2
done
