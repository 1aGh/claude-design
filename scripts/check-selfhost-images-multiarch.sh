#!/usr/bin/env bash
# Every image a SELF-HOSTER is told to run must be multi-arch (M10).
#
# The bug this exists to stop: `maude-render` shipped `linux/amd64` only for
# every release after DDR-230, while our own AWS runbook recommends `t4g.small`
# (arm64). `--render` was accepted, the compose file was written, the image
# PULLED (Docker falls back across architectures on pull), and the operator
# learned the truth from `exec format error` after 2.99 GB. Nothing was red:
# `hub-image.yml` builds both architectures, `render-deploy.yml` built one, and
# the two workflows are never read against each other.
#
# Which is why THIS check does not take a list. It reads the compose file
# `maude hub workspace-up` actually renders — the literal instruction a
# self-hoster follows — and asserts every `ghcr.io/1agh/*` image in it. Add a
# sidecar tomorrow and it is covered the moment it appears in the compose
# output, with nobody remembering to widen an array here.
#
#   scripts/check-selfhost-images-multiarch.sh [TAG]
#
# TAG defaults to `v<package.json version>`. Needs docker (buildx) + jq, and
# read access to the public GHCR packages — no login.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
REQUIRED_PLATFORMS=(linux/amd64 linux/arm64)

TAG="${1:-v$(node -p "require('$ROOT/package.json').version")}"

# The set, from the renderer rather than from memory. `render: true` turns on
# every optional sidecar, because the question is "what could a self-hoster be
# told to run", not "what does a default run pull".
REPOS=()
# `|| [ -n "$line" ]` — the last line must survive even unterminated; a loop
# that silently drops the final image is the exact failure this check exists
# to catch, one layer up.
while IFS= read -r line || [ -n "$line" ]; do
  [ -n "$line" ] && REPOS+=("$line")
done < <(node --input-type=module -e "
  import { renderCompose, validateWorkspaceConfig } from '$ROOT/cli/lib/workspace-plan.mjs';
  const { ok, errors, config } = validateWorkspaceConfig({
    domain: 'example.com',
    acmeEmail: 'ops@example.com',
    adminEmail: 'ops@example.com',
    render: true,
  });
  if (!ok) { console.error(errors.join('\n')); process.exit(1); }
  const repos = new Set();
  for (const m of renderCompose(config).matchAll(/^\s*image:\s*(ghcr\.io\/[^:\s]+)/gm)) repos.add(m[1]);
  // Concatenation, not a template literal — this source is inside a
  // double-quoted shell string, where \${…} would be expanded by bash first.
  process.stdout.write([...repos].sort().join('\n') + '\n');
")

if [ "${#REPOS[@]}" -eq 0 ]; then
  echo "✗ no ghcr.io images found in the rendered compose file — the parser has drifted from renderCompose()" >&2
  exit 1
fi

echo "Self-hostable images at $TAG:"
FAILED=0
for repo in "${REPOS[@]}"; do
  ref="$repo:$TAG"

  if ! raw=$(docker buildx imagetools inspect --raw "$ref" 2>&1); then
    echo "  ✗ $ref — not published (${raw%%$'\n'*})"
    FAILED=1
    continue
  fi

  # A single manifest has no `.manifests` at all, which is exactly how the
  # amd64-only render image reads. `unknown/unknown` is buildx's attestation
  # sibling, never something that runs.
  platforms=$(printf '%s' "$raw" | jq -r '.manifests[]?.platform | select(.architecture != "unknown") | "\(.os)/\(.architecture)"' | sort -u)

  missing=()
  for want in "${REQUIRED_PLATFORMS[@]}"; do
    printf '%s\n' "$platforms" | grep -qx "$want" || missing+=("$want")
  done

  if [ "${#missing[@]}" -eq 0 ]; then
    echo "  ✓ $ref — $(printf '%s ' $platforms)"
  else
    echo "  ✗ $ref — publishes '${platforms:-nothing (single-platform manifest)}', missing: ${missing[*]}"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  cat >&2 <<'MSG'

A self-hoster on a missing architecture does not get an error at install time.
Docker pulls the image, compose starts it, and the container exits with
"exec format error" — after downloading the whole thing. Publish the image for
every architecture the docs recommend, or stop recommending that architecture.
MSG
  exit 1
fi

echo "All self-hostable images are multi-arch (${REQUIRED_PLATFORMS[*]})."
