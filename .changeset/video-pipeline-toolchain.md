---
"@1agh/md-claude": patch
---

chore: Set up agentic video pipeline toolchain in `scripts/video/` (repo-only, not published to npm). Installs Remotion 4 + VHS 0.11 + Playwright 1.60 + ffmpeg 8.1 and proves they integrate via `pnpm run video:smoke` — a ~13s stitched proof clip (VHS terminal scene + Playwright dev-server canvas + Remotion smoke card, normalized + concatenated). Adds `scripts/video/README.md` runbook + DDR-031 documenting the toolchain choice (rejects custom bash pipeline; ~50–60% less code than the original hand-rolled ladder). Refactors the follow-up plan (`.ai/plans/phase-15.5-marketing-demo-video-30s.md`) to consume the new declarative stack. No user-visible behavior change — this lands the infrastructure the next phase needs to author the 30s marketing demo.
