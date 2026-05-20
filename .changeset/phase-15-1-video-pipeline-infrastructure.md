---
"@1agh/maude": minor
---

Video pipeline infrastructure (phase 15.1) — Remotion workspace under `scripts/video/final/` with nested deps + TikTok-style captioning pipeline + animation libraries + golden-frame regression harness + scaffolder + CSS motion guard + VHS tape discipline + visual QA workflow.

What ships:

- **`scripts/video/final/`** standalone Remotion workspace (own `package.json`, `tsconfig.json`, `remotion.config.ts`, Studio entry). Remotion + React deps move out of repo root.
- **Cherry-picked TikTok captioning** at `src/lib/captioned-clip/` (`Page.tsx` + `SubtitlePage.tsx` + `<CaptionedClip>` wrapper) backed by `@remotion/install-whisper-cpp` + `sub.mjs` build-time pipeline. Caption JSON is editable for Whisper mistranscriptions.
- **Animation libraries** re-exported through `src/lib/animated/` (`remotion-bits` + `remotion-animated`) — `<AnimatedText>`, `<Animated by={[Fade, Move, Scale]}>` etc. on one import surface.
- **Reusable capture wrappers** at `src/lib/capture-frames/` — `<TerminalFrame src=...>` (VHS-captured terminal in shadowed inset) + `<BrowserChrome src=... urlBar=...>` (Playwright capture in mock browser chrome with traffic lights + URL bar).
- **Golden-frame regression harness** (`__tests__/frame-regression.test.ts`) via `@remotion/renderer` `renderStill()` + `pixelmatch`. 18 baseline PNGs cover 6 compositions × 3 frames each.
- **Visual QA workflow** — `pnpm run qa` renders a composition, extracts 12 evenly-spaced JPGs, builds a 4×3 contact sheet. Agent-readable paths (`QA_FRAME <path>`) + human-eyeballable PNG. Mandatory before delivering a final cut.
- **CSS motion guard** (`scripts/check-css-motion.sh`) catches `transition:` / `animation:` in inline styles — the documented Remotion footgun that produces broken frames.
- **VHS tape discipline** — `tapes/_TEMPLATE.tape` canonical template with 1280×720 canvas + Hide+clear+Show pattern baked in; `scripts/check-tape-discipline.sh` lints `tapes/*.tape` for both gotchas. Run via `pnpm run lint:tape`.
- **`/flow:video-new-scene` scaffolder** — `<scene-id> <duration> "<caption>"` → generates scene folder + Root.tsx composition entry + storyboard row. Idempotent (`--force` to overwrite).
- **Music manifest scaffold** at `scripts/video/music/MANIFEST.md` — placeholder structure + curation guidelines (Pixabay / FMA / Mixkit), license URL mandatory per track.
- **DDR-036** records the architectural decisions + the three real-assembly gotchas (VHS Hide buffer leak, Playwright viewport mismatch, why per-scene goldens can't regress captures).
- **Phase 15.5 plan** banner injection so it picks up the new infrastructure.

Out of scope / deferred:

- Real CC0 music track curation (manifest is placeholder).
- Whisper.cpp model download smoke (~466 MB) — captioning tested with hand-crafted Caption JSON.
- GitHub Actions video-render workflow (user explicitly opted out; deferred design in plan).
- Phase 15.5 task-list rewrite (banner is enough; the user already rewrote it on a separate track).

Infrastructure-only release — no user-facing CLI / dev-server / plugin behavior change.
