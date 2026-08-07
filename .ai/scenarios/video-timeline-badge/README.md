# video-timeline-badge

Regression scenario for issue-78: clicking the video-timeline badge
(`.dc-artboard-video-badge`) on a `kind="video"` artboard, while in the Move
tool, must open the Timeline panel. Full write-up (hypothesis, driving model,
pre-fix/post-fix regression proof) in `spec.md`.

## Fixture

`.design/ui/Video Timeline Badge Lab.tsx` — throwaway verification canvas,
one `DCArtboard kind="video"` with no real video content (the scenario only
needs the badge's click to reach React; the Timeline panel's own empty-state
is the assertion). Regenerable from the description in `spec.md`.

## Run

```bash
MAUDE_CANVAS_ORIGIN_SPLIT=0 MAUDE_SKIP_RUNTIME_BUILD=1 \
  bun run apps/studio/server.ts --root . --port 5199 &

RUN_DIR=".ai/device/scenario-runs/video-timeline-badge/$(date +%Y-%m-%d-%H%M)"
mkdir -p "$RUN_DIR"
echo "RUN_DIR=$RUN_DIR" > /tmp/scenario-run.env
VIDEO_BADGE_PORT=5199 bash .ai/scenarios/video-timeline-badge/runners/web-desktop.sh
maude scenario-report "$RUN_DIR"
```

Web-desktop only — see `spec.md` platform matrix for the SKIP rationale on
native/mobile (desktop-only dev tool, same as `artboard-kinds`).
