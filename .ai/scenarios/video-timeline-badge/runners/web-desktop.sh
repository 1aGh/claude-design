#!/usr/bin/env bash
# video-timeline-badge — web-desktop runner (issue-78).
# See ../spec.md for the full hypothesis / regression-proof write-up.
set -euo pipefail

. /tmp/scenario-run.env # exports RUN_DIR
DIR="$(pwd)/$RUN_DIR/web-desktop"
mkdir -p "$DIR"
echo "================== web-desktop =================="

PORT="${VIDEO_BADGE_PORT:-5199}"
SESSION="${VIDEO_BADGE_SESSION:-video-timeline-badge}"
SLUG="canvas-row-ui-video-timeline-badge-lab"

fail() {
  echo "fail: $1" >"$DIR/result.txt"
  exit 1
}

# 0. Dev server must already be booted by the caller in same-origin mode:
#   MAUDE_CANVAS_ORIGIN_SPLIT=0 MAUDE_SKIP_RUNTIME_BUILD=1 \
#     bun run apps/studio/server.ts --root . --port $PORT
curl -sS "http://localhost:$PORT/_health" >/dev/null || fail "dev server not reachable on port $PORT"

agent-browser --session "$SESSION" open "http://localhost:$PORT" >/dev/null

# 1. Open the fixture; baseline.
agent-browser --session "$SESSION" eval "
  var el = document.querySelector('[data-testid=\"$SLUG\"]');
  if (el) el.scrollIntoView({block:'center'});
  !!el
" | grep -q true || fail "fixture tree row $SLUG not found — is 'Video Timeline Badge Lab.tsx' present under .design/ui/?"

agent-browser --session "$SESSION" find testid "$SLUG" click >/dev/null

# Canvas iframe build+render is a few seconds (desktop-e2e gotcha: an
# immediate post-click check can see "0 ARTBOARDS" / no badge — timing,
# not a runtime gap). Poll up to ~6s before failing.
BASELINE=""
for _ in 1 2 3 4 5 6; do
  BASELINE=$(agent-browser --session "$SESSION" eval "
    (function () {
      var f = document.querySelector('[data-testid=\"canvas-frame\"]');
      if (!f || !f.contentDocument) return '{}';
      var d = f.contentDocument;
      var canvasEl = d.querySelector('.dc-canvas');
      var badge = d.querySelector('.dc-artboard-video-badge');
      return JSON.stringify({activeTool: canvasEl && canvasEl.getAttribute('data-active-tool'), badgeFound: !!badge});
    })()
  " 2>/dev/null || echo '{}')
  printf '%s' "$BASELINE" | tr -d '\\' | grep -q '"badgeFound":true' && break
  sleep 1
done
agent-browser --session "$SESSION" screenshot "$DIR/step-1-canvas-open.png" >/dev/null
printf '%s' "$BASELINE" | tr -d '\\' | grep -q '"badgeFound":true' || fail "video-timeline badge (.dc-artboard-video-badge) not found on the fixture artboard after 6s (got $BASELINE)"

# 2. Arm Move tool via the same tool-set lane the palette/shortcut uses.
agent-browser --session "$SESSION" eval "
  document.querySelector('[data-testid=\"canvas-frame\"]').contentWindow.postMessage({dgn:'tool-set', tool:'move'}, '*');
  'posted'
" >/dev/null
sleep 0.4
TOOL=$(agent-browser --session "$SESSION" eval "
  document.querySelector('[data-testid=\"canvas-frame\"]').contentDocument.querySelector('.dc-canvas').getAttribute('data-active-tool')
")
printf '%s' "$TOOL" | tr -d '\\' | grep -q '"move"' || fail "tool-set did not arm Move (got $TOOL)"
agent-browser --session "$SESSION" screenshot "$DIR/step-2-move-tool-armed.png" >/dev/null

# 3. Bare click the badge (bubbling pointer-event chain — runs through the
#    router's capture-phase listeners, the exact path the bug lives in).
agent-browser --session "$SESSION" eval "
  var f = document.querySelector('[data-testid=\"canvas-frame\"]');
  var d = f.contentDocument, w = f.contentWindow;
  var badge = d.querySelector('.dc-artboard-video-badge');
  if (!badge) throw new Error('badge disappeared');
  var r = badge.getBoundingClientRect();
  var cx = r.left + r.width/2, cy = r.top + r.height/2;
  var opts = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, button: 0, buttons: 1, view: w };
  badge.dispatchEvent(new PointerEvent('pointerdown', opts));
  badge.dispatchEvent(new MouseEvent('mousedown', opts));
  badge.dispatchEvent(new PointerEvent('pointerup', opts));
  badge.dispatchEvent(new MouseEvent('mouseup', opts));
  badge.dispatchEvent(new MouseEvent('click', opts));
  'dispatched'
" >/dev/null
sleep 0.5

RESULT=$(agent-browser --session "$SESSION" eval "
  JSON.stringify({
    timelinePanelOpen: !!document.querySelector('.tl-panel'),
    timelineEmptyState: !!document.querySelector('[data-testid=\"timeline-empty\"]')
  })
")
printf '%s' "$RESULT" | tr -d '\\' | grep -q '"timelinePanelOpen":true' || fail "Timeline panel did not open after clicking the video-timeline badge in Move tool (issue-78 regression) — got $RESULT"
agent-browser --session "$SESSION" screenshot "$DIR/step-3-timeline-panel-open.png" >/dev/null

echo "pass" >"$DIR/result.txt"
